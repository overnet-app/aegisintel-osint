import { Injectable, Logger } from '@nestjs/common';
import { OpenRouterService, AiModel, StructuredOutputSchema } from '../open-router.service';
import { SUMMARY_PROMPT } from '../prompts/summary';

export interface StructuredSummary {
    executiveSummary: string;
    keyFindings: string[];
    timeline?: string;
    riskAssessment?: {
        level: string;
        factors: string[];
    };
    recommendations: string[];
    citations: Array<{
        text: string;
        source: string;
    }>;
}

@Injectable()
export class SummaryAgent {
    private readonly logger = new Logger(SummaryAgent.name);

    constructor(private openRouter: OpenRouterService) { }

    async summarize(
        data: any,
        model?: string,
        timeline?: string,
        psychProfile?: string,
        patterns?: string,
    ): Promise<string> {
        this.logger.log('Generating summary for gathered data');

        const prompt = SUMMARY_PROMPT(
            JSON.stringify(data, null, 2),
            timeline,
            psychProfile,
            patterns,
        );

        try {
            return await this.openRouter.complete(prompt, model);
        } catch (error) {
            this.logger.error(`Failed to generate summary: ${error.message}`);
            return 'Failed to generate summary due to an internal error.';
        }
    }

    /**
     * Generate structured summary with citations (premium feature)
     */
    async summarizeStructured(
        data: any,
        model: string = 'google/gemma-3-27b-it', // Default fallback only if no model provided
        timeline?: string,
        psychProfile?: string,
        patterns?: string,
    ): Promise<StructuredSummary> {
        this.logger.log('Generating structured summary with citations');

        const prompt = `${SUMMARY_PROMPT(
            JSON.stringify(data, null, 2),
            timeline,
            psychProfile,
            patterns,
        )}

Return a structured summary with citations.`;

        const schema: StructuredOutputSchema = {
            type: 'object',
            properties: {
                executiveSummary: { type: 'string' },
                keyFindings: { type: 'array', items: { type: 'string' } },
                timeline: { type: 'string' },
                riskAssessment: {
                    type: 'object',
                    properties: {
                        level: { type: 'string' },
                        factors: { type: 'array', items: { type: 'string' } },
                    },
                },
                recommendations: { type: 'array', items: { type: 'string' } },
                citations: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            text: { type: 'string' },
                            source: { type: 'string' },
                        },
                        required: ['text', 'source'],
                    },
                },
            },
            required: ['executiveSummary', 'keyFindings', 'recommendations', 'citations'],
        };

        try {
            return await this.openRouter.completeWithSchema<StructuredSummary>(prompt, schema, model);
        } catch (error: any) {
            this.logger.error(`Failed to generate structured summary: ${error.message}`);
            // Fallback to regular summary
            const regularSummary = await this.summarize(data, model, timeline, psychProfile, patterns);
            return {
                executiveSummary: regularSummary,
                keyFindings: [],
                recommendations: [],
                citations: [],
            };
        }
    }
}
