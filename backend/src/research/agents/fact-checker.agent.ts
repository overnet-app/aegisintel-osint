import { Injectable, Logger } from '@nestjs/common';
import { OpenRouterService } from '../../ai/open-router.service';
import { McpClientService } from '../../mcp/mcp-client.service';
import { BaseResearchAgent } from './base-research-agent';

export interface FactCheckResult {
  claim: string;
  verdict: 'verified' | 'partially_true' | 'unverified' | 'contradicted';
  confidence: number; // 0-100
  supportingSources: Array<{
    url: string;
    excerpt: string;
    reliability: 'high' | 'medium' | 'low';
  }>;
  contradictingSources: Array<{
    url: string;
    excerpt: string;
    reliability: 'high' | 'medium' | 'low';
  }>;
  reasoning: string;
}

@Injectable()
export class FactCheckerAgent extends BaseResearchAgent {
  constructor(
    openRouter: OpenRouterService,
    mcpClient: McpClientService,
  ) {
    super(openRouter, mcpClient);
  }

  async verifyFacts(
    claims: string[],
    sources: Array<{ url: string; title: string; snippet: string }>,
    provider: string = 'openrouter',
    model: string = 'google/gemma-3-27b-it',
  ): Promise<FactCheckResult[]> {
    this.logger.log(`Verifying ${claims.length} claims against ${sources.length} sources (${provider}:${model})`);

    const prompt = `You are a fact-checker. Verify the following claims against the provided sources.

Claims to verify:
${JSON.stringify(claims, null, 2)}

Available Sources:
${JSON.stringify(sources, null, 2)}

For each claim, return a JSON array with this structure:
[
  {
    "claim": "NVIDIA stock was $4.50 in Jan 2014",
    "verdict": "verified" | "partially_true" | "unverified" | "contradicted",
    "confidence": 95,
    "supportingSources": [
      {
        "url": "https://finance.yahoo.com/...",
        "excerpt": "NVIDIA stock price on Jan 1, 2014 was $4.50",
        "reliability": "high" | "medium" | "low"
      }
    ],
    "contradictingSources": [],
    "reasoning": "Multiple high-reliability sources confirm this fact."
  }
]

Guidelines:
- "verified": Claim is supported by reliable sources
- "partially_true": Claim is partially correct but needs qualification
- "unverified": No sources found to support or contradict
- "contradicted": Sources directly contradict the claim
- Confidence: 0-100 based on source quality and agreement
- Reliability: high (established news, official data), medium (blogs, forums), low (unverified)
- Return ONLY valid JSON array, no markdown formatting

Now verify the claims:`;

    try {
      const response = await this.callLLM(prompt, provider, model);
      
      let jsonStr = response.trim();
      
      // Remove markdown code blocks
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }
      
      // Try to extract JSON array if there's extra text around it
      const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }
      
      // Fix common JSON issues from LLMs
      jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1'); // Remove trailing commas
      jsonStr = jsonStr.replace(/[\x00-\x1F\x7F]/g, ' '); // Remove control characters

      let results: FactCheckResult[];
      try {
        results = JSON.parse(jsonStr) as FactCheckResult[];
      } catch (parseError) {
        this.logger.warn(`Initial JSON parse failed, attempting recovery: ${parseError.message}`);
        jsonStr = jsonStr.replace(/'/g, '"');
        jsonStr = jsonStr.replace(/(\{|\,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
        results = JSON.parse(jsonStr) as FactCheckResult[];
      }
      
      // Validate each result
      return results.map((result) => ({
        claim: result.claim || '',
        verdict: result.verdict || 'unverified',
        confidence: typeof result.confidence === 'number' ? result.confidence : 0,
        supportingSources: result.supportingSources || [],
        contradictingSources: result.contradictingSources || [],
        reasoning: result.reasoning || 'No reasoning provided.',
      }));
    } catch (error) {
      this.logger.error(`Failed to verify facts: ${error.message}`);
      
      // Fallback: mark all as unverified
      return claims.map((claim) => ({
        claim,
        verdict: 'unverified' as const,
        confidence: 0,
        supportingSources: [],
        contradictingSources: [],
        reasoning: 'Fact-checking failed due to an error.',
      }));
    }
  }
}
