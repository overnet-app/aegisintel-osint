import { Injectable, Logger } from '@nestjs/common';
import { PhoneLookupResult, LookupOptions, PersonInfo } from '../types/lookup.types';
import { ScoutAgent } from '../../research/agents/scout.agent';
import { ResearchDetectiveAgent } from '../../research/agents/research-detective.agent';
import { RelationshipAgent } from '../../ai/agents/relationship.agent';
import { ThinkerAgent } from '../../research/agents/thinker.agent';
import { LogicianAgent } from '../../research/agents/logician.agent';
import { WebSearchService } from '../../search/web-search.service';
import { StreamManagerService } from '../../research/streaming/stream-manager.service';
import { AgentModelResolverService } from '../../research/services/agent-model-resolver.service';
import { JsonRepairUtil } from '../../research/utils/json-repair.util';
import { OpenRouterService } from '../../ai/open-router.service';

@Injectable()
export class PhoneLookupService {
  private readonly logger = new Logger(PhoneLookupService.name);

  constructor(
    private scoutAgent: ScoutAgent,
    private detectiveAgent: ResearchDetectiveAgent,
    private relationshipAgent: RelationshipAgent,
    private thinkerAgent: ThinkerAgent,
    private logicianAgent: LogicianAgent,
    private openRouter: OpenRouterService,
    private webSearch: WebSearchService,
    private streamManager: StreamManagerService,
    private agentModelResolver: AgentModelResolverService,
  ) {}

