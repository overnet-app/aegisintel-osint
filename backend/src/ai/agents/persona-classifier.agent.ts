import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { OpenRouterService } from '../open-router.service';
import { LogicianAgent } from '../../research/agents/logician.agent';
import { CriticAgent } from '../../research/agents/critic.agent';

export interface PersonaProfile {
    id: string;
    personaType: 'developer' | 'artist' | 'musician' | 'business' | 'academic' | 'other';
    profession: string;
    industry: string[];
    location: {
        country: string;
        countryCode: string;
        city?: string;
    };
    interests: string[];
    languages: string[];
    distinguishingFeatures: string[];
    confidence: number;
}

export interface PersonaClassification {
    profiles: PersonaProfile[];
    groups: Array<{
        personaId: string;
        profileIds: string[];
        primaryPersona: PersonaProfile;
    }>;
}

@Injectable()
export class PersonaClassifierAgent {
    private readonly logger = new Logger(PersonaClassifierAgent.name);

    constructor(
        private openRouter: OpenRouterService,
        @Inject(forwardRef(() => LogicianAgent))
        private logicianAgent?: LogicianAgent,
        @Inject(forwardRef(() => CriticAgent))
        private criticAgent?: CriticAgent,
    ) { }

    async classifyProfiles(
        profiles: any[],
        model?: string,
    ): Promise<PersonaClassification> {
        this.logger.log(`Classifying ${profiles.length} profiles into personas`);

        if (profiles.length === 0) {
            return { profiles: [], groups: [] };
        }

        const prompt = `You are an expert OSINT analyst specializing in persona identification. Analyze the following profiles and classify each into distinct personas based on profession, location, interests, and other distinguishing characteristics.

Profiles to analyze:
${JSON.stringify(profiles, null, 2)}

For each profile, determine:
1. **Persona Type**: developer, artist, musician, business, academic, or other
2. **Profession**: Specific job title or role (e.g., "Senior Software Engineer", "Guitarist", "Abstract Painter")
3. **Industry**: Array of industries (e.g., ["Technology", "Software"], ["Music", "Entertainment"], ["Art", "Design"])
4. **Location**: Extract country and optionally city from bio, location fields, or content
5. **Interests**: Technologies, skills, hobbies, or topics mentioned (e.g., ["Python", "React", "Cloud"], ["Guitar", "Rock Music"], ["Abstract Art", "Exhibitions"])
6. **Languages**: Languages detected in content or bio
7. **Distinguishing Features**: Key characteristics that make this persona unique
8. **Confidence**: 0-100 score for how confident you are in this classification

Also, group profiles that likely belong to the same person across different platforms.

Return a JSON response with this structure:
{
  "profiles": [
    {
      "id": "profile-id-or-url",
      "personaType": "developer" | "artist" | "musician" | "business" | "academic" | "other",
      "profession": "Specific profession title",
      "industry": ["industry1", "industry2"],
      "location": {
        "country": "Country name",
        "countryCode": "ISO country code (e.g., 'RO', 'ES', 'GB')",
        "city": "City name if available"
      },
      "interests": ["interest1", "interest2"],
      "languages": ["language1", "language2"],
      "distinguishingFeatures": ["feature1", "feature2"],
      "confidence": 85
    }
  ],
  "groups": [
    {
      "personaId": "unique-persona-id",
      "profileIds": ["profile-id-1", "profile-id-2"],
      "primaryPersona": { /* PersonaProfile object */ }
    }
  ]
}

Guidelines:
- If a profile mentions "developer", "engineer", "programmer", "coder", or has GitHub activity, classify as "developer"
- If a profile mentions "musician", "guitarist", "singer", or has music-related content, classify as "musician"
- If a profile mentions "artist", "painter", "designer", or has art-related content, classify as "artist"
- Extract location from bio text, location fields, or content (e.g., "Based in Romania", "Bucharest, RO", "Spain")
- Group profiles with same name, similar profession, and same location as likely the same person
- Use platform as a hint (GitHub = likely developer, Spotify = likely musician, Behance = likely designer)
- If location cannot be determined, use empty strings
- Confidence should reflect how clear the indicators are

Example:
Input: Profile with bio "Senior Software Engineer at TechCorp. Python, React, Cloud. Based in Bucharest, Romania"
Output:
{
  "profiles": [{
    "id": "profile-url",
    "personaType": "developer",
    "profession": "Senior Software Engineer",
    "industry": ["Technology", "Software"],
    "location": {
      "country": "Romania",
      "countryCode": "RO",
      "city": "Bucharest"
    },
    "interests": ["Python", "React", "Cloud"],
    "languages": ["English", "Romanian"],
    "distinguishingFeatures": ["TechCorp employee", "Cloud expertise"],
    "confidence": 95
  }],
  "groups": [{
    "personaId": "persona-1",
    "profileIds": ["profile-url"],
    "primaryPersona": { /* same as profile above */ }
  }]
}

Now classify these profiles:`;

        try {
            const response = await this.openRouter.complete(prompt, model);
            
            // Extract JSON from response
            let jsonStr = response.trim();
            if (jsonStr.startsWith('```')) {
                jsonStr = jsonStr.replace(/^```(?:json)?\n/, '').replace(/\n```$/, '');
            }

            let classification = JSON.parse(jsonStr) as PersonaClassification;
            
            // Validate and set defaults
            if (!classification.profiles) classification.profiles = [];
            if (!classification.groups) classification.groups = [];

            // Ensure all profiles have required fields
            classification.profiles = classification.profiles.map(p => ({
                ...p,
                personaType: p.personaType || 'other',
                profession: p.profession || 'Unknown',
                industry: p.industry || [],
                location: p.location || { country: '', countryCode: '' },
                interests: p.interests || [],
                languages: p.languages || [],
                distinguishingFeatures: p.distinguishingFeatures || [],
                confidence: p.confidence || 0,
            }));

            this.logger.log(`Classification complete: ${classification.profiles.length} personas, ${classification.groups.length} groups`);
            
            // Validate classification with LogicianAgent and CriticAgent if available
            if (this.logicianAgent && this.criticAgent) {
                try {
                    classification = await this.validateClassification(classification, profiles, model);
                } catch (error: any) {
                    this.logger.warn(`Classification validation failed: ${error.message}`);
                }
            }
            
            return classification;
        } catch (error) {
            this.logger.error(`Failed to classify personas: ${error.message}`);
            
            // Fallback: create basic personas from profiles
            const fallbackProfiles: PersonaProfile[] = profiles.map((profile, idx) => ({
                id: profile.url || `profile-${idx}`,
                personaType: this.inferPersonaType(profile),
                profession: this.extractProfession(profile),
                industry: this.extractIndustry(profile),
                location: this.extractLocation(profile),
                interests: this.extractInterests(profile),
                languages: [],
                distinguishingFeatures: [],
                confidence: 50,
            }));

            return {
                profiles: fallbackProfiles,
                groups: fallbackProfiles.map((p, idx) => ({
                    personaId: `persona-${idx}`,
                    profileIds: [p.id],
                    primaryPersona: p,
                })),
            };
        }
    }

