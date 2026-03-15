import { Injectable, Logger, Optional } from '@nestjs/common';
import { OpenRouterService } from '../../ai/open-router.service';
import { McpClientService } from '../../mcp/mcp-client.service';
import { BaseResearchAgent } from './base-research-agent';
import { ScoutFindings, LogicianVerdict, QuantAnalysis, CriticReview } from '../types/swarm.types';
import { JsonRepairUtil } from '../utils/json-repair.util';
import { AgentModelResolverService } from '../services/agent-model-resolver.service';

@Injectable()
export class CriticAgent extends BaseResearchAgent {
  constructor(
    openRouter: OpenRouterService,
    mcpClient: McpClientService,
    @Optional() agentModelResolver?: AgentModelResolverService,
  ) {
    super(openRouter, mcpClient, agentModelResolver);
  }

  /**
   * Critically review findings and identify weaknesses
   */
  async reviewFindings(
    findings: ScoutFindings[],
    logicianVerdict?: LogicianVerdict,
    quantAnalysis?: QuantAnalysis,
    provider?: string,
    model?: string,
    userId?: string,
  ): Promise<CriticReview> {
    // Resolve model from configuration if userId provided
    const resolved = await this.resolveModel(userId, provider || 'openrouter', model || 'google/gemma-3-27b-it');
    const finalProvider = provider || resolved.provider;
    const finalModel = model || resolved.model;
    
    this.logger.log(`Critic Agent: Reviewing ${findings.length} findings (${finalProvider}:${finalModel})`);

    const currentDate = new Date().toISOString().split('T')[0];
    const year = new Date().getFullYear();

    // Build context from findings
    const findingsSummary = findings.map((f, idx) => {
      const facts = f.rawData.map((d) => d.fact).join('; ');
      const sources = f.rawData.map((d) => `${d.source.title} (${d.source.reliability})`).join(', ');
      return `Finding ${idx + 1} (${f.tool}): ${facts.substring(0, 200)}... Sources: ${sources}`;
    }).join('\n\n');

    const logicianSummary = logicianVerdict
      ? `Quality: ${logicianVerdict.qualityScore}%, Completeness: ${logicianVerdict.completenessScore}%, ` +
        `Validated Facts: ${logicianVerdict.validatedFacts.length}, ` +
        `Contradictions: ${logicianVerdict.contradictions.length}, ` +
        `Gaps: ${logicianVerdict.gaps.length}`
      : 'Not yet validated';

    const prompt = `You are "The Critic," a rigorous quality assurance agent. Your role is to challenge findings, identify weaknesses, and ensure research quality.

Today's date: ${currentDate} (year ${year})

Research Findings Summary:
${findingsSummary}

Validation Status:
${logicianSummary}

Your task:
1. Assess overall quality and completeness (0-100 scores)
2. Identify weak evidence (unsupported claims, low-reliability sources, missing context)
3. Identify missing critical information
4. Detect contradictions between sources
5. Provide actionable recommendations for improvement
6. Decide if research should continue or is sufficient

Return a JSON response with this EXACT structure:
{
  "overallAssessment": {
    "qualityScore": 75,
    "completenessScore": 60,
    "confidenceLevel": "medium"
  },
  "weakEvidence": [
    {
      "finding": "Specific finding or claim",
      "issue": "What's wrong with it",
      "severity": "major",
      "suggestedAction": "What to do about it"
    }
  ],
  "missingInformation": [
    {
      "topic": "What information is missing",
      "importance": 8,
      "reason": "Why it matters"
    }
  ],
  "contradictions": [
    {
      "claim1": "First claim",
      "claim2": "Contradicting claim",
      "source1": "Source URL or title",
      "source2": "Source URL or title",
      "resolution": "How to resolve (optional)"
    }
  ],
  "recommendations": [
    {
      "action": "Specific action to take",
      "priority": 8,
      "expectedImpact": "What this will improve"
    }
  ],
  "shouldContinue": true,
  "nextSteps": [
    "Step 1: Search for X",
    "Step 2: Verify Y",
    "Step 3: Get more data on Z"
  ]
}

CRITICAL GUIDELINES:
- Be rigorous but fair
- Prioritize evidence quality over quantity
- Identify gaps that prevent complete understanding
- Suggest concrete, actionable improvements
- Return ONLY valid JSON, no markdown formatting`;

    try {
      const response = await this.callLLM(prompt, finalProvider, finalModel);
      
      let review: CriticReview;
      try {
        review = JsonRepairUtil.repairAndParse<CriticReview>(response, this.logger);
      } catch (parseError: any) {
        this.logger.warn(`Critic Agent: JSON repair failed, trying safe parse: ${parseError.message}`);
        // Try safe parse with fallback
        const fallback: CriticReview = {
          overallAssessment: {
            qualityScore: 50,
            completenessScore: 50,
            confidenceLevel: 'medium',
          },
          weakEvidence: [],
          missingInformation: [],
          contradictions: [],
          recommendations: [],
          shouldContinue: true,
          nextSteps: ['Continue research to improve quality'],
        };
        review = JsonRepairUtil.safeParse<CriticReview>(response, fallback, this.logger);
        
        // If safe parse returned the fallback, try to extract at least quality scores
        if (review === fallback || (review.overallAssessment.qualityScore === 50 && review.overallAssessment.completenessScore === 50)) {
          // Try to extract quality scores from response text
          const qualityMatch = response.match(/"qualityScore"\s*:\s*(\d+)/);
          const completenessMatch = response.match(/"completenessScore"\s*:\s*(\d+)/);
          if (qualityMatch) {
            review.overallAssessment.qualityScore = parseInt(qualityMatch[1], 10);
          }
          if (completenessMatch) {
            review.overallAssessment.completenessScore = parseInt(completenessMatch[1], 10);
          }
        }
      }

      // Validate and set defaults
      if (!review.overallAssessment) {
        review.overallAssessment = {
          qualityScore: 50,
          completenessScore: 50,
          confidenceLevel: 'medium',
        };
      }
      if (!review.weakEvidence) review.weakEvidence = [];
      if (!review.missingInformation) review.missingInformation = [];
      if (!review.contradictions) review.contradictions = [];
      if (!review.recommendations) review.recommendations = [];
      if (typeof review.shouldContinue !== 'boolean') {
        review.shouldContinue = review.overallAssessment.qualityScore < 85;
      }
      if (!review.nextSteps) review.nextSteps = [];

      this.logger.log(
        `Critic Agent: Review complete - Quality: ${review.overallAssessment.qualityScore}%, ` +
        `Completeness: ${review.overallAssessment.completenessScore}%, ` +
        `Continue: ${review.shouldContinue}, ` +
        `${review.weakEvidence.length} weak points, ${review.missingInformation.length} gaps`
      );

      return review;
    } catch (error: any) {
      this.logger.error(`Critic Agent: Failed to review findings: ${error.message}`);
      
      // Fallback review
      return {
        overallAssessment: {
          qualityScore: 50,
          completenessScore: 50,
          confidenceLevel: 'medium',
        },
        weakEvidence: [],
        missingInformation: [],
        contradictions: [],
        recommendations: [],
        shouldContinue: true,
        nextSteps: ['Continue research to improve quality'],
      };
    }
  }
}
