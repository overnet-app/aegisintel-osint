import { Injectable, Logger } from '@nestjs/common';
import { PuppeteerClusterService } from '../scraper/puppeteer-cluster.service';
import { StorageService } from '../storage/storage.service';
import { SearXNGService } from './searxng.service';
import * as cheerio from 'cheerio';

@Injectable()
export class WebSearchService {
    private readonly logger = new Logger(WebSearchService.name);

    constructor(
        private puppeteer: PuppeteerClusterService,
        private storageService: StorageService,
        private searxng: SearXNGService,
    ) { }

    async discoverSocialHandles(query: string): Promise<string[]> {
        this.logger.log(`Discovering social handles for: ${query}`);

        try {
            const searchQuery = `${query} official instagram x twitter linkedin`;
            const results = await this.searxng.search(searchQuery, [], 20);
            
            const links: string[] = [];
            for (const result of results) {
                if (this.isSocialMediaUrl(result.url)) {
                    links.push(result.url);
                }
            }

            const uniqueLinks = [...new Set(links)];
            this.logger.log(`Found ${uniqueLinks.length} potential social links for "${query}"`);
            return uniqueLinks;
        } catch (error: any) {
            this.logger.error(`Social handles discovery failed: ${error.message}`);
            return [];
        }
    }

    // Generic web search to get top content pages about the query
    async searchWebPages(query: string, maxResults: number = 5): Promise<Array<{ title: string; url: string }>> {
        this.logger.log(`Running web search for content pages: ${query}`);
        
        try {
            const results = await this.searxng.search(query, [], maxResults);
            return results.map(r => ({ title: r.title, url: r.url }));
        } catch (error: any) {
            this.logger.error(`Web search for pages failed: ${error.message}`);
            return [];
        }
    }

    async reverseImageSearch(imageUrl: string): Promise<Array<{ title: string; url: string; imageUrl?: string; source?: string }>> {
        this.logger.log(`Performing reverse image search via SearXNG for: ${imageUrl}`);
        return this.searxng.reverseImageSearch(imageUrl, 10);
    }

    /**
     * Comprehensive image analysis using SearXNG
     */
    async analyzeImageWithGoogleImages(imageUrl: string): Promise<{
        labels: Array<{ description: string; score?: number }>;
        textAnnotations: Array<{ description: string }>;
        webEntities: Array<{ description: string }>;
        similarImages: Array<{ url: string; title?: string }>;
        relatedSearches: string[];
        reverseSearchResults: Array<{ title: string; url: string; imageUrl?: string }>;
    }> {
        this.logger.log(`Analyzing image with SearXNG: ${imageUrl}`);

        try {
            // Use SearXNG reverse image search
            const results = await this.searxng.reverseImageSearch(imageUrl, 15);
            
            // Extract labels from titles
            const labels: Array<{ description: string; score?: number }> = [];
            const textAnnotations: Array<{ description: string }> = [];
            const webEntities: Array<{ description: string }> = [];
            const similarImages: Array<{ url: string; title?: string }> = [];
            const relatedSearches: string[] = [];
            const reverseSearchResults: Array<{ title: string; url: string; imageUrl?: string }> = [];

            for (const result of results) {
                if (result.title && result.title.length < 100) {
                    // Use title as label if it's short
                    if (result.title.split(' ').length < 10) {
                        labels.push({ description: result.title, score: 0.8 });
                    } else {
                        textAnnotations.push({ description: result.title });
                    }
                }

                if (result.url) {
                    reverseSearchResults.push({
                        title: result.title || 'Image Result',
                        url: result.url,
                        imageUrl: result.imageUrl,
                    });

                    if (result.imageUrl) {
                        similarImages.push({
                            url: result.imageUrl,
                            title: result.title,
                        });
                    }

                    // Extract domain as web entity
                    try {
                        const domain = new URL(result.url).hostname;
                        if (domain && !webEntities.find(e => e.description === domain)) {
                            webEntities.push({ description: domain });
                        }
                    } catch (e) {
                        // Invalid URL
                    }
                }
            }

            // Remove duplicates
            const uniqueLabels = Array.from(new Map(labels.map(item => [item.description, item])).values());
            const uniqueTexts = Array.from(new Set(textAnnotations.map(t => t.description))).map(d => ({ description: d }));

            this.logger.log(`SearXNG analysis found: ${uniqueLabels.length} labels, ${uniqueTexts.length} text annotations, ${reverseSearchResults.length} results, ${webEntities.length} web entities`);

            return {
                labels: uniqueLabels.slice(0, 20),
                textAnnotations: uniqueTexts.slice(0, 10),
                webEntities: webEntities.slice(0, 10),
                similarImages: similarImages.slice(0, 15),
                relatedSearches: relatedSearches.slice(0, 10),
                reverseSearchResults: reverseSearchResults.slice(0, 15),
            };
        } catch (error: any) {
            this.logger.error(`SearXNG image analysis failed: ${error.message}`);
            return {
                labels: [],
                textAnnotations: [],
                webEntities: [],
                similarImages: [],
                relatedSearches: [],
                reverseSearchResults: [],
            };
        }
    }

