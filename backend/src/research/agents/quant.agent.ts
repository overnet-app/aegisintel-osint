import { Injectable, Logger, Optional } from '@nestjs/common';
import { OpenRouterService } from '../../ai/open-router.service';
import { McpClientService } from '../../mcp/mcp-client.service';
import { BaseResearchAgent } from './base-research-agent';
import { ScoutFindings, QuantAnalysis, ChartData, StatisticalData, SentimentData, PredictionData } from '../types/swarm.types';
import { SentimentTool } from '../tools/sentiment.tool';
import { StatisticsTool } from '../tools/statistics.tool';
import { PredictorAgent } from './predictor.agent';
import { JsonRepairUtil } from '../utils/json-repair.util';
import { AgentModelResolverService } from '../services/agent-model-resolver.service';

@Injectable()
export class QuantAgent extends BaseResearchAgent {
  constructor(
    openRouter: OpenRouterService,
    mcpClient: McpClientService,
    private sentimentTool: SentimentTool,
    private statisticsTool: StatisticsTool,
    private predictorAgent: PredictorAgent,
    @Optional() agentModelResolver?: AgentModelResolverService,
  ) {
    super(openRouter, mcpClient, agentModelResolver);
  }

  async analyzeFinancialData(
    scoutFindings: ScoutFindings[],
    provider?: string,
    model?: string,
    userId?: string,
  ): Promise<QuantAnalysis> {
    // Resolve model from configuration if userId provided
    const resolved = await this.resolveModel(userId, provider || 'openrouter', model || 'google/gemma-3-27b-it');
    const finalProvider = provider || resolved.provider;
    const finalModel = model || resolved.model;
    
    this.logger.log(`The Quant: Analyzing financial data from ${scoutFindings.length} scout findings (${finalProvider}:${finalModel})`);

    // Extract financial data from scout findings
    const financialFacts = scoutFindings
      .flatMap((f) => f.rawData)
      .filter((d) => this.isFinancialData(d.fact, d.source.url));

    if (financialFacts.length === 0) {
      this.logger.warn('The Quant: No financial data found in scout findings');
      return {
        financialData: {},
        contextualization: {},
        sources: [],
        precision: { numbersExact: false, datesExact: false, percentagesExact: false },
      };
    }

    // Build context for LLM analysis (limit to prevent timeout)
    const financialContext = financialFacts
      .slice(0, 20) // Limit to first 20 facts to prevent timeout
      .map((d) => `- ${d.fact.substring(0, 200)}${d.fact.length > 200 ? '...' : ''} (Source: ${d.source.url}, Reliability: ${d.source.reliability})`)
      .join('\n');

    const prompt = `You are "The Quant," a master of finance, economics, and market analysis. You speak the language of money, time-series data, and risk assessment.

CORE DIRECTIVES:

1. DATA PRECISION: Demand exact numbers, percentages, dates, and timestamps. "It went up" is unacceptable; "It increased by 4.5% on volume of 12M" is your standard.

2. CONTEXTUALIZATION: A stock price is meaningless without context. Provide:
   - P/E ratios and market cap comparisons
   - Macroeconomic indicators (inflation, interest rates, GDP growth)
   - Sector performance comparisons
   - Historical context

3. TECHNICAL & FUNDAMENTAL: Understand both:
   - Technical analysis: Charts, trends, support/resistance, indicators
   - Fundamental analysis: Business health, growth prospects, risk factors

4. SOURCE VERIFICATION: Financial misinformation is common. Only trust:
   - SEC filings (.gov, sec.gov)
   - Reputable financial news (Bloomberg, Financial Times, Reuters, WSJ)
   - Verified on-chain data (for crypto)
   - Official exchange data

Financial Data Found:
${financialContext}

Analyze this financial data and return a JSON response with this structure:
{
  "financialData": {
    "symbol": "NVDA",
    "currentPrice": 150.50,
    "historicalData": [
      {"date": "2024-01-01", "price": 145.20, "volume": 50000000}
    ],
    "marketCap": 3700000000000,
    "peRatio": 65.5,
    "dividendYield": 0.03,
    "revenue": 60000000000,
    "profit": 30000000000
  },
  "contextualization": {
    "marketCapComparison": "NVIDIA's market cap of $3.7T makes it the third-largest company by market cap, behind Apple and Microsoft.",
    "peComparison": "NVIDIA's P/E ratio of 65.5 is high compared to the S&P 500 average of ~25, indicating high growth expectations.",
    "macroIndicators": {
      "inflation": 3.2,
      "interestRate": 5.25,
      "gdpGrowth": 2.1
    },
    "sectorPerformance": "Technology sector has outperformed the broader market by 15% over the past year."
  },
  "technicalAnalysis": {
    "trend": "bullish",
    "support": 140.00,
    "resistance": 160.00,
    "indicators": {
      "RSI": 65,
      "MACD": "positive",
      "MovingAverage50": 145.00
    }
  },
  "fundamentalAnalysis": {
    "businessHealth": "strong",
    "growthProspects": "Strong growth driven by AI chip demand, data center expansion, and gaming market recovery.",
    "riskFactors": ["Regulatory scrutiny", "Competition from AMD", "Market volatility"]
  },
  "sources": [
    {
      "url": "https://finance.yahoo.com/quote/NVDA",
      "type": "exchange",
      "reliability": "high"
    }
  ],
  "precision": {
    "numbersExact": true,
    "datesExact": true,
    "percentagesExact": true
  }
}

IMPORTANT:
- Extract ONLY numbers that are explicitly stated in the data
- If a number is missing, omit it (don't guess)
- For technical analysis, only include if you have sufficient data
- For fundamental analysis, base on actual financial metrics
- Mark precision flags based on whether you have exact numbers
- Return ONLY valid JSON, no markdown formatting

Now analyze the financial data:`;

    try {
      // Use longer timeout for Quant agent (120 seconds) due to complex analysis
      const response = await this.callLLM(prompt, finalProvider, finalModel, 120000);
      
      let analysis: QuantAnalysis;
      try {
        analysis = JsonRepairUtil.repairAndParse<QuantAnalysis>(response, this.logger);
      } catch (parseError: any) {
        this.logger.error(`The Quant: JSON repair failed: ${parseError.message}`);
        throw parseError;
      }

      // Validate and set defaults
      if (!analysis.financialData) analysis.financialData = {};
      if (!analysis.contextualization) analysis.contextualization = {};
      if (!analysis.sources) analysis.sources = [];
      if (!analysis.precision) {
        analysis.precision = { numbersExact: false, datesExact: false, percentagesExact: false };
      }

      // Merge sources from scout findings
      const scoutSources = financialFacts.map((d) => ({
        url: d.source.url,
        type: this.classifyFinancialSource(d.source.url) as QuantAnalysis['sources'][0]['type'],
        reliability: d.source.reliability,
      }));

      analysis.sources = [...analysis.sources, ...scoutSources];

      // Extract finance tool results for enhanced analysis
      const financeResults = this.extractFinanceToolResults(scoutFindings);
      
      // Generate visualizations and enhanced data
      const enhancedData = await this.generateEnhancedAnalysis(
        analysis,
        financeResults,
        finalProvider,
        finalModel,
      );

      this.logger.log(
        `The Quant: Analysis complete - Symbol: ${analysis.financialData.symbol || 'N/A'}, ` +
        `Precision: ${analysis.precision.numbersExact ? 'Exact' : 'Estimated'}, ` +
        `Charts: ${enhancedData.charts?.length || 0}, Statistics: ${enhancedData.statistics ? 'Yes' : 'No'}`
      );

      return {
        ...analysis,
        ...enhancedData,
      };
    } catch (error: any) {
      // Check if it's a timeout error
      if (error.message && error.message.includes('timed out')) {
        this.logger.warn(`The Quant: Analysis timed out, using basic extraction`);
      } else {
        this.logger.error(`The Quant: Failed to analyze financial data: ${error.message}`);
      }
      
      // Fallback: extract basic data from scout findings
      return this.extractBasicFinancialData(financialFacts);
    }
  }

