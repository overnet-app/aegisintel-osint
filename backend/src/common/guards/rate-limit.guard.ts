import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { FastifyRequest } from 'fastify';

@Injectable()
export class RateLimitGuard implements CanActivate {
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

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<FastifyRequest>();
        
        // Skip rate limiting for health checks and auth endpoints
        const url = request.url || '';
        if (
            url === '/api/health' || 
            url === '/health' ||
            url.startsWith('/api/auth/')  // Exclude all auth endpoints (login, register, refresh)
        ) {
            return true;
        }

        const identifier = this.getIdentifier(request);
        const key = `ratelimit:api:${identifier}`;
        const now = Date.now();
        const windowMs = this.defaultWindow * 1000;

        // Use sliding window log algorithm
        await this.redis.zremrangebyscore(key, 0, now - windowMs);
        const count = await this.redis.zcard(key);

        if (count >= this.defaultLimit) {
            const ttl = await this.redis.ttl(key);
            const response = context.switchToHttp().getResponse();
            response.header('X-RateLimit-Limit', this.defaultLimit.toString());
            response.header('X-RateLimit-Remaining', '0');
            response.header('X-RateLimit-Reset', new Date(now + (ttl * 1000)).toISOString());
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

        const response = context.switchToHttp().getResponse();
        response.header('X-RateLimit-Limit', this.defaultLimit.toString());
        response.header('X-RateLimit-Remaining', (this.defaultLimit - count - 1).toString());
        response.header('X-RateLimit-Reset', new Date(now + windowMs).toISOString());

        return true;
    }

    private getIdentifier(request: FastifyRequest): string {
        // Use user ID if authenticated, otherwise use IP
        const userId = (request as any).user?.id;
        if (userId) {
            return `user:${userId}`;
        }
        const ip = request.ip || request.socket.remoteAddress || 'unknown';
        return `ip:${ip}`;
    }
}
