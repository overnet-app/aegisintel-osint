import { Injectable, Logger } from '@nestjs/common';
import { OpenRouterService } from '../../ai/open-router.service';
import { McpClientService } from '../../mcp/mcp-client.service';
import { BaseResearchAgent } from './base-research-agent';
import { InlineCitation, ScoutFindings } from '../types/swarm.types';

@Injectable()
export class CitationAgent extends BaseResearchAgent {
  constructor(
    openRouter: OpenRouterService,
    mcpClient: McpClientService,
  ) {
    super(openRouter, mcpClient);
  }

  /**
   * Extract inline citations from text and findings
   */
  async extractCitations(
    text: string,
    findings: ScoutFindings[],
    provider: string = 'openrouter',
    model: string = 'google/gemma-3-27b-it',
  ): Promise<InlineCitation[]> {
    this.logger.log(`Citation Agent: Extracting citations from text (${text.length} chars)`);

    // Collect all sources from findings
    const allSources: Array<{
      url: string;
      title: string;
      snippet?: string;
      reliability: 'high' | 'medium' | 'low';
      type: 'academic' | 'news' | 'official' | 'technical' | 'forum' | 'other';
    }> = [];

    for (const finding of findings) {
      for (const data of finding.rawData) {
        if (data.source && data.source.url) {
          allSources.push({
            url: data.source.url,
            title: data.source.title || 'Untitled',
            snippet: data.source.snippet,
            reliability: data.source.reliability,
            type: data.source.type,
          });
        }
      }
    }

    // Deduplicate sources by URL
    const uniqueSources = Array.from(
      new Map(allSources.map((s) => [s.url, s])).values()
    );

    if (uniqueSources.length === 0) {
      this.logger.warn('Citation Agent: No sources found in findings');
      return [];
    }

    // Use LLM to match text segments to sources
    const prompt = `You are a citation expert. Match text segments from the following response to their sources.

Response text:
${text.substring(0, 4000)}${text.length > 4000 ? '...' : ''}

Available sources:
${uniqueSources.map((s, idx) => `${idx + 1}. ${s.title} (${s.url})`).join('\n')}

For each significant claim or fact in the response, identify which source(s) support it. Return a JSON array of citations:

[
  {
    "id": "[1]",
    "text": "The exact text segment being cited",
    "sourceIndex": 0,
    "position": 150
  }
]

Rules:
- Only cite verifiable facts, not opinions
- Match text to the most relevant source
- Position is the character index where the citation should appear
- Use sequential IDs: [1], [2], [3], etc.
- Return ONLY the JSON array, no markdown formatting`;

    try {
      const response = await this.callLLM(prompt, provider, model);
      let jsonStr = response.trim();

      // Remove markdown code blocks
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }

      // Extract JSON array
      const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        jsonStr = arrayMatch[0];
      }

      // Fix JSON issues
      jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
      jsonStr = jsonStr.replace(/[\x00-\x1F\x7F]/g, ' ');

      const citationMatches = JSON.parse(jsonStr) as Array<{
        id: string;
        text: string;
        sourceIndex: number;
        position: number;
      }>;

      // Build citations with full source information
      const citations: InlineCitation[] = citationMatches
        .filter((match) => match.sourceIndex >= 0 && match.sourceIndex < uniqueSources.length)
        .map((match) => {
          const source = uniqueSources[match.sourceIndex];
          const domain = this.extractDomain(source.url);

          return {
            id: match.id,
            text: match.text,
            position: match.position,
            source: {
              url: source.url,
              title: source.title,
              domain,
              snippet: source.snippet || '',
              reliability: source.reliability,
            },
          };
        });

      this.logger.log(`Citation Agent: Extracted ${citations.length} citations`);
      return citations;
    } catch (error: any) {
      this.logger.error(`Citation Agent: Failed to extract citations: ${error.message}`);
      // Fallback: create simple citations from sources
      return uniqueSources.slice(0, 10).map((source, idx) => ({
        id: `[${idx + 1}]`,
        text: source.title,
        position: 0,
        source: {
          url: source.url,
          title: source.title,
          domain: this.extractDomain(source.url),
          snippet: source.snippet || '',
          reliability: source.reliability,
        },
      }));
    }
  }

  /**
   * Verify citation accuracy and source reliability
   */
  async verifyCitations(
    citations: InlineCitation[],
    findings: ScoutFindings[],
  ): Promise<InlineCitation[]> {
    // Build a map of URLs to reliability scores
    const urlReliability = new Map<string, 'high' | 'medium' | 'low'>();
    
    for (const finding of findings) {
      for (const data of finding.rawData) {
        if (data.source && data.source.url) {
          urlReliability.set(data.source.url, data.source.reliability);
        }
      }
    }

    // Update citation reliability based on findings
    return citations.map((citation) => {
      const reliability = urlReliability.get(citation.source.url) || citation.source.reliability;
      return {
        ...citation,
        source: {
          ...citation.source,
          reliability,
        },
      };
    });
  }

  /**
   * Extract domain from URL
   */
  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      // If URL parsing fails, try simple extraction
      const match = url.match(/https?:\/\/(?:www\.)?([^\/]+)/);
      return match ? match[1] : url;
    }
  }
}
