import { Injectable, Logger } from '@nestjs/common';
import { ResearchTool, ToolResult } from './base.tool';
import { SentimentData } from '../types/swarm.types';
import { SearXNGService } from '../../search/searxng.service';

@Injectable()
export class SentimentTool implements ResearchTool {
  readonly name = 'sentiment';
  readonly description = 'Analyze sentiment of news articles and headlines for a given topic, symbol, or entity. Returns sentiment scores (-100 to +100) and key events.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'Search query for news articles (e.g., "NVIDIA stock news", "AMD earnings")',
      },
      timeRange: {
        type: 'string',
        enum: ['1d', '7d', '30d', '90d', '1y'],
        description: 'Time range for news articles',
        default: '30d',
      },
      maxArticles: {
        type: 'number',
        description: 'Maximum number of articles to analyze',
        default: 20,
      },
    },
    required: ['query'],
  };

  private readonly logger = new Logger(SentimentTool.name);

  constructor(private searxng: SearXNGService) {}

  async execute(args: { query?: string; timeRange?: string; maxArticles?: number }): Promise<ToolResult> {
    if (!args || !args.query) {
      this.logger.error('Sentiment tool: query parameter is missing');
      return {
        content: 'Error: Query parameter is required for sentiment analysis.',
        sources: [],
      };
    }

    this.logger.log(`Sentiment tool: Analyzing sentiment for "${args.query}"`);

    try {
      // Search for news articles
      const searchQuery = `${args.query} news`;
      const articles = await this.searxng.search(searchQuery, ['news'], args.maxArticles || 20);

      if (articles.length === 0) {
        return {
          content: `No news articles found for "${args.query}".`,
          sources: [],
        };
      }

      // Analyze sentiment for each article
      const sentimentScores: Array<{ headline: string; sentiment: number; date: string; url: string }> = [];
      
      for (const article of articles.slice(0, args.maxArticles || 20)) {
        const sentiment = await this.analyzeArticleSentiment(article.title, article.snippet || '');
        sentimentScores.push({
          headline: article.title,
          sentiment,
          date: new Date().toISOString().split('T')[0], // Approximate date
          url: article.url,
        });
      }

      // Calculate overall sentiment
      const avgSentiment = sentimentScores.reduce((sum, s) => sum + s.sentiment, 0) / sentimentScores.length;
      const overall = this.getSentimentLabel(avgSentiment);

      // Group by period (simplified - in production, would parse actual dates)
      const breakdown = this.groupByPeriod(sentimentScores, args.timeRange || '30d');

      const sentimentData: SentimentData = {
        overall,
        score: Math.round(avgSentiment),
        breakdown,
        sources: sentimentScores,
      };

      const content = `Sentiment Analysis for "${args.query}":
Overall Sentiment: ${overall} (Score: ${Math.round(avgSentiment)})
Articles Analyzed: ${sentimentScores.length}
Average Sentiment: ${avgSentiment > 0 ? '+' : ''}${avgSentiment.toFixed(2)}

Key Headlines:
${sentimentScores.slice(0, 5).map(s => `  ${s.sentiment > 0 ? '📈' : s.sentiment < 0 ? '📉' : '➡️'} ${s.headline.substring(0, 80)}...`).join('\n')}`;

      return {
        content,
        sources: sentimentScores.map(s => ({
          url: s.url,
          title: s.headline,
          reliability: 'medium' as const,
        })),
        metadata: {
          sentimentData,
        },
      };
    } catch (error: any) {
      this.logger.error(`Sentiment tool error: ${error.message}`);
      return {
        content: `Error analyzing sentiment: ${error.message}`,
        sources: [],
      };
    }
  }

  private async analyzeArticleSentiment(headline: string, content: string): Promise<number> {
    // Simple keyword-based sentiment analysis
    // In production, this would use an LLM or dedicated sentiment API
    
    const text = `${headline} ${content}`.toLowerCase();
    
    // Positive keywords
    const positiveKeywords = [
      'surge', 'rally', 'gain', 'growth', 'profit', 'success', 'breakthrough',
      'record', 'high', 'soar', 'jump', 'boost', 'strong', 'excellent', 'outperform',
      'beat', 'exceed', 'positive', 'optimistic', 'bullish', 'upgrade', 'buy',
    ];
    
    // Negative keywords
    const negativeKeywords = [
      'drop', 'fall', 'decline', 'loss', 'fail', 'miss', 'disappoint', 'crash',
      'plunge', 'sink', 'weak', 'poor', 'concern', 'worry', 'risk', 'bearish',
      'downgrade', 'sell', 'negative', 'pessimistic', 'warning', 'crisis',
    ];

    let score = 0;
    positiveKeywords.forEach(keyword => {
      const matches = (text.match(new RegExp(keyword, 'g')) || []).length;
      score += matches * 10;
    });
    
    negativeKeywords.forEach(keyword => {
      const matches = (text.match(new RegExp(keyword, 'g')) || []).length;
      score -= matches * 10;
    });

    // Normalize to -100 to +100 range
    return Math.max(-100, Math.min(100, score));
  }

  private getSentimentLabel(score: number): 'very_positive' | 'positive' | 'neutral' | 'negative' | 'very_negative' {
    if (score >= 50) return 'very_positive';
    if (score >= 10) return 'positive';
    if (score <= -50) return 'very_negative';
    if (score <= -10) return 'negative';
    return 'neutral';
  }

  private groupByPeriod(
    scores: Array<{ headline: string; sentiment: number; date: string; url: string }>,
    timeRange: string
  ): Array<{ period: string; sentiment: number; newsCount: number; keyEvents: string[] }> {
    // Simplified grouping - in production would parse actual dates
    const periodCount = timeRange === '1d' ? 1 : timeRange === '7d' ? 7 : timeRange === '30d' ? 4 : 12;
    const breakdown: Array<{ period: string; sentiment: number; newsCount: number; keyEvents: string[] }> = [];

    // Group into periods
    const perPeriod = Math.ceil(scores.length / periodCount);
    for (let i = 0; i < periodCount; i++) {
      const start = i * perPeriod;
      const end = Math.min(start + perPeriod, scores.length);
      const periodScores = scores.slice(start, end);
      
      if (periodScores.length > 0) {
        const avgSentiment = periodScores.reduce((sum, s) => sum + s.sentiment, 0) / periodScores.length;
        const keyEvents = periodScores
          .filter(s => Math.abs(s.sentiment) > 30)
          .map(s => s.headline.substring(0, 60))
          .slice(0, 3);

        breakdown.push({
          period: `Period ${i + 1}`,
          sentiment: Math.round(avgSentiment),
          newsCount: periodScores.length,
          keyEvents,
        });
      }
    }

    return breakdown;
  }
}
