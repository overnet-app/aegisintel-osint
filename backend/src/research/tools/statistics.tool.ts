import { Injectable, Logger } from '@nestjs/common';
import { ResearchTool, ToolResult } from './base.tool';
import { StatisticalData } from '../types/swarm.types';

@Injectable()
export class StatisticsTool implements ResearchTool {
  readonly name = 'statistics';
  readonly description = 'Calculate financial statistics: CAGR, volatility, Sharpe ratio, maximum drawdown, and year-over-year returns. Supports single or multiple symbols for comparison.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      yearlyReturns: {
        type: 'array',
        description: 'Array of yearly return data: [{year, symbol, return, endPrice}, ...]',
      },
      riskFreeRate: {
        type: 'number',
        description: 'Risk-free rate for Sharpe ratio calculation (default: 2.5%)',
        default: 2.5,
      },
    },
    required: ['yearlyReturns'],
  };

  private readonly logger = new Logger(StatisticsTool.name);

  async execute(args: { yearlyReturns?: any[]; riskFreeRate?: number }): Promise<ToolResult> {
    if (!args || !args.yearlyReturns || !Array.isArray(args.yearlyReturns) || args.yearlyReturns.length === 0) {
      this.logger.error('Statistics tool: yearlyReturns parameter is missing or invalid');
      return {
        content: 'Error: yearlyReturns parameter is required and must be a non-empty array.',
        sources: [],
      };
    }

    this.logger.log(`Statistics tool: Calculating statistics for ${args.yearlyReturns.length} data points`);

    try {
      const riskFreeRate = args.riskFreeRate || 2.5;
      const statistics = this.calculateStatistics(args.yearlyReturns, riskFreeRate);

      const content = `Financial Statistics:

${statistics.comparison ? `Comparison Metrics:
${statistics.comparison.symbols.map(sym => {
  const cagr = statistics.comparison!.cagr[sym]?.toFixed(2) || 'N/A';
  const vol = statistics.comparison!.volatility[sym]?.toFixed(2) || 'N/A';
  const sharpe = statistics.comparison!.sharpeRatio?.[sym]?.toFixed(2) || 'N/A';
  const drawdown = statistics.comparison!.maxDrawdown[sym]?.toFixed(2) || 'N/A';
  return `  ${sym}: CAGR=${cagr}%, Volatility=${vol}%, Sharpe=${sharpe}, Max Drawdown=${drawdown}%`;
}).join('\n')}` : ''}

Summary:
${Object.entries(statistics.summary.totalReturn).map(([sym, val]) => 
  `  ${sym} Total Return: ${val > 0 ? '+' : ''}${val.toFixed(2)}%`
).join('\n')}
${Object.entries(statistics.summary.bestYear).map(([sym, val]) => 
  `  ${sym} Best Year: ${val.year} (${val.return > 0 ? '+' : ''}${val.return.toFixed(2)}%)`
).join('\n')}
${Object.entries(statistics.summary.worstYear).map(([sym, val]) => 
  `  ${sym} Worst Year: ${val.year} (${val.return > 0 ? '+' : ''}${val.return.toFixed(2)}%)`
).join('\n')}`;

      return {
        content,
        sources: [],
        metadata: {
          statistics,
        },
      };
    } catch (error: any) {
      this.logger.error(`Statistics tool error: ${error.message}`);
      return {
        content: `Error calculating statistics: ${error.message}`,
        sources: [],
      };
    }
  }

  private calculateStatistics(
    yearlyReturns: Array<{ year: number; symbol: string; return: number; endPrice: number }>,
    riskFreeRate: number
  ): StatisticalData {
    // Group by symbol
    const bySymbol = new Map<string, Array<{ year: number; return: number; endPrice: number }>>();
    yearlyReturns.forEach(r => {
      if (!bySymbol.has(r.symbol)) {
        bySymbol.set(r.symbol, []);
      }
      bySymbol.get(r.symbol)!.push({
        year: r.year,
        return: r.return,
        endPrice: r.endPrice,
      });
    });

    const symbols = Array.from(bySymbol.keys());
    const comparison: StatisticalData['comparison'] = {
      symbols,
      cagr: {},
      volatility: {},
      sharpeRatio: {},
      maxDrawdown: {},
    };

    const summary: StatisticalData['summary'] = {
      totalReturn: {},
      bestYear: {},
      worstYear: {},
    };

    // Calculate metrics for each symbol
    symbols.forEach(symbol => {
      const returns = bySymbol.get(symbol)!;
      if (returns.length === 0) return;

      // Sort by year
      returns.sort((a, b) => a.year - b.year);

      // Calculate CAGR
      const firstYear = returns[0];
      const lastYear = returns[returns.length - 1];
      const years = lastYear.year - firstYear.year;
      
      if (firstYear.endPrice > 0 && years > 0) {
        comparison.cagr[symbol] = (Math.pow(lastYear.endPrice / firstYear.endPrice, 1 / years) - 1) * 100;
      }

      // Calculate volatility (standard deviation of returns)
      const returnValues = returns.map(r => r.return);
      if (returnValues.length > 1) {
        const mean = returnValues.reduce((a, b) => a + b, 0) / returnValues.length;
        const variance = returnValues.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returnValues.length;
        comparison.volatility[symbol] = Math.sqrt(variance);
      }

      // Calculate Sharpe Ratio
      if (comparison.cagr[symbol] !== undefined && comparison.volatility[symbol] !== undefined) {
        const excessReturn = comparison.cagr[symbol] - riskFreeRate;
        comparison.sharpeRatio![symbol] = comparison.volatility[symbol] > 0 
          ? excessReturn / comparison.volatility[symbol] 
          : 0;
      }

      // Calculate maximum drawdown
      const prices = returns.map(r => r.endPrice);
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
      comparison.maxDrawdown[symbol] = maxDrawdown;

      // Calculate total return
      if (firstYear.endPrice > 0) {
        summary.totalReturn[symbol] = ((lastYear.endPrice - firstYear.endPrice) / firstYear.endPrice) * 100;
      }

      // Find best and worst years
      const best = returns.reduce((max, r) => r.return > max.return ? r : max, returns[0]);
      const worst = returns.reduce((min, r) => r.return < min.return ? r : min, returns[0]);
      summary.bestYear[symbol] = { year: best.year, return: best.return };
      summary.worstYear[symbol] = { year: worst.year, return: worst.return };
    });

    // Calculate correlation if multiple symbols
    if (symbols.length > 1) {
      comparison.correlation = this.calculateCorrelation(yearlyReturns, symbols);
    }

    return {
      yearlyReturns,
      comparison: symbols.length > 1 ? comparison : undefined,
      summary,
    };
  }

  private calculateCorrelation(
    yearlyReturns: Array<{ year: number; symbol: string; return: number; endPrice: number }>,
    symbols: string[]
  ): number {
    if (symbols.length < 2) return 0;

    // Get common years
    const years = new Set(yearlyReturns.map(r => r.year));
    const commonYears = Array.from(years).filter(year => {
      return symbols.every(sym => yearlyReturns.some(r => r.symbol === sym && r.year === year));
    });

    if (commonYears.length < 2) return 0;

    // Get returns for each symbol by year
    const returns1: number[] = [];
    const returns2: number[] = [];
    
    commonYears.forEach(year => {
      const r1 = yearlyReturns.find(r => r.symbol === symbols[0] && r.year === year);
      const r2 = yearlyReturns.find(r => r.symbol === symbols[1] && r.year === year);
      if (r1 && r2) {
        returns1.push(r1.return);
        returns2.push(r2.return);
      }
    });

    if (returns1.length < 2) return 0;

    // Calculate correlation coefficient
    const mean1 = returns1.reduce((a, b) => a + b, 0) / returns1.length;
    const mean2 = returns2.reduce((a, b) => a + b, 0) / returns2.length;

    let numerator = 0;
    let sumSq1 = 0;
    let sumSq2 = 0;

    for (let i = 0; i < returns1.length; i++) {
      const diff1 = returns1[i] - mean1;
      const diff2 = returns2[i] - mean2;
      numerator += diff1 * diff2;
      sumSq1 += diff1 * diff1;
      sumSq2 += diff2 * diff2;
    }

    const denominator = Math.sqrt(sumSq1 * sumSq2);
    return denominator > 0 ? numerator / denominator : 0;
  }
}
