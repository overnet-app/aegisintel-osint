import { Injectable, Logger } from '@nestjs/common';
import { InstagramScraper } from '../scraper/instagram.scraper';
import { TwitterScraper } from '../scraper/twitter.scraper';
import { LinkedInScraper } from '../scraper/linkedin.scraper';
import { SummaryAgent } from '../ai/agents/summary.agent';
import { RiskAgent } from '../ai/agents/risk.agent';
import { FaceAgent } from '../ai/agents/face.agent';
import { RelationshipAgent } from '../ai/agents/relationship.agent';
import { TemporalAgent } from '../ai/agents/temporal.agent';
import { GeoAgent } from '../ai/agents/geo.agent';
import { ImageAnalysisAgent } from '../ai/agents/image.agent';
import { TextAnalysisAgent } from '../ai/agents/text.agent';
import { PsychProfileAgent } from '../ai/agents/psych-profile.agent';
import { PatternDetectorService } from '../ai/services/pattern-detector.service';
import { CorrelationEngine } from './correlation-engine.service';
import { WebSearchService } from './web-search.service';
import { ContentScraperService } from './content-scraper.service';
import { TimelineService } from './timeline.service';
import { PrismaService } from '../prisma/prisma.service';
import { WsGateway } from '../ws/ws.gateway';
import { SearchStatus, DataSource } from '@prisma/client';
import { ArchitectAgent } from '../research/agents/architect.agent';
import { ScoutAgent } from '../research/agents/scout.agent';
import { LogicianAgent } from '../research/agents/logician.agent';
import { ThinkerAgent } from '../research/agents/thinker.agent';
import { CriticAgent } from '../research/agents/critic.agent';
import { HypothesisAgent } from '../research/agents/hypothesis.agent';
import { FactCheckerAgent } from '../research/agents/fact-checker.agent';
import { ResearchDetectiveAgent } from '../research/agents/research-detective.agent';
import { AgentModelResolverService } from '../research/services/agent-model-resolver.service';
import { SourceTrackerService } from '../research/source-tracker.service';
import { StreamManagerService } from '../research/streaming/stream-manager.service';
import { AccuracyScorerService } from './services/accuracy-scorer.service';
import { ProfileVerificationAgent } from './agents/profile-verification.agent';

@Injectable()
export class DeepSearchOrchestrator {
    private readonly logger = new Logger(DeepSearchOrchestrator.name);

    constructor(
        private prisma: PrismaService,
        private wsGateway: WsGateway,
        private instagram: InstagramScraper,
        private twitter: TwitterScraper,
        private linkedin: LinkedInScraper,
        private summaryAgent: SummaryAgent,
        private riskAgent: RiskAgent,
        private faceAgent: FaceAgent,
        private relationshipAgent: RelationshipAgent,
        private temporalAgent: TemporalAgent,
        private geoAgent: GeoAgent,
        private imageAgent: ImageAnalysisAgent,
        private textAgent: TextAnalysisAgent,
        private psychProfileAgent: PsychProfileAgent,
        private patternDetector: PatternDetectorService,
        private correlationEngine: CorrelationEngine,
        private webSearch: WebSearchService,
        private contentScraper: ContentScraperService,
        private timelineService: TimelineService,
        // Research agents
        private architectAgent: ArchitectAgent,
        private scoutAgent: ScoutAgent,
        private logicianAgent: LogicianAgent,
        private thinkerAgent: ThinkerAgent,
        private criticAgent: CriticAgent,
        private hypothesisAgent: HypothesisAgent,
        private factCheckerAgent: FactCheckerAgent,
        private researchDetectiveAgent: ResearchDetectiveAgent,
        private agentModelResolver: AgentModelResolverService,
        private sourceTracker: SourceTrackerService,
        private streamManager: StreamManagerService,
        private accuracyScorer: AccuracyScorerService,
        private profileVerificationAgent: ProfileVerificationAgent,
    ) { }

