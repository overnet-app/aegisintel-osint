import { Injectable, Logger } from '@nestjs/common';
import { WebSearchService } from '../../search/web-search.service';
import { ResearchTool, ToolResult } from './base.tool';

@Injectable()
export class WebSearchTool implements ResearchTool {
  readonly name = 'web_search';
  readonly description = 'Search the web using SearXNG (aggregates results from multiple engines). Returns search results with titles, URLs, and snippets.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'The search query',
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of results to return (default: 5)',
        default: 5,
      },
    },
    required: ['query'],
  };

  private readonly logger = new Logger(WebSearchTool.name);

  constructor(private webSearchService: WebSearchService) {}

  async execute(args: { query: string; maxResults?: number }): Promise<ToolResult> {
    this.logger.log(`Web search: ${args.query}`);

    try {
      const results = await this.webSearchService.searchWebPages(
        args.query,
        args.maxResults || 5,
      );

      const content = results
        .map((r, idx) => `${idx + 1}. ${r.title}\n   ${r.url}`)
        .join('\n\n');

      return {
        content: content || 'No results found.',
        sources: results.map((r) => ({
          url: r.url,
          title: r.title,
          reliability: 'medium' as const,
        })),
        metadata: {
          query: args.query,
          resultCount: results.length,
        },
      };
    } catch (error) {
      this.logger.error(`Web search tool error: ${error.message}`);
      return {
        content: `Error: ${error.message}`,
        sources: [],
      };
    }
  }
}
