import { Module, Global } from '@nestjs/common';
import { AuditService } from './services/audit.service';
import { CacheService } from './services/cache.service';
import { ExifService } from './services/exif.service';
import { OcrService } from './services/ocr.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ScraperModule } from '../scraper/scraper.module';
import { RateLimitGuard } from './guards/rate-limit.guard';

@Global()
@Module({
    imports: [PrismaModule, ScraperModule],
    providers: [AuditService, CacheService, ExifService, OcrService, RateLimitGuard],
    exports: [AuditService, CacheService, ExifService, OcrService, RateLimitGuard],
})
export class CommonModule { }
