import { Injectable, Logger } from '@nestjs/common';
import { VisionAgent } from '../agents/vision.agent';
import { ResearchTool, ToolResult } from './base.tool';

@Injectable()
export class ImageAnalysisTool implements ResearchTool {
  readonly name = 'image_analysis';
  readonly description = 'Analyze images, charts, and infographics. Extracts text (OCR), identifies objects, extracts chart data, and provides context.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      imageUrl: {
        type: 'string',
        description: 'URL of the image to analyze',
      },
      analysisType: {
        type: 'string',
        enum: ['general', 'chart', 'infographic'],
        description: 'Type of analysis to perform (default: general)',
        default: 'general',
      },
    },
    required: ['imageUrl'],
  };

  private readonly logger = new Logger(ImageAnalysisTool.name);

  constructor(private visionAgent: VisionAgent) {}

  async execute(args: { imageUrl: string; analysisType?: string }): Promise<ToolResult> {
    this.logger.log(`Image analysis: ${args.imageUrl} (type: ${args.analysisType || 'general'})`);

    try {
      let analysis: any;
      let content: string;

      if (args.analysisType === 'chart') {
        const chartData = await this.visionAgent.extractChartData(args.imageUrl);
        analysis = { chartData };
        content = chartData
          ? `Chart data extracted: ${JSON.stringify(chartData, null, 2)}`
          : 'No chart data found in image';
      } else if (args.analysisType === 'infographic') {
        const infographicAnalysis = await this.visionAgent.analyzeInfographic(args.imageUrl);
        analysis = infographicAnalysis;
        content = `Infographic Analysis:\n\nKey Points:\n${infographicAnalysis.keyPoints.map((kp) => `- ${kp.text}`).join('\n')}\n\nStatistics:\n${infographicAnalysis.statistics.map((s) => `- ${s.label}: ${s.value}${s.unit ? ` ${s.unit}` : ''}`).join('\n')}\n\nSummary: ${infographicAnalysis.summary}`;
      } else {
        const imageAnalysis = await this.visionAgent.analyzeImage(args.imageUrl);
        analysis = imageAnalysis;
        content = `Image Analysis:\n\nContext: ${imageAnalysis.context}\n\nExtracted Text:\n${imageAnalysis.text.map((t) => `- ${t}`).join('\n')}\n\nObjects:\n${imageAnalysis.objects.map((o) => `- ${o.name} (confidence: ${(o.confidence * 100).toFixed(1)}%)`).join('\n')}\n\nImage Type: ${imageAnalysis.metadata.imageType}${imageAnalysis.isChart ? '\n\nChart Data:\n' + JSON.stringify(imageAnalysis.chartData, null, 2) : ''}`;
      }

      return {
        content,
        sources: [
          {
            url: args.imageUrl,
            title: 'Image Analysis',
            reliability: 'medium' as const,
          },
        ],
        metadata: {
          imageUrl: args.imageUrl,
          analysisType: args.analysisType || 'general',
          analysis,
        },
      };
    } catch (error: any) {
      this.logger.error(`Image analysis tool error: ${error.message}`);
      return {
        content: `Error: ${error.message}`,
        sources: [],
      };
    }
  }
}
