import { Injectable, Logger } from '@nestjs/common';
import { TimelineEvent } from '../../search/timeline.service';

export interface BehavioralPattern {
    type: string;
    description: string;
    confidence: number;
    evidence: string[];
}

export interface PatternAnalysis {
    postingFrequency: {
        averagePerDay: number;
        peakDays: string[];
        quietDays: string[];
    };
    activityTimePattern: {
        isNightOwl: boolean;
        isEarlyBird: boolean;
        mostActiveHours: number[];
    };
    sentimentTrend: {
        overall: 'positive' | 'negative' | 'neutral';
        trend: 'improving' | 'declining' | 'stable';
        recentSentiment: number; // -1 to 1
    };
    topicClusters: Array<{
        topic: string;
        frequency: number;
        examples: string[];
    }>;
    engagementPattern: {
        averageCommentsPerPost: number;
        responseRate: number; // percentage of posts with responses
    };
    patterns: BehavioralPattern[];
}

@Injectable()
export class PatternDetectorService {
    private readonly logger = new Logger(PatternDetectorService.name);

    /**
     * Analyze behavioral patterns from timeline events
     */
    analyzePatterns(events: TimelineEvent[]): PatternAnalysis {
        this.logger.log(`Analyzing patterns from ${events.length} events`);

        const posts = events.filter(e => e.type === 'post');
        const comments = events.filter(e => e.type === 'comment');

        // Posting frequency analysis
        const postingFrequency = this.analyzePostingFrequency(posts);

        // Activity time pattern
        const activityTimePattern = this.analyzeActivityTimePattern(events);

        // Sentiment trend
        const sentimentTrend = this.analyzeSentimentTrend(events);

        // Topic clustering
        const topicClusters = this.clusterTopics(events);

        // Engagement pattern
        const engagementPattern = this.analyzeEngagementPattern(posts, comments);

        // Behavioral patterns
        const patterns = this.detectBehavioralPatterns(events, {
            postingFrequency,
            activityTimePattern,
            sentimentTrend,
            topicClusters,
            engagementPattern,
        });

        return {
            postingFrequency,
            activityTimePattern,
            sentimentTrend,
            topicClusters,
            engagementPattern,
            patterns,
        };
    }

    /**
     * Analyze posting frequency
     */
    private analyzePostingFrequency(posts: TimelineEvent[]): {
        averagePerDay: number;
        peakDays: string[];
        quietDays: string[];
    } {
        if (posts.length === 0) {
            return { averagePerDay: 0, peakDays: [], quietDays: [] };
        }

        // Group by date
        const postsByDate: Record<string, number> = {};
        for (const post of posts) {
            const dateKey = post.date.toISOString().split('T')[0];
            postsByDate[dateKey] = (postsByDate[dateKey] || 0) + 1;
        }

        const dates = Object.keys(postsByDate);
        const totalDays = dates.length;
        const averagePerDay = totalDays > 0 ? posts.length / totalDays : 0;

        // Find peak and quiet days
        const sortedDates = dates.sort((a, b) => postsByDate[b] - postsByDate[a]);
        const peakDays = sortedDates.slice(0, 3);
        const quietDays = sortedDates.slice(-3).reverse();

        return { averagePerDay, peakDays, quietDays };
    }

    /**
     * Analyze activity time patterns
     */
    private analyzeActivityTimePattern(events: TimelineEvent[]): {
        isNightOwl: boolean;
        isEarlyBird: boolean;
        mostActiveHours: number[];
    } {
        if (events.length === 0) {
            return { isNightOwl: false, isEarlyBird: false, mostActiveHours: [] };
        }

        const hours: number[] = [];
        for (const event of events) {
            hours.push(event.date.getHours());
        }

        // Count activity by hour
        const hourCounts: Record<number, number> = {};
        for (const hour of hours) {
            hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        }

        // Determine if night owl (most activity 22-2) or early bird (most activity 5-8)
        const nightHours = [22, 23, 0, 1, 2];
        const morningHours = [5, 6, 7, 8];

        const nightActivity = nightHours.reduce((sum, h) => sum + (hourCounts[h] || 0), 0);
        const morningActivity = morningHours.reduce((sum, h) => sum + (hourCounts[h] || 0), 0);
        const totalActivity = Object.values(hourCounts).reduce((a, b) => a + b, 0);

        const isNightOwl = totalActivity > 0 && nightActivity / totalActivity > 0.3;
        const isEarlyBird = totalActivity > 0 && morningActivity / totalActivity > 0.3;

        // Most active hours (top 3)
        const sortedHours = Object.entries(hourCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([hour]) => parseInt(hour, 10));

        return { isNightOwl, isEarlyBird, mostActiveHours: sortedHours };
    }

