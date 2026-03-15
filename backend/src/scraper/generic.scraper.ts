import { Injectable, Logger } from '@nestjs/common';
import { PuppeteerClusterService } from './puppeteer-cluster.service';
import * as cheerio from 'cheerio';

@Injectable()
export class GenericScraper {
    private readonly logger = new Logger(GenericScraper.name);

    constructor(private puppeteer: PuppeteerClusterService) { }

    async scrape(url: string): Promise<{ title: string; content: string; html: string }> {
        this.logger.log(`Scraping URL: ${url}`);

        return this.puppeteer.execute(async (page) => {
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

            const html = await page.content();
            const $ = cheerio.load(html);

            // Remove scripts and styles
            $('script, style').remove();

            const title = $('title').text().trim();
            const content = $('body').text().replace(/\s+/g, ' ').trim();

            return { title, content, html };
        });
    }
}
