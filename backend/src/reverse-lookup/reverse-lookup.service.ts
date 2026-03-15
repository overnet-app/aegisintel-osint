import { Injectable, Logger } from '@nestjs/common';
import { LookupType, ReverseLookupResult, LookupOptions } from './types/lookup.types';
import { PhoneLookupService } from './services/phone-lookup.service';
import { EmailLookupService } from './services/email-lookup.service';
import { ImageLookupService } from './services/image-lookup.service';
import { VINLookupService } from './services/vin-lookup.service';
import { AddressLookupService } from './services/address-lookup.service';
import { LookupAggregatorService } from './services/lookup-aggregator.service';
import { StreamManagerService } from '../research/streaming/stream-manager.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReverseLookupService {
  private readonly logger = new Logger(ReverseLookupService.name);

  constructor(
    private phoneLookupService: PhoneLookupService,
    private emailLookupService: EmailLookupService,
    private imageLookupService: ImageLookupService,
    private vinLookupService: VINLookupService,
    private addressLookupService: AddressLookupService,
    private lookupAggregator: LookupAggregatorService,
    private streamManager: StreamManagerService,
    private prisma: PrismaService,
  ) {}

  /**
   * Main lookup method that routes requests to appropriate service
   */
  async lookup(
    type: LookupType,
    query: string,
    options: LookupOptions = {},
  ): Promise<ReverseLookupResult> {
    this.logger.log(`Starting ${type} lookup for: ${query}`);

    const sessionId = options.sessionId || `lookup-${Date.now()}`;
    
    try {
      this.streamManager.streamChunk(sessionId, `Starting ${type} lookup...`, 'thinking');

      let result: ReverseLookupResult;

      switch (type) {
        case LookupType.PHONE:
          this.streamManager.streamChunk(sessionId, 'Searching phone number across web...', 'thinking');
          result = await this.phoneLookupService.lookup(query, options);
          break;

        case LookupType.EMAIL:
          this.streamManager.streamChunk(sessionId, 'Searching email address across web...', 'thinking');
          result = await this.emailLookupService.lookup(query, options);
          break;

        case LookupType.IMAGE:
          this.streamManager.streamChunk(sessionId, 'Analyzing image and searching for matches...', 'thinking');
          result = await this.imageLookupService.lookup(query, options);
          break;

        case LookupType.VIN:
          this.streamManager.streamChunk(sessionId, 'Searching vehicle information...', 'thinking');
          result = await this.vinLookupService.lookup(query, options);
          break;

        case LookupType.ADDRESS:
          this.streamManager.streamChunk(sessionId, 'Searching address information...', 'thinking');
          result = await this.addressLookupService.lookup(query, options);
          break;

        default:
          throw new Error(`Unsupported lookup type: ${type}`);
      }

      this.streamManager.streamChunk(sessionId, `Lookup complete. Confidence: ${result.confidence}%`, 'thinking');
      this.logger.log(`${type} lookup completed with ${result.confidence}% confidence`);

      // Save result to database if userId is provided
      if (options.userId) {
        try {
          await this.prisma.reverseLookupSession.create({
            data: {
              userId: options.userId,
              type: type.toUpperCase() as any,
              query: query,
              result: result as any,
              confidence: result.confidence,
              status: 'completed',
            },
          });
        } catch (error: any) {
          this.logger.warn(`Failed to save lookup session: ${error.message}`);
        }
      }

      return result;
    } catch (error: any) {
      this.logger.error(`Lookup failed for ${type}: ${error.message}`, error.stack);
      this.streamManager.streamChunk(sessionId, `Lookup failed: ${error.message}`, 'text');
      
      // Return partial result with error information instead of throwing
      // This allows frontend to display error message while still showing any partial data
      const baseResult: any = {
        confidence: 0,
        sources: [],
        timestamp: new Date(),
      };

      switch (type) {
        case LookupType.PHONE:
          return { ...baseResult, phoneNumber: query } as ReverseLookupResult;
        case LookupType.EMAIL:
          return { ...baseResult, emailAddress: query } as ReverseLookupResult;
        case LookupType.IMAGE:
          return { ...baseResult, imageUrl: query } as ReverseLookupResult;
        case LookupType.VIN:
          return { ...baseResult, vin: query } as ReverseLookupResult;
        case LookupType.ADDRESS:
          return { ...baseResult, address: { fullAddress: query } } as ReverseLookupResult;
        default:
          return baseResult as ReverseLookupResult;
      }
    }
  }

  /**
   * Perform multiple lookups and aggregate results
   */
  async aggregateLookups(
    lookups: Array<{ type: LookupType; query: string }>,
    options: LookupOptions = {},
  ) {
    this.logger.log(`Aggregating ${lookups.length} lookups`);

    const results = await Promise.all(
      lookups.map((lookup) => this.lookup(lookup.type, lookup.query, options)),
    );

    return this.lookupAggregator.aggregate(results, options);
  }

  /**
   * Get cached lookup result if available
   */
  async getCachedResult(type: LookupType, query: string): Promise<ReverseLookupResult | null> {
    // TODO: Implement Redis caching
    return null;
  }

  /**
   * Cache lookup result
   */
  async cacheResult(type: LookupType, query: string, result: ReverseLookupResult): Promise<void> {
    // TODO: Implement Redis caching
  }
}
