import { Injectable, Logger } from '@nestjs/common';
import { OpenRouterService } from '../open-router.service';

export interface Lead {
    type: 'profile' | 'connection' | 'activity' | 'document' | 'mention' | 'comment';
    description: string;
    source: string;
    url?: string;
    action: string;
    priority: number;
    reasoning: string;
}

export interface DetectiveAnalysis {
    leads: Lead[];
    connections: Array<{
        entity1: string;
        entity2: string;
        relationship: string;
        evidence: string;
    }>;
    nextActions: Array<{
        action: string;
        query: string;
        platform?: string;
        reason: string;
        priority: number;
    }>;
    summary: string;
}

@Injectable()
export class DetectiveAgent {
    private readonly logger = new Logger(DetectiveAgent.name);

    constructor(private openRouter: OpenRouterService) { }

    async analyzeFindings(
        currentData: any,
        model?: string,
        maxDepth: number = 3,
        currentDepth: number = 0,
    ): Promise<DetectiveAnalysis> {
        if (currentDepth >= maxDepth) {
            this.logger.log(`Reached max depth ${maxDepth}, stopping detective analysis`);
            return {
                leads: [],
                connections: [],
                nextActions: [],
                summary: 'Maximum analysis depth reached.',
            };
        }

        this.logger.log(`Detective analysis (depth ${currentDepth + 1}/${maxDepth})`);

        const prompt = `You are an expert OSINT detective. Analyze the current findings and identify new leads to follow.

Current Findings:
${JSON.stringify(currentData, null, 2)}

Your task:
1. Identify new leads (profiles, connections, activities, documents, mentions, comments)
2. Discover connections between entities
3. Generate specific follow-up actions with queries

Return a JSON response with this structure:
{
  "leads": [
    {
      "type": "profile" | "connection" | "activity" | "document" | "mention" | "comment",
      "description": "What was discovered",
      "source": "Where it was found",
      "url": "URL if available",
      "action": "What to do next",
      "priority": 1-10,
      "reasoning": "Why this lead is important"
    }
  ],
  "connections": [
    {
      "entity1": "First entity name",
      "entity2": "Second entity name",
      "relationship": "How they're connected",
      "evidence": "Evidence of the connection"
    }
  ],
  "nextActions": [
    {
      "action": "search" | "scrape" | "analyze" | "correlate",
      "query": "Exact query to use",
      "platform": "github" | "linkedin" | "twitter" | "google" | "yandex" | "other",
      "reason": "Why this action is needed",
      "priority": 1-10
    }
  ],
  "summary": "Brief summary of findings and next steps"
}

Guidelines:
- If a GitHub profile is found, suggest checking repositories, collaborators, contributions
- If a comment mentions another person/entity, suggest researching that connection
- If a document mentions a company, suggest searching for that company connection
- If activity is found on a forum, suggest checking other posts by the same user
- Prioritize actions that reveal identity, connections, or significant activities
- Stop if no valuable leads remain (return empty arrays)
- Return ONLY valid JSON, no markdown formatting

Example:
If findings show: "Found GitHub profile ramboiu-andrei with 5 repos, collaborates with john-doe"
Then generate:
{
  "leads": [
    {
      "type": "connection",
      "description": "Collaborates with john-doe on GitHub",
      "source": "GitHub repositories",
      "url": "https://github.com/ramboiu-andrei",
      "action": "Research john-doe connection",
      "priority": 8,
      "reasoning": "Collaborator relationship may reveal more about subject"
    }
  ],
  "connections": [
    {
      "entity1": "ramboiu-andrei",
      "entity2": "john-doe",
      "relationship": "GitHub collaborator",
      "evidence": "Multiple shared repositories"
    }
  ],
  "nextActions": [
    {
      "action": "search",
      "query": "john-doe",
      "platform": "github",
      "reason": "Research collaborator to understand subject's network",
      "priority": 7
    }
  ],
  "summary": "Found GitHub collaborator connection. Research john-doe to expand network analysis."
}

Now analyze the current findings:`;

        try {
            const response = await this.openRouter.complete(prompt, model);
            
            // Extract JSON from response
            let jsonStr = response.trim();
            if (jsonStr.startsWith('```')) {
                jsonStr = jsonStr.replace(/^```(?:json)?\n/, '').replace(/\n```$/, '');
            }

            const analysis = JSON.parse(jsonStr) as DetectiveAnalysis;
            
            // Validate and set defaults
            if (!analysis.leads) analysis.leads = [];
            if (!analysis.connections) analysis.connections = [];
            if (!analysis.nextActions) analysis.nextActions = [];
            if (!analysis.summary) analysis.summary = 'No new leads identified.';

            // Sort by priority
            analysis.leads.sort((a, b) => b.priority - a.priority);
            analysis.nextActions.sort((a, b) => b.priority - a.priority);

            this.logger.log(`Detective analysis complete: ${analysis.leads.length} leads, ${analysis.connections.length} connections, ${analysis.nextActions.length} actions`);
            
            return analysis;
        } catch (error) {
            this.logger.error(`Failed to analyze findings: ${error.message}`);
            
            // Fallback
            return {
                leads: [],
                connections: [],
                nextActions: [],
                summary: 'Detective analysis failed due to an error.',
            };
        }
    }

    /**
     * Follow leads autonomously - recursively analyze and act on findings
     */
    async followLeads(
        initialData: any,
        model?: string,
        maxDepth: number = 3,
        currentDepth: number = 0,
    ): Promise<{
        allFindings: any[];
        allLeads: Lead[];
        allConnections: any[];
    }> {
        if (currentDepth >= maxDepth) {
            return {
                allFindings: [],
                allLeads: [],
                allConnections: [],
            };
        }

        const analysis = await this.analyzeFindings(initialData, model, maxDepth, currentDepth);
        
        if (analysis.nextActions.length === 0) {
            // No more actions, return what we have
            return {
                allFindings: [initialData],
                allLeads: analysis.leads,
                allConnections: analysis.connections,
            };
        }

        // For now, return the analysis - actual lead following would require
        // integration with search/scraping services (to be implemented in orchestrator)
        return {
            allFindings: [initialData],
            allLeads: analysis.leads,
            allConnections: analysis.connections,
        };
    }
}
