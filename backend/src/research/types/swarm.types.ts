/**
 * Inter-agent communication types for Swarm Intelligence system
 */

export interface ArchitectPlan {
  queryType: 'financial' | 'scientific' | 'historical' | 'technical' | 'comparative' | 'factual' | 'general' | 'osint';
  complexity: 'simple' | 'moderate' | 'complex';
  requiresQuant: boolean; // Whether financial specialist is needed
  semanticClusters: Array<{
    theme: string;
    subQueries: string[];
    priority: number;
  }>;
  searchDirectives: Array<{
    step: number;
    action: 'search' | 'calculate' | 'fetch_data' | 'verify' | 'compare' | 'analyze';
    tool: string;
    query: string;
    reason: string;
    filters?: {
      dateRange?: { from?: string; to?: string };
      fileTypes?: string[];
      domains?: string[];
      sentiment?: 'positive' | 'negative' | 'neutral' | 'any';
    };
    dependsOn?: number[];
  }>;
  expectedSources: string[];
  timeScope?: { from?: string; to?: string };
  geographicScope?: string[];
  whoWhatWhereWhenWhyHow: {
    who?: string[];
    what?: string[];
    where?: string[];
    when?: string[];
    why?: string[];
    how?: string[];
  };
}

export interface ScoutFindings {
  directiveId: number;
  tool: string;
  query: string;
  rawData: Array<{
    fact: string;
    source: {
      url: string;
      title: string;
      snippet?: string;
      reliability: 'high' | 'medium' | 'low';
      type: 'academic' | 'news' | 'official' | 'technical' | 'forum' | 'other';
    };
    timestamp?: string;
    metadata?: Record<string, any>;
  }>;
  searchOperators: string[]; // Advanced operators used
  credibilityScore: number; // 0-100 based on source quality
}

export interface QuantAnalysis {
  financialData: {
    symbol?: string;
    currentPrice?: number;
    historicalData?: Array<{
      date: string;
      price: number;
      volume?: number;
    }>;
    marketCap?: number;
    peRatio?: number;
    dividendYield?: number;
    revenue?: number;
    profit?: number;
  };
  contextualization: {
    marketCapComparison?: string;
    peComparison?: string;
    macroIndicators?: {
      inflation?: number;
      interestRate?: number;
      gdpGrowth?: number;
    };
    sectorPerformance?: string;
  };
  technicalAnalysis?: {
    trend: 'bullish' | 'bearish' | 'neutral';
    support?: number;
    resistance?: number;
    indicators?: Record<string, number>;
  };
  fundamentalAnalysis?: {
    businessHealth: 'strong' | 'moderate' | 'weak';
    growthProspects: string;
    riskFactors: string[];
  };
  sources: Array<{
    url: string;
    type: 'sec_filing' | 'financial_news' | 'on_chain' | 'exchange' | 'other';
    reliability: 'high' | 'medium' | 'low';
  }>;
  precision: {
    numbersExact: boolean;
    datesExact: boolean;
    percentagesExact: boolean;
  };
  charts?: ChartData[];
  statistics?: StatisticalData;
  sentiment?: SentimentData;
  predictions?: PredictionData;
}

export interface LogicianVerdict {
  validatedFacts: Array<{
    fact: string;
    confidence: number; // 0-100
    supportingSources: Array<{
      url: string;
      excerpt: string;
      reliability: 'high' | 'medium' | 'low';
      weight: number; // Evidence weight
    }>;
    verified: boolean;
  }>;
  contradictions: Array<{
    claim1: {
      fact: string;
      source: string;
      reliability: 'high' | 'medium' | 'low';
    };
    claim2: {
      fact: string;
      source: string;
      reliability: 'high' | 'medium' | 'low';
    };
    resolution: string;
    resolvedFact?: string;
  }>;
  fallacies: Array<{
    type: 'ad_hominem' | 'confirmation_bias' | 'correlation_causation' | 'false_dilemma' | 'strawman' | 'other';
    description: string;
    source: string;
    corrected: boolean;
  }>;
  reasoningChains: Array<{
    premise: string;
    conclusion: string;
    valid: boolean;
    missingLinks?: string[];
  }>;
  gaps: Array<{
    question: string;
    importance: number; // 1-10
    missingPremise?: string;
    suggestedAction?: string;
  }>;
  qualityScore: number; // 0-100
  completenessScore: number; // 0-100
}

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

export interface ThinkerReport {
  executiveSummary: string;
  detailedFindings: Array<{
    topic: string;
    content: string;
    sources: Array<{
      url: string;
      title: string;
      excerpt?: string;
    }>;
  }>;
  logicalConclusion: string;
  sources: Array<{
    url: string;
    title: string;
    reliability: 'high' | 'medium' | 'low';
    usedFor: string[];
  }>;
  unansweredQuestions?: Array<{
    question: string;
    reason: string;
  }>;
  analogies?: Array<{
    concept: string;
    analogy: string;
  }>;
  metadata: {
    query: string;
    researchDate: string;
    qualityScore: number;
    completenessScore: number;
    agentVersions: Record<string, string>;
  };
  visualizations?: {
    charts: ChartData[];
    statistics?: StatisticalData;
    sentiment?: SentimentData;
    predictions?: PredictionData;
  };
}

// Inline Citation System (Perplexity-style)
export interface InlineCitation {
  id: string;           // e.g., "[1]"
  text: string;         // The cited text
  source: {
    url: string;
    title: string;
    domain: string;
    favicon?: string;
    snippet: string;
    publishDate?: string;
    reliability: 'high' | 'medium' | 'low';
  };
  position: number;     // Character position in response
}

export interface StreamingChunk {
  type: 'text' | 'citation' | 'thinking' | 'tool_call' | 'follow_up';
  content: string;
  citation?: InlineCitation;
  metadata?: Record<string, any>;
}

export interface RapidResponse {
  answer: string;
  citations: InlineCitation[];
  sources: Array<{
    url: string;
    title: string;
    domain: string;
    snippet: string;
    reliability: 'high' | 'medium' | 'low';
  }>;
  confidence: number; // 0-100
  estimatedDepth: 'quick' | 'moderate' | 'deep';
}

// Follow-up Questions
export interface FollowUpQuestion {
  question: string;
  category: 'deeper' | 'related' | 'alternative' | 'clarification';
  priority: number; // 1-10
  precomputedPlan?: Partial<ArchitectPlan>; // Pre-plan for faster execution
}

// Critic Review (from Critic Agent)
export interface CriticReview {
  overallAssessment: {
    qualityScore: number; // 0-100
    completenessScore: number; // 0-100
    confidenceLevel: 'high' | 'medium' | 'low';
  };
  weakEvidence: Array<{
    finding: string;
    issue: string;
    severity: 'critical' | 'major' | 'minor';
    suggestedAction: string;
  }>;
  missingInformation: Array<{
    topic: string;
    importance: number; // 1-10
    reason: string;
  }>;
  contradictions: Array<{
    claim1: string;
    claim2: string;
    source1: string;
    source2: string;
    resolution?: string;
  }>;
  recommendations: Array<{
    action: string;
    priority: number; // 1-10
    expectedImpact: string;
  }>;
  shouldContinue: boolean; // Whether to continue research
  nextSteps: string[]; // Suggested next research steps
}
