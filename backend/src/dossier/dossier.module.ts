import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '../common/constants/queues';
import { DossierService } from './dossier.service';
import { DossierController } from './dossier.controller';
import { ReportService } from './report.service';
import { ReportProcessor } from './processors/report.processor';
import { StorageModule } from '../storage/storage.module';
import { WsModule } from '../ws/ws.module';

@Module({
    imports: [
        BullModule.registerQueue({ name: QUEUE_NAMES.REPORT_GENERATION }),
        WsModule,
        StorageModule,
    ],
    controllers: [DossierController],
    providers: [DossierService, ReportService, ReportProcessor],
    exports: [DossierService],
})
export class DossierModule { }
