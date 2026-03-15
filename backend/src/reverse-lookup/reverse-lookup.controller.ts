import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
  Res,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { FastifyReply } from 'fastify';
import { ReverseLookupService } from './reverse-lookup.service';
import { LookupType, LookupOptions } from './types/lookup.types';
import { ExportService } from '../research/export.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('reverse-lookup')
@UseGuards(AuthGuard('jwt'), ThrottlerGuard)
export class ReverseLookupController {
  constructor(
    private reverseLookupService: ReverseLookupService,
    private exportService: ExportService,
    private prisma: PrismaService,
  ) {}

  @Post('phone')
  async lookupPhone(
    @Body() body: { phoneNumber: string; options?: LookupOptions },
    @Request() req,
  ) {
    const options: LookupOptions = {
      ...body.options,
      userId: req.user.id,
      sessionId: `phone-${Date.now()}-${req.user.id}`,
    };

    return this.reverseLookupService.lookup(LookupType.PHONE, body.phoneNumber, options);
  }

  @Post('email')
  async lookupEmail(
    @Body() body: { emailAddress: string; options?: LookupOptions },
    @Request() req,
  ) {
    const options: LookupOptions = {
      ...body.options,
      userId: req.user.id,
      sessionId: `email-${Date.now()}-${req.user.id}`,
    };

    return this.reverseLookupService.lookup(LookupType.EMAIL, body.emailAddress, options);
  }

  @Post('image')
  async lookupImage(
    @Body() body: { imageUrl: string; options?: LookupOptions },
    @Request() req,
  ) {
    const options: LookupOptions = {
      ...body.options,
      userId: req.user.id,
      sessionId: `image-${Date.now()}-${req.user.id}`,
    };

    return this.reverseLookupService.lookup(LookupType.IMAGE, body.imageUrl, options);
  }

  @Post('vin')
  async lookupVIN(
    @Body() body: { vin: string; options?: LookupOptions },
    @Request() req,
  ) {
    const options: LookupOptions = {
      ...body.options,
      userId: req.user.id,
      sessionId: `vin-${Date.now()}-${req.user.id}`,
    };

    return this.reverseLookupService.lookup(LookupType.VIN, body.vin, options);
  }

  @Post('address')
  async lookupAddress(
    @Body() body: { address: string; options?: LookupOptions },
    @Request() req,
  ) {
    const options: LookupOptions = {
      ...body.options,
      userId: req.user.id,
      sessionId: `address-${Date.now()}-${req.user.id}`,
    };

    return this.reverseLookupService.lookup(LookupType.ADDRESS, body.address, options);
  }

  @Post('aggregate')
  async aggregateLookups(
    @Body() body: {
      lookups: Array<{ type: LookupType; query: string }>;
      options?: LookupOptions;
    },
    @Request() req,
  ) {
    const options: LookupOptions = {
      ...body.options,
      userId: req.user.id,
      sessionId: `aggregate-${Date.now()}-${req.user.id}`,
    };

    return this.reverseLookupService.aggregateLookups(body.lookups, options);
  }

  @Get(':id/export/pdf')
  async exportPdf(@Param('id') id: string, @Res() res: FastifyReply, @Request() req): Promise<void> {
    try {
      // Get lookup session from database
      const session = await this.prisma.reverseLookupSession.findUnique({
        where: { id },
      });

      if (!session || session.userId !== req.user.id) {
        res.status(404).send({ message: 'Lookup session not found' });
        return;
      }

      const result = session.result as any;
      const lookupType = session.type.toLowerCase();

      const pdfBuffer = await this.exportService.exportReverseLookupPdf(result, lookupType);

      res.type('application/pdf');
      res.header('Content-Disposition', `attachment; filename="reverse-lookup-${id}.pdf"`);
      res.send(pdfBuffer);
    } catch (error: any) {
      res.status(500).send({ message: error.message || 'Export failed' });
    }
  }

  @Get(':id/export/md')
  async exportMarkdown(@Param('id') id: string, @Res() res: FastifyReply, @Request() req): Promise<void> {
    try {
      // Get lookup session from database
      const session = await this.prisma.reverseLookupSession.findUnique({
        where: { id },
      });

      if (!session || session.userId !== req.user.id) {
        res.status(404).send({ message: 'Lookup session not found' });
        return;
      }

      const result = session.result as any;
      const lookupType = session.type.toLowerCase();

      const markdown = await this.exportService.exportReverseLookupMarkdown(result, lookupType);

      res.type('text/markdown');
      res.header('Content-Disposition', `attachment; filename="reverse-lookup-${id}.md"`);
      res.send(markdown);
    } catch (error: any) {
      res.status(500).send({ message: error.message || 'Export failed' });
    }
  }
}
