import { Injectable, NestMiddleware, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
    private readonly redis: Redis;
    private readonly defaultLimit: number;
    private readonly defaultWindow: number;

    constructor(private configService: ConfigService) {
        this.redis = new Redis({
            host: this.configService.get<string>('REDIS_HOST'),
            port: this.configService.get<number>('REDIS_PORT'),
        });
        this.defaultLimit = parseInt(this.configService.get<string>('RATE_LIMIT_REQUESTS') || '100');
        this.defaultWindow = parseInt(this.configService.get<string>('RATE_LIMIT_WINDOW') || '900'); // 15 minutes
    }

    async use(req: Request, res: Response, next: NextFunction) {
        // Skip rate limiting for health checks
        if (req.path === '/api/health' || req.path === '/health') {
            return next();
        }

        const identifier = this.getIdentifier(req);
        const key = `ratelimit:api:${identifier}`;
        const now = Date.now();
        const windowMs = this.defaultWindow * 1000;

        // Use sliding window log algorithm
        await this.redis.zremrangebyscore(key, 0, now - windowMs);
        const count = await this.redis.zcard(key);

        if (count >= this.defaultLimit) {
            const ttl = await this.redis.ttl(key);
            res.setHeader('X-RateLimit-Limit', this.defaultLimit.toString());
            res.setHeader('X-RateLimit-Remaining', '0');
            res.setHeader('X-RateLimit-Reset', new Date(now + (ttl * 1000)).toISOString());
            throw new HttpException(
                {
                    statusCode: HttpStatus.TOO_MANY_REQUESTS,
                    message: 'Too many requests, please try again later',
                    errorCode: 'RATE_LIMIT_EXCEEDED',
                },
                HttpStatus.TOO_MANY_REQUESTS,
            );
        }

        // Add current request to the window
        await this.redis.zadd(key, now, `${now}-${Math.random()}`);
        await this.redis.expire(key, this.defaultWindow);

        res.setHeader('X-RateLimit-Limit', this.defaultLimit.toString());
        res.setHeader('X-RateLimit-Remaining', (this.defaultLimit - count - 1).toString());
        res.setHeader('X-RateLimit-Reset', new Date(now + windowMs).toISOString());

        next();
    }

    private getIdentifier(req: Request): string {
        // Use user ID if authenticated, otherwise use IP
        const userId = (req as any).user?.id;
        if (userId) {
            return `user:${userId}`;
        }
        return `ip:${req.ip || req.socket.remoteAddress || 'unknown'}`;
    }
}
