import { Injectable, Logger, Optional } from '@nestjs/common';
import { OpenRouterService } from '../../ai/open-router.service';
import { McpClientService } from '../../mcp/mcp-client.service';
import { BaseResearchAgent } from './base-research-agent';
import { ToolRegistryService } from '../tools/tool-registry.service';
import { StreamManagerService } from '../streaming/stream-manager.service';
import { CitationAgent } from './citation.agent';
import { RapidResponse, ScoutFindings } from '../types/swarm.types';
import { AgentModelResolverService } from '../services/agent-model-resolver.service';

@Injectable()
export class RapidAnalystAgent extends BaseResearchAgent {
  constructor(
    openRouter: OpenRouterService,
    mcpClient: McpClientService,
    private toolRegistry: ToolRegistryService,
    private streamManager: StreamManagerService,
    private citationAgent: CitationAgent,
    @Optional() agentModelResolver?: AgentModelResolverService,
  ) {
    super(openRouter, mcpClient, agentModelResolver);
  }

  /**
   * Generate a quick initial response with streaming
   * This provides immediate value while deep research continues in background
   */
  async generateQuickResponse(
    query: string,
    sessionId: string,
    provider?: string,
    model?: string,
    userId?: string,
  ): Promise<RapidResponse> {
    // Resolve model from configuration if userId provided
    const resolved = await this.resolveModel(userId, provider || 'openrouter', model || 'google/gemma-3-27b-it');
    const finalProvider = provider || resolved.provider;
    const finalModel = model || resolved.model;
    
    this.logger.log(`Rapid Analyst: Generating quick response for "${query}" (${finalProvider}:${finalModel})`);

    // Step 1: Quick web search (limited results for speed)
    this.streamManager.streamToolExecution(sessionId, 'web_search', 'starting');
    const webSearchTool = this.toolRegistry.getTool('web_search');
    let initialFindings: ScoutFindings[] = [];
    let searchResults: any[] = [];

    if (webSearchTool) {
      try {
        this.streamManager.streamToolExecution(sessionId, 'web_search', 'executing');
        const searchResult = await webSearchTool.execute({ query, maxResults: 3 });
        searchResults = searchResult.sources || [];

        // Convert to ScoutFindings format
        initialFindings = [{
          directiveId: 1,
          tool: 'web_search',
          query,
          rawData: searchResults.map((source, idx) => ({
            fact: source.title || '',
            source: {
              url: source.url || '',
              title: source.title || 'Untitled',
              snippet: source.snippet || '',
              reliability: source.reliability || 'medium',
              type: 'other',
            },
            timestamp: new Date().toISOString(),
          })),
          searchOperators: [],
          credibilityScore: 60,
        }];

        this.streamManager.streamToolExecution(sessionId, 'web_search', 'complete', {
          resultCount: searchResults.length,
        });
      } catch (error: any) {
        this.logger.error(`Rapid Analyst: Web search failed: ${error.message}`);
        this.streamManager.streamToolExecution(sessionId, 'web_search', 'complete', { error: error.message });
      }
    }

    // Step 2: Generate quick answer using LLM with search results as context
    const currentDate = new Date().toISOString().split('T')[0];
    const year = new Date().getFullYear();

    const context = searchResults.length > 0
      ? `Recent search results:\n${searchResults.map((r, idx) => `${idx + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet || ''}`).join('\n\n')}`
      : 'No recent search results available.';

    const prompt = `You are "The Rapid Analyst," an expert at providing quick, accurate, and well-sourced answers.

Today's date: ${currentDate} (year ${year})

User query: "${query}"

Context from search:
${context}

Generate a concise, informative answer (2-4 paragraphs) that:
1. Directly addresses the query
2. Cites specific sources when making factual claims
3. Acknowledges uncertainty when information is incomplete
4. Uses clear, accessible language

Format your response as plain text. When referencing information from sources, mention them naturally (e.g., "According to [source title]...").

Answer:`;

    try {
      this.streamManager.streamThinking(sessionId, 'Analyzing query and generating quick response...');
      
      const answer = await this.callLLM(prompt, finalProvider, finalModel);

      // Stream the answer in chunks
      const chunks = this.splitIntoChunks(answer, 50); // Stream in ~50 char chunks
      for (const chunk of chunks) {
        this.streamManager.streamChunk(sessionId, chunk, 'text');
        // Small delay for smooth streaming effect
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      // Step 3: Extract citations
      this.streamManager.streamThinking(sessionId, 'Extracting and verifying citations...');
      const citations = await this.citationAgent.extractCitations(answer, initialFindings, provider, model);
      const verifiedCitations = await this.citationAgent.verifyCitations(citations, initialFindings);

      // Stream citations
      for (const citation of verifiedCitations) {
        this.streamManager.streamCitation(sessionId, citation);
      }

      // Calculate confidence based on source quality
      const confidence = this.calculateConfidence(initialFindings, verifiedCitations.length);

      // Determine estimated depth
      const estimatedDepth: 'quick' | 'moderate' | 'deep' = 
        searchResults.length >= 3 && verifiedCitations.length >= 2 ? 'moderate' : 'quick';

      const response: RapidResponse = {
        answer,
        citations: verifiedCitations,
        sources: searchResults.map((r) => ({
          url: r.url || '',
          title: r.title || 'Untitled',
          domain: this.extractDomain(r.url || ''),
          snippet: r.snippet || '',
          reliability: r.reliability || 'medium',
        })),
        confidence,
        estimatedDepth,
      };

      this.logger.log(
        `Rapid Analyst: Quick response generated - ${answer.length} chars, ` +
        `${verifiedCitations.length} citations, ${confidence}% confidence`
      );

      return response;
    } catch (error: any) {
      this.logger.error(`Rapid Analyst: Failed to generate quick response: ${error.message}`);
      
      // Fallback response
      const fallbackAnswer = `I'm researching "${query}" for you. This may take a moment while I gather comprehensive information from multiple sources.`;
      
      this.streamManager.streamChunk(sessionId, fallbackAnswer, 'text');

      return {
        answer: fallbackAnswer,
        citations: [],
        sources: [],
        confidence: 0,
        estimatedDepth: 'quick',
      };
    }
  }

  /**
   * Split text into chunks for streaming
   */
  private splitIntoChunks(text: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.substring(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Calculate confidence score based on findings and citations
   */
  private calculateConfidence(findings: ScoutFindings[], citationCount: number): number {
    if (findings.length === 0) return 0;

    // Base score from source reliability
    const reliabilityScores: Record<string, number> = {
      high: 10,
      medium: 5,
      low: 1,
    };

    let totalScore = 0;
    let maxScore = 0;

    for (const finding of findings) {
      for (const data of finding.rawData) {
        const score = reliabilityScores[data.source.reliability] || 1;
        totalScore += score;
        maxScore += 10;
      }
    }

    const sourceScore = maxScore > 0 ? (totalScore / maxScore) * 60 : 0;
    const citationScore = Math.min(citationCount * 10, 40); // Up to 40 points for citations

    return Math.round(sourceScore + citationScore);
  }

  /**
   * Extract domain from URL
   */
  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      const match = url.match(/https?:\/\/(?:www\.)?([^\/]+)/);
      return match ? match[1] : url;
    }
  }
}
