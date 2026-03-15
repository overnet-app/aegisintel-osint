import { Injectable, Logger } from '@nestjs/common';
import { OpenRouterService } from '../../ai/open-router.service';
import { McpClientService } from '../../mcp/mcp-client.service';
import { BaseResearchAgent } from './base-research-agent';

export interface ResearchPlan {
  queryType: 'financial' | 'scientific' | 'historical' | 'technical' | 'comparative' | 'factual';
  complexity: 'simple' | 'moderate' | 'complex';
  subQuestions: Array<{
    question: string;
    priority: number;
    toolsNeeded: string[];
    reason: string;
  }>;
  researchStrategy: Array<{
    step: number;
    action: 'search' | 'calculate' | 'fetch_data' | 'verify' | 'compare';
    tool: string;
    query: string;
    reason: string;
    dependsOn?: number[];
  }>;
  expectedSources: string[];
  timeScope?: { from?: string; to?: string };
  geographicScope?: string[];
}

@Injectable()
export class ResearchPlannerAgent extends BaseResearchAgent {
  constructor(
    openRouter: OpenRouterService,
    mcpClient: McpClientService,
  ) {
    super(openRouter, mcpClient);
  }

  async analyzeQuery(
    query: string,
    provider: string = 'openrouter',
    model: string = 'google/gemma-3-27b-it',
  ): Promise<ResearchPlan> {
    this.logger.log(`Analyzing research query: ${query} (${provider}:${model})`);

    // Get current date for context
    const currentDate = new Date();
    const dateStr = currentDate.toISOString().split('T')[0]; // YYYY-MM-DD format
    const year = currentDate.getFullYear();

    const prompt = `You are an expert research planner. Analyze this research query and create a comprehensive research strategy.

IMPORTANT: Today's date is ${dateStr} (year ${year}). Use this for calculating time periods and understanding temporal context.

Query: "${query}"

Your task is to:
1. Identify the query type (financial, scientific, historical, technical, comparative, factual)
2. Assess complexity (simple, moderate, complex)
3. Break down into prioritized sub-questions
4. Create a step-by-step research strategy with tool assignments
5. Identify expected sources and time/geographic scope

Return a JSON response with this structure:
{
  "queryType": "financial" | "scientific" | "historical" | "technical" | "comparative" | "factual",
  "complexity": "simple" | "moderate" | "complex",
  "subQuestions": [
    {
      "question": "What was NVIDIA's stock price 10 years ago?",
      "priority": 1,
      "toolsNeeded": ["finance"],
      "reason": "Baseline for comparison"
    }
  ],
  "researchStrategy": [
    {
      "step": 1,
      "action": "fetch_data" | "search" | "calculate" | "verify" | "compare",
      "tool": "finance" | "web_search" | "wikipedia" | "calculator" | "document",
      "query": "NVDA historical 10y",
      "reason": "Get price history",
      "dependsOn": []
    }
  ],
  "expectedSources": ["Yahoo Finance", "NASDAQ", "Wikipedia"],
  "timeScope": {"from": "2014-01-01", "to": "2024-01-01"},
  "geographicScope": []
}

Guidelines:
- For financial queries, prioritize finance tool and web_search for context
- For scientific queries, prioritize wikipedia and web_search
- For historical queries, identify time scope and use web_search + wikipedia
- Break complex queries into 3-7 sub-questions
- Prioritize steps (1 = highest priority)
- Use dependsOn to indicate step dependencies
- Return ONLY valid JSON, no markdown formatting

Example for "NVIDIA stock performance over the last 10 years" (assuming today is ${dateStr}):
{
  "queryType": "financial",
  "complexity": "moderate",
  "subQuestions": [
    {"question": "What was NVIDIA's stock price 10 years ago?", "priority": 1, "toolsNeeded": ["finance"], "reason": "Baseline for comparison"},
    {"question": "What are the key events that affected NVIDIA stock?", "priority": 2, "toolsNeeded": ["web_search", "wikipedia"], "reason": "Context for price movements"},
    {"question": "What is NVIDIA's current stock price and market cap?", "priority": 1, "toolsNeeded": ["finance"], "reason": "Current state"}
  ],
  "researchStrategy": [
    {"step": 1, "action": "fetch_data", "tool": "finance", "query": "NVDA", "reason": "Get current stock data and price history", "dependsOn": []},
    {"step": 2, "action": "calculate", "tool": "calculator", "query": "(currentPrice - oldPrice) / oldPrice * 100", "reason": "Calculate percentage growth", "dependsOn": [1]},
    {"step": 3, "action": "search", "tool": "web_search", "query": "NVIDIA major events ${year - 10}-${year}", "reason": "Find context for price movements", "dependsOn": []},
    {"step": 4, "action": "verify", "tool": "wikipedia", "query": "NVIDIA company history", "reason": "Cross-reference facts", "dependsOn": [3]}
  ],
  "expectedSources": ["Yahoo Finance", "NASDAQ", "Wikipedia", "Reuters", "Bloomberg"],
  "timeScope": {"from": "${year - 10}-01-01", "to": "${dateStr}"},
  "geographicScope": []
}

CRITICAL NOTES:
- For finance tool queries, the "query" field should be just the stock ticker symbol (e.g., "NVDA", "AAPL", "MSFT") NOT a description
- For calculator tool queries, provide ACTUAL NUMBERS, not variable names or placeholders. 
  WRONG: "(CurrentPrice - OldPrice) / OldPrice * 100" 
  RIGHT: "(150.50 - 45.20) / 45.20 * 100"
  If you don't have the numbers yet, skip the calculator step or mark it as dependent on data-fetching steps
- For web_search tool, use descriptive queries with relevant keywords and date ranges
- For document tool, provide a valid URL
- Always use the current year (${year}) for time calculations
- Calculator should only be used AFTER you have obtained actual numeric values from other tools

Now analyze: "${query}"`;

    try {
      this.logger.log(`Calling LLM for planning (${provider}:${model})...`);
      const response = await this.callLLM(prompt, provider, model);
      
      if (!response || !response.trim()) {
        throw new Error('Empty response from LLM');
      }
      
      this.logger.log(`Received LLM response (${response.length} chars), parsing...`);
      let jsonStr = response.trim();
      
      // Remove markdown code blocks
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }
      
      // Try to extract JSON if there's extra text around it
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }
      
