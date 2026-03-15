import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ElasticsearchService as NestElasticsearchService } from '@nestjs/elasticsearch';

@Injectable()
export class IntelSearchService implements OnModuleInit {
    private readonly logger = new Logger(IntelSearchService.name);
    private readonly indexName = 'intel-fragments';

    constructor(
        private configService: ConfigService,
        private nestElasticService: NestElasticsearchService,
    ) { }

    async onModuleInit() {
        await this.createIndexIfNotExists();
    }

    private async createIndexIfNotExists() {
        try {
            const client = this.nestElasticService as any;
            const exists = await client.indices.exists({ index: this.indexName });
            if (!exists) {
                this.logger.log(`Creating Elasticsearch index: ${this.indexName}`);
                await client.indices.create({
                    index: this.indexName,
                    mappings: {
                        properties: {
                            sessionId: { type: 'keyword' },
                            source: { type: 'keyword' },
                            platform: { type: 'keyword' },
                            type: { type: 'keyword' },
                            content: { type: 'text' },
                            metadata: { type: 'object' },
                            createdAt: { type: 'date' },
                        },
                    },
                });
            }
        } catch (error) {
            this.logger.error(`Failed to initialize Elasticsearch index: ${error.message}`);
        }
    }

    async indexFragment(sessionId: string, source: string, platform: string, type: string, content: string, metadata: any = {}) {
        try {
            await (this.nestElasticService as any).index({
                index: this.indexName,
                document: {
                    sessionId,
                    source,
                    platform,
                    type,
                    content,
                    metadata,
                    createdAt: new Date(),
                },
            });
        } catch (error) {
            this.logger.error(`Failed to index fragment: ${error.message}`);
        }
    }

    async searchFragments(query: string, limit = 10) {
        try {
            const response = await (this.nestElasticService as any).search({
                index: this.indexName,
                query: {
                    multi_match: {
                        query,
                        fields: ['content', 'platform', 'type^2'],
                    },
                },
                size: limit,
            });
            return response.hits.hits.map((hit: any) => hit._source);
        } catch (error) {
            this.logger.error(`Search failed: ${error.message}`);
            return [];
        }
    }
}
