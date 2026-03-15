import { Module, forwardRef } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '../common/constants/queues';
import { PreliminarySearchProcessor } from './processors/preliminary-search.processor';
import { DeepSearchProcessor } from './processors/deep-search.processor';
import { ImageSearchProcessor } from './processors/image-search.processor';
import { ScraperProcessor } from './processors/scraper.processor';
import { DeepSearchOrchestrator } from './deep-search.orchestrator';
import { UsernameCheckerService } from './username-checker.service';
import { WebSearchService } from './web-search.service';
import { SearXNGService } from './searxng.service';
import { ContentScraperService } from './content-scraper.service';
import { TimelineService } from './timeline.service';
import { CorrelationEngine } from './correlation-engine.service';
import { WsModule } from '../ws/ws.module';
import { ElasticsearchModule } from '@nestjs/elasticsearch';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { IntelSearchService } from './elasticsearch.service';
import { StorageModule } from '../storage/storage.module';
import { ResearchModule } from '../research/research.module';
import { ProfileVerificationAgent } from './agents/profile-verification.agent';
import { AccuracyScorerService } from './services/accuracy-scorer.service';
import { McpModule } from '../mcp/mcp.module';
import { ReverseLookupModule } from '../reverse-lookup/reverse-lookup.module';

@Module({
    imports: [
        BullModule.registerQueue(
            { name: QUEUE_NAMES.PRELIMINARY_SEARCH },
            { name: QUEUE_NAMES.DEEP_SEARCH },
            { name: QUEUE_NAMES.SCRAPER },
            { name: QUEUE_NAMES.IMAGE_SEARCH },
        ),
        WsModule,
        StorageModule,
        McpModule,
        forwardRef(() => ResearchModule),
        forwardRef(() => ReverseLookupModule),
        ElasticsearchModule.registerAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => ({
                node: configService.get<string>('ELASTICSEARCH_NODE') || 'http://localhost:9200',
            }),
            inject: [ConfigService],
        }),
    ],
    controllers: [SearchController],
    providers: [
        SearchService,
        DeepSearchOrchestrator,
        UsernameCheckerService,
        WebSearchService,
        SearXNGService,
        ContentScraperService,
        TimelineService,
        CorrelationEngine,
        IntelSearchService,
        PreliminarySearchProcessor,
        DeepSearchProcessor,
        ImageSearchProcessor,
        ScraperProcessor,
        ProfileVerificationAgent,
        AccuracyScorerService,
    ],
    exports: [
        SearchService,
        DeepSearchOrchestrator,
        UsernameCheckerService,
        WebSearchService,
        SearXNGService,
        ContentScraperService,
        TimelineService,
        CorrelationEngine,
        IntelSearchService,
        AccuracyScorerService,
    ],
})
export class SearchModule { }
