import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QUEUE_NAMES } from '../common/constants/queues';
import { BullBoardModule } from '@bull-board/nestjs';
import { FastifyAdapter } from '@bull-board/fastify';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';

@Global()
@Module({
    imports: [
        BullModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: (config: ConfigService) => ({
                connection: {
                    host: config.get('REDIS_HOST'),
                    port: config.get('REDIS_PORT'),
                },
            }),
            inject: [ConfigService],
        }),
        BullModule.registerQueue(
            { name: QUEUE_NAMES.PRELIMINARY_SEARCH },
            { name: QUEUE_NAMES.DEEP_SEARCH },
            { name: QUEUE_NAMES.IMAGE_SEARCH },
            { name: QUEUE_NAMES.SCRAPER },
            { name: QUEUE_NAMES.AI_ANALYSIS },
            { name: QUEUE_NAMES.REPORT_GENERATION },
        ),
        BullBoardModule.forRoot({
            route: '/queues',
            adapter: FastifyAdapter,
        }),
        BullBoardModule.forFeature(
            { name: QUEUE_NAMES.PRELIMINARY_SEARCH, adapter: BullMQAdapter },
            { name: QUEUE_NAMES.DEEP_SEARCH, adapter: BullMQAdapter },
            { name: QUEUE_NAMES.IMAGE_SEARCH, adapter: BullMQAdapter },
            { name: QUEUE_NAMES.SCRAPER, adapter: BullMQAdapter },
            { name: QUEUE_NAMES.AI_ANALYSIS, adapter: BullMQAdapter },
            { name: QUEUE_NAMES.REPORT_GENERATION, adapter: BullMQAdapter },
        ),
    ],
    exports: [BullModule],
})
export class QueueModule { }
