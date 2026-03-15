import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { QUEUE_NAMES } from '../../common/constants/queues';
import { PrismaService } from '../../prisma/prisma.service';
import { WsGateway } from '../../ws/ws.gateway';
import { SearchStatus, DataSource } from '@prisma/client';
import { ExifService, ExifMetadata } from '../../common/services/exif.service';
import { ImageAnalysisAgent, UserApiKeys } from '../../ai/agents/image.agent';
import { FaceAgent } from '../../ai/agents/face.agent';
import { WebSearchService } from '../web-search.service';
import { StorageService } from '../../storage/storage.service';
import { SummaryAgent } from '../../ai/agents/summary.agent';
import { RiskAgent } from '../../ai/agents/risk.agent';
import { ReverseLookupService } from '../../reverse-lookup/reverse-lookup.service';
import { LookupType } from '../../reverse-lookup/types/lookup.types';
import { Inject, forwardRef } from '@nestjs/common';

@Processor(QUEUE_NAMES.IMAGE_SEARCH)
export class ImageSearchProcessor extends WorkerHost {
    private readonly logger = new Logger(ImageSearchProcessor.name);

    constructor(
        private prisma: PrismaService,
        private wsGateway: WsGateway,
        private exifService: ExifService,
        private imageAnalysisAgent: ImageAnalysisAgent,
        private faceAgent: FaceAgent,
        private webSearch: WebSearchService,
        private storageService: StorageService,
        private summaryAgent: SummaryAgent,
        private riskAgent: RiskAgent,
        @Inject(forwardRef(() => ReverseLookupService))
        private reverseLookupService?: ReverseLookupService,
    ) {
        super();
    }

