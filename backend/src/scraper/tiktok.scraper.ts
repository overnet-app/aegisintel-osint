import { Injectable, Logger } from '@nestjs/common';
import { PuppeteerClusterService } from './puppeteer-cluster.service';
import { RateLimiterService } from './rate-limiter.service';
import * as cheerio from 'cheerio';

@Injectable()
export class TikTokScraper {
    private readonly logger = new Logger(TikTokScraper.name);

    constructor(
        private puppeteer: PuppeteerClusterService,
        private rateLimiter: RateLimiterService,
    ) { }

    async scrapeProfile(username: string) {
        this.logger.log(`Scraping TikTok profile: ${username}`);

        // Apply rate limiting
        await this.rateLimiter.wait('tiktok', 5, 60);

        return this.puppeteer.execute(async (page) => {
            const url = `https://www.tiktok.com/@${username.replace(/^@/, '')}`;

            try {
                await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });

                // TikTok often shows a CAPTCHA or age verification. 
                // We'll wait a bit and hope for the best with our stealth plugins.
                await new Promise(resolve => setTimeout(resolve, 5000));

                const html = await page.content();
                const $ = cheerio.load(html);

                const fullName = $('[data-e2e="user-subtitle"]').text() || $('[data-e2e="user-title"]').text();
                const bio = $('[data-e2e="user-bio"]').text();
                const followingCount = $('[data-e2e="following-count"]').text();
                const followersCount = $('[data-e2e="followers-count"]').text();
                const likesCount = $('[data-e2e="likes-count"]').text();

                const videos: any[] = [];
                $('[data-e2e="user-post-item"]').each((i, el) => {
                    if (i < 10) {
                        const videoUrl = $(el).find('a').attr('href');
                        const img = $(el).find('img');
                        videos.push({
                            url: videoUrl,
                            thumbnail: img.attr('src'),
                            caption: $(el).find('[data-e2e="user-post-item-desc"]').text() || img.attr('alt'),
                        });
                    }
                });

                return {
                    platform: 'tiktok',
                    username,
                    fullName,
                    bio,
                    stats: {
                        following: followingCount,
                        followers: followersCount,
                        likes: likesCount,
                    },
                    recentPosts: videos,
                    scrapedAt: new Date().toISOString(),
                };
            } catch (error) {
                this.logger.error(`Failed to scrape TikTok profile ${username}: ${error.message}`);
                // Return empty structure instead of throwing to keep orchestrator running
                return {
                    platform: 'tiktok',
                    username,
                    error: error.message,
                    scrapedAt: new Date().toISOString(),
                };
            }
        });
    }
}