    async reverseImageSearchGoogle(imageUrl: string): Promise<Array<{ title: string; url: string; imageUrl?: string; source?: string }>> {
        this.logger.log(`Performing reverse image search via SearXNG (Google) for: ${imageUrl}`);
        return this.searxng.reverseImageSearch(imageUrl, 10);
    }

    async reverseImageSearchDuckDuckGo(imageUrl: string): Promise<Array<{ title: string; url: string; imageUrl?: string; source?: string }>> {
        this.logger.log(`Performing reverse image search via SearXNG (DuckDuckGo) for: ${imageUrl}`);
        return this.searxng.reverseImageSearch(imageUrl, 10);
    }

    /**
     * Google web search - now using SearXNG
     */
    async searchGoogle(query: string, maxResults: number = 10): Promise<Array<{ title: string; url: string; snippet?: string }>> {
        this.logger.log(`Searching via SearXNG (Google) for: ${query} (max ${maxResults} results)`);
        return this.searxng.search(query, [], maxResults);
    }

    /**
     * Yandex web search - now using SearXNG
     */
    async searchYandex(query: string, maxResults: number = 10): Promise<Array<{ title: string; url: string; snippet?: string }>> {
        this.logger.log(`Searching via SearXNG (Yandex) for: ${query} (max ${maxResults} results)`);
        return this.searxng.search(query, [], maxResults);
    }

    /**
     * Search for documents (PDF, XLSX, DOCX) using SearXNG
     */
    async searchDocuments(query: string): Promise<Array<{ title: string; url: string; fileType: string; source: string }>> {
        this.logger.log(`Searching for documents via SearXNG: ${query}`);
        
        try {
            return await this.searxng.searchDocuments(query, 20);
        } catch (error: any) {
            this.logger.error(`SearXNG document search failed: ${error.message}`);
            return [];
        }
    }

    /**
     * Multi-engine search using SearXNG (unified results from multiple engines)
     */
    async multiEngineSearch(query: string): Promise<{
        google: Array<{ title: string; url: string; snippet?: string }>;
        duckduckgo: Array<{ title: string; url: string }>;
        yandex: Array<{ title: string; url: string; snippet?: string }>;
        documents: Array<{ title: string; url: string; fileType: string; source: string }>;
    }> {
        this.logger.log(`Running multi-engine search via SearXNG for: ${query}`);

        try {
            // SearXNG aggregates results from multiple engines, so we use the same results for all
            const [webResults, documents] = await Promise.allSettled([
                this.searxng.search(query, [], 30), // Get more results to distribute
                this.searxng.searchDocuments(query, 10),
            ]);

            const allResults = webResults.status === 'fulfilled' ? webResults.value : [];
            const docResults = documents.status === 'fulfilled' ? documents.value : [];

            // Distribute results across the three "engines" for backward compatibility
            const third = Math.ceil(allResults.length / 3);
            const googleResults = allResults.slice(0, third);
            const duckduckgoResults = allResults.slice(third, third * 2).map(r => ({ title: r.title, url: r.url }));
            const yandexResults = allResults.slice(third * 2);

            return {
                google: googleResults,
                duckduckgo: duckduckgoResults,
                yandex: yandexResults,
                documents: docResults,
            };
        } catch (error: any) {
            this.logger.error(`SearXNG multi-engine search failed: ${error.message}`);
            return {
                google: [],
                duckduckgo: [],
                yandex: [],
                documents: [],
            };
        }
    }

    /**
     * Extract file type from URL
     */
    private extractFileType(url: string): string | null {
        const lowerUrl = url.toLowerCase();
        if (lowerUrl.endsWith('.pdf') || lowerUrl.includes('.pdf?')) return 'pdf';
        if (lowerUrl.endsWith('.xlsx') || lowerUrl.includes('.xlsx?')) return 'xlsx';
        if (lowerUrl.endsWith('.docx') || lowerUrl.includes('.docx?')) return 'docx';
        if (lowerUrl.endsWith('.doc') || lowerUrl.includes('.doc?')) return 'doc';
        return null;
    }

    private isSocialMediaUrl(url: string): boolean {
        const socialDomains = ['instagram.com', 'twitter.com', 'x.com', 'linkedin.com', 'facebook.com', 'github.com'];
        return socialDomains.some(domain => url.toLowerCase().includes(domain));
    }
}
