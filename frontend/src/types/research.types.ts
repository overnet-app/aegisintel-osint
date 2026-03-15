// Research visualization types (mirrored from backend)

export interface ChartData {
  type: 'line' | 'area' | 'bar' | 'candlestick' | 'pie' | 'radar';
  title: string;
  series: Array<{
    name: string;
    data: Array<{ x: string | number; y: number }>;
    color?: string;
  }>;
  xAxis?: { type: 'datetime' | 'category'; title?: string };
  yAxis?: { title?: string; min?: number; max?: number };
  annotations?: Array<{ x: string; text: string; type: 'event' | 'milestone' }>;
}

export interface StatisticalData {
  yearlyReturns: Array<{ year: number; symbol: string; return: number; endPrice: number }>;
  comparison?: {
    symbols: string[];
    cagr: Record<string, number>;
    volatility: Record<string, number>;
    sharpeRatio?: Record<string, number>;
    maxDrawdown: Record<string, number>;
    correlation?: number;
  };
  summary: {
    totalReturn: Record<string, number>;
    bestYear: Record<string, { year: number; return: number }>;
    worstYear: Record<string, { year: number; return: number }>;
  };
}

export interface SentimentData {
  overall: 'very_positive' | 'positive' | 'neutral' | 'negative' | 'very_negative';
  score: number; // -100 to +100
  breakdown: Array<{
    period: string;
    sentiment: number;
    newsCount: number;
    keyEvents: string[];
  }>;
  sources: Array<{ headline: string; sentiment: number; date: string; url: string }>;
}

export interface PredictionData {
  shortTerm: { period: '30d'; prediction: number; confidence: number; range: [number, number] };
  mediumTerm: { period: '6mo'; prediction: number; confidence: number; range: [number, number] };
  longTerm: { period: '1y'; prediction: number; confidence: number; range: [number, number] };
  trendDirection: 'bullish' | 'bearish' | 'neutral';
  methodology: string;
  disclaimer: string;
}
