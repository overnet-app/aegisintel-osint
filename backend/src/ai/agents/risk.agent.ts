import { Injectable, Logger, Optional } from '@nestjs/common';
import { OpenRouterService, AiModel, StructuredOutputSchema } from '../open-router.service';
import { RISK_ASSESSMENT_PROMPT } from '../prompts/risk-assessment';
import { extractJson } from '../utils/json-extractor';
import { ChainOfThoughtService } from '../reasoning/chain-of-thought';

@Injectable()
export class RiskAgent {
    private readonly logger = new Logger(RiskAgent.name);

    constructor(
        private openRouter: OpenRouterService,
        @Optional() private chainOfThought?: ChainOfThoughtService,
    ) { }

    async assessRisk(data: any, model?: string): Promise<{ riskLevel: string; findings: string[]; explanation: string }> {
        this.logger.log('Performing risk assessment on gathered data');

        const prompt = RISK_ASSESSMENT_PROMPT(JSON.stringify(data, null, 2));

        try {
            const response = await this.openRouter.complete(prompt, model);
            const extracted = extractJson<{ riskLevel: string; findings: string[]; explanation: string }>(response);
            
            if (extracted) {
                return extracted;
            }

            // Fallback parsing
            const jsonString = response.replace(/```json|```/g, '').trim();
            const start = jsonString.indexOf('{');
            const end = jsonString.lastIndexOf('}');
            if (start !== -1 && end !== -1) {
                return JSON.parse(jsonString.substring(start, end + 1));
            }
            return JSON.parse(jsonString);
        } catch (error) {
            this.logger.error(`Failed to assess risk: ${error.message}`);
            return {
                riskLevel: 'UNKNOWN',
                findings: ['Error occurred during analysis'],
                explanation: 'Internal analysis error.'
            };
        }
    }

    /**
     * Assess risk with chain-of-thought reasoning (premium feature)
     */
    async assessRiskWithReasoning(
        data: any,
        model: string = 'openai/o1-preview',
    ): Promise<{ riskLevel: string; findings: string[]; explanation: string; reasoningSteps: any[] }> {
        this.logger.log('Performing risk assessment with reasoning');

        const prompt = `Assess the risk level of the following data. Think through the risk factors step by step.

Data:
${JSON.stringify(data, null, 2)}

Consider:
1. What are the potential threats?
2. What is the likelihood of each threat?
3. What would be the impact?
4. What is the overall risk level?`;

        try {
            if (this.chainOfThought) {
                const reasoning = await this.chainOfThought.reason(prompt, model);
                
                // Extract risk assessment from reasoning
                const riskPrompt = `${RISK_ASSESSMENT_PROMPT(JSON.stringify(data, null, 2))}

Based on the reasoning: ${reasoning.finalAnswer}`;

                const schema: StructuredOutputSchema = {
                    type: 'object',
                    properties: {
                        riskLevel: { type: 'string' },
                        findings: { type: 'array', items: { type: 'string' } },
                        explanation: { type: 'string' },
                    },
                    required: ['riskLevel', 'findings', 'explanation'],
                };

                // Use the provided model directly - respect user's configuration
                const assessment = await this.openRouter.completeWithSchema<{
                    riskLevel: string;
                    findings: string[];
                    explanation: string;
                }>(riskPrompt, schema, model);

                return {
                    ...assessment,
                    reasoningSteps: reasoning.reasoningSteps,
                };
            } else {
                // Fallback to regular assessment
                return {
                    ...(await this.assessRisk(data, model)),
                    reasoningSteps: [],
                };
            }
        } catch (error: any) {
            this.logger.error(`Failed to assess risk with reasoning: ${error.message}`);
            return {
                riskLevel: 'UNKNOWN',
                findings: ['Error occurred during analysis'],
                explanation: 'Internal analysis error.',
                reasoningSteps: [],
            };
        }
    }
}
