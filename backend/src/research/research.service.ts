import { Injectable, Logger } from '@nestjs/common';
import { McpClientService } from '../mcp/mcp-client.service';
import { ToolRegistryService } from './tools/tool-registry.service';
import { ResearchSessionService } from './research-session.service';
import { SourceTrackerService } from './source-tracker.service';
import { ArchitectAgent } from './agents/architect.agent';
import { ScoutAgent } from './agents/scout.agent';
import { QuantAgent } from './agents/quant.agent';
import { LogicianAgent } from './agents/logician.agent';
import { ThinkerAgent } from './agents/thinker.agent';
import { RapidAnalystAgent } from './agents/rapid-analyst.agent';
import { CriticAgent } from './agents/critic.agent';
import { HypothesisAgent } from './agents/hypothesis.agent';
import { StreamManagerService } from './streaming/stream-manager.service';
import { WsGateway } from '../ws/ws.gateway';
import { UserService } from '../user/user.service';
import { AgentModelResolverService } from './services/agent-model-resolver.service';

@Injectable()
export class ResearchService {
  private readonly logger = new Logger(ResearchService.name);
  private readonly qualityThreshold = 80;
  private readonly defaultMaxIterations = 15;

  constructor(
    private mcpClient: McpClientService,
    private toolRegistry: ToolRegistryService,
    private sessionService: ResearchSessionService,
    private sourceTracker: SourceTrackerService,
    private architectAgent: ArchitectAgent,
    private scoutAgent: ScoutAgent,
    private quantAgent: QuantAgent,
    private logicianAgent: LogicianAgent,
    private thinkerAgent: ThinkerAgent,
    private rapidAnalystAgent: RapidAnalystAgent,
    private criticAgent: CriticAgent,
    private hypothesisAgent: HypothesisAgent,
    private streamManager: StreamManagerService,
    private wsGateway: WsGateway,
    private userService: UserService,
    private agentModelResolver: AgentModelResolverService,
  ) {}

  async startResearch(
    userId: string,
    query: string,
    modelOverride?: string,
    maxIterations: number = this.defaultMaxIterations,
  ): Promise<string> {
    
    this.logger.log(`Starting research for user ${userId}: ${query}`);

    // Get user's research model preferences
    
    const user = await this.userService.findById(userId);
    
    
    let provider = 'openrouter';
    let model = 'google/gemma-3-27b-it:free'; // Default to free model

    if (modelOverride) {
      // If override provided, parse it
      if (modelOverride === 'llamacpp' || modelOverride.startsWith('llamacpp:')) {
        provider = 'llamacpp';
        model = 'local';
      } else {
        provider = 'openrouter';
        model = modelOverride;
      }
    } else if (user) {
      provider = user.researchModelProvider || 'openrouter';
      
      // If provider is llamacpp, use local model
      if (provider === 'llamacpp') {
        model = 'local';
      } else {
        // Use user's selected model, or default based on tier
        const tier = user.researchModelTier || 'free';
        if (user.researchModel) {
          model = user.researchModel;
        } else {
          // Default based on tier
          model = tier === 'paid' 
            ? 'google/gemma-3-27b-it' 
            : 'google/gemma-3-27b-it:free';
        }
      }
    }

    const modelConfig = `${provider}:${model}`;

    this.logger.log(`Using research model: ${provider}:${model} for user ${userId}`);

    // Create session
    
    const sessionId = await this.sessionService.createSession(userId, query, modelConfig);
    
    
    // Emit session started - use job room for compatibility
    
    this.wsGateway.emitProgress(sessionId, { 
      type: 'research:session_started', 
      sessionId, 
      query,
      model: { provider, model: modelConfig },
    });
    

    // Phase 0: Generate quick initial response (hybrid approach)
    // Resolve agent-specific model for Rapid Analyst
    const rapidModel = await this.agentModelResolver.resolveAgentModel(
      userId,
      'rapidAnalyst',
      provider,
      model,
    );
    
    this.rapidAnalystAgent.generateQuickResponse(query, sessionId, rapidModel.provider, rapidModel.model, userId)
      .then((rapidResponse) => {
        this.wsGateway.emitProgress(sessionId, {
          type: 'research:rapid_response',
          sessionId,
          response: rapidResponse,
          message: 'Quick response generated',
        });
      })
      .catch((error) => {
        this.logger.warn(`Rapid response failed for session ${sessionId}: ${error.message}`);
        // Continue with deep research even if rapid response fails
      });

    // Run deep research asynchronously (continues in background)
    
    this.runResearch(sessionId, userId, query, provider, model, maxIterations).catch((error) => {
      
      this.logger.error(`Research error for session ${sessionId}: ${error.message}`);
      this.sessionService.updateSession(sessionId, { status: 'error' });
      this.wsGateway.emitProgress(sessionId, { type: 'research:error', sessionId, error: error.message });
    });

    return sessionId;
  }

