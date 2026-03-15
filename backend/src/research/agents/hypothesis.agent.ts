import { Injectable, Logger, Optional } from '@nestjs/common';
import { OpenRouterService } from '../../ai/open-router.service';
import { McpClientService } from '../../mcp/mcp-client.service';
import { BaseResearchAgent } from './base-research-agent';
import { ScoutFindings, CriticReview } from '../types/swarm.types';
import { JsonRepairUtil } from '../utils/json-repair.util';
import { AgentModelResolverService } from '../services/agent-model-resolver.service';

export interface Hypothesis {
  statement: string;
  testable: boolean;
  priority: number; // 1-10
  testMethod: string; // How to test this hypothesis
  expectedOutcome: string;
  relatedFindings: string[]; // IDs or descriptions of related findings
}

export interface HypothesisSet {
  hypotheses: Hypothesis[];
  researchQuestions: string[]; // Questions to answer to test hypotheses
  searchQueries: string[]; // Specific search queries to test hypotheses
  priority: number; // Overall priority of this hypothesis set
}

@Injectable()
export class HypothesisAgent extends BaseResearchAgent {
  constructor(
    openRouter: OpenRouterService,
    mcpClient: McpClientService,
    @Optional() agentModelResolver?: AgentModelResolverService,
  ) {
    super(openRouter, mcpClient, agentModelResolver);
  }

