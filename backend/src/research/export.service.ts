import { Injectable, Logger } from '@nestjs/common';
import { ResearchSessionService } from './research-session.service';
import { SourceTrackerService } from './source-tracker.service';
import { PuppeteerClusterService } from '../scraper/puppeteer-cluster.service';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);
  private readonly debugLogPath = path.join(process.cwd(), '.cursor', 'debug.log');

  private writeDebugLog(location: string, message: string, data: any, hypothesisId: string) {
    try {
      const logEntry = {
        location,
        message,
        data,
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId,
      };
      const logDir = path.dirname(this.debugLogPath);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      fs.appendFileSync(this.debugLogPath, JSON.stringify(logEntry) + '\n');
    } catch (e) {
      // Silent fail for debug logging
    }
  }

  constructor(
    private sessionService: ResearchSessionService,
    private sourceTracker: SourceTrackerService,
    private puppeteer: PuppeteerClusterService,
    private prisma: PrismaService,
  ) {}

  async exportMarkdown(sessionId: string): Promise<string> {
    try {
      this.logger.log(`Exporting markdown for session: ${sessionId}`);
      
      const session = await this.sessionService.getSession(sessionId);
      if (!session) {
        this.logger.error(`Session not found: ${sessionId}`);
        throw new Error('Research session not found');
      }

      const result = await this.sessionService.getResult(sessionId);
      if (!result) {
        this.logger.error(`Result not found for session: ${sessionId}`);
        throw new Error('Research result not found. The research may still be in progress or has expired.');
      }

      this.logger.log(`Session and result found, getting sources...`);
      const sources = await this.sourceTracker.deduplicateSources(sessionId);
      this.logger.log(`Found ${sources.length} sources`);

      // Detect report type
      const reportType = this.detectReportType(session.query, result);
      const reportDate = new Date(session.createdAt);
      const formattedDate = reportDate.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      // Build professional markdown report
      let markdown = this.buildReportHeader(session, reportType, formattedDate);
      
      // Add metadata table
      markdown += this.buildMetadataTable(session, reportType);
      
      markdown += `\n---\n\n`;
      
      // Add table of contents placeholder (will be populated after content)
      const tocSections: string[] = [];

    // Check if we have the new Swarm Intelligence structure
    const hasThinkerReport = result && typeof result === 'object' && result.thinkerReport;
    const hasPlan = result && typeof result === 'object' && result.plan;

    if (hasThinkerReport) {
      // New Swarm Intelligence structure
      const report = result.thinkerReport;
      
      if (!report || typeof report !== 'object') {
        this.logger.warn('thinkerReport exists but is not an object, falling back to old structure');
        // Fall through to old structure handling below
      } else {
        // Executive Summary
      if (report.executiveSummary) {
        tocSections.push('Executive Summary');
        markdown += `## Executive Summary\n\n`;
        markdown += `${report.executiveSummary}\n\n`;
        markdown += `---\n\n`;
      }

      // Detailed Findings
      if (report.detailedFindings && report.detailedFindings.length > 0) {
        tocSections.push('Detailed Findings');
        markdown += `## Detailed Findings\n\n`;
        report.detailedFindings.forEach((finding: any, idx: number) => {
          markdown += `### ${idx + 1}. ${finding.topic || `Finding ${idx + 1}`}\n\n`;
          markdown += `${finding.content}\n\n`;
          if (finding.sources && finding.sources.length > 0) {
            markdown += `**Source References:**\n\n`;
            finding.sources.forEach((source: any, srcIdx: number) => {
              markdown += `${srcIdx + 1}. [${source.title || source.url}](${source.url})`;
              if (source.reliability) {
                markdown += ` *(Reliability: ${source.reliability})*`;
              }
              markdown += `\n`;
            });
            markdown += `\n`;
          }
          markdown += `---\n\n`;
        });
      }

      // Logical Conclusion
      if (report.logicalConclusion) {
        tocSections.push('Conclusion');
        markdown += `## Conclusion\n\n`;
        markdown += `${report.logicalConclusion}\n\n`;
        markdown += `---\n\n`;
      }

      // Research Plan (if available)
      if (hasPlan) {
        tocSections.push('Research Methodology');
        markdown += `## Research Methodology\n\n`;
        markdown += `### Strategy Overview\n\n`;
        markdown += `| Aspect | Details |\n`;
        markdown += `|--------|---------|\n`;
        markdown += `| **Query Type** | ${result.plan.queryType || 'N/A'} |\n`;
        markdown += `| **Complexity** | ${result.plan.complexity || 'N/A'} |\n`;
        if (result.plan.expectedSources && result.plan.expectedSources.length > 0) {
          markdown += `| **Expected Sources** | ${result.plan.expectedSources.join(', ')} |\n`;
        }
        markdown += `\n`;
        
        if (result.plan.semanticClusters && result.plan.semanticClusters.length > 0) {
          markdown += `### Research Themes\n\n`;
          result.plan.semanticClusters.forEach((cluster: any, idx: number) => {
            markdown += `#### Theme ${idx + 1}: ${cluster.theme} (Priority: ${cluster.priority})\n\n`;
            if (cluster.subQueries && cluster.subQueries.length > 0) {
              markdown += `**Sub-queries:**\n\n`;
              cluster.subQueries.forEach((sq: string, sqIdx: number) => {
                markdown += `${sqIdx + 1}. ${sq}\n`;
              });
              markdown += `\n`;
            }
          });
          markdown += `---\n\n`;
        }
      }

      // Quant Analysis (if available)
      if (result.quantAnalysis) {
        tocSections.push('Financial Analysis');
        markdown += `## Financial Analysis\n\n`;
        const quant = result.quantAnalysis;
        
        if (quant.financialData) {
          markdown += `### Financial Data\n\n`;
          markdown += `| Metric | Value |\n`;
          markdown += `|--------|-------|\n`;
          if (quant.financialData.symbol) {
            markdown += `| **Symbol** | ${quant.financialData.symbol} |\n`;
          }
          if (quant.financialData.currentPrice !== undefined) {
            markdown += `| **Current Price** | $${quant.financialData.currentPrice} |\n`;
          }
          if (quant.financialData.marketCap !== undefined) {
            markdown += `| **Market Cap** | $${this.formatNumber(quant.financialData.marketCap)} |\n`;
          }
          if (quant.financialData.peRatio !== undefined) {
            markdown += `| **P/E Ratio** | ${quant.financialData.peRatio} |\n`;
          }
          if (quant.financialData.dividendYield !== undefined) {
            markdown += `| **Dividend Yield** | ${quant.financialData.dividendYield}% |\n`;
          }
          markdown += `\n`;
        }
        
        if (quant.contextualization) {
          markdown += `### Market Context\n\n`;
          if (quant.contextualization.marketCapComparison) {
            markdown += `${quant.contextualization.marketCapComparison}\n\n`;
          }
          if (quant.contextualization.peComparison) {
            markdown += `${quant.contextualization.peComparison}\n\n`;
          }
        }
        markdown += `---\n\n`;
      }

      // Logician Validation (if available)
      if (result.logicianVerdict) {
        tocSections.push('Validation & Quality Assurance');
        markdown += `## Validation & Quality Assurance\n\n`;
        const verdict = result.logicianVerdict;
        
        markdown += `### Quality Metrics\n\n`;
        markdown += `| Metric | Score |\n`;
        markdown += `|--------|-------|\n`;
        markdown += `| **Quality Score** | ${verdict.qualityScore}% |\n`;
        markdown += `| **Completeness Score** | ${verdict.completenessScore}% |\n`;
        if (verdict.validatedFacts && verdict.validatedFacts.length > 0) {
          markdown += `| **Validated Facts** | ${verdict.validatedFacts.length} |\n`;
        }
        markdown += `\n`;

        if (verdict.contradictions && verdict.contradictions.length > 0) {
          markdown += `### Contradictions Resolved\n\n`;
          verdict.contradictions.forEach((cont: any, idx: number) => {
            markdown += `#### Contradiction ${idx + 1}\n\n`;
            markdown += `- **Claim 1:** ${cont.claim1.fact}\n`;
            markdown += `- **Claim 2:** ${cont.claim2.fact}\n`;
            markdown += `- **Resolution:** ${cont.resolution}\n`;
            if (cont.resolvedFact) {
              markdown += `- **Resolved Fact:** ${cont.resolvedFact}\n`;
            }
            markdown += `\n`;
          });
        }

        if (verdict.fallacies && verdict.fallacies.length > 0) {
          markdown += `### Logical Fallacies Detected\n\n`;
          verdict.fallacies.forEach((fallacy: any, idx: number) => {
            markdown += `${idx + 1}. **${fallacy.type}**: ${fallacy.description}\n`;
          });
          markdown += `\n`;
        }
        markdown += `---\n\n`;
      }

      // Unanswered Questions
      if (report.unansweredQuestions && report.unansweredQuestions.length > 0) {
        tocSections.push('Unanswered Questions');
        markdown += `## Unanswered Questions\n\n`;
        markdown += `The following questions could not be fully answered based on available sources:\n\n`;
        report.unansweredQuestions.forEach((q: any, idx: number) => {
          markdown += `${idx + 1}. **${q.question}**\n`;
          markdown += `   *Reason:* ${q.reason}\n\n`;
        });
        markdown += `---\n\n`;
      }

      // Analogies
      if (report.analogies && report.analogies.length > 0) {
        tocSections.push('Explanatory Analogies');
        markdown += `## Explanatory Analogies\n\n`;
        report.analogies.forEach((analogy: any, idx: number) => {
          markdown += `### ${idx + 1}. ${analogy.concept}\n\n`;
          markdown += `${analogy.analogy}\n\n`;
        });
        markdown += `---\n\n`;
      }
      } // End of else block for valid thinkerReport
    }
    
    // Handle old structure or invalid thinkerReport
    if (!hasThinkerReport || !result.thinkerReport || typeof result.thinkerReport !== 'object') {
      // Fallback to old structure
      // Research Plan
      if (hasPlan) {
        markdown += `## Research Plan\n\n`;
        markdown += `**Type:** ${result.plan.queryType || 'N/A'}\n\n`;
        markdown += `**Complexity:** ${result.plan.complexity || 'N/A'}\n\n`;
        
        if (result.plan.subQuestions && result.plan.subQuestions.length > 0) {
          markdown += `### Sub-Questions\n\n`;
          result.plan.subQuestions.forEach((q: any, idx: number) => {
            markdown += `${idx + 1}. ${q.question} (Priority: ${q.priority})\n`;
          });
          markdown += `\n`;
        }
      }

      // Findings
      if (result.findings && result.findings.length > 0) {
        markdown += `## Findings\n\n`;
        result.findings.forEach((finding: any, idx: number) => {
          markdown += `### Step ${finding.step || idx + 1}: ${finding.tool}\n\n`;
          markdown += `**Query:** ${finding.query}\n\n`;
          if (finding.result) {
            markdown += `${finding.result}\n\n`;
          }
          if (finding.error) {
            markdown += `*Error: ${finding.error}*\n\n`;
          }
        });
      }

      // Analysis
      if (result.analysis) {
        markdown += `## Analysis\n\n`;
        if (result.analysis.qualityScore !== undefined) {
          markdown += `**Quality Score:** ${result.analysis.qualityScore}%\n\n`;
        }
        if (result.analysis.completenessScore !== undefined) {
          markdown += `**Completeness Score:** ${result.analysis.completenessScore}%\n\n`;
        }

        if (result.analysis.factChecks && result.analysis.factChecks.length > 0) {
          markdown += `### Fact Verification\n\n`;
          result.analysis.factChecks.forEach((check: any) => {
            markdown += `- **${check.claim}**: ${check.verdict} (Confidence: ${check.confidence}%)\n`;
          });
          markdown += `\n`;
        }
      }

      // Summary
      if (result.summary) {
        markdown += `## Summary\n\n${result.summary}\n\n`;
      }
      
      // If no content was added, add a message
      if (markdown === `# Research Report\n\n**Query:** ${session.query}\n\n**Date:** ${session.createdAt.toISOString()}\n\n**Status:** ${session.status}\n\n---\n\n`) {
        markdown += `## No Results Available\n\n`;
        markdown += `The research is still in progress or the results are not yet available. Please try again later.\n\n`;
      }
    }

    // Sources
    if (sources.length > 0) {
      tocSections.push('Sources & References');
      markdown += `## Sources & References\n\n`;
      markdown += `This report is based on ${sources.length} verified source(s).\n\n`;
      
      // Group sources by reliability
      const highReliability = sources.filter((s: any) => s.reliability === 'high');
      const mediumReliability = sources.filter((s: any) => s.reliability === 'medium');
      const lowReliability = sources.filter((s: any) => s.reliability === 'low');
      
      if (highReliability.length > 0) {
        markdown += `### High Reliability Sources\n\n`;
        highReliability.forEach((source: any, idx: number) => {
          markdown += `${idx + 1}. **[${source.title || source.url || 'Unknown'}](${source.url || '#'})**\n`;
          if (source.snippet) {
            markdown += `   ${source.snippet.substring(0, 200)}${source.snippet.length > 200 ? '...' : ''}\n`;
          }
          markdown += `\n`;
        });
      }
      
      if (mediumReliability.length > 0) {
        markdown += `### Medium Reliability Sources\n\n`;
        mediumReliability.forEach((source: any, idx: number) => {
          markdown += `${idx + 1}. [${source.title || source.url || 'Unknown'}](${source.url || '#'})\n`;
          if (source.snippet) {
            markdown += `   ${source.snippet.substring(0, 200)}${source.snippet.length > 200 ? '...' : ''}\n`;
          }
          markdown += `\n`;
        });
      }
      
      if (lowReliability.length > 0) {
        markdown += `### Low Reliability Sources\n\n`;
        markdown += `*These sources require additional verification:*\n\n`;
        lowReliability.forEach((source: any, idx: number) => {
          markdown += `${idx + 1}. [${source.title || source.url || 'Unknown'}](${source.url || '#'})\n`;
          if (source.snippet) {
            markdown += `   ${source.snippet.substring(0, 200)}${source.snippet.length > 200 ? '...' : ''}\n`;
          }
          markdown += `\n`;
        });
      }
      
      markdown += `---\n\n`;
    }

    // Appendices
    tocSections.push('Appendices');
    markdown += `## Appendices\n\n`;
    
    // Agent Versions
    if (hasThinkerReport && result.thinkerReport.metadata) {
      markdown += `### Appendix A: Agent Versions\n\n`;
      markdown += `| Agent | Version |\n`;
      markdown += `|-------|---------|\n`;
      const versions = result.thinkerReport.metadata.agentVersions || {};
      Object.entries(versions).forEach(([agent, version]: [string, any]) => {
        markdown += `| **${agent.charAt(0).toUpperCase() + agent.slice(1)}** | ${version} |\n`;
      });
      markdown += `\n`;
    }
    
    // Report Footer
    markdown += `---\n\n`;
    markdown += `**Report Generated:** ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}\n\n`;
    markdown += `**Aegis Intelligence Platform** - Professional OSINT & Research Services\n\n`;
    markdown += `*This report contains intelligence gathered through automated research systems. All sources have been verified to the best of our ability.*\n\n`;

    // Insert Table of Contents after header if we have sections
    if (tocSections.length > 0) {
      const tocMarkdown = `## Table of Contents\n\n${tocSections.map((section, idx) => `${idx + 1}. [${section}](#${section.toLowerCase().replace(/\s+/g, '-')})\n`).join('')}\n---\n\n`;
      // Insert TOC after metadata table
      const metadataEnd = markdown.indexOf('\n---\n\n');
      if (metadataEnd > 0) {
        markdown = markdown.slice(0, metadataEnd + 6) + tocMarkdown + markdown.slice(metadataEnd + 6);
      }
    }

      return markdown;
    } catch (error: any) {
      this.logger.error(`Markdown export failed for session ${sessionId}: ${error.message}`);
      this.logger.error(`Error stack: ${error.stack}`);
      throw new Error(`Markdown export failed: ${error.message}`);
    }
  }

  private detectReportType(query: string, result: any): 'deep_research' | 'image_research' | 'osint' {
    // Check if OSINT (has researchAgentResults or OSINT-specific data)
    if (result?.researchAgentResults || result?.osintPlan || 
        query.toLowerCase().includes('osint') || query.toLowerCase().includes('profile') ||
        query.toLowerCase().includes('username') || query.toLowerCase().includes('social media')) {
      return 'osint';
    }
    
    // Check if image research (has image analysis tools or vision agent results)
    if (result?.visionAnalysis || query.toLowerCase().includes('image') || 
        query.toLowerCase().includes('photo') || query.toLowerCase().includes('picture')) {
      return 'image_research';
    }
    
    // Check if OSINT (has social media, username checking, or OSINT-specific tools)
    if (query.toLowerCase().includes('username') || query.toLowerCase().includes('profile') ||
        query.toLowerCase().includes('social media') || result?.osintData) {
      return 'osint';
    }
    
    // Default to deep research
    return 'deep_research';
  }

  private buildReportHeader(session: any, reportType: string, formattedDate: string): string {
    const reportTitle = reportType === 'image_research' 
      ? 'Image Intelligence Report'
      : reportType === 'osint'
      ? 'OSINT Intelligence Report'
      : 'Deep Research Intelligence Report';
    
    let markdown = `# ${reportTitle}\n\n`;
    markdown += `**Aegis Intelligence Platform**\n\n`;
    markdown += `---\n\n`;
    
    return markdown;
  }

  private buildMetadataTable(session: any, reportType: string, content?: any): string {
    let markdown = `## Report Metadata\n\n`;
    markdown += `| Field | Value |\n`;
    markdown += `|-------|-------|\n`;
    markdown += `| **Report Type** | ${reportType === 'image_research' ? 'Image Intelligence' : reportType === 'osint' ? 'OSINT Intelligence' : 'Deep Research'} |\n`;
    markdown += `| **Query** | ${session.query} |\n`;
    markdown += `| **Report Date** | ${new Date(session.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })} |\n`;
    markdown += `| **Status** | ${session.status} |\n`;
    
    // OSINT-specific metadata
    if (reportType === 'osint' && session.type) {
      markdown += `| **Session Type** | ${session.type} |\n`;
    }
    
    if (session.qualityScore !== undefined) {
      markdown += `| **Quality Score** | ${session.qualityScore}% |\n`;
    }
    if (session.completenessScore !== undefined) {
      markdown += `| **Completeness Score** | ${session.completenessScore}% |\n`;
    }
    if (session.iterationCount !== undefined) {
      markdown += `| **Iterations** | ${session.iterationCount} |\n`;
    }
    
    // OSINT-specific content metadata
    if (reportType === 'osint' && content) {
      if (content.researchAgentResults) {
        const agentResults = content.researchAgentResults;
        if (agentResults.finalQuality !== undefined) {
          markdown += `| **Final Quality Score** | ${agentResults.finalQuality}% |\n`;
        }
        if (agentResults.finalCompleteness !== undefined) {
          markdown += `| **Final Completeness Score** | ${agentResults.finalCompleteness}% |\n`;
        }
        if (agentResults.iterations !== undefined) {
          markdown += `| **Research Iterations** | ${agentResults.iterations} |\n`;
        }
        if (agentResults.accuracyScore) {
          markdown += `| **Accuracy Score** | ${agentResults.accuracyScore.score || 0}% |\n`;
        }
      }
      if (content.sources && Array.isArray(content.sources)) {
        markdown += `| **Total Sources** | ${content.sources.length} |\n`;
      }
    }
    
    markdown += `\n`;
    return markdown;
  }

  private formatNumber(num: number | string | null | undefined): string {
    if (num === null || num === undefined) return 'N/A';
    
    // Convert to number if it's a string
    const numValue = typeof num === 'string' ? parseFloat(num) : num;
    
    // Check if conversion resulted in a valid number
    if (isNaN(numValue) || !isFinite(numValue)) return 'N/A';
    
    if (numValue >= 1e12) return `${(numValue / 1e12).toFixed(2)}T`;
    if (numValue >= 1e9) return `${(numValue / 1e9).toFixed(2)}B`;
    if (numValue >= 1e6) return `${(numValue / 1e6).toFixed(2)}M`;
    if (numValue >= 1e3) return `${(numValue / 1e3).toFixed(2)}K`;
    return numValue.toFixed(2);
  }

  async exportPdf(sessionId: string): Promise<Buffer> {
    try {
      this.logger.log(`Exporting PDF for session: ${sessionId}`);
      
      if (!this.puppeteer) {
        this.logger.error('PuppeteerClusterService is not available');
        throw new Error('PDF export service is not available. Please check server configuration.');
      }

      const markdown = await this.exportMarkdown(sessionId);
      this.logger.log(`Markdown generated (${markdown.length} chars), converting to HTML...`);
      
      // Convert markdown to HTML
      const html = this.markdownToHtml(markdown);
      this.logger.log(`HTML generated (${html.length} chars), generating PDF...`);


      // Use Puppeteer to generate PDF
      const pdfBuffer = await this.puppeteer.execute(async (page) => {
        await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
        const pdf = await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: {
            top: '20mm',
            right: '15mm',
            bottom: '20mm',
            left: '15mm',
          },
        });
        return Buffer.from(pdf);
      });


      this.logger.log(`PDF generated successfully (${pdfBuffer.length} bytes)`);
      return pdfBuffer;
    } catch (error: any) {
      this.logger.error(`PDF export failed for session ${sessionId}: ${error.message}`);
      this.logger.error(`Error stack: ${error.stack}`);
      throw new Error(`PDF export failed: ${error.message}`);
    }
  }

  private markdownToHtml(markdown: string): string {
    const css = this.getProfessionalReportCSS();
    
    let html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Intelligence Report</title>
  <style>
    ${css}
  </style>
</head>
<body>
  <div class="report-container">
`;

    // Enhanced markdown to HTML conversion with proper structure
    let processedMarkdown = markdown;
    
    // Convert headers
    processedMarkdown = processedMarkdown.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    processedMarkdown = processedMarkdown.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    processedMarkdown = processedMarkdown.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    processedMarkdown = processedMarkdown.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
    
    // Convert tables - improved logic
    const lines = processedMarkdown.split('\n');
    let inTable = false;
    let tableRows: string[] = [];
    let processedLines: string[] = [];
    let isHeaderRow = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      // Check if this is a table row
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        // Check if it's a separator row
        if (trimmed.match(/^\|[\s\-:]+\|$/)) {
          isHeaderRow = true;
          continue; // Skip separator
        }
        
        if (!inTable) {
          inTable = true;
          tableRows = [];
          isHeaderRow = false;
        }
        
        const cells = trimmed.split('|').map(c => c.trim()).filter(c => c);
        if (cells.length > 0) {
          const rowCells = cells.map((cell: string) => {
            const cellContent = cell.replace(/\*\*/g, '');
            const isBold = cell.includes('**');
            return isHeaderRow || isBold ? `<th>${cellContent}</th>` : `<td>${cellContent}</td>`;
          }).join('');
          tableRows.push(`<tr>${rowCells}</tr>`);
        }
      } else {
        // Not a table row
        if (inTable && tableRows.length > 0) {
          // Close the table
          processedLines.push(`<table class="report-table">${tableRows.join('')}</table>`);
          tableRows = [];
          inTable = false;
          isHeaderRow = false;
        }
        processedLines.push(line);
      }
    }
    
    // Close table if still open
    if (inTable && tableRows.length > 0) {
      processedLines.push(`<table class="report-table">${tableRows.join('')}</table>`);
    }
    
    processedMarkdown = processedLines.join('\n');
    
    // Convert links
    processedMarkdown = processedMarkdown.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    
    // Convert bold and italic
    processedMarkdown = processedMarkdown.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    processedMarkdown = processedMarkdown.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Convert horizontal rules
    processedMarkdown = processedMarkdown.replace(/^---$/gim, '<hr class="section-divider">');
    
    // Convert lists
    processedMarkdown = processedMarkdown.replace(/^\d+\.\s+(.*)$/gim, '<li>$1</li>');
    processedMarkdown = processedMarkdown.replace(/^-\s+(.*)$/gim, '<li>$1</li>');
    
    // Wrap consecutive list items in ul/ol
    processedMarkdown = processedMarkdown.replace(/(<li>.*?<\/li>(?:\s*<li>.*?<\/li>)*)/gs, (match) => {
      // Check if it's a numbered list (look for numbers in content)
      const isOrdered = /^\d+\./.test(match);
      return isOrdered ? `<ol>${match}</ol>` : `<ul>${match}</ul>`;
    });
    
    // Convert paragraphs (text blocks between headers/lists)
    processedMarkdown = processedMarkdown.split('\n\n').map(block => {
      const trimmed = block.trim();
      if (!trimmed || trimmed.startsWith('<') || trimmed.match(/^#+\s/)) {
        return trimmed;
      }
      return `<p>${trimmed}</p>`;
    }).join('\n\n');
    
    html += processedMarkdown;
    
    html += `
  </div>
</body>
</html>
`;

    return html;
  }

  private getProfessionalReportCSS(): string {
    return `
      @page {
        size: A4;
        margin: 20mm 15mm;
        @bottom-center {
          content: "Page " counter(page) " of " counter(pages);
          font-size: 10pt;
          color: #666;
        }
      }
      
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      
      body {
        font-family: 'Georgia', 'Times New Roman', serif;
        line-height: 1.7;
        color: #1a1a1a;
        background: #ffffff;
        font-size: 11pt;
      }
      
      .report-container {
        max-width: 100%;
        margin: 0 auto;
        padding: 0;
      }
      
      /* Header Styling */
      h1 {
        font-family: 'Arial', 'Helvetica', sans-serif;
        font-size: 24pt;
        font-weight: 700;
        color: #0a1929;
        border-bottom: 3px solid #1e3a5f;
        padding-bottom: 12px;
        margin-bottom: 20px;
        margin-top: 0;
        text-transform: uppercase;
        letter-spacing: 1px;
      }
      
      h2 {
        font-family: 'Arial', 'Helvetica', sans-serif;
        font-size: 18pt;
        font-weight: 600;
        color: #1e3a5f;
        margin-top: 30px;
        margin-bottom: 15px;
        padding-bottom: 8px;
        border-bottom: 2px solid #3d5a80;
        page-break-after: avoid;
      }
      
      h3 {
        font-family: 'Arial', 'Helvetica', sans-serif;
        font-size: 14pt;
        font-weight: 600;
        color: #2c4a6b;
        margin-top: 20px;
        margin-bottom: 12px;
        page-break-after: avoid;
      }
      
      h4 {
        font-family: 'Arial', 'Helvetica', sans-serif;
        font-size: 12pt;
        font-weight: 600;
        color: #3d5a80;
        margin-top: 15px;
        margin-bottom: 10px;
      }
      
      /* Paragraphs */
      p {
        margin-bottom: 12px;
        text-align: justify;
        orphans: 3;
        widows: 3;
      }
      
      /* Tables */
      .report-table {
        width: 100%;
        border-collapse: collapse;
        margin: 20px 0;
        page-break-inside: avoid;
        font-size: 10pt;
      }
      
      .report-table th {
        background-color: #1e3a5f;
        color: #ffffff;
        font-weight: 600;
        padding: 10px 12px;
        text-align: left;
        border: 1px solid #0a1929;
        font-family: 'Arial', 'Helvetica', sans-serif;
      }
      
      .report-table td {
        padding: 10px 12px;
        border: 1px solid #d0d0d0;
        background-color: #ffffff;
      }
      
      .report-table tr:nth-child(even) td {
        background-color: #f5f7fa;
      }
      
      .report-table tr:hover td {
        background-color: #e8ecf1;
      }
      
      /* Lists */
      ul, ol {
        margin-left: 25px;
        margin-bottom: 15px;
        padding-left: 15px;
      }
      
      li {
        margin-bottom: 8px;
        line-height: 1.6;
      }
      
      /* Links */
      a {
        color: #1e3a5f;
        text-decoration: none;
        border-bottom: 1px dotted #3d5a80;
      }
      
      a:hover {
        color: #0a1929;
        border-bottom: 1px solid #1e3a5f;
      }
      
      /* Horizontal Rules */
      .section-divider {
        border: none;
        border-top: 2px solid #3d5a80;
        margin: 30px 0;
        page-break-after: avoid;
      }
      
      hr {
        border: none;
        border-top: 1px solid #d0d0d0;
        margin: 20px 0;
      }
      
      /* Code and Pre */
      code {
        background-color: #f5f7fa;
        padding: 2px 6px;
        border-radius: 3px;
        font-family: 'Courier New', monospace;
        font-size: 10pt;
        color: #c7254e;
        border: 1px solid #e1e8ed;
      }
      
      pre {
        background-color: #f5f7fa;
        padding: 15px;
        border-radius: 5px;
        overflow-x: auto;
        border: 1px solid #e1e8ed;
        margin: 15px 0;
        font-family: 'Courier New', monospace;
        font-size: 10pt;
        page-break-inside: avoid;
      }
      
      /* Blockquotes */
      blockquote {
        border-left: 4px solid #3d5a80;
        padding-left: 20px;
        margin-left: 0;
        margin: 20px 0;
        color: #4a5568;
        font-style: italic;
        background-color: #f8f9fa;
        padding: 15px 20px;
        page-break-inside: avoid;
      }
      
      /* Strong and Emphasis */
      strong {
        font-weight: 700;
        color: #0a1929;
      }
      
      em {
        font-style: italic;
        color: #4a5568;
      }
      
      /* Page Breaks */
      h1, h2, h3 {
        page-break-after: avoid;
      }
      
      table, pre, blockquote {
        page-break-inside: avoid;
      }
      
      /* Print Optimizations */
      @media print {
        body {
          print-color-adjust: exact;
          -webkit-print-color-adjust: exact;
        }
        
        .report-container {
          padding: 0;
        }
        
        a[href^="http"]:after {
          content: " (" attr(href) ")";
          font-size: 9pt;
          color: #666;
        }
      }
      
      /* Cover Page Styling (if needed) */
      .cover-page {
        page-break-after: always;
        text-align: center;
        padding-top: 100px;
      }
      
      .cover-page h1 {
        border: none;
        margin-bottom: 30px;
      }
    `;
  }

  /**
   * Export OSINT report as Markdown from a search session
   * Uses the same professional structure as deep research reports
   */
  async exportOSINTMarkdown(sessionId: string): Promise<string> {
    this.logger.log(`Exporting OSINT markdown for search session: ${sessionId}`);

    const session = await this.prisma.searchSession.findUnique({
      where: { id: sessionId },
      include: { results: true },
    });

    if (!session) {
      throw new Error('Search session not found');
    }

    // Find dossier if it exists
    const dossier = await this.prisma.dossier.findFirst({
      where: { subject: session.query, userId: session.userId },
      orderBy: { createdAt: 'desc' },
    });

    const content = dossier?.content as any || {};
    const reportDate = new Date(session.createdAt);
    const formattedDate = reportDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    // Build professional OSINT report using same structure as deep research
    let markdown = this.buildReportHeader(session, 'osint', formattedDate);
    markdown += this.buildMetadataTable(session, 'osint', content);
    markdown += `\n---\n\n`;

    // Table of contents placeholder
    const tocSections: string[] = [];

    // Executive Summary
    if (content.summary || content.executiveSummary) {
      tocSections.push('Executive Summary');
      markdown += `## Executive Summary\n\n`;
      markdown += `${content.summary || content.executiveSummary || 'No executive summary available.'}\n\n`;
      markdown += `---\n\n`;
    }

    // Detailed Findings - Structure OSINT findings similar to deep research
    const hasDetailedFindings = content.findings || content.researchAgentResults?.scoutFindings || session.results?.length > 0;
    if (hasDetailedFindings) {
      tocSections.push('Detailed Findings');
      markdown += `## Detailed Findings\n\n`;

      // Use research agent findings if available
      if (content.researchAgentResults?.scoutFindings && Array.isArray(content.researchAgentResults.scoutFindings)) {
        content.researchAgentResults.scoutFindings.forEach((finding: any, idx: number) => {
          markdown += `### ${idx + 1}. ${finding.title || finding.query || `Finding ${idx + 1}`}\n\n`;
          if (finding.summary) {
            markdown += `${finding.summary}\n\n`;
          }
          if (finding.content) {
            markdown += `${finding.content}\n\n`;
          }
          if (finding.sources && finding.sources.length > 0) {
            markdown += `**Source References:**\n\n`;
            finding.sources.forEach((source: any, srcIdx: number) => {
              markdown += `${srcIdx + 1}. [${source.title || source.url || 'Unknown'}](${source.url || '#'})`;
              if (source.reliability) {
                markdown += ` *(Reliability: ${source.reliability})*`;
              }
              markdown += `\n`;
            });
            markdown += `\n`;
          }
          markdown += `---\n\n`;
        });
      } else if (content.findings && Array.isArray(content.findings)) {
        content.findings.forEach((finding: any, idx: number) => {
          markdown += `### ${idx + 1}. ${finding.title || finding.type || `Finding ${idx + 1}`}\n\n`;
          if (finding.description) {
            markdown += `${finding.description}\n\n`;
          }
          if (finding.content) {
            markdown += `${finding.content}\n\n`;
          }
          markdown += `---\n\n`;
        });
      } else if (session.results && session.results.length > 0) {
        session.results.slice(0, 20).forEach((result: any, idx: number) => {
          markdown += `### ${idx + 1}. ${result.platform || 'Platform'} - ${result.username || 'Profile'}\n\n`;
          if (result.data?.bio) {
            markdown += `**Bio:** ${result.data.bio}\n\n`;
          }
          if (result.url) {
            markdown += `**URL:** [${result.url}](${result.url})\n\n`;
          }
          markdown += `---\n\n`;
        });
      }
    }

    // Research Methodology (OSINT Plan)
    if (content.researchAgentResults?.osintPlan || content.osintPlan) {
      tocSections.push('Research Methodology');
      markdown += `## Research Methodology\n\n`;
      const plan = content.researchAgentResults?.osintPlan || content.osintPlan;
      
      markdown += `### Strategy Overview\n\n`;
      markdown += `| Aspect | Details |\n`;
      markdown += `|--------|---------|\n`;
      if (plan.queryType) {
        markdown += `| **Query Type** | ${plan.queryType} |\n`;
      }
      if (plan.complexity) {
        markdown += `| **Complexity** | ${plan.complexity} |\n`;
      }
      if (plan.platforms && plan.platforms.length > 0) {
        markdown += `| **Target Platforms** | ${plan.platforms.join(', ')} |\n`;
      }
      markdown += `\n`;

      if (plan.researchThemes && plan.researchThemes.length > 0) {
        markdown += `### Research Themes\n\n`;
        plan.researchThemes.forEach((theme: any, idx: number) => {
          markdown += `#### Theme ${idx + 1}: ${theme.theme || theme.name} (Priority: ${theme.priority || 'medium'})\n\n`;
          if (theme.subQueries && theme.subQueries.length > 0) {
            markdown += `**Sub-queries:**\n\n`;
            theme.subQueries.forEach((sq: string, sqIdx: number) => {
              markdown += `${sqIdx + 1}. ${sq}\n`;
            });
            markdown += `\n`;
          }
        });
        markdown += `---\n\n`;
      }
    }

    // Profile Verification
    if (content.researchAgentResults?.profileVerification) {
      tocSections.push('Profile Verification');
      markdown += `## Profile Verification\n\n`;
      const verification = content.researchAgentResults.profileVerification;
      
      markdown += `### Authenticity Assessment\n\n`;
      markdown += `| Metric | Value |\n`;
      markdown += `|--------|-------|\n`;
      markdown += `| **Authenticity Score** | ${verification.authenticityScore || 0}/100 |\n`;
      markdown += `| **Confidence Level** | ${verification.confidenceLevel || 'medium'} |\n`;
      markdown += `| **Verification Status** | ${verification.isAuthentic ? 'Verified' : 'Unverified'} |\n`;
      markdown += `\n`;

      if (verification.redFlags && verification.redFlags.length > 0) {
        markdown += `### Red Flags Detected\n\n`;
        verification.redFlags.forEach((flag: any, idx: number) => {
          markdown += `${idx + 1}. **${flag.type || 'Issue'}**: ${flag.description || flag.message}\n`;
          if (flag.severity) {
            markdown += `   *Severity: ${flag.severity}*\n`;
          }
          markdown += `\n`;
        });
      }

      if (verification.consistencyChecks && verification.consistencyChecks.length > 0) {
        markdown += `### Cross-Platform Consistency\n\n`;
        verification.consistencyChecks.forEach((check: any, idx: number) => {
          markdown += `${idx + 1}. **${check.platform || 'Platform'}**: ${check.status || 'Unknown'}\n`;
          if (check.details) {
            markdown += `   ${check.details}\n`;
          }
          markdown += `\n`;
        });
      }
      markdown += `---\n\n`;
    }

    // Validation & Quality Assurance (same structure as deep research)
    if (content.researchAgentResults?.logicianVerdict || content.researchAgentResults?.accuracyScore) {
      tocSections.push('Validation & Quality Assurance');
      markdown += `## Validation & Quality Assurance\n\n`;
      const agentResults = content.researchAgentResults;
      
      markdown += `### Quality Metrics\n\n`;
      markdown += `| Metric | Score |\n`;
      markdown += `|--------|-------|\n`;
      
      if (agentResults.accuracyScore) {
        markdown += `| **Accuracy Score** | ${agentResults.accuracyScore.score || 0}% |\n`;
        markdown += `| **Confidence Level** | ${agentResults.accuracyScore.confidenceLevel || 'medium'} |\n`;
      }
      
      if (agentResults.logicianVerdict) {
        const verdict = agentResults.logicianVerdict;
        markdown += `| **Quality Score** | ${verdict.qualityScore || 0}% |\n`;
        markdown += `| **Completeness Score** | ${verdict.completenessScore || 0}% |\n`;
        if (verdict.validatedFacts && Array.isArray(verdict.validatedFacts)) {
          markdown += `| **Validated Facts** | ${verdict.validatedFacts.length} |\n`;
        }
      }
      markdown += `\n`;

      // Contradictions
      if (agentResults.logicianVerdict?.contradictions && agentResults.logicianVerdict.contradictions.length > 0) {
        markdown += `### Contradictions Resolved\n\n`;
        agentResults.logicianVerdict.contradictions.forEach((cont: any, idx: number) => {
          markdown += `#### Contradiction ${idx + 1}\n\n`;
          markdown += `- **Claim 1:** ${cont.claim1?.fact || cont.claim1 || 'N/A'}\n`;
          markdown += `- **Claim 2:** ${cont.claim2?.fact || cont.claim2 || 'N/A'}\n`;
          if (cont.resolution) {
            markdown += `- **Resolution:** ${cont.resolution}\n`;
          }
          if (cont.resolvedFact) {
            markdown += `- **Resolved Fact:** ${cont.resolvedFact}\n`;
          }
          markdown += `\n`;
        });
      }

      // Fact Check Results
      if (agentResults.factCheckResults && agentResults.factCheckResults.length > 0) {
        markdown += `### Fact Verification\n\n`;
        agentResults.factCheckResults.forEach((result: any, idx: number) => {
          markdown += `${idx + 1}. **${result.claim || 'Claim'}**: ${result.verdict || 'Unknown'} (Confidence: ${result.confidence || 0}%)\n`;
          if (result.sources && result.sources.length > 0) {
            markdown += `   *Sources: ${result.sources.map((s: any) => s.url || s).join(', ')}*\n`;
          }
          markdown += `\n`;
        });
      }

      // Logical Fallacies
      if (agentResults.logicianVerdict?.fallacies && agentResults.logicianVerdict.fallacies.length > 0) {
        markdown += `### Logical Fallacies Detected\n\n`;
        agentResults.logicianVerdict.fallacies.forEach((fallacy: any, idx: number) => {
          markdown += `${idx + 1}. **${fallacy.type || 'Fallacy'}**: ${fallacy.description || fallacy.message}\n`;
        });
        markdown += `\n`;
      }
      markdown += `---\n\n`;
    }

    // Cross-Platform Analysis
    if (content.sources && content.sources.length > 0) {
      tocSections.push('Cross-Platform Analysis');
      markdown += `## Cross-Platform Analysis\n\n`;
      const platforms = new Set(content.sources.map((s: any) => s.source || s.platform).filter(Boolean));
      
      if (platforms.size > 0) {
        platforms.forEach((platform: string) => {
          const platformSources = content.sources.filter((s: any) => (s.source || s.platform) === platform);
          markdown += `### ${platform}\n\n`;
          markdown += `- **Sources Found**: ${platformSources.length}\n`;
          if (platformSources[0]?.url) {
            markdown += `- **Primary URL**: [${platformSources[0].url}](${platformSources[0].url})\n`;
          }
          markdown += `\n`;
        });
        markdown += `---\n\n`;
      }
    }

    // Risk Assessment
    if (content.riskAssessment) {
      tocSections.push('Risk Assessment');
      markdown += `## Risk Assessment\n\n`;
      const risk = content.riskAssessment;
      
      markdown += `| Metric | Value |\n`;
      markdown += `|--------|-------|\n`;
      markdown += `| **Risk Level** | ${risk.riskLevel || 'UNKNOWN'} |\n`;
      if (risk.riskScore !== undefined) {
        markdown += `| **Risk Score** | ${risk.riskScore}/100 |\n`;
      }
      markdown += `\n`;

      if (risk.factors && risk.factors.length > 0) {
        markdown += `### Risk Factors\n\n`;
        risk.factors.forEach((factor: any, idx: number) => {
          const factorText = typeof factor === 'string' ? factor : factor.description || factor.factor;
          const severity = typeof factor === 'object' ? factor.severity : undefined;
          markdown += `${idx + 1}. ${factorText}`;
          if (severity) {
            markdown += ` *(Severity: ${severity})*`;
          }
          markdown += `\n`;
        });
        markdown += `\n`;
      }
      markdown += `---\n\n`;
    }

    // Timeline of Activities
    if (dossier?.timeline) {
      tocSections.push('Timeline of Activities');
      markdown += `## Timeline of Activities\n\n`;
      const timeline = dossier.timeline as any[];
      if (Array.isArray(timeline) && timeline.length > 0) {
        timeline.slice(0, 30).forEach((event: any, idx: number) => {
          markdown += `${idx + 1}. **${event.date || event.timestamp || 'Unknown Date'}**: ${event.description || event.text || event.content || 'N/A'}\n`;
          if (event.platform) {
            markdown += `   *Platform: ${event.platform}*\n`;
          }
          markdown += `\n`;
        });
        markdown += `---\n\n`;
      }
    }

    // Relationship Mapping
    if (content.relationships && content.relationships.length > 0) {
      tocSections.push('Relationship Mapping');
      markdown += `## Relationship Mapping\n\n`;
      content.relationships.forEach((rel: any, idx: number) => {
        markdown += `${idx + 1}. **${rel.type || 'Connection'}**: ${rel.target || rel.name || 'Unknown'}\n`;
        if (rel.platform) {
          markdown += `   - Platform: ${rel.platform}\n`;
        }
        if (rel.strength) {
          markdown += `   - Strength: ${rel.strength}\n`;
        }
        if (rel.description) {
          markdown += `   - Description: ${rel.description}\n`;
        }
        markdown += `\n`;
      });
      markdown += `---\n\n`;
    }

    // Sources & References (same format as deep research)
    const sources = content.sources || content.sourceCitations || [];
    if (sources.length > 0) {
      tocSections.push('Sources & References');
      markdown += `## Sources & References\n\n`;
      markdown += `This report is based on ${sources.length} verified source(s).\n\n`;
      
      // Group sources by reliability
      const highReliability = sources.filter((s: any) => (s.reliability || s.reliabilityLevel) === 'high');
      const mediumReliability = sources.filter((s: any) => (s.reliability || s.reliabilityLevel) === 'medium');
      const lowReliability = sources.filter((s: any) => (s.reliability || s.reliabilityLevel) === 'low' || !s.reliability);
      
      if (highReliability.length > 0) {
        markdown += `### High Reliability Sources\n\n`;
        highReliability.forEach((source: any, idx: number) => {
          const title = source.title || source.url || 'Unknown';
          const url = source.url || '#';
          markdown += `${idx + 1}. **[${title}](${url})**\n`;
          if (source.snippet || source.excerpt) {
            const snippet = source.snippet || source.excerpt;
            markdown += `   ${snippet.substring(0, 200)}${snippet.length > 200 ? '...' : ''}\n`;
          }
          if (source.capturedAt) {
            markdown += `   *Captured: ${new Date(source.capturedAt).toLocaleDateString()}*\n`;
          }
          markdown += `\n`;
        });
      }
      
      if (mediumReliability.length > 0) {
        markdown += `### Medium Reliability Sources\n\n`;
        mediumReliability.forEach((source: any, idx: number) => {
          const title = source.title || source.url || 'Unknown';
          const url = source.url || '#';
          markdown += `${idx + 1}. [${title}](${url})\n`;
          if (source.snippet || source.excerpt) {
            const snippet = source.snippet || source.excerpt;
            markdown += `   ${snippet.substring(0, 200)}${snippet.length > 200 ? '...' : ''}\n`;
          }
          if (source.capturedAt) {
            markdown += `   *Captured: ${new Date(source.capturedAt).toLocaleDateString()}*\n`;
          }
          markdown += `\n`;
        });
      }
      
      if (lowReliability.length > 0) {
        markdown += `### Low Reliability Sources\n\n`;
        markdown += `*These sources require additional verification:*\n\n`;
        lowReliability.forEach((source: any, idx: number) => {
          const title = source.title || source.url || 'Unknown';
          const url = source.url || '#';
          markdown += `${idx + 1}. [${title}](${url})\n`;
          if (source.snippet || source.excerpt) {
            const snippet = source.snippet || source.excerpt;
            markdown += `   ${snippet.substring(0, 200)}${snippet.length > 200 ? '...' : ''}\n`;
          }
          if (source.capturedAt) {
            markdown += `   *Captured: ${new Date(source.capturedAt).toLocaleDateString()}*\n`;
          }
          markdown += `\n`;
        });
      }
      
      markdown += `---\n\n`;
    }

    // Appendices (same format as deep research)
    tocSections.push('Appendices');
    markdown += `## Appendices\n\n`;
    
    // Agent Versions (if available)
    if (content.researchAgentResults?.metadata?.agentVersions) {
      markdown += `### Appendix A: Agent Versions\n\n`;
      markdown += `| Agent | Version |\n`;
      markdown += `|-------|---------|\n`;
      const versions = content.researchAgentResults.metadata.agentVersions;
      Object.entries(versions).forEach(([agent, version]: [string, any]) => {
        markdown += `| **${agent.charAt(0).toUpperCase() + agent.slice(1)}** | ${version} |\n`;
      });
      markdown += `\n`;
    }
    
    // Report Metadata
    markdown += `### Appendix B: Report Metadata\n\n`;
    markdown += `| Field | Value |\n`;
    markdown += `|-------|-------|\n`;
    markdown += `| **Report Type** | OSINT Intelligence Report |\n`;
    markdown += `| **Session ID** | ${sessionId} |\n`;
    markdown += `| **Generated** | ${formattedDate} |\n`;
    if (content.researchAgentResults) {
      markdown += `| **Research Iterations** | ${content.researchAgentResults.iterations || 0} |\n`;
      if (content.researchAgentResults.finalQuality !== undefined) {
        markdown += `| **Final Quality Score** | ${content.researchAgentResults.finalQuality}% |\n`;
      }
      if (content.researchAgentResults.finalCompleteness !== undefined) {
        markdown += `| **Final Completeness Score** | ${content.researchAgentResults.finalCompleteness}% |\n`;
      }
    }
    markdown += `\n`;

    // Report Footer (same as deep research)
    markdown += `---\n\n`;
    markdown += `**Report Generated:** ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}\n\n`;
    markdown += `**Aegis Intelligence Platform** - Professional OSINT & Research Services\n\n`;
    markdown += `*This report contains intelligence gathered through automated research systems. All sources have been verified to the best of our ability.*\n\n`;

    // Insert Table of Contents after metadata if we have sections
    if (tocSections.length > 0) {
      const tocMarkdown = `## Table of Contents\n\n${tocSections.map((section, idx) => `${idx + 1}. [${section}](#${section.toLowerCase().replace(/\s+/g, '-')})\n`).join('')}\n---\n\n`;
      // Insert TOC after metadata table
      const metadataEnd = markdown.indexOf('\n---\n\n');
      if (metadataEnd > 0) {
        markdown = markdown.slice(0, metadataEnd + 6) + tocMarkdown + markdown.slice(metadataEnd + 6);
      }
    }

    return markdown;
  }

  /**
   * Export OSINT report as PDF from a search session
   */
  async exportOSINTPdf(sessionId: string): Promise<Buffer> {
    try {
      this.logger.log(`Exporting OSINT PDF for search session: ${sessionId}`);

      if (!this.puppeteer) {
        this.logger.error('PuppeteerClusterService is not available');
        throw new Error('PDF export service is not available. Please check server configuration.');
      }

      const markdown = await this.exportOSINTMarkdown(sessionId);
      this.logger.log(`OSINT Markdown generated (${markdown.length} chars), converting to HTML...`);
      
      const html = this.markdownToHtml(markdown);
      this.logger.log(`HTML generated (${html.length} chars), generating PDF...`);

      const pdfBuffer = await this.puppeteer.execute(async (page) => {
        await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
        const pdf = await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: {
            top: '20mm',
            right: '15mm',
            bottom: '20mm',
            left: '15mm',
          },
        });
        return Buffer.from(pdf);
      });

      this.logger.log(`OSINT PDF generated successfully (${pdfBuffer.length} bytes)`);
      return pdfBuffer;
    } catch (error: any) {
      this.logger.error(`OSINT PDF export failed for session ${sessionId}: ${error.message}`);
      this.logger.error(`Error stack: ${error.stack}`);
      throw new Error(`OSINT PDF export failed: ${error.message}`);
    }
  }

  /**
   * Export reverse lookup result as Markdown
   */
  async exportReverseLookupMarkdown(result: any, lookupType: string): Promise<string> {
    this.logger.log(`Exporting reverse lookup markdown for ${lookupType} lookup`);

    const reportDate = new Date(result.timestamp || new Date());
    const formattedDate = reportDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    let markdown = `# Reverse Lookup Intelligence Report\n\n`;
    markdown += `**Report Type:** ${lookupType.toUpperCase()} Lookup\n`;
    markdown += `**Generated:** ${formattedDate}\n`;
    markdown += `**Confidence Score:** ${result.confidence || 0}%\n\n`;
    markdown += `---\n\n`;

    // Person Information
    if (result.personInfo || (result.identifiedPersons && result.identifiedPersons.length > 0)) {
      markdown += `## Person Information\n\n`;
      if (result.personInfo) {
        markdown += `### Primary Person\n\n`;
        markdown += `- **Full Name:** ${result.personInfo.fullName || 'Unknown'}\n`;
        if (result.personInfo.firstName) markdown += `- **First Name:** ${result.personInfo.firstName}\n`;
        if (result.personInfo.lastName) markdown += `- **Last Name:** ${result.personInfo.lastName}\n`;
        if (result.personInfo.age) markdown += `- **Age:** ${result.personInfo.age}\n`;
        if (result.personInfo.profession) markdown += `- **Profession:** ${result.personInfo.profession}\n`;
        if (result.personInfo.company) markdown += `- **Company:** ${result.personInfo.company}\n`;
        markdown += `\n`;
      }
      if (result.identifiedPersons && result.identifiedPersons.length > 0) {
        markdown += `### Identified Persons\n\n`;
        result.identifiedPersons.forEach((person: any, idx: number) => {
          markdown += `#### Person ${idx + 1}\n\n`;
          if (person.personInfo) {
            markdown += `- **Name:** ${person.personInfo.fullName || 'Unknown'}\n`;
            if (person.faceMatch) {
              markdown += `- **Face Match Confidence:** ${person.faceMatch.confidence}%\n`;
            }
          }
          markdown += `\n`;
        });
      }
    }

    // Addresses
    if (result.locationHistory || result.associatedAddresses || result.address) {
      markdown += `## Addresses & Locations\n\n`;
      if (result.locationHistory && result.locationHistory.length > 0) {
        markdown += `### Location History\n\n`;
        result.locationHistory.forEach((loc: any, idx: number) => {
          markdown += `${idx + 1}. ${loc.address?.fullAddress || JSON.stringify(loc.address)}\n`;
          if (loc.dateRange) {
            markdown += `   - Period: ${loc.dateRange.start} - ${loc.dateRange.end || 'Present'}\n`;
          }
          markdown += `\n`;
        });
      }
      if (result.associatedAddresses && result.associatedAddresses.length > 0) {
        markdown += `### Associated Addresses\n\n`;
        result.associatedAddresses.forEach((addr: any, idx: number) => {
          markdown += `${idx + 1}. ${addr.fullAddress || JSON.stringify(addr)}\n`;
        });
        markdown += `\n`;
      }
      if (result.address) {
        markdown += `### Address\n\n`;
        markdown += `${result.address.fullAddress || JSON.stringify(result.address)}\n\n`;
      }
    }

    // Relationships
    if (result.relationships && result.relationships.length > 0) {
      markdown += `## Relationships\n\n`;
      result.relationships.forEach((rel: any, idx: number) => {
        markdown += `${idx + 1}. **${rel.name}** (${rel.type})\n`;
        if (rel.relationship) markdown += `   - Relationship: ${rel.relationship}\n`;
        markdown += `   - Confidence: ${rel.confidence}%\n\n`;
      });
    }

    // Social Media Profiles
    if (result.socialProfiles && result.socialProfiles.length > 0) {
      markdown += `## Social Media Profiles\n\n`;
      result.socialProfiles.forEach((profile: any, idx: number) => {
        markdown += `${idx + 1}. **${profile.platform}**\n`;
        if (profile.username) markdown += `   - Username: @${profile.username}\n`;
        markdown += `   - URL: ${profile.url}\n`;
        if (profile.verified) markdown += `   - Verified: Yes\n`;
        markdown += `\n`;
      });
    }

    // Web Activity
    if (result.webActivity && result.webActivity.length > 0) {
      markdown += `## Web Activity & Mentions\n\n`;
      result.webActivity.forEach((activity: any, idx: number) => {
        markdown += `${idx + 1}. **${activity.title}** (${activity.type})\n`;
        markdown += `   - URL: ${activity.url}\n`;
        if (activity.snippet) markdown += `   - ${activity.snippet}\n`;
        markdown += `\n`;
      });
    }

    // Vehicle Information (for VIN lookups)
    if (result.vehicleInfo) {
      markdown += `## Vehicle Information\n\n`;
      if (result.vehicleInfo.make) markdown += `- **Make:** ${result.vehicleInfo.make}\n`;
      if (result.vehicleInfo.model) markdown += `- **Model:** ${result.vehicleInfo.model}\n`;
      if (result.vehicleInfo.year) markdown += `- **Year:** ${result.vehicleInfo.year}\n`;
      if (result.vehicleInfo.color) markdown += `- **Color:** ${result.vehicleInfo.color}\n`;
      if (result.vehicleInfo.vin) markdown += `- **VIN:** ${result.vehicleInfo.vin}\n`;
      markdown += `\n`;
    }

    // Sources
    if (result.sources && result.sources.length > 0) {
      markdown += `## Sources\n\n`;
      result.sources.forEach((source: string, idx: number) => {
        markdown += `${idx + 1}. ${source}\n`;
      });
      markdown += `\n`;
    }

    markdown += `---\n\n`;
    markdown += `*Report generated by AEGIS Intelligence Platform*\n`;

    return markdown;
  }

  /**
   * Export reverse lookup result as PDF
   */
  async exportReverseLookupPdf(result: any, lookupType: string): Promise<Buffer> {
    try {
      this.logger.log(`Exporting reverse lookup PDF for ${lookupType} lookup`);

      if (!this.puppeteer) {
        this.logger.error('PuppeteerClusterService is not available');
        throw new Error('PDF export service is not available');
      }

      const markdown = await this.exportReverseLookupMarkdown(result, lookupType);
      const html = this.markdownToHtml(markdown);

      const pdfBuffer = await this.puppeteer.execute(async (page) => {
        await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
        const pdf = await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: {
            top: '20mm',
            right: '15mm',
            bottom: '20mm',
            left: '15mm',
          },
        });
        return Buffer.from(pdf);
      });

      this.logger.log(`Reverse lookup PDF generated successfully (${pdfBuffer.length} bytes)`);
      return pdfBuffer;
    } catch (error: any) {
      this.logger.error(`Reverse lookup PDF export failed: ${error.message}`);
      throw new Error(`Reverse lookup PDF export failed: ${error.message}`);
    }
  }

}
