import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../../common/constants/queues';
import { PrismaService } from '../../prisma/prisma.service';
import { WsGateway } from '../../ws/ws.gateway';
import { InstagramScraper } from '../../scraper/instagram.scraper';
import { TwitterScraper } from '../../scraper/twitter.scraper';
import { LinkedInScraper } from '../../scraper/linkedin.scraper';
import { FacebookScraper } from '../../scraper/facebook.scraper';
import { TikTokScraper } from '../../scraper/tiktok.scraper';
import { GenericScraper } from '../../scraper/generic.scraper';
import { DataSource } from '@prisma/client';
import { IntelSearchService } from '../elasticsearch.service';

@Processor(QUEUE_NAMES.SCRAPER)
export class ScraperProcessor extends WorkerHost {
    private readonly logger = new Logger(ScraperProcessor.name);

    constructor(
        private prisma: PrismaService,
        private wsGateway: WsGateway,
        private instagram: InstagramScraper,
        private twitter: TwitterScraper,
        private linkedin: LinkedInScraper,
        private facebook: FacebookScraper,
        private tiktok: TikTokScraper,
        private generic: GenericScraper,
        private elasticsearch: IntelSearchService,
    ) {
        super();
    }

    async process(job: Job<any, any, string>): Promise<any> {
        const { sessionId, platform, target, type } = job.data;
        this.logger.log(`Processing scraper job for session ${sessionId}, platform: ${platform}, target: ${target}`);

        try {
            await this.updateProgress(sessionId, 10, `Initializing ${platform} scraper...`);

            let result: any;
            let source: DataSource;

            switch (platform.toLowerCase()) {
                case 'instagram':
                    result = await this.instagram.scrapeProfile(target);
                    source = DataSource.INSTAGRAM;
                    break;
                case 'twitter':
                case 'x':
                    result = await this.twitter.scrapeProfile(target);
                    source = DataSource.TWITTER;
                    break;
                case 'linkedin':
                    result = await this.linkedin.scrapeProfile(target);
                    source = DataSource.LINKEDIN;
                    break;
                case 'facebook':
                    result = await this.facebook.scrapeProfile(target);
                    source = DataSource.FACEBOOK;
                    break;
                case 'tiktok':
                    result = await this.tiktok.scrapeProfile(target);
                    source = DataSource.TIKTOK;
                    break;
                default:
                    result = await this.generic.scrape(target);
                    source = DataSource.WEB;
            }

            await this.updateProgress(sessionId, 80, `Data gathered from ${platform}. Saving results...`);

            // Store result in database
            const searchResult = await this.prisma.searchResult.create({
                data: {
                    searchSessionId: sessionId,
                    source: source,
                    data: result,
                    metadata: {
                        originalPlatform: platform,
                        targetUrl: target,
                        scrapeType: type || 'PROFILE',
                    },
                },
            });

            await this.updateProgress(sessionId, 100, `Scraping completed for ${platform}.`);

            // Index in Elasticsearch for full-text search
            try {
                const searchableText = [
                    result.fullName,
                    result.bio,
                    result.title,
                    result.content,
                    ...(result.recentPosts?.map((p: any) => p.caption) || []),
                    ...(result.recentTweets?.map((t: any) => t.text) || []),
                ].filter(Boolean).join(' ');

                if (searchableText) {
                    await this.elasticsearch.indexFragment(
                        sessionId,
                        target,
                        platform,
                        type || 'PROFILE',
                        searchableText,
                        { databaseId: searchResult.id }
                    );
                }
            } catch (e) {
                this.logger.error(`Elasticsearch indexing failed: ${e.message}`);
            }

            return searchResult;
        } catch (error) {
            this.logger.error(`Scraping failed for ${platform}: ${error.message}`);
            await this.updateProgress(sessionId, -1, `Error: Failed to scrape ${platform}`);
            throw error;
        }
    }

    private async updateProgress(sessionId: string, progress: number, status: string) {
        this.wsGateway.emitProgress(sessionId, {
            sessionId,
            progress,
            status,
            stage: 'SCRAPING',
        });
    }
}
