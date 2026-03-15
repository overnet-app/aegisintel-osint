import { Injectable, Logger } from '@nestjs/common';
import { WsGateway } from '../../ws/ws.gateway';
import { StreamingChunk } from '../types/swarm.types';

@Injectable()
export class StreamManagerService {
  private readonly logger = new Logger(StreamManagerService.name);

  constructor(private wsGateway: WsGateway) {}

  /**
   * Stream a text chunk to the frontend
   */
  streamChunk(sessionId: string, content: string, type: StreamingChunk['type'] = 'text', metadata?: Record<string, any>) {
    const chunk: StreamingChunk = {
      type,
      content,
      metadata,
    };

    this.wsGateway.emitToSession(sessionId, 'research:stream_chunk', chunk);
  }

  /**
   * Stream a citation to the frontend
   */
  streamCitation(sessionId: string, citation: StreamingChunk['citation']) {
    if (!citation) return;

    const chunk: StreamingChunk = {
      type: 'citation',
      content: citation.id,
      citation,
    };

    this.wsGateway.emitToSession(sessionId, 'research:citation_added', chunk);
  }

  /**
   * Stream agent thinking/reasoning (optional, for transparency)
   */
  streamThinking(sessionId: string, reasoning: string) {
    const chunk: StreamingChunk = {
      type: 'thinking',
      content: reasoning,
    };

    this.wsGateway.emitToSession(sessionId, 'research:thinking', chunk);
  }

  /**
   * Stream tool execution status
   */
  streamToolExecution(sessionId: string, toolName: string, status: 'starting' | 'executing' | 'complete', result?: any) {
    const chunk: StreamingChunk = {
      type: 'tool_call',
      content: `${toolName}: ${status}`,
      metadata: {
        tool: toolName,
        status,
        result,
      },
    };

    this.wsGateway.emitToSession(sessionId, 'research:tool_executing', chunk);
  }

  /**
   * Stream follow-up questions
   */
  streamFollowUps(sessionId: string, questions: any[]) {
    this.wsGateway.emitToSession(sessionId, 'research:follow_ups', { questions });
  }

  /**
   * Stream quality/completeness score updates
   */
  streamQualityUpdate(sessionId: string, qualityScore: number, completenessScore: number) {
    this.wsGateway.emitToSession(sessionId, 'research:quality_update', {
      qualityScore,
      completenessScore,
    });
  }

  /**
   * Stream iteration start
   */
  streamIterationStart(sessionId: string, iterationNumber: number, reason: string) {
    this.wsGateway.emitToSession(sessionId, 'research:iteration_start', {
      iterationNumber,
      reason,
    });
  }
}
