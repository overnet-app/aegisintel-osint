import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

export interface EntityMemory {
    entityType: 'person' | 'organization' | 'location' | 'event' | 'concept';
    entityId: string;
    facts: Array<{
        fact: string;
        confidence: number;
        sources: string[];
        timestamp: Date;
    }>;
    relationships: Array<{
        relatedEntity: string;
        relationshipType: string;
        confidence: number;
    }>;
}

export interface EpisodicMemory {
    sessionId: string;
    query: string;
    keyFindings: string[];
    lessonsLearned: string[];
    successfulStrategies: string[];
    failedApproaches: string[];
}

@Injectable()
export class MemoryService {
    private readonly logger = new Logger(MemoryService.name);
    private pgPool: Pool;

    constructor(
        private prisma: PrismaService,
        private configService: ConfigService,
    ) {
        // Create pg pool for vector operations
        const connectionString = this.configService.get<string>('DATABASE_URL');
        this.pgPool = new Pool({ connectionString });
    }

    /**
     * Store entity memory (facts about people, organizations, etc.)
     */
    async storeEntityMemory(
        userId: string | null,
        entityType: EntityMemory['entityType'],
        entityId: string,
        facts: EntityMemory['facts'],
        relationships?: EntityMemory['relationships'],
        embedding?: number[],
    ): Promise<string> {
        this.logger.log(`Storing entity memory: ${entityType}/${entityId}`);

        try {
            // Check if memory already exists
            const existing = await this.prisma.memory.findFirst({
                where: {
                    userId: userId || undefined,
                    type: 'entity',
                    entityType,
                    entityId,
                },
            });

            const content: EntityMemory = {
                entityType,
                entityId,
                facts,
                relationships: relationships || [],
            };

            if (existing) {
                // Update existing memory
                const updatedFacts = [...(existing.content as any).facts, ...facts];
                const updatedRelationships = [
                    ...((existing.content as any).relationships || []),
                    ...(relationships || []),
                ];

                // Remove duplicates
                const uniqueFacts = Array.from(
                    new Map(updatedFacts.map(f => [f.fact, f])).values()
                );
                const uniqueRelationships = Array.from(
                    new Map(updatedRelationships.map(r => [`${r.relatedEntity}-${r.relationshipType}`, r])).values()
                );

                const updatedContent: EntityMemory = {
                    entityType,
                    entityId,
                    facts: uniqueFacts,
                    relationships: uniqueRelationships,
                };

                if (embedding) {
                    await this.pgPool.query(
                        `UPDATE memories SET content = $1, embedding = $2::vector, "lastAccessed" = NOW(), "accessCount" = "accessCount" + 1 WHERE id = $3`,
                        [JSON.stringify(updatedContent), JSON.stringify(embedding), existing.id]
                    );
                } else {
                    await this.prisma.memory.update({
                        where: { id: existing.id },
                        data: {
                            content: updatedContent as any,
                            lastAccessed: new Date(),
                            accessCount: { increment: 1 },
                        },
                    });
                }

                return existing.id;
            } else {
                // Create new memory
                if (embedding) {
                    const result = await this.pgPool.query(
                        `INSERT INTO memories (id, "userId", type, "entityType", "entityId", content, embedding, importance, "createdAt", "updatedAt", "lastAccessed")
                         VALUES (gen_random_uuid(), $1, 'entity', $2, $3, $4, $5::vector, $6, NOW(), NOW(), NOW())
                         RETURNING id`,
                        [userId, entityType, entityId, JSON.stringify(content), JSON.stringify(embedding), 50]
                    );
                    return result.rows[0].id;
                } else {
                    const memory = await this.prisma.memory.create({
                        data: {
                            userId: userId || undefined,
                            type: 'entity',
                            entityType,
                            entityId,
                            content: content as any,
                            importance: 50,
                        },
                    });
                    return memory.id;
                }
            }
        } catch (error: any) {
            this.logger.error(`Failed to store entity memory: ${error.message}`);
            throw error;
        }
    }

    /**
     * Store episodic memory (research session learnings)
     */
    async storeEpisodicMemory(
        userId: string | null,
        sessionId: string,
        query: string,
        keyFindings: string[],
        lessonsLearned: string[],
        successfulStrategies?: string[],
        failedApproaches?: string[],
    ): Promise<string> {
        this.logger.log(`Storing episodic memory for session: ${sessionId}`);

        try {
            const content: EpisodicMemory = {
                sessionId,
                query,
                keyFindings,
                lessonsLearned,
                successfulStrategies: successfulStrategies || [],
                failedApproaches: failedApproaches || [],
            };

            const memory = await this.prisma.memory.create({
                data: {
                    userId: userId || undefined,
                    sessionId,
                    type: 'episodic',
                    content: content as any,
                    importance: 30, // Episodic memories are less important than entity facts
                },
            });

            return memory.id;
        } catch (error: any) {
            this.logger.error(`Failed to store episodic memory: ${error.message}`);
            throw error;
        }
    }

