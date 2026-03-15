import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../../common/constants/queues';
import { DossierService } from '../dossier.service';
import { WsGateway } from '../../ws/ws.gateway';
import { ReportService } from '../report.service';

@Processor(QUEUE_NAMES.REPORT_GENERATION)
export class ReportProcessor extends WorkerHost {
    private readonly logger = new Logger(ReportProcessor.name);

    constructor(
        private dossierService: DossierService,
        private reportService: ReportService,
        private wsGateway: WsGateway,
    ) {
        super();
    }

    async process(job: Job<any, any, string>): Promise<any> {
        const { sessionId } = job.data;
        this.logger.log(`Processing report generation for session ${sessionId}`);

        try {
            this.wsGateway.emitProgress(sessionId, {
                sessionId,
                progress: 30,
                status: 'Creating intelligence dossier...',
                stage: 'REPORTING',
            });

            const dossier = await this.dossierService.createFromSession(sessionId);

            this.wsGateway.emitProgress(sessionId, {
                sessionId,
                progress: 70,
                status: 'Rendering PDF report...',
                stage: 'REPORTING',
            });

            const pdfUrl = await this.reportService.generatePdfReport(dossier);
            this.logger.log(`PDF report generated: ${pdfUrl}`);

            this.wsGateway.emitProgress(sessionId, {
                sessionId,
                progress: 100,
                status: 'Dossier and PDF report completed.',
                stage: 'REPORTING',
                dossierId: dossier.id,
                reportUrl: pdfUrl,
            });

            return { dossierId: dossier.id, reportUrl: pdfUrl };
        } catch (error) {
            this.logger.error(`Report generation failed: ${error.message}`);
            this.wsGateway.emitProgress(sessionId, {
                sessionId,
                progress: -1,
                status: `Error generating report: ${error.message}`,
                stage: 'REPORTING',
            });
            throw error;
        }
    }
}
