import { Injectable, Logger } from '@nestjs/common';
import { ImageLookupResult, LookupOptions, PersonInfo } from '../types/lookup.types';
import { ScoutAgent } from '../../research/agents/scout.agent';
import { ResearchDetectiveAgent } from '../../research/agents/research-detective.agent';
import { RelationshipAgent } from '../../ai/agents/relationship.agent';
import { FaceAgent } from '../../ai/agents/face.agent';
import { VisionAgent } from '../../research/agents/vision.agent';
import { WebSearchService } from '../../search/web-search.service';
import { StreamManagerService } from '../../research/streaming/stream-manager.service';
import { AgentModelResolverService } from '../../research/services/agent-model-resolver.service';
import { OpenRouterService } from '../../ai/open-router.service';
import { JsonRepairUtil } from '../../research/utils/json-repair.util';

@Injectable()
export class ImageLookupService {
  private readonly logger = new Logger(ImageLookupService.name);

  constructor(
    private scoutAgent: ScoutAgent,
    private detectiveAgent: ResearchDetectiveAgent,
    private relationshipAgent: RelationshipAgent,
    private faceAgent: FaceAgent,
    private visionAgent: VisionAgent,
    private openRouter: OpenRouterService,
    private webSearch: WebSearchService,
    private streamManager: StreamManagerService,
    private agentModelResolver: AgentModelResolverService,
  ) {}

