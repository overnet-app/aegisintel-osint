import { Injectable, Logger } from '@nestjs/common';
import { FaceAgent } from '../ai/agents/face.agent';
import { OpenRouterService, AiModel } from '../ai/open-router.service';
import { extractJson } from '../ai/utils/json-extractor';

@Injectable()
export class CorrelationEngine {
    private readonly logger = new Logger(CorrelationEngine.name);

    constructor(
        private faceAgent: FaceAgent,
        private openRouter: OpenRouterService,
    ) { }

    async correlate(scrapedData: any[], model?: string): Promise<any> {
        this.logger.log(`Correlating data from ${scrapedData.length} sources using model: ${model || 'default'}`);

        // 1. Face Correlation (if embeddings are available)
        // In a real scenario, we'd compare embeddings of all images found

        // 2. Attribution/Writing Style Correlation via LLM
        const prompt = `
            Analyze the following social media data and determine if they belong to the same individual.
            Look for consistent writing styles, shared interests, unique phrases, and matching bio details.
            
            Data:
            ${JSON.stringify(scrapedData, null, 2)}
            
            Provide a confidence score (0-1) and a list of shared identifiers found across platforms.
            Return ONLY a valid JSON object. No conversational text.
        `;

        try {
            const response = await this.openRouter.complete(prompt, model);
            const extracted = extractJson<any>(response);
            
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
            this.logger.error(`Correlation failed: ${error.message}`);
            return { confidenceScore: 0, sharedIdentifiers: [], reasoning: 'Analysis failed' };
        }
    }
}
