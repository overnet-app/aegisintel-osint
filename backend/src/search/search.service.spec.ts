import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from './search.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/services/audit.service';
import { Queue } from 'bullmq';
import { SearchStatus, SearchType } from '@prisma/client';

describe('SearchService', () => {
    let service: SearchService;
    let prismaService: PrismaService;
    let auditService: AuditService;
    let preliminaryQueue: Queue;
    let deepQueue: Queue;

    const mockSession = {
        id: 'session-1',
        userId: 'user-1',
        query: 'test query',
        type: SearchType.PRELIMINARY,
        status: SearchStatus.PENDING,
        progress: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                SearchService,
                {
                    provide: PrismaService,
                    useValue: {
                        searchSession: {
                            create: jest.fn(),
                            findUnique: jest.fn(),
                            findMany: jest.fn(),
                            count: jest.fn(),
                        },
                    },
                },
                {
                    provide: AuditService,
                    useValue: {
                        log: jest.fn(),
                    },
                },
                {
                    provide: 'BullQueue:preliminary-search',
                    useValue: {
                        add: jest.fn(),
                    },
                },
                {
                    provide: 'BullQueue:deep-search',
                    useValue: {
                        add: jest.fn(),
                    },
                },
                {
                    provide: 'BullQueue:scraper',
                    useValue: {
                        add: jest.fn(),
                    },
                },
            ],
        }).compile();

        service = module.get<SearchService>(SearchService);
        prismaService = module.get<PrismaService>(PrismaService);
        auditService = module.get<AuditService>(AuditService);
        preliminaryQueue = module.get<Queue>('BullQueue:preliminary-search');
        deepQueue = module.get<Queue>('BullQueue:deep-search');
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('startSearch', () => {
        it('should create a search session and add job to queue', async () => {
            jest.spyOn(prismaService.searchSession, 'create').mockResolvedValue(mockSession as any);
            jest.spyOn(preliminaryQueue, 'add').mockResolvedValue({} as any);
            jest.spyOn(auditService, 'log').mockResolvedValue(undefined);

            const result = await service.startSearch('user-1', {
                query: 'test query',
                type: SearchType.PRELIMINARY,
            });

            expect(prismaService.searchSession.create).toHaveBeenCalled();
            expect(preliminaryQueue.add).toHaveBeenCalled();
            expect(auditService.log).toHaveBeenCalled();
            expect(result).toEqual(mockSession);
        });
    });

    describe('getSession', () => {
        it('should return a search session by id', async () => {
            jest.spyOn(prismaService.searchSession, 'findUnique').mockResolvedValue(mockSession as any);

            const result = await service.getSession('session-1');

            expect(result).toEqual(mockSession);
            expect(prismaService.searchSession.findUnique).toHaveBeenCalledWith({
                where: { id: 'session-1' },
                include: { results: true },
            });
        });
    });
});
