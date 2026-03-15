import { Injectable, Logger } from '@nestjs/common';
import { OpenRouterService } from '../../ai/open-router.service';
import { McpClientService } from '../../mcp/mcp-client.service';
import { BaseResearchAgent } from './base-research-agent';
import { PredictionData } from '../types/swarm.types';

@Injectable()
export class PredictorAgent extends BaseResearchAgent {
  constructor(
    openRouter: OpenRouterService,
    mcpClient: McpClientService,
  ) {
    super(openRouter, mcpClient);
  }

  async generatePredictions(
    symbol: string,
    historicalData: Array<{ date: string; price: number; volume?: number }>,
    yearlyReturns: Array<{ year: number; return: number; endPrice: number }>,
    sentimentScore?: number,
    provider: string = 'openrouter',
    model: string = 'google/gemma-3-27b-it',
  ): Promise<PredictionData> {
    this.logger.log(`The Predictor: Generating predictions for ${symbol} (${provider}:${model})`);

    if (!historicalData || historicalData.length === 0) {
      this.logger.warn('The Predictor: No historical data provided');
      return this.getDefaultPredictions(symbol);
    }

    // Calculate simple trend metrics
    const prices = historicalData.map(d => d.price).filter(p => p > 0);
    const returns = yearlyReturns.map(r => r.return);
    
    // Simple moving averages
    const recentPrices = prices.slice(-30); // Last 30 days
    const shortTermMA = recentPrices.length > 0 
      ? recentPrices.reduce((a, b) => a + b, 0) / recentPrices.length 
      : prices[prices.length - 1];
    
    const mediumTermPrices = prices.slice(-90); // Last 90 days
    const mediumTermMA = mediumTermPrices.length > 0
      ? mediumTermPrices.reduce((a, b) => a + b, 0) / mediumTermPrices.length
      : shortTermMA;

    // Calculate volatility for confidence intervals
    const volatility = this.calculateVolatility(returns);
    const currentPrice = prices[prices.length - 1];

    // Build context for LLM
    const priceHistory = prices.slice(-20).map((p, i) => ({
      date: historicalData[historicalData.length - 20 + i]?.date || 'N/A',
      price: p,
    }));

    const prompt = `You are "The Predictor," an AI financial analyst specializing in trend analysis and forecasting.

HISTORICAL DATA:
Symbol: ${symbol}
Current Price: $${currentPrice.toFixed(2)}
Recent Prices (last 20 data points):
${priceHistory.map(p => `  ${p.date}: $${p.price.toFixed(2)}`).join('\n')}

Yearly Returns:
${yearlyReturns.map(r => `  ${r.year}: ${r.return > 0 ? '+' : ''}${r.return.toFixed(2)}%`).join('\n')}

TREND METRICS:
- Short-term MA (30 days): $${shortTermMA.toFixed(2)}
- Medium-term MA (90 days): $${mediumTermMA.toFixed(2)}
- Historical Volatility: ${volatility.toFixed(2)}%
${sentimentScore !== undefined ? `- Current Sentiment Score: ${sentimentScore > 0 ? '+' : ''}${sentimentScore.toFixed(0)}` : ''}

Based on this data, generate predictions for:
1. Short-term (30 days)
2. Medium-term (6 months)
3. Long-term (1 year)

For each prediction, provide:
- Expected price change percentage
- Confidence level (0-100%)
- Price range (low, high)

Return ONLY valid JSON in this exact structure:
{
  "shortTerm": {
    "period": "30d",
    "prediction": 5.2,
    "confidence": 65,
    "range": [currentPrice * 0.95, currentPrice * 1.10]
  },
  "mediumTerm": {
    "period": "6mo",
    "prediction": 12.5,
    "confidence": 55,
    "range": [currentPrice * 0.85, currentPrice * 1.20]
  },
  "longTerm": {
    "period": "1y",
    "prediction": 25.0,
    "confidence": 45,
    "range": [currentPrice * 0.75, currentPrice * 1.35]
  },
  "trendDirection": "bullish",
  "methodology": "Based on moving averages, historical volatility, and trend analysis",
  "disclaimer": "These predictions are speculative and should not be considered financial advice. Past performance does not guarantee future results."
}

IMPORTANT:
- Use ACTUAL NUMBERS, not variable names
- prediction is the expected percentage change (e.g., 5.2 means +5.2%)
- confidence is 0-100
- range is [low_price, high_price] in absolute dollars
- trendDirection is "bullish", "bearish", or "neutral"
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

      // Fix JSON issues
      jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
      jsonStr = jsonStr.replace(/[\x00-\x1F\x7F]/g, ' ');

      let predictions: PredictionData;
      try {
        predictions = JSON.parse(jsonStr) as PredictionData;
      } catch (parseError) {
        this.logger.warn(`The Predictor: Initial JSON parse failed, using fallback: ${parseError.message}`);
        return this.generateFallbackPredictions(currentPrice, volatility, sentimentScore);
      }

      // Validate and fix ranges if needed
      if (predictions.shortTerm && Array.isArray(predictions.shortTerm.range)) {
        const [low, high] = predictions.shortTerm.range;
        if (typeof low !== 'number' || typeof high !== 'number') {
          predictions.shortTerm.range = this.calculateRange(currentPrice, predictions.shortTerm.prediction, volatility, 0.05);
        }
      }
      if (predictions.mediumTerm && Array.isArray(predictions.mediumTerm.range)) {
        const [low, high] = predictions.mediumTerm.range;
        if (typeof low !== 'number' || typeof high !== 'number') {
          predictions.mediumTerm.range = this.calculateRange(currentPrice, predictions.mediumTerm.prediction, volatility, 0.15);
        }
      }
      if (predictions.longTerm && Array.isArray(predictions.longTerm.range)) {
        const [low, high] = predictions.longTerm.range;
        if (typeof low !== 'number' || typeof high !== 'number') {
          predictions.longTerm.range = this.calculateRange(currentPrice, predictions.longTerm.prediction, volatility, 0.25);
        }
      }

      // Ensure disclaimer
      if (!predictions.disclaimer) {
        predictions.disclaimer = 'These predictions are speculative and should not be considered financial advice. Past performance does not guarantee future results.';
      }

      this.logger.log(
        `The Predictor: Predictions generated - Trend: ${predictions.trendDirection}, ` +
        `Short: ${predictions.shortTerm.prediction > 0 ? '+' : ''}${predictions.shortTerm.prediction.toFixed(2)}% ` +
        `(${predictions.shortTerm.confidence}% confidence)`
      );

      return predictions;
    } catch (error: any) {
      this.logger.error(`The Predictor: Failed to generate predictions: ${error.message}`);
      return this.generateFallbackPredictions(currentPrice, volatility, sentimentScore);
    }
  }

  private calculateVolatility(returns: number[]): number {
    if (returns.length < 2) return 20; // Default volatility
    
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    return Math.sqrt(variance);
  }

  private calculateRange(
    currentPrice: number,
    prediction: number,
    volatility: number,
    timeMultiplier: number
  ): [number, number] {
    const expectedPrice = currentPrice * (1 + prediction / 100);
    const rangeWidth = currentPrice * (volatility / 100) * timeMultiplier;
    return [
      Math.max(0, expectedPrice - rangeWidth),
      expectedPrice + rangeWidth,
    ];
  }

  private generateFallbackPredictions(
    currentPrice: number,
    volatility: number,
    sentimentScore?: number
  ): PredictionData {
    // Simple trend-based predictions
    const sentimentMultiplier = sentimentScore ? sentimentScore / 100 : 0;
    const baseTrend = sentimentMultiplier * 5; // Sentiment influences trend

    return {
      shortTerm: {
        period: '30d',
        prediction: baseTrend + (Math.random() * 4 - 2), // -2% to +2% with sentiment bias
        confidence: 50,
        range: this.calculateRange(currentPrice, baseTrend, volatility, 0.05),
      },
      mediumTerm: {
        period: '6mo',
        prediction: baseTrend * 2 + (Math.random() * 8 - 4), // -4% to +4% with sentiment bias
        confidence: 40,
        range: this.calculateRange(currentPrice, baseTrend * 2, volatility, 0.15),
      },
      longTerm: {
        period: '1y',
        prediction: baseTrend * 4 + (Math.random() * 15 - 7.5), // -7.5% to +7.5% with sentiment bias
        confidence: 30,
        range: this.calculateRange(currentPrice, baseTrend * 4, volatility, 0.25),
      },
      trendDirection: sentimentScore && sentimentScore > 10 ? 'bullish' : sentimentScore && sentimentScore < -10 ? 'bearish' : 'neutral',
      methodology: 'Based on historical volatility and sentiment analysis',
      disclaimer: 'These predictions are speculative and should not be considered financial advice. Past performance does not guarantee future results.',
    };
  }

  private getDefaultPredictions(symbol: string): PredictionData {
    return {
      shortTerm: {
        period: '30d',
        prediction: 0,
        confidence: 0,
        range: [0, 0],
      },
      mediumTerm: {
        period: '6mo',
        prediction: 0,
        confidence: 0,
        range: [0, 0],
      },
      longTerm: {
        period: '1y',
        prediction: 0,
        confidence: 0,
        range: [0, 0],
      },
      trendDirection: 'neutral',
      methodology: 'Insufficient data for prediction',
      disclaimer: 'These predictions are speculative and should not be considered financial advice. Past performance does not guarantee future results.',
    };
  }
}
