import { Controller, Post, Get, Body, Param, Query, UseGuards, Request, BadRequestException, Req, HttpStatus, HttpException, Res } from '@nestjs/common';
import { SearchService } from './search.service';
import { CreateSearchDto } from './dto/create-search.dto';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { StorageService } from '../storage/storage.service';
import { SearchType } from '@prisma/client';
import { fileTypeFromBuffer } from 'file-type';
import { ExportService } from '../research/export.service';
import { Throttle } from '@nestjs/throttler';
import { ThrottlerGuard } from '@nestjs/throttler';

@ApiTags('search')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), ThrottlerGuard)
@Controller('search')
export class SearchController {
    constructor(
        private readonly searchService: SearchService,
        private readonly storageService: StorageService,
        private readonly exportService: ExportService,
    ) { }

    @Post()
    @ApiOperation({ summary: 'Start a new search session' })
    async create(@Request() req, @Body() dto: CreateSearchDto) {
        return this.searchService.startSearch(req.user.id, dto);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get current search session status and results' })
    async findOne(@Param('id') id: string) {
        return this.searchService.getSession(id);
    }

    @Get()
    @ApiOperation({ summary: 'Get all user search sessions' })
    async findAll(@Request() req, @Query('page') page?: string, @Query('limit') limit?: string) {
        const pageNum = page ? parseInt(page, 10) : 1;
        const limitNum = limit ? parseInt(limit, 10) : 20;
        return this.searchService.getUserSessions(req.user.id, pageNum, limitNum);
    }

    @Post('upload')
    @ApiOperation({ summary: 'Upload an image for OSINT analysis' })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                file: {
                    type: 'string',
                    format: 'binary',
                },
            },
        },
    })
    async uploadImage(@Req() request: FastifyRequest, @Request() req) {
        // Verify authentication
        if (!req.user || !req.user.id) {
            throw new HttpException('Unauthorized: Authentication required', HttpStatus.UNAUTHORIZED);
        }

        const data = await request.file();
        
        if (!data) {
            throw new BadRequestException('No file provided');
        }

        // Validate file type
        const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedMimeTypes.includes(data.mimetype)) {
            throw new BadRequestException('Invalid file type. Only JPG, PNG, GIF, and WebP images are allowed.');
        }

        // Validate file size (10MB max)
        const maxSize = 10 * 1024 * 1024; // 10MB
        const buffer = await data.toBuffer();
        if (buffer.length > maxSize) {
            throw new BadRequestException('File size exceeds 10MB limit.');
        }

        // Verify file type from buffer
        const fileType = await fileTypeFromBuffer(buffer);
        if (!fileType || !fileType.mime.startsWith('image/')) {
            throw new BadRequestException('Invalid file. File must be a valid image.');
        }

        // Generate unique filename - use authenticated user ID
        const userId = req.user.id;
        const timestamp = Date.now();
        const uuid = Math.random().toString(36).substring(2, 15);
        const extension = fileType.ext || 'jpg';
        const fileName = `images/${userId}/${timestamp}-${uuid}.${extension}`;

        // Upload to MinIO
        const imageUrl = await this.storageService.uploadFile(fileName, buffer, fileType.mime);

        // Create search session with IMAGE type
        const session = await this.searchService.startSearch(userId, {
            type: SearchType.IMAGE,
            imageUrl,
        });

        return {
            sessionId: session.id,
            imageUrl,
            message: 'Image uploaded successfully. Analysis in progress.',
        };
    }

    @Get(':id/export/md')
    @Throttle({ default: { limit: 30, ttl: 60000 } })
    @ApiOperation({ summary: 'Export OSINT report as Markdown' })
    async exportMarkdown(@Param('id') id: string, @Request() req: any, @Res({ passthrough: false }) res: FastifyReply): Promise<void> {
        if (!req.user || !req.user.id) {
            res.status(HttpStatus.UNAUTHORIZED);
            res.send({ error: 'Unauthorized' });
            return;
        }

        const userId = req.user.id;

        try {
            const session = await this.searchService.getSession(id);
            if (!session) {
                throw new HttpException('Search session not found', HttpStatus.NOT_FOUND);
            }

            if (session.userId !== userId) {
                throw new HttpException('Unauthorized', HttpStatus.FORBIDDEN);
            }

            const markdown = await this.exportService.exportOSINTMarkdown(id);

            res.type('text/markdown');
            res.header('Content-Disposition', `attachment; filename="osint-report-${id}.md"`);
            res.send(markdown);
        } catch (error: any) {
            if (error instanceof HttpException) {
                throw error;
            }
            throw new HttpException(`Export failed: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Get(':id/export/pdf')
    @Throttle({ default: { limit: 30, ttl: 60000 } })
    @ApiOperation({ summary: 'Export OSINT report as PDF' })
    async exportPdf(@Param('id') id: string, @Request() req: any, @Res({ passthrough: false }) res: FastifyReply): Promise<void> {
        if (!req.user || !req.user.id) {
            res.status(HttpStatus.UNAUTHORIZED);
            res.send({ error: 'Unauthorized' });
            return;
        }

        const userId = req.user.id;

        try {
            const session = await this.searchService.getSession(id);
            if (!session) {
                throw new HttpException('Search session not found', HttpStatus.NOT_FOUND);
            }

            if (session.userId !== userId) {
                throw new HttpException('Unauthorized', HttpStatus.FORBIDDEN);
            }

            const pdf = await this.exportService.exportOSINTPdf(id);

            if (!Buffer.isBuffer(pdf)) {
                throw new HttpException('PDF generation failed', HttpStatus.INTERNAL_SERVER_ERROR);
            }

            res.type('application/pdf');
            res.header('Content-Disposition', `attachment; filename="osint-report-${id}.pdf"`);
            res.send(pdf);
        } catch (error: any) {
            if (error instanceof HttpException) {
                throw error;
            }
            throw new HttpException(`Export failed: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
