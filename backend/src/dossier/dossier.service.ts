import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../common/services/cache.service';

@Injectable()
export class DossierService {
    private readonly logger = new Logger(DossierService.name);

    constructor(
        private prisma: PrismaService,
        private cache: CacheService,
    ) { }

    async createFromSession(sessionId: string) {
        this.logger.log(`Generating dossier for session: ${sessionId}`);

        const session = await this.prisma.searchSession.findUnique({
            where: { id: sessionId },
            include: { results: true },
        });

        if (!session) {
            throw new NotFoundException(`Search session ${sessionId} not found`);
        }

        // 1. Consolidate results
        // Find the AI Analysis result (which is stored in searchResult with metadata.isAiAnalysis = true)
        const aiAnalysisResult = session.results.find(r => (r.metadata as any)?.isAiAnalysis === true);
        const rawResults = session.results.filter(r => !(r.metadata as any)?.isAiAnalysis);

        const dossierContent = {
            query: session.query,
            type: session.type,
            summary: (aiAnalysisResult?.data as any)?.summary || 'N/A',
            riskAssessment: (aiAnalysisResult?.data as any)?.riskAssessment || null,
            relationships: (aiAnalysisResult?.data as any)?.relationships || [],
            sources: rawResults.map(r => ({
                source: r.source,
                capturedAt: r.createdAt,
                url: (r.metadata as any)?.targetUrl || 'N/A',
            })),
            rawResults: rawResults.map(r => r.data),
        };

        // 2. Save Dossier
        const dossier = await this.prisma.dossier.create({
            data: {
                userId: session.userId,
                subject: session.query,
                content: dossierContent,
            },
        });

        this.logger.log(`Dossier created with ID: ${dossier.id}`);
        return dossier;
    }

    async getDossier(id: string) {
        const dossier = await this.prisma.dossier.findUnique({
            where: { id },
        });

        if (!dossier) {
            throw new NotFoundException(`Dossier ${id} not found`);
        }

        return dossier;
    }

    async getUserDossiers(userId: string, page: number = 1, limit: number = 20) {
        const skip = (page - 1) * limit;
        const [data, total] = await Promise.all([
            this.prisma.dossier.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.dossier.count({
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

    async getAnalytics(userId: string) {
        const cacheKey = `analytics:${userId}`;
        const cached = await this.cache.get<any>(cacheKey);
        if (cached) {
            return cached;
        }

        // Use aggregation for better performance
        const [totalSearches, recentDossiers] = await Promise.all([
            this.prisma.dossier.count({
                where: { userId },
            }),
            this.prisma.dossier.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                take: 100, // Limit to recent 100 for analytics calculation
                select: {
                    id: true,
                    subject: true,
                    createdAt: true,
                    content: true,
                },
            }),
        ]);

        const riskDistribution = {
            LOW: 0,
            MEDIUM: 0,
            HIGH: 0,
            CRITICAL: 0,
            UNKNOWN: 0,
        };

        const platforms: Record<string, number> = {};

        for (const dossier of recentDossiers) {
            const content = dossier.content as any;
            const riskLevel = content?.riskAssessment?.riskLevel || 'UNKNOWN';

            if (riskDistribution[riskLevel as keyof typeof riskDistribution] !== undefined) {
                riskDistribution[riskLevel as keyof typeof riskDistribution]++;
            } else {
                riskDistribution.UNKNOWN++;
            }

            const sources = content?.sources || [];
            for (const s of sources) {
                platforms[s.source] = (platforms[s.source] || 0) + 1;
            }
        }

        const result = {
            totalSearches,
            riskDistribution,
            topPlatforms: Object.entries(platforms)
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5),
            recentActivity: recentDossiers.slice(0, 5).map(d => ({
                id: d.id,
                subject: d.subject,
                createdAt: d.createdAt,
                riskLevel: (d.content as any)?.riskAssessment?.riskLevel || 'UNKNOWN',
            })),
        };

        // Cache for 5 minutes
        await this.cache.set(cacheKey, result, 300);
        return result;
    }

    async deleteDossier(id: string, userId: string) {
        const dossier = await this.prisma.dossier.findUnique({
            where: { id },
        });

        if (!dossier) {
            throw new NotFoundException(`Dossier ${id} not found`);
        }

        if (dossier.userId !== userId) {
            throw new ForbiddenException('You do not have permission to delete this dossier');
        }

        await this.prisma.dossier.delete({
            where: { id },
        });

        // Invalidate analytics cache
        await this.cache.del(`analytics:${userId}`);

        this.logger.log(`Dossier ${id} deleted by user ${userId}`);
        return { success: true, message: 'Dossier deleted successfully' };
    }
}