    async process(job: Job<any, any, string>): Promise<any> {
        const { sessionId, imageUrl, userId } = job.data;
        this.logger.log(`Processing image search for session ${sessionId}: ${imageUrl}`);

        try {
            // 1. Update status to RUNNING
            await this.prisma.searchSession.update({
                where: { id: sessionId },
                data: { status: SearchStatus.RUNNING, progress: 10 },
            });
            this.wsGateway.emitProgress(sessionId, { status: SearchStatus.RUNNING, progress: 10, step: 'Starting image analysis' });

            // Fetch user's API keys from database
            const user = await this.prisma.user.findUnique({ where: { id: userId } });
            const thirdPartyKeys = (user?.thirdPartyKeys as any) || {};
            const userApiKeys: UserApiKeys = {
                googleVision: thirdPartyKeys.googleVision || thirdPartyKeys.google_vision,
                clarifai: thirdPartyKeys.clarifai,
            };
            this.logger.log(`User API keys loaded - Google Vision: ${userApiKeys.googleVision ? 'present' : 'missing'}, Clarifai: ${userApiKeys.clarifai ? 'present' : 'missing'}`);

            // 2. Extract filename from imageUrl (signed URL contains the actual filename)
            // Extract from path like: images/user123/timestamp-uuid.jpg
            const urlParts = imageUrl.split('/');
            const fileName = urlParts.slice(urlParts.indexOf('images')).join('/').split('?')[0]; // Remove query params

            // 3. Download image buffer for EXIF extraction
            this.wsGateway.emitProgress(sessionId, { progress: 20, step: 'Extracting EXIF metadata' });
            let imageBuffer: Buffer | undefined;
            let exifMetadata: ExifMetadata | null = null;

            try {
                imageBuffer = await this.storageService.getFileBuffer(fileName);
                if (imageBuffer) {
                    exifMetadata = await this.exifService.extractMetadata(imageBuffer);
                }
            } catch (error) {
                this.logger.warn(`Failed to extract EXIF metadata: ${error.message}`);
            }

            // Store EXIF results
            if (exifMetadata) {
                await this.prisma.searchResult.create({
                    data: {
                        searchSessionId: sessionId,
                        source: DataSource.IMAGE_SEARCH,
                        data: {
                            type: 'EXIF_METADATA',
                            ...exifMetadata,
                        },
                        metadata: {
                            extractionMethod: 'exif-parser',
                        },
                    },
                });
            }

            // 4. Run image analysis using Google Images (replaces Google Vision API)
            this.wsGateway.emitProgress(sessionId, { progress: 40, step: 'Analyzing image with Google Images' });
            
            const googleImagesAnalysis = await this.webSearch.analyzeImageWithGoogleImages(imageUrl);

            // Format results to match expected structure (for compatibility with existing code)
            const imageAnalysisResult = {
                url: imageUrl,
                googleImages: googleImagesAnalysis,
                // Format labels for compatibility
                labelAnnotations: googleImagesAnalysis.labels.map(l => ({
                    description: l.description,
                    score: l.score || 0.8,
                })),
                // Format text annotations
                textAnnotations: googleImagesAnalysis.textAnnotations.map(t => ({
                    description: t.description,
                })),
                // Format web detection
                webDetection: {
                    webEntities: googleImagesAnalysis.webEntities.map(e => ({
                        description: e.description,
                    })),
                },
            };

            // Store image analysis results
            await this.prisma.searchResult.create({
                data: {
                    searchSessionId: sessionId,
                    source: DataSource.IMAGE_SEARCH,
                    data: {
                        type: 'IMAGE_ANALYSIS',
                        ...imageAnalysisResult,
                    },
                    images: [imageUrl],
                    metadata: {
                        analysisProviders: ['google-images', 'clarifai'],
                    },
                },
            });

            // 5. Check for faces and run face recognition
            this.wsGateway.emitProgress(sessionId, { progress: 60, step: 'Detecting faces' });
            const faceResults = await this.faceAgent.analyzeFaces(
                [{ recentPosts: [{ thumbnail: imageUrl }] }],
                { useClarifai: true, sessionId }
            );

            if (faceResults && faceResults.length > 0) {
                await this.prisma.searchResult.create({
                    data: {
                        searchSessionId: sessionId,
                        source: DataSource.IMAGE_SEARCH,
                        data: {
                            type: 'FACE_ANALYSIS',
                            faces: faceResults,
                        },
                        images: [imageUrl],
                        metadata: {
                            faceCount: faceResults.length,
                        },
                    },
                });

                // 5b. Perform reverse lookup for person identification
                if (this.reverseLookupService) {
                    try {
                        this.wsGateway.emitProgress(sessionId, { progress: 70, step: 'Identifying persons via reverse lookup' });
                        const reverseLookupResult = await this.reverseLookupService.lookup(
                            LookupType.IMAGE,
                            imageUrl,
                            {
                                userId,
                                sessionId,
                                includeRelationships: true,
                                includeWebActivity: true,
                            },
                        );

                        if (reverseLookupResult && 'identifiedPersons' in reverseLookupResult && reverseLookupResult.identifiedPersons) {
                            await this.prisma.searchResult.create({
                                data: {
                                    searchSessionId: sessionId,
                                    source: DataSource.IMAGE_SEARCH,
                                    data: {
                                        type: 'PERSON_IDENTIFICATION',
                                        identifiedPersons: reverseLookupResult.identifiedPersons,
                                        relationships: reverseLookupResult.relationships || [],
                                        socialProfiles: reverseLookupResult.socialProfiles || [],
                                        confidence: reverseLookupResult.confidence,
                                    } as any,
                                    images: [imageUrl],
                                    metadata: {
                                        identificationMethod: 'reverse_lookup',
                                        personCount: reverseLookupResult.identifiedPersons.length,
                                    },
                                },
                            });
                            this.logger.log(`Identified ${reverseLookupResult.identifiedPersons.length} person(s) via reverse lookup`);
                        }
                    } catch (error: any) {
                        this.logger.warn(`Reverse lookup for person identification failed: ${error.message}`);
                    }
                }
            }

            // 6. Reverse image search results are already included in Google Images analysis
            // But we can also do a separate DuckDuckGo search for additional results
            this.wsGateway.emitProgress(sessionId, { progress: 80, step: 'Performing additional reverse image search' });
            const additionalReverseResults = await this.webSearch.reverseImageSearchDuckDuckGo(imageUrl);

            // Store reverse search results from Google Images analysis
            if (googleImagesAnalysis.reverseSearchResults && googleImagesAnalysis.reverseSearchResults.length > 0) {
                for (const result of googleImagesAnalysis.reverseSearchResults) {
                    await this.prisma.searchResult.create({
                        data: {
                            searchSessionId: sessionId,
                            source: DataSource.WEB,
                            data: {
                                type: 'REVERSE_IMAGE_MATCH',
                                title: result.title,
                                url: result.url,
                                imageUrl: result.imageUrl,
                                source: 'google-images',
                            },
                            metadata: {
                                searchType: 'reverse_image',
                                originalImage: imageUrl,
                            },
                        },
                    });
                }
            }

            // Store additional DuckDuckGo results
            if (additionalReverseResults && additionalReverseResults.length > 0) {
                for (const result of additionalReverseResults) {
                    await this.prisma.searchResult.create({
                        data: {
                            searchSessionId: sessionId,
                            source: DataSource.WEB,
                            data: {
                                type: 'REVERSE_IMAGE_MATCH',
                                title: result.title,
                                url: result.url,
                                imageUrl: result.imageUrl,
                                source: result.source || 'duckduckgo',
                            },
                            metadata: {
                                searchType: 'reverse_image',
                                originalImage: imageUrl,
                            },
                        },
                    });
                }
            }

            const allReverseSearchResults = [
                ...(googleImagesAnalysis.reverseSearchResults || []),
                ...(additionalReverseResults || []),
            ];

            // 7. Generate dossier with all collected data
            this.wsGateway.emitProgress(sessionId, { progress: 90, step: 'Generating dossier' });
            
            // Collect all results for dossier generation
            const allResults = await this.prisma.searchResult.findMany({
                where: { searchSessionId: sessionId },
            });

            const dossierData = {
                imageUrl,
                exifMetadata,
                imageAnalysis: imageAnalysisResult,
                googleImagesAnalysis: googleImagesAnalysis,
                faceAnalysis: faceResults || [],
                reverseSearchResults: allReverseSearchResults,
            };

            // Get user's preferred model (user already fetched earlier)
            const preferredModel = user?.preferredModel || 'google/gemma-3-4b-it:free';

            // Generate summary and risk assessment
            const summary = await this.summaryAgent.summarize(dossierData, preferredModel);
            const riskAssessment = await this.riskAgent.assessRisk(dossierData, preferredModel);

            // Create dossier
            const dossier = await this.prisma.dossier.create({
                data: {
                    userId,
                    subject: `Image Analysis - ${new Date().toISOString()}`,
                    content: {
                        summary,
                        riskAssessment,
                        imageAnalysis: dossierData,
                        results: allResults.map(r => ({
                            id: r.id,
                            source: r.source,
                            data: r.data,
                        })),
                    } as any,
                },
            });

            // 8. Mark as COMPLETED
            await this.prisma.searchSession.update({
                where: { id: sessionId },
                data: { status: SearchStatus.COMPLETED, progress: 100 },
            });
            this.wsGateway.emitProgress(sessionId, { status: SearchStatus.COMPLETED, progress: 100, step: 'Analysis complete' });

            return { success: true, sessionId, dossierId: dossier.id };
        } catch (error) {
            this.logger.error(`Error processing image search ${sessionId}: ${error.message}`);
            await this.prisma.searchSession.update({
                where: { id: sessionId },
                data: { status: SearchStatus.FAILED, progress: 0 },
            });
            this.wsGateway.emitProgress(sessionId, { status: SearchStatus.FAILED, error: error.message });
            throw error;
        }
    }

    @OnWorkerEvent('completed')
    onCompleted(job: Job) {
        this.logger.log(`Image search job ${job.id} completed`);
    }

    @OnWorkerEvent('failed')
    onFailed(job: Job, error: Error) {
        this.logger.error(`Image search job ${job.id} failed: ${error.message}`);
    }
}
