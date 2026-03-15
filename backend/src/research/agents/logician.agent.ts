import { Injectable, Logger, Optional } from '@nestjs/common';
import { OpenRouterService } from '../../ai/open-router.service';
import { McpClientService } from '../../mcp/mcp-client.service';
import { BaseResearchAgent } from './base-research-agent';
import { ScoutFindings, QuantAnalysis, LogicianVerdict } from '../types/swarm.types';
import { JsonRepairUtil } from '../utils/json-repair.util';
import { AgentModelResolverService } from '../services/agent-model-resolver.service';

@Injectable()
export class LogicianAgent extends BaseResearchAgent {
  constructor(
    openRouter: OpenRouterService,
    mcpClient: McpClientService,
    @Optional() agentModelResolver?: AgentModelResolverService,
  ) {
    super(openRouter, mcpClient, agentModelResolver);
  }

  async validateFindings(
    scoutFindings: ScoutFindings[],
    quantAnalysis?: QuantAnalysis,
    provider?: string,
    model?: string,
    userId?: string,
  ): Promise<LogicianVerdict> {
    // Resolve model from configuration if userId provided
    const resolved = await this.resolveModel(userId, provider || 'openrouter', model || 'google/gemma-3-27b-it');
    const finalProvider = provider || resolved.provider;
    const finalModel = model || resolved.model;
    
    this.logger.log(
      `The Logician: Validating findings from ${scoutFindings.length} scout findings ` +
      `(${quantAnalysis ? 'with' : 'without'} Quant analysis) (${finalProvider}:${finalModel})`
    );

    // Combine all facts from scout and quant
    const allFacts = scoutFindings.flatMap((f) =>
      f.rawData.map((d) => ({
        fact: d.fact,
        source: d.source,
        metadata: d.metadata,
      }))
    );

    if (allFacts.length === 0) {
      this.logger.warn('The Logician: No facts to validate');
      return {
        validatedFacts: [],
        contradictions: [],
        fallacies: [],
        reasoningChains: [],
        gaps: [],
        qualityScore: 0,
        completenessScore: 0,
      };
    }

    // Build context for validation (limit to prevent timeout)
    const factsContext = allFacts
      .slice(0, 30) // Limit to first 30 facts to prevent timeout
      .map((f, idx) => `${idx + 1}. "${f.fact.substring(0, 150)}${f.fact.length > 150 ? '...' : ''}" (Source: ${f.source.url}, Reliability: ${f.source.reliability})`)
      .join('\n');

    // Simplify quant context to avoid huge JSON strings
    const quantContext = quantAnalysis
      ? `\n\nFinancial Analysis from The Quant:\nSymbol: ${quantAnalysis.financialData.symbol || 'N/A'}, Current Price: ${quantAnalysis.financialData.currentPrice || 'N/A'}, Market Cap: ${quantAnalysis.financialData.marketCap || 'N/A'}`
      : '';

    const prompt = `You are "The Logician," the master of critical thinking, syllogisms, and factual consistency. Your job is to protect the system from hallucinations, false correlations, and logical fallacies.

CORE DIRECTIVES:

1. TRIANGULATION: Compare data points from multiple sources. If Source A says X and Source B says Y, identify the conflict and determine the truth based on evidence weight (reliability, recency, authority).

2. FALLACY DETECTION: Watch out for:
   - Ad hominem attacks: Attacking the person instead of the argument
   - Confirmation bias: Only accepting information that confirms pre-existing beliefs
   - Correlation vs. causation: Assuming A causes B just because they occur together
   - False dilemma: Presenting only two options when more exist
   - Strawman: Misrepresenting an argument to make it easier to attack

3. REASONING CHAIN VALIDATION: Ensure that narrative flow makes sense. "A leads to B, therefore C" must be mathematically and logically sound. Identify missing links in reasoning chains.

4. GAP ANALYSIS: Identify missing premises. If a conclusion is reached but a premise is missing, flag it immediately.

5. TRUTH FILTERING: Discard information that is logically impossible or internally inconsistent.

Facts to Validate:
${factsContext}${quantContext}

Analyze these facts and return a JSON response with this structure:
{
  "validatedFacts": [
    {
      "fact": "NVIDIA stock was $4.50 in Jan 2014",
      "confidence": 95,
      "supportingSources": [
        {
          "url": "https://finance.yahoo.com/quote/NVDA",
          "excerpt": "NVIDIA stock price on Jan 1, 2014 was $4.50",
          "reliability": "high",
          "weight": 10
        }
      ],
      "verified": true
    }
  ],
  "contradictions": [
    {
      "claim1": {
        "fact": "NVIDIA stock was $4.50 in Jan 2014",
        "source": "https://source1.com",
        "reliability": "high"
      },
      "claim2": {
        "fact": "NVIDIA stock was $5.00 in Jan 2014",
        "source": "https://source2.com",
        "reliability": "medium"
      },
      "resolution": "Source 1 is more reliable (Yahoo Finance official data). The correct price is $4.50.",
      "resolvedFact": "NVIDIA stock was $4.50 in Jan 2014"
    }
  ],
  "fallacies": [
    {
      "type": "correlation_causation",
      "description": "Source claims NVIDIA stock rose because of AI boom, but correlation does not prove causation without additional evidence.",
      "source": "https://source.com/article",
      "corrected": true
    }
  ],
  "reasoningChains": [
    {
      "premise": "NVIDIA stock increased 300% over 10 years",
      "conclusion": "NVIDIA is a good investment",
      "valid": false,
      "missingLinks": ["Risk assessment", "Future growth prospects", "Market conditions"]
    }
  ],
  "gaps": [
    {
      "question": "What was the impact of the AI boom on NVIDIA stock?",
      "importance": 9,
      "missingPremise": "No data on AI boom timeline vs stock price correlation",
      "suggestedAction": "Search for AI boom timeline and NVIDIA stock correlation analysis"
    }
  ],
  "qualityScore": 75,
  "completenessScore": 70
}

VALIDATION RULES:
- Confidence (0-100): Based on source reliability, number of supporting sources, and agreement
- Evidence weight: high=10, medium=5, low=1
- Quality score: Based on source reliability, fact verification, data consistency (0-100)
- Completeness score: Based on how well the query is answered, missing information (0-100)
- If quality >= 80 and completeness >= 80, research is likely complete
- Prioritize gaps by importance (1-10)
- Return ONLY valid JSON, no markdown formatting

Now validate the facts:`;

    try {
      // Use longer timeout for Logician agent (120 seconds) due to complex validation
      const response = await this.callLLM(prompt, finalProvider, finalModel, 120000);
      
      let verdict: LogicianVerdict;
      try {
        verdict = JsonRepairUtil.repairAndParse<LogicianVerdict>(response, this.logger);
      } catch (parseError: any) {
        this.logger.warn(`The Logician: JSON repair failed, trying safe parse: ${parseError.message}`);
        // Try safe parse with a minimal fallback
        const fallbackVerdict: LogicianVerdict = {
          validatedFacts: [],
          contradictions: [],
          fallacies: [],
          reasoningChains: [],
          gaps: [],
          qualityScore: 50,
          completenessScore: 50,
        };
        verdict = JsonRepairUtil.safeParse<LogicianVerdict>(response, fallbackVerdict, this.logger);
        
        // If safe parse returned the fallback, try to extract at least scores
        if (verdict === fallbackVerdict || (verdict.qualityScore === 50 && verdict.completenessScore === 50 && verdict.validatedFacts.length === 0)) {
          const qualityMatch = response.match(/"qualityScore"\s*:\s*(\d+)/);
          const completenessMatch = response.match(/"completenessScore"\s*:\s*(\d+)/);
          if (qualityMatch) {
            verdict.qualityScore = parseInt(qualityMatch[1], 10);
          }
          if (completenessMatch) {
            verdict.completenessScore = parseInt(completenessMatch[1], 10);
          }
          
          // If we still have no data, throw to use the catch block's fallback
          if (verdict.validatedFacts.length === 0 && verdict.gaps.length === 0) {
            throw parseError;
          }
        }
      }

      // Validate and set defaults
      if (!verdict.validatedFacts) verdict.validatedFacts = [];
      if (!verdict.contradictions) verdict.contradictions = [];
      if (!verdict.fallacies) verdict.fallacies = [];
      if (!verdict.reasoningChains) verdict.reasoningChains = [];
      if (!verdict.gaps) verdict.gaps = [];
      if (typeof verdict.qualityScore !== 'number') verdict.qualityScore = 50;
      if (typeof verdict.completenessScore !== 'number') verdict.completenessScore = 50;

      // Sort by priority/importance
      verdict.gaps.sort((a, b) => b.importance - a.importance);

      this.logger.log(
        `The Logician: Validation complete - Quality: ${verdict.qualityScore}%, ` +
        `Completeness: ${verdict.completenessScore}%, ` +
        `${verdict.validatedFacts.length} validated facts, ` +
        `${verdict.contradictions.length} contradictions, ` +
        `${verdict.fallacies.length} fallacies, ` +
        `${verdict.gaps.length} gaps`
      );

      return verdict;
    } catch (error: any) {
      // Check if it's a timeout error
      if (error.message && error.message.includes('timed out')) {
        this.logger.warn(`The Logician: Validation timed out, using basic validation`);
      } else {
        this.logger.error(`The Logician: Failed to validate findings: ${error.message}`);
      }
      
      // Fallback: basic validation
      return {
        validatedFacts: allFacts.map((f) => ({
          fact: f.fact,
          confidence: f.source.reliability === 'high' ? 80 : f.source.reliability === 'medium' ? 60 : 40,
          supportingSources: [
            {
              url: f.source.url,
              excerpt: f.source.snippet || '',
              reliability: f.source.reliability,
              weight: f.source.reliability === 'high' ? 10 : f.source.reliability === 'medium' ? 5 : 1,
            },
          ],
          verified: f.source.reliability === 'high',
        })),
        contradictions: [],
        fallacies: [],
        reasoningChains: [],
        gaps: [],
        qualityScore: 50,
        completenessScore: 50,
      };
    }
  }
}