  private isFinancialData(fact: string, url: string): boolean {
    const factLower = fact.toLowerCase();
    const urlLower = url.toLowerCase();

    // Check for financial keywords
    const financialKeywords = [
      'stock', 'price', 'market', 'revenue', 'profit', 'earnings',
      'dividend', 'pe ratio', 'market cap', 'volume', 'ticker',
      'crypto', 'bitcoin', 'ethereum', 'currency', 'exchange',
      'nasdaq', 'nyse', 's&p', 'dow', 'index',
    ];

    const hasFinancialKeyword = financialKeywords.some((keyword) => factLower.includes(keyword));

    // Check for financial URLs
    const financialDomains = [
      'finance.yahoo.com', 'bloomberg.com', 'reuters.com', 'ft.com',
      'wsj.com', 'nasdaq.com', 'sec.gov', 'coingecko.com',
      'marketwatch.com', 'investing.com',
    ];

    const hasFinancialDomain = financialDomains.some((domain) => urlLower.includes(domain));

    return hasFinancialKeyword || hasFinancialDomain;
  }

  private classifyFinancialSource(url: string): 'sec_filing' | 'financial_news' | 'on_chain' | 'exchange' | 'other' {
    if (!url) return 'other';

    const urlLower = url.toLowerCase();

    if (urlLower.includes('sec.gov') || urlLower.includes('.gov')) {
      return 'sec_filing';
    }
    if (
      urlLower.includes('bloomberg.com') ||
      urlLower.includes('reuters.com') ||
      urlLower.includes('ft.com') ||
      urlLower.includes('wsj.com') ||
      urlLower.includes('marketwatch.com')
    ) {
      return 'financial_news';
    }
    if (urlLower.includes('coingecko.com') || urlLower.includes('etherscan.io') || urlLower.includes('blockchain')) {
      return 'on_chain';
    }
    if (
      urlLower.includes('finance.yahoo.com') ||
      urlLower.includes('nasdaq.com') ||
      urlLower.includes('nyse.com') ||
      urlLower.includes('exchange')
    ) {
      return 'exchange';
    }

    return 'other';
  }

