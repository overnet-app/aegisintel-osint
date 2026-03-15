import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ClarifaiService {
    private readonly logger = new Logger(ClarifaiService.name);
    private readonly defaultApiKey: string;

    constructor(private configService: ConfigService) {
        this.defaultApiKey = this.configService.get<string>('CLARIFAI_API_KEY') || '';
    }

    async predict(imageUrl: string, modelId: string = 'general-image-recognition', userApiKey?: string): Promise<any> {
        const apiKey = userApiKey || this.defaultApiKey;
        this.logger.log(`Predicting with Clarifai model ${modelId} for image: ${imageUrl}`);

        if (!apiKey) {
            this.logger.warn('Clarifai API Key missing, returning empty concepts');
            return { concepts: [] };
        }

        try {
            const response = await fetch(
                `https://api.clarifai.com/v2/models/${modelId}/outputs`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Key ${apiKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        inputs: [
                            {
                                data: {
                                    image: { url: imageUrl },
                                },
                            },
                        ],
                    }),
                }
            );

            const data = await response.json();
            if (data.status?.code !== 10000) {
                this.logger.error(`Clarifai API error: ${JSON.stringify(data.status)}`);
                return { concepts: [] };
            }
            return data.outputs?.[0]?.data || { concepts: [] };
        } catch (error) {
            this.logger.error(`Clarifai prediction failed: ${error.message}`);
            return { concepts: [] };
        }
    }

    async predictFromBase64(base64Content: string, modelId: string = 'general-image-recognition', userApiKey?: string): Promise<any> {
        const apiKey = userApiKey || this.defaultApiKey;
        this.logger.log(`Predicting with Clarifai model ${modelId} from base64`);

        if (!apiKey) {
            this.logger.warn('Clarifai API Key missing, returning empty concepts');
            return { concepts: [] };
        }

        try {
            const response = await fetch(
                `https://api.clarifai.com/v2/models/${modelId}/outputs`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Key ${apiKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        inputs: [
                            {
                                data: {
                                    image: { base64: base64Content },
                                },
                            },
                        ],
                    }),
                }
            );

            const data = await response.json();
            if (data.status?.code !== 10000) {
                this.logger.error(`Clarifai API error: ${JSON.stringify(data.status)}`);
                return { concepts: [] };
            }
            return data.outputs?.[0]?.data || { concepts: [] };
        } catch (error) {
            this.logger.error(`Clarifai prediction failed: ${error.message}`);
            return { concepts: [] };
        }
    }
}
