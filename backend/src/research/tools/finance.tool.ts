import { Injectable, Logger } from '@nestjs/common';
import { ResearchTool, ToolResult } from './base.tool';
import { ChartData } from '../types/swarm.types';

@Injectable()
export class FinanceTool implements ResearchTool {
  readonly name = 'finance';
  readonly description = 'Get financial data for stocks and cryptocurrencies. Supports Yahoo Finance for stocks and CoinGecko for crypto.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      symbol: {
        type: 'string',
        description: 'Stock ticker symbol(s) - single symbol (e.g., NVDA) or comma-separated for comparison (e.g., NVDA,AMD). For crypto, use BTC, ETH, etc.',
      },
      type: {
        type: 'string',
        enum: ['stock', 'crypto'],
        description: 'Type of asset (stock or crypto)',
        default: 'stock',
      },
      period: {
        type: 'string',
        enum: ['1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y', '10y', 'ytd', 'max'],
        description: 'Time period for historical data',
        default: '1y',
      },
    },
    required: ['symbol'],
  };

  private readonly logger = new Logger(FinanceTool.name);

  async execute(args: { symbol?: string; type?: string; period?: string }): Promise<ToolResult> {
    if (!args || !args.symbol) {
      this.logger.error('Finance tool: symbol parameter is missing');
      return {
        content: 'Error: Symbol parameter is required. Please provide a stock ticker (e.g., NVDA, AAPL) or cryptocurrency symbol (e.g., BTC, ETH).',
        sources: [],
      };
    }

    this.logger.log(`Finance tool: ${args.symbol} (${args.type || 'stock'})`);

    try {
      // Check if multiple symbols (comma-separated)
      const symbols = args.symbol.split(',').map(s => s.trim()).filter(s => s);
      
      if (symbols.length > 1 && args.type !== 'crypto') {
        // Multi-symbol comparison for stocks
        return await this.getComparisonData(symbols, args.period || '5y');
      }

      if (args.type === 'crypto') {
        return await this.getCryptoData(args.symbol);
      } else {
        return await this.getStockData(args.symbol, args.period);
      }
    } catch (error: any) {
      this.logger.error(`Finance tool error: ${error.message}`);
      return {
        content: `Error: ${error.message}`,
        sources: [],
      };
    }
  }

  private async getStockData(symbol: string, period: string = '1y'): Promise<ToolResult> {
    // Yahoo Finance API (free, no key needed)
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol.toUpperCase()}?interval=1d&range=${period}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Yahoo Finance API error: ${response.status}`);
      }

      const data = await response.json() as any;
      const result = data.chart?.result?.[0];

      if (!result) {
        throw new Error('No data returned from Yahoo Finance');
      }

      const meta = result.meta;
      const quote = result.indicators?.quote?.[0] || {};
      const prices = quote.close || [];
      const opens = quote.open || [];
      const highs = quote.high || [];
      const lows = quote.low || [];
      const volumes = quote.volume || [];
      const timestamps = result.timestamp || [];

      const currentPrice = meta?.regularMarketPrice;
      const previousClose = meta?.previousClose;
      
      // Handle missing data gracefully
      if (currentPrice === undefined || currentPrice === null) {
        return {
          content: `Stock ${symbol.toUpperCase()} found but price data is unavailable. The market may be closed or the symbol may be invalid.`,
          sources: [
            {
              url: `https://finance.yahoo.com/quote/${symbol.toUpperCase()}`,
              title: `Yahoo Finance: ${symbol.toUpperCase()}`,
              reliability: 'medium',
            },
          ],
        };
      }
      
      const change = previousClose ? currentPrice - previousClose : 0;
      const changePercent = previousClose ? ((change / previousClose) * 100).toFixed(2) : '0.00';

      // Build historical data array
      const historicalData = timestamps.map((ts: number, idx: number) => ({
        date: new Date(ts * 1000).toISOString().split('T')[0],
        timestamp: ts * 1000,
        open: opens[idx] || null,
        high: highs[idx] || null,
        low: lows[idx] || null,
        close: prices[idx] || null,
        volume: volumes[idx] || null,
      })).filter((d: any) => d.close !== null);

      // Calculate yearly performance
      const yearlyPerformance = this.calculateYearlyPerformance(historicalData, symbol.toUpperCase());

      // Build chart data
      const chartData: ChartData = {
        type: 'line',
        title: `${symbol.toUpperCase()} Price History`,
        series: [
          {
            name: symbol.toUpperCase(),
            data: historicalData.map((d: any) => ({
              x: d.timestamp,
              y: d.close,
            })),
            color: '#3b82f6',
          },
        ],
        xAxis: { type: 'datetime', title: 'Date' },
        yAxis: { title: 'Price (USD)' },
      };

      const content = `Stock: ${symbol.toUpperCase()}
Current Price: $${currentPrice?.toFixed?.(2) ?? currentPrice ?? 'N/A'}
Previous Close: $${previousClose?.toFixed?.(2) ?? previousClose ?? 'N/A'}
Change: $${change?.toFixed?.(2) ?? change ?? 'N/A'} (${changePercent}%)
Market Cap: ${this.formatNumber(meta?.marketCap)}
52 Week High: $${meta?.fiftyTwoWeekHigh?.toFixed?.(2) ?? 'N/A'}
52 Week Low: $${meta?.fiftyTwoWeekLow?.toFixed?.(2) ?? 'N/A'}
Volume: ${this.formatNumber(meta?.regularMarketVolume)}
Average Volume: ${this.formatNumber(meta?.averageVolume)}

Historical Data Points: ${historicalData.length}
Yearly Performance: ${yearlyPerformance.map((y: any) => `${y.year}: ${y.return > 0 ? '+' : ''}${y.return.toFixed(2)}%`).join(', ')}`;

      return {
        content,
        sources: [
          {
            url: `https://finance.yahoo.com/quote/${symbol.toUpperCase()}`,
            title: `Yahoo Finance: ${symbol.toUpperCase()}`,
            reliability: 'high',
          },
        ],
        metadata: {
          symbol: symbol.toUpperCase(),
          currentPrice,
          change,
          changePercent: parseFloat(changePercent),
          marketCap: meta.marketCap,
          chartData,
          yearlyPerformance,
          historicalData,
        },
      };
    } catch (error) {
      return {
        content: `Error fetching stock data: ${error.message}`,
        sources: [],
      };
    }
  }

  private async getComparisonData(symbols: string[], period: string = '5y'): Promise<ToolResult> {
    this.logger.log(`Fetching comparison data for ${symbols.join(', ')}`);

    try {
      // Fetch data for all symbols in parallel
      const symbolData = await Promise.all(
        symbols.map(symbol => this.getStockData(symbol, period))
      );

      // Check for errors
      const errors = symbolData.filter(d => !d.metadata);
      if (errors.length > 0) {
        return {
          content: `Error: Failed to fetch data for some symbols. ${errors.map((e, i) => symbols[i]).join(', ')}`,
          sources: [],
        };
      }

      // Build comparison chart data
      const chartData: ChartData = {
        type: 'line',
        title: `Stock Comparison: ${symbols.join(' vs ')}`,
        series: symbolData.map((data, idx) => {
          const histData = data.metadata?.historicalData || [];
          const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];
          return {
            name: symbols[idx].toUpperCase(),
            data: histData.map((d: any) => ({
              x: d.timestamp,
              y: d.close,
            })),
            color: colors[idx % colors.length],
          };
        }),
        xAxis: { type: 'datetime', title: 'Date' },
        yAxis: { title: 'Price (USD)' },
      };

      // Calculate statistics for comparison
      const yearlyReturns: Array<{ year: number; symbol: string; return: number; endPrice: number }> = [];
      symbolData.forEach((data, idx) => {
        const perf = data.metadata?.yearlyPerformance || [];
        perf.forEach((y: any) => {
          yearlyReturns.push({
            year: y.year,
            symbol: symbols[idx].toUpperCase(),
            return: y.return,
            endPrice: y.endPrice,
          });
        });
      });

      // Calculate comparison metrics
      const allYears = [...new Set(yearlyReturns.map(r => r.year))].sort();
      const comparison = this.calculateComparisonMetrics(symbols, yearlyReturns, symbolData);

      const content = `Stock Comparison: ${symbols.map(s => s.toUpperCase()).join(' vs ')}

${symbolData.map((data, idx) => {
  const meta = data.metadata;
  return `${symbols[idx].toUpperCase()}: $${meta?.currentPrice?.toFixed(2) || 'N/A'} (${meta?.changePercent > 0 ? '+' : ''}${meta?.changePercent?.toFixed(2) || '0.00'}%)`;
}).join('\n')}

Comparison Statistics:
${comparison.cagr ? Object.entries(comparison.cagr).map(([sym, val]) => `  ${sym} CAGR: ${val.toFixed(2)}%`).join('\n') : ''}
${comparison.volatility ? Object.entries(comparison.volatility).map(([sym, val]) => `  ${sym} Volatility: ${val.toFixed(2)}%`).join('\n') : ''}`;

      return {
        content,
        sources: symbols.map(symbol => ({
          url: `https://finance.yahoo.com/quote/${symbol.toUpperCase()}`,
          title: `Yahoo Finance: ${symbol.toUpperCase()}`,
          reliability: 'high' as const,
        })),
        metadata: {
          symbols: symbols.map(s => s.toUpperCase()),
          chartData,
          yearlyReturns,
          comparison,
          symbolData: symbolData.map((d, idx) => ({
            symbol: symbols[idx].toUpperCase(),
            currentPrice: d.metadata?.currentPrice,
            changePercent: d.metadata?.changePercent,
            yearlyPerformance: d.metadata?.yearlyPerformance || [],
          })),
        },
      };
    } catch (error: any) {
      this.logger.error(`Comparison data error: ${error.message}`);
      return {
        content: `Error fetching comparison data: ${error.message}`,
        sources: [],
      };
    }
  }

  private calculateYearlyPerformance(historicalData: any[], symbol: string): Array<{ year: number; open: number; close: number; return: number; high: number; low: number; endPrice: number }> {
    if (historicalData.length === 0) return [];

    // Group by year
    const byYear = new Map<number, any[]>();
    historicalData.forEach(d => {
      const year = new Date(d.date).getFullYear();
      if (!byYear.has(year)) {
        byYear.set(year, []);
      }
      byYear.get(year)!.push(d);
    });

    const performance: Array<{ year: number; open: number; close: number; return: number; high: number; low: number; endPrice: number }> = [];

    byYear.forEach((data, year) => {
      if (data.length === 0) return;

      // Sort by date
      data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      const first = data[0];
      const last = data[data.length - 1];
      const high = Math.max(...data.map((d: any) => d.high || 0));
      const low = Math.min(...data.map((d: any) => d.low || Infinity));

      const openPrice = first.open || first.close;
      const closePrice = last.close;
      const returnPct = openPrice ? ((closePrice - openPrice) / openPrice) * 100 : 0;

      performance.push({
        year,
        open: openPrice,
        close: closePrice,
        return: returnPct,
        high,
        low,
        endPrice: closePrice,
      });
    });

    return performance.sort((a, b) => a.year - b.year);
  }

  private calculateComparisonMetrics(
    symbols: string[],
    yearlyReturns: Array<{ year: number; symbol: string; return: number; endPrice: number }>,
    symbolData: ToolResult[]
  ): {
    cagr: Record<string, number>;
    volatility: Record<string, number>;
    maxDrawdown: Record<string, number>;
  } {
    const metrics: {
      cagr: Record<string, number>;
      volatility: Record<string, number>;
      maxDrawdown: Record<string, number>;
    } = {
      cagr: {},
      volatility: {},
      maxDrawdown: {},
    };

    symbols.forEach((symbol, idx) => {
      const sym = symbol.toUpperCase();
      const perf = yearlyReturns.filter(r => r.symbol === sym);
      
      if (perf.length === 0) return;

      // Calculate CAGR
      const firstYear = Math.min(...perf.map(p => p.year));
      const lastYear = Math.max(...perf.map(p => p.year));
      const years = lastYear - firstYear;
      
      const firstPrice = perf.find(p => p.year === firstYear)?.endPrice || 0;
      const lastPrice = perf.find(p => p.year === lastYear)?.endPrice || 0;
      
      if (firstPrice > 0 && years > 0) {
        metrics.cagr[sym] = (Math.pow(lastPrice / firstPrice, 1 / years) - 1) * 100;
      }

      // Calculate volatility (std dev of returns)
      const returns = perf.map(p => p.return);
      if (returns.length > 1) {
        const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
        metrics.volatility[sym] = Math.sqrt(variance);
      }

      // Calculate max drawdown
      const prices = perf.map(p => p.endPrice);
      let maxDrawdown = 0;
      let peak = prices[0];
      for (let i = 1; i < prices.length; i++) {
        if (prices[i] > peak) {
          peak = prices[i];
        }
        const drawdown = ((peak - prices[i]) / peak) * 100;
        if (drawdown > maxDrawdown) {
          maxDrawdown = drawdown;
        }
      }
      metrics.maxDrawdown[sym] = maxDrawdown;
    });

    return metrics;
  }

  private async getCryptoData(symbol: string): Promise<ToolResult> {
    // CoinGecko API (free tier)
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${symbol.toLowerCase()}&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const data = await response.json() as any;
      const coinData = data[symbol.toLowerCase()];

      if (!coinData) {
        throw new Error(`Cryptocurrency ${symbol} not found`);
      }

      const content = `Cryptocurrency: ${symbol.toUpperCase()}
Price: $${coinData.usd?.toFixed?.(2) ?? coinData.usd ?? 'N/A'}
24h Change: ${coinData.usd_24h_change?.toFixed?.(2) ?? 'N/A'}%
Market Cap: $${this.formatNumber(coinData.usd_market_cap)}
24h Volume: $${this.formatNumber(coinData.usd_24h_vol)}`;

      return {
        content,
        sources: [
          {
            url: `https://www.coingecko.com/en/coins/${symbol.toLowerCase()}`,
            title: `CoinGecko: ${symbol.toUpperCase()}`,
            reliability: 'high',
          },
        ],
        metadata: {
          symbol: symbol.toUpperCase(),
          price: coinData.usd,
          change24h: coinData.usd_24h_change,
          marketCap: coinData.usd_market_cap,
        },
      };
    } catch (error) {
      return {
        content: `Error fetching crypto data: ${error.message}`,
        sources: [],
      };
    }
  }

  private formatNumber(num: number): string {
    if (!num) return 'N/A';
    if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  }
}
