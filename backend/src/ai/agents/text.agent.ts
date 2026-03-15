import { Injectable, Logger } from '@nestjs/common';
import { OpenRouterService, AiModel } from '../open-router.service';

@Injectable()
export class TextAnalysisAgent {
    private readonly logger = new Logger(TextAnalysisAgent.name);

    constructor(private openRouter: OpenRouterService) { }

    async analyzeText(texts: string[], model?: string): Promise<any> {
        this.logger.log(`Performing deep NLP analysis on ${texts.length} text snippets using model: ${model || 'default'}`);

        if (texts.length === 0) return { sentiment: 'NEUTRAL', topics: [], insights: [] };

        const prompt = `
            You are a senior OSINT analyst and NLP expert.
            Analyze the following text snippets gathered from an individual's online presence.
            
            Perform:
            1. Sentiment Analysis (Overall tone: Aggressive, Professional, Casual, etc.)
            2. Topic Extraction (Key themes of interest)
            3. Writing Style Fingerprinting (Unique patterns, frequent jargon)
            4. Language Detection
            5. Content Risks (Extremism, harassment, PII leaks)
            
            Texts:
            ${JSON.stringify(texts, null, 2)}
            
            Return ONLY a valid JSON object. No conversational text.
        `;

        try {
            const response = await this.openRouter.complete(prompt, model);
            const jsonString = response.replace(/```json|```/g, '').trim();
            const start = jsonString.indexOf('{');
            const end = jsonString.lastIndexOf('}');
            if (start !== -1 && end !== -1) {
                return JSON.parse(jsonString.substring(start, end + 1));
            }
            return JSON.parse(jsonString);
        } catch (error) {
            this.logger.error(`Text analysis failed: ${error.message}`);
            return { error: 'Analysis failed' };
        }
    }
}
