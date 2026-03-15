import { Injectable, Logger } from '@nestjs/common';
import { OpenRouterService, AiModel } from '../open-router.service';

@Injectable()
export class TemporalAgent {
    private readonly logger = new Logger(TemporalAgent.name);

    constructor(private openRouter: OpenRouterService) { }

    async analyzeTimeline(scrapedData: any[], model?: string): Promise<any> {
        this.logger.log('Analyzing temporal patterns from scraped data');

        const timestamps: any[] = [];

        // Extract timestamps from various platforms
        scrapedData.forEach(item => {
            if (item.platform === 'instagram' && item.recentPosts) {
                item.recentPosts.forEach((post: any) => {
                    if (post.createdAt) timestamps.push({ time: post.createdAt, platform: 'instagram' });
                });
            }
            if (item.platform === 'twitter' && item.recentTweets) {
                item.recentTweets.forEach((tweet: any) => {
                    if (tweet.createdAt) timestamps.push({ time: tweet.createdAt, platform: 'twitter' });
                });
            }
            // Add other platform mappings as needed
        });

        if (timestamps.length === 0) {
            return { timeline: [], insights: 'No temporal data available.' };
        }

        const prompt = `
            You are a temporal analyst specializing in pattern of life analysis.
            Analyze the following timestamps of activity across different platforms for an individual.
            
            1. Identify active hours and peak activity times.
            2. Infer the most likely timezone(s).
            3. Detect any significant gaps or anomalies in activity.
            4. Provide a summary of the weekly routine.
            
            Data:
            ${JSON.stringify(timestamps.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()), null, 2)}
            
            Return ONLY a valid JSON object:
            {
                "inferredTimezones": ["..."],
                "activeHours": { "start": "HH:MM", "end": "HH:MM", "description": "..." },
                "activityPatterns": ["...", "..."],
                "timelineSummary": "..."
            }
        `;

        try {
            const response = await this.openRouter.complete(prompt, model);
            const jsonString = response.replace(/```json|```/g, '').trim();
            const start = jsonString.indexOf('{');
            const end = jsonString.lastIndexOf('}');
            if (start !== -1 && end !== -1) {
                const insights = JSON.parse(jsonString.substring(start, end + 1));
                return {
                    timeline: timestamps.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()),
                    insights
                };
            }
            const insights = JSON.parse(jsonString);

            return {
                timeline: timestamps.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()),
                insights
            };
        } catch (error) {
            this.logger.error(`Temporal analysis failed: ${error.message}`);
            return { timeline: timestamps, insights: { error: 'Analysis failed' } };
        }
    }
}