    /**
     * Retrieve relevant memories using semantic search
     */
    async retrieveRelevantMemories(
        userId: string | null,
        query: string,
        queryEmbedding: number[],
        limit: number = 10,
        types?: string[],
    ): Promise<Array<{ memory: any; relevance: number }>> {
        this.logger.log(`Retrieving relevant memories for query: ${query.substring(0, 50)}...`);

        try {
            if (!queryEmbedding || queryEmbedding.length === 0) {
                // Fallback to text-based search if no embedding
                const memories = await this.prisma.memory.findMany({
                    where: {
                        userId: userId || undefined,
                        ...(types && types.length > 0 ? { type: { in: types } } : {}),
                    },
                    orderBy: [
                        { importance: 'desc' },
                        { lastAccessed: 'desc' },
                    ],
                    take: limit,
                });

                return memories.map(m => ({
                    memory: m,
                    relevance: m.importance / 100,
                }));
            }

            // Vector similarity search
            const embeddingStr = JSON.stringify(queryEmbedding);
            const result = await this.pgPool.query(
                `SELECT m.*, 
                       1 - (m.embedding <=> $1::vector) as relevance
                 FROM memories m
                 WHERE m."userId" = $2 OR m."userId" IS NULL
                   ${types && types.length > 0 ? `AND m.type = ANY($3::text[])` : ''}
                 ORDER BY m.embedding <=> $1::vector
                 LIMIT $4`,
                types && types.length > 0
                    ? [embeddingStr, userId, types, limit]
                    : [embeddingStr, userId, limit]
            );

            return result.rows.map((row: any) => ({
                memory: {
                    id: row.id,
                    userId: row.userId,
                    sessionId: row.sessionId,
                    type: row.type,
                    entityType: row.entityType,
                    entityId: row.entityId,
                    content: row.content,
                    metadata: row.metadata,
                    importance: row.importance,
                    accessCount: row.accessCount,
                    lastAccessed: row.lastAccessed,
                    createdAt: row.createdAt,
                    updatedAt: row.updatedAt,
                },
                relevance: parseFloat(row.relevance) || 0,
            }));
        } catch (error: any) {
            this.logger.error(`Failed to retrieve memories: ${error.message}`);
            // Fallback to simple query
            const memories = await this.prisma.memory.findMany({
                where: {
                    userId: userId || undefined,
                    ...(types && types.length > 0 ? { type: { in: types } } : {}),
                },
                orderBy: [
                    { importance: 'desc' },
                    { lastAccessed: 'desc' },
                ],
                take: limit,
            });

            return memories.map(m => ({
                memory: m,
                relevance: m.importance / 100,
            }));
        }
    }

    /**
     * Get entity memory by entity type and ID
     */
    async getEntityMemory(
        userId: string | null,
        entityType: EntityMemory['entityType'],
        entityId: string,
    ): Promise<EntityMemory | null> {
        try {
            const memory = await this.prisma.memory.findFirst({
                where: {
                    userId: userId || undefined,
                    type: 'entity',
                    entityType,
                    entityId,
                },
            });

            if (!memory) {
                return null;
            }

            // Update access count
            await this.prisma.memory.update({
                where: { id: memory.id },
                data: {
                    lastAccessed: new Date(),
                    accessCount: { increment: 1 },
                },
            });

            return memory.content as unknown as EntityMemory;
        } catch (error: any) {
            this.logger.error(`Failed to get entity memory: ${error.message}`);
            return null;
        }
    }

    /**
     * Compress session memory (summarize long conversations)
     */
    async compressSessionMemory(sessionId: string): Promise<void> {
        this.logger.log(`Compressing session memory: ${sessionId}`);

        try {
            const memories = await this.prisma.memory.findMany({
                where: {
                    sessionId,
                    type: 'episodic',
                },
                orderBy: { createdAt: 'asc' },
            });

            if (memories.length <= 5) {
                // No need to compress
                return;
            }

            // Keep most important memories, mark others for deletion
            const sorted = memories.sort((a, b) => b.importance - a.importance);
            const toKeep = sorted.slice(0, 5);
            const toDelete = sorted.slice(5);

            // Delete less important memories
            await this.prisma.memory.deleteMany({
                where: {
                    id: { in: toDelete.map(m => m.id) },
                },
            });

            this.logger.log(`Compressed session memory: kept ${toKeep.length}, deleted ${toDelete.length}`);
        } catch (error: any) {
            this.logger.error(`Failed to compress session memory: ${error.message}`);
        }
    }
}
