import { Injectable, Logger, Inject, forwardRef, Optional } from '@nestjs/common';
import { OpenRouterService, AiModel } from '../open-router.service';
import { ScoutAgent } from '../../research/agents/scout.agent';
import { ResearchDetectiveAgent } from '../../research/agents/research-detective.agent';

@Injectable()
export class RelationshipAgent {
    private readonly logger = new Logger(RelationshipAgent.name);

    constructor(
        private openRouter: OpenRouterService,
        @Inject(forwardRef(() => ScoutAgent))
        @Optional()
        private scoutAgent?: ScoutAgent,
        @Inject(forwardRef(() => ResearchDetectiveAgent))
        @Optional()
        private researchDetectiveAgent?: ResearchDetectiveAgent,
    ) { }

    async mapRelationships(scrapedData: any[], model?: string): Promise<any> {
        this.logger.log(`Mapping social relationships from scraped data using model: ${model || 'default'}`);

        // Use ScoutAgent to gather additional relationship data if available
        let enhancedData = scrapedData;
        if (this.scoutAgent) {
            try {
                this.logger.log('Using ScoutAgent to gather additional relationship data');
                
                // Extract usernames from scraped data
                const usernames = scrapedData
                    .map(d => d.username)
                    .filter(Boolean)
                    .slice(0, 5); // Limit to 5 usernames to avoid too many searches

                // Search for mentions and connections
                for (const username of usernames) {
                    try {
                        const findings = await this.scoutAgent.searchSocialMediaProfiles(
                            username,
                            ['twitter', 'instagram', 'linkedin'],
                            'openrouter',
                            model || 'google/gemma-3-27b-it',
                        );

                        // Extract relationship data from findings
                        for (const data of findings.rawData) {
                            if (data.fact.includes('connection') || data.fact.includes('mention') || data.fact.includes('follow')) {
                                enhancedData.push({
                                    platform: 'scout_enhanced',
                                    username,
                                    relationshipData: data.fact,
                                    source: data.source.url,
                                });
                            }
                        }
                    } catch (error: any) {
                        this.logger.warn(`ScoutAgent search failed for ${username}: ${error.message}`);
                    }
                }
            } catch (error: any) {
                this.logger.warn(`ScoutAgent integration failed: ${error.message}`);
            }
        }

        const prompt = `
            You are a social network analyst. Analyze the following data extracted from social media profiles and map the relationships between individuals.
            Identify:
            - Mutual connections
            - Frequent interactions (likes, comments, mentions)
            - Professional associations
            - Strength of connections (1-10)
            - Hidden connections (same location, same interests, same employer)
            
            Data to analyze:
            ${JSON.stringify(enhancedData, null, 2)}
            
            Response should be a JSON object containing a "nodes" and "links" structure suitable for D3.js visualization.
            
            Return ONLY the raw JSON object. No conversational text.
        `;

        try {
            const response = await this.openRouter.complete(prompt, model);

            if (!response || response.trim().length === 0) {
                this.logger.warn('Empty response from OpenRouter for relationship mapping');
                return { nodes: [], links: [] };
            }

            const jsonString = response.replace(/```json|```/g, '').trim();
            const start = jsonString.indexOf('{');
            const end = jsonString.lastIndexOf('}');

            let relationships: any;
            if (start !== -1 && end !== -1) {
                try {
                    relationships = JSON.parse(jsonString.substring(start, end + 1));
                } catch (parseError) {
                    this.logger.error(`Failed to parse extracted JSON: ${parseError.message}`);
                    return { nodes: [], links: [] };
                }
            } else {
                // Fallback to direct parse if markers not found
                try {
                    relationships = JSON.parse(jsonString);
                } catch (e) {
                    this.logger.error(`Direct JSON parse failed: ${e.message}`);
                    return { nodes: [], links: [] };
                }
            }

            // Use ResearchDetectiveAgent to find hidden connections if available
            if (this.researchDetectiveAgent && relationships.nodes && relationships.links) {
                try {
                    this.logger.log('Using ResearchDetectiveAgent to find hidden connections');
                    
                    // Convert relationships to findings format
                    const relationshipFacts = relationships.links.map((link: any) => 
                        `${link.source} is connected to ${link.target} with strength ${link.strength || 5}`
                    );

                    const mockFindings = [{
                        directiveId: 1,
                        tool: 'relationship_mapper',
                        query: 'Relationship mapping',
                        rawData: relationshipFacts.map((fact: string) => ({
                            fact,
                            source: {
                                url: 'relationship-analysis',
                                title: 'Relationship Analysis',
                                snippet: fact,
                                reliability: 'medium' as const,
                                type: 'other' as const,
                            },
                            timestamp: new Date().toISOString(),
                        })),
                        searchOperators: [],
                        credibilityScore: 70,
                    }];

                    const detectiveAnalysis = await this.researchDetectiveAgent.analyzeFindings(
                        mockFindings as any,
                        'openrouter',
                        model || 'google/gemma-3-27b-it',
                    );

                    // Add hidden connections from detective analysis
                    if (detectiveAnalysis.correlations && detectiveAnalysis.correlations.length > 0) {
                        for (const correlation of detectiveAnalysis.correlations) {
                            if (correlation.items && correlation.items.length >= 2) {
                                // Add hidden connection link
                                relationships.links.push({
                                    source: correlation.items[0],
                                    target: correlation.items[1],
                                    type: 'hidden_connection',
                                    strength: 3, // Lower strength for hidden connections
                                    reason: correlation.relationship,
                                });
                            }
                        }
                    }

                    this.logger.log(`ResearchDetectiveAgent found ${detectiveAnalysis.correlations?.length || 0} hidden connections`);
                } catch (error: any) {
                    this.logger.warn(`ResearchDetectiveAgent integration failed: ${error.message}`);
                }
            }

            return relationships;
        } catch (error) {
            this.logger.error(`Failed to map relationships: ${error.message}`);
            return { nodes: [], links: [] };
        }
    }
}