  /**
   * Generate testable hypotheses from findings and critic review
   */
  async generateHypotheses(
    query: string,
    findings: ScoutFindings[],
    criticReview: CriticReview,
    provider?: string,
    model?: string,
    userId?: string,
  ): Promise<HypothesisSet> {
    // Resolve model from configuration if userId provided
    const resolved = await this.resolveModel(userId, provider || 'openrouter', model || 'google/gemma-3-27b-it');
    const finalProvider = provider || resolved.provider;
    const finalModel = model || resolved.model;
    
    this.logger.log(`Hypothesis Agent: Generating hypotheses from ${findings.length} findings (${finalProvider}:${finalModel})`);

    const currentDate = new Date().toISOString().split('T')[0];
    const year = new Date().getFullYear();

    // Build findings summary
    const findingsSummary = findings.map((f, idx) => {
      const keyFacts = f.rawData.slice(0, 3).map((d) => d.fact).join('; ');
      return `Finding ${idx + 1}: ${keyFacts}`;
    }).join('\n');

    const gapsSummary = criticReview.missingInformation
      .map((gap) => `${gap.topic} (importance: ${gap.importance}/10)`)
      .join(', ');

    const prompt = `You are "The Hypothesis Generator," an expert at creating testable hypotheses from research findings.

Today's date: ${currentDate} (year ${year})

Original Query: "${query}"

Current Findings:
${findingsSummary}

Identified Gaps:
${gapsSummary}

Weak Evidence Areas:
${criticReview.weakEvidence.map((w) => `${w.finding}: ${w.issue}`).join('\n')}

Your task:
1. Generate 3-5 testable hypotheses that would fill gaps or strengthen weak evidence
2. Each hypothesis should be:
   - Specific and testable
   - Directly related to the query
   - Address a gap or weakness
   - Have a clear test method
3. Generate research questions that would test these hypotheses
4. Generate specific search queries to gather evidence

Return a JSON response with this EXACT structure:
{
  "hypotheses": [
    {
      "statement": "Clear, testable hypothesis statement",
      "testable": true,
      "priority": 8,
      "testMethod": "How to test this (e.g., 'Search for X and verify Y')",
      "expectedOutcome": "What we expect to find",
      "relatedFindings": ["Finding 1", "Finding 2"]
    }
  ],
  "researchQuestions": [
    "Question 1 that tests a hypothesis",
    "Question 2 that tests a hypothesis"
  ],
  "searchQueries": [
    "Specific search query 1",
    "Specific search query 2"
  ],
  "priority": 8
}

CRITICAL GUIDELINES:
- Hypotheses must be testable with available tools (web search, finance, etc.)
- Prioritize hypotheses that address critical gaps
- Make search queries specific and actionable
- Return ONLY valid JSON, no markdown formatting`;

    try {
      const response = await this.callLLM(prompt, finalProvider, finalModel);
      
      let hypothesisSet: HypothesisSet;
      try {
        hypothesisSet = JsonRepairUtil.repairAndParse<HypothesisSet>(response, this.logger);
      } catch (parseError: any) {
        this.logger.warn(`Hypothesis Agent: JSON repair failed, trying safe parse: ${parseError.message}`);
        // Try safe parse with a minimal fallback
        const fallback: HypothesisSet = {
          hypotheses: [],
          researchQuestions: [],
          searchQueries: [],
          priority: 5,
        };
        hypothesisSet = JsonRepairUtil.safeParse<HypothesisSet>(response, fallback, this.logger);
        
        // Try to extract partial data even if full parse failed
        if (hypothesisSet.hypotheses.length === 0 && hypothesisSet.researchQuestions.length === 0) {
          // Try to extract at least one complete hypothesis object
          const hypothesisMatch = response.match(/\{\s*"statement"\s*:\s*"([^"]+)"\s*,\s*"testable"\s*:\s*(true|false)\s*,\s*"priority"\s*:\s*(\d+)/);
          if (hypothesisMatch) {
            hypothesisSet.hypotheses.push({
              statement: hypothesisMatch[1],
              testable: hypothesisMatch[2] === 'true',
              priority: parseInt(hypothesisMatch[3], 10),
              testMethod: 'Search for information to verify this hypothesis',
              expectedOutcome: 'Find data supporting or refuting the hypothesis',
              relatedFindings: [],
            });
            hypothesisSet.priority = parseInt(hypothesisMatch[3], 10);
          }
          
          // Try to extract search queries
          const queryMatches = response.matchAll(/"searchQueries"\s*:\s*\[([^\]]+)\]/g);
          for (const match of queryMatches) {
            const queries = match[1].match(/"([^"]+)"/g);
            if (queries) {
              hypothesisSet.searchQueries = queries.map(q => q.replace(/"/g, ''));
            }
          }
          
          // If we still have nothing, throw to use the gap-based fallback
          if (hypothesisSet.hypotheses.length === 0 && hypothesisSet.researchQuestions.length === 0 && hypothesisSet.searchQueries.length === 0) {
            throw parseError; // Re-throw to trigger the outer catch fallback
          }
        }
      }

      // Validate and set defaults
      if (!hypothesisSet.hypotheses) hypothesisSet.hypotheses = [];
      if (!hypothesisSet.researchQuestions) hypothesisSet.researchQuestions = [];
      if (!hypothesisSet.searchQueries) hypothesisSet.searchQueries = [];
      if (!hypothesisSet.priority) {
        hypothesisSet.priority = hypothesisSet.hypotheses.length > 0
          ? Math.max(...hypothesisSet.hypotheses.map((h) => h.priority))
          : 5;
      }

      // Sort hypotheses by priority
      hypothesisSet.hypotheses.sort((a, b) => b.priority - a.priority);

      this.logger.log(
        `Hypothesis Agent: Generated ${hypothesisSet.hypotheses.length} hypotheses, ` +
        `${hypothesisSet.researchQuestions.length} questions, ` +
        `${hypothesisSet.searchQueries.length} search queries`
      );

      return hypothesisSet;
    } catch (error: any) {
      this.logger.error(`Hypothesis Agent: Failed to generate hypotheses: ${error.message}`);
      
      // Fallback: generate simple hypotheses from gaps
      const missingInfo = criticReview?.missingInformation || [];
      const fallbackHypotheses: Hypothesis[] = missingInfo
        .slice(0, 3)
        .map((gap) => ({
          statement: `More information is needed about ${gap.topic}`,
          testable: true,
          priority: gap.importance || 5,
          testMethod: `Search for information about ${gap.topic}`,
          expectedOutcome: `Find reliable sources about ${gap.topic}`,
          relatedFindings: [],
        }));

      // If no missing info from critic, generate generic hypotheses
      if (fallbackHypotheses.length === 0) {
        fallbackHypotheses.push({
          statement: `Additional research may reveal more insights about ${query}`,
          testable: true,
          priority: 5,
          testMethod: `Search for more recent information about ${query}`,
          expectedOutcome: `Find additional data or perspectives`,
          relatedFindings: [],
        });
      }

      return {
        hypotheses: fallbackHypotheses,
        researchQuestions: missingInfo.length > 0
          ? missingInfo.slice(0, 3).map((gap) => `What information is available about ${gap.topic}?`)
          : [`What additional information exists about ${query}?`],
        searchQueries: missingInfo.length > 0
          ? missingInfo.slice(0, 3).map((gap) => `${query} ${gap.topic}`)
          : [`${query} latest news`, `${query} analysis`],
        priority: fallbackHypotheses.length > 0
          ? Math.max(...fallbackHypotheses.map((h) => h.priority))
          : 5,
      };
    }
  }
}
