import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { QUEUE_NAMES } from '../../common/constants/queues';
import { PrismaService } from '../../prisma/prisma.service';
import { WsGateway } from '../../ws/ws.gateway';
import { SearchStatus, DataSource } from '@prisma/client';

import { UsernameCheckerService } from '../username-checker.service';
import { WebSearchService } from '../web-search.service';
import { IntelSearchService } from '../elasticsearch.service';
import { GenericScraper } from '../../scraper/generic.scraper';
import { PersonaClassifierAgent } from '../../ai/agents/persona-classifier.agent';
import { QueryAnalyzerAgent } from '../../ai/agents/query-analyzer.agent';

@Processor(QUEUE_NAMES.PRELIMINARY_SEARCH)
export class PreliminarySearchProcessor extends WorkerHost {
    private readonly logger = new Logger(PreliminarySearchProcessor.name);

    constructor(
        private prisma: PrismaService,
        private wsGateway: WsGateway,
        private usernameChecker: UsernameCheckerService,
        private webSearch: WebSearchService,
        private elasticsearch: IntelSearchService,
        private genericScraper: GenericScraper,
        private queryAnalyzer: QueryAnalyzerAgent,
        private personaClassifier: PersonaClassifierAgent,
    ) {
        super();
    }

    async process(job: Job<any, any, string>): Promise<any> {
        const { sessionId, query, userId } = job.data;
        this.logger.log(`Processing preliminary search for session ${sessionId}: ${query}`);

        try {
            // 1. Update status to RUNNING
            await this.prisma.searchSession.update({
                where: { id: sessionId },
                data: { status: SearchStatus.RUNNING, progress: 5 },
            });
            this.wsGateway.emitProgress(sessionId, { status: SearchStatus.RUNNING, progress: 5 });

            // 0. AI Query Analysis - Get intelligent search strategy
            this.wsGateway.emitProgress(sessionId, { step: 'AI Query Analysis', progress: 10 });
            let preferredModel = 'google/gemma-3-4b-it:free';
            if (userId) {
                const user = await this.prisma.user.findUnique({ where: { id: userId } });
                preferredModel = user?.preferredModel || preferredModel;
            }
            
            const analysis = await this.queryAnalyzer.analyzeQuery(query, preferredModel);
            this.logger.log(`Query analysis: ${analysis.entityType}, ${analysis.searchStrategy.length} strategy steps`);
            this.wsGateway.emitProgress(sessionId, { step: `AI Strategy: ${analysis.entityType} detected`, progress: 15 });

            // 2. Real Search Steps - Follow AI Strategy
            // Step 1: Social Media Discovery & Verification
            this.wsGateway.emitProgress(sessionId, { step: 'Entity Discovery', progress: 20 });

            // Execute AI strategy - prioritize platforms based on analysis
            const allResults: any[] = [];
            const checkedPlatforms = new Set<string>();

            // Execute strategy steps in priority order
            for (const step of analysis.searchStrategy.sort((a, b) => a.priority - b.priority)) {
                try {
                    if (step.platform === 'github') {
                        // GitHub-specific search
                        this.wsGateway.emitProgress(sessionId, { step: `Searching GitHub: ${step.query}`, progress: 25 });
                        const githubResults = await this.usernameChecker.check(`https://github.com/${step.query}`);
                        githubResults.forEach(r => {
                            if (!checkedPlatforms.has(`github-${r.url}`)) {
                                allResults.push(r);
                                checkedPlatforms.add(`github-${r.url}`);
                            }
                        });
                    } else if (['linkedin', 'twitter', 'instagram', 'x'].includes(step.platform)) {
                        // Social media platforms
                        this.wsGateway.emitProgress(sessionId, { step: `Searching ${step.platform}: ${step.query}`, progress: 30 });
                        const platformResults = await this.usernameChecker.check(step.query);
                        platformResults.forEach(r => {
                            if (!checkedPlatforms.has(`${r.platform}-${r.url}`)) {
                                allResults.push(r);
                                checkedPlatforms.add(`${r.platform}-${r.url}`);
                            }
                        });
                    }
                } catch (error) {
                    this.logger.warn(`Strategy step failed for ${step.platform}: ${error.message}`);
                }
            }

            // Also try query variations for social media discovery
            if (analysis.queryVariations.length > 0) {
                this.wsGateway.emitProgress(sessionId, { step: 'Checking Query Variations', progress: 35 });
                for (const variation of analysis.queryVariations.slice(0, 3)) { // Limit to 3 variations
                    try {
                        const variationResults = await this.usernameChecker.check(variation);
                        variationResults.forEach(r => {
                            if (!checkedPlatforms.has(`${r.platform}-${r.url}`)) {
                                allResults.push(r);
                                checkedPlatforms.add(`${r.platform}-${r.url}`);
                            }
                        });
                    } catch (error) {
                        this.logger.warn(`Query variation check failed for ${variation}: ${error.message}`);
                    }
                }
            }

            // Filter out unknown/empty results - NEVER store "Unknown Target"
            const validResults = allResults.filter(account => {
                const fullName = (account.fullName || '').trim();
                
                // Debug log each account
                this.logger.debug(`Checking account: ${account.platform} - fullName: "${fullName}", bio: ${!!account.bio}, stats: ${JSON.stringify(account.stats || {})}`);
                
                // Reject explicitly invalid names
                if (!fullName || 
                    fullName.toLowerCase() === 'unknown target' || 
                    fullName.toLowerCase() === 'unknown' ||
                    fullName.length === 0) {
                    this.logger.debug(`Rejected ${account.platform}: Invalid name`);
                    return false;
                }
                
                // Check for any meaningful content - be more lenient with stats (they can be strings)
                const hasStats = account.stats && (
                    account.stats.followers || 
                    account.stats.following || 
                    account.stats.posts || 
                    account.stats.repos ||
                    account.stats.connections
                );
                
                const hasContent = account.bio || hasStats || account.recentPost || account.avatarUrl;
                
                if (!hasContent) {
                    this.logger.debug(`Rejected ${account.platform}: No content`);
                    return false;
                }
                
                return true;
            });

            this.logger.log(`Filtered ${allResults.length} results to ${validResults.length} valid profiles`);

            // Classify personas using AI
            this.wsGateway.emitProgress(sessionId, { step: 'Classifying Personas', progress: 45 });
            let personaClassification;
            try {
                personaClassification = await this.personaClassifier.classifyProfiles(validResults, preferredModel);
                this.logger.log(`Persona classification: ${personaClassification.profiles.length} personas, ${personaClassification.groups.length} groups`);
            } catch (error) {
                this.logger.error(`Persona classification failed: ${error.message}`);
                // Continue without persona classification
                personaClassification = { profiles: [], groups: [] };
            }

            // Create a map of profile URL to persona for quick lookup
            const profileToPersona = new Map<string, any>();
            personaClassification.profiles.forEach(persona => {
                profileToPersona.set(persona.id, persona);
            });

            // Store valid results with persona metadata
            for (const account of validResults) {
                const username = account.url.split('/').filter(Boolean).pop();
                
                // Collect images (avatar + recent post image if available)
                const images: string[] = [];
                if (account.avatarUrl) {
                    images.push(account.avatarUrl);
                }
                if (account.recentPost?.imageUrl) {
                    images.push(account.recentPost.imageUrl);
                }
                
                // Get persona classification for this profile
                const persona = profileToPersona.get(account.url) || profileToPersona.get(account.platform);
                
                const searchResult = await this.prisma.searchResult.create({
                    data: {
                        searchSessionId: sessionId,
                        source: account.platform === 'Instagram' ? DataSource.INSTAGRAM :
                            account.platform === 'Twitter' || account.platform === 'X' ? DataSource.TWITTER :
                                account.platform === 'LinkedIn' ? DataSource.LINKEDIN : DataSource.OTHER,
                        data: {
                            type: 'PROFILE_EXISTS',
                            platform: account.platform,
                            url: account.url,
                            username: username || query,
                            fullName: account.fullName || username || query,
                            bio: account.bio || '',
                            avatarUrl: account.avatarUrl,
                            stats: account.stats || {},
                            recentPost: account.recentPost || null,
                            confidence: 1.0,
                            // Add persona metadata
                            persona: persona ? {
                                type: persona.personaType,
                                profession: persona.profession,
                                industry: persona.industry,
                                location: persona.location,
                                interests: persona.interests,
                                languages: persona.languages,
                                distinguishingFeatures: persona.distinguishingFeatures,
                                confidence: persona.confidence,
                            } : null,
                            // Also include raw location/profession data from scraping
                            location: account.location || null,
                            professionKeywords: account.professionKeywords || null,
                            detectedLanguage: account.detectedLanguage || null,
                            hashtags: account.hashtags || null,
                        },
                        images: images,
                    },
                });

                // Index in Elasticsearch
                try {
                    await this.elasticsearch.indexFragment(
                        sessionId,
                        account.url,
                        account.platform,
                        'PRELIMINARY_PROFILE',
                        `${account.fullName || ''} ${account.bio || ''}`.trim(),
                        { databaseId: searchResult.id }
                    );
                } catch (e) {
                    this.logger.error(`Elasticsearch indexing failed: ${e.message}`);
                }
            }
            await job.updateProgress(50);

            // Step 2: Simulated Public Records (for now)
            this.wsGateway.emitProgress(sessionId, { step: 'Public Records Check', progress: 70 });
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Step 3: Real Web Search - use AI strategy for country-specific searches
            this.wsGateway.emitProgress(sessionId, { step: 'Web Search', progress: 80 });
            
            // Build search queries based on AI analysis
            const webQueries: string[] = [query];
            if (analysis.countryCode) {
                // Add country-specific query
                webQueries.push(`${query} site:${analysis.countryCode}`);
            }
            // Add query variations
            webQueries.push(...analysis.queryVariations.slice(0, 2));
            
            const allWebPages: Array<{ title: string; url: string }> = [];
            for (const searchQuery of webQueries.slice(0, 3)) { // Limit to 3 queries
                try {
                    const pages = await this.webSearch.searchWebPages(searchQuery, 3);
                    pages.forEach(p => {
                        if (!allWebPages.find(existing => existing.url === p.url)) {
                            allWebPages.push(p);
                        }
                    });
                } catch (error) {
                    this.logger.warn(`Web search failed for ${searchQuery}: ${error.message}`);
                }
            }
            
            const webPages = allWebPages.slice(0, 5); // Limit to 5 unique pages
            this.logger.log(`Processing ${webPages.length} web pages for profile detection`);

            // Check if any web pages are actually social media profiles
            const profileUrls: string[] = [];
            const regularWebPages: Array<{ title: string; url: string }> = [];

            for (const pageInfo of webPages) {
                // Detect if URL is a social media profile
                const url = pageInfo.url.toLowerCase();
                this.logger.debug(`Checking URL: ${pageInfo.url}`);
                if (url.includes('linkedin.com/in/') || 
                    url.includes('github.com/') ||
                    url.includes('instagram.com/') ||
                    url.includes('twitter.com/') ||
                    url.includes('x.com/')) {
                    this.logger.log(`Detected profile URL: ${pageInfo.url}`);
                    profileUrls.push(pageInfo.url);
                } else {
                    regularWebPages.push(pageInfo);
                }
            }

            // Check profile URLs as actual profiles
            this.logger.log(`Found ${profileUrls.length} profile URLs and ${regularWebPages.length} regular web pages`);
            
            if (profileUrls.length > 0) {
                this.wsGateway.emitProgress(sessionId, { step: 'Checking Profile URLs', progress: 85 });
                this.logger.log(`Checking ${profileUrls.length} profile URLs with UsernameChecker`);
                const profileResults = await this.usernameChecker.checkUrls(profileUrls);
                this.logger.log(`UsernameChecker returned ${profileResults.length} results`);
                
                // Filter and store valid profile results - be lenient for web-discovered profiles
                const validProfileResults = profileResults.filter(account => {
                    const fullName = (account.fullName || '').trim();
                    
                    this.logger.debug(`Checking discovered profile: ${account.platform} - fullName: "${fullName}", bio: ${!!account.bio}, stats: ${JSON.stringify(account.stats || {})}, avatar: ${!!account.avatarUrl}`);
                    
                    // For web-discovered profiles, be more lenient with name validation
                    // Extract username from URL as fallback
                    const urlUsername = account.url?.split('/').filter(Boolean).pop() || '';
                    const hasValidName = (fullName && 
                        fullName.toLowerCase() !== 'unknown target' && 
                        fullName.toLowerCase() !== 'unknown' &&
                        fullName.length > 0) || urlUsername.length > 0;
                    
                    if (!hasValidName) {
                        this.logger.debug(`Rejected discovered ${account.platform}: Invalid name`);
                        return false;
                    }
                    
                    // Check for any meaningful content - stats can be strings like "1.2K"
                    const hasStats = account.stats && Object.values(account.stats).some(v => 
                        v !== null && v !== undefined && String(v).trim().length > 0
                    );
                    
                    const hasContent = account.bio || hasStats || account.recentPost || account.avatarUrl || account.exists;
                    
                    if (!hasContent) {
                        this.logger.debug(`Rejected discovered ${account.platform}: No content`);
                        return false;
                    }
                    
                    this.logger.log(`Accepted discovered profile: ${account.platform} - ${fullName || urlUsername}`);
                    return true;
                });

                // Classify these profiles too
                if (validProfileResults.length > 0) {
                    try {
                        const additionalClassification = await this.personaClassifier.classifyProfiles(validProfileResults, preferredModel);
                        const profileToPersona = new Map<string, any>();
                        additionalClassification.profiles.forEach(persona => {
                            profileToPersona.set(persona.id, persona);
                        });

                        this.logger.log(`Storing ${validProfileResults.length} discovered profiles`);
                        
                        // Store profile results
                        for (const account of validProfileResults) {
                            const username = account.url?.split('/').filter(Boolean).pop() || '';
                            const displayName = account.fullName?.trim() || username || query;
                            const persona = profileToPersona.get(account.url) || profileToPersona.get(account.platform);
                            
                            const images: string[] = [];
                            if (account.avatarUrl) images.push(account.avatarUrl);
                            if (account.recentPost?.imageUrl) images.push(account.recentPost.imageUrl);
                            
                            this.logger.debug(`Storing discovered profile: ${account.platform} - ${displayName} (${account.url})`);
                            
                            await this.prisma.searchResult.create({
                                data: {
                                    searchSessionId: sessionId,
                                    source: account.platform === 'Instagram' ? DataSource.INSTAGRAM :
                                        account.platform === 'Twitter' || account.platform === 'X' ? DataSource.TWITTER :
                                            account.platform === 'LinkedIn' ? DataSource.LINKEDIN : DataSource.OTHER,
                                    data: {
                                        type: 'PROFILE_EXISTS',
                                        platform: account.platform,
                                        url: account.url,
                                        username: username || query,
                                        fullName: displayName,
                                        bio: account.bio || '',
                                        avatarUrl: account.avatarUrl,
                                        stats: account.stats || {},
                                        recentPost: account.recentPost || null,
                                        confidence: 1.0,
                                        persona: persona ? {
                                            type: persona.personaType,
                                            profession: persona.profession,
                                            industry: persona.industry,
                                            location: persona.location,
                                            interests: persona.interests,
                                            languages: persona.languages,
                                            distinguishingFeatures: persona.distinguishingFeatures,
                                            confidence: persona.confidence,
                                        } : null,
                                        location: account.location || null,
                                        professionKeywords: account.professionKeywords || null,
                                        detectedLanguage: account.detectedLanguage || null,
                                        hashtags: account.hashtags || null,
                                    },
                                    images: images,
                                },
                            });
                        }
                    } catch (error) {
                        this.logger.error(`Failed to process profile URLs: ${error.message}`);
                    }
                }
            }

            // Store regular web pages
            for (const pageInfo of regularWebPages) {
                try {
                    const scraped = await this.genericScraper.scrape(pageInfo.url);

                    const searchResult = await this.prisma.searchResult.create({
                        data: {
                            searchSessionId: sessionId,
                            source: DataSource.WEB,
                            data: {
                                type: 'WEB_PAGE',
                                title: scraped.title || pageInfo.title,
                                url: pageInfo.url,
                                content: scraped.content,
                            },
                            metadata: {
                                origin: 'duckduckgo',
                                query,
                            },
                        },
                    });

                    // Index in Elasticsearch for later correlation and full-text queries
                    try {
                        await this.elasticsearch.indexFragment(
                            sessionId,
                            pageInfo.url,
                            'WEB',
                            'WEB_PAGE',
                            scraped.content,
                            { databaseId: searchResult.id },
                        );
                    } catch (e) {
                        this.logger.error(`Elasticsearch indexing failed for web page: ${e.message}`);
                    }
                } catch (e: any) {
                    this.logger.warn(`Failed to scrape web page ${pageInfo.url}: ${e.message}`);
                }
            }

            this.wsGateway.emitProgress(sessionId, { step: 'Web Search', progress: 90 });

            // 3. Mark as COMPLETED
            await this.prisma.searchSession.update({
                where: { id: sessionId },
                data: { status: SearchStatus.COMPLETED, progress: 100 },
            });
            this.wsGateway.emitProgress(sessionId, { status: SearchStatus.COMPLETED, progress: 100 });

            return { success: true, sessionId };
        } catch (error) {
            this.logger.error(`Error processing preliminary search ${sessionId}: ${error.message}`);
            await this.prisma.searchSession.update({
                where: { id: sessionId },
                data: { status: SearchStatus.FAILED, progress: 0 },
            });
            this.wsGateway.emitProgress(sessionId, { status: SearchStatus.FAILED, error: error.message });
            throw error;
        }
    }

    @OnWorkerEvent('completed')
    onCompleted(job: Job) {
        this.logger.log(`Job ${job.id} completed successfully`);
    }

    @OnWorkerEvent('failed')
    onFailed(job: Job, error: Error) {
        this.logger.error(`Job ${job.id} failed with error: ${error.message}`);
    }
}