  async lookup(phoneNumber: string, options: LookupOptions = {}): Promise<PhoneLookupResult> {
    this.logger.log(`Looking up phone number: ${phoneNumber}`);

    const sessionId = options.sessionId || `phone-lookup-${Date.now()}`;
    const userId = options.userId;

    try {
      // Get model configuration
      const scoutModel = await this.agentModelResolver.resolveAgentModel(userId || '', 'scout', 'openrouter', 'google/gemma-3-27b-it');
      const detectiveModel = await this.agentModelResolver.resolveAgentModel(userId || '', 'research_detective', 'openrouter', 'google/gemma-3-27b-it');
      const relationshipModel = await this.agentModelResolver.resolveAgentModel(userId || '', 'relationship', 'openrouter', 'google/gemma-3-27b-it');
      const thinkerModel = await this.agentModelResolver.resolveAgentModel(userId || '', 'thinker', 'openrouter', 'google/gemma-3-27b-it');
      const logicianModel = await this.agentModelResolver.resolveAgentModel(userId || '', 'logician', 'openrouter', 'google/gemma-3-27b-it');

      // Normalize phone number
      const normalizedPhone = this.normalizePhoneNumber(phoneNumber);

      this.streamManager.streamChunk(sessionId, 'Searching for phone number across web...', 'thinking');

      // 1. Search for phone number using ScoutAgent with improved queries
      const searchQueries = [
        `"${normalizedPhone}"`,
        `phone number ${normalizedPhone}`,
        `caller ${normalizedPhone}`,
        `${normalizedPhone} owner`,
        `${normalizedPhone} who is this`,
        `${normalizedPhone} person`,
        `${normalizedPhone} registered to`,
        `${normalizedPhone} belongs to`,
        `who owns ${normalizedPhone}`,
        `${normalizedPhone} contact information`,
      ];

      // Create search plan using ArchitectAgent approach
      const plan = {
        queryType: 'factual' as const,
        complexity: 'moderate' as const,
        requiresQuant: false,
        semanticClusters: searchQueries.map((q, idx) => ({
          theme: `Phone search ${idx + 1}`,
          subQueries: [q],
          priority: idx + 1,
        })),
        searchDirectives: searchQueries.map((q, idx) => ({
          step: idx + 1,
          action: 'search' as const,
          tool: 'web_search',
          query: q,
          reason: `Search for phone number information`,
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

      // 2. Extract person information using LLM-based extraction
      this.streamManager.streamChunk(sessionId, 'Extracting person information using AI...', 'thinking');
      const personInfo = await this.extractPersonInfoLLM(findings, normalizedPhone, thinkerModel, logicianModel);
      
      // 3. Find relationships using ResearchDetectiveAgent
      let relationships: any[] = [];
      if (options.includeRelationships !== false) {
        this.streamManager.streamChunk(sessionId, 'Finding relationships and family members...', 'thinking');
        // Convert findings to format expected by analyzeFindings
        const findingsData = findings.map((f) => ({
          fact: f.rawData.map((d: any) => d.fact).join(' '),
          source: f.rawData[0]?.source?.url || '',
        }));
        const detectiveAnalysis = await this.detectiveAgent.analyzeFindings(
          phoneNumber,
          findingsData,
          detectiveModel.provider,
          detectiveModel.model,
        );
        relationships = await this.extractRelationships(detectiveAnalysis, findings);
      }

      // 4. Extract location history
      let locationHistory: any[] = [];
      if (options.includeLocationHistory !== false) {
        this.streamManager.streamChunk(sessionId, 'Extracting location history...', 'thinking');
        locationHistory = this.extractLocationHistory(findings);
      }

      // 5. Find web activity
      let webActivity: any[] = [];
      if (options.includeWebActivity !== false) {
        this.streamManager.streamChunk(sessionId, 'Searching for web mentions...', 'thinking');
        webActivity = await this.findWebActivity(normalizedPhone);
      }

      // 6. Extract associated emails and addresses
      const associatedEmails = this.extractEmails(findings);
      const associatedAddresses = this.extractAddresses(findings);

      // 7. Calculate confidence score
      const confidence = this.calculateConfidence(personInfo, findings.length, relationships.length);

      // 8. Collect sources
      const sources = findings
        .flatMap((f) => f.rawData.map((d: any) => d.source?.url))
        .filter(Boolean);

      const result: PhoneLookupResult = {
        phoneNumber: normalizedPhone,
        personInfo: personInfo.fullName ? personInfo : undefined,
        relationships: relationships.length > 0 ? relationships : undefined,
        locationHistory: locationHistory.length > 0 ? locationHistory : undefined,
        webActivity: webActivity.length > 0 ? webActivity : undefined,
        associatedEmails: associatedEmails.length > 0 ? associatedEmails : undefined,
        associatedAddresses: associatedAddresses.length > 0 ? associatedAddresses : undefined,
        confidence,
        sources,
        timestamp: new Date(),
      };

      this.logger.log(`Phone lookup completed: ${personInfo.fullName || 'Unknown'} (${confidence}% confidence)`);
      return result;
    } catch (error: any) {
      this.logger.error(`Phone lookup failed: ${error.message}`);
      throw error;
    }
  }

  private normalizePhoneNumber(phone: string): string {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');
    
    // Format as (XXX) XXX-XXXX for US numbers
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    
    // Return original if can't normalize
    return phone;
  }

  /**
   * Extract person information using LLM-based extraction
   */
  private async extractPersonInfoLLM(
    findings: any[],
    phoneNumber: string,
    thinkerModel: { provider: string; model: string },
    logicianModel: { provider: string; model: string },
  ): Promise<PersonInfo> {
    try {
      // Prepare findings text for LLM analysis
      const findingsText = findings
        .map((f, idx) => {
          const summary = f.summary || f.content || '';
          const source = f.rawData?.[0]?.source?.url || f.sourceUrl || `Source ${idx + 1}`;
          return `[Source: ${source}]\n${summary}`;
        })
        .join('\n\n---\n\n')
        .substring(0, 8000); // Limit to avoid token limits

      const extractionPrompt = `You are analyzing search results about phone number "${phoneNumber}". Extract all person information from the following search results.

Search Results:
${findingsText}

Extract and return a JSON object with the following structure:
{
  "fullName": "Full name if found",
  "firstName": "First name if found",
  "lastName": "Last name if found",
  "middleName": "Middle name if found",
  "aliases": ["any alternative names or nicknames"],
  "age": number if mentioned,
  "dateOfBirth": "date if mentioned",
  "addresses": [
    {
      "fullAddress": "complete address",
      "street": "street address",
      "city": "city",
      "state": "state",
      "zipCode": "zip code",
      "country": "country"
    }
  ],
  "phoneNumbers": ["${phoneNumber}"],
  "emailAddresses": ["any email addresses found"],
  "socialProfiles": [
    {
      "platform": "Instagram|Twitter|Facebook|LinkedIn|GitHub|Reddit|TikTok",
      "username": "username if found",
      "url": "full profile URL if found"
    }
  ],
  "profession": "profession if mentioned",
  "company": "company if mentioned",
  "education": ["educational institutions if mentioned"],
  "languages": ["languages if mentioned"]
}

Return ONLY valid JSON, no markdown formatting. If information is not found, use null or empty arrays/strings.`;

      // Use OpenRouter directly for extraction (ThinkerAgent is for full reports)
      const extractionResult = await this.openRouter.complete(
        extractionPrompt,
        thinkerModel.model as any,
        false, // Don't use fallback
      );

      // Parse the JSON response
      let personInfo: PersonInfo;
      try {
        // Try to extract JSON from the response
        const jsonMatch = extractionResult.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          personInfo = JsonRepairUtil.repairAndParse<PersonInfo>(jsonMatch[0], this.logger);
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        this.logger.warn(`Failed to parse LLM extraction, falling back to regex: ${parseError.message}`);
        // Fallback to regex extraction
        personInfo = await this.extractPersonInfoRegex(findings, phoneNumber);
      }

      // Validate extracted information using LogicianAgent
      if (personInfo.fullName || (personInfo.addresses && personInfo.addresses.length > 0) || (personInfo.emailAddresses && personInfo.emailAddresses.length > 0)) {
        try {
          const factsToValidate = [
            ...(personInfo.fullName ? [`Name: ${personInfo.fullName}`] : []),
            ...(personInfo.addresses?.map(a => `Address: ${a.fullAddress}`) || []),
            ...(personInfo.emailAddresses?.map(e => `Email: ${e}`) || []),
          ];

          if (factsToValidate.length > 0) {
            // Convert to ScoutFindings format
            const scoutFindings = factsToValidate.map((fact, idx) => ({
              directiveId: idx + 1,
              tool: 'web_search',
              query: fact,
              searchOperators: [],
              credibilityScore: 50,
              rawData: [{
                fact,
                source: { 
                  url: 'phone_lookup', 
                  title: 'Phone Lookup Validation',
                  reliability: 'medium' as const,
                  type: 'other' as const,
                },
                metadata: {},
              }],
            }));

            const validationResult = await this.logicianAgent.validateFindings(
              scoutFindings,
              undefined,
              logicianModel.provider,
              logicianModel.model,
            );

            // Filter out low-confidence facts
            if (validationResult.validatedFacts) {
              const validatedFacts = validationResult.validatedFacts.filter((f: any) => f.confidence >= 50);
              
              // Update personInfo based on validation - remove unvalidated facts
              if (validatedFacts.length < factsToValidate.length) {
                this.logger.warn(`Some extracted facts had low confidence, filtering results`);
                // Remove facts that weren't validated
                const validatedNames = validatedFacts.filter((f: any) => f.fact.startsWith('Name:')).map((f: any) => f.fact.replace('Name: ', ''));
                if (validatedNames.length === 0 && personInfo.fullName) {
                  delete personInfo.fullName;
                  delete personInfo.firstName;
                  delete personInfo.lastName;
                }
              }
            }
          }
        } catch (validationError) {
          this.logger.warn(`Validation failed, using extracted data: ${validationError.message}`);
        }
      }

      // Ensure required fields
      personInfo.phoneNumbers = personInfo.phoneNumbers || [phoneNumber];
      personInfo.aliases = personInfo.aliases || [];
      personInfo.addresses = personInfo.addresses || [];
      personInfo.emailAddresses = personInfo.emailAddresses || [];
      personInfo.socialProfiles = personInfo.socialProfiles || [];

      return personInfo;
    } catch (error: any) {
      this.logger.error(`LLM extraction failed: ${error.message}, falling back to regex`);
      return await this.extractPersonInfoRegex(findings, phoneNumber);
    }
  }

  /**
   * Fallback regex-based extraction
   */
  private async extractPersonInfoRegex(findings: any[], phoneNumber: string): Promise<PersonInfo> {
    const personInfo: PersonInfo = {
      aliases: [],
      addresses: [],
      phoneNumbers: [phoneNumber],
      emailAddresses: [],
      socialProfiles: [],
    };

    for (const finding of findings) {
      const content = finding.summary || finding.content || '';
      
      // Extract names
      const namePatterns = [
        /(?:name|owner|person|caller|belongs to|registered to)[\s:]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/gi,
        /([A-Z][a-z]+\s+[A-Z][a-z]+)/g,
      ];

      for (const pattern of namePatterns) {
        const matches = content.match(pattern);
        if (matches) {
          matches.forEach((match) => {
            const name = match.replace(/^(?:name|owner|person|caller|belongs to|registered to)[\s:]+/i, '').trim();
            if (name && name.length > 3 && !personInfo.fullName) {
              const parts = name.split(/\s+/);
              personInfo.fullName = name;
              personInfo.firstName = parts[0];
              personInfo.lastName = parts[parts.length - 1];
            }
          });
        }
      }

      // Extract addresses
      const addressPattern = /(\d+\s+[A-Za-z0-9\s,]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Court|Ct|Way|Place|Pl)[\s,]+[A-Za-z\s,]+(?:[A-Z]{2})?[\s,]*\d{5}(?:-\d{4})?)/gi;
      const addressMatches = content.match(addressPattern);
      if (addressMatches) {
        addressMatches.forEach((addr) => {
          if (!personInfo.addresses?.some((a: any) => a.fullAddress === addr)) {
            if (!personInfo.addresses) personInfo.addresses = [];
            personInfo.addresses.push({ fullAddress: addr });
          }
        });
      }

      // Extract emails
      const emailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
      const emailMatches = content.match(emailPattern);
      if (emailMatches) {
        emailMatches.forEach((email) => {
          if (!personInfo.emailAddresses?.includes(email)) {
            if (!personInfo.emailAddresses) personInfo.emailAddresses = [];
            personInfo.emailAddresses.push(email);
          }
        });
      }

      // Extract social media profiles
      const socialPatterns = [
        /(?:instagram|ig)[\s:]+@?([a-zA-Z0-9._]+)/gi,
        /(?:twitter|x)[\s:]+@?([a-zA-Z0-9._]+)/gi,
        /(?:facebook|fb)[\s:]+([a-zA-Z0-9._]+)/gi,
        /(?:linkedin)[\s:]+([a-zA-Z0-9._]+)/gi,
      ];

      for (const pattern of socialPatterns) {
        const matches = content.match(pattern);
        if (matches) {
          matches.forEach((match) => {
            const platform = pattern.source.includes('instagram') ? 'Instagram' :
                           pattern.source.includes('twitter') ? 'Twitter' :
                           pattern.source.includes('facebook') ? 'Facebook' :
                           pattern.source.includes('linkedin') ? 'LinkedIn' : 'Unknown';
            const username = match.replace(/^(?:instagram|ig|twitter|x|facebook|fb|linkedin)[\s:]+@?/i, '').trim();
            if (username && !personInfo.socialProfiles?.some((p: any) => p.username === username)) {
              if (!personInfo.socialProfiles) personInfo.socialProfiles = [];
              personInfo.socialProfiles.push({
                platform,
                username,
                url: this.buildSocialUrl(platform, username),
              });
            }
          });
        }
      }
    }

    return personInfo;
  }

  private buildSocialUrl(platform: string, username: string): string {
    const baseUrls: Record<string, string> = {
      Instagram: 'https://instagram.com/',
      Twitter: 'https://twitter.com/',
      Facebook: 'https://facebook.com/',
      LinkedIn: 'https://linkedin.com/in/',
    };
    return `${baseUrls[platform] || ''}${username}`;
  }

  private async extractRelationships(detectiveAnalysis: any, findings: any[]): Promise<any[]> {
    const relationships: any[] = [];

    // Extract relationships from detective analysis
    if (detectiveAnalysis.correlations) {
      for (const correlation of detectiveAnalysis.correlations) {
        if (correlation.items && correlation.items.length >= 2) {
          relationships.push({
            type: 'unknown',
            name: correlation.items[1],
            relationship: correlation.relationship,
            confidence: 50,
            sources: [correlation.source || 'detective_analysis'],
          });
        }
      }
    }

    // Extract family relationships from findings
    for (const finding of findings) {
      const content = finding.summary || finding.content || '';
      const familyPatterns = [
        /(?:brother|sister|mother|father|son|daughter|wife|husband|parent|child|sibling)[\s:]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi,
      ];

      for (const pattern of familyPatterns) {
        const matches = content.match(pattern);
        if (matches) {
          matches.forEach((match) => {
            const parts = match.split(/[\s:]+/);
            const relationshipType = parts[0].toLowerCase();
            const name = parts.slice(1).join(' ');
            if (name && !relationships.some((r) => r.name === name)) {
              relationships.push({
                type: this.mapRelationshipType(relationshipType),
                name,
                relationship: relationshipType,
                confidence: 60,
                sources: [finding.sourceUrl || 'web_search'],
              });
            }
          });
        }
      }
    }

    return relationships;
  }

  private mapRelationshipType(rel: string): 'family' | 'friend' | 'colleague' | 'associate' | 'unknown' {
    const family = ['brother', 'sister', 'mother', 'father', 'son', 'daughter', 'wife', 'husband', 'parent', 'child', 'sibling'];
    if (family.includes(rel.toLowerCase())) return 'family';
    if (['friend', 'colleague', 'associate'].includes(rel.toLowerCase())) return rel.toLowerCase() as any;
    return 'unknown';
  }

  private extractLocationHistory(findings: any[]): any[] {
    const locations: any[] = [];
    const seen = new Set<string>();

    for (const finding of findings) {
      const content = finding.summary || finding.content || '';
      const addressPattern = /(\d+\s+[A-Za-z0-9\s,]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Court|Ct|Way|Place|Pl)[\s,]+[A-Za-z\s,]+(?:[A-Z]{2})?[\s,]*\d{5}(?:-\d{4})?)/gi;
      const matches = content.match(addressPattern);
      if (matches) {
        matches.forEach((addr) => {
          if (!seen.has(addr)) {
            seen.add(addr);
            locations.push({
              address: { fullAddress: addr },
              confidence: 50,
              sources: [finding.sourceUrl || 'web_search'],
            });
          }
        });
      }
    }

    return locations;
  }

  private async findWebActivity(phoneNumber: string): Promise<any[]> {
    try {
      // Search for phone number in news, blogs, directories
      const searchResults = await this.webSearch.searchWebPages(`"${phoneNumber}"`, 10);
      
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

  private calculateConfidence(personInfo: any, resultCount: number, relationshipCount: number): number {
    let confidence = 0;

    if (personInfo.fullName) confidence += 30;
    if (personInfo.addresses && personInfo.addresses.length > 0) confidence += 20;
    if (personInfo.emailAddresses && personInfo.emailAddresses.length > 0) confidence += 15;
    if (personInfo.socialProfiles && personInfo.socialProfiles.length > 0) confidence += 15;
    if (relationshipCount > 0) confidence += 10;
    if (resultCount > 5) confidence += 10;

    return Math.min(confidence, 100);
  }
}
