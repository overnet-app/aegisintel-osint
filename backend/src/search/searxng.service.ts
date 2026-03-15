import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface SearXNGResult {
    url: string;
    title: string;
    content?: string;
    thumbnail?: string;
    engines?: string[];
}

export interface SearXNGResponse {
    query: string;
    number_of_results: number;
    results: SearXNGResult[];
    answers: any[];
    corrections: any[];
    infoboxes: any[];
}

@Injectable()
export class SearXNGService {
    private readonly logger = new Logger(SearXNGService.name);
    private readonly endpoint: string;
    private readonly httpClient: AxiosInstance;

    constructor(private configService: ConfigService) {
        this.endpoint = this.configService.get<string>('SEARXNG_ENDPOINT') || 'http://localhost:8080';
        this.httpClient = axios.create({
            baseURL: this.endpoint,
            timeout: 30000,
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'X-Forwarded-For': '127.0.0.1',
                'X-Real-IP': '127.0.0.1',
            },
        });
        this.logger.log(`SearXNG service initialized with endpoint: ${this.endpoint}`);
    }

    /**
     * General web search
     */
    async search(
        query: string,
        categories: string[] = [],
        maxResults: number = 10,
    ): Promise<Array<{ title: string; url: string; snippet?: string }>> {
        this.logger.log(`SearXNG search: ${query} (max ${maxResults} results)`);

        try {
            const params: any = {
                q: query,
                format: 'json',
                pageno: 1,
            };

            if (categories.length > 0) {
                params.categories = categories.join(',');
            }

            // SearXNG might require the query in the URL path or different endpoint
            let response;
            try {
                response = await this.httpClient.get<SearXNGResponse>('/search', { params });
            } catch (error: any) {
                // If /search returns 403, try root endpoint with query params
                if (error.response?.status === 403) {
                    this.logger.warn('SearXNG /search returned 403, trying root endpoint');
                    try {
                        response = await this.httpClient.get<SearXNGResponse>('/', { params });
                    } catch (retryError: any) {
                        // If both fail, log and return empty results
                        this.logger.error(`SearXNG access denied. Check if SearXNG allows API access. Error: ${error.message}`);
                        throw error; // Throw original error
                    }
                } else {
                    throw error;
                }
            }

            const results = (response.data.results || [])
                .slice(0, maxResults)
                .map((result) => ({
                    title: result.title || '',
                    url: result.url || '',
                    snippet: result.content || undefined,
                }));

            this.logger.log(`SearXNG returned ${results.length} results for "${query}"`);
            return results;
        } catch (error: any) {
            this.logger.error(`SearXNG search failed: ${error.message}`);
            if (error.response) {
                this.logger.error(`SearXNG response status: ${error.response.status}`);
            }
            return [];
        }
    }

    /**
     * Image search
     */
    async searchImages(
        query: string,
        maxResults: number = 10,
    ): Promise<Array<{ title: string; url: string; imageUrl?: string; snippet?: string }>> {
        this.logger.log(`SearXNG image search: ${query} (max ${maxResults} results)`);

        try {
            const params = {
                q: query,
                format: 'json',
                categories: 'images',
                pageno: 1,
            };

            // Try with different endpoint formats if /search fails
            let response;
            try {
                response = await this.httpClient.get<SearXNGResponse>('/search', { params });
            } catch (error: any) {
                // If /search returns 403, try root endpoint
                if (error.response?.status === 403) {
                    this.logger.warn('SearXNG /search returned 403, trying root endpoint');
                    try {
                        response = await this.httpClient.get<SearXNGResponse>('/', { params });
                    } catch (retryError: any) {
                        this.logger.error(`SearXNG access denied. Check if SearXNG allows API access. Error: ${error.message}`);
                        throw error; // Throw original error
                    }
                } else {
                    throw error;
                }
            }

            const results = (response.data.results || [])
                .slice(0, maxResults)
                .map((result) => ({
                    title: result.title || '',
                    url: result.url || '',
                    imageUrl: result.thumbnail || result.url,
                    snippet: result.content || undefined,
                }));

            this.logger.log(`SearXNG returned ${results.length} image results for "${query}"`);
            return results;
        } catch (error: any) {
            this.logger.error(`SearXNG image search failed: ${error.message}`);
            return [];
        }
    }

    /**
     * Document search (PDF, DOCX, XLSX)
     */
    async searchDocuments(
        query: string,
        maxResults: number = 10,
    ): Promise<Array<{ title: string; url: string; fileType: string; source: string }>> {
        this.logger.log(`SearXNG document search: ${query} (max ${maxResults} results)`);

        const documentQuery = `${query} (filetype:pdf OR filetype:xlsx OR filetype:docx)`;

        try {
            const params = {
                q: documentQuery,
                format: 'json',
                pageno: 1,
            };

            // Try with different endpoint formats if /search fails
            let response;
            try {
                response = await this.httpClient.get<SearXNGResponse>('/search', { params });
            } catch (error: any) {
                // If /search returns 403, try root endpoint
                if (error.response?.status === 403) {
                    this.logger.warn('SearXNG /search returned 403, trying root endpoint');
                    try {
                        response = await this.httpClient.get<SearXNGResponse>('/', { params });
                    } catch (retryError: any) {
                        this.logger.error(`SearXNG access denied. Check if SearXNG allows API access. Error: ${error.message}`);
                        throw error; // Throw original error
                    }
                } else {
                    throw error;
                }
            }

            const results: Array<{ title: string; url: string; fileType: string; source: string }> = [];

            for (const result of response.data.results || []) {
                if (results.length >= maxResults) break;

                const fileType = this.extractFileType(result.url);
                if (fileType) {
                    results.push({
                        title: result.title || '',
                        url: result.url || '',
                        fileType,
                        source: 'searxng',
                    });
                }
            }

            this.logger.log(`SearXNG returned ${results.length} document results for "${query}"`);
            return results;
        } catch (error: any) {
            this.logger.error(`SearXNG document search failed: ${error.message}`);
            return [];
        }
    }

    /**
     * Reverse image search using SearXNG
     * Note: SearXNG's reverse image search requires the image_url parameter in the query
     * Format: /search?q=&image_url=<image_url>
     */
    async reverseImageSearch(
        imageUrl: string,
        maxResults: number = 10,
    ): Promise<Array<{ title: string; url: string; imageUrl?: string; source?: string }>> {
        this.logger.log(`SearXNG reverse image search: ${imageUrl} (max ${maxResults} results)`);

        try {
            // SearXNG reverse image search format: q= (empty) & image_url=<url>
            const params: any = {
                q: '', // Empty query for reverse search
                image_url: imageUrl, // The image URL to search for
                format: 'json',
                categories: 'images',
                pageno: 1,
            };

            // Try with different endpoint formats if /search fails
            let response;
            try {
                response = await this.httpClient.get<SearXNGResponse>('/search', { params });
            } catch (error: any) {
                // If /search returns 403, try root endpoint
                if (error.response?.status === 403) {
                    this.logger.warn('SearXNG /search returned 403, trying root endpoint');
                    try {
                        response = await this.httpClient.get<SearXNGResponse>('/', { params });
                    } catch (retryError: any) {
                        this.logger.error(`SearXNG access denied. Check if SearXNG allows API access. Error: ${error.message}`);
                        // Fallback: try text search with image-related terms extracted from URL
                        this.logger.warn('Falling back to text-based image search');
                        return this.fallbackImageSearch(imageUrl, maxResults);
                    }
                } else {
                    // For other errors, try fallback
                    this.logger.warn(`SearXNG reverse image search error: ${error.message}, trying fallback`);
                    return this.fallbackImageSearch(imageUrl, maxResults);
                }
            }

            // Check if we got valid results
            if (!response.data || !response.data.results || response.data.results.length === 0) {
                this.logger.warn('SearXNG returned no results for reverse image search, trying fallback');
                return this.fallbackImageSearch(imageUrl, maxResults);
            }

            const results = (response.data.results || [])
                .slice(0, maxResults)
                .map((result) => ({
                    title: result.title || '',
                    url: result.url || '',
                    imageUrl: result.thumbnail || result.url,
                    source: 'searxng',
                }));

            this.logger.log(`SearXNG returned ${results.length} reverse image results`);
            return results;
        } catch (error: any) {
            this.logger.error(`SearXNG reverse image search failed: ${error.message}`);
            // Try fallback
            return this.fallbackImageSearch(imageUrl, maxResults);
        }
    }

    /**
     * Fallback: Try to extract meaningful terms from image URL and search for them
     * This is a workaround when reverse image search doesn't work
     */
    private async fallbackImageSearch(
        imageUrl: string,
        maxResults: number,
    ): Promise<Array<{ title: string; url: string; imageUrl?: string; source?: string }>> {
        this.logger.log(`Using fallback image search for: ${imageUrl}`);
        
        // Try to extract filename or meaningful parts from URL
        try {
            const urlObj = new URL(imageUrl);
            const pathParts = urlObj.pathname.split('/').filter(p => p && !p.includes('.'));
            const filename = pathParts[pathParts.length - 1] || '';
            
            // Remove common image extensions and query params
            const cleanFilename = filename
                .replace(/\.(jpg|jpeg|png|gif|webp|bmp)$/i, '')
                .replace(/[_-]/g, ' ')
                .trim();
            
            if (cleanFilename && cleanFilename.length > 3) {
                // Search for the filename as a query
                this.logger.log(`Fallback: Searching for "${cleanFilename}"`);
                return this.searchImages(cleanFilename, maxResults);
            }
        } catch (error) {
            // URL parsing failed, skip fallback
        }
        
        // If all else fails, return empty results
        this.logger.warn('Fallback image search could not extract meaningful terms');
        return [];
    }

    /**
     * Extract file type from URL
     */
    private extractFileType(url: string): string | null {
        const lowerUrl = url.toLowerCase();
        if (lowerUrl.includes('.pdf')) return 'pdf';
        if (lowerUrl.includes('.docx') || lowerUrl.includes('.doc')) return 'docx';
        if (lowerUrl.includes('.xlsx') || lowerUrl.includes('.xls')) return 'xlsx';
        return null;
    }

    /**
     * Check if SearXNG is available
     */
    async isAvailable(): Promise<boolean> {
        try {
            const response = await this.httpClient.get('/healthz', { timeout: 5000 });
            return response.status === 200;
        } catch (error) {
            // Try the main page if healthz doesn't exist
            try {
                const response = await this.httpClient.get('/', { timeout: 5000 });
                return response.status === 200;
            } catch {
                return false;
            }
        }
    }
}
