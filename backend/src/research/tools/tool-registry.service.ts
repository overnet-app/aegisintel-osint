import { Injectable, Logger } from '@nestjs/common';
import { ResearchTool } from './base.tool';
import { WebSearchTool } from './web-search.tool';
import { FinanceTool } from './finance.tool';
import { WikipediaTool } from './wikipedia.tool';
import { DocumentTool } from './document.tool';
import { CalculatorTool } from './calculator.tool';
import { ImageAnalysisTool } from './image-analysis.tool';
import { PdfExtractorTool } from './pdf-extractor.tool';
import { AcademicTool } from './academic.tool';
import { NewsTool } from './news.tool';
import { MCPTool } from '../../mcp/types/mcp.types';

@Injectable()
export class ToolRegistryService {
  private readonly logger = new Logger(ToolRegistryService.name);
  private tools: Map<string, ResearchTool> = new Map();

  constructor(
    private webSearchTool: WebSearchTool,
    private financeTool: FinanceTool,
    private wikipediaTool: WikipediaTool,
    private documentTool: DocumentTool,
    private calculatorTool: CalculatorTool,
    private imageAnalysisTool: ImageAnalysisTool,
    private pdfExtractorTool: PdfExtractorTool,
    private academicTool: AcademicTool,
    private newsTool: NewsTool,
  ) {
    this.registerTool(webSearchTool);
    this.registerTool(financeTool);
    this.registerTool(wikipediaTool);
    this.registerTool(documentTool);
    this.registerTool(calculatorTool);
    this.registerTool(imageAnalysisTool);
    this.registerTool(pdfExtractorTool);
    this.registerTool(academicTool);
    this.registerTool(newsTool);
  }

  registerTool(tool: ResearchTool) {
    this.tools.set(tool.name, tool);
    this.logger.log(`Registered research tool: ${tool.name}`);
  }

  getTool(name: string): ResearchTool | undefined {
    return this.tools.get(name);
  }

  getAllTools(): ResearchTool[] {
    return Array.from(this.tools.values());
  }

  getMCPTools(): MCPTool[] {
    return Array.from(this.tools.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.parameters,
    }));
  }
}
