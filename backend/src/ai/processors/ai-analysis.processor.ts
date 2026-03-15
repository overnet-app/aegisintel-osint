import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../../common/constants/queues';
import { PrismaService } from '../../prisma/prisma.service';
import { WsGateway } from '../../ws/ws.gateway';
import { SummaryAgent } from '../agents/summary.agent';
import { RiskAgent } from '../agents/risk.agent';
import { EntityAgent } from '../agents/entity.agent';
import { FaceAgent } from '../agents/face.agent';
import { DataSource, SearchStatus } from '@prisma/client';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Processor(QUEUE_NAMES.AI_ANALYSIS)
export class AiAnalysisProcessor extends WorkerHost {
    private readonly logger = new Logger(AiAnalysisProcessor.name);

    constructor(
        private prisma: PrismaService,
        private wsGateway: WsGateway,
        private summaryAgent: SummaryAgent,
        private riskAgent: RiskAgent,
        private entityAgent: EntityAgent,
        private faceAgent: FaceAgent,
        @InjectQueue(QUEUE_NAMES.REPORT_GENERATION) private reportQueue: Queue,
    ) {
        super();
    }

    async process(job: Job<any, any, string>): Promise<any> {
        const { sessionId } = job.data;
        this.logger.log(`Processing AI analysis for session ${sessionId}`);

        try {
            await this.updateProgress(sessionId, 10, 'Aggregating search results...');

            // Fetch session with user to get preferred model
            const session = await this.prisma.searchSession.findUnique({
                where: { id: sessionId },
                include: { user: true },
            });

            if (!session) {
                throw new Error(`Session ${sessionId} not found`);
            }

            const model = session.user.preferredModel;
            const enabledServices = (session.user as any).enabledServices as any;
            const useClarifai = enabledServices?.clarifai !== false;

            // Fetch all search results for this session
            const results = await this.prisma.searchResult.findMany({
                where: { searchSessionId: sessionId },
            });

            if (results.length === 0) {
                this.logger.warn(`No results found for session ${sessionId}. Skipping AI analysis.`);
                return { success: false, message: 'No data to analyze' };
            }

            // Aggregate data for different agents
            const consolidatedData = results.map(r => r.data);

            // 1. Generate Summary
            await this.updateProgress(sessionId, 25, 'Generating executive summary...');
            const summary = await this.summaryAgent.summarize(consolidatedData, model);

            // 2. Assess Risk
            await this.updateProgress(sessionId, 50, 'Performing risk assessment...');
            const risk = await this.riskAgent.assessRisk(consolidatedData, model);

            // 3. Extract Entity Relationships
            await this.updateProgress(sessionId, 75, 'Mapping entity relationships...');
            const relationships = await this.entityAgent.extractRelationships(consolidatedData, model);

            // 4. Analyze Faces
            await this.updateProgress(sessionId, 90, 'Analyzing faces in scraped images...');
            const faces = await this.faceAgent.analyzeFaces(consolidatedData, { useClarifai });

            // Create a final AI analysis result entry
            const analysisResult = await this.prisma.searchResult.create({
                data: {
                    searchSessionId: sessionId,
                    source: DataSource.OTHER,
                    data: {
                        summary,
                        riskAssessment: risk,
                        relationships,
                        faces,
                    },
                    metadata: {
                        isAiAnalysis: true,
                        modelUsed: `${model}, GPT-4o Vision & ${useClarifai ? 'Clarifai' : 'Local'}`,
                    },
                },
            });

            await this.updateProgress(sessionId, 100, 'AI Analysis completed. Generating Dossier...');

            // 4. Trigger Report Generation instead of marking as COMPLETED here
            await this.reportQueue.add('generate-report', { sessionId });

            return analysisResult;
        } catch (error) {
            this.logger.error(`AI Analysis failed for session ${sessionId}: ${error.message}`);

            await this.prisma.searchSession.update({
                where: { id: sessionId },
                data: { status: SearchStatus.FAILED },
            });

            await this.updateProgress(sessionId, -1, `Error: AI Analysis failed: ${error.message}`);
            throw error;
        }
    }

    private async updateProgress(sessionId: string, progress: number, status: string) {
        this.wsGateway.emitProgress(sessionId, {
            sessionId,
            progress,
            status,
            stage: 'AI_ANALYSIS',
        });
    }
}
