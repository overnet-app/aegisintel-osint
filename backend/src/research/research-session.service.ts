import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export interface ResearchSession {
  id: string;
  userId: string;
  query: string;
  model: string;
  status: 'planning' | 'researching' | 'analyzing' | 'verifying' | 'synthesizing' | 'complete' | 'error';
  createdAt: Date;
  updatedAt: Date;
  qualityScore?: number;
  completenessScore?: number;
  iterationCount?: number;
}

@Injectable()
export class ResearchSessionService {
  private readonly logger = new Logger(ResearchSessionService.name);
  private readonly redis: Redis;
  private readonly ttl = 86400; // 24 hours

  constructor(private configService: ConfigService) {
    this.redis = new Redis({
      host: this.configService.get<string>('REDIS_HOST'),
      port: this.configService.get<number>('REDIS_PORT'),
    });
  }

  async createSession(userId: string, query: string, model: string): Promise<string> {
    
    const sessionId = `research:${Date.now()}:${Math.random().toString(36).substring(7)}`;
    
    const session: ResearchSession = {
      id: sessionId,
      userId,
      query,
      model,
      status: 'planning',
      createdAt: new Date(),
      updatedAt: new Date(),
      iterationCount: 0,
    };


    await this.redis.hset(`research:session:${sessionId}`, {
      id: sessionId,
      userId,
      query,
      model,
      status: session.status,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      iterationCount: '0',
    });

    await this.redis.expire(`research:session:${sessionId}`, this.ttl);
    
    
    // Add to user history
    await this.redis.zadd(`research:history:${userId}`, Date.now(), sessionId);


    this.logger.log(`Created research session: ${sessionId}`);
    return sessionId;
  }

  async getSession(sessionId: string): Promise<ResearchSession | null> {
    const data = await this.redis.hgetall(`research:session:${sessionId}`);
    if (!data || Object.keys(data).length === 0) {
      return null;
    }

    const session = {
      id: data.id,
      userId: data.userId,
      query: data.query,
      model: data.model,
      status: data.status as ResearchSession['status'],
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      qualityScore: data.qualityScore ? parseFloat(data.qualityScore) : undefined,
      completenessScore: data.completenessScore ? parseFloat(data.completenessScore) : undefined,
      iterationCount: data.iterationCount ? parseInt(data.iterationCount, 10) : 0,
    };
    return session;
  }

  async updateSession(sessionId: string, updates: Partial<ResearchSession>): Promise<void> {
    const updatesObj: Record<string, string> = {
      updatedAt: new Date().toISOString(),
    };

    if (updates.status) updatesObj.status = updates.status;
    if (updates.qualityScore !== undefined) updatesObj.qualityScore = updates.qualityScore.toString();
    if (updates.completenessScore !== undefined) updatesObj.completenessScore = updates.completenessScore.toString();
    if (updates.iterationCount !== undefined) updatesObj.iterationCount = updates.iterationCount.toString();

    await this.redis.hset(`research:session:${sessionId}`, updatesObj);
  }

  async storeResult(sessionId: string, result: any): Promise<void> {
    await this.redis.setex(
      `research:result:${sessionId}`,
      this.ttl,
      JSON.stringify(result),
    );
  }

  async getResult(sessionId: string): Promise<any | null> {
    const data = await this.redis.get(`research:result:${sessionId}`);
    if (!data) {
      return null;
    }
    try {
      const parsed = JSON.parse(data);
      return parsed;
    } catch (parseError: any) {
      return null;
    }
  }

  async getUserHistory(userId: string, limit: number = 50): Promise<string[]> {
    const sessionIds = await this.redis.zrevrange(`research:history:${userId}`, 0, limit - 1);
    return sessionIds;
  }

  async deleteSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) return;

    await this.redis.del(`research:session:${sessionId}`);
    await this.redis.del(`research:result:${sessionId}`);
    await this.redis.del(`research:sources:${sessionId}`);
    await this.redis.zrem(`research:history:${session.userId}`, sessionId);

    this.logger.log(`Deleted research session: ${sessionId}`);
  }
}
