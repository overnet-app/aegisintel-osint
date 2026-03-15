import { Injectable, Logger } from '@nestjs/common';
import { PuppeteerClusterService } from './puppeteer-cluster.service';
import { RateLimiterService } from './rate-limiter.service';
import { AuthCookieService } from './auth-cookie.service';
import * as cheerio from 'cheerio';

@Injectable()
export class FacebookScraper {
    private readonly logger = new Logger(FacebookScraper.name);

    constructor(
        private puppeteer: PuppeteerClusterService,
        private rateLimiter: RateLimiterService,
        private authCookie: AuthCookieService,
    ) { }

    async scrapeProfile(username: string, userId?: string) {
        this.logger.log(`Scraping Facebook profile: ${username}`);

        // Apply rate limiting: 5 requests per 60 seconds
        await this.rateLimiter.wait('facebook', 5, 60);

        return this.puppeteer.execute(async (page) => {
            const url = `https://www.facebook.com/${username}/`;

            try {
                // Inject cookies if userId provided
                if (userId) {
                    const hasCookies = await this.authCookie.injectCookiesIntoPage(page, userId, 'facebook');
                    if (hasCookies) {
                        this.logger.log(`Injected authentication cookies for Facebook`);
                    }
                }

                // Navigate and wait for content
                await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });

                // Wait for potential content to load
                await new Promise(resolve => setTimeout(resolve, 5000));

                const html = await page.content();
                const $ = cheerio.load(html);

                // Extraction logic for public Facebook profiles
                const fullName = $('h1').first().text().trim();
                const bio = $('div[dir="auto"] span').first().text().trim(); // Very generic, FB uses dynamic classes

                // Extract Intro sections
                const intro: string[] = [];
                $('ul li div div div span').each((_, el) => {
                    const text = $(el).text().trim();
                    if (text && text.length > 5) intro.push(text);
                });

                // Extract recent posts with comments
                const posts: any[] = [];
                $('div[role="main"] div[data-ad-preview="message"], div[role="article"]').each((i, el) => {
                    if (i < 10) { // Get last 10 posts
                        const postText = $(el).find('div[dir="auto"]').first().text().trim();
                        const postTime = $(el).find('a[href*="/posts/"] abbr, time').first().attr('title') ||
                                        $(el).find('a[href*="/posts/"] abbr, time').first().text().trim();
                        
                        // Extract comments for this post
                        const comments: Array<{ author: string; text: string; timestamp?: Date }> = [];
                        $(el).find('div[role="article"] ul li, div[data-commentid]').each((_, commentEl) => {
                            const author = $(commentEl).find('strong, a[href*="/user/"]').first().text().trim() || 'Unknown';
                            const commentText = $(commentEl).find('div[dir="auto"]').first().text().trim();
                            const commentTime = $(commentEl).find('abbr, time').first().attr('title');
                            
                            if (commentText && commentText.length > 0) {
                                comments.push({
                                    author,
                                    text: commentText,
                                    timestamp: commentTime ? new Date(commentTime) : undefined,
                                });
                            }
                        });

                        if (postText || comments.length > 0) {
                            posts.push({
                                text: postText,
                                timestamp: postTime ? new Date(postTime) : undefined,
                                comments: comments.slice(0, 20), // Limit to 20 comments per post
                                commentCount: comments.length,
                            });
                        }
                    }
                });

                const result = {
                    platform: 'facebook',
                    username,
                    fullName,
                    bio,
                    intro,
                    recentPosts: posts,
                    scrapedAt: new Date().toISOString(),
                };

                // Extract and store cookies if authenticated
                if (userId) {
                    try {
                        await this.authCookie.extractAndStoreCookies(page, userId, 'facebook');
                    } catch (error) {
                        this.logger.warn(`Failed to extract cookies: ${error.message}`);
                    }
                }

                return result;
            } catch (error) {
                this.logger.error(`Failed to scrape Facebook profile ${username}: ${error.message}`);
                throw error;
            }
        });
    }
}
