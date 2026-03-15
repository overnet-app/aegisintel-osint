import { Controller, Get, Delete, Param, Query, UseGuards, Request } from '@nestjs/common';
import { DossierService } from './dossier.service';
import { AuthGuard } from '@nestjs/passport';
import { ReportService } from './report.service';

@Controller('dossiers')
@UseGuards(AuthGuard('jwt'))
export class DossierController {
    constructor(
        private readonly dossierService: DossierService,
        private readonly reportService: ReportService,
    ) { }

    @Get()
    async getMyDossiers(@Request() req, @Query('page') page?: string, @Query('limit') limit?: string) {
        const pageNum = page ? parseInt(page, 10) : 1;
        const limitNum = limit ? parseInt(limit, 10) : 20;
        return this.dossierService.getUserDossiers(req.user.id, pageNum, limitNum);
    }

    @Get('analytics')
    async getAnalytics(@Request() req) {
        return this.dossierService.getAnalytics(req.user.id);
    }

    @Get(':id')
    async getDossier(@Param('id') id: string) {
        return this.dossierService.getDossier(id);
    }

    @Get(':id/pdf')
    async exportPdf(@Param('id') id: string) {
        const dossier = await this.dossierService.getDossier(id);
        const url = await this.reportService.generatePdfReport(dossier);
        return { url };
    }

    @Delete(':id')
    async deleteDossier(@Param('id') id: string, @Request() req) {
        return this.dossierService.deleteDossier(id, req.user.id);
    }
}
