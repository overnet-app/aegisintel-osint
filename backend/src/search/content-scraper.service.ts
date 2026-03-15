import { Injectable, Logger } from '@nestjs/common';
import { PuppeteerClusterService } from '../scraper/puppeteer-cluster.service';
import { OcrService } from '../common/services/ocr.service';
import * as cheerio from 'cheerio';

export interface ContextMention {
    text: string;
    context: {
        before: string;
        after: string;
    };
    url: string;
    timestamp?: Date;
    source: string;
}

export interface CommentData {
    author: string;
    text: string;
    timestamp?: Date;
    url: string;
    parentComment?: string;
}

export interface ScrapedContent {
    url: string;
    title: string;
    fullText: string;
    mentions: ContextMention[];
    comments: CommentData[];
    metadata?: {
        author?: string;
        publishDate?: Date;
        tags?: string[];
    };
}

@Injectable()
export class ContentScraperService {
    private readonly logger = new Logger(ContentScraperService.name);

    constructor(
        private puppeteer: PuppeteerClusterService,
        private ocrService: OcrService,
    ) { }

    /**
     * Scrape content from a URL and extract mentions of the search query
     */
    async scrapeContent(url: string, searchQuery: string): Promise<ScrapedContent | null> {
        this.logger.log(`Scraping content from: ${url} for query: ${searchQuery}`);

        // Validate URL before attempting to scrape
        if (!url || typeof url !== 'string' || url.trim().length === 0) {
            this.logger.error(`Invalid URL provided: ${url}`);
            return null;
        }

        // Ensure URL is properly formatted
        let validUrl: string;
        try {
            const urlObj = new URL(url.trim());
            validUrl = urlObj.href;
        } catch (error) {
            // If URL parsing fails, try to fix common issues
            const trimmedUrl = url.trim();
            if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
                try {
                    validUrl = new URL(`https://${trimmedUrl}`).href;
                } catch (e) {
                    this.logger.error(`Invalid URL format: ${url}`);
                    return null;
                }
            } else {
                this.logger.error(`Invalid URL format: ${url}`);
                return null;
            }
        }

