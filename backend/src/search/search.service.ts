import { Injectable, Logger, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '../common/constants/queues';
import { CreateSearchDto } from './dto/create-search.dto';
import { SearchStatus, SearchSession, SearchType } from '@prisma/client';
import { AuditService, AuditAction } from '../common/services/audit.service';
import { ReverseLookupService } from '../reverse-lookup/reverse-lookup.service';
import { LookupType } from '../reverse-lookup/types/lookup.types';

@Injectable()
export class SearchService {
    private readonly logger = new Logger(SearchService.name);

    constructor(
        private prisma: PrismaService,
        @InjectQueue(QUEUE_NAMES.PRELIMINARY_SEARCH) private preliminaryQueue: Queue,
        @InjectQueue(QUEUE_NAMES.DEEP_SEARCH) private deepQueue: Queue,
        @InjectQueue(QUEUE_NAMES.IMAGE_SEARCH) private imageQueue: Queue,
        @InjectQueue(QUEUE_NAMES.SCRAPER) private scraperQueue: Queue,
        private audit: AuditService,
        @Inject(forwardRef(() => ReverseLookupService))
        private reverseLookupService?: ReverseLookupService,
    ) { }

    async startSearch(userId: string, dto: CreateSearchDto): Promise<SearchSession> {
        const searchQuery = dto.query || dto.imageUrl || 'IMAGE_SEARCH';
        this.logger.log(`Starting ${dto.type} search for user ${userId}: ${searchQuery}`);

        // 1. Create session in DB
        const session = await this.prisma.searchSession.create({
            data: {
                userId,
                query: searchQuery, // Use query or imageUrl as fallback
                type: dto.type,
                status: SearchStatus.PENDING,
            },
        });

        // 1b. Audit log
        const auditAction = dto.type === SearchType.DEEP 
            ? AuditAction.DEEP_SEARCH_START 
            : dto.type === SearchType.IMAGE 
            ? AuditAction.SEARCH_START 
            : AuditAction.SEARCH_START;
        
        await this.audit.log(userId, auditAction, {
            sessionId: session.id,
            query: searchQuery,
            imageUrl: dto.imageUrl,
        });

        // 2. Add job to relevant queue
        let queue: Queue;
        if (dto.type === SearchType.IMAGE) {
            queue = this.imageQueue;
        } else if (dto.type === SearchType.DEEP) {
            queue = this.deepQueue;
        } else {
            queue = this.preliminaryQueue;
        }

        await queue.add('search-task', {
            sessionId: session.id,
            userId,
            query: dto.query,
            imageUrl: dto.imageUrl,
            type: dto.type,
            selectedProfile: dto.selectedProfile,
        }, {
            jobId: session.id, // Use session ID as job ID for easier tracking
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 5000,
            },
        });

        return session;
    }

    /**
     * Perform reverse lookup for phone, email, or address found in search results
     */
    async performReverseLookup(
        type: 'phone' | 'email' | 'address',
        query: string,
        userId: string,
        sessionId?: string,
    ) {
        if (!this.reverseLookupService) {
            this.logger.warn('ReverseLookupService not available');
            return null;
        }

        try {
            const lookupType = type === 'phone' ? LookupType.PHONE :
                              type === 'email' ? LookupType.EMAIL :
                              LookupType.ADDRESS;

            return await this.reverseLookupService.lookup(lookupType, query, {
                userId,
                sessionId: sessionId || `lookup-${Date.now()}`,
                includeRelationships: true,
                includeWebActivity: true,
                includeLocationHistory: true,
            });
        } catch (error: any) {
            this.logger.error(`Reverse lookup failed: ${error.message}`);
            return null;
        }
    }

    async getSession(id: string): Promise<SearchSession> {
        const session = await this.prisma.searchSession.findUnique({
            where: { id },
            include: { results: true },
        });

        if (!session) {
            throw new NotFoundException(`Search session with ID ${id} not found`);
        }

        return session;
    }

    async getUserSessions(userId: string, page: number = 1, limit: number = 20) {
        const skip = (page - 1) * limit;
        const [data, total] = await Promise.all([
            this.prisma.searchSession.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.searchSession.count({
                where: { userId },
            }),
        ]);

        return {
            data,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
}
