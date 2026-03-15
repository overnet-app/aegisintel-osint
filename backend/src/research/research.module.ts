import { Module, forwardRef } from '@nestjs/common';
import { ResearchService } from './research.service';
import { ResearchController } from './research.controller';
import { ResearchSessionService } from './research-session.service';
import { SourceTrackerService } from './source-tracker.service';
import { ArchitectAgent } from './agents/architect.agent';
import { ScoutAgent } from './agents/scout.agent';
import { QuantAgent } from './agents/quant.agent';
import { LogicianAgent } from './agents/logician.agent';
import { ThinkerAgent } from './agents/thinker.agent';
import { BaseResearchAgent } from './agents/base-research-agent';
import { EnhancedBaseAgent } from './agents/enhanced-base-agent';
import { RapidAnalystAgent } from './agents/rapid-analyst.agent';
import { CitationAgent } from './agents/citation.agent';
import { CriticAgent } from './agents/critic.agent';
import { HypothesisAgent } from './agents/hypothesis.agent';
import { VisionAgent } from './agents/vision.agent';
import { FactCheckerAgent } from './agents/fact-checker.agent';
import { ResearchDetectiveAgent } from './agents/research-detective.agent';
import { ToolRegistryService } from './tools/tool-registry.service';
import { WebSearchTool } from './tools/web-search.tool';
import { FinanceTool } from './tools/finance.tool';
import { SentimentTool } from './tools/sentiment.tool';
import { StatisticsTool } from './tools/statistics.tool';
import { WikipediaTool } from './tools/wikipedia.tool';
import { DocumentTool } from './tools/document.tool';
import { CalculatorTool } from './tools/calculator.tool';
import { ImageAnalysisTool } from './tools/image-analysis.tool';
import { PdfExtractorTool } from './tools/pdf-extractor.tool';
import { AcademicTool } from './tools/academic.tool';
import { NewsTool } from './tools/news.tool';
import { PredictorAgent } from './agents/predictor.agent';
import { ExportService } from './export.service';
import { StreamManagerService } from './streaming/stream-manager.service';
import { AgentModelResolverService } from './services/agent-model-resolver.service';
import { McpModule } from '../mcp/mcp.module';
import { AiModule } from '../ai/ai.module';
import { SearchModule } from '../search/search.module';
import { CommonModule } from '../common/common.module';
import { WsModule } from '../ws/ws.module';
import { ScraperModule } from '../scraper/scraper.module';
import { UserModule } from '../user/user.module';
import { ReverseLookupModule } from '../reverse-lookup/reverse-lookup.module';

@Module({
  imports: [McpModule, forwardRef(() => AiModule), forwardRef(() => SearchModule), CommonModule, WsModule, ScraperModule, forwardRef(() => UserModule), forwardRef(() => ReverseLookupModule)],
  providers: [
    ResearchService,
    ResearchSessionService,
    SourceTrackerService,
    StreamManagerService,
    AgentModelResolverService,
    ArchitectAgent,
    ScoutAgent,
    QuantAgent,
    PredictorAgent,
    LogicianAgent,
    ThinkerAgent,
    RapidAnalystAgent,
    CitationAgent,
    CriticAgent,
    HypothesisAgent,
    VisionAgent,
    FactCheckerAgent,
    ResearchDetectiveAgent,
    ToolRegistryService,
    WebSearchTool,
    FinanceTool,
    SentimentTool,
    StatisticsTool,
    WikipediaTool,
    DocumentTool,
    CalculatorTool,
    ImageAnalysisTool,
    PdfExtractorTool,
    AcademicTool,
    NewsTool,
    ExportService,
  ],
  controllers: [ResearchController],
  exports: [
    ResearchService,
    ArchitectAgent,
    ScoutAgent,
    LogicianAgent,
    ThinkerAgent,
    CriticAgent,
    HypothesisAgent,
    VisionAgent,
    FactCheckerAgent,
    ResearchDetectiveAgent,
    AgentModelResolverService,
    SourceTrackerService,
    StreamManagerService,
    ExportService,
  ],
})
export class ResearchModule {}
