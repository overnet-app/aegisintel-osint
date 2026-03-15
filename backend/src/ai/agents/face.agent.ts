import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OpenRouterService } from '../open-router.service';
import { ClarifaiService } from '../services/clarifai.service';

@Injectable()
export class FaceAgent {
    private readonly logger = new Logger(FaceAgent.name);

    constructor(
        private prisma: PrismaService,
        private openRouter: OpenRouterService,
        private clarifai: ClarifaiService
    ) { }

    async analyzeFaces(scrapedData: any[], options: { useClarifai: boolean, sessionId?: string } = { useClarifai: true }): Promise<any> {
        this.logger.log(`Analyzing faces in ${scrapedData.length} items. Clarifai enabled: ${options.useClarifai}, Session: ${options.sessionId}`);

        // 1. Extract image URLs - consolidate from all sources
        const imageUrls: string[] = [];
        scrapedData.forEach(item => {
            // Instagram posts
            if (item.recentPosts) {
                item.recentPosts.forEach((p: any) => {
                    if (p.thumbnail || p.url) imageUrls.push(p.thumbnail || p.url);
                });
            }
            // Twitter images
            if (item.recentTweets) {
                item.recentTweets.forEach((t: any) => {
                    if (t.images?.length > 0) imageUrls.push(...t.images);
                });
            }
        });

        const uniqueImages = [...new Set(imageUrls)];
        const faceResults: any[] = [];

        // Identify the most relevant image (usually profile pic or first post)
        for (const url of uniqueImages.slice(0, 10)) {
            try {
                // 2. Detect faces with OpenRouter (use GPT-4o for better face analysis)
                const facePrompt = 'Analyze this image for human faces. For each face detected, provide: age estimate, gender, facial expressions, distinctive features, and any visible text or context. If no faces are detected, say "No faces detected".';
                const visionData = await this.openRouter.analyzeImage(url, facePrompt);

                // Check if we got a rate limit placeholder response
                if (visionData.toLowerCase().includes('rate limit') || visionData.toLowerCase().includes('unavailable')) {
                    this.logger.warn(`Rate limit hit for face analysis. Skipping remaining images.`);
                    break; // Stop processing if rate limited
                }

                if (visionData.toLowerCase().includes('no faces detected')) {
                    continue;
                }

                // 3. Generate embeddings with Clarifai
                let embedding: number[] = [];
                let matches: any[] = [];

                if (options.useClarifai) {
                    const clarifaiData = await this.clarifai.predict(url, 'face-recognition');
                    embedding = clarifaiData.concepts?.map((c: any) => c.value) || [];

                    if (embedding.length > 0) {
                        // Check for existing matches before storing
                        matches = await this.findMatches(embedding);

                        // 4. Store Embedding with sessionId
                        await this.prisma.$executeRaw`
                            INSERT INTO face_embeddings (id, "sessionId", vector, metadata, "createdAt")
                            VALUES (gen_random_uuid(), ${options.sessionId}, ${embedding}::vector, ${JSON.stringify({ url, description: visionData })}::jsonb, NOW())
                        `;
                    }
                }

                faceResults.push({
                    url,
                    analysis: visionData,
                    hasEmbedding: embedding.length > 0,
                    matches: matches.length > 0 ? matches : undefined
                });
            } catch (error) {
                this.logger.error(`Failed to analyze face in ${url}: ${error.message}`);
            }
        }

        return faceResults;
    }

    async findMatches(embedding: number[]): Promise<any[]> {
        // Search for similar faces and return linked search subjects
        return this.prisma.$queryRaw`
            SELECT 
                f.id, 
                f.metadata, 
                1 - (f.vector <=> ${embedding}::vector) as similarity,
                s.query as subject,
                s.id as "sessionId"
            FROM face_embeddings f
            LEFT JOIN search_sessions s ON f."sessionId" = s.id
            WHERE 1 - (f.vector <=> ${embedding}::vector) > 0.85
            ORDER BY similarity DESC
            LIMIT 5;
        `;
    }
}
