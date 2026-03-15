import { Injectable, Logger } from '@nestjs/common';
import { GoogleVisionService } from '../services/google-vision.service';
import { ClarifaiService } from '../services/clarifai.service';
import { OpenRouterService } from '../open-router.service';

export interface UserApiKeys {
    googleVision?: string;
    clarifai?: string;
}

@Injectable()
export class ImageAnalysisAgent {
    private readonly logger = new Logger(ImageAnalysisAgent.name);

    constructor(
        private googleVision: GoogleVisionService,
        private clarifai: ClarifaiService,
        private openRouter?: OpenRouterService,
    ) { }

    async analyzeImages(imageUrls: string[], userApiKeys?: UserApiKeys): Promise<any> {
        this.logger.log(`Analyzing ${imageUrls.length} images across vision providers`);

        const results = await Promise.all(
            imageUrls.map(async (url) => {
                const [google, clarifai] = await Promise.allSettled([
                    this.googleVision.analyzeImage(url, userApiKeys?.googleVision),
                    this.clarifai.predict(url, 'general-image-recognition', userApiKeys?.clarifai),
                ]);

                return {
                    url,
                    googleVision: google.status === 'fulfilled' ? google.value : null,
                    clarifai: clarifai.status === 'fulfilled' ? clarifai.value : null,
                };
            })
        );

        return results;
    }

    async analyzeImageFromBuffer(imageBuffer: Buffer, imageUrl: string, userApiKeys?: UserApiKeys): Promise<any> {
        this.logger.log(`Analyzing image from buffer with vision providers`);

        const base64Content = imageBuffer.toString('base64');

        const [google, clarifai] = await Promise.allSettled([
            this.googleVision.analyzeImageFromBase64(base64Content, userApiKeys?.googleVision),
            this.clarifai.predictFromBase64(base64Content, 'general-image-recognition', userApiKeys?.clarifai),
        ]);

        return {
            url: imageUrl,
            googleVision: google.status === 'fulfilled' ? google.value : null,
            clarifai: clarifai.status === 'fulfilled' ? clarifai.value : null,
        };
    }

    /**
     * Analyze image using GPT-4o vision (premium feature)
     */
    async analyzeImageWithGPT4Vision(
        imageUrl: string,
        prompt: string = 'Analyze this image in detail. Describe what you see, identify any text, objects, people, and provide insights.',
        model: string = 'openai/gpt-4o',
    ): Promise<string> {
        this.logger.log(`Analyzing image with GPT-4o vision: ${imageUrl}`);

        if (!this.openRouter) {
            throw new Error('OpenRouter service not available');
        }

        try {
            return await this.openRouter.analyzeImage(imageUrl, prompt);
        } catch (error: any) {
            this.logger.error(`GPT-4o vision analysis failed: ${error.message}`);
            throw error;
        }
    }
}
