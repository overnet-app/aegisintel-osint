import { Injectable, Logger } from '@nestjs/common';
import { OpenRouterService, AiModel } from '../open-router.service';

@Injectable()
export class GeoAgent {
    private readonly logger = new Logger(GeoAgent.name);

    constructor(private openRouter: OpenRouterService) { }

    async extractLocations(scrapedData: any[], model?: string): Promise<any> {
        this.logger.log('Extracting geographic data from scraped items');

        const locationData: any[] = [];

        scrapedData.forEach(item => {
            if (item.platform === 'instagram' && item.recentPosts) {
                item.recentPosts.forEach((post: any) => {
                    if (post.caption && post.caption.includes('at')) {
                        // Rough check for potential location mentions in captions
                        locationData.push({ text: post.caption, platform: 'instagram' });
                    }
                });
            }
            if (item.platform === 'twitter' && item.location) {
                locationData.push({ text: item.location, type: 'PROFILE_LOCATION', platform: 'twitter' });
            }
            if (item.platform === 'linkedin' && item.location) {
                locationData.push({ text: item.location, type: 'PROFILE_LOCATION', platform: 'linkedin' });
            }
        });

        if (locationData.length === 0) {
            return { locations: [], insights: 'No geographic data found.' };
        }

        const prompt = `
            You are a geolocation expert and OSINT analyst.
            Analyze the following text snippets and profile data to extract specific locations (cities, countries, venues).
            
            1. Identify home and work locations if possible.
            2. Map out a travel history or movement patterns.
            3. Provide coordinates (approximate Lat/Lng) for identified places.
            4. Detect any privacy leaks related to location.
            
            Data:
            ${JSON.stringify(locationData, null, 2)}
            
            Return ONLY a valid JSON object:
            {
                "identifiedLocations": [
                    { "name": "...", "coordinates": { "lat": 0.0, "lng": 0.0 }, "relevance": "...", "confidence": 0.0 }
                ],
                "homeLocation": "...",
                "workLocation": "...",
                "travelPatterns": "...",
                "privacyRisks": ["...", "..."]
            }
        `;

        try {
            const response = await this.openRouter.complete(prompt, model); // Use user's preferred model
            const jsonString = response.replace(/```json|```/g, '').trim();
            const start = jsonString.indexOf('{');
            const end = jsonString.lastIndexOf('}');
            if (start !== -1 && end !== -1) {
                return JSON.parse(jsonString.substring(start, end + 1));
            }
            return JSON.parse(jsonString);
        } catch (error) {
            this.logger.error(`Geolocation analysis failed: ${error.message}`);
            return { locations: [], error: 'Analysis failed' };
        }
    }
}
