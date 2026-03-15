import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { OpenRouterService, ToolDefinition, ToolCall, ToolCallResult } from '../open-router.service';

export interface ReActStep {
    step: number;
    thought: string;
    action: string;
    actionInput: any;
    observation: string;
}

export interface ReActResult {
    steps: ReActStep[];
    finalAnswer: string;
    success: boolean;
}

@Injectable()
export class ReActPatternService {
    private readonly logger = new Logger(ReActPatternService.name);

    constructor(
        @Inject(forwardRef(() => OpenRouterService))
        private openRouter: OpenRouterService,
    ) {}

    /**
     * Execute ReAct (Reason-Act-Observe) pattern
     * @param prompt Initial question or problem
     * @param tools Available tools for actions
     * @param toolExecutor Function to execute tool calls
     * @param model Model to use (defaults to GPT-4o for best tool use)
     * @param maxIterations Maximum ReAct iterations
     * @returns ReAct result with reasoning steps
     */
    async execute(
        prompt: string,
        tools: ToolDefinition[],
        toolExecutor: (toolCalls: ToolCall[]) => Promise<ToolCallResult[]>,
        model: string = 'openai/gpt-4o',
        maxIterations: number = 10,
    ): Promise<ReActResult> {
        this.logger.log(`Starting ReAct pattern with ${tools.length} tools, max ${maxIterations} iterations`);

        const reactPrompt = `You are an expert problem solver using the ReAct (Reason-Act-Observe) pattern.

Problem: ${prompt}

Available Tools:
${tools.map(t => `- ${t.function.name}: ${t.function.description}`).join('\n')}

Instructions:
1. THINK: Reason about what you need to do
2. ACT: Use the appropriate tool to gather information
3. OBSERVE: Analyze the tool results
4. Repeat until you can answer the question

Think step by step and use tools when needed.`;

        const steps: ReActStep[] = [];
        let iteration = 0;
        let finalAnswer = '';

        try {
            while (iteration < maxIterations) {
                this.logger.debug(`ReAct iteration ${iteration + 1}/${maxIterations}`);

                // Call LLM with tools
                const result = await this.openRouter.completeWithTools(
                    iteration === 0 ? reactPrompt : 'Continue reasoning based on previous observations.',
                    tools,
                    model,
                    async (toolCalls: ToolCall[]) => {
                        // Execute tools
                        const toolResults = await toolExecutor(toolCalls);

                        // Record step
                        toolCalls.forEach((call, idx) => {
                            const result = toolResults[idx];
                            steps.push({
                                step: steps.length + 1,
                                thought: `Need to use ${call.function.name} to gather information`,
                                action: call.function.name,
                                actionInput: JSON.parse(call.function.arguments),
                                observation: result.content,
                            });
                        });

                        return toolResults;
                    },
                );

                // Check if we got a final answer
                if (typeof result === 'string') {
                    finalAnswer = result;
                    this.logger.log(`ReAct completed with final answer after ${iteration + 1} iterations`);
                    break;
                }

                // If we got tool calls, they were executed and we continue
                if (result.toolCalls && result.toolCalls.length > 0) {
                    iteration++;
                    continue;
                }

                // No tool calls and no answer - might be done
                break;
            }

            if (!finalAnswer && steps.length > 0) {
                // Extract answer from last observation
                const lastStep = steps[steps.length - 1];
                finalAnswer = lastStep.observation || 'Unable to determine final answer';
            }

            return {
                steps,
                finalAnswer,
                success: !!finalAnswer && finalAnswer !== 'Unable to determine final answer',
            };
        } catch (error: any) {
            this.logger.error(`ReAct pattern failed: ${error.message}`);
            return {
                steps,
                finalAnswer: `Error during reasoning: ${error.message}`,
                success: false,
            };
        }
    }

    /**
     * Self-consistency: Run multiple reasoning paths and vote on answer
     * @param prompt Question
     * @param tools Available tools
     * @param toolExecutor Tool executor function
     * @param model Model to use
     * @param numPaths Number of reasoning paths to generate
     * @returns Most consistent answer
     */
    async selfConsistency(
        prompt: string,
        tools: ToolDefinition[],
        toolExecutor: (toolCalls: ToolCall[]) => Promise<ToolCallResult[]>,
        model: string = 'openai/gpt-4o',
        numPaths: number = 3,
    ): Promise<ReActResult & { paths: ReActResult[]; consensus: string }> {
        this.logger.log(`Running self-consistency with ${numPaths} paths`);

        // Run multiple paths in parallel
        const paths = await Promise.all(
            Array.from({ length: numPaths }, () => this.execute(prompt, tools, toolExecutor, model)),
        );

        // Find consensus answer
        const answers = paths.map(p => p.finalAnswer);
        const answerCounts = new Map<string, number>();

        answers.forEach(answer => {
            answerCounts.set(answer, (answerCounts.get(answer) || 0) + 1);
        });

        // Get most common answer
        let consensus = '';
        let maxCount = 0;
        answerCounts.forEach((count, answer) => {
            if (count > maxCount) {
                maxCount = count;
                consensus = answer;
            }
        });

        // Combine all steps
        const allSteps: ReActStep[] = [];
        paths.forEach((path, idx) => {
            path.steps.forEach(step => {
                allSteps.push({
                    ...step,
                    step: allSteps.length + 1,
                });
            });
        });

        return {
            steps: allSteps,
            finalAnswer: consensus || answers[0] || 'No consensus reached',
            success: maxCount >= Math.ceil(numPaths / 2), // Success if majority agree
            paths,
            consensus,
        };
    }
}
