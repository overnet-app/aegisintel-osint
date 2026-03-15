import { Injectable, Logger } from '@nestjs/common';
import { SearXNGService } from '../../search/searxng.service';
import { ResearchTool, ToolResult } from './base.tool';

@Injectable()
export class AcademicTool implements ResearchTool {
  readonly name = 'academic_search';
  readonly description = 'Search academic sources including arXiv, PubMed, Google Scholar, and other scholarly databases via SearXNG.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'The academic search query',
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of results to return (default: 5)',
        default: 5,
      },
    },
    required: ['query'],
  };

  private readonly logger = new Logger(AcademicTool.name);

  constructor(private searxngService: SearXNGService) {}

  async execute(args: { query: string; maxResults?: number }): Promise<ToolResult> {
    this.logger.log(`Academic search: ${args.query}`);

    try {
      // Use SearXNG with academic categories
      const results = await this.searxngService.search(
        args.query,
        ['science'], // Academic/science category
        args.maxResults || 5,
      );

      const content = results
        .map((r, idx) => `${idx + 1}. ${r.title}\n   ${r.url}${r.snippet ? `\n   ${r.snippet}` : ''}`)
        .join('\n\n');

      return {
        content: content || 'No academic results found.',
        sources: results.map((r) => ({
          url: r.url,
          title: r.title,
          reliability: this.assessReliability(r.url),
        })),
        metadata: {
          query: args.query,
          resultCount: results.length,
          category: 'academic',
        },
      };
    } catch (error: any) {
      this.logger.error(`Academic search tool error: ${error.message}`);
      return {
        content: `Error: ${error.message}`,
        sources: [],
      };
    }
  }

  private assessReliability(url: string): 'high' | 'medium' | 'low' {
    const urlLower = url.toLowerCase();
    
    // High reliability: arXiv, PubMed, .edu, .gov
    if (
      urlLower.includes('arxiv.org') ||
      urlLower.includes('pubmed') ||
      urlLower.includes('.edu') ||
      urlLower.includes('.gov') ||
      urlLower.includes('scholar.google')
    ) {
      return 'high';
    }
    
    // Medium reliability: other academic domains
    if (
      urlLower.includes('researchgate') ||
      urlLower.includes('academia.edu') ||
      urlLower.includes('jstor')
    ) {
      return 'medium';
    }
    
    return 'low';
  }
}
