import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import * as fs from 'fs';
import * as path from 'path';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
    private readonly logger = new Logger(AllExceptionsFilter.name);

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<FastifyReply>();
        const request = ctx.getRequest<FastifyRequest>();


        const status =
            exception instanceof HttpException
                ? exception.getStatus()
                : HttpStatus.INTERNAL_SERVER_ERROR;

        const message =
            exception instanceof HttpException
                ? exception.getResponse()
                : 'Internal server error';


        const errorResponse = {
            statusCode: status,
            errorCode: (exception as any).code || `ERR_${status}`,
            timestamp: new Date().toISOString(),
            path: request.url,
            method: request.method,
            message: typeof message === 'object' ? (message as any).message : message,
            error: typeof message === 'object' ? (message as any).error : null,
        };

        if (status >= 500) {
            this.logger.error(
                `${request.method} ${request.url} ${status}`,
                exception instanceof Error ? exception.stack : JSON.stringify(exception),
            );
        } else {
            this.logger.warn(`${request.method} ${request.url} ${status}`);
        }

        response.status(status).send(errorResponse);
    }
}
