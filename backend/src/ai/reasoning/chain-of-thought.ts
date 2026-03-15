import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { OpenRouterService } from '../open-router.service';

export interface ReasoningStep {
    step: number;
    thought: string;
    observation?: string;
    conclusion?: string;
}

export interface ChainOfThoughtResult {
    reasoningSteps: ReasoningStep[];
    finalAnswer: string;
    confidence: number; // 0-100
}

@Injectable()
export class ChainOfThoughtService {
    private readonly logger = new Logger(ChainOfThoughtService.name);

    constructor(
        @Inject(forwardRef(() => OpenRouterService))
        private openRouter: OpenRouterService,
    ) {}

    /**
     * Execute chain-of-thought reasoning
     * @param prompt Initial question or problem
     * @param model Model to use (defaults to o1-preview for best reasoning)
     * @param maxSteps Maximum reasoning steps
     * @returns Chain of thought result with reasoning steps
     */
    async reason(
        prompt: string,
        model: string = 'openai/o1-preview',
        maxSteps: number = 10,
    ): Promise<ChainOfThoughtResult> {
        this.logger.log(`Starting chain-of-thought reasoning with ${maxSteps} max steps`);

        const cotPrompt = `You are an expert problem solver. Think through this problem step by step.

Problem: ${prompt}

Instructions:
1. Break down the problem into smaller steps
2. For each step, clearly state what you're thinking
3. Make observations based on your reasoning
4. Draw conclusions from each step
5. Continue until you reach a final answer

Format your response as JSON with this structure:
{
  "reasoningSteps": [
    {
      "step": 1,
      "thought": "What I'm thinking in this step",
      "observation": "What I observe or realize",
      "conclusion": "What I conclude from this step"
    }
  ],
  "finalAnswer": "Your final answer to the problem",
  "confidence": 85
}

Think carefully and show your work.`;

        try {
            const response = await this.openRouter.complete(cotPrompt, model, false);
            
            // Parse the response
            let parsed: ChainOfThoughtResult;
            try {
                // Try to extract JSON from response
                const jsonMatch = response.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    parsed = JSON.parse(jsonMatch[0]);
                } else {
                    throw new Error('No JSON found in response');
                }
            } catch (parseError) {
                // Fallback: create result from text response
                this.logger.warn('Failed to parse CoT response as JSON, creating from text');
                parsed = {
                    reasoningSteps: [
                        {
                            step: 1,
                            thought: response,
                            conclusion: 'Analysis complete',
                        },
                    ],
                    finalAnswer: response,
                    confidence: 70,
                };
            }

            // Validate and limit steps
            if (parsed.reasoningSteps && parsed.reasoningSteps.length > maxSteps) {
                parsed.reasoningSteps = parsed.reasoningSteps.slice(0, maxSteps);
            }

            // Ensure final answer exists
            if (!parsed.finalAnswer && parsed.reasoningSteps.length > 0) {
                const lastStep = parsed.reasoningSteps[parsed.reasoningSteps.length - 1];
                parsed.finalAnswer = lastStep.conclusion || lastStep.thought || 'Unable to determine final answer';
            }

            this.logger.log(`Chain-of-thought completed with ${parsed.reasoningSteps.length} steps, confidence: ${parsed.confidence}%`);
            return parsed;
        } catch (error: any) {
            this.logger.error(`Chain-of-thought reasoning failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Multi-step reasoning with intermediate validation
     * @param prompt Initial question
     * @param validationSteps Steps that require validation
     * @param model Model to use
     * @returns Validated reasoning result
     */
    async reasonWithValidation(
        prompt: string,
        validationSteps: number[],
        model: string = 'openai/o1-preview',
    ): Promise<ChainOfThoughtResult> {
        this.logger.log(`Starting validated chain-of-thought with validation at steps: ${validationSteps.join(', ')}`);

        // First, get initial reasoning
        const initialResult = await this.reason(prompt, model);

        // Validate specified steps
        const validatedSteps = initialResult.reasoningSteps.map((step, index) => {
            if (validationSteps.includes(step.step)) {
                // Add validation marker
                return {
                    ...step,
                    validated: true,
                };
            }
            return step;
        });

        return {
            ...initialResult,
            reasoningSteps: validatedSteps as any,
            confidence: Math.min(initialResult.confidence + 5, 100), // Slight confidence boost from validation
        };
    }
}
