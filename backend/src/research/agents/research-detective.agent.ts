import { Injectable, Logger } from '@nestjs/common';
import { OpenRouterService } from '../../ai/open-router.service';
import { McpClientService } from '../../mcp/mcp-client.service';
import { BaseResearchAgent } from './base-research-agent';

export interface ResearchAnalysis {
  findings: Array<{
    fact: string;
    confidence: 'high' | 'medium' | 'low';
    sources: string[];
    verified: boolean;
  }>;
  gaps: Array<{
    question: string;
    importance: number;
    suggestedTool: string;
    suggestedQuery: string;
  }>;
  contradictions: Array<{
    claim1: { fact: string; source: string };
    claim2: { fact: string; source: string };
    resolution: string;
  }>;
  followUpQuestions: Array<{
    question: string;
    reason: string;
    priority: number;
  }>;
  correlations?: Array<{
    items: string[];
    relationship: string;
    confidence: number;
  }>;
  qualityScore: number; // 0-100
  completenessScore: number; // 0-100
  nextActions: Array<{
    action: string;
    tool: string;
    query: string;
    reason: string;
    priority: number;
  }>;
  summary: string;
}

@Injectable()
export class ResearchDetectiveAgent extends BaseResearchAgent {
  constructor(
    openRouter: OpenRouterService,
    mcpClient: McpClientService,
  ) {
    super(openRouter, mcpClient);
  }

  async analyzeFindings(
    query: string,
    currentData: any,
    provider: string = 'openrouter',
    model: string = 'google/gemma-3-27b-it',
  ): Promise<ResearchAnalysis> {
    this.logger.log(`Analyzing research findings for query: ${query} (${provider}:${model})`);

    // Get current date for context
    const currentDate = new Date();
    const dateStr = currentDate.toISOString().split('T')[0];
    const year = currentDate.getFullYear();

    const prompt = `You are an expert research analyst. Analyze the current research findings and identify gaps, contradictions, and follow-up actions.

IMPORTANT: Today's date is ${dateStr} (year ${year}). Use this when evaluating temporal context and suggesting follow-up queries.

Original Query: "${query}"

Current Findings:
${JSON.stringify(currentData, null, 2)}

Your task:
1. Extract key facts from the findings
2. Assess confidence level for each fact based on source quality
3. Identify information gaps
4. Detect contradictions between sources
5. Generate follow-up questions
6. Calculate quality score (0-100) and completeness score (0-100)
7. Suggest next actions with priorities

Return a JSON response with this structure:
{
  "findings": [
    {
      "fact": "NVIDIA stock was $4.50 in Jan 2014",
      "confidence": "high" | "medium" | "low",
      "sources": ["Yahoo Finance"],
      "verified": true
    }
  ],
  "gaps": [
    {
      "question": "What was the impact of the AI boom on NVIDIA?",
      "importance": 9,
      "suggestedTool": "web_search",
      "suggestedQuery": "NVIDIA AI boom stock impact 2023"
    }
  ],
  "contradictions": [],
  "followUpQuestions": [
    {
      "question": "How does NVIDIA compare to AMD in the same period?",
      "reason": "Competitive context",
      "priority": 6
    }
  ],
  "qualityScore": 75,
  "completenessScore": 70,
  "nextActions": [
    {
      "action": "search",
      "tool": "web_search",
      "query": "NVIDIA AI revenue growth 2022-2024",
      "reason": "Fill gap about AI impact",
      "priority": 9
    }
  ],
  "summary": "Good baseline data collected. Need to research AI boom impact to complete analysis."
}

Guidelines:
- Quality score: Based on source reliability, fact verification, data consistency
- Completeness score: Based on how well the query is answered, missing information
- If quality >= 80 and completeness >= 80, research is likely complete
- Prioritize gaps by importance (1-10)
- Sort nextActions by priority (highest first)
- For finance tool queries, use just the ticker symbol (e.g., "NVDA", "AAPL")
- For calculator tool, use ACTUAL NUMBERS only, not variable names or placeholders
  WRONG: "(CurrentPrice - OldPrice) / OldPrice * 100"
  RIGHT: "(150.50 - 45.20) / 45.20 * 100"
  Only suggest calculator when you have actual numeric values from previous findings
- For document tool, use valid URLs
- Use the current year (${year}) in date-related queries
- Return ONLY valid JSON, no markdown formatting

Now analyze the findings:`;

    try {
      const response = await this.callLLM(prompt, provider, model);
      
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
      // 2. Fix unescaped newlines in strings
      jsonStr = jsonStr.replace(/(?<!\\)"\s*\n\s*"/g, '" "');
      // 3. Remove control characters
      jsonStr = jsonStr.replace(/[\x00-\x1F\x7F]/g, ' ');

      let analysis: ResearchAnalysis;
      try {
        analysis = JSON.parse(jsonStr) as ResearchAnalysis;
      } catch (parseError) {
        // If parsing still fails, try a more aggressive fix
        this.logger.warn(`Initial JSON parse failed, attempting recovery: ${parseError.message}`);
        
        // Replace single quotes with double quotes (common LLM mistake)
        jsonStr = jsonStr.replace(/'/g, '"');
        // Fix property names without quotes
        jsonStr = jsonStr.replace(/(\{|\,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
        
        analysis = JSON.parse(jsonStr) as ResearchAnalysis;
      }
      
      // Validate and set defaults
      if (!analysis.findings) analysis.findings = [];
      if (!analysis.gaps) analysis.gaps = [];
      if (!analysis.contradictions) analysis.contradictions = [];
      if (!analysis.followUpQuestions) analysis.followUpQuestions = [];
      if (typeof analysis.qualityScore !== 'number') analysis.qualityScore = 50;
      if (typeof analysis.completenessScore !== 'number') analysis.completenessScore = 50;
      if (!analysis.nextActions) analysis.nextActions = [];
      if (!analysis.summary) analysis.summary = 'Analysis complete.';

      // Sort by priority
      analysis.gaps.sort((a, b) => b.importance - a.importance);
      analysis.followUpQuestions.sort((a, b) => b.priority - a.priority);
      analysis.nextActions.sort((a, b) => b.priority - a.priority);

      this.logger.log(
        `Research analysis: quality=${analysis.qualityScore}, completeness=${analysis.completenessScore}, ` +
        `${analysis.findings.length} findings, ${analysis.gaps.length} gaps, ${analysis.nextActions.length} actions`
      );
      
      return analysis;
    } catch (error) {
      this.logger.error(`Failed to analyze findings: ${error.message}`);
      
      // Fallback
      return {
        findings: [],
        gaps: [],
        contradictions: [],
        followUpQuestions: [],
        qualityScore: 50,
        completenessScore: 50,
        nextActions: [],
        summary: 'Analysis failed due to an error.',
      };
    }
  }
}
