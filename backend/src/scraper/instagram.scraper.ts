import { Injectable, Logger } from '@nestjs/common';
import { PuppeteerClusterService } from './puppeteer-cluster.service';
import { RateLimiterService } from './rate-limiter.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { AuthCookieService } from './auth-cookie.service';
import * as cheerio from 'cheerio';

@Injectable()
export class InstagramScraper {
    private readonly logger = new Logger(InstagramScraper.name);
    private readonly platform = 'instagram';

    constructor(
        private puppeteer: PuppeteerClusterService,
        private rateLimiter: RateLimiterService,
        private circuitBreaker: CircuitBreakerService,
        private authCookie: AuthCookieService,
    ) { }

    async scrapeProfile(username: string, userId?: string) {
        this.logger.log(`Scraping Instagram profile: ${username}`);

        // Apply rate limiting: 10 requests per 60 seconds for Instagram
        await this.rateLimiter.wait(this.platform, 10, 60);

        // Use circuit breaker to prevent cascading failures
        return this.circuitBreaker.execute(this.platform, async () => {
            return this.puppeteer.execute(async (page) => {
            const url = `https://www.instagram.com/${username}/`;

            try {
                // Inject cookies if userId provided
                if (userId) {
                    const hasCookies = await this.authCookie.injectCookiesIntoPage(page, userId, 'instagram');
                    if (hasCookies) {
                        this.logger.log(`Injected authentication cookies for Instagram`);
                    }
                }

                // Navigate with a generous timeout and networkidle2
                await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });

                // Wait for potential dynamic content
                await new Promise(resolve => setTimeout(resolve, 3000));

                const html = await page.content();
                const $ = cheerio.load(html);

                // Initial selectors for public profiles (these frequently change)
                const bio = $('header section h1').next('div').text() || $('header section div span').first().text();
                const postsCount = $('header section ul li:nth-child(1) span').first().text();
                const followersCount = $('header section ul li:nth-child(2) span').first().attr('title') || $('header section ul li:nth-child(2) span').first().text();
                const followingCount = $('header section ul li:nth-child(3) span').first().text();

                const fullName = $('header section h1').text();

                // Extract recent posts (URLs and Alt text)
                const posts: any[] = [];
                const postLinks: string[] = [];
                $('article div div div div a').each((i, el) => {
                    if (i < 12) { // Get last 12 posts
                        const postUrl = $(el).attr('href');
                        const img = $(el).find('img');
                        if (postUrl) {
                            postLinks.push(`https://www.instagram.com${postUrl}`);
                            posts.push({
                                url: `https://www.instagram.com${postUrl}`,
                                thumbnail: img.attr('src'),
                                caption: img.attr('alt') || '',
                            });
                        }
                    }
                });

                // Visit first 5 post pages to get actual captions and comments
                // Note: Some posts may be private or require login, so we continue on errors
                for (let i = 0; i < Math.min(5, postLinks.length); i++) {
                    try {
                        const response = await page.goto(postLinks[i], { waitUntil: 'networkidle2', timeout: 20000 });
                        if (response && response.status() >= 400) {
                            this.logger.warn(`Instagram post ${postLinks[i]} returned status ${response.status()}, skipping`);
                            continue;
                        }
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        
                        const postHtml = await page.content();
                        const $post = cheerio.load(postHtml);
                        
                        // Extract actual caption - try multiple selectors
                        let caption = $post('meta[property="og:description"]').attr('content') || '';
                        if (!caption) {
                            caption = $post('article div span').filter((_, el) => {
                                const text = $post(el).text();
                                return text.length > 20 && text.length < 500; // Reasonable caption length
                            }).first().text().trim();
                        }
                        
                        // Extract all comments with author and timestamp
                        const comments: Array<{ author: string; text: string; timestamp?: Date }> = [];
                        
                        // Try multiple selectors for comments
                        $post('article ul li, article div[role="button"], ul[role="list"] li').each((_, el) => {
                            const commentEl = $post(el);
                            const author = commentEl.find('a, h3, strong').first().text().trim() || 'Unknown';
                            const commentText = commentEl.find('span').not('a span').text().trim() ||
                                              commentEl.text().trim();
                            
                            // Extract timestamp if available
                            const timeEl = commentEl.find('time');
                            const timestamp = timeEl.length > 0 ? new Date(timeEl.attr('datetime') || timeEl.attr('title') || '') : undefined;
                            
                            if (commentText && commentText.length > 3) {
                                comments.push({
                                    author,
                                    text: commentText,
                                    timestamp: timestamp && !isNaN(timestamp.getTime()) ? timestamp : undefined,
                                });
                            }
                        });
                        
                        // Also extract comments from meta tags (for public posts)
                        const metaComments = $post('meta[property="og:description"]').attr('content');
                        if (metaComments && metaComments.includes('Comments:')) {
                            const commentMatch = metaComments.match(/Comments:\s*([^•]+)/);
                            if (commentMatch) {
                                comments.push({
                                    author: 'Public',
                                    text: commentMatch[1].trim(),
                                });
                            }
                        }
                        
                        if (caption || comments.length > 0) {
                            posts[i] = {
                                ...posts[i],
                                caption: caption || posts[i].caption || '',
                                comments: comments.slice(0, 20), // Limit to 20 comments
                                commentCount: comments.length,
                            };
                            this.logger.debug(`Enhanced Instagram post ${i + 1}: caption length=${caption.length}, comments=${comments.length}`);
                        }
                    } catch (error) {
                        this.logger.warn(`Failed to scrape Instagram post ${postLinks[i]}: ${error.message}`);
                        // Continue with next post - keep existing post data
                    }
                }

                const result = {
                    platform: 'instagram',
                    username,
                    fullName,
                    bio,
                    stats: {
                        posts: postsCount,
                        followers: followersCount,
                        following: followingCount,
                    },
                    recentPosts: posts,
                    scrapedAt: new Date().toISOString(),
                };

                // Extract and store cookies if authenticated
                if (userId) {
                    try {
                        await this.authCookie.extractAndStoreCookies(page, userId, 'instagram');
                    } catch (error) {
                        this.logger.warn(`Failed to extract cookies: ${error.message}`);
                    }
                }

                return result;
            } catch (error) {
                this.logger.error(`Failed to scrape Instagram profile ${username}: ${error.message}`);
                throw error;
            }
            }, undefined, this.platform);
        });
    }
}