    private inferPersonaType(profile: any): PersonaProfile['personaType'] {
        const platform = profile.platform?.toLowerCase() || '';
        const bio = (profile.bio || '').toLowerCase();
        const fullName = (profile.fullName || '').toLowerCase();

        if (platform === 'github' || bio.includes('developer') || bio.includes('engineer') || bio.includes('programmer')) {
            return 'developer';
        }
        if (bio.includes('musician') || bio.includes('guitarist') || bio.includes('singer') || bio.includes('music')) {
            return 'musician';
        }
        if (bio.includes('artist') || bio.includes('painter') || bio.includes('designer')) {
            return 'artist';
        }
        if (bio.includes('professor') || bio.includes('researcher') || bio.includes('academic')) {
            return 'academic';
        }
        if (bio.includes('ceo') || bio.includes('founder') || bio.includes('business')) {
            return 'business';
        }
        return 'other';
    }

    private extractProfession(profile: any): string {
        const bio = profile.bio || '';
        // Try to extract profession from bio
        const professionPatterns = [
            /(?:Senior|Junior|Lead)?\s*(?:Software|Full.?Stack|Front.?end|Back.?end|DevOps|Data|Machine Learning|ML|AI)\s*(?:Engineer|Developer|Programmer)/i,
            /(?:Senior|Junior|Lead)?\s*(?:Guitarist|Musician|Singer|Composer)/i,
            /(?:Abstract|Digital|Portrait)?\s*(?:Painter|Artist|Designer)/i,
            /(?:Professor|Researcher|PhD|Doctor)/i,
            /(?:CEO|CTO|Founder|Co-founder)/i,
        ];

        for (const pattern of professionPatterns) {
            const match = bio.match(pattern);
            if (match) {
                return match[0].trim();
            }
        }

        return 'Unknown';
    }

    private extractIndustry(profile: any): string[] {
        const bio = (profile.bio || '').toLowerCase();
        const industries: string[] = [];

        if (bio.includes('tech') || bio.includes('software') || bio.includes('developer')) {
            industries.push('Technology');
        }
        if (bio.includes('music') || bio.includes('guitar') || bio.includes('singer')) {
            industries.push('Music');
        }
        if (bio.includes('art') || bio.includes('design') || bio.includes('painter')) {
            industries.push('Art');
        }
        if (bio.includes('education') || bio.includes('university') || bio.includes('research')) {
            industries.push('Education');
        }

        return industries.length > 0 ? industries : ['Other'];
    }

