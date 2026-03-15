import { Injectable, Logger } from '@nestjs/common';
import { AddressLookupResult, AddressInfo, LookupOptions, PersonInfo, PropertyInfo } from '../types/lookup.types';
import { ScoutAgent } from '../../research/agents/scout.agent';
import { ResearchDetectiveAgent } from '../../research/agents/research-detective.agent';
import { GeoAgent } from '../../ai/agents/geo.agent';
import { WebSearchService } from '../../search/web-search.service';
import { StreamManagerService } from '../../research/streaming/stream-manager.service';
import { AgentModelResolverService } from '../../research/services/agent-model-resolver.service';
import { OpenRouterService } from '../../ai/open-router.service';
import { JsonRepairUtil } from '../../research/utils/json-repair.util';

@Injectable()
export class AddressLookupService {
  private readonly logger = new Logger(AddressLookupService.name);

  constructor(
    private scoutAgent: ScoutAgent,
    private detectiveAgent: ResearchDetectiveAgent,
    private geoAgent: GeoAgent,
    private openRouter: OpenRouterService,
    private webSearch: WebSearchService,
    private streamManager: StreamManagerService,
    private agentModelResolver: AgentModelResolverService,
  ) {}

  async lookup(address: string | AddressInfo, options: LookupOptions = {}): Promise<AddressLookupResult> {
    const addressString = typeof address === 'string' ? address : address.fullAddress || '';
    this.logger.log(`Looking up address: ${addressString}`);

    const sessionId = options.sessionId || `address-lookup-${Date.now()}`;
    const userId = options.userId;

    try {
      const scoutModel = await this.agentModelResolver.resolveAgentModel(userId || '', 'scout', 'openrouter', 'google/gemma-3-27b-it');
      const detectiveModel = await this.agentModelResolver.resolveAgentModel(userId || '', 'research_detective', 'openrouter', 'google/gemma-3-27b-it');
      const thinkerModel = await this.agentModelResolver.resolveAgentModel(userId || '', 'thinker', 'openrouter', 'google/gemma-3-27b-it');

      this.streamManager.streamChunk(sessionId, 'Searching for address information...', 'thinking');

      // 1. Search for address using ScoutAgent with improved queries
      const searchQueries = [
        `"${addressString}"`,
        `address ${addressString}`,
        `residents ${addressString}`,
        `${addressString} who lives here`,
        `${addressString} property`,
        `${addressString} owner`,
        `${addressString} neighbors`,
        `${addressString} property records`,
        `${addressString} real estate`,
        `${addressString} public records`,
      ];

      const plan = {
        queryType: 'factual' as const,
        complexity: 'moderate' as const,
        requiresQuant: false,
        semanticClusters: searchQueries.map((q, idx) => ({
          theme: `Address search ${idx + 1}`,
          subQueries: [q],
          priority: idx + 1,
        })),
        searchDirectives: searchQueries.map((q, idx) => ({
          step: idx + 1,
          action: 'search' as const,
          tool: 'web_search',
          query: q,
          reason: `Search for address information`,
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

      // 2. Extract current and past residents using LLM-based extraction
      this.streamManager.streamChunk(sessionId, 'Extracting resident information using AI...', 'thinking');
      const { currentResidents, pastResidents } = await this.extractResidentsLLM(findings, addressString, thinkerModel);

      // 3. Find neighbors using LLM-based extraction
      this.streamManager.streamChunk(sessionId, 'Finding neighbors using AI...', 'thinking');
      const neighbors = await this.findNeighborsLLM(addressString, findings, thinkerModel);

      // 4. Extract property information using LLM-based extraction
      this.streamManager.streamChunk(sessionId, 'Extracting property information using AI...', 'thinking');
      const propertyInfo = await this.extractPropertyInfoLLM(findings, addressString, thinkerModel);

      // 5. Extract associated phones and emails
      const associatedPhones = this.extractPhones(findings);
      const associatedEmails = this.extractEmails(findings);

      // 6. Find web activity
      let webActivity: any[] = [];
      if (options.includeWebActivity !== false) {
        this.streamManager.streamChunk(sessionId, 'Searching for web mentions...', 'thinking');
        webActivity = await this.findWebActivity(addressString);
      }

      // 7. Calculate confidence
      const confidence = this.calculateConfidence(
        currentResidents.length,
        pastResidents.length,
        propertyInfo,
        findings.length,
      );

      // 8. Collect sources
      const sources = findings
        .flatMap((f) => f.rawData.map((d: any) => d.source?.url))
        .filter(Boolean);

      const addressInfo: AddressInfo = typeof address === 'string'
        ? { fullAddress: addressString }
        : address;

      const result: AddressLookupResult = {
        address: addressInfo,
        currentResidents: currentResidents.length > 0 ? currentResidents : undefined,
        pastResidents: pastResidents.length > 0 ? pastResidents : undefined,
        neighbors: neighbors.length > 0 ? neighbors : undefined,
        propertyInfo: Object.keys(propertyInfo).length > 0 ? propertyInfo : undefined,
        associatedPhones: associatedPhones.length > 0 ? associatedPhones : undefined,
        associatedEmails: associatedEmails.length > 0 ? associatedEmails : undefined,
        webActivity: webActivity.length > 0 ? webActivity : undefined,
        confidence,
        sources,
        timestamp: new Date(),
      };

      this.logger.log(`Address lookup completed: ${currentResidents.length} current resident(s) (${confidence}% confidence)`);
      return result;
    } catch (error: any) {
      this.logger.error(`Address lookup failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Extract residents using LLM-based extraction
   */
  private async extractResidentsLLM(
    findings: any[],
    address: string,
    thinkerModel: { provider: string; model: string },
  ): Promise<{ currentResidents: PersonInfo[]; pastResidents: PersonInfo[] }> {
    try {
      const findingsText = findings
        .map((f, idx) => {
          const summary = f.summary || f.content || '';
          const source = f.rawData?.[0]?.source?.url || f.sourceUrl || `Source ${idx + 1}`;
          return `[Source: ${source}]\n${summary}`;
        })
        .join('\n\n---\n\n')
        .substring(0, 8000);

      const extractionPrompt = `You are analyzing search results about address "${address}". Extract all resident information from the following search results.

Search Results:
${findingsText}

Extract and return a JSON object with the following structure:
{
  "currentResidents": [
    {
      "fullName": "Full name",
      "firstName": "First name",
      "lastName": "Last name",
      "age": number if mentioned,
      "profession": "profession if mentioned",
      "company": "company if mentioned"
    }
  ],
  "pastResidents": [
    {
      "fullName": "Full name",
      "firstName": "First name",
      "lastName": "Last name",
      "dateRange": {
        "start": "start date if mentioned",
        "end": "end date if mentioned"
      }
    }
  ]
}

Distinguish between current and past residents based on context (words like "former", "previous", "past", "ex-", "was", "used to" indicate past residents).
Return ONLY valid JSON, no markdown formatting. If no residents are found, use empty arrays.`;

      const extractionResult = await this.openRouter.complete(
        extractionPrompt,
        thinkerModel.model as any,
        false,
      );

      let residents: { currentResidents: PersonInfo[]; pastResidents: PersonInfo[] };
      try {
        const jsonMatch = extractionResult.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          residents = JsonRepairUtil.repairAndParse<{ currentResidents: PersonInfo[]; pastResidents: PersonInfo[] }>(jsonMatch[0], this.logger);
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        this.logger.warn(`Failed to parse LLM extraction, falling back to regex: ${parseError.message}`);
        return this.extractResidentsRegex(findings);
      }

      return {
        currentResidents: residents.currentResidents || [],
        pastResidents: residents.pastResidents || [],
      };
    } catch (error: any) {
      this.logger.error(`LLM extraction failed: ${error.message}, falling back to regex`);
      return this.extractResidentsRegex(findings);
    }
  }

  /**
   * Fallback regex-based extraction
   */
  private extractResidentsRegex(findings: any[]): { currentResidents: PersonInfo[]; pastResidents: PersonInfo[] } {
    const currentResidents: PersonInfo[] = [];
    const pastResidents: PersonInfo[] = [];
    const seen = new Set<string>();

    for (const finding of findings) {
      const content = finding.summary || finding.content || '';
      const lowerContent = content.toLowerCase();

      // Determine if this is current or past resident
      const isPast = /(?:former|previous|past|ex-|was|used to)/i.test(content);

      // Extract names
      const namePatterns = [
        /(?:resident|lives|lived|owner|occupant)[\s:]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/gi,
        /([A-Z][a-z]+\s+[A-Z][a-z]+)[\s,]+(?:lives|lived|resides|resided)/gi,
      ];

      for (const pattern of namePatterns) {
        const matches = content.match(pattern);
        if (matches) {
          matches.forEach((match) => {
            const name = match.replace(/^(?:resident|lives|lived|owner|occupant|lives|lived|resides|resided)[\s:,]+/i, '').trim();
            if (name && name.length > 3 && !seen.has(name)) {
              seen.add(name);
              const parts = name.split(/\s+/);
              const personInfo: PersonInfo = {
                fullName: name,
                firstName: parts[0],
                lastName: parts[parts.length - 1],
              };

              if (isPast) {
                pastResidents.push(personInfo);
              } else {
                currentResidents.push(personInfo);
              }
            }
          });
        }
      }
    }

    return { currentResidents, pastResidents };
  }

  /**
   * Find neighbors using LLM-based extraction
   */
  private async findNeighborsLLM(
    address: string,
    findings: any[],
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
        .substring(0, 6000);

      const extractionPrompt = `You are analyzing search results about address "${address}". Extract all neighbor information from the following search results.

Search Results:
${findingsText}

Extract and return a JSON array of neighbors with the following structure:
[
  {
    "name": "Neighbor full name",
    "address": {
      "fullAddress": "neighbor's address if mentioned"
    },
    "relationship": "neighbor"
  }
]

Return ONLY valid JSON array, no markdown formatting. If no neighbors are found, return an empty array [].`;

      const extractionResult = await this.openRouter.complete(
        extractionPrompt,
        thinkerModel.model as any,
        false,
      );

      let neighbors: any[];
      try {
        const jsonMatch = extractionResult.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          neighbors = JsonRepairUtil.repairAndParse<any[]>(jsonMatch[0], this.logger);
        } else {
          throw new Error('No JSON array found in response');
        }
      } catch (parseError) {
        this.logger.warn(`Failed to parse LLM extraction, falling back to regex: ${parseError.message}`);
        return this.findNeighborsRegex(address, findings);
      }

      return neighbors;
    } catch (error: any) {
      this.logger.error(`LLM extraction failed: ${error.message}, falling back to regex`);
      return this.findNeighborsRegex(address, findings);
    }
  }

  /**
   * Fallback regex-based extraction
   */
  private async findNeighborsRegex(address: string, findings: any[]): Promise<any[]> {
    const neighbors: any[] = [];
    const seen = new Set<string>();

    // Extract neighbor information from findings
    for (const finding of findings) {
      const content = finding.summary || finding.content || '';

      // Look for neighbor mentions
      const neighborPatterns = [
        /(?:neighbor|next door|adjacent)[\s:]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/gi,
        /([A-Z][a-z]+\s+[A-Z][a-z]+)[\s,]+(?:neighbor|lives next door)/gi,
      ];

      for (const pattern of neighborPatterns) {
        const matches = content.match(pattern);
        if (matches) {
          matches.forEach((match) => {
            const name = match.replace(/^(?:neighbor|next door|adjacent|lives next door)[\s:,]+/i, '').trim();
            if (name && name.length > 3 && !seen.has(name)) {
              seen.add(name);
              neighbors.push({
                name,
                relationship: 'neighbor',
              });
            }
          });
        }
      }
    }

    return neighbors;
  }

  /**
   * Extract property information using LLM-based extraction
   */
  private async extractPropertyInfoLLM(
    findings: any[],
    address: string,
    thinkerModel: { provider: string; model: string },
  ): Promise<PropertyInfo> {
    try {
      const findingsText = findings
        .map((f, idx) => {
          const summary = f.summary || f.content || '';
          const source = f.rawData?.[0]?.source?.url || f.sourceUrl || `Source ${idx + 1}`;
          return `[Source: ${source}]\n${summary}`;
        })
        .join('\n\n---\n\n')
        .substring(0, 8000);

      const extractionPrompt = `You are analyzing search results about address "${address}". Extract all property information from the following search results.

Search Results:
${findingsText}

Extract and return a JSON object with the following structure:
{
  "propertyType": "house|apartment|condo|townhouse|single family|multi-family",
  "squareFootage": number if mentioned,
  "bedrooms": number if mentioned,
  "bathrooms": number if mentioned,
  "yearBuilt": number (year between 1800 and ${new Date().getFullYear()}) if mentioned,
  "currentOwner": "current owner name if mentioned",
  "ownershipHistory": [
    {
      "owner": "owner name",
      "dateRange": {
        "start": "start date if mentioned",
        "end": "end date if mentioned"
      }
    }
  ]
}

Return ONLY valid JSON, no markdown formatting. If information is not found, use null or omit the field.`;

      const extractionResult = await this.openRouter.complete(
        extractionPrompt,
        thinkerModel.model as any,
        false,
      );

      let propertyInfo: PropertyInfo;
      try {
        const jsonMatch = extractionResult.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const extracted = JsonRepairUtil.repairAndParse<Partial<PropertyInfo>>(jsonMatch[0], this.logger);
          // Ensure address is set (required by PropertyInfo interface)
          propertyInfo = {
            address: { fullAddress: address },
            ...extracted,
          } as PropertyInfo;
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        this.logger.warn(`Failed to parse LLM extraction, falling back to regex: ${parseError.message}`);
        return this.extractPropertyInfoRegex(findings, address);
      }

      // Ensure address is set (required by PropertyInfo interface)
      return {
        ...propertyInfo,
        address: propertyInfo.address || { fullAddress: address },
      } as PropertyInfo;
    } catch (error: any) {
      this.logger.error(`LLM extraction failed: ${error.message}, falling back to regex`);
      return this.extractPropertyInfoRegex(findings, address);
    }
  }

  /**
   * Fallback regex-based extraction
   */
  private extractPropertyInfoRegex(findings: any[], address: string): PropertyInfo {
    const propertyInfo: Partial<PropertyInfo> = {};

    for (const finding of findings) {
      const content = finding.summary || finding.content || '';

      // Extract property type
      const typePattern = /(?:type|property type)[\s:]+(house|apartment|condo|townhouse|single family|multi-family)/gi;
      const typeMatch = content.match(typePattern);
      if (typeMatch && !propertyInfo.propertyType) {
        propertyInfo.propertyType = typeMatch[0].replace(/^(?:type|property type)[\s:]+/i, '').trim();
      }

      // Extract square footage
      const sqftPattern = /(\d+)\s*(?:sq\s*ft|square\s*feet|sqft)/gi;
      const sqftMatch = content.match(sqftPattern);
      if (sqftMatch && !propertyInfo.squareFootage) {
        propertyInfo.squareFootage = parseInt(sqftMatch[0].replace(/\D/g, ''));
      }

      // Extract bedrooms
      const bedPattern = /(\d+)\s*(?:bed|bedroom|br)/gi;
      const bedMatch = content.match(bedPattern);
      if (bedMatch && !propertyInfo.bedrooms) {
        propertyInfo.bedrooms = parseInt(bedMatch[0].replace(/\D/g, ''));
      }

      // Extract bathrooms
      const bathPattern = /(\d+)\s*(?:bath|bathroom|ba)/gi;
      const bathMatch = content.match(bathPattern);
      if (bathMatch && !propertyInfo.bathrooms) {
        propertyInfo.bathrooms = parseInt(bathMatch[0].replace(/\D/g, ''));
      }

      // Extract year built
      const yearPattern = /(?:built|year built|constructed)[\s:]+(\d{4})/gi;
      const yearMatch = content.match(yearPattern);
      if (yearMatch && !propertyInfo.yearBuilt) {
        const year = parseInt(yearMatch[0].replace(/\D/g, ''));
        if (year >= 1800 && year <= new Date().getFullYear()) {
          propertyInfo.yearBuilt = year;
        }
      }

      // Extract current owner
      const ownerPattern = /(?:owner|owned by|current owner)[\s:]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/gi;
      const ownerMatch = content.match(ownerPattern);
      if (ownerMatch && !propertyInfo.currentOwner) {
        propertyInfo.currentOwner = ownerMatch[0].replace(/^(?:owner|owned by|current owner)[\s:]+/i, '').trim();
      }
    }

    // Ensure address is set (required by PropertyInfo interface)
    return {
      address: { fullAddress: address },
      ...propertyInfo,
    } as PropertyInfo;
  }

  private extractPhones(findings: any[]): string[] {
    const phones = new Set<string>();
    for (const finding of findings) {
      const content = finding.summary || finding.content || '';
      const phonePattern = /(?:phone|tel|call)[\s:]*\(?(\d{3})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})/gi;
      const matches = content.match(phonePattern);
      if (matches) {
        matches.forEach((match) => {
          const digits = match.replace(/\D/g, '');
          if (digits.length === 10) phones.add(digits);
        });
      }
    }
    return Array.from(phones);
  }

  private extractEmails(findings: any[]): string[] {
    const emails = new Set<string>();
    for (const finding of findings) {
      const content = finding.summary || finding.content || '';
      const emailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
      const matches = content.match(emailPattern);
      if (matches) {
        matches.forEach((email) => emails.add(email));
      }
    }
    return Array.from(emails);
  }

  private async findWebActivity(address: string): Promise<any[]> {
    try {
      const searchResults = await this.webSearch.searchWebPages(`"${address}"`, 10);
      return searchResults.map((result: any) => ({
        type: this.classifyWebActivityType(result.url),
        title: result.title || 'Unknown',
        url: result.url,
        source: 'web_search',
      }));
    } catch (error) {
      this.logger.warn(`Failed to find web activity: ${error.message}`);
      return [];
    }
  }

  private classifyWebActivityType(url: string): 'news' | 'blog' | 'directory' | 'forum' | 'social' | 'other' {
    if (/news|article|press/.test(url)) return 'news';
    if (/blog|post|article/.test(url)) return 'blog';
    if (/directory|listing|yellowpages|whitepages/.test(url)) return 'directory';
    if (/forum|reddit|discussion/.test(url)) return 'forum';
    if (/facebook|twitter|instagram|linkedin/.test(url)) return 'social';
    return 'other';
  }

  private calculateConfidence(
    currentResidentCount: number,
    pastResidentCount: number,
    propertyInfo: any,
    resultCount: number,
  ): number {
    let confidence = 0;

    if (currentResidentCount > 0) confidence += 30;
    if (pastResidentCount > 0) confidence += 15;
    if (propertyInfo.propertyType) confidence += 15;
    if (propertyInfo.currentOwner) confidence += 15;
    if (resultCount > 5) confidence += 15;
    if (resultCount > 10) confidence += 10;

    return Math.min(confidence, 100);
  }
}