        try {
            return await this.puppeteer.execute(async (page) => {
                try {
                    await page.goto(validUrl, { waitUntil: 'networkidle2', timeout: 30000 });
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    const html = await page.content();
                    const $ = cheerio.load(html);

                    // Extract title
                    const title = $('title').text().trim() || 
                                 $('h1').first().text().trim() ||
                                 $('meta[property="og:title"]').attr('content') ||
                                 'Untitled';

                    // Extract main content (remove scripts, styles, nav, footer)
                    $('script, style, nav, footer, header, aside').remove();
                    const mainContent = $('main, article, .content, .post, .article, body').first();
                    const fullText = mainContent.text().replace(/\s+/g, ' ').trim();

                    // Extract metadata
                    const author = $('meta[name="author"]').attr('content') ||
                                 $('.author, [rel="author"]').first().text().trim() ||
                                 undefined;

                    const publishDateStr = $('meta[property="article:published_time"]').attr('content') ||
                                         $('time[datetime]').first().attr('datetime') ||
                                         $('.date, .published').first().text().trim();
                    const publishDate = publishDateStr ? new Date(publishDateStr) : undefined;

                    const tags: string[] = [];
                    $('meta[property="article:tag"], .tag, .tags a').each((_, el) => {
                        const tag = $(el).text().trim() || $(el).attr('content');
                        if (tag) tags.push(tag);
                    });

                    return {
                        html,
                        title,
                        fullText,
                        author,
                        publishDate,
                        tags,
                    };
                } catch (error) {
                    this.logger.error(`Failed to scrape page: ${error.message}`);
                    return null;
                }
            }).then(async (pageData) => {
                if (!pageData) return null;

                // Extract mentions with context
                const mentions = this.extractMentionsWithContext(
                    pageData.fullText,
                    searchQuery,
                    validUrl,
                    pageData.publishDate,
                );

                // Extract comments
                const comments = this.extractComments(pageData.html, validUrl);

                // If full text extraction failed or is too short, try OCR
                let finalText = pageData.fullText;
                if (pageData.fullText.length < 100) {
                    this.logger.log(`Text too short, attempting OCR for ${validUrl}`);
                    try {
                        const ocrResult = await this.ocrService.extractTextFromUrl(validUrl);
                        if (ocrResult.text && ocrResult.text.length > pageData.fullText.length) {
                            finalText = ocrResult.text;
                            // Re-extract mentions with OCR text
                            const ocrMentions = this.extractMentionsWithContext(
                                ocrResult.text,
                                searchQuery,
                                validUrl,
                                pageData.publishDate,
                            );
                            mentions.push(...ocrMentions);
                        }
                    } catch (error) {
                        this.logger.warn(`OCR failed for ${validUrl}: ${error.message}`);
                    }
                }

                return {
                    url: validUrl,
                    title: pageData.title,
                    fullText: finalText,
                    mentions: this.deduplicateMentions(mentions),
                    comments: comments.filter(c => 
                        c.text.toLowerCase().includes(searchQuery.toLowerCase())
                    ),
                    metadata: {
                        author: pageData.author,
                        publishDate: pageData.publishDate,
                        tags: pageData.tags,
                    },
                };
            });
        } catch (error) {
            this.logger.error(`Content scraping failed for ${url}: ${error.message}`);
            return null;
        }
    }

    /**
     * Extract mentions of the search query with surrounding context
     */
    private extractMentionsWithContext(
        text: string,
        query: string,
        url: string,
        timestamp?: Date,
    ): ContextMention[] {
        const mentions: ContextMention[] = [];
        const queryLower = query.toLowerCase();
        const textLower = text.toLowerCase();
        
        // Find all occurrences (case-insensitive)
        let index = 0;
        while ((index = textLower.indexOf(queryLower, index)) !== -1) {
            // Extract context (100 chars before and after)
            const start = Math.max(0, index - 100);
            const end = Math.min(text.length, index + query.length + 100);
            
            const before = text.substring(start, index).trim();
            const after = text.substring(index + query.length, end).trim();
            const mentionText = text.substring(index, index + query.length);

            mentions.push({
                text: mentionText,
                context: { before, after },
                url,
                timestamp,
                source: 'web',
            });

            index += query.length;
        }

        return mentions;
    }

    /**
     * Extract comments from HTML
     */
    private extractComments(html: string, url: string): CommentData[] {
        const $ = cheerio.load(html);
        const comments: CommentData[] = [];

        // Common comment selectors across different platforms
        const commentSelectors = [
            '.comment',
            '.comments .comment',
            '[data-comment-id]',
            '.disqus-comment',
            '.fb-comment',
            'article.comment',
        ];

        commentSelectors.forEach(selector => {
            $(selector).each((_, el) => {
                const author = $(el).find('.author, .comment-author, [data-author]').first().text().trim() ||
                              $(el).attr('data-author') ||
                              'Anonymous';

                const text = $(el).find('.comment-text, .comment-body, .content, p').first().text().trim() ||
                           $(el).text().trim();

                const timestampStr = $(el).find('time[datetime]').attr('datetime') ||
                                   $(el).find('.timestamp, .date').first().text().trim();
                const timestamp = timestampStr ? new Date(timestampStr) : undefined;

                const parentId = $(el).attr('data-parent-id') ||
                               $(el).closest('.comment').attr('data-comment-id') ||
                               undefined;

                if (text && text.length > 0) {
                    comments.push({
                        author,
                        text,
                        timestamp,
                        url,
                        parentComment: parentId,
                    });
                }
            });
        });

        return comments;
    }

    /**
     * Remove duplicate mentions (same text and context)
     */
    private deduplicateMentions(mentions: ContextMention[]): ContextMention[] {
        const seen = new Set<string>();
        return mentions.filter(mention => {
            const key = `${mention.text}-${mention.context.before.slice(-20)}-${mention.context.after.slice(0, 20)}`;
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    /**
     * Scrape multiple URLs in parallel (with rate limiting)
     */
    async scrapeMultiple(urls: string[], searchQuery: string, maxConcurrent: number = 3): Promise<ScrapedContent[]> {
        this.logger.log(`Scraping ${urls.length} URLs for query: ${searchQuery}`);

        const results: ScrapedContent[] = [];
        
        // Process in batches to avoid overwhelming the system
        for (let i = 0; i < urls.length; i += maxConcurrent) {
            const batch = urls.slice(i, i + maxConcurrent);
            const batchResults = await Promise.allSettled(
                batch.map(url => this.scrapeContent(url, searchQuery))
            );

            for (const result of batchResults) {
                if (result.status === 'fulfilled' && result.value) {
                    results.push(result.value);
                }
            }

            // Small delay between batches
            if (i + maxConcurrent < urls.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        this.logger.log(`Successfully scraped ${results.length} out of ${urls.length} URLs`);
        return results;
    }
}
