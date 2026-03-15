import { Injectable, Logger } from '@nestjs/common';
import { OpenRouterService } from '../open-router.service';

export interface QueryAnalysis {
    entityType: 'person' | 'company' | 'username' | 'email' | 'phone' | 'unknown';
    nationalityHints: string[];
    languageHints: string[];
    professionHints: string[];
    queryVariations: string[];
    searchStrategy: {
        priority: number;
        platform: string;
        query: string;
        reason: string;
    }[];
    countryCode?: string; // ISO country code (e.g., 'ro' for Romania)
    locale?: string; // Locale string (e.g., 'ro-RO')
}

@Injectable()
export class QueryAnalyzerAgent {
    private readonly logger = new Logger(QueryAnalyzerAgent.name);

    constructor(private openRouter: OpenRouterService) { }

    async analyzeQuery(query: string, model?: string): Promise<QueryAnalysis> {
        this.logger.log(`Analyzing query: ${query}`);

        const prompt = `You are an expert OSINT analyst. Analyze this search query and create a comprehensive detective strategy.

Query: "${query}"

Analyze the query and provide a JSON response with the following structure:
{
  "entityType": "person" | "company" | "username" | "email" | "phone" | "unknown",
  "nationalityHints": ["array of potential nationalities based on name patterns"],
  "languageHints": ["array of potential languages"],
  "professionHints": ["array of profession keywords found"],
  "queryVariations": ["array of query variations to try (e.g., 'ramboiu.andrei', 'andrei.ramboiu', 'ramboiuandrei')"],
  "searchStrategy": [
    {
      "priority": 1,
      "platform": "github" | "linkedin" | "twitter" | "instagram" | "google" | "yandex" | "duckduckgo" | "stackoverflow" | "reddit" | "other",
      "query": "exact query to use",
      "reason": "why this search is important"
    }
  ],
  "countryCode": "ISO country code if nationality detected (e.g., 'ro', 'us', 'uk')",
  "locale": "locale string if applicable (e.g., 'ro-RO', 'en-US')"
}

Guidelines:
- If the query contains a name pattern (first + last name), identify potential nationality based on naming conventions
- If profession keywords are detected (developer, engineer, doctor, etc.), prioritize relevant platforms (GitHub for developers, LinkedIn for professionals)
- Generate multiple query variations (with/without dots, underscores, spaces, different order)
- For country-specific searches, include site:countrycode in Google queries
- Prioritize platforms based on entity type and profession hints
- Return ONLY valid JSON, no markdown formatting or explanations

Example for "ramboiu andrei developer":
{
  "entityType": "person",
  "nationalityHints": ["Romanian"],
  "languageHints": ["Romanian", "English"],
  "professionHints": ["developer", "programmer", "software engineer"],
  "queryVariations": ["ramboiu andrei", "ramboiu.andrei", "andrei.ramboiu", "ramboiuandrei", "andrei ramboiu"],
  "searchStrategy": [
    {"priority": 1, "platform": "github", "query": "ramboiu-andrei", "reason": "Developer keyword suggests GitHub presence"},
    {"priority": 2, "platform": "github", "query": "ramboiu", "reason": "Search by last name for repositories"},
    {"priority": 3, "platform": "linkedin", "query": "ramboiu andrei", "reason": "Professional networking platform"},
    {"priority": 4, "platform": "google", "query": "ramboiu andrei developer site:ro", "reason": "Romanian nationality suggests Romanian websites"},
    {"priority": 5, "platform": "stackoverflow", "query": "ramboiu andrei", "reason": "Developer likely active on tech forums"}
  ],
  "countryCode": "ro",
  "locale": "ro-RO"
}

Now analyze: "${query}"`;

        try {
            const response = await this.openRouter.complete(prompt, model);
            
            // Extract JSON from response (handle markdown code blocks if present)
            let jsonStr = response.trim();
            if (jsonStr.startsWith('```')) {
                jsonStr = jsonStr.replace(/^```(?:json)?\n/, '').replace(/\n```$/, '');
            }

            const analysis = JSON.parse(jsonStr) as QueryAnalysis;
            
            // Validate and set defaults
            if (!analysis.entityType) analysis.entityType = 'unknown';
            if (!analysis.nationalityHints) analysis.nationalityHints = [];
            if (!analysis.languageHints) analysis.languageHints = [];
            if (!analysis.professionHints) analysis.professionHints = [];
            if (!analysis.queryVariations) analysis.queryVariations = [query];
            if (!analysis.searchStrategy) analysis.searchStrategy = [];

            this.logger.log(`Query analysis complete: ${analysis.entityType}, ${analysis.nationalityHints.length} nationality hints, ${analysis.searchStrategy.length} strategy steps`);
            
            return analysis;
        } catch (error) {
            this.logger.error(`Failed to analyze query: ${error.message}`);
            
            // Fallback to basic analysis
            return {
                entityType: query.includes('@') ? 'username' : query.includes(' ') ? 'person' : 'unknown',
                nationalityHints: [],
                languageHints: [],
                professionHints: [],
                queryVariations: [query],
                searchStrategy: [
                    { priority: 1, platform: 'google', query: query, reason: 'General web search' },
                ],
            };
        }
    }
}
