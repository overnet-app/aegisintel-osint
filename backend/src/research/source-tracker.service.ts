import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { Source } from './tools/base.tool';

export interface TrackedSource extends Source {
  tool: string;
  reasoning?: string;
  timestamp: Date;
}

@Injectable()
export class SourceTrackerService {
  private readonly logger = new Logger(SourceTrackerService.name);
  private readonly redis: Redis;
  private readonly ttl = 86400; // 24 hours

  constructor(private configService: ConfigService) {
    this.redis = new Redis({
      host: this.configService.get<string>('REDIS_HOST'),
      port: this.configService.get<number>('REDIS_PORT'),
    });
  }

  async addSource(sessionId: string, source: TrackedSource): Promise<void> {
    const sourceKey = `research:sources:${sessionId}`;
    const sourceData = {
      url: source.url,
      title: source.title || '',
      snippet: source.snippet || '',
      tool: source.tool,
      reasoning: source.reasoning || '',
      reliability: source.reliability || 'medium',
      timestamp: source.timestamp.toISOString(),
    };

    await this.redis.lpush(sourceKey, JSON.stringify(sourceData));
    await this.redis.expire(sourceKey, this.ttl);

    this.logger.debug(`Added source to session ${sessionId}: ${source.url}`);
  }

  async addSources(sessionId: string, sources: TrackedSource[]): Promise<void> {
    for (const source of sources) {
      await this.addSource(sessionId, source);
    }
  }

  async getSources(sessionId: string): Promise<TrackedSource[]> {
    const sourceKey = `research:sources:${sessionId}`;
    const data = await this.redis.lrange(sourceKey, 0, -1);

    return data.map((item) => {
      const parsed = JSON.parse(item);
      return {
        url: parsed.url,
        title: parsed.title || '',
        snippet: parsed.snippet || '',
        reliability: parsed.reliability || 'medium',
        tool: parsed.tool,
        reasoning: parsed.reasoning || '',
        timestamp: new Date(parsed.timestamp),
      } as TrackedSource;
    });
  }

  async deduplicateSources(sessionId: string): Promise<TrackedSource[]> {
    const sources = await this.getSources(sessionId);
    const seen = new Set<string>();
    const unique: TrackedSource[] = [];

    for (const source of sources) {
      if (!seen.has(source.url)) {
        seen.add(source.url);
        unique.push(source);
      }
    }

    // Update Redis with deduplicated list
    if (unique.length !== sources.length) {
      await this.redis.del(`research:sources:${sessionId}`);
      await this.addSources(sessionId, unique);
    }

    return unique;
  }

  async generateCitations(sessionId: string): Promise<Array<{ number: number; source: TrackedSource }>> {
    const sources = await this.deduplicateSources(sessionId);
    return sources.map((source, idx) => ({
      number: idx + 1,
      source,
    }));
  }
}
