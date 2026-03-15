import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ResearchTool, ToolResult } from './base.tool';

@Injectable()
export class WikipediaTool implements ResearchTool {
  readonly name = 'wikipedia';
  readonly description = 'Search and retrieve information from Wikipedia. Returns article summaries and structured data.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'Search query or article title',
      },
      action: {
        type: 'string',
        enum: ['search', 'get'],
        description: 'Action: search for articles or get specific article',
        default: 'search',
      },
    },
    required: ['query'],
  };

  private readonly logger = new Logger(WikipediaTool.name);
  private readonly apiUrl: string;
  private readonly wikiBaseUrl: string;

  constructor(private configService: ConfigService) {
    // Use configurable Wikipedia URL or default to English Wikipedia
    this.wikiBaseUrl = this.configService.get<string>('WIKIPEDIA_BASE_URL') || 'wikipedia.org';
    this.apiUrl = `https://${this.wikiBaseUrl}/api/rest_v1`;
  }

  async execute(args: { query: string; action?: string }): Promise<ToolResult> {
    this.logger.log(`Wikipedia tool: ${args.action || 'search'} - ${args.query}`);

    try {
      if (args.action === 'get') {
        return await this.getArticle(args.query);
      } else {
        return await this.searchArticles(args.query);
      }
    } catch (error) {
      this.logger.error(`Wikipedia tool error: ${error.message}`);
      return {
        content: `Error: ${error.message}`,
        sources: [],
      };
    }
  }

  private async searchArticles(query: string): Promise<ToolResult> {
    const url = `${this.apiUrl}/page/summary/${encodeURIComponent(query)}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        // Try search API if direct page not found
        return await this.searchAPI(query);
      }

      const data = await response.json() as any;

      const content = `${data.title}\n\n${data.extract || 'No summary available.'}\n\nSource: ${data.content_urls?.desktop?.page || ''}`;

      return {
        content,
        sources: [
          {
            url: data.content_urls?.desktop?.page || '',
            title: data.title,
            snippet: data.extract?.substring(0, 200),
            reliability: 'high',
          },
        ],
        metadata: {
          title: data.title,
          pageId: data.pageid,
        },
      };
    } catch (error) {
      return {
        content: `Error: ${error.message}`,
        sources: [],
      };
    }
  }

  private async searchAPI(query: string): Promise<ToolResult> {
    const url = `https://${this.wikiBaseUrl}/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=5`;

    try {
      const response = await fetch(url);
      const data = await response.json() as any;

      const results = data.query?.search || [];
      if (results.length === 0) {
        return {
          content: `No Wikipedia articles found for "${query}"`,
          sources: [],
        };
      }

      const content = `Found ${results.length} article(s):\n\n${results
        .map((r: any, idx: number) => `${idx + 1}. ${r.title}\n   ${r.snippet}`)
        .join('\n\n')}`;

      return {
        content,
        sources: results.map((r: any) => ({
          url: `https://${this.wikiBaseUrl}/wiki/${encodeURIComponent(r.title)}`,
          title: r.title,
          snippet: r.snippet,
          reliability: 'high' as const,
        })),
        metadata: {
          resultCount: results.length,
        },
      };
    } catch (error) {
      return {
        content: `Error: ${error.message}`,
        sources: [],
      };
    }
  }

  private async getArticle(title: string): Promise<ToolResult> {
    const url = `${this.apiUrl}/page/summary/${encodeURIComponent(title)}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Article not found: ${title}`);
      }

      const data = await response.json() as any;

      return {
        content: `${data.title}\n\n${data.extract || 'No summary available.'}`,
        sources: [
          {
            url: data.content_urls?.desktop?.page || '',
            title: data.title,
            snippet: data.extract?.substring(0, 200),
            reliability: 'high',
          },
        ],
        metadata: {
          title: data.title,
          pageId: data.pageid,
        },
      };
    } catch (error) {
      return {
        content: `Error: ${error.message}`,
        sources: [],
      };
    }
  }
}