    /**
     * Analyze sentiment trends
     */
    private analyzeSentimentTrend(events: TimelineEvent[]): {
        overall: 'positive' | 'negative' | 'neutral';
        trend: 'improving' | 'declining' | 'stable';
        recentSentiment: number;
    } {
        if (events.length === 0) {
            return { overall: 'neutral', trend: 'stable', recentSentiment: 0 };
        }

        // Simple sentiment analysis based on keywords
        const positiveWords = ['happy', 'great', 'love', 'amazing', 'wonderful', 'excited', 'good', 'best', 'awesome'];
        const negativeWords = ['sad', 'bad', 'hate', 'terrible', 'awful', 'angry', 'worst', 'disappointed', 'frustrated'];

        const sentiments: number[] = [];
        for (const event of events) {
            const text = (event.context || event.description || '').toLowerCase();
            let sentiment = 0;

            for (const word of positiveWords) {
                if (text.includes(word)) sentiment += 0.1;
            }
            for (const word of negativeWords) {
                if (text.includes(word)) sentiment -= 0.1;
            }

            sentiments.push(Math.max(-1, Math.min(1, sentiment)));
        }

        const overallSentiment = sentiments.reduce((a, b) => a + b, 0) / sentiments.length;
        const overall = overallSentiment > 0.1 ? 'positive' : overallSentiment < -0.1 ? 'negative' : 'neutral';

        // Recent sentiment (last 30% of events)
        const recentCount = Math.max(1, Math.floor(sentiments.length * 0.3));
        const recentSentiments = sentiments.slice(-recentCount);
        const recentSentiment = recentSentiments.reduce((a, b) => a + b, 0) / recentSentiments.length;

        // Determine trend
        const firstHalf = sentiments.slice(0, Math.floor(sentiments.length / 2));
        const secondHalf = sentiments.slice(Math.floor(sentiments.length / 2));
        const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

        const trend = secondAvg > firstAvg + 0.1 ? 'improving' : secondAvg < firstAvg - 0.1 ? 'declining' : 'stable';

        return { overall, trend, recentSentiment };
    }

    /**
     * Cluster topics from events
     */
    private clusterTopics(events: TimelineEvent[]): Array<{
        topic: string;
        frequency: number;
        examples: string[];
    }> {
        const topicKeywords: Record<string, number> = {};
        const topicExamples: Record<string, string[]> = {};

        const commonTopics = {
            'work': ['work', 'job', 'career', 'office', 'meeting', 'project'],
            'family': ['family', 'mom', 'dad', 'parent', 'child', 'son', 'daughter'],
            'travel': ['travel', 'trip', 'vacation', 'flight', 'hotel', 'beach'],
            'food': ['food', 'restaurant', 'cooking', 'recipe', 'dinner', 'lunch'],
            'sports': ['sport', 'game', 'team', 'player', 'match', 'win'],
            'technology': ['tech', 'computer', 'software', 'app', 'code', 'programming'],
            'health': ['health', 'fitness', 'exercise', 'gym', 'workout', 'diet'],
        };

        for (const event of events) {
            const text = (event.context || event.description || '').toLowerCase();
            
            for (const [topic, keywords] of Object.entries(commonTopics)) {
                for (const keyword of keywords) {
                    if (text.includes(keyword)) {
                        topicKeywords[topic] = (topicKeywords[topic] || 0) + 1;
                        if (!topicExamples[topic]) {
                            topicExamples[topic] = [];
                        }
                        if (topicExamples[topic].length < 3) {
                            const example = text.substring(0, 100);
                            if (!topicExamples[topic].includes(example)) {
                                topicExamples[topic].push(example);
                            }
                        }
                        break;
                    }
                }
            }
        }

        return Object.entries(topicKeywords)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([topic, frequency]) => ({
                topic,
                frequency,
                examples: topicExamples[topic] || [],
            }));
    }

    /**
     * Analyze engagement patterns
     */
    private analyzeEngagementPattern(posts: TimelineEvent[], comments: TimelineEvent[]): {
        averageCommentsPerPost: number;
        responseRate: number;
    } {
        if (posts.length === 0) {
            return { averageCommentsPerPost: 0, responseRate: 0 };
        }

        // Count comments per post (simplified - assumes comments come after posts)
        const postsWithComments = new Set<string>();
        for (const comment of comments) {
            if (comment.url) {
                postsWithComments.add(comment.url);
            }
        }

        const averageCommentsPerPost = posts.length > 0 ? comments.length / posts.length : 0;
        const responseRate = (postsWithComments.size / posts.length) * 100;

        return { averageCommentsPerPost, responseRate };
    }

    /**
     * Detect behavioral patterns
     */
    private detectBehavioralPatterns(
        events: TimelineEvent[],
        analysis: Omit<PatternAnalysis, 'patterns'>,
    ): BehavioralPattern[] {
        const patterns: BehavioralPattern[] = [];

        // High frequency posting
        if (analysis.postingFrequency.averagePerDay > 5) {
            patterns.push({
                type: 'high_frequency_poster',
                description: 'Posts very frequently, averaging more than 5 posts per day',
                confidence: 0.8,
                evidence: [`Average ${analysis.postingFrequency.averagePerDay.toFixed(1)} posts per day`],
            });
        }

        // Night owl pattern
        if (analysis.activityTimePattern.isNightOwl) {
            patterns.push({
                type: 'night_owl',
                description: 'Most active during late night hours (10 PM - 2 AM)',
                confidence: 0.7,
                evidence: [`Most active hours: ${analysis.activityTimePattern.mostActiveHours.join(', ')}`],
            });
        }

        // Early bird pattern
        if (analysis.activityTimePattern.isEarlyBird) {
            patterns.push({
                type: 'early_bird',
                description: 'Most active during early morning hours (5 AM - 8 AM)',
                confidence: 0.7,
                evidence: [`Most active hours: ${analysis.activityTimePattern.mostActiveHours.join(', ')}`],
            });
        }

        // Sentiment patterns
        if (analysis.sentimentTrend.overall === 'negative' && analysis.sentimentTrend.trend === 'declining') {
            patterns.push({
                type: 'negative_sentiment_trend',
                description: 'Shows declining sentiment over time with overall negative tone',
                confidence: 0.6,
                evidence: ['Overall sentiment: negative', 'Trend: declining'],
            });
        }

        // High engagement
        if (analysis.engagementPattern.averageCommentsPerPost > 10) {
            patterns.push({
                type: 'high_engagement',
                description: 'Receives high engagement with many comments per post',
                confidence: 0.7,
                evidence: [`Average ${analysis.engagementPattern.averageCommentsPerPost.toFixed(1)} comments per post`],
            });
        }

        return patterns;
    }
}
