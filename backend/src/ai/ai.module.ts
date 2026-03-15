import { Module, Global, forwardRef } from '@nestjs/common';
import { OpenRouterService } from './open-router.service';
import { SummaryAgent } from './agents/summary.agent';
import { RiskAgent } from './agents/risk.agent';
import { EntityAgent } from './agents/entity.agent';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '../common/constants/queues';
import { FaceAgent } from './agents/face.agent';
import { RelationshipAgent } from './agents/relationship.agent';
import { TemporalAgent } from './agents/temporal.agent';
import { GeoAgent } from './agents/geo.agent';
import { ImageAnalysisAgent } from './agents/image.agent';
import { TextAnalysisAgent } from './agents/text.agent';
import { PsychProfileAgent } from './agents/psych-profile.agent';
import { QueryAnalyzerAgent } from './agents/query-analyzer.agent';
import { DetectiveAgent } from './agents/detective.agent';
import { PersonaClassifierAgent } from './agents/persona-classifier.agent';
import { GoogleVisionService } from './services/google-vision.service';
import { ClarifaiService } from './services/clarifai.service';
import { PatternDetectorService } from './services/pattern-detector.service';
import { AiAnalysisProcessor } from './processors/ai-analysis.processor';
import { ResearchModule } from '../research/research.module';
import { ReasoningModule } from './reasoning/reasoning.module';
import { MemoryModule } from './memory/memory.module';

@Global()
@Module({
    imports: [
        BullModule.registerQueue({ name: QUEUE_NAMES.AI_ANALYSIS }),
        forwardRef(() => ResearchModule),
        ReasoningModule,
        MemoryModule,
    ],
    providers: [
        OpenRouterService,
        SummaryAgent,
        RiskAgent,
        EntityAgent,
        FaceAgent,
        RelationshipAgent,
        TemporalAgent,
        GeoAgent,
        ImageAnalysisAgent,
        TextAnalysisAgent,
        PsychProfileAgent,
        QueryAnalyzerAgent,
        DetectiveAgent,
        PersonaClassifierAgent,
        GoogleVisionService,
        ClarifaiService,
        PatternDetectorService,
        AiAnalysisProcessor,
    ],
    exports: [
        OpenRouterService,
        SummaryAgent,
        RiskAgent,
        EntityAgent,
        FaceAgent,
        RelationshipAgent,
        TemporalAgent,
        GeoAgent,
        ImageAnalysisAgent,
        TextAnalysisAgent,
        PsychProfileAgent,
        QueryAnalyzerAgent,
        DetectiveAgent,
        PersonaClassifierAgent,
        GoogleVisionService,
        ClarifaiService,
        PatternDetectorService,
        BullModule,
        ReasoningModule,
        MemoryModule,
    ],
})
export class AiModule { }
