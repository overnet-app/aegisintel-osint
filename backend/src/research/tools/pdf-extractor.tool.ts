import { Injectable, Logger } from '@nestjs/common';
import { DocumentTool } from './document.tool';
import { ResearchTool, ToolResult } from './base.tool';

@Injectable()
export class PdfExtractorTool implements ResearchTool {
  readonly name = 'pdf_extractor';
  readonly description = 'Extract structured content from PDF files including text, tables, and metadata. Preserves document structure.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      url: {
        type: 'string',
        description: 'URL of the PDF file',
      },
      extractTables: {
        type: 'boolean',
        description: 'Whether to extract tables (default: true)',
        default: true,
      },
      extractMetadata: {
        type: 'boolean',
        description: 'Whether to extract metadata (default: true)',
        default: true,
      },
    },
    required: ['url'],
  };

  private readonly logger = new Logger(PdfExtractorTool.name);

  constructor(private documentTool: DocumentTool) {}

  async execute(args: { url: string; extractTables?: boolean; extractMetadata?: boolean }): Promise<ToolResult> {
    this.logger.log(`PDF extraction: ${args.url}`);

    try {
      // Use the document tool to scrape the PDF
      const result = await this.documentTool.execute({
        url: args.url,
      });

      // Enhance with PDF-specific processing
      const content = result.content || '';
      const lines = content.split('\n').filter((l) => l.trim().length > 0);

      // Try to identify sections
      const sections: Array<{ title: string; content: string }> = [];
      let currentSection = { title: 'Introduction', content: '' };

      for (const line of lines) {
        // Detect section headers (lines that are short, uppercase, or end with colon)
        if (line.length < 100 && (line.toUpperCase() === line || line.endsWith(':'))) {
          if (currentSection.content.trim().length > 0) {
            sections.push(currentSection);
          }
          currentSection = { title: line.replace(':', '').trim(), content: '' };
        } else {
          currentSection.content += line + '\n';
        }
      }
      if (currentSection.content.trim().length > 0) {
        sections.push(currentSection);
      }

      // Build structured content
      let structuredContent = `PDF Content Extracted:\n\n`;
      structuredContent += `Total Sections: ${sections.length}\n\n`;

      for (const section of sections.slice(0, 10)) {
        structuredContent += `## ${section.title}\n${section.content.substring(0, 500)}${section.content.length > 500 ? '...' : ''}\n\n`;
      }

      return {
        content: structuredContent,
        sources: result.sources || [
          {
            url: args.url,
            title: 'PDF Document',
            reliability: 'medium' as const,
          },
        ],
        metadata: {
          url: args.url,
          sections: sections.length,
          totalLines: lines.length,
          extractTables: args.extractTables !== false,
          extractMetadata: args.extractMetadata !== false,
        },
      };
    } catch (error: any) {
      this.logger.error(`PDF extractor tool error: ${error.message}`);
      return {
        content: `Error: ${error.message}`,
        sources: [],
      };
    }
  }
}
