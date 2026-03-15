import { Injectable, Logger, Optional } from '@nestjs/common';
import { OpenRouterService } from '../../ai/open-router.service';
import { McpClientService } from '../../mcp/mcp-client.service';
import { EnhancedBaseAgent } from './enhanced-base-agent';
import { ArchitectPlan } from '../types/swarm.types';
import { StructuredOutputSchema } from '../../ai/open-router.service';
import { AgentModelResolverService } from '../services/agent-model-resolver.service';

@Injectable()
export class ArchitectAgent extends EnhancedBaseAgent {
  constructor(
    openRouter: OpenRouterService,
    mcpClient: McpClientService,
    @Optional() agentModelResolver?: AgentModelResolverService,
  ) {
    super(openRouter, mcpClient, agentModelResolver);
  }

  private getArchitectPlanSchema(): StructuredOutputSchema {
    return {
      type: 'object',
      properties: {
        queryType: {
          type: 'string',
          enum: ['financial', 'scientific', 'historical', 'technical', 'comparative', 'factual', 'general', 'osint'],
        },
        complexity: {
          type: 'string',
          enum: ['simple', 'moderate', 'complex'],
        },
        requiresQuant: { type: 'boolean' },
        semanticClusters: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              theme: { type: 'string' },
              subQueries: { type: 'array', items: { type: 'string' } },
              priority: { type: 'number' },
            },
            required: ['theme', 'subQueries', 'priority'],
          },
        },
        searchDirectives: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              step: { type: 'number' },
              action: {
                type: 'string',
                enum: ['search', 'calculate', 'fetch_data', 'verify', 'compare', 'analyze'],
              },
              tool: { type: 'string' },
              query: { type: 'string' },
              reason: { type: 'string' },
              filters: {
                type: 'object',
                properties: {
                  dateRange: {
                    type: 'object',
                    properties: {
                      from: { type: 'string' },
                      to: { type: 'string' },
                    },
                  },
                  fileTypes: { type: 'array', items: { type: 'string' } },
                  domains: { type: 'array', items: { type: 'string' } },
                  sentiment: {
                    type: 'string',
                    enum: ['positive', 'negative', 'neutral', 'any'],
                  },
                },
              },
              dependsOn: { type: 'array', items: { type: 'number' } },
            },
            required: ['step', 'action', 'tool', 'query', 'reason'],
          },
        },
        expectedSources: { type: 'array', items: { type: 'string' } },
        timeScope: {
          type: 'object',
          properties: {
            from: { type: 'string' },
            to: { type: 'string' },
          },
        },
        geographicScope: { type: 'array', items: { type: 'string' } },
        whoWhatWhereWhenWhyHow: {
          type: 'object',
          properties: {
            who: { type: 'array', items: { type: 'string' } },
            what: { type: 'array', items: { type: 'string' } },
            where: { type: 'array', items: { type: 'string' } },
            when: { type: 'array', items: { type: 'string' } },
            why: { type: 'array', items: { type: 'string' } },
            how: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      required: ['queryType', 'complexity', 'requiresQuant', 'semanticClusters', 'searchDirectives', 'expectedSources', 'whoWhatWhereWhenWhyHow'],
    };
  }

  async createResearchPlan(
    query: string,
    provider?: string,
    model?: string,
    userId?: string,
  ): Promise<ArchitectPlan> {
    // Resolve model from configuration if userId provided
    const resolved = await this.resolveModel(userId, provider || 'openrouter', model || 'google/gemma-3-27b-it');
    const finalProvider = provider || resolved.provider;
    const finalModel = model || resolved.model;
    
    this.logger.log(`The Architect: Creating strategic plan for query: "${query}" (${finalProvider}:${finalModel})`);

    // Get current date for context
    const currentDate = new Date();
    const dateStr = currentDate.toISOString().split('T')[0];
    const year = currentDate.getFullYear();

    const prompt = `You are "The Grand Architect," a GOD-mode strategic planner with Master Yoda-level wisdom. You possess an omniscient understanding of information retrieval. You do not search; you direct.

Your role is to take the user's complex, often vague query and break it down into a perfect, executable research strategy.

CORE DIRECTIVES:

1. DECONSTRUCTION: Analyze the user's intent deeply. Break the query into semantic clusters, sub-queries, and specific data points needed. Think in terms of "Who, What, Where, When, Why, and How."

2. FILTER LOGIC: Define exactly what filters must be applied:
   - Date ranges (from/to)
   - File types (PDF, DOCX, XLSX if needed)
   - Domain restrictions (academic, news, official)
   - Sentiment filters (if relevant)

3. RESOURCE ALLOCATION: Determine if the query requires financial expertise (The Quant agent). Financial queries include: stocks, crypto, markets, economics, company financials, trading, investments.

4. STRATEGIC CLARITY: Your instructions to The Scout must be crystal clear. You speak the language of optimal search parameters.

5. HOLISTIC VIEW: Ensure the plan covers all aspects: Who, What, Where, When, Why, and How.

IMPORTANT: Today's date is ${dateStr} (year ${year}). Use this for calculating time periods and understanding temporal context.

Query: "${query}"

Return a JSON response with this EXACT structure:
{
  "queryType": "financial" | "scientific" | "historical" | "technical" | "comparative" | "factual" | "general",
  "complexity": "simple" | "moderate" | "complex",
  "requiresQuant": true | false,
  "semanticClusters": [
    {
      "theme": "Stock price history",
      "subQueries": ["NVIDIA stock price 10 years ago", "NVIDIA current price"],
      "priority": 1
    }
  ],
  "searchDirectives": [
    {
      "step": 1,
      "action": "fetch_data" | "search" | "calculate" | "verify" | "compare" | "analyze",
      "tool": "finance" | "web_search" | "wikipedia" | "calculator" | "document",
      "query": "NVDA",
      "reason": "Get current stock data and price history",
      "filters": {
        "dateRange": {"from": "2014-01-01", "to": "${dateStr}"}
      },
      "dependsOn": []
    }
  ],
  "expectedSources": ["Yahoo Finance", "NASDAQ", "Wikipedia"],
  "timeScope": {"from": "2014-01-01", "to": "${dateStr}"},
  "geographicScope": [],
  "whoWhatWhereWhenWhyHow": {
    "who": ["NVIDIA Corporation"],
    "what": ["Stock performance", "Price history"],
    "where": ["NASDAQ"],
    "when": ["Last 10 years"],
    "why": ["Market analysis"],
    "how": ["Price data", "Financial reports"]
  }

CRITICAL GUIDELINES:
- For finance tool queries, use ONLY the ticker symbol (e.g., "NVDA", "^GSPC", "AAPL")
- For calculator tool, NEVER use variable names. Only suggest calculator AFTER you have actual numbers from other steps.
- For web_search, use descriptive queries with keywords and date ranges
- For document tool, provide valid URLs only
- Sort semanticClusters by priority (1 = highest)
- Sort searchDirectives by step number
- Use dependsOn to indicate step dependencies
- Return ONLY valid JSON, no markdown formatting

Example for "NVIDIA stock performance over the last 10 years" (today is ${dateStr}):
{
  "queryType": "financial",
  "complexity": "moderate",
  "requiresQuant": true,
  "semanticClusters": [
    {"theme": "Historical price data", "subQueries": ["NVDA price 10 years ago", "NVDA price today"], "priority": 1},
    {"theme": "Market events", "subQueries": ["NVIDIA major events 2014-2024", "AI boom impact on NVIDIA"], "priority": 2}
  ],
  "searchDirectives": [
    {"step": 1, "action": "fetch_data", "tool": "finance", "query": "NVDA", "reason": "Get current and historical stock data", "dependsOn": []},
    {"step": 2, "action": "search", "tool": "web_search", "query": "NVIDIA major events ${year - 10}-${year}", "reason": "Find context for price movements", "dependsOn": []},
    {"step": 3, "action": "verify", "tool": "wikipedia", "query": "NVIDIA company history", "reason": "Cross-reference facts", "dependsOn": [2]}
  ],
  "expectedSources": ["Yahoo Finance", "NASDAQ", "Wikipedia", "Reuters", "Bloomberg"],
  "timeScope": {"from": "${year - 10}-01-01", "to": "${dateStr}"},
  "geographicScope": [],
  "whoWhatWhereWhenWhyHow": {
    "who": ["NVIDIA Corporation"],
    "what": ["Stock performance", "Price history", "Market events"],
    "where": ["NASDAQ", "Global markets"],
    "when": ["${year - 10} to ${year}"],
    "why": ["Investment analysis", "Market trends"],
    "how": ["Financial data", "News articles", "Company reports"]
  }
}

Now create the strategic plan for: "${query}"`;

    try {
      this.logger.log(`Calling LLM for strategic planning with structured output (${provider}:${model})...`);
      
      // Use structured output with user's configured model
      // If structured output fails, fallback to regular call with JSON parsing
      let plan: ArchitectPlan;
      try {
        plan = await this.callWithSchema<ArchitectPlan>(
          prompt,
          this.getArchitectPlanSchema(),
          finalProvider,
          finalModel,
        );
      } catch (schemaError) {
        // Fallback to regular call if structured output fails
        this.logger.warn(`Structured output failed with model ${finalModel}, falling back to regular call: ${schemaError.message}`);
        const response = await this.callLLM(prompt, finalProvider, finalModel);
        
        if (!response || !response.trim()) {
          throw new Error('Empty response from LLM');
        }
        
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
        
        try {
          plan = JSON.parse(jsonStr) as ArchitectPlan;
        } catch (parseError) {
          jsonStr = jsonStr.replace(/'/g, '"');
          jsonStr = jsonStr.replace(/(\{|\,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
          plan = JSON.parse(jsonStr) as ArchitectPlan;
        }
      }
      
      // Validate and set defaults
      if (!plan.queryType) plan.queryType = 'factual';
      if (!plan.complexity) plan.complexity = 'moderate';
      if (typeof plan.requiresQuant !== 'boolean') {
        plan.requiresQuant = plan.queryType === 'financial';
      }
      if (!plan.semanticClusters) plan.semanticClusters = [];
      if (!plan.searchDirectives) plan.searchDirectives = [];
      if (!plan.expectedSources) plan.expectedSources = [];
      if (!plan.whoWhatWhereWhenWhyHow) {
        plan.whoWhatWhereWhenWhyHow = {};
      }

      // Sort by priority
      plan.semanticClusters.sort((a, b) => a.priority - b.priority);
      plan.searchDirectives.sort((a, b) => a.step - b.step);

      this.logger.log(
        `The Architect: Strategic plan created - ${plan.queryType}, ${plan.complexity}, ` +
        `${plan.searchDirectives.length} directives, Quant required: ${plan.requiresQuant}`
      );
      
      return plan;
    } catch (error: any) {
      this.logger.error(`The Architect: Failed to create strategic plan: ${error.message}`);
      this.logger.error(`Error stack: ${error.stack}`);
      
      // Fallback plan
      const fallbackPlan: ArchitectPlan = {
        queryType: 'factual',
        complexity: 'moderate',
        requiresQuant: false,
        semanticClusters: [{ theme: 'General research', subQueries: [query], priority: 1 }],
        searchDirectives: [
          { step: 1, action: 'search', tool: 'web_search', query: query, reason: 'Initial search', dependsOn: [] },
        ],
        expectedSources: [],
        whoWhatWhereWhenWhyHow: {},
      };
      
      this.logger.log(`The Architect: Using fallback plan with ${fallbackPlan.searchDirectives.length} directives`);
      return fallbackPlan;
    }
  }

  async createOSINTPlan(
    query: string,
    selectedProfile?: { platform: string; username: string; url: string; persona?: { type: string; profession: string; location: string; interests: string[] } },
    provider?: string,
    model?: string,
    userId?: string,
  ): Promise<ArchitectPlan> {
    // Resolve model from configuration if userId provided
    const resolved = await this.resolveModel(userId, provider || 'openrouter', model || 'google/gemma-3-27b-it');
    const finalProvider = provider || resolved.provider;
    const finalModel = model || resolved.model;
    
    this.logger.log(`The Architect: Creating OSINT plan for query: "${query}"${selectedProfile ? ` with profile: ${selectedProfile.platform}/${selectedProfile.username}` : ''} (${finalProvider}:${finalModel})`);

    const currentDate = new Date();
    const dateStr = currentDate.toISOString().split('T')[0];
    const year = currentDate.getFullYear();

    const profileContext = selectedProfile
      ? `\nSelected Profile Context:
- Platform: ${selectedProfile.platform}
- Username: ${selectedProfile.username}
- URL: ${selectedProfile.url}
${selectedProfile.persona ? `- Persona: ${selectedProfile.persona.type} (${selectedProfile.persona.profession}) from ${selectedProfile.persona.location}
- Interests: ${selectedProfile.persona.interests.join(', ')}` : ''}`
      : '';

    const prompt = `You are "The Grand Architect" specialized in OSINT (Open Source Intelligence) investigations.

Your role is to create a comprehensive strategic plan for investigating an individual or entity across multiple platforms and data sources.

OSINT-SPECIFIC DIRECTIVES:

1. SOCIAL MEDIA DEEP DIVE: Plan systematic searches across:
   - Instagram, Twitter/X, LinkedIn, Facebook, TikTok, GitHub, Reddit
   - Cross-platform username verification
   - Profile consistency analysis

2. CROSS-PLATFORM VERIFICATION: Design verification steps to:
   - Cross-reference profile data across platforms
   - Detect inconsistencies or impersonation
   - Verify profile authenticity

3. RELATIONSHIP MAPPING: Plan to identify:
   - Social connections and networks
   - Professional relationships
   - Family connections (if publicly available)

4. RISK ASSESSMENT METHODOLOGY: Design approach to:
   - Identify potential risks or threats
   - Analyze behavioral patterns
   - Assess credibility and trustworthiness

5. TIMELINE RECONSTRUCTION: Plan to build:
   - Chronological activity timeline
   - Key events and milestones
   - Activity patterns and frequency

6. INFORMATION GATHERING: Plan searches for:
   - Public records and news mentions
   - Professional background and employment
   - Educational history
   - Legal records (if publicly available)
   - Web mentions and digital footprint

Query: "${query}"${profileContext}

Today's date: ${dateStr} (year ${year})

Return a JSON response with this EXACT structure:
{
  "queryType": "osint",
  "complexity": "simple" | "moderate" | "complex",
  "requiresQuant": false,
  "semanticClusters": [
    {
      "theme": "Social Media Profiles",
      "subQueries": ["${query} Instagram", "${query} Twitter", "${query} LinkedIn"],
      "priority": 1
    }
  ],
  "searchDirectives": [
    {
      "step": 1,
      "action": "search" | "verify" | "analyze" | "cross_reference",
      "tool": "web_search" | "wikipedia" | "document",
      "query": "${query} social media profiles",
      "reason": "Discover social media presence",
      "filters": {},
      "dependsOn": []
    }
  ],
  "expectedSources": ["Instagram", "Twitter", "LinkedIn", "News articles"],
  "timeScope": {"from": null, "to": "${dateStr}"},
  "geographicScope": [],
  "whoWhatWhereWhenWhyHow": {
    "who": ["${query}"],
    "what": ["Social media profiles", "Public records", "Online presence"],
    "where": ["Multiple platforms"],
    "when": ["All available time periods"],
    "why": ["OSINT investigation"],
    "how": ["Web search", "Social media scraping", "Public records"]
  }
}

CRITICAL GUIDELINES:
- Focus on publicly available information only
- Prioritize cross-platform verification
- Include relationship mapping steps
- Plan for risk assessment
- Design timeline reconstruction approach
- Use web_search tool for general searches
- Use document tool for specific URLs if available
- Return ONLY valid JSON, no markdown formatting`;

    try {
      this.logger.log(`Calling LLM for OSINT strategic planning with structured output (${provider}:${model})...`);
      
      // Use structured output with user's configured model
      // If structured output fails, fallback to regular call with JSON parsing
      let plan: ArchitectPlan;
      try {
        plan = await this.callWithSchema<ArchitectPlan>(
          prompt,
          this.getArchitectPlanSchema(),
          finalProvider,
          finalModel,
        );
      } catch (schemaError) {
        // Fallback to regular call if structured output fails
        this.logger.warn(`Structured output failed with model ${finalModel}, falling back to regular call: ${schemaError.message}`);
        const response = await this.callLLM(prompt, finalProvider, finalModel);
        
        if (!response || !response.trim()) {
          throw new Error('Empty response from LLM');
        }
        
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
        
        try {
          plan = JSON.parse(jsonStr) as ArchitectPlan;
        } catch (parseError) {
          jsonStr = jsonStr.replace(/'/g, '"');
          jsonStr = jsonStr.replace(/(\{|\,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
          plan = JSON.parse(jsonStr) as ArchitectPlan;
        }
      }
      
      // Validate and set defaults
      plan.queryType = 'osint';
      if (!plan.complexity) plan.complexity = 'moderate';
      plan.requiresQuant = false;
      if (!plan.semanticClusters) plan.semanticClusters = [];
      if (!plan.searchDirectives) plan.searchDirectives = [];
      if (!plan.expectedSources) plan.expectedSources = [];
      if (!plan.whoWhatWhereWhenWhyHow) {
        plan.whoWhatWhereWhenWhyHow = {};
      }

      // Sort by priority
      plan.semanticClusters.sort((a, b) => a.priority - b.priority);
      plan.searchDirectives.sort((a, b) => a.step - b.step);

      this.logger.log(
        `The Architect: OSINT plan created - ${plan.complexity}, ${plan.searchDirectives.length} directives`
      );
      
      return plan;
    } catch (error: any) {
      this.logger.error(`The Architect: Failed to create OSINT plan: ${error.message}`);
      
      // Fallback OSINT plan
      const fallbackPlan: ArchitectPlan = {
        queryType: 'osint',
        complexity: 'moderate',
        requiresQuant: false,
        semanticClusters: [
          { theme: 'Social Media Discovery', subQueries: [query], priority: 1 },
          { theme: 'Cross-Platform Verification', subQueries: [`${query} verification`], priority: 2 },
        ],
        searchDirectives: [
          { step: 1, action: 'search', tool: 'web_search', query: `${query} social media`, reason: 'Discover social media presence', dependsOn: [] },
          { step: 2, action: 'search', tool: 'web_search', query: `${query} news articles`, reason: 'Find news mentions', dependsOn: [] },
        ],
        expectedSources: ['Social media platforms', 'News articles'],
        whoWhatWhereWhenWhyHow: {
          who: [query],
          what: ['Social media profiles', 'Public records'],
          where: ['Multiple platforms'],
          when: ['All available'],
          why: ['OSINT investigation'],
          how: ['Web search', 'Social media scraping'],
        },
      };
      
      this.logger.log(`The Architect: Using fallback OSINT plan`);
      return fallbackPlan;
    }
  }
}