  async lookup(imageUrl: string, options: LookupOptions = {}): Promise<ImageLookupResult> {
    this.logger.log(`Looking up image: ${imageUrl}`);

    const sessionId = options.sessionId || `image-lookup-${Date.now()}`;
    const userId = options.userId;

    try {
      const scoutModel = await this.agentModelResolver.resolveAgentModel(userId || '', 'scout', 'openrouter', 'google/gemma-3-27b-it');
      const detectiveModel = await this.agentModelResolver.resolveAgentModel(userId || '', 'research_detective', 'openrouter', 'google/gemma-3-27b-it');
      const thinkerModel = await this.agentModelResolver.resolveAgentModel(userId || '', 'thinker', 'openrouter', 'google/gemma-3-27b-it');
      const visionModel = await this.agentModelResolver.resolveAgentModel(userId || '', 'vision', 'openrouter', 'google/gemma-3-4b-it:free');

      this.streamManager.streamChunk(sessionId, 'Analyzing image with AI vision...', 'thinking');

      // 1. Analyze image with VisionAgent to extract text, metadata, and context
      let imageAnalysis: string = '';
      try {
        const visionResult = await this.visionAgent.analyzeImage(
          imageUrl,
          visionModel.provider,
          visionModel.model,
        );
        // Convert ImageAnalysis to string description
        imageAnalysis = visionResult.context || 
                       visionResult.text?.join(' ') || 
                       visionResult.objects?.map(o => o.name).join(', ') || 
                       '';
        this.streamManager.streamChunk(sessionId, 'Image analysis complete', 'thinking');
      } catch (error: any) {
        this.logger.warn(`Vision analysis failed: ${error.message}. Continuing without vision analysis.`);
        // Continue without vision analysis - we can still do reverse image search
        imageAnalysis = '';
      }

      this.streamManager.streamChunk(sessionId, 'Performing reverse image search...', 'thinking');

      // 2. Perform reverse image search (with error handling)
      let reverseSearchResults: any[] = [];
      try {
        reverseSearchResults = await this.webSearch.reverseImageSearch(imageUrl);
        this.streamManager.streamChunk(sessionId, `Found ${reverseSearchResults.length} reverse image matches`, 'thinking');
      } catch (error: any) {
        this.logger.warn(`Reverse image search failed: ${error.message}. Continuing with available data.`);
        this.streamManager.streamChunk(sessionId, 'Reverse image search unavailable, using alternative methods...', 'thinking');
        // Continue without reverse search results - we can still extract info from image analysis
        reverseSearchResults = [];
      }

      // 3. Detect faces in image (optional - continue even if it fails)
      this.streamManager.streamChunk(sessionId, 'Detecting faces in image...', 'thinking');
      let faceResults: any[] = [];
      try {
        faceResults = await this.faceAgent.analyzeFaces(
          [{ recentPosts: [{ thumbnail: imageUrl }] }],
          { useClarifai: true, sessionId },
        );
        if (faceResults.length > 0) {
          this.streamManager.streamChunk(sessionId, `Detected ${faceResults.length} face(s)`, 'thinking');
        }
      } catch (error: any) {
        this.logger.warn(`Face detection failed: ${error.message}. Continuing without face detection.`);
        // Continue without face detection - not critical for lookup
        faceResults = [];
      }

      // 4. Extract person identification using LLM-based extraction
      // Even if reverse search or face detection failed, we can still try to extract info from image analysis
      this.streamManager.streamChunk(sessionId, 'Extracting person information using AI...', 'thinking');
      let identifiedPersons: any[] = [];
      try {
        identifiedPersons = await this.extractPersonIdentificationLLM(
          reverseSearchResults,
          faceResults,
          imageAnalysis,
          thinkerModel,
        );
      } catch (error: any) {
        this.logger.warn(`Person identification extraction failed: ${error.message}. Trying fallback.`);
        // Fallback to regex-based extraction if LLM fails
        try {
          identifiedPersons = await this.extractPersonIdentificationRegex(reverseSearchResults, faceResults);
        } catch (fallbackError: any) {
          this.logger.error(`Fallback extraction also failed: ${fallbackError.message}`);
          identifiedPersons = [];
        }
      }

      // 4. Search for additional information about identified persons
      let relationships: any[] = [];
      let locationInfo: any[] = [];
      let socialProfiles: any[] = [];

      if (identifiedPersons.length > 0) {
        this.streamManager.streamChunk(sessionId, 'Finding relationships and connections...', 'thinking');

        // Use ScoutAgent to search for each identified person
        for (const person of identifiedPersons) {
          if (person.personInfo.fullName) {
            const searchQueries = [
              `"${person.personInfo.fullName}"`,
              `${person.personInfo.fullName} profile`,
              `${person.personInfo.fullName} social media`,
            ];

            const plan = {
              queryType: 'factual' as const,
              complexity: 'moderate' as const,
              requiresQuant: false,
              semanticClusters: searchQueries.map((q, idx) => ({
                theme: `Person search ${idx + 1}`,
                subQueries: [q],
                priority: idx + 1,
              })),
              searchDirectives: searchQueries.map((q, idx) => ({
                step: idx + 1,
                action: 'search' as const,
                tool: 'web_search',
                query: q,
                reason: `Search for person information`,
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

            // Extract relationships
            const detectiveAnalysis = await this.detectiveAgent.analyzeFindings(
              person.personInfo.fullName,
              findings,
              detectiveModel.provider,
              detectiveModel.model,
            );

            if (detectiveAnalysis.correlations) {
              for (const correlation of detectiveAnalysis.correlations) {
                if (correlation.items && correlation.items.length >= 2) {
                  relationships.push({
                    type: 'unknown' as const,
                    name: correlation.items[1],
                    relationship: correlation.relationship,
                    confidence: correlation.confidence || 50,
                    sources: ['detective_analysis'],
                  });
                }
              }
            }

            // Extract location info
            const extractedLocations = this.extractLocationInfo(findings);
            if (extractedLocations.length > 0) {
              locationInfo.push(...extractedLocations);
            }

            // Extract social profiles
            const extractedProfiles = this.extractSocialProfiles(findings);
            if (extractedProfiles.length > 0) {
              socialProfiles.push(...extractedProfiles);
            }
          }
        }
      }

      // 5. Find web activity
      let webActivity: any[] = [];
      if (options.includeWebActivity !== false && identifiedPersons.length > 0) {
        this.streamManager.streamChunk(sessionId, 'Searching for web mentions...', 'thinking');
        for (const person of identifiedPersons) {
          if (person.personInfo.fullName) {
            const activity = await this.findWebActivity(person.personInfo.fullName);
            webActivity.push(...activity);
          }
        }
      }

      // 6. Calculate confidence (adjust based on available data)
      const confidence = this.calculateConfidence(
        identifiedPersons.length, 
        reverseSearchResults.length, 
        faceResults?.length || 0,
        imageAnalysis ? 1 : 0, // Bonus if we have image analysis
      );

      // 7. Collect sources
      const sources = reverseSearchResults.map((r) => r.url).filter(Boolean);

      const result: ImageLookupResult = {
        imageUrl,
        identifiedPersons: identifiedPersons.length > 0 ? identifiedPersons : undefined,
        relationships: relationships.length > 0 ? relationships : undefined,
        locationInfo: locationInfo.length > 0 ? locationInfo : undefined,
        socialProfiles: socialProfiles.length > 0 ? socialProfiles : undefined,
        webActivity: webActivity.length > 0 ? webActivity : undefined,
        reverseImageMatches: reverseSearchResults.length > 0 ? reverseSearchResults.map((r) => ({
          url: r.url,
          title: r.title,
          source: r.source,
        })) : undefined,
        confidence,
        sources,
        timestamp: new Date(),
      };

      this.logger.log(`Image lookup completed: ${identifiedPersons.length} person(s) identified (${confidence}% confidence)`);
      return result;
    } catch (error: any) {
      this.logger.error(`Image lookup failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Extract person identification using LLM-based extraction
   */
  private async extractPersonIdentificationLLM(
    reverseSearchResults: any[],
    faceResults: any[],
    imageAnalysis: string,
    thinkerModel: { provider: string; model: string },
  ): Promise<any[]> {
    try {
      // Prepare data for LLM analysis
      const reverseSearchText = reverseSearchResults
        .map((r, idx) => `[Result ${idx + 1}]\nTitle: ${r.title || 'N/A'}\nURL: ${r.url || 'N/A'}\nSource: ${r.source || 'N/A'}`)
        .join('\n\n---\n\n')
        .substring(0, 6000);

      const faceInfo = faceResults.length > 0
        ? `Face Detection Results: ${faceResults.length} face(s) detected.`
        : 'No faces detected.';

      const extractionPrompt = `You are analyzing reverse image search results and image analysis to identify people in an image.

Image Analysis:
${imageAnalysis || 'No image analysis available.'}

${faceInfo}

Reverse Image Search Results:
${reverseSearchText}

Extract and return a JSON array of identified persons with the following structure:
[
  {
    "personInfo": {
      "fullName": "Full name if found",
      "firstName": "First name if found",
      "lastName": "Last name if found",
      "aliases": ["any alternative names"],
      "socialProfiles": [
        {
          "platform": "Instagram|Twitter|Facebook|LinkedIn|GitHub|Reddit|TikTok",
          "username": "username if found",
          "url": "full profile URL if found"
        }
      ],
      "profession": "profession if mentioned",
      "company": "company if mentioned"
    },
    "context": "Context where this person was found (e.g., article title, page description)",
    "faceMatch": {
      "confidence": number (0-100),
      "source": "reverse_image_search|face_detection|image_analysis"
    }
  }
]

Return ONLY valid JSON array, no markdown formatting. If no persons are identified, return an empty array [].`;

      // Use OpenRouter for extraction
      const extractionResult = await this.openRouter.complete(
        extractionPrompt,
        thinkerModel.model as any,
        false,
      );

      // Parse the JSON response
      let identifiedPersons: any[];
      try {
        const jsonMatch = extractionResult.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          identifiedPersons = JsonRepairUtil.repairAndParse<any[]>(jsonMatch[0], this.logger);
        } else {
          throw new Error('No JSON array found in response');
        }
      } catch (parseError) {
        this.logger.warn(`Failed to parse LLM extraction, falling back to regex: ${parseError.message}`);
        return await this.extractPersonIdentificationRegex(reverseSearchResults, faceResults);
      }

      // Ensure face match info is added if face detection was successful
      if (faceResults.length > 0 && identifiedPersons.length > 0) {
        identifiedPersons.forEach((person) => {
          if (!person.faceMatch) {
            person.faceMatch = {
              confidence: 70,
              source: 'face_detection',
            };
          }
        });
      }

      return identifiedPersons;
    } catch (error: any) {
      this.logger.error(`LLM extraction failed: ${error.message}, falling back to regex`);
      return await this.extractPersonIdentificationRegex(reverseSearchResults, faceResults);
    }
  }

  /**
   * Fallback regex-based extraction
   */
  private async extractPersonIdentificationRegex(reverseSearchResults: any[], faceResults: any[]): Promise<any[]> {
    const identifiedPersons: any[] = [];

    // Extract names and information from reverse search result titles and URLs
    for (const result of reverseSearchResults) {
      const title = result.title || '';
      const url = result.url || '';

      // Extract names from titles
      const namePatterns = [
        /([A-Z][a-z]+\s+[A-Z][a-z]+)/g,
        /(?:by|from|author|photographer)[\s:]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi,
      ];

      for (const pattern of namePatterns) {
        const matches = title.match(pattern);
        if (matches) {
          matches.forEach((match) => {
            const name = match.replace(/^(?:by|from|author|photographer)[\s:]+/i, '').trim();
            if (name && name.length > 3) {
              const parts = name.split(/\s+/);
              if (parts.length >= 2) {
                // Check if we already have this person
                const existing = identifiedPersons.find((p) => p.personInfo.fullName === name);
                if (!existing) {
                  identifiedPersons.push({
                    personInfo: {
                      fullName: name,
                      firstName: parts[0],
                      lastName: parts[parts.length - 1],
                      socialProfiles: this.extractSocialProfilesFromUrl(url),
                    },
                    context: title,
                    faceMatch: faceResults.length > 0 ? {
                      confidence: 70,
                      source: 'reverse_image_search',
                    } : undefined,
                  });
                }
              }
            }
          });
        }
      }
    }

    return identifiedPersons;
  }

  private extractSocialProfilesFromUrl(url: string): any[] {
    const profiles: any[] = [];
    const platformPatterns = [
      { platform: 'Instagram', pattern: /instagram\.com\/([a-zA-Z0-9._]+)/ },
      { platform: 'Twitter', pattern: /twitter\.com\/([a-zA-Z0-9._]+)/ },
      { platform: 'Facebook', pattern: /facebook\.com\/([a-zA-Z0-9._]+)/ },
      { platform: 'LinkedIn', pattern: /linkedin\.com\/in\/([a-zA-Z0-9._-]+)/ },
    ];

    for (const { platform, pattern } of platformPatterns) {
      const match = url.match(pattern);
      if (match) {
        profiles.push({
          platform,
          username: match[1],
          url,
        });
      }
    }

    return profiles;
  }

  private extractLocationInfo(findings: any[]): any[] {
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
            locations.push({ fullAddress: addr });
          }
        });
      }
    }

    return locations;
  }

  private extractSocialProfiles(findings: any[]): any[] {
    const profiles: any[] = [];
    const seen = new Set<string>();

    for (const finding of findings) {
      const content = finding.summary || finding.content || '';
      const url = finding.sourceUrl || '';

      // Extract from content
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
            const key = `${platform}:${username}`;
            if (username && !seen.has(key)) {
              seen.add(key);
              profiles.push({
                platform,
                username,
                url: this.buildSocialUrl(platform, username),
              });
            }
          });
        }
      }

      // Extract from URL
      const urlProfiles = this.extractSocialProfilesFromUrl(url);
      urlProfiles.forEach((p) => {
        const key = `${p.platform}:${p.username}`;
        if (!seen.has(key)) {
          seen.add(key);
          profiles.push(p);
        }
      });
    }

    return profiles;
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

  private async findWebActivity(name: string): Promise<any[]> {
    try {
      const searchResults = await this.webSearch.searchWebPages(`"${name}"`, 10);
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

  private calculateConfidence(
    identifiedCount: number, 
    reverseMatchCount: number, 
    faceCount: number,
    hasImageAnalysis: number = 0,
  ): number {
    let confidence = 0;

    if (identifiedCount > 0) confidence += 40;
    if (reverseMatchCount > 5) confidence += 20;
    if (reverseMatchCount > 10) confidence += 10;
    if (faceCount > 0) confidence += 20;
    if (identifiedCount > 1) confidence += 10;
    if (hasImageAnalysis > 0) confidence += 10; // Bonus for successful image analysis

    return Math.min(confidence, 100);
  }
}
