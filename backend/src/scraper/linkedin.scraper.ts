import { Injectable, Logger } from '@nestjs/common';
import { PuppeteerClusterService } from './puppeteer-cluster.service';
import { RateLimiterService } from './rate-limiter.service';
import * as cheerio from 'cheerio';

@Injectable()
export class LinkedInScraper {
    private readonly logger = new Logger(LinkedInScraper.name);

    constructor(
        private puppeteer: PuppeteerClusterService,
        private rateLimiter: RateLimiterService,
    ) { }

    async scrapeProfile(username: string) {
        this.logger.log(`Scraping LinkedIn profile: ${username}`);

        // Apply rate limiting: 3 requests per 60 seconds for LinkedIn (very strict)
        await this.rateLimiter.wait('linkedin', 3, 60);

        return this.puppeteer.execute(async (page) => {
            const url = `https://www.linkedin.com/in/${username}/`;

            try {
                // Navigate and wait for content
                await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });

                // Wait for the main profile section or the auth wall redirect
                await page.waitForSelector('.top-card-layout__entity-info', { timeout: 10000 }).catch(() => null);

                // Handle potential "Agree & Join" or other overlays if necessary
                // Usually public profiles have a specific layout

                const html = await page.content();
                const $ = cheerio.load(html);

                // Extraction logic for public LinkedIn profiles
                const fullName = $('.top-card-layout__title').text().trim() ||
                    $('h1.text-heading-xlarge').text().trim();

                const headline = $('.top-card-layout__headline').text().trim() ||
                    $('.text-body-medium').first().text().trim();

                const location = $('.top-card-layout__first-subline .top-card__subline-item').first().text().trim() ||
                    $('.text-body-small.inline.t-black--light').first().text().trim();

                const about = $('.summary.ps-container').text().trim() ||
                    $('.pv-about-section').text().trim();

                // Experience snippet (usually visible on public profiles)
                const experience: any[] = [];
                $('.experience-item').each((_, el) => {
                    const title = $(el).find('.experience-item__title').text().trim();
                    const company = $(el).find('.experience-item__subtitle').text().trim();
                    const duration = $(el).find('.experience-item__duration').text().trim();
                    if (title) experience.push({ title, company, duration });
                });

                return {
                    platform: 'linkedin',
                    username,
                    fullName,
                    headline,
                    location,
                    about,
                    experience,
                    recentPosts: [], // LinkedIn public profiles don't show posts
                    scrapedAt: new Date().toISOString(),
                };
            } catch (error) {
                this.logger.error(`Failed to scrape LinkedIn profile ${username}: ${error.message}`);
                throw error;
            }
        });
    }
}
