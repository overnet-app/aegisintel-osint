import { Injectable, Logger } from '@nestjs/common';
import { VINLookupResult, LookupOptions, VehicleInfo } from '../types/lookup.types';
import { ScoutAgent } from '../../research/agents/scout.agent';
import { WebSearchService } from '../../search/web-search.service';
import { StreamManagerService } from '../../research/streaming/stream-manager.service';
import { AgentModelResolverService } from '../../research/services/agent-model-resolver.service';
import { OpenRouterService } from '../../ai/open-router.service';
import { JsonRepairUtil } from '../../research/utils/json-repair.util';

@Injectable()
export class VINLookupService {
  private readonly logger = new Logger(VINLookupService.name);

  constructor(
    private scoutAgent: ScoutAgent,
    private openRouter: OpenRouterService,
    private webSearch: WebSearchService,
    private streamManager: StreamManagerService,
    private agentModelResolver: AgentModelResolverService,
  ) {}

  async lookup(vin: string, options: LookupOptions = {}): Promise<VINLookupResult> {
    this.logger.log(`Looking up VIN: ${vin}`);

    const sessionId = options.sessionId || `vin-lookup-${Date.now()}`;
    const userId = options.userId;

    try {
      const scoutModel = await this.agentModelResolver.resolveAgentModel(userId || '', 'scout', 'openrouter', 'google/gemma-3-27b-it');
      const thinkerModel = await this.agentModelResolver.resolveAgentModel(userId || '', 'thinker', 'openrouter', 'google/gemma-3-27b-it');

      // Normalize VIN (remove spaces, convert to uppercase)
      const normalizedVIN = vin.replace(/\s+/g, '').toUpperCase();

      this.streamManager.streamChunk(sessionId, 'Searching for vehicle information...', 'thinking');

      // 1. Search for VIN using ScoutAgent with improved queries
      const searchQueries = [
        `"${normalizedVIN}"`,
        `VIN ${normalizedVIN}`,
        `vehicle ${normalizedVIN}`,
        `${normalizedVIN} vehicle history`,
        `${normalizedVIN} owner`,
        `${normalizedVIN} registration`,
        `${normalizedVIN} carfax`,
        `${normalizedVIN} autocheck`,
        `${normalizedVIN} vehicle report`,
        `${normalizedVIN} title history`,
      ];

      const plan = {
        queryType: 'factual' as const,
        complexity: 'moderate' as const,
        requiresQuant: false,
        semanticClusters: searchQueries.map((q, idx) => ({
          theme: `VIN search ${idx + 1}`,
          subQueries: [q],
          priority: idx + 1,
        })),
        searchDirectives: searchQueries.map((q, idx) => ({
          step: idx + 1,
          action: 'search' as const,
          tool: 'web_search',
          query: q,
          reason: `Search for VIN information`,
          dependsOn: [],
        })),
        expectedSources: ['web'],
        whoWhatWhereWhenWhyHow: {},
      };

      const findings = await this.scoutAgent.executeSearchPlan(
        plan,
        scoutModel.provider,
        scoutModel.model,
      );

      this.streamManager.streamChunk(sessionId, `Found ${findings.length} search results`, 'thinking');

      // 2. Extract vehicle information using LLM-based extraction
      this.streamManager.streamChunk(sessionId, 'Extracting vehicle information using AI...', 'thinking');
      const vehicleInfo = await this.extractVehicleInfoLLM(findings, normalizedVIN, thinkerModel);

      // 3. Extract owner history using LLM-based extraction
      this.streamManager.streamChunk(sessionId, 'Extracting owner history using AI...', 'thinking');
      const ownerHistory = await this.extractOwnerHistoryLLM(findings, normalizedVIN, thinkerModel);

      // 4. Extract associated addresses
      const associatedAddresses = this.extractAddresses(findings);

      // 5. Find sale listings
      this.streamManager.streamChunk(sessionId, 'Searching for sale listings...', 'thinking');
      const saleListings = await this.findSaleListings(normalizedVIN);

      // 6. Calculate confidence
      const confidence = this.calculateConfidence(vehicleInfo, findings.length, ownerHistory.length);

      // 7. Collect sources
      const sources = findings
        .flatMap((f) => f.rawData.map((d: any) => d.source?.url))
        .filter(Boolean);

      const result: VINLookupResult = {
        vin: normalizedVIN,
        vehicleInfo: Object.keys(vehicleInfo).length > 0 ? vehicleInfo : undefined,
        ownerHistory: ownerHistory.length > 0 ? ownerHistory : undefined,
        associatedAddresses: associatedAddresses.length > 0 ? associatedAddresses : undefined,
        saleListings: saleListings.length > 0 ? saleListings : undefined,
        confidence,
        sources,
        timestamp: new Date(),
      };

      this.logger.log(`VIN lookup completed: ${vehicleInfo.make || 'Unknown'} ${vehicleInfo.model || ''} (${confidence}% confidence)`);
      return result;
    } catch (error: any) {
      this.logger.error(`VIN lookup failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Extract vehicle information using LLM-based extraction
   */
  private async extractVehicleInfoLLM(
    findings: any[],
    vin: string,
    thinkerModel: { provider: string; model: string },
  ): Promise<VehicleInfo> {
    try {
      const findingsText = findings
        .map((f, idx) => {
          const summary = f.summary || f.content || '';
          const source = f.rawData?.[0]?.source?.url || f.sourceUrl || `Source ${idx + 1}`;
          return `[Source: ${source}]\n${summary}`;
        })
        .join('\n\n---\n\n')
        .substring(0, 8000);

      const extractionPrompt = `You are analyzing search results about VIN "${vin}". Extract all vehicle information from the following search results.

Search Results:
${findingsText}

Extract and return a JSON object with the following structure:
{
  "make": "vehicle make (e.g., Toyota, Ford, Honda)",
  "model": "vehicle model (e.g., Camry, F-150, Civic)",
  "year": number (year of manufacture, between 1900 and ${new Date().getFullYear() + 1}),
  "color": "vehicle color if mentioned",
  "vin": "${vin}",
  "licensePlate": "license plate number if mentioned",
  "registrationState": "state where vehicle is registered if mentioned"
}

Return ONLY valid JSON, no markdown formatting. If information is not found, use null or omit the field.`;

      const extractionResult = await this.openRouter.complete(
        extractionPrompt,
        thinkerModel.model as any,
        false,
      );

      let vehicleInfo: VehicleInfo;
      try {
        const jsonMatch = extractionResult.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          vehicleInfo = JsonRepairUtil.repairAndParse<VehicleInfo>(jsonMatch[0], this.logger);
          vehicleInfo.vin = vin; // Ensure VIN is set
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        this.logger.warn(`Failed to parse LLM extraction, falling back to regex: ${parseError.message}`);
        return this.extractVehicleInfoRegex(findings, vin);
      }

      return vehicleInfo;
    } catch (error: any) {
      this.logger.error(`LLM extraction failed: ${error.message}, falling back to regex`);
      return this.extractVehicleInfoRegex(findings, vin);
    }
  }

  /**
   * Fallback regex-based extraction
   */
  private extractVehicleInfoRegex(findings: any[], vin: string): VehicleInfo {
    const vehicleInfo: VehicleInfo = { vin };

    for (const finding of findings) {
      const content = finding.summary || finding.content || '';

      // Extract make
      const makePattern = /(?:make|manufacturer)[\s:]+([A-Z][a-zA-Z]+)/gi;
      const makeMatch = content.match(makePattern);
      if (makeMatch && !vehicleInfo.make) {
        vehicleInfo.make = makeMatch[0].replace(/^(?:make|manufacturer)[\s:]+/i, '').trim();
      }

      // Extract model
      const modelPattern = /(?:model)[\s:]+([A-Z][a-zA-Z0-9\s-]+)/gi;
      const modelMatch = content.match(modelPattern);
      if (modelMatch && !vehicleInfo.model) {
        vehicleInfo.model = modelMatch[0].replace(/^(?:model)[\s:]+/i, '').trim();
      }

      // Extract year
      const yearPattern = /(?:year)[\s:]+(\d{4})/gi;
      const yearMatch = content.match(yearPattern);
      if (yearMatch && !vehicleInfo.year) {
        const year = parseInt(yearMatch[0].replace(/^(?:year)[\s:]+/i, '').trim());
        if (year >= 1900 && year <= new Date().getFullYear() + 1) {
          vehicleInfo.year = year;
        }
      }

      // Extract color
      const colorPattern = /(?:color)[\s:]+([a-z]+)/gi;
      const colorMatch = content.match(colorPattern);
      if (colorMatch && !vehicleInfo.color) {
        vehicleInfo.color = colorMatch[0].replace(/^(?:color)[\s:]+/i, '').trim();
      }

      // Extract license plate
      const platePattern = /(?:license|plate|tag)[\s:]+([A-Z0-9-]+)/gi;
      const plateMatch = content.match(platePattern);
      if (plateMatch && !vehicleInfo.licensePlate) {
        vehicleInfo.licensePlate = plateMatch[0].replace(/^(?:license|plate|tag)[\s:]+/i, '').trim();
      }
    }

    return vehicleInfo;
  }

  /**
   * Extract owner history using LLM-based extraction
   */
  private async extractOwnerHistoryLLM(
    findings: any[],
    vin: string,
    thinkerModel: { provider: string; model: string },
  ): Promise<any[]> {
    try {
      const findingsText = findings
        .map((f, idx) => {
          const summary = f.summary || f.content || '';
          const source = f.rawData?.[0]?.source?.url || f.sourceUrl || `Source ${idx + 1}`;
          return `[Source: ${source}]\n${summary}`;
        })
        .join('\n\n---\n\n')
        .substring(0, 8000);

      const extractionPrompt = `You are analyzing search results about VIN "${vin}". Extract all owner history information from the following search results.

Search Results:
${findingsText}

Extract and return a JSON array of owner history entries with the following structure:
[
  {
    "name": "Owner full name",
    "address": {
      "fullAddress": "complete address if mentioned",
      "city": "city if mentioned",
      "state": "state if mentioned",
      "zipCode": "zip code if mentioned"
    },
    "dateRange": {
      "start": "start date (YYYY-MM-DD format) if mentioned",
      "end": "end date (YYYY-MM-DD format) if mentioned"
    }
  }
]

Return ONLY valid JSON array, no markdown formatting. If no owners are found, return an empty array [].`;

      const extractionResult = await this.openRouter.complete(
        extractionPrompt,
        thinkerModel.model as any,
        false,
      );

      let ownerHistory: any[];
      try {
        const jsonMatch = extractionResult.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          ownerHistory = JsonRepairUtil.repairAndParse<any[]>(jsonMatch[0], this.logger);
        } else {
          throw new Error('No JSON array found in response');
        }
      } catch (parseError) {
        this.logger.warn(`Failed to parse LLM extraction, falling back to regex: ${parseError.message}`);
        return this.extractOwnerHistoryRegex(findings);
      }

      return ownerHistory;
    } catch (error: any) {
      this.logger.error(`LLM extraction failed: ${error.message}, falling back to regex`);
      return this.extractOwnerHistoryRegex(findings);
    }
  }

  /**
   * Fallback regex-based extraction
   */
  private extractOwnerHistoryRegex(findings: any[]): any[] {
    const owners: any[] = [];

    for (const finding of findings) {
      const content = finding.summary || finding.content || '';

      // Extract owner information
      const ownerPatterns = [
        /(?:owner|registered to|belongs to)[\s:]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/gi,
        /([A-Z][a-z]+\s+[A-Z][a-z]+)[\s,]+(?:owned|registered|purchased)/gi,
      ];

      for (const pattern of ownerPatterns) {
        const matches = content.match(pattern);
        if (matches) {
          matches.forEach((match) => {
            const name = match.replace(/^(?:owner|registered to|belongs to|owned|registered|purchased)[\s:,]+/i, '').trim();
            if (name && name.length > 3 && !owners.some((o) => o.name === name)) {
              owners.push({
                name,
                dateRange: this.extractDateRange(content),
              });
            }
          });
        }
      }
    }

    return owners;
  }

  private extractDateRange(content: string): { start?: string; end?: string } | undefined {
    const datePattern = /(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})/g;
    const dates = content.match(datePattern);
    if (dates && dates.length >= 1) {
      return {
        start: dates[0],
        end: dates.length > 1 ? dates[dates.length - 1] : undefined,
      };
    }
    return undefined;
  }

  private extractAddresses(findings: any[]): any[] {
    const addresses: any[] = [];
    const seen = new Set<string>();

    for (const finding of findings) {
      const content = finding.summary || finding.content || '';
      const addressPattern = /(\d+\s+[A-Za-z0-9\s,]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Court|Ct|Way|Place|Pl)[\s,]+[A-Za-z\s,]+(?:[A-Z]{2})?[\s,]*\d{5}(?:-\d{4})?)/gi;
      const matches = content.match(addressPattern);
      if (matches) {
        matches.forEach((addr) => {
          if (!seen.has(addr)) {
            seen.add(addr);
            addresses.push({ fullAddress: addr });
          }
        });
      }
    }

    return addresses;
  }

  private async findSaleListings(vin: string): Promise<any[]> {
    try {
      const searchResults = await this.webSearch.searchWebPages(`VIN ${vin} sale listing`, 10);
      return searchResults
        .filter((result: any) => /sale|listing|forsale|autotrader|cars\.com|carfax/i.test(result.url))
        .map((result: any) => ({
          url: result.url,
          price: this.extractPrice(result.title),
          date: this.extractDate(result.title),
          seller: this.extractSeller(result.title),
        }));
    } catch (error) {
      this.logger.warn(`Failed to find sale listings: ${error.message}`);
      return [];
    }
  }

  private extractPrice(text: string): number | undefined {
    const pricePattern = /\$([\d,]+)/;
    const match = text.match(pricePattern);
    if (match) {
      return parseInt(match[1].replace(/,/g, ''));
    }
    return undefined;
  }

  private extractDate(text: string): string | undefined {
    const datePattern = /(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})/;
    const match = text.match(datePattern);
    return match ? match[1] : undefined;
  }

  private extractSeller(text: string): string | undefined {
    // Simple extraction - could be enhanced
    const dealerPattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Auto|Dealer|Motors|Cars))/;
    const match = text.match(dealerPattern);
    return match ? match[1] : undefined;
  }

  private calculateConfidence(vehicleInfo: any, resultCount: number, ownerCount: number): number {
    let confidence = 0;

    if (vehicleInfo.make) confidence += 25;
    if (vehicleInfo.model) confidence += 20;
    if (vehicleInfo.year) confidence += 15;
    if (vehicleInfo.color) confidence += 10;
    if (ownerCount > 0) confidence += 15;
    if (resultCount > 5) confidence += 10;
    if (resultCount > 10) confidence += 5;

    return Math.min(confidence, 100);
  }
}
