import { Injectable, Logger } from '@nestjs/common';
import { LogicianVerdict } from '../../research/types/swarm.types';
import { FactCheckResult } from '../../research/agents/fact-checker.agent';
import { CriticReview } from '../../research/types/swarm.types';
import { ProfileVerificationResult } from '../agents/profile-verification.agent';

export interface AccuracyScore {
    overallScore: number; // 0-100
    breakdown: {
        multiAgentConsensus: number; // 0-100
        sourceReliability: number; // 0-100
        crossPlatformVerification: number; // 0-100
        contradictionDetection: number; // 0-100
        profileVerification: number; // 0-100 (if profile data available)
    };
    confidence: 'high' | 'medium' | 'low';
    factors: Array<{
        factor: string;
        score: number;
        weight: number;
        impact: 'positive' | 'negative' | 'neutral';
    }>;
}

@Injectable()
export class AccuracyScorerService {
    private readonly logger = new Logger(AccuracyScorerService.name);

    /**
     * Calculate accuracy score from multi-agent consensus
     */
    calculateAccuracyScore(
        logicianVerdict: LogicianVerdict,
        factCheckResults: FactCheckResult[],
        criticReview: CriticReview,
        profileVerification?: ProfileVerificationResult[],
    ): AccuracyScore {
        this.logger.log('Calculating accuracy score from multi-agent consensus');

        // 1. Multi-Agent Consensus Score (0-100)
        const consensusFactors: number[] = [];
        
        // Logician quality and completeness
        consensusFactors.push(logicianVerdict.qualityScore || 0);
        consensusFactors.push(logicianVerdict.completenessScore || 0);
        
        // Critic quality and completeness
        consensusFactors.push(criticReview.overallAssessment.qualityScore || 0);
        consensusFactors.push(criticReview.overallAssessment.completenessScore || 0);
        
        // Fact-checking verification rate
        if (factCheckResults.length > 0) {
            const verifiedCount = factCheckResults.filter(r => r.verdict === 'verified').length;
            const verificationRate = (verifiedCount / factCheckResults.length) * 100;
            consensusFactors.push(verificationRate);
        }
        
        const multiAgentConsensus = consensusFactors.length > 0
            ? Math.round(consensusFactors.reduce((a, b) => a + b, 0) / consensusFactors.length)
            : 50;

        // 2. Source Reliability Score (0-100)
        // Based on Logician's validated facts and their source reliability
        const sourceReliabilityScores: number[] = [];
        for (const fact of logicianVerdict.validatedFacts || []) {
            const reliability = fact.supportingSources?.[0]?.reliability || 'medium';
            const reliabilityScore = reliability === 'high' ? 100 : reliability === 'medium' ? 60 : 20;
            sourceReliabilityScores.push(reliabilityScore);
        }
        
        const sourceReliability = sourceReliabilityScores.length > 0
            ? Math.round(sourceReliabilityScores.reduce((a, b) => a + b, 0) / sourceReliabilityScores.length)
            : 50;

        // 3. Cross-Platform Verification Score (0-100)
        // Based on profile verification results if available
        let crossPlatformVerification = 50; // Default if no profile data
        if (profileVerification && profileVerification.length > 0) {
            const verificationScores = profileVerification.map(p => p.consistencyScore);
            crossPlatformVerification = Math.round(
                verificationScores.reduce((a, b) => a + b, 0) / verificationScores.length
            );
        }

        // 4. Contradiction Detection Score (0-100)
        // Higher score = fewer contradictions detected
        const contradictionCount = (logicianVerdict.contradictions?.length || 0) + 
                                  (factCheckResults.filter(r => r.verdict === 'contradicted').length);
        const contradictionScore = Math.max(0, 100 - (contradictionCount * 10)); // -10 points per contradiction

        // 5. Profile Verification Score (0-100)
        // Based on profile authenticity if available
        let profileVerificationScore = 50; // Default if no profile data
        if (profileVerification && profileVerification.length > 0) {
            const authenticityScores = profileVerification.map(p => p.authenticityScore);
            profileVerificationScore = Math.round(
                authenticityScores.reduce((a, b) => a + b, 0) / authenticityScores.length
            );
        }

        // Calculate weighted overall score
        const weights = {
            multiAgentConsensus: 0.35,
            sourceReliability: 0.25,
            crossPlatformVerification: 0.15,
            contradictionDetection: 0.15,
            profileVerification: 0.10,
        };

        const overallScore = Math.round(
            multiAgentConsensus * weights.multiAgentConsensus +
            sourceReliability * weights.sourceReliability +
            crossPlatformVerification * weights.crossPlatformVerification +
            contradictionScore * weights.contradictionDetection +
            profileVerificationScore * weights.profileVerification
        );

        // Determine confidence level
        let confidence: 'high' | 'medium' | 'low';
        if (overallScore >= 80 && contradictionCount === 0 && factCheckResults.length > 0) {
            confidence = 'high';
        } else if (overallScore >= 60 && contradictionCount <= 2) {
            confidence = 'medium';
        } else {
            confidence = 'low';
        }

        // Build factors list
        const factors: Array<{
            factor: string;
            score: number;
            weight: number;
            impact: 'positive' | 'negative' | 'neutral';
        }> = [
            {
                factor: 'Multi-Agent Consensus',
                score: multiAgentConsensus,
                weight: weights.multiAgentConsensus,
                impact: (multiAgentConsensus >= 70 ? 'positive' : multiAgentConsensus >= 50 ? 'neutral' : 'negative') as 'positive' | 'negative' | 'neutral',
            },
            {
                factor: 'Source Reliability',
                score: sourceReliability,
                weight: weights.sourceReliability,
                impact: (sourceReliability >= 70 ? 'positive' : sourceReliability >= 50 ? 'neutral' : 'negative') as 'positive' | 'negative' | 'neutral',
            },
            {
                factor: 'Cross-Platform Verification',
                score: crossPlatformVerification,
                weight: weights.crossPlatformVerification,
                impact: (crossPlatformVerification >= 70 ? 'positive' : crossPlatformVerification >= 50 ? 'neutral' : 'negative') as 'positive' | 'negative' | 'neutral',
            },
            {
                factor: 'Contradiction Detection',
                score: contradictionScore,
                weight: weights.contradictionDetection,
                impact: (contradictionCount === 0 ? 'positive' : contradictionCount <= 2 ? 'neutral' : 'negative') as 'positive' | 'negative' | 'neutral',
            },
        ];

        if (profileVerification && profileVerification.length > 0) {
            factors.push({
                factor: 'Profile Verification',
                score: profileVerificationScore,
                weight: weights.profileVerification,
                impact: (profileVerificationScore >= 70 ? 'positive' : profileVerificationScore >= 50 ? 'neutral' : 'negative') as 'positive' | 'negative' | 'neutral',
            });
        }

        this.logger.log(`Accuracy score calculated: ${overallScore}% (confidence: ${confidence})`);

        return {
            overallScore,
            breakdown: {
                multiAgentConsensus,
                sourceReliability,
                crossPlatformVerification,
                contradictionDetection: contradictionScore,
                profileVerification: profileVerificationScore,
            },
            confidence,
            factors,
        };
    }

    /**
     * Store accuracy score in search result metadata
     */
    async storeAccuracyScore(
        sessionId: string,
        accuracyScore: AccuracyScore,
    ): Promise<void> {
        // This could store the score in Redis or database
        // For now, it's included in the dossier content
        this.logger.debug(`Storing accuracy score for session ${sessionId}: ${accuracyScore.overallScore}%`);
    }
}
