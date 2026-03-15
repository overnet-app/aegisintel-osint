import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { QUEUE_NAMES } from '../../common/constants/queues';
import { PrismaService } from '../../prisma/prisma.service';
import { WsGateway } from '../../ws/ws.gateway';
import { SearchStatus, DataSource } from '@prisma/client';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { DeepSearchOrchestrator } from '../deep-search.orchestrator';

@Processor(QUEUE_NAMES.DEEP_SEARCH)
export class DeepSearchProcessor extends WorkerHost {
    private readonly logger = new Logger(DeepSearchProcessor.name);

    constructor(
        private prisma: PrismaService,
        private wsGateway: WsGateway,
        private orchestrator: DeepSearchOrchestrator,
    ) {
        super();
    }

    async process(job: Job<any, any, string>): Promise<any> {
        const { sessionId, query, userId, selectedProfile } = job.data;
        this.logger.log(`Processing deep search for session ${sessionId}: ${query}${selectedProfile ? ` (selected: ${selectedProfile.platform}/${selectedProfile.username})` : ''}`);

        try {
            return await this.orchestrator.orchestrate(userId, sessionId, query, selectedProfile);
        } catch (error) {
            this.logger.error(`Error processing deep search ${sessionId}: ${error.message}`);
            // Orchestrator handles status updates on failure
            throw error;
        }
    }

    @OnWorkerEvent('completed')
    onCompleted(job: Job) {
        this.logger.log(`Deep Job ${job.id} completed successfully`);
    }

    @OnWorkerEvent('failed')
    onFailed(job: Job, error: Error) {
        this.logger.error(`Deep Job ${job.id} failed with error: ${error.message}`);
    }
}
