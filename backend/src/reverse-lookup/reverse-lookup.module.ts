import { Module, forwardRef } from '@nestjs/common';
import { ReverseLookupService } from './reverse-lookup.service';
import { ReverseLookupController } from './reverse-lookup.controller';
import { PhoneLookupService } from './services/phone-lookup.service';
import { EmailLookupService } from './services/email-lookup.service';
import { ImageLookupService } from './services/image-lookup.service';
import { VINLookupService } from './services/vin-lookup.service';
import { AddressLookupService } from './services/address-lookup.service';
import { LookupAggregatorService } from './services/lookup-aggregator.service';
import { ResearchModule } from '../research/research.module';
import { SearchModule } from '../search/search.module';
import { AiModule } from '../ai/ai.module';
import { ScraperModule } from '../scraper/scraper.module';
import { CommonModule } from '../common/common.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    forwardRef(() => ResearchModule),
    forwardRef(() => SearchModule), // Import SearchModule to access AccuracyScorerService
    forwardRef(() => AiModule),
    ScraperModule,
    CommonModule,
    PrismaModule,
  ],
  providers: [
    ReverseLookupService,
    PhoneLookupService,
    EmailLookupService,
    ImageLookupService,
    VINLookupService,
    AddressLookupService,
    LookupAggregatorService,
  ],
  controllers: [ReverseLookupController],
  exports: [ReverseLookupService],
})
export class ReverseLookupModule {}
