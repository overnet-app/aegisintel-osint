import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { FastifyRequest, FastifyReply } from 'fastify';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
    private readonly logger = new Logger(LoggingInterceptor.name);

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const request = context.switchToHttp().getRequest<FastifyRequest>();
        const response = context.switchToHttp().getResponse<FastifyReply>();

        const { method, url } = request;
        const userAgent = request.headers['user-agent'] || '';
        const ip = request.ip;
        const now = Date.now();
        const correlationId = request.id;

        return next.handle().pipe(
            tap(() => {
                const statusCode = response.statusCode;
                const delay = Date.now() - now;

                this.logger.log(
                    `[${correlationId}] ${method} ${url} ${statusCode} - ${delay}ms - ${userAgent} ${ip}`,
                );
            }),
        );
    }
}