    async orchestrate(userId: string, sessionId: string, query: string, selectedProfile?: { platform: string; username: string; url: string; persona?: { type: string; profession: string; location: string; interests: string[] } }) {
        this.logger.log(`Starting deep search orchestration for session ${sessionId}${selectedProfile ? ` with selected profile: ${selectedProfile.platform}/${selectedProfile.username}` : ''}`);
        
        // Use persona context to refine search strategy
        if (selectedProfile?.persona) {
            this.logger.log(`Persona context: ${selectedProfile.persona.type} - ${selectedProfile.persona.profession} from ${selectedProfile.persona.location}`);
            // Refine query based on persona
            if (selectedProfile.persona.interests && selectedProfile.persona.interests.length > 0) {
                query = `${query} ${selectedProfile.persona.interests.slice(0, 2).join(' ')}`;
            }
            if (selectedProfile.persona.location) {
                query = `${query} ${selectedProfile.persona.location}`;
            }
        }

        // Get user settings for model preference
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        const preferredModel = user?.preferredModel || 'mistralai/mistral-7b-instruct:free';
        const enabledServices = (user?.enabledServices as any) || { clarifai: true };

        try {
            // 0. Pre-fetch discovered handles from preliminary search results
            const sessionResults = await this.prisma.searchResult.findMany({
                where: { searchSessionId: sessionId },
            });

            // Helper to extract clean username from profile data
            const extractUsername = (usernameOrData: string): string => {
                if (!usernameOrData) return '';
                
                // If it contains concatenated data (e.g., "usernamePoliticsShort‑formVideoUnitedStates")
                // Try to extract just the username part
                // Username is typically at the start, before any capitalized words or special patterns
                const match = usernameOrData.match(/^([a-z0-9_.-]+)/i);
                if (match) {
                    return match[1].replace(/[@\s]/g, '');
                }
                
                // Fallback: try to extract from URL if present
                if (selectedProfile?.url) {
                    const urlParts = selectedProfile.url.split('/').filter(Boolean);
                    const lastPart = urlParts[urlParts.length - 1];
                    if (lastPart && !lastPart.includes(' ')) {
                        return lastPart.split('?')[0].replace(/[@\s]/g, '');
                    }
                }
                
                // Last resort: return cleaned version
                return usernameOrData.split(/\s+/)[0].replace(/[@\s]/g, '');
            };

            // If selectedProfile is provided, prioritize it
            const getHandle = (platform: string) => {
                // Check if selected profile matches this platform
                if (selectedProfile) {
                    const selectedPlatform = selectedProfile.platform.toLowerCase();
                    const normalizedPlatform = platform.toLowerCase();
                    
                    // Handle Twitter/X naming
                    if ((selectedPlatform === 'twitter' || selectedPlatform === 'x') && 
                        (normalizedPlatform === 'twitter' || normalizedPlatform === 'x')) {
                        const cleanUsername = extractUsername(selectedProfile.username);
                        this.logger.log(`Using selected profile for ${platform}: ${cleanUsername} (from: ${selectedProfile.username})`);
                        return cleanUsername;
                    }
                    
                    if (selectedPlatform === normalizedPlatform) {
                        const cleanUsername = extractUsername(selectedProfile.username);
                        this.logger.log(`Using selected profile for ${platform}: ${cleanUsername} (from: ${selectedProfile.username})`);
                        return cleanUsername;
                    }
                }
                
                // Otherwise, find from preliminary search results
                const found = sessionResults.find(r =>
                    r.source.toUpperCase() === platform.toUpperCase() &&
                    (r.data as any).type === 'PROFILE_EXISTS'
                );
                if (found) {
                    const username = (found.data as any).username;
                    return extractUsername(username);
                }
                return query.replace(/[@\s]/g, '');
            };

            const igHandle = getHandle('INSTAGRAM');
            const twHandle = getHandle('TWITTER');
            const liHandle = getHandle('LINKEDIN');

            this.logger.log(`Using handles - IG: ${igHandle}, X: ${twHandle}, LI: ${liHandle}`);
            
            // Use selected profile's query if available, otherwise use original query
            const searchQuery = selectedProfile ? selectedProfile.username : query;

            // 1. Multi-Engine Web Search (use selected profile username if available)
            await this.updateProgress(sessionId, 'Multi-Engine Web Search', 10);
            const multiEngineResults = await this.webSearch.multiEngineSearch(searchQuery);
            
            // Search for documents
            const documents = await this.webSearch.searchDocuments(searchQuery);
            
            // Scrape content from search results
            await this.updateProgress(sessionId, 'Scraping Web Content', 15);
            const allUrls = [
                ...multiEngineResults.google.map(r => r.url),
                ...multiEngineResults.duckduckgo.map(r => r.url),
                ...multiEngineResults.yandex.map(r => r.url),
                ...documents.map(d => d.url),
            ].slice(0, 20); // Limit to 20 URLs to avoid timeout
            
            const scrapedContent = await this.contentScraper.scrapeMultiple(allUrls, searchQuery, 3);
            const webMentions = scrapedContent.flatMap(c => c.mentions || []);
            const webComments = scrapedContent.flatMap(c => c.comments || []);

            // 2. Initial Social Scrapes (with authentication if available)
            await this.updateProgress(sessionId, 'Scraping Social Media', 20);

            const results = await Promise.allSettled([
                this.instagram.scrapeProfile(igHandle, userId).catch((e) => { this.logger.error(`IG scrape failed: ${e.message}`); return null; }),
                this.twitter.scrapeProfile(twHandle).catch((e) => { this.logger.error(`X scrape failed: ${e.message}`); return null; }),
                this.linkedin.scrapeProfile(liHandle).catch((e) => { this.logger.error(`LI scrape failed: ${e.message}`); return null; }),
            ]);

            const scrapedData = results
                .filter(r => r.status === 'fulfilled' && r.value)
                .map(r => {
                    const data = (r as PromiseFulfilledResult<any>).value;
                    // Normalize platform names
                    if (data.platform === 'x') {
                        data.platform = 'twitter';
                    }
                    // Log what we captured
                    this.logger.log(`Scraped ${data.platform}: ${data.recentPosts?.length || 0} posts found`);
                    if (data.recentPosts && data.recentPosts.length > 0) {
                        this.logger.debug(`Sample post: ${JSON.stringify(data.recentPosts[0]).substring(0, 200)}`);
                    }
                    return data;
                });

            // Enrich AI context with any web pages collected during preliminary search
            const webResults = await this.prisma.searchResult.findMany({
                where: {
                    searchSessionId: sessionId,
                    source: DataSource.WEB,
                },
            });

            const webData = webResults.map((r) => {
                const data = r.data as any;
                return {
                    platform: 'WEB',
                    url: data.url,
                    title: data.title,
                    content: data.content,
                };
            });

            scrapedData.push(...webData);

            // Add scraped web content from multi-engine search
            const scrapedWebContent = scrapedContent.map(c => ({
                platform: 'WEB',
                url: c.url,
                title: c.title,
                fullText: c.fullText,
                mentions: c.mentions,
                comments: c.comments,
                metadata: c.metadata,
            }));
            scrapedData.push(...scrapedWebContent);

            // 2. Data Normalization & Storage (using SearchResult)
            await this.updateProgress(sessionId, 'Storing Scraped Data', 40);
            for (const data of scrapedData) {
                await this.prisma.searchResult.create({
                    data: {
                        searchSessionId: sessionId,
                        source: data.platform?.toUpperCase() === 'INSTAGRAM' ? DataSource.INSTAGRAM :
                            data.platform?.toUpperCase() === 'TWITTER' ? DataSource.TWITTER :
                                data.platform?.toUpperCase() === 'LINKEDIN' ? DataSource.LINKEDIN : DataSource.OTHER,
                        data: data,
                    },
                });
            }

            // 3. Build Timeline
            await this.updateProgress(sessionId, 'Building Timeline', 45);
            const timelineEvents = this.timelineService.buildTimeline({
                socialMedia: scrapedData,
                webMentions,
                documents: documents.map(d => ({ ...d, publishDate: undefined })),
                comments: webComments,
            });
            const timelineText = this.timelineService.formatTimeline(timelineEvents);

            // 4. Pattern Detection
            await this.updateProgress(sessionId, 'Analyzing Behavioral Patterns', 47);
            const patternAnalysis = this.patternDetector.analyzePatterns(timelineEvents);
            const patternsText = JSON.stringify(patternAnalysis, null, 2);

            // 5. Psychological Profile
            await this.updateProgress(sessionId, 'Generating Psychological Profile', 48);
            const psychProfile = await this.psychProfileAgent.generateProfile(
                timelineEvents,
                patternAnalysis,
                { socialMedia: scrapedData, webMentions },
                preferredModel,
            );
            const psychProfileText = JSON.stringify(psychProfile, null, 2);

            // 6. AI Analysis - Aggregate ALL data
            await this.updateProgress(sessionId, 'AI Analysis: Profiles & Risk', 50);
            const allDataForAI = {
                socialMedia: scrapedData.filter(d => ['instagram', 'twitter', 'linkedin', 'facebook'].includes(d.platform?.toLowerCase())),
                webContent: scrapedContent,
                webMentions: webMentions,
                documents: documents,
                multiEngineResults: {
                    google: multiEngineResults.google,
                    duckduckgo: multiEngineResults.duckduckgo,
                    yandex: multiEngineResults.yandex,
                },
            };
            
            const summary = await this.summaryAgent.summarize(
                allDataForAI,
                preferredModel,
                timelineText,
                psychProfileText,
                patternsText,
            );

            await this.updateProgress(sessionId, 'AI Analysis: Assessing Risk Factors', 55);
            const risk = await this.riskAgent.assessRisk(allDataForAI, preferredModel);

            await this.updateProgress(sessionId, 'AI Analysis: Identifying & Cross-referencing Faces', 60);
            const faces = await this.faceAgent.analyzeFaces(scrapedData, {
                useClarifai: !!enabledServices.clarifai,
                sessionId: sessionId
            });

            await this.updateProgress(sessionId, 'AI Analysis: Mapping Social Relationships', 70);
            const relationships = await this.relationshipAgent.mapRelationships(scrapedData, preferredModel);

            await this.updateProgress(sessionId, 'AI Analysis: Analyzing Activity Patterns', 75);
            const temporal = await this.temporalAgent.analyzeTimeline(scrapedData, preferredModel);

            await this.updateProgress(sessionId, 'AI Analysis: Extracting Geolocation Data', 80);
            const geo = await this.geoAgent.extractLocations(scrapedData, preferredModel);

            // Extract images and text for specialized agents
            const imageUrls: string[] = scrapedData.flatMap(item => {
                if (item.recentPosts) return item.recentPosts.map((p: any) => p.thumbnail || p.url).filter(Boolean);
                return [];
            });
            const texts = scrapedData.flatMap(item => {
                const content: string[] = [];
                if (item.bio) content.push(item.bio);
                
                // Include full text from scraped web pages
                if (item.fullText) {
                    content.push(item.fullText);
                }
                
                // Include mentions context from web pages
                if (item.mentions && Array.isArray(item.mentions)) {
                    item.mentions.forEach((m: any) => {
                        if (m.context) {
                            content.push(`${m.context.before || ''} ${m.text} ${m.context.after || ''}`.trim());
                        } else if (m.text) {
                            content.push(m.text);
                        }
                    });
                }
                
                // Include comments from web pages
                if (item.comments && Array.isArray(item.comments)) {
                    content.push(...item.comments.map((c: any) => typeof c === 'string' ? c : c.text).filter(Boolean));
                }
                
                // Instagram posts
                if (item.recentPosts && item.platform === 'instagram') {
                    content.push(...item.recentPosts.map((p: any) => p.caption || p.text || '').filter(Boolean));
                    // Also include comments
                    item.recentPosts.forEach((p: any) => {
                        if (p.comments && Array.isArray(p.comments)) {
                            content.push(...p.comments);
                        }
                    });
                }
                // Twitter/X posts
                if (item.recentPosts && (item.platform === 'x' || item.platform === 'twitter')) {
                    content.push(...item.recentPosts.map((p: any) => p.text || '').filter(Boolean));
                    if (item.recentPosts.some((p: any) => p.repostAuthor)) {
                        content.push(...item.recentPosts
                            .filter((p: any) => p.repostAuthor)
                            .map((p: any) => `Reposted from ${p.repostAuthor}: ${p.text}`)
                            .filter(Boolean));
                    }
                }
                // Legacy support
                if (item.recentTweets) {
                    content.push(...item.recentTweets.map((t: any) => t.text).filter(Boolean));
                }
                return content;
            });

            await this.updateProgress(sessionId, 'AI Analysis: Computer Vision & Text Mining', 85);
            const imageAnalysis = await this.imageAgent.analyzeImages(imageUrls);
            const textAnalysis = await this.textAgent.analyzeText(texts, preferredModel);

            await this.updateProgress(sessionId, 'AI Analysis: Cross-Platform Correlation', 90);
            const correlation = await this.correlationEngine.correlate(scrapedData, preferredModel);

            // 7. Research Agent Integration for Enhanced OSINT
            await this.updateProgress(sessionId, 'Research Agents: Strategic Planning', 91);
            this.streamManager.streamChunk(sessionId, 'Creating OSINT research plan...', 'thinking');
            
            // Resolve models for agents
            const architectModel = await this.agentModelResolver.resolveAgentModel(userId, 'architect', 'openrouter', preferredModel);
            const scoutModel = await this.agentModelResolver.resolveAgentModel(userId, 'scout', 'openrouter', preferredModel);
            const logicianModel = await this.agentModelResolver.resolveAgentModel(userId, 'logician', 'openrouter', preferredModel);
            const factCheckerModel = await this.agentModelResolver.resolveAgentModel(userId, 'factChecker', 'openrouter', preferredModel);
            const criticModel = await this.agentModelResolver.resolveAgentModel(userId, 'critic', 'openrouter', preferredModel);
            const hypothesisModel = await this.agentModelResolver.resolveAgentModel(userId, 'hypothesis', 'openrouter', preferredModel);

            // Create OSINT research plan
            const osintPlan = await this.architectAgent.createOSINTPlan(
                query,
                selectedProfile,
                architectModel.provider,
                architectModel.model,
            );
            this.streamManager.streamChunk(sessionId, `OSINT plan created: ${osintPlan.searchDirectives.length} directives`, 'thinking');

            // Execute additional searches with ScoutAgent
            await this.updateProgress(sessionId, 'Research Agents: Enhanced Information Gathering', 92);
            this.streamManager.streamChunk(sessionId, 'Executing enhanced search plan...', 'thinking');
            
            const scoutFindings = await this.scoutAgent.executeSearchPlan(
                osintPlan,
                scoutModel.provider,
                scoutModel.model,
            );

            // Track sources from ScoutAgent
            for (const finding of scoutFindings) {
                for (const data of finding.rawData) {
                    await this.sourceTracker.addSource(sessionId, {
                        url: data.source.url,
                        title: data.source.title,
                        snippet: data.source.snippet || '',
                        tool: finding.tool,
                        reasoning: `OSINT search: ${finding.query}`,
                        reliability: data.source.reliability,
                        timestamp: new Date(),
                    });
                }
            }

            // Convert existing OSINT data to ScoutFindings format for validation
            const existingFindings: any[] = [];
            for (const data of scrapedData) {
                if (data.platform && data.username) {
                    existingFindings.push({
                        directiveId: 0,
                        tool: 'osint_scraper',
                        query: `${data.platform} profile: ${data.username}`,
                        rawData: [{
                            fact: `${data.platform} profile data for ${data.username}`,
                            source: {
                                url: data.url || `https://${data.platform}.com/${data.username}`,
                                title: `${data.platform} Profile`,
                                snippet: data.bio || '',
                                reliability: 'medium' as const,
                                type: 'other' as const,
                            },
                            timestamp: new Date().toISOString(),
                            metadata: { platform: data.platform, username: data.username },
                        }],
                        searchOperators: [],
                        credibilityScore: 70,
                    });
                }
            }

            // Combine all findings
            const allFindings = [...scoutFindings, ...existingFindings];

            // Validate findings with LogicianAgent
            await this.updateProgress(sessionId, 'Research Agents: Validating Findings', 93);
            this.streamManager.streamChunk(sessionId, 'Validating findings for contradictions and fallacies...', 'thinking');
            
            const logicianVerdict = await this.logicianAgent.validateFindings(
                allFindings,
                undefined, // No quant analysis for OSINT
                logicianModel.provider,
                logicianModel.model,
            );
            this.streamManager.streamChunk(sessionId, `Validation complete: ${logicianVerdict.validatedFacts.length} facts validated, ${logicianVerdict.contradictions.length} contradictions found`, 'thinking');

            // Fact-checking with FactCheckerAgent
            await this.updateProgress(sessionId, 'Research Agents: Fact-Checking', 94);
            this.streamManager.streamChunk(sessionId, 'Fact-checking key claims...', 'thinking');
            
            const keyFacts = allFindings
                .flatMap(f => f.rawData)
                .slice(0, 20) // Limit to 20 facts for fact-checking
                .map(d => d.fact);
            
            const factCheckSources = allFindings
                .flatMap(f => f.rawData)
                .map(d => ({
                    url: d.source.url,
                    title: d.source.title,
                    snippet: d.source.snippet || '',
                }));

            const factCheckResults = await this.factCheckerAgent.verifyFacts(
                keyFacts,
                factCheckSources,
                factCheckerModel.provider,
                factCheckerModel.model,
            );
            this.streamManager.streamChunk(sessionId, `Fact-checking complete: ${factCheckResults.filter(r => r.verdict === 'verified').length} verified, ${factCheckResults.filter(r => r.verdict === 'contradicted').length} contradicted`, 'thinking');

            // Quality review with CriticAgent
            await this.updateProgress(sessionId, 'Research Agents: Quality Review', 95);
            this.streamManager.streamChunk(sessionId, 'Reviewing research quality...', 'thinking');
            
            const criticReview = await this.criticAgent.reviewFindings(
                allFindings,
                logicianVerdict,
                undefined, // No quant analysis
                criticModel.provider,
                criticModel.model,
            );
            this.streamManager.streamChunk(sessionId, `Quality review: ${criticReview.overallAssessment.qualityScore}% quality, ${criticReview.overallAssessment.completenessScore}% completeness`, 'thinking');

            // Iterative quality improvement (max 3 iterations for OSINT)
            let currentQuality = criticReview.overallAssessment.qualityScore;
            let currentCompleteness = criticReview.overallAssessment.completenessScore;
            let iteration = 0;
            const maxIterations = 3;
            const qualityThreshold = 70;

            while ((currentQuality < qualityThreshold || currentCompleteness < qualityThreshold) && iteration < maxIterations) {
                iteration++;
                this.logger.log(`OSINT Quality Improvement: Iteration ${iteration}/${maxIterations} - Quality: ${currentQuality}%, Completeness: ${currentCompleteness}%`);
                this.streamManager.streamChunk(sessionId, `Quality improvement iteration ${iteration}/${maxIterations}...`, 'thinking');

                // Generate hypotheses for gaps
                const hypotheses = await this.hypothesisAgent.generateHypotheses(
                    query,
                    allFindings,
                    criticReview,
                    hypothesisModel.provider,
                    hypothesisModel.model,
                );

                // Execute additional searches based on hypotheses
                if (hypotheses.hypotheses && hypotheses.hypotheses.length > 0) {
                    const topHypothesis = hypotheses.hypotheses[0];
                    this.streamManager.streamChunk(sessionId, `Testing hypothesis: ${topHypothesis.statement}`, 'thinking');

                    // Create a simple search directive for the hypothesis
                    const hypothesisPlan: any = {
                        searchDirectives: [{
                            step: 1,
                            action: 'search',
                            tool: 'web_search',
                            query: topHypothesis.testMethod || query,
                            reason: `Testing hypothesis: ${topHypothesis.statement}`,
                            dependsOn: [],
                        }],
                    };

                    const additionalFindings = await this.scoutAgent.executeSearchPlan(
                        hypothesisPlan,
                        scoutModel.provider,
                        scoutModel.model,
                    );

                    allFindings.push(...additionalFindings);

                    // Re-validate
                    const updatedVerdict = await this.logicianAgent.validateFindings(
                        allFindings,
                        undefined,
                        logicianModel.provider,
                        logicianModel.model,
                    );

                    // Re-review quality
                    const updatedReview = await this.criticAgent.reviewFindings(
                        allFindings,
                        updatedVerdict,
                        undefined,
                        criticModel.provider,
                        criticModel.model,
                    );

                    currentQuality = updatedReview.overallAssessment.qualityScore;
                    currentCompleteness = updatedReview.overallAssessment.completenessScore;
                    this.streamManager.streamChunk(sessionId, `Iteration ${iteration} complete: Quality ${currentQuality}%, Completeness ${currentCompleteness}%`, 'thinking');
                } else {
                    break; // No more hypotheses to test
                }
            }

            // Profile Verification
            await this.updateProgress(sessionId, 'Research Agents: Profile Verification', 96);
            this.streamManager.streamChunk(sessionId, 'Verifying profile authenticity...', 'thinking');
            
            const profilesToVerify = scrapedData
                .filter(d => d.platform && d.username)
                .slice(0, 5); // Limit to 5 profiles
            
            const profileVerificationResults = profilesToVerify.length > 0
                ? await this.profileVerificationAgent.verifyMultipleProfiles(
                    profilesToVerify.map(d => ({
                        platform: d.platform,
                        username: d.username,
                        bio: d.bio,
                        stats: d.stats,
                    })),
                    'openrouter',
                    preferredModel,
                  )
                : [];

            // Calculate accuracy score
            const accuracyScore = this.accuracyScorer.calculateAccuracyScore(
                logicianVerdict,
                factCheckResults,
                criticReview,
                profileVerificationResults,
            );
            this.streamManager.streamChunk(sessionId, `Accuracy score: ${accuracyScore.overallScore}% (${accuracyScore.confidence} confidence)`, 'thinking');

            // 8. Dossier Construction with Research Agent Results
            await this.updateProgress(sessionId, 'Building Final Dossier', 97);
            await this.prisma.dossier.create({
                data: {
                    userId,
                    subject: query,
                    content: {
                        summary,
                        faces,
                        riskAssessment: risk,
                        relationships,
                        temporal,
                        geolocation: geo,
                        imageAnalysis,
                        textAnalysis,
                        correlation,
                        aiInsights: { processedAt: new Date().toISOString() },
                        webSearch: {
                            google: multiEngineResults.google,
                            duckduckgo: multiEngineResults.duckduckgo,
                            yandex: multiEngineResults.yandex,
                            documents,
                        },
                        scrapedContent: scrapedContent.map(c => ({
                            url: c.url,
                            title: c.title,
                            mentions: c.mentions.length,
                            comments: c.comments.length,
                        })),
                        // Research Agent Results
                        researchAgentResults: {
                            osintPlan,
                            scoutFindings: scoutFindings.map(f => ({
                                tool: f.tool,
                                query: f.query,
                                factsCount: f.rawData.length,
                                credibilityScore: f.credibilityScore,
                            })),
                            logicianVerdict: {
                                validatedFactsCount: logicianVerdict.validatedFacts.length,
                                contradictionsCount: logicianVerdict.contradictions.length,
                                fallaciesCount: logicianVerdict.fallacies.length,
                                qualityScore: logicianVerdict.qualityScore,
                                completenessScore: logicianVerdict.completenessScore,
                            },
                            factCheckResults: factCheckResults.map(r => ({
                                claim: r.claim,
                                verdict: r.verdict,
                                confidence: r.confidence,
                            })),
                            criticReview: {
                                qualityScore: criticReview.overallAssessment.qualityScore,
                                completenessScore: criticReview.overallAssessment.completenessScore,
                                confidenceLevel: criticReview.overallAssessment.confidenceLevel,
                                weakEvidenceCount: criticReview.weakEvidence.length,
                                gapsCount: criticReview.missingInformation.length,
                            },
                            iterations: iteration,
                            finalQuality: currentQuality,
                            finalCompleteness: currentCompleteness,
                        },
                        accuracyScore: {
                            overallScore: accuracyScore.overallScore,
                            breakdown: accuracyScore.breakdown,
                            confidence: accuracyScore.confidence,
                            factors: accuracyScore.factors,
                        },
                        profileVerification: profileVerificationResults.map(r => ({
                            platform: r.platform,
                            username: r.username,
                            authenticityScore: r.authenticityScore,
                            isVerified: r.isVerified,
                            isBot: r.isBot,
                            isImpersonation: r.isImpersonation,
                            consistencyScore: r.consistencyScore,
                            redFlags: r.redFlags,
                        })),
                    } as any,
                    timeline: timelineEvents as any,
                    psychProfile: psychProfile as any,
                    patternAnalysis: patternAnalysis as any,
                },
            });

            // 5. Finalize
            await this.prisma.searchSession.update({
                where: { id: sessionId },
                data: { status: SearchStatus.COMPLETED, progress: 100 },
            });
            this.wsGateway.emitProgress(sessionId, { status: SearchStatus.COMPLETED, progress: 100 });

            return { success: true };
        } catch (error) {
            this.logger.error(`Orchestration failed for ${sessionId}: ${error.message}`);
            await this.prisma.searchSession.update({
                where: { id: sessionId },
                data: { status: SearchStatus.FAILED },
            });
            throw error;
        }
    }

    private async updateProgress(sessionId: string, step: string, progress: number) {
        await this.prisma.searchSession.update({
            where: { id: sessionId },
            data: { progress },
        });
        this.wsGateway.emitProgress(sessionId, { step, progress });
    }
}
