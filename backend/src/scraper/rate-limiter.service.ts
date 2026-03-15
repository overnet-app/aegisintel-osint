import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RateLimiterService {
    private readonly logger = new Logger(RateLimiterService.name);
    private readonly redis: Redis;

    constructor(private configService: ConfigService) {
        this.redis = new Redis({
            host: this.configService.get<string>('REDIS_HOST'),
            port: this.configService.get<number>('REDIS_PORT'),
        });
    }

    async throttle(platform: string, limit: number, windowSeconds: number): Promise<boolean> {
        const key = `ratelimit:scraper:${platform}`;
        const now = Date.now();
        const windowMs = windowSeconds * 1000;

        // Use sliding window log algorithm
        await this.redis.zremrangebyscore(key, 0, now - windowMs);
        const count = await this.redis.zcard(key);

        if (count >= limit) {
            this.logger.warn(`Rate limit exceeded for platform ${platform}`);
            return false;
        }

        // Add current request to the window
        await this.redis.zadd(key, now, `${now}-${Math.random()}`);
        await this.redis.expire(key, windowSeconds);

        return true;
    }

    async wait(platform: string, limit: number, windowSeconds: number): Promise<void> {
        while (!(await this.throttle(platform, limit, windowSeconds))) {
            const key = `ratelimit:scraper:${platform}`;
            const oldest = await this.redis.zrange(key, 0, 0, 'WITHSCORES');
            if (oldest.length > 0) {
                const oldestTime = parseInt(oldest[1]);
                const waitTime = Math.max(1000, oldestTime + (windowSeconds * 1000) - Date.now());
                this.logger.debug(`Waiting ${waitTime}ms for ${platform} rate limit reset`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            } else {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }
}
