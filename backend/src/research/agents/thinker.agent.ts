import { Injectable, Logger, Optional } from '@nestjs/common';
import { OpenRouterService, StructuredOutputSchema } from '../../ai/open-router.service';
import { McpClientService } from '../../mcp/mcp-client.service';
import { EnhancedBaseAgent } from './enhanced-base-agent';
import { ArchitectPlan, LogicianVerdict, QuantAnalysis, ThinkerReport, FollowUpQuestion } from '../types/swarm.types';
import { JsonRepairUtil } from '../utils/json-repair.util';
import { MemoryService } from '../../ai/memory/memory.service';
import { AgentModelResolverService } from '../services/agent-model-resolver.service';

@Injectable()
export class ThinkerAgent extends EnhancedBaseAgent {
  constructor(
    openRouter: OpenRouterService,
    mcpClient: McpClientService,
    @Optional() agentModelResolver?: AgentModelResolverService,
    @Optional() private memoryService?: MemoryService,
  ) {
    super(openRouter, mcpClient, agentModelResolver);
  }

  private getThinkerReportSchema(): StructuredOutputSchema {
    return {
      type: 'object',
      properties: {
        executiveSummary: { type: 'string' },
        detailedFindings: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              topic: { type: 'string' },
              content: { type: 'string' },
              sources: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    url: { type: 'string' },
                    title: { type: 'string' },
                    excerpt: { type: 'string' },
                  },
                  required: ['url', 'title'],
                },
              },
            },
            required: ['topic', 'content', 'sources'],
          },
        },
        logicalConclusion: { type: 'string' },
        sources: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              url: { type: 'string' },
              title: { type: 'string' },
              reliability: {
                type: 'string',
                enum: ['high', 'medium', 'low'],
              },
              usedFor: { type: 'array', items: { type: 'string' } },
            },
            required: ['url', 'title', 'reliability'],
          },
        },
        unansweredQuestions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              question: { type: 'string' },
              reason: { type: 'string' },
            },
            required: ['question', 'reason'],
          },
        },
        analogies: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              concept: { type: 'string' },
              analogy: { type: 'string' },
            },
            required: ['concept', 'analogy'],
          },
        },
        metadata: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            researchDate: { type: 'string' },
            qualityScore: { type: 'number' },
            completenessScore: { type: 'number' },
            agentVersions: {
              type: 'object',
              additionalProperties: { type: 'string' },
            },
          },
          required: ['query', 'researchDate', 'qualityScore', 'completenessScore'],
        },
      },
      required: ['executiveSummary', 'detailedFindings', 'logicalConclusion', 'sources', 'metadata'],
    };
  }

  async synthesizeReport(
    originalQuery: string,
    architectPlan: ArchitectPlan,
    logicianVerdict: LogicianVerdict,
    quantAnalysis?: QuantAnalysis,
    provider?: string,
    model?: string,
    userId?: string,
  ): Promise<ThinkerReport> {
    // Resolve model from configuration if userId provided
    const resolved = await this.resolveModel(userId, provider || 'openrouter', model || 'google/gemma-3-27b-it');
    const finalProvider = provider || resolved.provider;
    const finalModel = model || resolved.model;
    
    this.logger.log(`The Thinker: Synthesizing final report for query: "${originalQuery}" (${finalProvider}:${finalModel})`);

    // Build context from all agents
    const validatedFactsContext = logicianVerdict.validatedFacts
      .map((f) => `- ${f.fact} (Confidence: ${f.confidence}%, Verified: ${f.verified ? 'Yes' : 'No'})`)
      .join('\n');

    const contradictionsContext = logicianVerdict.contradictions.length > 0
      ? `\n\nContradictions Resolved:\n${logicianVerdict.contradictions
          .map((c) => `- ${c.claim1.fact} vs ${c.claim2.fact}: ${c.resolution}`)
          .join('\n')}`
      : '';

    const quantContext = quantAnalysis
      ? `\n\nFinancial Analysis from The Quant:\n${JSON.stringify(quantAnalysis, null, 2)}`
      : '';

    const gapsContext = logicianVerdict.gaps.length > 0
      ? `\n\nUnanswered Questions:\n${logicianVerdict.gaps.map((g) => `- ${g.question} (Importance: ${g.importance}/10)`).join('\n')}`
      : '';

    const prompt = `You are "The Thinker," the final synthesizer and narrative builder. You are the last stop in the pipeline. You take validated facts from The Logician, the strategy from The Architect, and insights from The Quant (if active) to weave them into the ultimate answer.

CORE DIRECTIVES:

1. SYNTHESIS: Combine disparate pieces of information into a single, coherent narrative. Make connections between facts that weren't explicitly stated.

2. CLARITY: Explain complex topics simply. Use analogies and clear structure. Break down technical jargon into understandable language.

3. COMPLETENESS: Ensure every part of the user's original question is answered. If you cannot answer something due to lack of data, state it clearly in the "unansweredQuestions" section.

4. SOURCE INTEGRATION: Weave the source links into the text naturally so the user can verify the work. Don't just list sources at the end; reference them contextually.

5. OBJECTIVITY: Maintain a neutral, unbiased tone. You are a mirror reflecting the truth, not an opinion column.

Original Query: "${originalQuery}"

Research Plan from The Architect:
- Query Type: ${architectPlan.queryType}
- Complexity: ${architectPlan.complexity}
- Semantic Clusters: ${architectPlan.semanticClusters.map((c) => c.theme).join(', ')}

Validated Facts from The Logician:
${validatedFactsContext}${contradictionsContext}${quantContext}${gapsContext}

Quality Metrics:
- Quality Score: ${logicianVerdict.qualityScore}%
- Completeness Score: ${logicianVerdict.completenessScore}%

Create a comprehensive final report with this JSON structure:
{
  "executiveSummary": "A 2-3 sentence summary of the key findings and conclusions.",
  "detailedFindings": [
    {
      "topic": "Stock Price History",
      "content": "NVIDIA's stock price has shown remarkable growth over the past 10 years. Starting at $4.50 in January 2014, the stock has increased to approximately $150.50 as of 2024, representing a gain of over 3,200%. This growth was driven by several key factors including the AI boom, data center expansion, and strong gaming market performance. [Source: Yahoo Finance](https://finance.yahoo.com/quote/NVDA)",
      "sources": [
        {
          "url": "https://finance.yahoo.com/quote/NVDA",
          "title": "Yahoo Finance: NVIDIA",
          "excerpt": "NVIDIA stock price data"
        }
      ]
    }
  ],
  "logicalConclusion": "Based on the validated data, NVIDIA has demonstrated exceptional growth driven by AI and data center demand. However, the high P/E ratio suggests the market has high expectations for future growth. Investors should consider both the strong fundamentals and the premium valuation.",
  "sources": [
    {
      "url": "https://finance.yahoo.com/quote/NVDA",
      "title": "Yahoo Finance: NVIDIA",
      "reliability": "high",
      "usedFor": ["Stock price data", "Market cap information"]
    }
  ],
  "unansweredQuestions": [
    {
      "question": "What was the specific impact of the AI boom on NVIDIA stock?",
      "reason": "No detailed correlation analysis found between AI boom timeline and stock price movements"
    }
  ],
  "analogies": [
    {
      "concept": "NVIDIA's market position",
      "analogy": "NVIDIA in the AI chip market is like Intel was in the PC processor market in the 1990s - dominant, essential, and riding a massive wave of demand."
    }
  ],
  "metadata": {
    "query": "${originalQuery}",
    "researchDate": "${new Date().toISOString()}",
    "qualityScore": ${logicianVerdict.qualityScore},
    "completenessScore": ${logicianVerdict.completenessScore},
    "agentVersions": {
      "architect": "1.0",
      "scout": "1.0",
      "quant": "${quantAnalysis ? '1.0' : 'N/A'}",
      "logician": "1.0",
      "thinker": "1.0"
    }
  }
}

REPORTING GUIDELINES:
- Executive Summary: 2-3 sentences, high-level overview
- Detailed Findings: Break down by topic/theme from semantic clusters. Each topic should be 2-4 paragraphs with natural source citations.
- Logical Conclusion: Synthesize all findings into a coherent conclusion. Address contradictions if any were resolved.
- Sources: List all unique sources with their reliability and what they were used for
- Unanswered Questions: Only include if there are genuine gaps (from Logician's gap analysis)
- Analogies: Include 1-3 helpful analogies if they clarify complex concepts
- Use markdown-style links in content: [text](url)
- Return ONLY valid JSON, no markdown formatting

Now synthesize the final report:`;

    try {
      // Retrieve relevant memories if memory service is available
      let memoryContext = '';
      if (this.memoryService) {
        try {
          // Extract key entities from the query and validated facts
          const entities = this.extractEntities(originalQuery, logicianVerdict);
          for (const entity of entities.slice(0, 5)) {
            const memory = await this.memoryService.getEntityMemory(null, entity.type, entity.id);
            if (memory) {
              memoryContext += `\n\nRelevant Memory for ${entity.type}/${entity.id}:\n`;
              memoryContext += memory.facts.map(f => `- ${f.fact} (Confidence: ${f.confidence}%)`).join('\n');
            }
          }
        } catch (memoryError) {
          this.logger.warn(`Failed to retrieve memories: ${memoryError.message}`);
        }
      }

      const enhancedPrompt = memoryContext ? `${prompt}\n\n${memoryContext}` : prompt;

      // Use structured output with user's configured model
      // If structured output fails, fallback to regular call with JSON parsing
      let report: ThinkerReport;
      try {
        report = await this.callWithSchema<ThinkerReport>(
          enhancedPrompt,
          this.getThinkerReportSchema(),
          finalProvider,
          finalModel,
        );
      } catch (schemaError: any) {
        // Fallback to regular call with JSON repair
        this.logger.warn(`Structured output failed, falling back to regular call: ${schemaError.message}`);
        const response = await this.callLLM(enhancedPrompt, finalProvider, finalModel);
        
        try {
          report = JsonRepairUtil.repairAndParse<ThinkerReport>(response, this.logger);
        } catch (parseError: any) {
          this.logger.warn(`The Thinker: JSON repair failed, trying safe parse: ${parseError.message}`);
          // Try to extract partial data using safe parse
          const fallbackReport: ThinkerReport = {
            executiveSummary: 'Research completed but report synthesis encountered issues.',
            detailedFindings: [],
            logicalConclusion: 'Analysis complete.',
            sources: [],
            metadata: {
              query: originalQuery,
              researchDate: new Date().toISOString(),
              qualityScore: logicianVerdict.qualityScore,
              completenessScore: logicianVerdict.completenessScore,
              agentVersions: {
                architect: '1.0',
                scout: '1.0',
                quant: quantAnalysis ? '1.0' : 'N/A',
                logician: '1.0',
                thinker: '1.0',
              },
            },
          };
          report = JsonRepairUtil.safeParse<ThinkerReport>(response, fallbackReport, this.logger);
          
          // If safe parse returned the fallback (empty), try to extract at least the summary
          if (report.executiveSummary === fallbackReport.executiveSummary) {
            // Try to extract summary from response text
            const summaryMatch = response.match(/"executiveSummary"\s*:\s*"([^"]+)"/);
            if (summaryMatch) {
              report.executiveSummary = summaryMatch[1];
            }
          }
        }
      }

      // Validate and set defaults
      if (!report.executiveSummary) report.executiveSummary = 'Research completed.';
      if (!report.detailedFindings) report.detailedFindings = [];
      if (!report.logicalConclusion) report.logicalConclusion = 'Analysis complete.';
      if (!report.sources) report.sources = [];
      if (!report.metadata) {
        report.metadata = {
          query: originalQuery,
          researchDate: new Date().toISOString(),
          qualityScore: logicianVerdict.qualityScore,
          completenessScore: logicianVerdict.completenessScore,
          agentVersions: {
            architect: '1.0',
            scout: '1.0',
            quant: quantAnalysis ? '1.0' : 'N/A',
            logician: '1.0',
            thinker: '1.0',
          },
        };
      }

      // Collect all sources from validated facts
      const allSources = new Map<string, ThinkerReport['sources'][0]>();
      
      logicianVerdict.validatedFacts.forEach((f) => {
        f.supportingSources.forEach((s) => {
          if (!allSources.has(s.url)) {
            allSources.set(s.url, {
              url: s.url,
              title: s.excerpt || 'Untitled',
              reliability: s.reliability,
              usedFor: [f.fact.substring(0, 50) + '...'],
            });
          } else {
            const existing = allSources.get(s.url)!;
            existing.usedFor.push(f.fact.substring(0, 50) + '...');
          }
        });
      });

      // Merge with report sources
      report.sources = [...report.sources, ...Array.from(allSources.values())];

      // Include visualizations from quantAnalysis if available
      if (quantAnalysis && (quantAnalysis.charts || quantAnalysis.statistics || quantAnalysis.sentiment || quantAnalysis.predictions)) {
        report.visualizations = {
          charts: quantAnalysis.charts || [],
          ...(quantAnalysis.statistics && { statistics: quantAnalysis.statistics }),
          ...(quantAnalysis.sentiment && { sentiment: quantAnalysis.sentiment }),
          ...(quantAnalysis.predictions && { predictions: quantAnalysis.predictions }),
        };
      }

      this.logger.log(
        `The Thinker: Report synthesized - ${report.detailedFindings.length} topics, ` +
        `${report.sources.length} sources, Quality: ${report.metadata.qualityScore}%, ` +
        `Visualizations: ${report.visualizations ? 'Yes' : 'No'}`
      );

      return report;
    } catch (error: any) {
      this.logger.error(`The Thinker: Failed to synthesize report: ${error.message}`);
      
      // Fallback report
      return {
        executiveSummary: `Research completed for: ${originalQuery}`,
        detailedFindings: [
          {
            topic: 'Findings',
            content: 'Research was completed but report synthesis failed. Please review the validated facts.',
            sources: [],
          },
        ],
        logicalConclusion: 'Analysis complete.',
        sources: logicianVerdict.validatedFacts.flatMap((f) =>
          f.supportingSources.map((s) => ({
            url: s.url,
            title: s.excerpt || 'Untitled',
            reliability: s.reliability,
            usedFor: [f.fact.substring(0, 50) + '...'],
          }))
        ),
        metadata: {
          query: originalQuery,
          researchDate: new Date().toISOString(),
          qualityScore: logicianVerdict.qualityScore,
          completenessScore: logicianVerdict.completenessScore,
          agentVersions: {
            architect: '1.0',
            scout: '1.0',
            quant: quantAnalysis ? '1.0' : 'N/A',
            logician: '1.0',
            thinker: '1.0',
          },
        },
        visualizations: quantAnalysis && (quantAnalysis.charts || quantAnalysis.statistics || quantAnalysis.sentiment || quantAnalysis.predictions) ? {
          charts: quantAnalysis.charts || [],
          ...(quantAnalysis.statistics && { statistics: quantAnalysis.statistics }),
          ...(quantAnalysis.sentiment && { sentiment: quantAnalysis.sentiment }),
          ...(quantAnalysis.predictions && { predictions: quantAnalysis.predictions }),
        } : undefined,
      };
    }
  }

  /**
   * Generate follow-up questions for deeper exploration
   */
  async generateFollowUpQuestions(
    query: string,
    report: ThinkerReport,
    logicianVerdict: LogicianVerdict,
    provider?: string,
    model?: string,
    userId?: string,
  ): Promise<FollowUpQuestion[]> {
    // Resolve model from configuration if userId provided
    const resolved = await this.resolveModel(userId, provider || 'openrouter', model || 'google/gemma-3-27b-it');
    const finalProvider = provider || resolved.provider;
    const finalModel = model || resolved.model;
    
    this.logger.log(`The Thinker: Generating follow-up questions (${finalProvider}:${finalModel})`);

    const currentDate = new Date().toISOString().split('T')[0];
    const year = new Date().getFullYear();

    const gapsSummary = logicianVerdict.gaps
      .map((g) => `${g.question} (importance: ${g.importance}/10)`)
      .join('\n');

    const unansweredSummary = report.unansweredQuestions
      ? report.unansweredQuestions.map((q) => q.question).join('\n')
      : 'None';

    const prompt = `You are "The Thinker," generating intelligent follow-up questions to help users explore topics more deeply.

Today's date: ${currentDate} (year ${year})

Original Query: "${query}"

Research Summary:
${report.executiveSummary}

Identified Gaps:
${gapsSummary || 'None'}

Unanswered Questions:
${unansweredSummary}

Your task:
Generate 4-6 follow-up questions that would help users:
1. Explore deeper aspects of the topic
2. Clarify unclear points
3. Discover related topics
4. Address unanswered questions

Return a JSON array of follow-up questions:
[
  {
    "question": "Clear, specific question",
    "category": "deeper" | "related" | "alternative" | "clarification",
    "priority": 8
  }
]

Categories:
- "deeper": Questions that dive deeper into the same topic
- "related": Questions about related topics
- "alternative": Questions exploring alternative perspectives
- "clarification": Questions to clarify unclear points

Prioritize questions that:
- Address important gaps (importance >= 7)
- Explore interesting aspects mentioned in findings
- Help users understand the topic better
- Are testable with available research tools

Return ONLY the JSON array, no markdown formatting`;

    try {
      const response = await this.callLLM(prompt, finalProvider, finalModel);
      
      let questions: FollowUpQuestion[];
      try {
        const parsed = JsonRepairUtil.repairAndParse<any>(response, this.logger);
        
        // Handle case where response is an object containing an array
        if (Array.isArray(parsed)) {
          questions = parsed;
        } else if (parsed && typeof parsed === 'object') {
          // Try common property names
          if (Array.isArray(parsed.questions)) {
            questions = parsed.questions;
          } else if (Array.isArray(parsed.followUpQuestions)) {
            questions = parsed.followUpQuestions;
          } else if (Array.isArray(parsed.followUps)) {
            questions = parsed.followUps;
          } else if (Array.isArray(parsed.data)) {
            questions = parsed.data;
          } else {
            // Try to find any array property
            const arrayKey = Object.keys(parsed).find(key => Array.isArray(parsed[key]));
            if (arrayKey) {
              questions = parsed[arrayKey];
            } else {
              throw new Error('No array found in response object');
            }
          }
        } else {
          throw new Error('Response is not an array or object');
        }
      } catch (parseError: any) {
        this.logger.warn(`The Thinker: JSON repair failed for follow-up questions, trying extraction: ${parseError.message}`);
        
        // Try to extract array using balanced extraction (more reliable than regex)
        try {
          // First, try to find and extract a balanced array structure
          const normalized = response.trim();
          let arrayStart = normalized.indexOf('[');
          
          if (arrayStart === -1) {
            // No array found, try to extract from object
            const fallback: FollowUpQuestion[] = [];
            const safeParsed = JsonRepairUtil.safeParse<any>(response, fallback, this.logger);
            
            if (Array.isArray(safeParsed)) {
              questions = safeParsed;
            } else if (safeParsed && typeof safeParsed === 'object' && !Array.isArray(safeParsed)) {
              // Try to find array in object
              const arrayKey = Object.keys(safeParsed).find(key => Array.isArray(safeParsed[key]));
              if (arrayKey) {
                questions = safeParsed[arrayKey];
              } else {
                // Try to extract individual question objects using regex
                const questionMatches = response.matchAll(/\{\s*"question"\s*:\s*"([^"]+)"[^}]*\}/g);
                const extractedQuestions: FollowUpQuestion[] = [];
                for (const match of questionMatches) {
                  try {
                    const questionObj = JsonRepairUtil.repairAndParse<FollowUpQuestion>(match[0], this.logger);
                    if (questionObj && questionObj.question) {
                      extractedQuestions.push({
                        question: questionObj.question,
                        category: questionObj.category || 'related',
                        priority: questionObj.priority || 5,
                      });
                    }
                  } catch {
                    // Skip this match
                  }
                }
                if (extractedQuestions.length > 0) {
                  questions = extractedQuestions;
                } else {
                  throw new Error('No array found in response object');
                }
              }
            } else {
              throw new Error('Response is not an array or object');
            }
          } else {
            // Found array start, try balanced extraction
            let depth = 0;
            let inString = false;
            let escapeNext = false;
            let arrayEnd = -1;
            
            for (let i = arrayStart; i < normalized.length; i++) {
              const char = normalized[i];
              
              if (escapeNext) {
                escapeNext = false;
                continue;
              }
              
              if (char === '\\' && inString) {
                escapeNext = true;
                continue;
              }
              
              if (char === '"' && !escapeNext) {
                inString = !inString;
                continue;
              }
              
              if (!inString) {
                if (char === '[') {
                  depth++;
                } else if (char === ']') {
                  depth--;
                  if (depth === 0) {
                    arrayEnd = i + 1;
                    break;
                  }
                }
              }
            }
            
            if (arrayEnd > arrayStart) {
              const arrayStr = normalized.substring(arrayStart, arrayEnd);
              const extracted = JsonRepairUtil.repairAndParse<FollowUpQuestion[]>(arrayStr, this.logger);
              if (Array.isArray(extracted)) {
                questions = extracted;
              } else {
                throw new Error('Extracted JSON is not an array');
              }
            } else {
              // Array not properly closed, try to extract individual objects
              const questionMatches = response.matchAll(/\{\s*"question"\s*:\s*"([^"]+)"[^}]*\}/g);
              const extractedQuestions: FollowUpQuestion[] = [];
              for (const match of questionMatches) {
                try {
                  const questionObj = JsonRepairUtil.repairAndParse<FollowUpQuestion>(match[0], this.logger);
                  if (questionObj && questionObj.question) {
                    extractedQuestions.push({
                      question: questionObj.question,
                      category: questionObj.category || 'related',
                      priority: questionObj.priority || 5,
                    });
                  }
                } catch {
                  // Skip this match
                }
              }
              if (extractedQuestions.length > 0) {
                questions = extractedQuestions;
              } else {
                throw new Error('Could not extract array or individual questions');
              }
            }
          }
        } catch (extractError: any) {
          this.logger.warn(`The Thinker: Array extraction failed: ${extractError.message}`);
          
          // Last resort: try to extract question text directly using regex
          const questionTextMatches = response.matchAll(/"question"\s*:\s*"([^"]+)"/g);
          const extractedQuestions: FollowUpQuestion[] = [];
          let priority = 8; // Start with high priority
          
          for (const match of questionTextMatches) {
            if (match[1] && match[1].trim().length > 0) {
              extractedQuestions.push({
                question: match[1].trim(),
                category: 'related',
                priority: priority--,
              });
              if (priority < 5) priority = 5; // Don't go below 5
            }
          }
          
          if (extractedQuestions.length > 0) {
            this.logger.log(`The Thinker: Extracted ${extractedQuestions.length} questions using regex fallback`);
            questions = extractedQuestions;
          } else {
            throw new Error('Response is not an array');
          }
        }
      }

      // Validate that questions is an array
      if (!Array.isArray(questions)) {
        this.logger.warn(`The Thinker: Follow-up questions response is not an array after all attempts, using fallback`);
        throw new Error('Response is not an array');
      }

      // Validate and set defaults
      const validQuestions = questions
        .filter((q) => q && q.question && q.question.trim().length > 0)
        .map((q) => ({
          question: q.question.trim(),
          category: (q.category || 'related') as 'deeper' | 'related' | 'alternative' | 'clarification',
          priority: q.priority || 5,
        }))
        .sort((a, b) => b.priority - a.priority)
        .slice(0, 6); // Limit to 6 questions

      this.logger.log(`The Thinker: Generated ${validQuestions.length} follow-up questions`);

      return validQuestions;
    } catch (error: any) {
      this.logger.error(`The Thinker: Failed to generate follow-up questions: ${error.message}`);
      
      // Fallback: generate questions from gaps
      const fallbackQuestions: FollowUpQuestion[] = (logicianVerdict.gaps || [])
        .slice(0, 4)
        .map((gap) => ({
          question: gap.question,
          category: 'deeper' as const,
          priority: gap.importance,
        }));

      return fallbackQuestions;
    }
  }

  /**
   * Extract entities from query and validated facts for memory lookup
   */
  private extractEntities(
    query: string,
    logicianVerdict: LogicianVerdict,
  ): Array<{ type: 'person' | 'organization' | 'location' | 'event' | 'concept'; id: string }> {
    const entities: Array<{ type: 'person' | 'organization' | 'location' | 'event' | 'concept'; id: string }> = [];
    
    // Simple entity extraction - in production, use NER
    const words = query.split(/\s+/);
    for (const word of words) {
      if (word.length > 2 && /^[A-Z]/.test(word)) {
        // Capitalized words might be entities
        entities.push({ type: 'concept', id: word });
      }
    }

    // Extract from validated facts
    for (const fact of logicianVerdict.validatedFacts.slice(0, 10)) {
      const factWords = fact.fact.split(/\s+/);
      for (const word of factWords) {
        if (word.length > 2 && /^[A-Z]/.test(word)) {
          entities.push({ type: 'concept', id: word });
        }
      }
    }

    // Remove duplicates
    const unique = Array.from(
      new Map(entities.map(e => [`${e.type}-${e.id}`, e])).values()
    );

    return unique;
  }
}
