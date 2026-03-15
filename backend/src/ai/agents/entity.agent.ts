import { Injectable, Logger, Optional } from '@nestjs/common';
import { OpenRouterService, AiModel, StructuredOutputSchema } from '../open-router.service';
import { MemoryService } from '../memory/memory.service';

export interface EntityRelationship {
    source: string;
    target: string;
    relationship: string;
    confidence: number;
    entityType?: 'person' | 'organization' | 'location' | 'event' | 'concept';
}

@Injectable()
export class EntityAgent {
    private readonly logger = new Logger(EntityAgent.name);

    constructor(
        private openRouter: OpenRouterService,
        @Optional() private memoryService?: MemoryService,
    ) { }

    async extractRelationships(data: any, model?: string): Promise<any[]> {
        this.logger.log('Extracting entity relationships from gathered data');

        const prompt = `
            You are a relationship mapping specialist. Your task is to extract entities and their relationships from the provided data.
            Identify:
            - People, Companies, Email addresses, Social media handles, and Locations.
            - Connections between them (e.g., "Work for", "Owner of", "Located in").
            
            Data:
            ${JSON.stringify(data, null, 2)}
            
            Return ONLY a valid JSON array of relationship objects:
            [
                { "source": "...", "target": "...", "relationship": "...", "confidence": 0.0-1.0 }
            ]
        `;

        try {
            const response = await this.openRouter.complete(prompt, model);
            const jsonString = response.replace(/```json|```/g, '').trim();
            return JSON.parse(jsonString);
        } catch (error) {
            this.logger.error(`Failed to extract relationships: ${error.message}`);
            return [];
        }
    }

    /**
     * Extract relationships with structured output and memory integration (premium feature)
     */
    async extractRelationshipsStructured(
        data: any,
        userId: string | null,
        model: string = 'google/gemma-3-27b-it', // Default fallback only if no model provided
    ): Promise<EntityRelationship[]> {
        this.logger.log('Extracting entity relationships with structured output');

        const schema: StructuredOutputSchema = {
            type: 'object',
            properties: {
                items: {
                    type: 'array',
                    items: {
                type: 'object',
                properties: {
                    source: { type: 'string' },
                    target: { type: 'string' },
                    relationship: { type: 'string' },
                    confidence: { type: 'number', minimum: 0, maximum: 1 },
                    entityType: {
                        type: 'string',
                        enum: ['person', 'organization', 'location', 'event', 'concept'],
                    },
                },
                required: ['source', 'target', 'relationship', 'confidence'],
            },
                },
            },
            required: ['items'],
        };

        const prompt = `
            You are a relationship mapping specialist. Extract entities and their relationships from the provided data.
            Identify:
            - People, Companies, Email addresses, Social media handles, and Locations.
            - Connections between them (e.g., "Work for", "Owner of", "Located in").
            
            Data:
            ${JSON.stringify(data, null, 2)}
        `;

        try {
            const result = await this.openRouter.completeWithSchema<{ items: EntityRelationship[] }>(
                prompt,
                schema,
                model,
            );
            const relationships = result.items || [];

            // Store entities in memory if memory service is available
            if (this.memoryService && relationships.length > 0) {
                const entities = new Map<string, { type: 'person' | 'organization' | 'location' | 'event' | 'concept'; facts: any[] }>();
                
                for (const rel of relationships) {
                    // Store source entity
                    if (!entities.has(rel.source)) {
                        entities.set(rel.source, {
                            type: rel.entityType || 'concept',
                            facts: [],
                        });
                    }
                    const sourceEntity = entities.get(rel.source)!;
                    sourceEntity.facts.push({
                        fact: `${rel.source} ${rel.relationship} ${rel.target}`,
                        confidence: Math.round(rel.confidence * 100),
                        sources: [],
                        timestamp: new Date(),
                    });

                    // Store target entity
                    if (!entities.has(rel.target)) {
                        entities.set(rel.target, {
                            type: rel.entityType || 'concept',
                            facts: [],
                        });
                    }
                }

                // Store entities in memory
                for (const [entityId, entityData] of entities) {
                    try {
                        await this.memoryService.storeEntityMemory(
                            userId,
                            entityData.type,
                            entityId,
                            entityData.facts,
                        );
                    } catch (memoryError) {
                        this.logger.warn(`Failed to store entity memory for ${entityId}: ${memoryError.message}`);
                    }
                }
            }

            return relationships;
        } catch (error: any) {
            this.logger.error(`Failed to extract relationships with structured output: ${error.message}`);
            // Fallback to regular extraction
            return this.extractRelationships(data, model);
        }
    }
}
