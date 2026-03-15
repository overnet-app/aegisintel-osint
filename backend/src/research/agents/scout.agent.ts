import { Injectable, Logger, Optional } from '@nestjs/common';
import { OpenRouterService, ToolDefinition, ToolCall, ToolCallResult } from '../../ai/open-router.service';
import { McpClientService } from '../../mcp/mcp-client.service';
import { EnhancedBaseAgent } from './enhanced-base-agent';
import { ToolRegistryService } from '../tools/tool-registry.service';
import { ArchitectPlan, ScoutFindings } from '../types/swarm.types';
import { AgentModelResolverService } from '../services/agent-model-resolver.service';

@Injectable()
export class ScoutAgent extends EnhancedBaseAgent {
  constructor(
    openRouter: OpenRouterService,
    mcpClient: McpClientService,
    private toolRegistry: ToolRegistryService,
    @Optional() agentModelResolver?: AgentModelResolverService,
  ) {
    super(openRouter, mcpClient, agentModelResolver);
  }

  async executeSearchPlan(
    plan: ArchitectPlan,
    provider?: string,
    model?: string,
    userId?: string,
  ): Promise<ScoutFindings[]> {
    // Resolve model from configuration if userId provided
    const resolved = await this.resolveModel(userId, provider || 'openrouter', model || 'google/gemma-3-27b-it');
    const finalProvider = provider || resolved.provider;
    const finalModel = model || resolved.model;
    
    this.logger.log(
      `The Scout: Executing search plan with ${plan.searchDirectives.length} directives (${finalProvider}:${finalModel})`
    );

    const findings: ScoutFindings[] = [];

    for (const directive of plan.searchDirectives) {
      this.logger.log(`The Scout: Executing directive ${directive.step}: ${directive.action} with ${directive.tool}`);

      // Check dependencies
      if (directive.dependsOn && directive.dependsOn.length > 0) {
        const dependenciesMet = directive.dependsOn.every((depStep) =>
          findings.some((f) => f.directiveId === depStep)
        );
        if (!dependenciesMet) {
          this.logger.warn(`The Scout: Skipping directive ${directive.step} - dependencies not met`);
          continue;
        }
      }

      // Get the tool
      const tool = this.toolRegistry.getTool(directive.tool);
      if (!tool) {
        this.logger.warn(`The Scout: Tool ${directive.tool} not found, skipping directive ${directive.step}`);
        continue;
      }

      try {
        // Build tool arguments
        const toolArgs: any = {};
        if (directive.tool === 'finance') {
          const query = directive.query || '';
          const symbolMatch = query.match(/^[\^$]?([A-Z0-9]{1,5})/i);
          if (symbolMatch && symbolMatch[1]) {
            const prefix = query.match(/^[\^$]/)?.[0] || '';
            toolArgs.symbol = prefix + symbolMatch[1].toUpperCase();
          } else {
            toolArgs.symbol = query.split(' ')[0] || query;
          }
          if (directive.filters?.dateRange) {
            if (directive.filters.dateRange.from) toolArgs.period = '10y';
          }
        } else if (directive.tool === 'calculator') {
          toolArgs.expression = directive.query || '';
        } else if (directive.tool === 'document') {
          // Validate that the query is actually a URL
          const urlCandidate = directive.query || '';
          try {
            // Try to parse as URL
            new URL(urlCandidate);
            toolArgs.url = urlCandidate;
          } catch {
            // If not a valid URL, try with https:// prefix
            try {
              new URL(`https://${urlCandidate}`);
              toolArgs.url = `https://${urlCandidate}`;
            } catch {
              // Not a valid URL - skip this directive
              this.logger.warn(`Scout: Skipping document tool directive ${directive.step} - invalid URL: "${urlCandidate}"`);
              continue;
            }
          }
        } else {
          toolArgs.query = directive.query || '';
          if (directive.tool === 'web_search' && directive.filters) {
            // Apply filters to query
            let enhancedQuery = directive.query;
            if (directive.filters.dateRange?.from) {
              enhancedQuery += ` after:${directive.filters.dateRange.from}`;
            }
            if (directive.filters.dateRange?.to) {
              enhancedQuery += ` before:${directive.filters.dateRange.to}`;
            }
            if (directive.filters.fileTypes && directive.filters.fileTypes.length > 0) {
              enhancedQuery += ` filetype:${directive.filters.fileTypes.join(' OR filetype:')}`;
            }
            toolArgs.query = enhancedQuery;
          }
        }

        // Execute tool
        const toolResult = await tool.execute(toolArgs);

        // Process results with credibility assessment
        const rawData = await this.processToolResults(
          toolResult,
          directive,
          finalProvider,
          finalModel,
        );

        // Calculate credibility score
        const credibilityScore = this.calculateCredibilityScore(rawData);

        findings.push({
          directiveId: directive.step,
          tool: directive.tool,
          query: directive.query,
          rawData,
          searchOperators: this.extractSearchOperators(directive),
          credibilityScore,
        });

        this.logger.log(
          `The Scout: Directive ${directive.step} complete - ${rawData.length} facts extracted, ` +
          `credibility score: ${credibilityScore}%`
        );
      } catch (error: any) {
        this.logger.error(`The Scout: Error executing directive ${directive.step}: ${error.message}`);
        // Continue with other directives
      }
    }

    this.logger.log(`The Scout: Search plan execution complete - ${findings.length} directives executed`);
    return findings;
  }

