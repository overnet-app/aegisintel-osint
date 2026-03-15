import { Injectable, Logger } from '@nestjs/common';
import {
  ReverseLookupResult,
  AggregatedLookupResult,
  LookupType,
  LookupOptions,
} from '../types/lookup.types';
import { LogicianAgent } from '../../research/agents/logician.agent';
import { RelationshipAgent } from '../../ai/agents/relationship.agent';
import { AgentModelResolverService } from '../../research/services/agent-model-resolver.service';

@Injectable()
export class LookupAggregatorService {
  private readonly logger = new Logger(LookupAggregatorService.name);

  constructor(
    private logicianAgent: LogicianAgent,
    private relationshipAgent: RelationshipAgent,
    private agentModelResolver: AgentModelResolverService,
  ) {}

  async aggregate(
    results: ReverseLookupResult[],
    options: LookupOptions = {},
  ): Promise<AggregatedLookupResult> {
    this.logger.log(`Aggregating ${results.length} lookup results`);

    if (results.length === 0) {
      throw new Error('No results to aggregate');
    }

    // Primary result is the first one (or highest confidence)
    const primaryResult = results.reduce((prev, current) =>
      current.confidence > prev.confidence ? current : prev,
    );

    // Related results are the rest
    const relatedResults: ReverseLookupResult[] = results.filter((r) => r !== primaryResult);

    // Deduplicate information
    const deduplicatedResults = this.deduplicateResults(results);

    // Cross-validate data using LogicianAgent
    let validationResults;
    if (options.userId) {
      try {
        const logicianModel = await this.agentModelResolver.resolveAgentModel(options.userId, 'logician', 'openrouter', 'google/gemma-3-27b-it');
        validationResults = await this.validateResults(deduplicatedResults, logicianModel.provider, logicianModel.model);
      } catch (error) {
        this.logger.warn(`Validation failed: ${error.message}`);
      }
    }

    // Build relationship graph
    const relationshipGraph = await this.buildRelationshipGraph(deduplicatedResults, options);

    // Create timeline
    const timeline = this.createTimeline(deduplicatedResults);

    // Calculate overall confidence
    const confidence = this.calculateOverallConfidence(deduplicatedResults, validationResults);

    const result: AggregatedLookupResult = {
      primaryResult,
      relatedResults: relatedResults.length > 0 ? relatedResults : [],
      relationshipGraph: relationshipGraph.nodes.length > 0 ? relationshipGraph : undefined,
      timeline: timeline.length > 0 ? timeline : undefined,
      confidence,
      validationResults,
    };

    return result;
  }

  private deduplicateResults(results: ReverseLookupResult[]): ReverseLookupResult[] {
    // Simple deduplication based on query/identifier
    const seen = new Set<string>();
    const deduplicated: ReverseLookupResult[] = [];

    for (const result of results) {
      let key: string;
      if ('phoneNumber' in result) key = result.phoneNumber;
      else if ('emailAddress' in result) key = result.emailAddress;
      else if ('imageUrl' in result) key = result.imageUrl;
      else if ('vin' in result) key = result.vin;
      else if ('address' in result) key = result.address.fullAddress || '';
      else key = JSON.stringify(result);

      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(result);
      }
    }

