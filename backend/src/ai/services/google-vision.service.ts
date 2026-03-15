import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleVisionService {
    private readonly logger = new Logger(GoogleVisionService.name);
    private readonly defaultApiKey: string;

    constructor(private configService: ConfigService) {
        this.defaultApiKey = this.configService.get<string>('GOOGLE_VISION_API_KEY') || '';
    }

    async analyzeImage(imageUri: string, userApiKey?: string): Promise<any> {
        const apiKey = userApiKey || this.defaultApiKey;
        this.logger.log(`Analyzing image with Google Vision: ${imageUri}`);

        if (!apiKey) {
            this.logger.warn('Google Vision API Key missing, returning mock data');
            return this.getMockData();
        }

        try {
            const url = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requests: [
                        {
                            image: { source: { imageUri } },
                            features: [
                                { type: 'LABEL_DETECTION', maxResults: 10 },
                                { type: 'LANDMARK_DETECTION' },
                                { type: 'LOGO_DETECTION' },
                                { type: 'TEXT_DETECTION' },
                                { type: 'WEB_DETECTION' },
                                { type: 'FACE_DETECTION' },
                            ],
                        },
                    ],
                }),
            });

            const data = await response.json();
            if (data.error) {
                this.logger.error(`Google Vision API error: ${JSON.stringify(data.error)}`);
                return this.getMockData();
            }
            return data.responses?.[0] || this.getMockData();
        } catch (error) {
            this.logger.error(`Google Vision analysis failed: ${error.message}`);
            return this.getMockData();
        }
    }

    async analyzeImageFromBase64(base64Content: string, userApiKey?: string): Promise<any> {
        const apiKey = userApiKey || this.defaultApiKey;
        this.logger.log(`Analyzing image from base64 with Google Vision`);

        if (!apiKey) {
            this.logger.warn('Google Vision API Key missing, returning mock data');
            return this.getMockData();
        }

        try {
            const url = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requests: [
                        {
                            image: { content: base64Content },
                            features: [
                                { type: 'LABEL_DETECTION', maxResults: 10 },
                                { type: 'LANDMARK_DETECTION' },
                                { type: 'LOGO_DETECTION' },
                                { type: 'TEXT_DETECTION' },
                                { type: 'WEB_DETECTION' },
                                { type: 'FACE_DETECTION' },
                            ],
                        },
                    ],
                }),
            });

            const data = await response.json();
            if (data.error) {
                this.logger.error(`Google Vision API error: ${JSON.stringify(data.error)}`);
                return this.getMockData();
            }
            return data.responses?.[0] || this.getMockData();
        } catch (error) {
            this.logger.error(`Google Vision analysis failed: ${error.message}`);
            return this.getMockData();
        }
    }

    private getMockData() {
        return {
            labelAnnotations: [{ description: 'Mock Label', score: 0.9 }],
            textAnnotations: [{ description: 'Mock OCR Text' }],
            webDetection: { webEntities: [{ description: 'Mock Web Entity' }] },
        };
    }
}