  /**
   * Execute search plan using native tool calling (premium feature)
   * This allows the LLM to intelligently decide which tools to use and when
   */
  async executeSearchPlanWithNativeTools(
    plan: ArchitectPlan,
    provider?: string,
    model?: string,
    userId?: string,
  ): Promise<ScoutFindings[]> {
    // Resolve model from configuration if userId provided
    const resolved = await this.resolveModel(userId, provider || 'openrouter', model || 'openai/gpt-4o');
    const finalProvider = provider || resolved.provider;
    const finalModel = model || resolved.model;
    
    this.logger.log(
      `The Scout: Executing search plan with native tool calling (${finalProvider}:${finalModel})`
    );

    // Convert available tools to ToolDefinitions
    const tools = this.toolRegistry.getAllTools();
    const toolDefinitions: ToolDefinition[] = tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));

    // Create a prompt that describes the search plan
    const planDescription = `Execute this research plan:
Query Type: ${plan.queryType}
Complexity: ${plan.complexity}
Semantic Clusters: ${plan.semanticClusters.map(c => c.theme).join(', ')}
Search Directives: ${plan.searchDirectives.length} steps

Execute the search directives in order, respecting dependencies. For each directive:
- Use the specified tool
- Extract factual information
- Assess source credibility
- Return structured findings`;

    const findings: ScoutFindings[] = [];

    // Tool executor function
    const toolExecutor = async (toolCalls: ToolCall[]): Promise<ToolCallResult[]> => {
      const results: ToolCallResult[] = [];

      for (const toolCall of toolCalls) {
        try {
          const tool = this.toolRegistry.getTool(toolCall.function.name);
          if (!tool) {
            results.push({
              toolCallId: toolCall.id,
              role: 'tool',
              name: toolCall.function.name,
              content: JSON.stringify({ error: `Tool ${toolCall.function.name} not found` }),
            });
            continue;
          }

          // Parse tool arguments
          const args = JSON.parse(toolCall.function.arguments);
          const toolResult = await tool.execute(args);

          // Process results
          const rawData = await this.processToolResults(
            toolResult,
            plan.searchDirectives.find(d => d.tool === toolCall.function.name) || plan.searchDirectives[0],
            finalProvider,
            finalModel,
          );

          const credibilityScore = this.calculateCredibilityScore(rawData);

          findings.push({
            directiveId: findings.length + 1,
            tool: toolCall.function.name,
            query: args.query || args.symbol || args.url || '',
            rawData,
            searchOperators: [],
            credibilityScore,
          });

          results.push({
            toolCallId: toolCall.id,
            role: 'tool',
            name: toolCall.function.name,
            content: JSON.stringify({
              content: toolResult.content,
              sources: toolResult.sources,
              facts: rawData.length,
              credibilityScore,
            }),
          });
        } catch (error: any) {
          this.logger.error(`Error executing tool ${toolCall.function.name}: ${error.message}`);
          results.push({
            toolCallId: toolCall.id,
            role: 'tool',
            name: toolCall.function.name,
            content: JSON.stringify({ error: error.message }),
          });
        }
      }

      return results;
    };

    try {
      // Use native tool calling
      const result = await this.callWithTools(
        planDescription,
        toolDefinitions,
        finalProvider,
        finalModel,
        toolExecutor,
      );

      if (typeof result === 'string') {
        // LLM provided final answer without tool calls
        this.logger.log('The Scout: LLM provided answer without tool calls');
      }

      this.logger.log(`The Scout: Native tool calling complete - ${findings.length} findings`);
      return findings;
    } catch (error: any) {
      this.logger.error(`The Scout: Native tool calling failed: ${error.message}`);
      // Fallback to regular execution
      return this.executeSearchPlan(plan, finalProvider, finalModel, userId);
    }
  }

  private async processToolResults(
    toolResult: any,
    directive: ArchitectPlan['searchDirectives'][0],
    provider: string,
    model: string,
  ): Promise<ScoutFindings['rawData']> {
    const rawData: ScoutFindings['rawData'] = [];

        // Extract facts from tool result content
        const facts = await this.extractFacts(toolResult.content, provider, model);

    // Process sources
    const sources = toolResult.sources || [];
    for (let i = 0; i < facts.length; i++) {
      const fact = facts[i];
      const source = sources[i] || sources[0] || { url: '', title: 'Unknown', snippet: '' };

      // Determine source type and reliability
      const sourceType = this.classifySourceType(source.url);
      const reliability = this.assessSourceReliability(source.url, sourceType);

      rawData.push({
        fact,
        source: {
          url: source.url || '',
          title: source.title || 'Untitled',
          snippet: source.snippet || toolResult.content?.substring(0, 200) || '',
          reliability,
          type: sourceType,
        },
        timestamp: new Date().toISOString(),
        metadata: {
          tool: directive.tool,
          directiveStep: directive.step,
          reason: directive.reason,
        },
      });
    }

    return rawData;
  }

  private async extractFacts(
    content: string,
    provider: string,
    model: string,
  ): Promise<string[]> {
    if (!content || content.trim().length === 0) {
      return [];
    }

    const prompt = `You are "The Deep Scout," a top-tier information retrieval agent. Extract discrete, factual statements from the following content.

CORE DIRECTIVES:
- Extract only verifiable facts, not opinions or interpretations
- Each fact should be a complete, standalone statement
- No hallucinations - only facts that are explicitly stated
- Separate multiple facts into individual statements

Content:
${content.substring(0, 4000)} ${content.length > 4000 ? '...' : ''}

Return a JSON array of facts:
["Fact 1", "Fact 2", "Fact 3"]

Return ONLY the JSON array, no markdown formatting.`;

    try {
      const response = await this.callLLM(prompt, provider, model);
      let jsonStr = response.trim();

      // Remove markdown code blocks
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }

      // Extract JSON array
      const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        jsonStr = arrayMatch[0];
      }

      // Fix JSON issues
      jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
      jsonStr = jsonStr.replace(/[\x00-\x1F\x7F]/g, ' ');

      const facts = JSON.parse(jsonStr) as string[];
      return Array.isArray(facts) ? facts.filter((f) => f && f.trim().length > 0) : [];
    } catch (error) {
      this.logger.warn(`The Scout: Failed to extract facts via LLM, using simple extraction: ${error.message}`);
      // Fallback: simple sentence-based extraction
      return content
        .split(/[.!?]\s+/)
        .filter((s) => s.trim().length > 20 && s.trim().length < 500)
        .slice(0, 10);
    }
  }

  private classifySourceType(url: string): ScoutFindings['rawData'][0]['source']['type'] {
    if (!url) return 'other';

    const urlLower = url.toLowerCase();

    // Academic sources
    if (
      urlLower.includes('.edu') ||
      urlLower.includes('arxiv.org') ||
      urlLower.includes('scholar.google') ||
      urlLower.includes('pubmed') ||
      urlLower.includes('jstor')
    ) {
      return 'academic';
    }

    // Official sources
    if (
      urlLower.includes('.gov') ||
      urlLower.includes('.org') ||
      urlLower.includes('sec.gov') ||
      urlLower.includes('federalreserve.gov')
    ) {
      return 'official';
    }

    // News sources
    if (
      urlLower.includes('reuters.com') ||
      urlLower.includes('bloomberg.com') ||
      urlLower.includes('ft.com') ||
      urlLower.includes('wsj.com') ||
      urlLower.includes('nytimes.com') ||
      urlLower.includes('bbc.com') ||
      urlLower.includes('cnn.com') ||
      urlLower.includes('theguardian.com')
    ) {
      return 'news';
    }

    // Technical documentation
    if (
      urlLower.includes('github.com') ||
      urlLower.includes('stackoverflow.com') ||
      urlLower.includes('docs.') ||
      urlLower.includes('developer.')
    ) {
      return 'technical';
    }

    // Forums
    if (
      urlLower.includes('reddit.com') ||
      urlLower.includes('forum.') ||
      urlLower.includes('discussion')
    ) {
      return 'forum';
    }

    return 'other';
  }

  private assessSourceReliability(
    url: string,
    sourceType: ScoutFindings['rawData'][0]['source']['type'],
  ): 'high' | 'medium' | 'low' {
    if (sourceType === 'academic' || sourceType === 'official') {
      return 'high';
    }
    if (sourceType === 'news' || sourceType === 'technical') {
      return 'medium';
    }
    return 'low';
  }

  private calculateCredibilityScore(rawData: ScoutFindings['rawData']): number {
    if (rawData.length === 0) return 0;

    const reliabilityWeights: Record<'high' | 'medium' | 'low', number> = {
      high: 10,
      medium: 5,
      low: 1,
    };

    const totalWeight = rawData.reduce(
      (sum, item) => sum + reliabilityWeights[item.source.reliability],
      0,
    );

    const maxWeight = rawData.length * 10;
    return Math.round((totalWeight / maxWeight) * 100);
  }

  private extractSearchOperators(directive: ArchitectPlan['searchDirectives'][0]): string[] {
    const operators: string[] = [];
    const query = directive.query || '';

    if (directive.filters?.dateRange) {
      operators.push('date_range');
    }
    if (directive.filters?.fileTypes && directive.filters.fileTypes.length > 0) {
      operators.push('filetype');
    }
    if (query.includes(' OR ') || query.includes(' AND ') || query.includes(' NOT ')) {
      operators.push('boolean');
    }
    if (query.includes('"')) {
      operators.push('exact_phrase');
    }
    if (query.includes('site:')) {
      operators.push('site');
    }

    return operators;
  }

  /**
   * Search for social media profiles across multiple platforms
   */
  async searchSocialMediaProfiles(
    username: string,
    platforms: string[],
    provider: string = 'openrouter',
    model: string = 'google/gemma-3-27b-it',
  ): Promise<ScoutFindings> {
    this.logger.log(`The Scout: Searching social media profiles for "${username}" on platforms: ${platforms.join(', ')} (${provider}:${model})`);

    const webSearchTool = this.toolRegistry.getTool('web_search');
    if (!webSearchTool) {
      throw new Error('Web search tool not available');
    }

    const allFindings: ScoutFindings['rawData'] = [];

    for (const platform of platforms) {
      try {
        const query = `${username} ${platform} profile`;
        const result = await webSearchTool.execute({ query });
        
        const facts = await this.extractFacts(result.content, provider, model);
        const sources = result.sources || [];

        for (let i = 0; i < facts.length; i++) {
          const fact = facts[i];
          const source = sources[i] || sources[0] || { url: '', title: 'Unknown', snippet: '' };

          allFindings.push({
            fact: `${platform}: ${fact}`,
            source: {
              url: source.url || '',
              title: source.title || 'Untitled',
              snippet: source.snippet || result.content?.substring(0, 200) || '',
              reliability: this.assessSourceReliability(source.url, this.classifySourceType(source.url)),
              type: this.classifySourceType(source.url),
            },
            timestamp: new Date().toISOString(),
            metadata: {
              tool: 'web_search',
              platform,
              username,
            },
          });
        }
      } catch (error: any) {
        this.logger.warn(`The Scout: Failed to search ${platform} for ${username}: ${error.message}`);
      }
    }

    const credibilityScore = this.calculateCredibilityScore(allFindings);

    return {
      directiveId: 0,
      tool: 'web_search',
      query: `${username} social media profiles`,
      rawData: allFindings,
      searchOperators: ['social_media'],
      credibilityScore,
    };
  }

  /**
   * Search for public records and official information
   */
  async searchPublicRecords(
    query: string,
    provider: string = 'openrouter',
    model: string = 'google/gemma-3-27b-it',
  ): Promise<ScoutFindings> {
    this.logger.log(`The Scout: Searching public records for "${query}" (${provider}:${model})`);

    const webSearchTool = this.toolRegistry.getTool('web_search');
    if (!webSearchTool) {
      throw new Error('Web search tool not available');
    }

    // Enhanced query for public records
    const enhancedQuery = `${query} site:.gov OR site:.org OR "public records" OR "official records"`;

    const result = await webSearchTool.execute({ query: enhancedQuery });
    const facts = await this.extractFacts(result.content, provider, model);
    const sources = result.sources || [];

    const rawData: ScoutFindings['rawData'] = [];
    for (let i = 0; i < facts.length; i++) {
      const fact = facts[i];
      const source = sources[i] || sources[0] || { url: '', title: 'Unknown', snippet: '' };

      const sourceType = this.classifySourceType(source.url);
      rawData.push({
        fact,
        source: {
          url: source.url || '',
          title: source.title || 'Untitled',
          snippet: source.snippet || result.content?.substring(0, 200) || '',
          reliability: this.assessSourceReliability(source.url, sourceType),
          type: sourceType,
        },
        timestamp: new Date().toISOString(),
        metadata: {
          tool: 'web_search',
          recordType: 'public',
        },
      });
    }

    const credibilityScore = this.calculateCredibilityScore(rawData);

    return {
      directiveId: 0,
      tool: 'web_search',
      query: enhancedQuery,
      rawData,
      searchOperators: ['site', 'public_records'],
      credibilityScore,
    };
  }

  /**
   * Search for news and media coverage
   */
  async searchNewsAndMedia(
    query: string,
    timeRange?: { from?: string; to?: string },
    provider: string = 'openrouter',
    model: string = 'google/gemma-3-27b-it',
  ): Promise<ScoutFindings> {
    this.logger.log(`The Scout: Searching news and media for "${query}"${timeRange ? ` (${timeRange.from} to ${timeRange.to})` : ''} (${provider}:${model})`);

    const newsTool = this.toolRegistry.getTool('news');
    if (newsTool) {
      try {
        const result = await newsTool.execute({ query, timeRange });
        const facts = await this.extractFacts(result.content, provider, model);
        const sources = result.sources || [];

        const rawData: ScoutFindings['rawData'] = [];
        for (let i = 0; i < facts.length; i++) {
          const fact = facts[i];
          const source = sources[i] || sources[0] || { url: '', title: 'Unknown', snippet: '' };

          rawData.push({
            fact,
            source: {
              url: source.url || '',
              title: source.title || 'Untitled',
              snippet: source.snippet || result.content?.substring(0, 200) || '',
              reliability: 'medium' as const, // News sources are typically medium reliability
              type: 'news' as const,
            },
            timestamp: new Date().toISOString(),
            metadata: {
              tool: 'news',
              timeRange,
            },
          });
        }

        const credibilityScore = this.calculateCredibilityScore(rawData);
        return {
          directiveId: 0,
          tool: 'news',
          query,
          rawData,
          searchOperators: timeRange ? ['date_range'] : [],
          credibilityScore,
        };
      } catch (error: any) {
        this.logger.warn(`The Scout: News tool failed, falling back to web search: ${error.message}`);
      }
    }

    // Fallback to web search
    const webSearchTool = this.toolRegistry.getTool('web_search');
    if (!webSearchTool) {
      throw new Error('Web search tool not available');
    }

    let enhancedQuery = `${query} news OR article OR media`;
    if (timeRange?.from) {
      enhancedQuery += ` after:${timeRange.from}`;
    }
    if (timeRange?.to) {
      enhancedQuery += ` before:${timeRange.to}`;
    }

    const result = await webSearchTool.execute({ query: enhancedQuery });
    const facts = await this.extractFacts(result.content, provider, model);
    const sources = result.sources || [];

    const rawData: ScoutFindings['rawData'] = [];
    for (let i = 0; i < facts.length; i++) {
      const fact = facts[i];
      const source = sources[i] || sources[0] || { url: '', title: 'Unknown', snippet: '' };

      rawData.push({
        fact,
        source: {
          url: source.url || '',
          title: source.title || 'Untitled',
          snippet: source.snippet || result.content?.substring(0, 200) || '',
          reliability: this.assessSourceReliability(source.url, this.classifySourceType(source.url)),
          type: this.classifySourceType(source.url),
        },
        timestamp: new Date().toISOString(),
        metadata: {
          tool: 'web_search',
          newsSearch: true,
          timeRange,
        },
      });
    }

    const credibilityScore = this.calculateCredibilityScore(rawData);

    return {
      directiveId: 0,
      tool: 'web_search',
      query: enhancedQuery,
      rawData,
      searchOperators: timeRange ? ['date_range'] : [],
      credibilityScore,
    };
  }

  /**
   * Cross-reference findings from multiple sources to identify patterns and verify consistency
   */
  async crossReferenceFindings(
    findings: ScoutFindings[],
    provider: string = 'openrouter',
    model: string = 'google/gemma-3-27b-it',
  ): Promise<ScoutFindings> {
    this.logger.log(`The Scout: Cross-referencing ${findings.length} findings sets (${provider}:${model})`);

    // Collect all facts and sources
    const allFacts: string[] = [];
    const allSources: Array<{ url: string; title: string; snippet: string }> = [];

    for (const finding of findings) {
      for (const data of finding.rawData) {
        allFacts.push(data.fact);
        allSources.push({
          url: data.source.url,
          title: data.source.title,
          snippet: data.source.snippet || '',
        });
      }
    }

    // Use LLM to identify patterns, contradictions, and correlations
    const prompt = `You are "The Deep Scout" performing cross-reference analysis on OSINT findings.

Analyze the following facts and sources to identify:
1. Consistent patterns across sources
2. Contradictions or inconsistencies
3. Correlations and relationships
4. Verified information (mentioned in multiple sources)
5. Unique information (only in one source)

Facts:
${JSON.stringify(allFacts.slice(0, 50), null, 2)} ${allFacts.length > 50 ? `\n... and ${allFacts.length - 50} more facts` : ''}

Sources:
${JSON.stringify(allSources.slice(0, 20), null, 2)} ${allSources.length > 20 ? `\n... and ${allSources.length - 20} more sources` : ''}

Return a JSON object:
{
  "verifiedFacts": ["Fact mentioned in multiple sources", ...],
  "contradictions": [{"fact1": "...", "fact2": "...", "sources": ["url1", "url2"]}, ...],
  "patterns": ["Pattern description", ...],
  "correlations": [{"items": ["item1", "item2"], "relationship": "description"}, ...],
  "uniqueFacts": [{"fact": "...", "source": "url"}, ...]
}

Return ONLY valid JSON, no markdown formatting.`;

    try {
      const response = await this.callLLM(prompt, provider, model);
      let jsonStr = response.trim();

      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }

      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }

      jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
      jsonStr = jsonStr.replace(/[\x00-\x1F\x7F]/g, ' ');

      const analysis = JSON.parse(jsonStr);

      // Convert analysis to ScoutFindings format
      const rawData: ScoutFindings['rawData'] = [];

      if (analysis.verifiedFacts && Array.isArray(analysis.verifiedFacts)) {
        for (const fact of analysis.verifiedFacts) {
          rawData.push({
            fact: `VERIFIED: ${fact}`,
            source: {
              url: 'cross-reference',
              title: 'Cross-Reference Analysis',
              snippet: 'Verified across multiple sources',
              reliability: 'high' as const,
              type: 'other' as const,
            },
            timestamp: new Date().toISOString(),
            metadata: {
              tool: 'cross_reference',
              verificationType: 'multi_source',
            },
          });
        }
      }

      if (analysis.contradictions && Array.isArray(analysis.contradictions)) {
        for (const contradiction of analysis.contradictions) {
          rawData.push({
            fact: `CONTRADICTION: ${contradiction.fact1} vs ${contradiction.fact2}`,
            source: {
              url: contradiction.sources?.[0] || 'unknown',
              title: 'Contradiction Detected',
              snippet: JSON.stringify(contradiction),
              reliability: 'low' as const,
              type: 'other' as const,
            },
            timestamp: new Date().toISOString(),
            metadata: {
              tool: 'cross_reference',
              verificationType: 'contradiction',
            },
          });
        }
      }

      if (analysis.patterns && Array.isArray(analysis.patterns)) {
        for (const pattern of analysis.patterns) {
          rawData.push({
            fact: `PATTERN: ${pattern}`,
            source: {
              url: 'cross-reference',
              title: 'Pattern Analysis',
              snippet: pattern,
              reliability: 'medium' as const,
              type: 'other' as const,
            },
            timestamp: new Date().toISOString(),
            metadata: {
              tool: 'cross_reference',
              verificationType: 'pattern',
            },
          });
        }
      }

      const credibilityScore = this.calculateCredibilityScore(rawData);

      return {
        directiveId: 0,
        tool: 'cross_reference',
        query: 'Cross-reference analysis',
        rawData,
        searchOperators: ['cross_reference'],
        credibilityScore,
      };
    } catch (error: any) {
      this.logger.error(`The Scout: Cross-reference analysis failed: ${error.message}`);
      
      // Return empty findings on error
      return {
        directiveId: 0,
        tool: 'cross_reference',
        query: 'Cross-reference analysis',
        rawData: [],
        searchOperators: [],
        credibilityScore: 0,
      };
    }
  }
}