    return deduplicated;
  }

  private async validateResults(
    results: ReverseLookupResult[],
    provider: string,
    model: string,
  ): Promise<any> {
    try {
      // Convert results to facts for validation
      const facts = this.extractFactsFromResults(results);

      if (facts.length === 0) {
        return {
          validatedFacts: 0,
          contradictions: 0,
          qualityScore: 0,
        };
      }

      // Convert facts to ScoutFindings format for LogicianAgent
      const scoutFindings = facts.map((fact, idx) => ({
        directiveId: idx + 1,
        tool: 'reverse_lookup',
        query: fact,
        rawData: [{
          fact,
          source: {
            url: 'reverse_lookup',
            title: 'Reverse Lookup Result',
            reliability: 'medium' as const,
            type: 'other' as const,
          },
        }],
        searchOperators: [],
        credibilityScore: 50,
      }));

      // Use LogicianAgent to validate
      const verdict = await this.logicianAgent.validateFindings(
        scoutFindings,
        undefined, // No quant analysis
        provider,
        model,
      );

      return {
        validatedFacts: verdict.validatedFacts?.length || 0,
        contradictions: verdict.contradictions?.length || 0,
        qualityScore: verdict.qualityScore || 0,
      };
    } catch (error) {
      this.logger.warn(`Result validation failed: ${error.message}`);
      return {
        validatedFacts: 0,
        contradictions: 0,
        qualityScore: 0,
      };
    }
  }

  private extractFactsFromResults(results: ReverseLookupResult[]): string[] {
    const facts: string[] = [];

    for (const result of results) {
      if ('personInfo' in result && result.personInfo) {
        if (result.personInfo.fullName) {
          facts.push(`Person name: ${result.personInfo.fullName}`);
        }
        if (result.personInfo.addresses && result.personInfo.addresses.length > 0) {
          result.personInfo.addresses.forEach((addr) => {
            if (addr.fullAddress) {
              facts.push(`Address: ${addr.fullAddress}`);
            }
          });
        }
      }

      if ('vehicleInfo' in result && result.vehicleInfo) {
        if (result.vehicleInfo.make && result.vehicleInfo.model) {
          facts.push(`Vehicle: ${result.vehicleInfo.make} ${result.vehicleInfo.model}`);
        }
      }

      if ('address' in result && result.address) {
        if (result.address.fullAddress) {
          facts.push(`Address: ${result.address.fullAddress}`);
        }
      }
    }

    return facts;
  }

  private async buildRelationshipGraph(
    results: ReverseLookupResult[],
    options: LookupOptions,
  ): Promise<any> {
    const nodes: any[] = [];
    const edges: any[] = [];
    const nodeMap = new Map<string, number>();

    // Add nodes for each result
    for (const result of results) {
      let nodeId: string;
      let label: string;
      let type: LookupType;

      if ('phoneNumber' in result) {
        nodeId = `phone-${result.phoneNumber}`;
        label = result.personInfo?.fullName || result.phoneNumber;
        type = LookupType.PHONE;
      } else if ('emailAddress' in result) {
        nodeId = `email-${result.emailAddress}`;
        label = result.personInfo?.fullName || result.emailAddress;
        type = LookupType.EMAIL;
      } else if ('imageUrl' in result) {
        nodeId = `image-${result.imageUrl.substring(0, 20)}`;
        label = result.identifiedPersons?.[0]?.personInfo?.fullName || 'Image';
        type = LookupType.IMAGE;
      } else if ('vin' in result) {
        nodeId = `vin-${result.vin}`;
        label = `${result.vehicleInfo?.make || ''} ${result.vehicleInfo?.model || ''}`.trim() || result.vin;
        type = LookupType.VIN;
      } else if ('address' in result) {
        nodeId = `address-${result.address.fullAddress?.substring(0, 30)}`;
        label = result.address.fullAddress || 'Address';
        type = LookupType.ADDRESS;
      } else {
        continue;
      }

      if (!nodeMap.has(nodeId)) {
        nodeMap.set(nodeId, nodes.length);
        nodes.push({
          id: nodeId,
          type,
          label,
          data: result,
        });
      }

      // Add edges for relationships
      if ('relationships' in result && result.relationships) {
        for (const rel of result.relationships) {
          const targetId = `person-${rel.name}`;
          if (!nodeMap.has(targetId)) {
            nodeMap.set(targetId, nodes.length);
            nodes.push({
              id: targetId,
              type: LookupType.PHONE, // Default type
              label: rel.name,
              data: { relationship: rel },
            });
          }

          const sourceIdx = nodeMap.get(nodeId)!;
          const targetIdx = nodeMap.get(targetId)!;

          edges.push({
            source: nodeId,
            target: targetId,
            type: rel.type || 'unknown',
            strength: rel.confidence || 50,
          });
        }
      }
    }

    return { nodes, edges };
  }

  private createTimeline(results: ReverseLookupResult[]): any[] {
    const timeline: any[] = [];

    for (const result of results) {
      // Add result timestamp
      timeline.push({
        date: result.timestamp.toISOString(),
        event: this.getResultDescription(result),
        type: this.getResultType(result),
        source: 'reverse_lookup',
      });

      // Add location history events
      if ('locationHistory' in result && result.locationHistory) {
        for (const location of result.locationHistory) {
          if (location.dateRange?.start) {
            timeline.push({
              date: location.dateRange.start,
              event: `Location: ${location.address.fullAddress}`,
              type: this.getResultType(result),
              source: location.sources?.[0] || 'reverse_lookup',
            });
          }
        }
      }

      // Add owner history events (for VIN)
      if ('ownerHistory' in result && result.ownerHistory) {
        for (const owner of result.ownerHistory) {
          if (owner.dateRange?.start) {
            timeline.push({
              date: owner.dateRange.start,
              event: `Owner: ${owner.name}`,
              type: this.getResultType(result),
              source: 'reverse_lookup',
            });
          }
        }
      }
    }

    // Sort by date
    timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return timeline;
  }

  private getResultDescription(result: ReverseLookupResult): string {
    if ('phoneNumber' in result) {
      return `Phone lookup: ${result.personInfo?.fullName || result.phoneNumber}`;
    } else if ('emailAddress' in result) {
      return `Email lookup: ${result.personInfo?.fullName || result.emailAddress}`;
    } else if ('imageUrl' in result) {
      return `Image lookup: ${result.identifiedPersons?.[0]?.personInfo?.fullName || 'Image'}`;
    } else if ('vin' in result) {
      return `VIN lookup: ${result.vehicleInfo?.make || ''} ${result.vehicleInfo?.model || ''}`.trim() || result.vin;
    } else if ('address' in result) {
      return `Address lookup: ${result.address.fullAddress}`;
    }
    return 'Reverse lookup';
  }

  private getResultType(result: ReverseLookupResult): LookupType {
    if ('phoneNumber' in result) return LookupType.PHONE;
    if ('emailAddress' in result) return LookupType.EMAIL;
    if ('imageUrl' in result) return LookupType.IMAGE;
    if ('vin' in result) return LookupType.VIN;
    if ('address' in result) return LookupType.ADDRESS;
    return LookupType.PHONE; // Default
  }

  private calculateOverallConfidence(
    results: ReverseLookupResult[],
    validationResults?: any,
  ): number {
    if (results.length === 0) return 0;

    // Average confidence of all results
    const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;

    // Adjust based on validation
    let adjustedConfidence = avgConfidence;
    if (validationResults) {
      const validationScore = validationResults.qualityScore || 0;
      adjustedConfidence = (avgConfidence + validationScore) / 2;
    }

    return Math.round(adjustedConfidence);
  }
}