  private extractBasicFinancialData(
    financialFacts: ScoutFindings['rawData'],
  ): QuantAnalysis {
    // Simple extraction of numbers from facts
    const numbers: number[] = [];
    const dates: string[] = [];

    financialFacts.forEach((d) => {
      // Extract numbers
      const numberMatches = d.fact.match(/\$?([\d,]+\.?\d*)/g);
      if (numberMatches) {
        numberMatches.forEach((match) => {
          const num = parseFloat(match.replace(/[$,]/g, ''));
          if (!isNaN(num)) numbers.push(num);
        });
      }

      // Extract dates
      const dateMatches = d.fact.match(/\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4}/g);
      if (dateMatches) {
        dates.push(...dateMatches);
      }
    });

    return {
      financialData: {
        currentPrice: numbers.length > 0 ? numbers[0] : undefined,
      },
      contextualization: {},
      sources: financialFacts.map((d) => ({
        url: d.source.url,
        type: this.classifyFinancialSource(d.source.url),
        reliability: d.source.reliability,
      })),
      precision: {
        numbersExact: numbers.length > 0,
        datesExact: dates.length > 0,
        percentagesExact: false,
      },
    };
  }

  private extractFinanceToolResults(scoutFindings: ScoutFindings[]): any {
    // Find finance tool results
    const financeFindings = scoutFindings.filter(f => f.tool === 'finance');
    if (financeFindings.length === 0) return null;

    // Extract metadata from finance tool results
    const financeResults = financeFindings.flatMap(f => 
      f.rawData
        .filter(d => d.metadata && d.metadata.chartData)
        .map(d => d.metadata)
    );

    return financeResults.length > 0 ? financeResults[0] : null;
  }

  private async generateEnhancedAnalysis(
    analysis: QuantAnalysis,
    financeResults: any,
    provider: string,
    model: string,
  ): Promise<{
    charts?: ChartData[];
    statistics?: StatisticalData;
    sentiment?: SentimentData;
    predictions?: PredictionData;
  }> {
    const enhanced: {
      charts?: ChartData[];
      statistics?: StatisticalData;
      sentiment?: SentimentData;
      predictions?: PredictionData;
    } = {};

    if (!financeResults) {
      this.logger.warn('The Quant: No finance tool results found for enhanced analysis');
      return enhanced;
    }

    const symbol = analysis.financialData.symbol;
    if (!symbol) return enhanced;

    // Extract chart data
    if (financeResults.chartData) {
      enhanced.charts = [financeResults.chartData];
    }

    // Calculate statistics if yearly performance is available
    if (financeResults.yearlyPerformance && financeResults.yearlyPerformance.length > 0) {
      try {
        const yearlyReturns = financeResults.yearlyPerformance.map((yp: any) => ({
          year: yp.year,
          symbol: symbol,
          return: yp.return,
          endPrice: yp.endPrice || yp.close,
        }));

        const statsResult = await this.statisticsTool.execute({ yearlyReturns });
        if (statsResult.metadata?.statistics) {
          enhanced.statistics = statsResult.metadata.statistics;
        }
      } catch (error: any) {
        this.logger.warn(`The Quant: Failed to calculate statistics: ${error.message}`);
      }
    }

    // Analyze sentiment
    try {
      const sentimentResult = await this.sentimentTool.execute({
        query: `${symbol} stock news`,
        timeRange: '30d',
        maxArticles: 15,
      });
      if (sentimentResult.metadata?.sentimentData) {
        enhanced.sentiment = sentimentResult.metadata.sentimentData;
      }
    } catch (error: any) {
      this.logger.warn(`The Quant: Failed to analyze sentiment: ${error.message}`);
    }

    // Generate predictions
    if (financeResults.historicalData && financeResults.historicalData.length > 0) {
      try {
        const predictions = await this.predictorAgent.generatePredictions(
          symbol,
          financeResults.historicalData,
          financeResults.yearlyPerformance || [],
          enhanced.sentiment?.score,
          provider,
          model,
        );
        enhanced.predictions = predictions;
      } catch (error: any) {
        this.logger.warn(`The Quant: Failed to generate predictions: ${error.message}`);
      }
    }

    return enhanced;
  }
}