    private extractLocation(profile: any): PersonaProfile['location'] {
        const bio = (profile.bio || '').toLowerCase();
        const location = profile.location || '';

        // Common country patterns
        const countryPatterns: Array<[RegExp, string, string]> = [
            [/romania|romanian|bucharest|cluj|iasi/i, 'Romania', 'RO'],
            [/spain|spanish|madrid|barcelona|valencia/i, 'Spain', 'ES'],
            [/united kingdom|uk|britain|british|london|manchester/i, 'United Kingdom', 'GB'],
            [/france|french|paris|lyon|marseille/i, 'France', 'FR'],
            [/germany|german|berlin|munich|hamburg/i, 'Germany', 'DE'],
            [/italy|italian|rome|milan|naples/i, 'Italy', 'IT'],
            [/usa|united states|us|america|american|new york|california/i, 'United States', 'US'],
        ];

        const searchText = `${bio} ${location}`.toLowerCase();
        for (const [pattern, country, code] of countryPatterns) {
            if (pattern.test(searchText)) {
                return { country, countryCode: code };
            }
        }

        return { country: '', countryCode: '' };
    }

    private extractInterests(profile: any): string[] {
        const bio = (profile.bio || '').toLowerCase();
        const interests: string[] = [];

        // Technology interests
        const techKeywords = ['python', 'javascript', 'react', 'node', 'java', 'c++', 'cloud', 'aws', 'docker', 'kubernetes'];
        techKeywords.forEach(keyword => {
            if (bio.includes(keyword)) {
                interests.push(keyword.charAt(0).toUpperCase() + keyword.slice(1));
            }
        });

        // Music interests
        const musicKeywords = ['guitar', 'piano', 'rock', 'jazz', 'classical', 'electronic'];
        musicKeywords.forEach(keyword => {
            if (bio.includes(keyword)) {
                interests.push(keyword.charAt(0).toUpperCase() + keyword.slice(1));
            }
        });

        // Art interests
        const artKeywords = ['abstract', 'portrait', 'digital art', 'exhibitions', 'gallery'];
        artKeywords.forEach(keyword => {
            if (bio.includes(keyword)) {
                interests.push(keyword.charAt(0).toUpperCase() + keyword.slice(1));
            }
        });

        return interests;
    }

    /**
     * Validate persona classification using LogicianAgent and CriticAgent
     */
    private async validateClassification(
        classification: PersonaClassification,
        originalProfiles: any[],
        model?: string,
    ): Promise<PersonaClassification> {
        if (!this.logicianAgent || !this.criticAgent) {
            return classification;
        }

        this.logger.log('Validating persona classification with research agents');

        // Convert persona classifications to facts for validation
        const facts: string[] = [];
        for (const profile of classification.profiles) {
            facts.push(
                `Profile ${profile.id} is classified as ${profile.personaType} with profession "${profile.profession}" ` +
                `in ${profile.location.country || 'unknown location'} with confidence ${profile.confidence}%`
            );
        }

        // Create mock ScoutFindings for validation
        const mockFindings = [{
            directiveId: 1,
            tool: 'persona_classifier',
            query: 'Persona classification',
            rawData: facts.map(fact => ({
                fact,
                source: {
                    url: 'persona-classification',
                    title: 'Persona Classification',
                    snippet: fact,
                    reliability: 'medium' as const,
                    type: 'other' as const,
                },
                timestamp: new Date().toISOString(),
            })),
            searchOperators: [],
            credibilityScore: 70,
        }];

        // Validate with LogicianAgent
        const logicianVerdict = await this.logicianAgent.validateFindings(
            mockFindings as any,
            undefined,
            'openrouter',
            model || 'google/gemma-3-27b-it',
        );

        // Review with CriticAgent
        const criticReview = await this.criticAgent.reviewFindings(
            mockFindings as any,
            logicianVerdict,
            undefined,
            'openrouter',
            model || 'google/gemma-3-27b-it',
        );

        // Adjust confidence scores based on validation
        const qualityScore = criticReview.overallAssessment.qualityScore || 70;
        const adjustmentFactor = qualityScore / 100;

        classification.profiles = classification.profiles.map(profile => {
            // Adjust confidence based on validation quality
            const adjustedConfidence = Math.min(100, Math.round(profile.confidence * adjustmentFactor));
            
            // If validation found contradictions, reduce confidence further
            const hasContradictions = logicianVerdict.contradictions?.some(c => 
                c.claim1?.fact?.includes(profile.id) || c.claim2?.fact?.includes(profile.id)
            );
            
            const finalConfidence = hasContradictions 
                ? Math.max(0, adjustedConfidence - 20)
                : adjustedConfidence;

            return {
                ...profile,
                confidence: finalConfidence,
            };
        });

        this.logger.log(
            `Classification validated: Quality ${qualityScore}%, ` +
            `${logicianVerdict.contradictions?.length || 0} contradictions, ` +
            `confidence scores adjusted`
        );

        return classification;
    }
}
