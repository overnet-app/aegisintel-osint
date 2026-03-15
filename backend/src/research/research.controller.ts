import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  Res,
  HttpException,
  HttpStatus,
  Logger,
  StreamableFile,
  Header,
} from '@nestjs/common';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { AuthGuard } from '@nestjs/passport';
import type { FastifyReply } from 'fastify';
import * as fs from 'fs';
import * as path from 'path';
import { ResearchService } from './research.service';
import { ResearchSessionService } from './research-session.service';
import { SourceTrackerService } from './source-tracker.service';
import { ExportService } from './export.service';
import { CreateResearchDto } from './dto/create-research.dto';

@Controller('research')
@UseGuards(AuthGuard('jwt'), ThrottlerGuard)
export class ResearchController {
  private readonly logger = new Logger(ResearchController.name);
  private readonly debugLogPath = path.join(process.cwd(), '.cursor', 'debug.log');

  constructor(
    private researchService: ResearchService,
    private sessionService: ResearchSessionService,
    private sourceTracker: SourceTrackerService,
    private exportService: ExportService,
  ) {}

  private writeDebugLog(location: string, message: string, data: any, hypothesisId: string) {
    try {
      const logEntry = {
        location,
        message,
        data,
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId,
      };
      const logDir = path.dirname(this.debugLogPath);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      fs.appendFileSync(this.debugLogPath, JSON.stringify(logEntry) + '\n');
    } catch (e) {
      // Silent fail for debug logging
    }
  }

  @Post()
  @Throttle({ research: { limit: 10, ttl: 60000 } })
  async startResearch(@Body() dto: CreateResearchDto, @Request() req: any) {
    const userId = req.user.id;
    const sessionId = await this.researchService.startResearch(
      userId,
      dto.query,
      dto.model, // Optional override
      dto.maxIterations || 15,
    );

    return {
      id: sessionId,
      status: 'started',
    };
  }

  @Get(':id')
  async getResearchStatus(@Param('id') id: string, @Request() req: any) {
    const userId = req.user.id;
    const status = await this.researchService.getResearchStatus(id);

    if (!status) {
      return { error: 'Research session not found' };
    }

    // Verify ownership
    if (status.session.userId !== userId) {
      return { error: 'Unauthorized' };
    }

    return status;
  }

  @Get(':id/sources')
  async getSources(@Param('id') id: string, @Request() req: any) {
    const userId = req.user.id;
    const session = await this.sessionService.getSession(id);

    if (!session) {
      return { error: 'Research session not found' };
    }

    if (session.userId !== userId) {
      return { error: 'Unauthorized' };
    }

    const sources = await this.sourceTracker.getSources(id);
    return { sources };
  }

  @Get('history')
  async getHistory(@Request() req: any) {
    const userId = req.user.id;
    const sessionIds = await this.sessionService.getUserHistory(userId, 50);
    
    const sessions = await Promise.all(
      sessionIds.map((id) => this.sessionService.getSession(id)),
    );

    return { sessions: sessions.filter(Boolean) };
  }

  @Delete(':id')
  async deleteResearch(@Param('id') id: string, @Request() req: any) {
    const userId = req.user.id;
    const session = await this.sessionService.getSession(id);

    if (!session) {
      return { error: 'Research session not found' };
    }

    if (session.userId !== userId) {
      return { error: 'Unauthorized' };
    }

    await this.sessionService.deleteSession(id);
    return { success: true };
  }

  @Get(':id/export/md')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async exportMarkdown(@Param('id') id: string, @Request() req: any, @Res({ passthrough: false }) res: FastifyReply): Promise<void> {
    const userId = req.user.id;
    
    try {
      
      const session = await this.sessionService.getSession(id);

      if (!session) {
        throw new HttpException('Research session not found', HttpStatus.NOT_FOUND);
      }

      if (session.userId !== userId) {
        throw new HttpException('Unauthorized', HttpStatus.FORBIDDEN);
      }

      
      const markdown = await this.exportService.exportMarkdown(id);
      
      
      res.type('text/markdown; charset=utf-8');
      res.header('Content-Disposition', `attachment; filename="research-${id}.md"`);
      
      
      res.send(markdown);
    } catch (error: any) {
      
      this.logger.error(`Markdown export failed for session ${id}: ${error.message}`);
      this.logger.error(`Error stack: ${error.stack}`);
      if (!res.sent) {
        if (error instanceof HttpException) {
          res.status(error.getStatus());
          res.send({ error: error.message });
        } else {
          res.status(HttpStatus.INTERNAL_SERVER_ERROR);
          res.send({ error: error.message || 'Export failed' });
        }
      }
    }
  }

  @Get(':id/export/pdf')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async exportPdf(@Param('id') id: string, @Request() req: any, @Res({ passthrough: false }) res: FastifyReply): Promise<void> {
    
    if (!req.user || !req.user.id) {
      res.status(HttpStatus.UNAUTHORIZED);
      res.send({ error: 'Unauthorized' });
      return;
    }
    
    const userId = req.user.id;
    
    try {
      
      const session = await this.sessionService.getSession(id);

      if (!session) {
        throw new HttpException('Research session not found', HttpStatus.NOT_FOUND);
      }

      if (session.userId !== userId) {
        throw new HttpException('Unauthorized', HttpStatus.FORBIDDEN);
      }

      
      const pdf = await this.exportService.exportPdf(id);
      
      
      if (!Buffer.isBuffer(pdf)) {
        throw new Error('PDF export did not return a Buffer');
      }
      
      res.type('application/pdf');
      res.header('Content-Disposition', `attachment; filename="research-${id}.pdf"`);
      
      
      try {
        res.send(pdf);
      } catch (sendError: any) {
        throw sendError;
      }
    } catch (error: any) {
      
      this.logger.error(`PDF export failed for session ${id}: ${error.message}`);
      this.logger.error(`Error stack: ${error.stack}`);
      if (!res.sent) {
        if (error instanceof HttpException) {
          res.status(error.getStatus());
          res.send({ error: error.message });
        } else {
          res.status(HttpStatus.INTERNAL_SERVER_ERROR);
          res.send({ error: error.message || 'Export failed' });
        }
      }
    }
  }
}
