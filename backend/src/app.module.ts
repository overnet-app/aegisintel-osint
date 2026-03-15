import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queue/queue.module';
import { WsModule } from './ws/ws.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { SearchModule } from './search/search.module';
import { AiModule } from './ai/ai.module';
import { ScraperModule } from './scraper/scraper.module';
import { DossierModule } from './dossier/dossier.module';
import { StorageModule } from './storage/storage.module';
import { CommonModule } from './common/common.module';
import { McpModule } from './mcp/mcp.module';
import { ResearchModule } from './research/research.module';
import { ReverseLookupModule } from './reverse-lookup/reverse-lookup.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import * as Joi from 'joi';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test', 'provision')
          .default('development'),
        PORT: Joi.number().default(3000),
        DATABASE_URL: Joi.string().required(),
        REDIS_HOST: Joi.string().required(),
        REDIS_PORT: Joi.number().default(6379),
        JWT_SECRET: Joi.string().required(),
        REFRESH_TOKEN_SECRET: Joi.string().required(),
        OPENROUTER_API_KEY: Joi.string().allow('').optional(),
        FRONTEND_URL: Joi.string().uri().required(),
        MINIO_ENDPOINT: Joi.string().required(),
        MINIO_PORT: Joi.number().default(9000),
        MINIO_ACCESS_KEY: Joi.string().required(),
        MINIO_SECRET_KEY: Joi.string().required(),
        MINIO_BUCKET: Joi.string().default('aegis-intel'),
        LLAMACPP_ENDPOINT: Joi.string().uri().optional(),
        LLAMACPP_MODEL: Joi.string().optional(),
      }),
    }),
    HealthModule,
    PrismaModule,
    QueueModule,
    WsModule,
    UserModule,
    AuthModule,
    SearchModule,
    AiModule,
    ScraperModule,
    DossierModule,
    StorageModule,
    CommonModule,
    McpModule,
    ResearchModule,
    ReverseLookupModule,
    ThrottlerModule.forRoot([{
      name: 'research',
      ttl: 60000,
      limit: 10,
    }]),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule { }
