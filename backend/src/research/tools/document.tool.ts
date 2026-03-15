import { Injectable, Logger } from '@nestjs/common';
import { OcrService } from '../../common/services/ocr.service';
import { ContentScraperService } from '../../search/content-scraper.service';
import { ResearchTool, ToolResult } from './base.tool';

@Injectable()
export class DocumentTool implements ResearchTool {
  readonly name = 'document';
  readonly description = 'Extract and analyze content from documents (PDF, HTML, DOCX). Uses OCR for images and text extraction for web pages.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      url: {
        type: 'string',
        description: 'URL of the document to analyze',
      },
    },
    required: ['url'],
  };

  private readonly logger = new Logger(DocumentTool.name);

  constructor(
    private ocrService: OcrService,
    private contentScraper: ContentScraperService,
  ) {}

  async execute(args: { url?: string }): Promise<ToolResult> {
    if (!args || !args.url) {
      this.logger.error('Document tool: URL parameter is missing');
      return {
        content: 'Error: URL parameter is required. Please provide a valid document URL.',
        sources: [],
      };
    }

    // Validate URL
    let validUrl: string;
    try {
      const urlObj = new URL(args.url);
      validUrl = urlObj.href;
    } catch (error) {
      // Try to fix common issues
      if (!args.url.startsWith('http://') && !args.url.startsWith('https://')) {
        try {
          validUrl = new URL(`https://${args.url}`).href;
        } catch {
          this.logger.error(`Document tool: Invalid URL format: ${args.url}`);
          return {
            content: `Error: Invalid URL format: ${args.url}`,
            sources: [],
          };
        }
      } else {
        this.logger.error(`Document tool: Invalid URL: ${args.url}`);
        return {
          content: `Error: Invalid URL: ${args.url}`,
          sources: [],
        };
      }
    }

    this.logger.log(`Document tool: ${validUrl}`);

    try {
      // Use content scraper for web pages (pass URL as query for general extraction)
      const content = await this.contentScraper.scrapeContent(validUrl, validUrl);

      return {
        content: content?.fullText || 'No content extracted.',
        sources: [
          {
            url: validUrl,
            title: content?.title || 'Document',
            snippet: content?.fullText?.substring(0, 200),
            reliability: 'medium',
          },
        ],
        metadata: {
          url: validUrl,
          mentions: content?.mentions || [],
        },
      };
    } catch (error) {
      this.logger.error(`Document tool error: ${error.message}`);
      return {
        content: `Error extracting document: ${error.message}`,
        sources: [
          {
            url: validUrl,
            title: 'Document',
            reliability: 'low',
          },
        ],
      };
    }
  }
}
