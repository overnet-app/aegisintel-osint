import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class CacheService {
    private readonly logger = new Logger(CacheService.name);
    private readonly redis: Redis;
    private readonly defaultTtl: number;

    constructor(private configService: ConfigService) {
        this.redis = new Redis({
            host: this.configService.get<string>('REDIS_HOST'),
            port: this.configService.get<number>('REDIS_PORT'),
        });
        this.defaultTtl = 300; // 5 minutes default
    }

    async get<T>(key: string): Promise<T | null> {
        try {
            const value = await this.redis.get(key);
            if (value) {
                return JSON.parse(value) as T;
            }
            return null;
        } catch (error) {
            this.logger.error(`Cache get error for key ${key}: ${error.message}`);
            return null;
        }
    }

    async set(key: string, value: any, ttl: number = this.defaultTtl): Promise<void> {
        try {
            await this.redis.setex(key, ttl, JSON.stringify(value));
        } catch (error) {
            this.logger.error(`Cache set error for key ${key}: ${error.message}`);
        }
    }

    async del(key: string): Promise<void> {
        try {
            await this.redis.del(key);
        } catch (error) {
            this.logger.error(`Cache delete error for key ${key}: ${error.message}`);
        }
    }

    async invalidatePattern(pattern: string): Promise<void> {
        try {
            const keys = await this.redis.keys(pattern);
            if (keys.length > 0) {
                await this.redis.del(...keys);
            }
        } catch (error) {
            this.logger.error(`Cache invalidate pattern error for ${pattern}: ${error.message}`);
        }
    }
}
