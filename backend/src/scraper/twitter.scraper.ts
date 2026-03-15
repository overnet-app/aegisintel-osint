import { Injectable, Logger } from '@nestjs/common';
import { PuppeteerClusterService } from './puppeteer-cluster.service';
import { RateLimiterService } from './rate-limiter.service';
import * as cheerio from 'cheerio';

@Injectable()
export class TwitterScraper {
    private readonly logger = new Logger(TwitterScraper.name);

    constructor(
        private puppeteer: PuppeteerClusterService,
        private rateLimiter: RateLimiterService,
    ) { }

    async scrapeProfile(username: string) {
        this.logger.log(`Scraping X (Twitter) profile: ${username}`);

        // Apply rate limiting: 5 requests per 60 seconds for X (formerly Twitter)
        await this.rateLimiter.wait('twitter', 5, 60);

        return this.puppeteer.execute(async (page) => {
            const url = `https://x.com/${username}`;

            try {
                // Navigate and wait for content
                await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });

                // Wait specifically for the profile header and timeline
                await page.waitForSelector('[data-testid="UserProfileHeader_Items"]', { timeout: 10000 }).catch(() => null);
                await new Promise(resolve => setTimeout(resolve, 3000));

                const html = await page.content();
                const $ = cheerio.load(html);

                // Extraction logic using data-testid attributes which are more stable
                const bio = $('[data-testid="UserDescription"]').text() || '';
                const location = $('[data-testid="UserProfileHeader_Items"] [data-testid="UserLocation"]').text() || '';
                const website = $('[data-testid="UserProfileHeader_Items"] a[role="link"]').first().attr('href') || '';
                const joinDate = $('[data-testid="UserProfileHeader_Items"] [data-testid="UserJoinDate"]').text() || '';

                // Counts
                const followersCount = $(`a[href="/${username}/verified_followers"] span`).first().text() ||
                    $(`a[href="/${username}/followers"] span`).first().text();
                const followingCount = $(`a[href="/${username}/following"] span`).first().text();

                const fullName = $('[data-testid="UserName"] span').first().text();

                // Scroll to load more posts
                await page.evaluate(() => {
                    return new Promise((resolve) => {
                        let totalHeight = 0;
                        const distance = 500;
                        const timer = setInterval(() => {
                            const scrollHeight = document.body.scrollHeight;
                            window.scrollBy(0, distance);
                            totalHeight += distance;
                            if (totalHeight >= scrollHeight * 2 || totalHeight >= 5000) {
                                clearInterval(timer);
                                resolve(null);
                            }
                        }, 200);
                    });
                });
                await new Promise(resolve => setTimeout(resolve, 2000));

                // Re-parse HTML after scrolling
                const updatedHtml = await page.content();
                const $updated = cheerio.load(updatedHtml);

                // Extract posts from the timeline (including pinned posts)
                const posts: any[] = [];
                $updated('[data-testid="tweet"]').each((i, el) => {
                    if (i < 20) { // Get last 20 posts
                        const isPinned = $updated(el).find('[data-testid="pin"]').length > 0;
                        const isRepost = $updated(el).find('[data-testid="socialContext"]').length > 0;
                        const repostAuthor = isRepost ? $updated(el).find('[data-testid="socialContext"]').text() : null;
                        
                        const postText = $updated(el).find('[data-testid="tweetText"]').text().trim();
                        const time = $updated(el).find('time').attr('datetime');
                        const postLink = $updated(el).find('a[href*="/status/"]').first().attr('href');

                        // Engagement metrics
                        const replyCount = $updated(el).find('[data-testid="reply"]').text().trim();
                        const retweetCount = $updated(el).find('[data-testid="retweet"]').text().trim();
                        const likeCount = $updated(el).find('[data-testid="like"]').text().trim();

                        // Media
                        const media: string[] = [];
                        $updated(el).find('[data-testid="tweetPhoto"] img, video').each((_, img) => {
                            const src = $updated(img).attr('src') || $updated(img).attr('poster');
                            if (src) media.push(src);
                        });

                        if (postText || media.length > 0) {
                            posts.push({
                                text: postText,
                                createdAt: time,
                                url: postLink ? `https://x.com${postLink}` : null,
                                media,
                                isPinned,
                                isRepost,
                                repostAuthor,
                                engagement: {
                                    replies: replyCount,
                                    retweets: retweetCount,
                                    likes: likeCount,
                                },
                            });
                        }
                    }
                });

                return {
                    platform: 'x',
                    username,
                    fullName,
                    bio,
                    location,
                    website,
                    joinDate,
                    stats: {
                        followers: followersCount,
                        following: followingCount,
                        postsCount: posts.length,
                    },
                    recentPosts: posts,
                    scrapedAt: new Date().toISOString(),
                };
            } catch (error) {
                this.logger.error(`Failed to scrape X profile ${username}: ${error.message}`);
                throw error;
            }
        });
    }
}
