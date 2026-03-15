import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TokenCleanupService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(TokenCleanupService.name);
    private cleanupInterval: NodeJS.Timeout;

    constructor(private prisma: PrismaService) { }

    async onModuleInit() {
        // Run cleanup every 24 hours
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpiredTokens();
        }, 24 * 60 * 60 * 1000);

        // Run initial cleanup after 1 minute
        setTimeout(() => {
            this.cleanupExpiredTokens();
        }, 60 * 1000);
    }

    async cleanupExpiredTokens() {
        this.logger.log('Starting cleanup of expired refresh tokens...');
        
        try {
            const result = await this.prisma.refreshToken.deleteMany({
                where: {
                    expiresAt: {
                        lt: new Date(),
                    },
                },
            });

            this.logger.log(`Cleaned up ${result.count} expired refresh tokens`);
        } catch (error) {
            this.logger.error(`Failed to cleanup expired tokens: ${error.message}`);
        }
    }

    onModuleDestroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
    }
}
