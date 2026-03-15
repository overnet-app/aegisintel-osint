import { Injectable, Logger } from '@nestjs/common';
import { OpenRouterService } from '../../ai/open-router.service';
import { McpClientService } from '../../mcp/mcp-client.service';
import { BaseResearchAgent } from './base-research-agent';

export interface ImageAnalysis {
  text: string[]; // Extracted text (OCR)
  objects: Array<{
    name: string;
    confidence: number;
    boundingBox?: { x: number; y: number; width: number; height: number };
  }>;
  context: string; // Overall context/description
  isChart: boolean;
  chartData?: {
    type: 'line' | 'bar' | 'pie' | 'scatter' | 'other';
    dataPoints: Array<{ label: string; value: number }>;
    axes?: { x: string; y: string };
  };
  metadata: {
    imageType: 'photo' | 'chart' | 'infographic' | 'diagram' | 'screenshot' | 'other';
    colors?: string[];
    dimensions?: { width: number; height: number };
  };
}

export interface InfographicAnalysis {
  keyPoints: Array<{
    text: string;
    position: 'top' | 'middle' | 'bottom' | 'left' | 'right';
    importance: number;
  }>;
  statistics: Array<{
    label: string;
    value: string | number;
    unit?: string;
  }>;
  relationships: Array<{
    from: string;
    to: string;
    type: string;
  }>;
  summary: string;
}

@Injectable()
export class VisionAgent extends BaseResearchAgent {
  constructor(
    openRouter: OpenRouterService,
    mcpClient: McpClientService,
  ) {
    super(openRouter, mcpClient);
  }

  /**
   * Analyze an image using multi-modal LLM
   */
  async analyzeImage(
    imageUrl: string,
    provider: string = 'openrouter',
    model: string = 'google/gemini-pro-vision',
  ): Promise<ImageAnalysis> {
    this.logger.log(`Vision Agent: Analyzing image ${imageUrl} (${provider}:${model})`);

    const prompt = `Analyze this image in detail. Extract:
1. All visible text (OCR)
2. Objects and entities present
3. Overall context and description
4. Whether it's a chart/graph (and if so, extract data points)
5. Image type (photo, chart, infographic, diagram, screenshot, other)

Return a JSON response:
{
  "text": ["Extracted text line 1", "Extracted text line 2"],
  "objects": [
    {"name": "Object name", "confidence": 0.95}
  ],
  "context": "Overall description of what the image shows",
  "isChart": false,
  "chartData": null,
  "metadata": {
    "imageType": "photo",
    "colors": ["#FF0000", "#00FF00"],
    "dimensions": {"width": 1920, "height": 1080}
  }
}

If it's a chart, extract data points:
{
  "isChart": true,
  "chartData": {
    "type": "line",
    "dataPoints": [
      {"label": "2020", "value": 100},
      {"label": "2021", "value": 150}
    ],
    "axes": {"x": "Year", "y": "Value"}
  }
}

Return ONLY valid JSON, no markdown formatting.`;

    try {
      // Use OpenRouter's vision API
      const analysis = await this.openRouter.analyzeImage(imageUrl, prompt);

      // Parse the response
      let jsonStr = analysis.trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }

      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }

      jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
      jsonStr = jsonStr.replace(/[\x00-\x1F\x7F]/g, ' ');

      const result = JSON.parse(jsonStr) as ImageAnalysis;

      // Validate and set defaults
      if (!result.text) result.text = [];
      if (!result.objects) result.objects = [];
      if (!result.context) result.context = 'Image analysis completed';
      if (typeof result.isChart !== 'boolean') result.isChart = false;
      if (!result.metadata) {
        result.metadata = {
          imageType: 'other',
        };
      }

      this.logger.log(
        `Vision Agent: Analysis complete - ${result.text.length} text lines, ` +
        `${result.objects.length} objects, Chart: ${result.isChart}`
      );

      return result;
    } catch (error: any) {
      this.logger.error(`Vision Agent: Failed to analyze image: ${error.message}`);
      
      // Fallback
      return {
        text: [],
        objects: [],
        context: 'Image analysis failed',
        isChart: false,
        metadata: {
          imageType: 'other',
        },
      };
    }
  }

  /**
   * Extract chart data from an image
   */
  async extractChartData(
    imageUrl: string,
    provider: string = 'openrouter',
    model: string = 'google/gemini-pro-vision',
  ): Promise<ImageAnalysis['chartData']> {
    const analysis = await this.analyzeImage(imageUrl, provider, model);
    return analysis.chartData;
  }

  /**
   * Analyze an infographic
   */
  async analyzeInfographic(
    imageUrl: string,
    provider: string = 'openrouter',
    model: string = 'google/gemini-pro-vision',
  ): Promise<InfographicAnalysis> {
    this.logger.log(`Vision Agent: Analyzing infographic ${imageUrl}`);

    const prompt = `This is an infographic. Extract:
1. Key points and statistics
2. Relationships between concepts
3. Overall summary

Return JSON:
{
  "keyPoints": [
    {"text": "Key point text", "position": "top", "importance": 8}
  ],
  "statistics": [
    {"label": "Stat label", "value": "50%", "unit": "percentage"}
  ],
  "relationships": [
    {"from": "Concept A", "to": "Concept B", "type": "causes"}
  ],
  "summary": "Overall summary of the infographic"
}

Return ONLY valid JSON, no markdown formatting.`;

    try {
      const analysis = await this.openRouter.analyzeImage(imageUrl, prompt);

      let jsonStr = analysis.trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }

      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }

      jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
      jsonStr = jsonStr.replace(/[\x00-\x1F\x7F]/g, ' ');

      const result = JSON.parse(jsonStr) as InfographicAnalysis;

      // Validate
      if (!result.keyPoints) result.keyPoints = [];
      if (!result.statistics) result.statistics = [];
      if (!result.relationships) result.relationships = [];
      if (!result.summary) result.summary = 'Infographic analysis completed';

      this.logger.log(
        `Vision Agent: Infographic analysis complete - ${result.keyPoints.length} key points, ` +
        `${result.statistics.length} statistics`
      );

      return result;
    } catch (error: any) {
      this.logger.error(`Vision Agent: Failed to analyze infographic: ${error.message}`);
      
      return {
        keyPoints: [],
        statistics: [],
        relationships: [],
        summary: 'Infographic analysis failed',
      };
    }
  }
}
