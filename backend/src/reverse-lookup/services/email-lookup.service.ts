import { Injectable, Logger } from '@nestjs/common';
import { EmailLookupResult, LookupOptions, PersonInfo } from '../types/lookup.types';
import { ScoutAgent } from '../../research/agents/scout.agent';
import { PersonaClassifierAgent } from '../../ai/agents/persona-classifier.agent';
import { UsernameCheckerService } from '../../search/username-checker.service';
import { WebSearchService } from '../../search/web-search.service';
import { StreamManagerService } from '../../research/streaming/stream-manager.service';
import { AgentModelResolverService } from '../../research/services/agent-model-resolver.service';
import { OpenRouterService } from '../../ai/open-router.service';
import { JsonRepairUtil } from '../../research/utils/json-repair.util';

@Injectable()
export class EmailLookupService {
  private readonly logger = new Logger(EmailLookupService.name);

  constructor(
    private scoutAgent: ScoutAgent,
    private personaClassifier: PersonaClassifierAgent,
    private usernameChecker: UsernameCheckerService,
    private openRouter: OpenRouterService,
    private webSearch: WebSearchService,
    private streamManager: StreamManagerService,
    private agentModelResolver: AgentModelResolverService,
  ) {}

  async lookup(emailAddress: string, options: LookupOptions = {}): Promise<EmailLookupResult> {
    this.logger.log(`Looking up email address: ${emailAddress}`);

    const sessionId = options.sessionId || `email-lookup-${Date.now()}`;
    const userId = options.userId;

    try {
      const scoutModel = await this.agentModelResolver.resolveAgentModel(userId || '', 'scout', 'openrouter', 'google/gemma-3-27b-it');
      const thinkerModel = await this.agentModelResolver.resolveAgentModel(userId || '', 'thinker', 'openrouter', 'google/gemma-3-27b-it');
      const personaModel = await this.agentModelResolver.resolveAgentModel(userId || '', 'persona_classifier', 'openrouter', 'google/gemma-3-27b-it');

      this.streamManager.streamChunk(sessionId, 'Searching for email address across web...', 'thinking');

      // 1. Extract username from email
      const username = emailAddress.split('@')[0];
      const domain = emailAddress.split('@')[1];

      // 2. Search for email using ScoutAgent with improved queries
      const searchQueries = [
        `"${emailAddress}"`,
        `email ${emailAddress}`,
        `${username} ${domain}`,
        `${emailAddress} owner`,
        `${emailAddress} profile`,
        `${emailAddress} person`,
        `${username} email`,
        `who owns ${emailAddress}`,
        `${emailAddress} contact`,
        `${emailAddress} registered to`,
      ];

      const plan = {
        queryType: 'factual' as const,
        complexity: 'moderate' as const,
        requiresQuant: false,
        semanticClusters: searchQueries.map((q, idx) => ({
          theme: `Email search ${idx + 1}`,
          subQueries: [q],
          priority: idx + 1,
        })),
        searchDirectives: searchQueries.map((q: string, idx: number) => ({
          step: idx + 1,
          action: 'search' as const,
          tool: 'web_search',
          query: q,
          reason: `Search for email address information`,
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

      // 3. Extract person information using LLM-based extraction
      this.streamManager.streamChunk(sessionId, 'Extracting person information using AI...', 'thinking');
      const personInfo = await this.extractPersonInfoLLM(findings, emailAddress, thinkerModel);

      // 4. Check for social media profiles using username
      this.streamManager.streamChunk(sessionId, 'Checking social media platforms...', 'thinking');
      const socialProfiles: any[] = await this.findSocialProfiles(username, domain, findings);

      // 5. Search for data breaches (enhanced)
      this.streamManager.streamChunk(sessionId, 'Checking for data breaches...', 'thinking');
      const dataBreaches = await this.findDataBreaches(emailAddress, findings);

      // 6. Find web activity
      let webActivity: any[] = [];
      if (options.includeWebActivity !== false) {
        this.streamManager.streamChunk(sessionId, 'Searching for web mentions...', 'thinking');
        webActivity = await this.findWebActivity(emailAddress);
      }

      // 7. Extract associated phones and addresses
      const associatedPhones = this.extractPhones(findings);
      const associatedAddresses = this.extractAddresses(findings);

      // 8. Classify persona if social profiles found
      if (socialProfiles.length > 0 && options.userId) {
        try {
          this.streamManager.streamChunk(sessionId, 'Classifying persona from social profiles...', 'thinking');
          // Use PersonaClassifierAgent to enrich profiles
          const profilesForClassification = socialProfiles.map((p) => ({
            platform: p.platform,
            username: p.username || username,
            url: p.url,
            bio: p.bio,
            avatar: p.profileImage,
          }));
          
          const classification = await this.personaClassifier.classifyProfiles(
            profilesForClassification,
            personaModel.model,
          );
          
          // Enrich personInfo with persona data
          if (classification && classification.profiles && classification.profiles.length > 0) {
            const primaryPersona = classification.profiles[0];
            if (primaryPersona) {
              personInfo.profession = primaryPersona.profession || personInfo.profession;
              // Note: PersonaProfile doesn't have company field, but we can extract from other fields if needed
            }
          }
        } catch (error) {
          this.logger.warn(`Persona classification failed: ${error.message}`);
        }
      }

      // 9. Calculate confidence
      const confidence = this.calculateConfidence(personInfo, findings.length, socialProfiles.length);

      // 10. Collect sources
      const sources = findings
        .flatMap((f) => f.rawData.map((d: any) => d.source?.url))
        .filter(Boolean);

      const result: EmailLookupResult = {
        emailAddress,
        personInfo: personInfo.fullName ? personInfo : undefined,
        associatedPhones: associatedPhones.length > 0 ? associatedPhones : undefined,
        associatedAddresses: associatedAddresses.length > 0 ? associatedAddresses : undefined,
        socialProfiles: socialProfiles.length > 0 ? socialProfiles : undefined,
        dataBreaches: dataBreaches.length > 0 ? dataBreaches : undefined,
        webActivity: webActivity.length > 0 ? webActivity : undefined,
        confidence,
        sources,
        timestamp: new Date(),
      };

      this.logger.log(`Email lookup completed: ${personInfo.fullName || 'Unknown'} (${confidence}% confidence)`);
      return result;
    } catch (error: any) {
      this.logger.error(`Email lookup failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Extract person information using LLM-based extraction
   */
  private async extractPersonInfoLLM(
    findings: any[],
    emailAddress: string,
    thinkerModel: { provider: string; model: string },
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

      const extractionPrompt = `You are analyzing search results about email address "${emailAddress}". Extract all person information from the following search results.

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
  "phoneNumbers": ["any phone numbers found"],
  "emailAddresses": ["${emailAddress}"],
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

      // Use OpenRouter for extraction
      const extractionResult = await this.openRouter.complete(
        extractionPrompt,
        thinkerModel.model as any,
        false,
      );

      // Parse the JSON response
      let personInfo: PersonInfo;
      try {
        const jsonMatch = extractionResult.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          personInfo = JsonRepairUtil.repairAndParse<PersonInfo>(jsonMatch[0], this.logger);
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        this.logger.warn(`Failed to parse LLM extraction, falling back to regex: ${parseError.message}`);
        return await this.extractPersonInfoRegex(findings, emailAddress);
      }

      // Ensure required fields
      personInfo.emailAddresses = personInfo.emailAddresses || [emailAddress];
      personInfo.aliases = personInfo.aliases || [];
      personInfo.addresses = personInfo.addresses || [];
      personInfo.phoneNumbers = personInfo.phoneNumbers || [];
      personInfo.socialProfiles = personInfo.socialProfiles || [];

      return personInfo;
    } catch (error: any) {
      this.logger.error(`LLM extraction failed: ${error.message}, falling back to regex`);
      return await this.extractPersonInfoRegex(findings, emailAddress);
    }
  }

  /**
   * Fallback regex-based extraction
   */
  private async extractPersonInfoRegex(findings: any[], emailAddress: string): Promise<PersonInfo> {
    const personInfo: PersonInfo = {
      emailAddresses: [emailAddress],
      aliases: [],
      addresses: [],
      phoneNumbers: [],
      socialProfiles: [],
    };

    for (const finding of findings) {
      const content = finding.summary || finding.content || '';

      // Extract names
      const namePatterns = [
        /(?:name|owner|person|belongs to|registered to)[\s:]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/gi,
        /([A-Z][a-z]+\s+[A-Z][a-z]+)/g,
      ];

      for (const pattern of namePatterns) {
        const matches = content.match(pattern);
        if (matches) {
          matches.forEach((match) => {
            const name = match.replace(/^(?:name|owner|person|belongs to|registered to)[\s:]+/i, '').trim();
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

      // Extract phone numbers
      const phonePattern = /(?:phone|tel|call)[\s:]*\(?(\d{3})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})/gi;
      const phoneMatches = content.match(phonePattern);
      if (phoneMatches) {
        phoneMatches.forEach((match) => {
          const digits = match.replace(/\D/g, '');
          if (digits.length === 10 && !personInfo.phoneNumbers?.includes(digits)) {
            if (!personInfo.phoneNumbers) personInfo.phoneNumbers = [];
            personInfo.phoneNumbers.push(digits);
          }
        });
      }
    }

    return personInfo;
  }

  private async findSocialProfiles(username: string, domain: string, findings: any[]): Promise<any[]> {
    const profiles: any[] = [];
    const platforms = ['Instagram', 'Twitter', 'LinkedIn', 'Facebook', 'GitHub', 'Reddit', 'TikTok'];
    const checkedUsernames = new Set<string>();

    // Extract social media mentions from findings
    for (const finding of findings) {
      const content = finding.summary || finding.content || '';
      const socialPatterns = [
        { pattern: /(?:instagram|ig)[\s:]+@?([a-zA-Z0-9._]+)/gi, platform: 'Instagram' },
        { pattern: /(?:twitter|x)[\s:]+@?([a-zA-Z0-9._]+)/gi, platform: 'Twitter' },
        { pattern: /(?:facebook|fb)[\s:]+([a-zA-Z0-9._]+)/gi, platform: 'Facebook' },
        { pattern: /(?:linkedin)[\s:]+([a-zA-Z0-9._]+)/gi, platform: 'LinkedIn' },
        { pattern: /(?:github)[\s:]+([a-zA-Z0-9._-]+)/gi, platform: 'GitHub' },
        { pattern: /(?:reddit)[\s:]+u\/([a-zA-Z0-9._-]+)/gi, platform: 'Reddit' },
        { pattern: /(?:tiktok)[\s:]+@?([a-zA-Z0-9._]+)/gi, platform: 'TikTok' },
      ];

      for (const { pattern, platform } of socialPatterns) {
        const matches = content.match(pattern);
        if (matches) {
          matches.forEach((match) => {
            const extractedUsername = match.replace(/^(?:instagram|ig|twitter|x|facebook|fb|linkedin|github|reddit|tiktok)[\s:]+@?u\//i, '').trim();
            if (extractedUsername && !checkedUsernames.has(`${platform}:${extractedUsername}`)) {
              checkedUsernames.add(`${platform}:${extractedUsername}`);
              profiles.push({
                platform,
                username: extractedUsername,
                url: this.buildSocialUrl(platform, extractedUsername),
              });
            }
          });
        }
      }
    }

    // Also check the email username on common platforms using UsernameCheckerService
    try {
      const checkResults = await this.usernameChecker.check(username);
      for (const result of checkResults) {
        const key = `${result.platform}:${result.username}`;
        if (!checkedUsernames.has(key)) {
          checkedUsernames.add(key);
          profiles.push({
            platform: result.platform,
            username: result.username,
            url: result.url,
            verified: result.exists,
            bio: result.bio,
            profileImage: result.avatarUrl,
          });
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to check usernames: ${error.message}`);
      // Fallback: add profile URLs without verification
      for (const platform of platforms) {
        const key = `${platform}:${username}`;
        if (!checkedUsernames.has(key)) {
          profiles.push({
            platform,
            username,
            url: this.buildSocialUrl(platform, username),
          });
        }
      }
    }

    return profiles;
  }

  private buildSocialUrl(platform: string, username: string): string {
    const baseUrls: Record<string, string> = {
      Instagram: 'https://instagram.com/',
      Twitter: 'https://twitter.com/',
      Facebook: 'https://facebook.com/',
      LinkedIn: 'https://linkedin.com/in/',
      GitHub: 'https://github.com/',
      Reddit: 'https://reddit.com/user/',
      TikTok: 'https://tiktok.com/@',
    };
    return `${baseUrls[platform] || ''}${username}`;
  }

  private async findDataBreaches(emailAddress: string, findings: any[]): Promise<any[]> {
    const breaches: any[] = [];
    const breachKeywords = ['breach', 'leak', 'hacked', 'compromised', 'data breach', 'pwned'];

    for (const finding of findings) {
      const content = (finding.summary || finding.content || '').toLowerCase();
      for (const keyword of breachKeywords) {
        if (content.includes(keyword)) {
          // Extract service name if possible
          const serviceMatch = content.match(/(?:from|on|at)\s+([a-z]+\.(?:com|org|net|io))/i);
          breaches.push({
            service: serviceMatch ? serviceMatch[1] : 'Unknown',
            date: finding.timestamp || undefined,
            leakedData: ['email'], // Could be enhanced
          });
          break;
        }
      }
    }

    return breaches;
  }

  private async findWebActivity(emailAddress: string): Promise<any[]> {
    try {
      const searchResults = await this.webSearch.searchWebPages(`"${emailAddress}"`, 10);
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
    if (/directory|listing/.test(url)) return 'directory';
    if (/forum|reddit|discussion/.test(url)) return 'forum';
    if (/facebook|twitter|instagram|linkedin/.test(url)) return 'social';
    return 'other';
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

  private calculateConfidence(personInfo: any, resultCount: number, socialProfileCount: number): number {
    let confidence = 0;

    if (personInfo.fullName) confidence += 25;
    if (personInfo.addresses && personInfo.addresses.length > 0) confidence += 20;
    if (personInfo.phoneNumbers && personInfo.phoneNumbers.length > 0) confidence += 15;
    if (socialProfileCount > 0) confidence += 20;
    if (resultCount > 5) confidence += 10;
    if (resultCount > 10) confidence += 10;

    return Math.min(confidence, 100);
  }
}
