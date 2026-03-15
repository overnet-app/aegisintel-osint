import { Injectable, Logger } from '@nestjs/common';
import { OpenRouterService } from '../open-router.service';
import { PatternAnalysis } from '../services/pattern-detector.service';
import { TimelineEvent } from '../../search/timeline.service';

const PSYCH_PROFILE_PROMPT = (data: string, patterns: string) => `
You are a behavioral psychologist analyzing open-source intelligence (OSINT) data to create a psychological and pathological profile.

Analyze the following data and patterns:

${data}

Behavioral Patterns Detected:
${patterns}

Based on this information, provide a comprehensive psychological profile including:

1. **Personality Traits (Big Five Model)**:
   - Openness to Experience (high/medium/low)
   - Conscientiousness (high/medium/low)
   - Extraversion (high/medium/low)
   - Agreeableness (high/medium/low)
   - Neuroticism (high/medium/low)

2. **Communication Style**:
   - Writing style and tone
   - Frequency and consistency of communication
   - Preferred topics and interests

3. **Behavioral Indicators**:
   - Activity patterns (time of day, frequency)
   - Engagement with others
   - Sentiment and emotional patterns

4. **Risk Assessment**:
   - Any concerning behavioral patterns
   - Potential red flags
   - Risk level (LOW/MEDIUM/HIGH)

5. **Interests and Values**:
   - Primary interests based on content analysis
   - Values and priorities inferred from behavior

6. **Pathological Indicators** (if any):
   - Signs of mental health concerns
   - Behavioral anomalies
   - Social interaction patterns

Provide your analysis in a structured format. Be objective, evidence-based, and note any limitations in the data. Do not make definitive diagnoses, but identify patterns and indicators that may warrant further investigation.

Format your response as JSON with the following structure:
{
  "personalityTraits": {
    "openness": "high|medium|low",
    "conscientiousness": "high|medium|low",
    "extraversion": "high|medium|low",
    "agreeableness": "high|medium|low",
    "neuroticism": "high|medium|low"
  },
  "communicationStyle": {
    "tone": "description",
    "frequency": "description",
    "topics": ["list", "of", "topics"]
  },
  "behavioralIndicators": {
    "activityPatterns": "description",
    "engagement": "description",
    "sentiment": "description"
  },
  "riskAssessment": {
    "level": "LOW|MEDIUM|HIGH",
    "concerns": ["list", "of", "concerns"],
    "redFlags": ["list", "of", "red", "flags"]
  },
  "interestsAndValues": {
    "primaryInterests": ["list"],
    "values": ["list"]
  },
  "pathologicalIndicators": {
    "mentalHealthConcerns": ["list", "or", "none"],
    "behavioralAnomalies": ["list", "or", "none"],
    "socialPatterns": "description"
  },
  "summary": "Overall psychological profile summary"
}
`;

@Injectable()
export class PsychProfileAgent {
    private readonly logger = new Logger(PsychProfileAgent.name);

    constructor(private openRouter: OpenRouterService) { }

    /**
     * Generate psychological profile from OSINT data
     */
    async generateProfile(
        timelineEvents: TimelineEvent[],
        patternAnalysis: PatternAnalysis,
        rawData: any,
        model?: string,
    ): Promise<any> {
        this.logger.log('Generating psychological profile');

        try {
            // Format timeline for analysis
            const timelineSummary = timelineEvents
                .slice(0, 50) // Limit to most recent 50 events
                .map(e => `${e.date.toISOString()}: ${e.type} on ${e.platform} - ${e.description}`)
                .join('\n');

            // Format pattern analysis
            const patternsText = `
Posting Frequency: ${patternAnalysis.postingFrequency.averagePerDay.toFixed(1)} posts/day
Activity Pattern: ${patternAnalysis.activityTimePattern.isNightOwl ? 'Night Owl' : patternAnalysis.activityTimePattern.isEarlyBird ? 'Early Bird' : 'Regular'}
Sentiment: ${patternAnalysis.sentimentTrend.overall} (trend: ${patternAnalysis.sentimentTrend.trend})
Topics: ${patternAnalysis.topicClusters.map(t => `${t.topic} (${t.frequency}x)`).join(', ')}
Engagement: ${patternAnalysis.engagementPattern.averageCommentsPerPost.toFixed(1)} comments/post
Behavioral Patterns: ${patternAnalysis.patterns.map(p => p.type).join(', ')}
            `.trim();

            // Combine data
            const dataSummary = JSON.stringify({
                timeline: timelineSummary,
                socialMedia: rawData.socialMedia || [],
                webMentions: rawData.webMentions || [],
            }, null, 2);

            const prompt = PSYCH_PROFILE_PROMPT(dataSummary, patternsText);

            const response = await this.openRouter.complete(prompt, model);

            // Try to parse JSON from response
            try {
                // Extract JSON from markdown code blocks if present
                const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || response.match(/```\n([\s\S]*?)\n```/);
                const jsonText = jsonMatch ? jsonMatch[1] : response;
                return JSON.parse(jsonText);
            } catch (parseError) {
                this.logger.warn('Failed to parse JSON response, returning raw text');
                return {
                    raw: response,
                    error: 'Failed to parse structured response',
                };
            }
        } catch (error) {
            this.logger.error(`Failed to generate psychological profile: ${error.message}`);
            throw error;
        }
    }
}