      // Fix common JSON issues from LLMs
      // 1. Remove trailing commas before closing braces/brackets
      jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
      // 2. Remove control characters
      jsonStr = jsonStr.replace(/[\x00-\x1F\x7F]/g, ' ');

      let plan: ResearchPlan;
      try {
        plan = JSON.parse(jsonStr) as ResearchPlan;
      } catch (parseError) {
        // If parsing still fails, try a more aggressive fix
        this.logger.warn(`Initial JSON parse failed, attempting recovery: ${parseError.message}`);
        
        // Replace single quotes with double quotes
        jsonStr = jsonStr.replace(/'/g, '"');
        // Fix property names without quotes
        jsonStr = jsonStr.replace(/(\{|\,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
        
        plan = JSON.parse(jsonStr) as ResearchPlan;
      }
      
      // Validate and set defaults
      if (!plan.queryType) plan.queryType = 'factual';
      if (!plan.complexity) plan.complexity = 'moderate';
      if (!plan.subQuestions) plan.subQuestions = [];
      if (!plan.researchStrategy) plan.researchStrategy = [];
      if (!plan.expectedSources) plan.expectedSources = [];

      // Sort by priority
      plan.subQuestions.sort((a, b) => a.priority - b.priority);
      plan.researchStrategy.sort((a, b) => a.step - b.step);

      this.logger.log(`Research plan created: ${plan.queryType}, ${plan.complexity}, ${plan.researchStrategy.length} steps`);
      
      this.logger.log(`Successfully parsed research plan: ${plan.queryType}, ${plan.complexity}, ${plan.researchStrategy.length} steps`);
      return plan;
    } catch (error: any) {
      this.logger.error(`Failed to create research plan: ${error.message}`);
      this.logger.error(`Error stack: ${error.stack}`);
      
      // Fallback plan
      const fallbackPlan = {
        queryType: 'factual' as const,
        complexity: 'moderate' as const,
        subQuestions: [{ question: query, priority: 1, toolsNeeded: ['web_search'], reason: 'General research' }],
        researchStrategy: [
          { step: 1, action: 'search' as const, tool: 'web_search', query: query, reason: 'Initial search', dependsOn: [] },
        ],
        expectedSources: [] as string[],
      };
      
      this.logger.log(`Using fallback plan with ${fallbackPlan.researchStrategy.length} steps`);
      return fallbackPlan;
    }
  }
}