  private async runResearch(
    sessionId: string,
    userId: string,
    query: string,
    provider: string,
    model: string,
    maxIterations: number,
  ): Promise<void> {
    
    try {
      // Phase 1: The Architect - Strategic Planning
      
      await this.sessionService.updateSession(sessionId, { status: 'planning' });
      
      this.wsGateway.emitProgress(sessionId, { 
        type: 'research:architect_planning', 
        sessionId,
        message: 'The Architect is creating the strategic research plan...',
      });

      // Resolve agent-specific model for Architect
      const architectModel = await this.agentModelResolver.resolveAgentModel(
        userId,
        'architect',
        provider,
        model,
      );
      
      this.logger.log(`[Swarm Orchestrator] Phase 1: The Architect planning for session ${sessionId} with ${architectModel.provider}:${architectModel.model}`);
      
      // Add timeout for planning phase (90 seconds for slower models)
      let plan: any;
      let planningTimedOut = false;
      
      try {
        
        const planPromise = this.architectAgent.createResearchPlan(query, architectModel.provider, architectModel.model, userId);
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            planningTimedOut = true;
            reject(new Error('Planning phase timed out after 90 seconds'));
          }, 90000);
        });
        
        plan = await Promise.race([planPromise, timeoutPromise]);
        
      } catch (error: any) {
        if (planningTimedOut) {
          this.logger.warn(`[Swarm Orchestrator] Planning phase timed out after 90 seconds, using fallback plan`);
          this.wsGateway.emitProgress(sessionId, {
            type: 'research:architect_planning',
            sessionId,
            message: 'Planning timed out, using simplified plan...',
          });
        } else {
          this.logger.warn(`[Swarm Orchestrator] Planning phase failed: ${error.message}, using fallback plan`);
          this.wsGateway.emitProgress(sessionId, {
            type: 'research:architect_planning',
            sessionId,
            message: 'Planning encountered an error, using fallback plan...',
          });
        }
        
        // Generate a simple fallback plan directly (don't call LLM again)
        plan = this.generateSimplePlan(query);
        this.logger.log(`[Swarm Orchestrator] Using fallback plan with ${plan.searchDirectives.length} directives`);
      }
      
      this.logger.log(
        `[Swarm Orchestrator] The Architect complete - ${plan.searchDirectives?.length || 0} directives, ` +
        `Quant required: ${plan.requiresQuant}`
      );
      this.wsGateway.emitProgress(sessionId, { 
        type: 'research:architect_complete', 
        sessionId, 
        plan,
        message: `Strategic plan created with ${plan.searchDirectives?.length || 0} search directives`,
      });

      // Phase 2: The Scout - Information Retrieval
      await this.sessionService.updateSession(sessionId, { status: 'researching' });
      this.wsGateway.emitProgress(sessionId, { 
        type: 'research:scout_searching', 
        sessionId,
        message: 'The Scout is gathering information...',
      });

      // Resolve agent-specific model for Scout
      const scoutModel = await this.agentModelResolver.resolveAgentModel(
        userId,
        'scout',
        provider,
        model,
      );
      
      this.logger.log(`[Swarm Orchestrator] Phase 2: The Scout executing search plan with ${scoutModel.provider}:${scoutModel.model}`);
      const scoutFindings = await this.scoutAgent.executeSearchPlan(plan, scoutModel.provider, scoutModel.model, userId);

      // Track all sources from scout findings
      for (const finding of scoutFindings) {
        await this.sourceTracker.addSources(
          sessionId,
          finding.rawData.map((d) => ({
            url: d.source.url,
            title: d.source.title,
            snippet: d.source.snippet,
            reliability: d.source.reliability,
            tool: finding.tool,
            reasoning: `Scout directive ${finding.directiveId}`,
            timestamp: d.timestamp ? new Date(d.timestamp) : new Date(),
          })),
        );
      }

      this.logger.log(`[Swarm Orchestrator] The Scout complete - ${scoutFindings.length} directives executed`);
      this.wsGateway.emitProgress(sessionId, {
        type: 'research:scout_complete',
        sessionId,
        findingsCount: scoutFindings.length,
        message: `The Scout gathered data from ${scoutFindings.length} search directives`,
      });

      // Phase 3: The Quant - Financial Analysis (if needed)
      let quantAnalysis: any = undefined;
      if (plan.requiresQuant) {
        await this.sessionService.updateSession(sessionId, { status: 'analyzing' });
        this.wsGateway.emitProgress(sessionId, {
          type: 'research:quant_analyzing',
          sessionId,
          message: 'The Quant is analyzing financial data...',
        });

        // Resolve agent-specific model for Quant
        const quantModel = await this.agentModelResolver.resolveAgentModel(
          userId,
          'quant',
          provider,
          model,
        );
        
        this.logger.log(`[Swarm Orchestrator] Phase 3: The Quant analyzing financial data with ${quantModel.provider}:${quantModel.model}`);
        quantAnalysis = await this.quantAgent.analyzeFinancialData(scoutFindings, quantModel.provider, quantModel.model, userId);

        this.logger.log(`[Swarm Orchestrator] The Quant complete`);
        this.wsGateway.emitProgress(sessionId, {
          type: 'research:quant_complete',
          sessionId,
          analysis: quantAnalysis,
          message: 'Financial analysis complete',
        });
      }

      // Phase 4: The Logician - Validation
      await this.sessionService.updateSession(sessionId, { status: 'verifying' });
      this.wsGateway.emitProgress(sessionId, {
        type: 'research:logician_validating',
        sessionId,
        message: 'The Logician is validating facts and checking for contradictions...',
      });

      // Resolve agent-specific model for Logician
      const logicianModel = await this.agentModelResolver.resolveAgentModel(
        userId,
        'logician',
        provider,
        model,
      );
      
      this.logger.log(`[Swarm Orchestrator] Phase 4: The Logician validating findings with ${logicianModel.provider}:${logicianModel.model}`);
      const logicianVerdict = await this.logicianAgent.validateFindings(
        scoutFindings,
        quantAnalysis,
        logicianModel.provider,
        logicianModel.model,
        userId,
      );

      const qualityScore = logicianVerdict.qualityScore;
      const completenessScore = logicianVerdict.completenessScore;

      await this.sessionService.updateSession(sessionId, {
        qualityScore,
        completenessScore,
      });

      this.logger.log(
        `[Swarm Orchestrator] The Logician complete - Quality: ${qualityScore}%, ` +
        `Completeness: ${completenessScore}%, ` +
        `${logicianVerdict.validatedFacts.length} validated facts, ` +
        `${logicianVerdict.contradictions.length} contradictions`
      );
      this.wsGateway.emitProgress(sessionId, {
        type: 'research:logician_complete',
        sessionId,
        verdict: logicianVerdict,
        message: `Validation complete - Quality: ${qualityScore}%, Completeness: ${completenessScore}%`,
      });

      // Iterative Deep Research Loop
      let currentIteration = 0;
      let allFindings = [...scoutFindings];
      let currentQuality = qualityScore;
      let currentCompleteness = completenessScore;
      const qualityThreshold = 85;

      while (currentIteration < maxIterations && currentQuality < qualityThreshold) {
        currentIteration++;
        this.logger.log(
          `[Swarm Orchestrator] Starting iteration ${currentIteration}/${maxIterations} - ` +
          `Current quality: ${currentQuality}% (target: ${qualityThreshold}%)`
        );

        this.streamManager.streamIterationStart(
          sessionId,
          currentIteration,
          `Quality ${currentQuality}% below threshold ${qualityThreshold}% - refining research`
        );

        // Phase 4.5: The Critic - Review Findings
        this.wsGateway.emitProgress(sessionId, {
          type: 'research:critic_reviewing',
          sessionId,
          message: `The Critic is reviewing findings (iteration ${currentIteration})...`,
        });

        // Resolve agent-specific model for Critic
        const criticModel = await this.agentModelResolver.resolveAgentModel(
          userId,
          'critic',
          provider,
          model,
        );
        
        const criticReview = await this.criticAgent.reviewFindings(
          allFindings,
          logicianVerdict,
          quantAnalysis,
          criticModel.provider,
          criticModel.model,
          userId,
        );

        this.logger.log(
          `[Swarm Orchestrator] The Critic complete - Quality: ${criticReview.overallAssessment.qualityScore}%, ` +
          `Continue: ${criticReview.shouldContinue}, ` +
          `${criticReview.weakEvidence.length} weak points, ${criticReview.missingInformation.length} gaps`
        );

        this.wsGateway.emitProgress(sessionId, {
          type: 'research:critic_complete',
          sessionId,
          review: criticReview,
          message: `Critic review complete - ${criticReview.weakEvidence.length} weak points identified`,
        });

        // Update quality scores from critic
        currentQuality = criticReview.overallAssessment.qualityScore;
        currentCompleteness = criticReview.overallAssessment.completenessScore;

        this.streamManager.streamQualityUpdate(sessionId, currentQuality, currentCompleteness);

        // Check if we should continue
        if (!criticReview.shouldContinue || currentQuality >= qualityThreshold) {
          this.logger.log(
            `[Swarm Orchestrator] Stopping iterations - Quality: ${currentQuality}% ` +
            `(threshold: ${qualityThreshold}%), Continue: ${criticReview.shouldContinue}`
          );
          break;
        }

        // Phase 4.6: The Hypothesis Generator - Create Testable Hypotheses
        this.wsGateway.emitProgress(sessionId, {
          type: 'research:hypothesis_generating',
          sessionId,
          message: `The Hypothesis Generator is creating testable hypotheses...`,
        });

        // Resolve agent-specific model for Hypothesis
        const hypothesisModel = await this.agentModelResolver.resolveAgentModel(
          userId,
          'hypothesis',
          provider,
          model,
        );
        
        const hypothesisSet = await this.hypothesisAgent.generateHypotheses(
          query,
          allFindings,
          criticReview,
          hypothesisModel.provider,
          hypothesisModel.model,
          userId,
        );

        this.logger.log(
          `[Swarm Orchestrator] Hypothesis Generator complete - ` +
          `${hypothesisSet.hypotheses.length} hypotheses, ${hypothesisSet.searchQueries.length} search queries`
        );

        this.wsGateway.emitProgress(sessionId, {
          type: 'research:hypothesis_complete',
          sessionId,
          hypotheses: hypothesisSet,
          message: `Generated ${hypothesisSet.hypotheses.length} testable hypotheses`,
        });

        // Phase 4.7: Replan based on hypotheses
        this.wsGateway.emitProgress(sessionId, {
          type: 'research:replanning',
          sessionId,
          message: 'The Architect is replanning based on hypotheses...',
        });

        // Create additional search directives from hypotheses
        const additionalDirectives = hypothesisSet.searchQueries.slice(0, 5).map((searchQuery, idx) => ({
          step: plan.searchDirectives.length + idx + 1,
          action: 'search' as const,
          tool: 'web_search',
          query: searchQuery,
          reason: `Testing hypothesis: ${hypothesisSet.hypotheses[idx]?.statement || searchQuery}`,
          dependsOn: [],
        }));

        // Phase 4.8: Execute additional searches
        this.wsGateway.emitProgress(sessionId, {
          type: 'research:scout_searching',
          sessionId,
          message: `The Scout is executing additional searches (iteration ${currentIteration})...`,
        });

        const additionalFindings = await this.scoutAgent.executeSearchPlan(
          {
            ...plan,
            searchDirectives: additionalDirectives,
          },
          scoutModel.provider,
          scoutModel.model,
          userId,
        );

        // Track new sources
        for (const finding of additionalFindings) {
          await this.sourceTracker.addSources(
            sessionId,
            finding.rawData.map((d) => ({
              url: d.source.url,
              title: d.source.title,
              snippet: d.source.snippet,
              reliability: d.source.reliability,
              tool: finding.tool,
              reasoning: `Iteration ${currentIteration}: ${finding.query}`,
              timestamp: d.timestamp ? new Date(d.timestamp) : new Date(),
            })),
          );
        }

        allFindings = [...allFindings, ...additionalFindings];

        this.logger.log(
          `[Swarm Orchestrator] Iteration ${currentIteration} complete - ` +
          `Added ${additionalFindings.length} new findings, Total: ${allFindings.length}`
        );

        // Re-validate with Logician
        this.wsGateway.emitProgress(sessionId, {
          type: 'research:logician_validating',
          sessionId,
          message: 'The Logician is re-validating findings...',
        });

        const updatedLogicianVerdict = await this.logicianAgent.validateFindings(
          allFindings,
          quantAnalysis,
          logicianModel.provider,
          logicianModel.model,
          userId,
        );

        currentQuality = updatedLogicianVerdict.qualityScore;
        currentCompleteness = updatedLogicianVerdict.completenessScore;

        await this.sessionService.updateSession(sessionId, {
          qualityScore: currentQuality,
          completenessScore: currentCompleteness,
        });

        this.streamManager.streamQualityUpdate(sessionId, currentQuality, currentCompleteness);

        this.logger.log(
          `[Swarm Orchestrator] Re-validation complete - Quality: ${currentQuality}%, ` +
          `Completeness: ${currentCompleteness}%`
        );
      }

      // Use final findings and verdict
      const finalFindings = allFindings;
      const finalLogicianVerdict = await this.logicianAgent.validateFindings(
        finalFindings,
        quantAnalysis,
        logicianModel.provider,
        logicianModel.model,
        userId,
      );
      const finalQuality = finalLogicianVerdict.qualityScore;
      const finalCompleteness = finalLogicianVerdict.completenessScore;

      // Phase 5: The Thinker - Final Synthesis
      await this.sessionService.updateSession(sessionId, { status: 'synthesizing' });
      this.wsGateway.emitProgress(sessionId, {
        type: 'research:thinker_synthesizing',
        sessionId,
        message: 'The Thinker is synthesizing the final report...',
      });

      // Resolve agent-specific model for Thinker
      const thinkerModel = await this.agentModelResolver.resolveAgentModel(
        userId,
        'thinker',
        provider,
        model,
      );
      
      this.logger.log(`[Swarm Orchestrator] Phase 5: The Thinker synthesizing final report with ${thinkerModel.provider}:${thinkerModel.model}`);
      const thinkerReport = await this.thinkerAgent.synthesizeReport(
        query,
        plan,
        finalLogicianVerdict,
        quantAnalysis,
        thinkerModel.provider,
        thinkerModel.model,
        userId,
      );

      this.logger.log(`[Swarm Orchestrator] The Thinker complete - Report synthesized`);
      
      // Generate follow-up questions
      const followUpQuestions = await this.thinkerAgent.generateFollowUpQuestions(
        query,
        thinkerReport,
        finalLogicianVerdict,
        thinkerModel.provider,
        thinkerModel.model,
        userId,
      );

      this.streamManager.streamFollowUps(sessionId, followUpQuestions);

      this.wsGateway.emitProgress(sessionId, {
        type: 'research:thinker_complete',
        sessionId,
        report: thinkerReport,
        followUpQuestions,
        message: 'Final report synthesized',
      });

      // Generate final result
      const finalResult = {
        query,
        plan,
        scoutFindings: finalFindings,
        quantAnalysis,
        logicianVerdict: finalLogicianVerdict,
        thinkerReport,
        sources: await this.sourceTracker.deduplicateSources(sessionId),
        summary: thinkerReport.executiveSummary,
        iterations: currentIteration,
      };

      await this.sessionService.storeResult(sessionId, finalResult);
      await this.sessionService.updateSession(sessionId, {
        status: 'complete',
        qualityScore: finalQuality,
        completenessScore: finalCompleteness,
      });

      this.wsGateway.emitProgress(sessionId, {
        type: 'research:complete',
        sessionId,
        result: finalResult,
        toolExecutions: finalFindings.map((f) => ({
          tool: f.tool,
          query: f.query,
          credibilityScore: f.credibilityScore,
        })),
        sources: finalResult.sources,
        iterations: currentIteration,
      });

      this.logger.log(
        `[Swarm Orchestrator] Research completed for session ${sessionId} - ` +
        `Quality: ${finalQuality}%, Completeness: ${finalCompleteness}%, ` +
        `Iterations: ${currentIteration}/${maxIterations}`
      );
    } catch (error: any) {
      
      this.logger.error(`Research failed for session ${sessionId}: ${error.message}`);
      this.logger.error(`Error stack: ${error.stack}`);
      
      
      await this.sessionService.updateSession(sessionId, { status: 'error' });
      
      
      this.wsGateway.emitProgress(sessionId, { 
        type: 'research:error', 
        sessionId, 
        error: error.message || 'Research failed',
        details: error.stack,
      });
      // Don't throw - we've already handled the error
    }
  }

  private generateSimplePlan(query: string): any {
    // Detect if query is financial
    const queryLower = query.toLowerCase();
    const isFinancial = queryLower.includes('stock') || 
                       queryLower.includes('price') || 
                       queryLower.includes('crypto') || 
                       queryLower.includes('market') ||
                       queryLower.includes('nvidia') ||
                       queryLower.includes('amd') ||
                       queryLower.includes('ethereum') ||
                       queryLower.includes('bitcoin') ||
                       /^\$?[A-Z]{1,5}$/.test(query.trim().toUpperCase()); // Ticker symbol pattern

    // Extract potential ticker symbols
    const tickerMatch = query.match(/\b([A-Z]{1,5})\b/);
    const ticker = tickerMatch ? tickerMatch[1] : null;

    const directives: any[] = [];
    
    if (isFinancial && ticker) {
      // Financial query with ticker
      directives.push({
        step: 1,
        action: 'fetch_data',
        tool: 'finance',
        query: ticker,
        reason: `Get financial data for ${ticker}`,
        dependsOn: [],
      });
      
      directives.push({
        step: 2,
        action: 'search',
        tool: 'web_search',
        query: `${query} news analysis`,
        reason: 'Find news and analysis',
        dependsOn: [],
      });
    } else {
      // General query
      directives.push({
        step: 1,
        action: 'search',
        tool: 'web_search',
        query: query,
        reason: 'Initial web search',
        dependsOn: [],
      });
      
      directives.push({
        step: 2,
        action: 'search',
        tool: 'wikipedia',
        query: query,
        reason: 'Get authoritative information',
        dependsOn: [],
      });
    }

    return {
      queryType: isFinancial ? 'financial' : 'factual',
      complexity: 'moderate',
      requiresQuant: isFinancial,
      semanticClusters: [
        {
          theme: 'Primary research',
          subQueries: [query],
          priority: 1,
        },
      ],
      searchDirectives: directives,
      expectedSources: [],
      whoWhatWhereWhenWhyHow: {},
    };
  }

  async getResearchStatus(sessionId: string) {
    const session = await this.sessionService.getSession(sessionId);
    if (!session) {
      return null;
    }

    const result = await this.sessionService.getResult(sessionId);
    return {
      session,
      result,
    };
  }
}
