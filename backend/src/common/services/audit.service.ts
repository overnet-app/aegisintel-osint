import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export enum AuditAction {
    LOGIN = 'LOGIN',
    SEARCH_START = 'SEARCH_START',
    DEEP_SEARCH_START = 'DEEP_SEARCH_START',
    DOSSIER_VIEW = 'DOSSIER_VIEW',
    DOSSIER_EXPORT = 'DOSSIER_EXPORT',
    DATA_DELETION = 'DATA_DELETION',
}

@Injectable()
export class AuditService {
    private readonly logger = new Logger(AuditService.name);

    constructor(private prisma: PrismaService) { }

    async log(userId: string, action: AuditAction, details: any = {}, ip?: string) {
        try {
            await this.prisma.auditLog.create({
                data: {
                    userId,
                    action,
                    resource: 'SEARCH', // Default resource for now, can be parameterized
                    details,
                    ipAddress: ip || null,
                },
            });
            this.logger.log(`Audit: ${userId} performed ${action}`);
        } catch (error) {
            this.logger.error(`Failed to create audit log: ${error.message}`);
        }
    }

    async getLogs(userId?: string) {
        return this.prisma.auditLog.findMany({
            where: userId ? { userId } : {},
            orderBy: { createdAt: 'desc' },
            take: 100,
        });
    }
}
