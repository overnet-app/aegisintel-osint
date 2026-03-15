import { Injectable, Logger } from '@nestjs/common';
import { SearXNGService } from '../../search/searxng.service';
import { ResearchTool, ToolResult } from './base.tool';

@Injectable()
export class NewsTool implements ResearchTool {
  readonly name = 'news_search';
  readonly description = 'Search for recent news articles with sentiment analysis. Aggregates results from multiple news sources via SearXNG.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'The news search query',
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of results to return (default: 5)',
        default: 5,
      },
      dateRange: {
        type: 'string',
        description: 'Date range filter (e.g., "7d" for last 7 days, "1m" for last month)',
      },
    },
    required: ['query'],
  };

  private readonly logger = new Logger(NewsTool.name);

  constructor(private searxngService: SearXNGService) {}

  async execute(args: { query: string; maxResults?: number; dateRange?: string }): Promise<ToolResult> {
    this.logger.log(`News search: ${args.query}${args.dateRange ? ` (${args.dateRange})` : ''}`);

    try {
      // Build query with date filter if provided
      let searchQuery = args.query;
      if (args.dateRange) {
        const dateFilter = this.parseDateRange(args.dateRange);
        if (dateFilter) {
          searchQuery += ` ${dateFilter}`;
        }
      }

      // Use SearXNG with news category
      const results = await this.searxngService.search(
        searchQuery,
        ['news'], // News category
        args.maxResults || 5,
      );

      const content = results
        .map((r, idx) => `${idx + 1}. ${r.title}\n   ${r.url}${r.snippet ? `\n   ${r.snippet}` : ''}`)
        .join('\n\n');

      // Assess sentiment (simple keyword-based)
      const sentiment = this.assessSentiment(results.map((r) => `${r.title} ${r.snippet || ''}`).join(' '));

      return {
        content: content || 'No news results found.',
        sources: results.map((r) => ({
          url: r.url,
          title: r.title,
          reliability: this.assessReliability(r.url),
        })),
        metadata: {
          query: args.query,
          resultCount: results.length,
          category: 'news',
          sentiment,
          dateRange: args.dateRange,
        },
      };
    } catch (error: any) {
      this.logger.error(`News search tool error: ${error.message}`);
      return {
        content: `Error: ${error.message}`,
        sources: [],
      };
    }
  }

  private parseDateRange(range: string): string | null {
    // Simple date range parsing
    const match = range.match(/(\d+)([dm])/);
    if (!match) return null;

    const value = parseInt(match[1]);
    const unit = match[2];

    if (unit === 'd') {
      const date = new Date();
      date.setDate(date.getDate() - value);
      return `after:${date.toISOString().split('T')[0]}`;
    } else if (unit === 'm') {
      const date = new Date();
      date.setMonth(date.getMonth() - value);
      return `after:${date.toISOString().split('T')[0]}`;
    }

    return null;
  }

  private assessSentiment(text: string): 'positive' | 'neutral' | 'negative' {
    const lowerText = text.toLowerCase();
    const positiveWords = ['growth', 'gain', 'rise', 'increase', 'success', 'positive', 'strong', 'up'];
    const negativeWords = ['decline', 'fall', 'drop', 'decrease', 'loss', 'negative', 'weak', 'down', 'crisis'];

    let positiveCount = 0;
    let negativeCount = 0;

    for (const word of positiveWords) {
      if (lowerText.includes(word)) positiveCount++;
    }

    for (const word of negativeWords) {
      if (lowerText.includes(word)) negativeCount++;
    }

    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  private assessReliability(url: string): 'high' | 'medium' | 'low' {
    const urlLower = url.toLowerCase();
    
    // High reliability: major news sources
    if (
      urlLower.includes('reuters.com') ||
      urlLower.includes('bloomberg.com') ||
      urlLower.includes('wsj.com') ||
      urlLower.includes('ft.com') ||
      urlLower.includes('bbc.com') ||
      urlLower.includes('theguardian.com')
    ) {
      return 'high';
    }
    
    // Medium reliability: other news sources
    if (
      urlLower.includes('cnn.com') ||
      urlLower.includes('nytimes.com') ||
      urlLower.includes('forbes.com')
    ) {
      return 'medium';
    }
    
    return 'low';
  }
}
