import { Controller, Get } from '@nestjs/common';
import { HealthCheckService, HealthCheck, HealthCheckResult, HealthIndicatorResult } from '@nestjs/terminus';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import * as Minio from 'minio';

@ApiTags('Health')
@Controller('health')
export class HealthController {
    private redis: Redis;
    private minio: Minio.Client;

    constructor(
        private health: HealthCheckService,
        private prisma: PrismaService,
        private configService: ConfigService,
    ) {
        this.redis = new Redis({
            host: this.configService.get<string>('REDIS_HOST'),
            port: this.configService.get<number>('REDIS_PORT'),
        });

        this.minio = new Minio.Client({
            endPoint: this.configService.get<string>('MINIO_ENDPOINT')!,
            port: this.configService.get<number>('MINIO_PORT'),
            useSSL: false,
            accessKey: this.configService.get<string>('MINIO_ACCESS_KEY')!,
            secretKey: this.configService.get<string>('MINIO_SECRET_KEY')!,
        });
    }

    @Get()
    @HealthCheck()
    @ApiOperation({ summary: 'Comprehensive health check' })
    async check(): Promise<HealthCheckResult> {
        return this.health.check([
            () => this.dbCheck(),
            () => this.redisCheck(),
            () => this.minioCheck(),
        ]);
    }

    @Get('live')
    @ApiOperation({ summary: 'Liveness probe' })
    liveness() {
        return { status: 'up' };
    }

    @Get('ready')
    @ApiOperation({ summary: 'Readiness probe' })
    async readiness() {
        try {
            await this.prisma.$queryRaw`SELECT 1`;
            await this.redis.ping();
            return { status: 'ready' };
        } catch (error) {
            return { status: 'not ready', error: error.message };
        }
    }

    private async dbCheck(): Promise<HealthIndicatorResult> {
        try {
            await this.prisma.$queryRaw`SELECT 1`;
            return { database: { status: 'up' } } as HealthIndicatorResult;
        } catch (error) {
            throw new Error(`Database check failed: ${error.message}`);
        }
    }

    private async redisCheck(): Promise<HealthIndicatorResult> {
        try {
            const result = await this.redis.ping();
            if (result === 'PONG') {
                return { redis: { status: 'up' } } as HealthIndicatorResult;
            }
            throw new Error('Redis ping failed');
        } catch (error) {
            throw new Error(`Redis check failed: ${error.message}`);
        }
    }

    private async minioCheck(): Promise<HealthIndicatorResult> {
        try {
            const bucket = this.configService.get<string>('MINIO_BUCKET')!;
            await this.minio.bucketExists(bucket);
            return { minio: { status: 'up' } } as HealthIndicatorResult;
        } catch (error) {
            throw new Error(`MinIO check failed: ${error.message}`);
        }
    }
}
