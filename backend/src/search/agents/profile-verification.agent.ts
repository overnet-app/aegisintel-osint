import { Injectable } from '@nestjs/common';
import { OpenRouterService } from '../../ai/open-router.service';
import { BaseResearchAgent } from '../../research/agents/base-research-agent';
import { McpClientService } from '../../mcp/mcp-client.service';

export interface ProfileVerificationResult {
    profileId: string;
    platform: string;
    username: string;
    authenticityScore: number; // 0-100
    isVerified: boolean;
    isBot: boolean;
    isImpersonation: boolean;
    consistencyScore: number; // 0-100
    crossPlatformMatches: Array<{
        platform: string;
        username: string;
        matchScore: number;
        consistency: 'high' | 'medium' | 'low';
    }>;
    redFlags: Array<{
        type: 'inconsistent_bio' | 'suspicious_activity' | 'low_engagement' | 'recent_creation' | 'impersonation_indicators' | 'bot_indicators' | 'unknown';
        description: string;
        severity: 'high' | 'medium' | 'low';
    }>;
    verificationFactors: Array<{
        factor: string;
        status: 'verified' | 'suspicious' | 'unknown';
        evidence: string;
    }>;
}

@Injectable()
export class ProfileVerificationAgent extends BaseResearchAgent {
    constructor(
        openRouter: OpenRouterService,
        mcpClient: McpClientService,
    ) {
        super(openRouter, mcpClient);
    }

    async verifyProfile(
        profileData: {
            platform: string;
            username: string;
            bio?: string;
            avatarUrl?: string;
            stats?: {
                followers?: number;
                following?: number;
                posts?: number;
            };
            recentPosts?: Array<{
                text?: string;
                timestamp?: string;
                likes?: number;
                comments?: number;
            }>;
            createdAt?: string;
        },
        crossPlatformData?: Array<{
            platform: string;
            username: string;
            bio?: string;
            stats?: any;
        }>,
        provider: string = 'openrouter',
        model: string = 'google/gemma-3-27b-it',
    ): Promise<ProfileVerificationResult> {
        this.logger.log(`Verifying profile: ${profileData.platform}/${profileData.username} (${provider}:${model})`);

        const prompt = `You are an OSINT expert specializing in profile verification and authenticity detection.

Analyze the following profile data to determine:
1. Profile authenticity (real person vs bot/fake)
2. Impersonation indicators
3. Cross-platform consistency
4. Red flags and suspicious patterns

Profile Data:
Platform: ${profileData.platform}
Username: ${profileData.username}
Bio: ${profileData.bio || 'N/A'}
Avatar: ${profileData.avatarUrl ? 'Present' : 'Missing'}
Followers: ${profileData.stats?.followers || 'N/A'}
Following: ${profileData.stats?.following || 'N/A'}
Posts: ${profileData.stats?.posts || 'N/A'}
Account Created: ${profileData.createdAt || 'Unknown'}
Recent Posts: ${profileData.recentPosts?.length || 0} posts

${crossPlatformData && crossPlatformData.length > 0 ? `Cross-Platform Data:
${JSON.stringify(crossPlatformData, null, 2)}` : ''}

Return a JSON object with this EXACT structure:
{
  "authenticityScore": 85,
  "isVerified": true,
  "isBot": false,
  "isImpersonation": false,
  "consistencyScore": 90,
  "crossPlatformMatches": [
    {
      "platform": "Twitter",
      "username": "same_username",
      "matchScore": 95,
      "consistency": "high"
    }
  ],
  "redFlags": [
    {
      "type": "low_engagement",
      "description": "Very low engagement rate compared to follower count",
      "severity": "medium"
    }
  ],
  "verificationFactors": [
    {
      "factor": "bio_consistency",
      "status": "verified",
      "evidence": "Bio matches across platforms"
    },
    {
      "factor": "activity_pattern",
      "status": "suspicious",
      "evidence": "Posts only during business hours, no weekend activity"
    }
  ]
}

CRITICAL GUIDELINES:
- authenticityScore: 0-100 (higher = more authentic)
- isBot: true if profile shows bot-like behavior (e.g., very high follower/following ratio, generic posts, no interactions)
- isImpersonation: true if profile appears to impersonate someone else
- consistencyScore: 0-100 (higher = more consistent across platforms)
- redFlags: List any suspicious patterns
- verificationFactors: List factors that support or contradict authenticity
- Return ONLY valid JSON, no markdown formatting`;

        try {
            const response = await this.callLLM(prompt, provider, model);
            let jsonStr = response.trim();

            // Remove markdown code blocks
            if (jsonStr.startsWith('```')) {
                jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
            }

            // Extract JSON
            const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                jsonStr = jsonMatch[0];
            }

            // Fix common JSON issues
            jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
            jsonStr = jsonStr.replace(/[\x00-\x1F\x7F]/g, ' ');

            const result = JSON.parse(jsonStr) as Omit<ProfileVerificationResult, 'profileId' | 'platform' | 'username'>;

            return {
                profileId: `${profileData.platform}_${profileData.username}`,
                platform: profileData.platform,
                username: profileData.username,
                authenticityScore: result.authenticityScore || 50,
                isVerified: result.isVerified || false,
                isBot: result.isBot || false,
                isImpersonation: result.isImpersonation || false,
                consistencyScore: result.consistencyScore || 50,
                crossPlatformMatches: result.crossPlatformMatches || [],
                redFlags: result.redFlags || [],
                verificationFactors: result.verificationFactors || [],
            };
        } catch (error: any) {
            this.logger.error(`Profile verification failed: ${error.message}`);
            
            // Return default result on error
            return {
                profileId: `${profileData.platform}_${profileData.username}`,
                platform: profileData.platform,
                username: profileData.username,
                authenticityScore: 50,
                isVerified: false,
                isBot: false,
                isImpersonation: false,
                consistencyScore: 50,
                crossPlatformMatches: [],
                redFlags: [{
                    type: 'unknown',
                    description: 'Verification failed due to error',
                    severity: 'low',
                }],
                verificationFactors: [],
            };
        }
    }

    async verifyMultipleProfiles(
        profiles: Array<{
            platform: string;
            username: string;
            bio?: string;
            stats?: any;
        }>,
        provider: string = 'openrouter',
        model: string = 'google/gemma-3-27b-it',
    ): Promise<ProfileVerificationResult[]> {
        this.logger.log(`Verifying ${profiles.length} profiles (${provider}:${model})`);

        const results: ProfileVerificationResult[] = [];

        for (const profile of profiles) {
            try {
                // Get cross-platform data (other profiles)
                const crossPlatformData = profiles.filter(p => p.platform !== profile.platform);
                
                const result = await this.verifyProfile(
                    profile,
                    crossPlatformData.length > 0 ? crossPlatformData : undefined,
                    provider,
                    model,
                );
                
                results.push(result);
            } catch (error: any) {
                this.logger.warn(`Failed to verify profile ${profile.platform}/${profile.username}: ${error.message}`);
            }
        }

        return results;
    }
}
