/**
 * Type definitions for Reverse Lookup System
 */

export enum LookupType {
  PHONE = 'phone',
  EMAIL = 'email',
  IMAGE = 'image',
  VIN = 'vin',
  ADDRESS = 'address',
}

export interface PersonInfo {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  aliases?: string[];
  age?: number;
  dateOfBirth?: string;
  addresses?: AddressInfo[];
  phoneNumbers?: string[];
  emailAddresses?: string[];
  socialProfiles?: SocialProfile[];
  profession?: string;
  company?: string;
  education?: string[];
  languages?: string[];
}

export interface AddressInfo {
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  fullAddress?: string;
  type?: 'current' | 'previous' | 'business';
  dateRange?: {
    start?: string;
    end?: string;
  };
  confidence?: number;
}

export interface SocialProfile {
  platform: string;
  username?: string;
  url: string;
  verified?: boolean;
  followers?: number;
  bio?: string;
  profileImage?: string;
}

export interface RelationshipInfo {
  type: 'family' | 'friend' | 'colleague' | 'associate' | 'unknown';
  name: string;
  relationship?: string; // e.g., "brother", "mother", "colleague"
  confidence: number;
  sources?: string[];
  socialProfiles?: SocialProfile[];
}

export interface LocationHistory {
  address: AddressInfo;
  dateRange?: {
    start?: string;
    end?: string;
  };
  sources?: string[];
  confidence?: number;
}

export interface WebActivity {
  type: 'news' | 'blog' | 'directory' | 'forum' | 'social' | 'other';
  title: string;
  url: string;
  snippet?: string;
  date?: string;
  source?: string;
}

export interface VehicleInfo {
  make?: string;
  model?: string;
  year?: number;
  color?: string;
  vin?: string;
  licensePlate?: string;
  registrationState?: string;
  ownerHistory?: Array<{
    name: string;
    dateRange?: {
      start?: string;
      end?: string;
    };
  }>;
  saleListings?: Array<{
    url: string;
    price?: number;
    date?: string;
  }>;
}

export interface PropertyInfo {
  address: AddressInfo;
  propertyType?: string;
  squareFootage?: number;
  bedrooms?: number;
  bathrooms?: number;
  yearBuilt?: number;
  currentOwner?: string;
  ownershipHistory?: Array<{
    owner: string;
    dateRange?: {
      start?: string;
      end?: string;
    };
  }>;
  neighbors?: Array<{
    name: string;
    address?: string;
  }>;
}

export interface PhoneLookupResult {
  phoneNumber: string;
  personInfo?: PersonInfo;
  relationships?: RelationshipInfo[];
  locationHistory?: LocationHistory[];
  webActivity?: WebActivity[];
  associatedEmails?: string[];
  associatedAddresses?: AddressInfo[];
  confidence: number;
  sources: string[];
  timestamp: Date;
}

export interface EmailLookupResult {
  emailAddress: string;
  personInfo?: PersonInfo;
  relationships?: RelationshipInfo[];
  associatedPhones?: string[];
  associatedAddresses?: AddressInfo[];
  socialProfiles?: SocialProfile[];
  dataBreaches?: Array<{
    service: string;
    date?: string;
    leakedData?: string[];
  }>;
  webActivity?: WebActivity[];
  confidence: number;
  sources: string[];
  timestamp: Date;
}

export interface ImageLookupResult {
  imageUrl: string;
  identifiedPersons?: Array<{
    personInfo: PersonInfo;
    faceMatch?: {
      confidence: number;
      source: string;
    };
    context?: string;
  }>;
  relationships?: RelationshipInfo[];
  locationInfo?: AddressInfo[];
  socialProfiles?: SocialProfile[];
  webActivity?: WebActivity[];
  reverseImageMatches?: Array<{
    url: string;
    title?: string;
    source?: string;
  }>;
  confidence: number;
  sources: string[];
  timestamp: Date;
}

export interface VINLookupResult {
  vin: string;
  vehicleInfo?: VehicleInfo;
  ownerHistory?: Array<{
    name: string;
    address?: AddressInfo;
    dateRange?: {
      start?: string;
      end?: string;
    };
  }>;
  associatedAddresses?: AddressInfo[];
  saleListings?: Array<{
    url: string;
    price?: number;
    date?: string;
    seller?: string;
  }>;
  confidence: number;
  sources: string[];
  timestamp: Date;
}

export interface AddressLookupResult {
  address: AddressInfo;
  currentResidents?: PersonInfo[];
  pastResidents?: PersonInfo[];
  neighbors?: Array<{
    name: string;
    address?: AddressInfo;
    relationship?: string;
  }>;
  propertyInfo?: PropertyInfo;
  associatedPhones?: string[];
  associatedEmails?: string[];
  webActivity?: WebActivity[];
  confidence: number;
  sources: string[];
  timestamp: Date;
}

export type ReverseLookupResult =
  | PhoneLookupResult
  | EmailLookupResult
  | ImageLookupResult
  | VINLookupResult
  | AddressLookupResult;

export interface LookupOptions {
  includeRelationships?: boolean;
  includeWebActivity?: boolean;
  includeLocationHistory?: boolean;
  maxResults?: number;
  minConfidence?: number;
  userId?: string;
  sessionId?: string;
}

export interface AggregatedLookupResult {
  primaryResult: ReverseLookupResult;
  relatedResults: ReverseLookupResult[];
  relationshipGraph?: {
    nodes: Array<{
      id: string;
      type: LookupType;
      label: string;
      data: any;
    }>;
    edges: Array<{
      source: string;
      target: string;
      type: string;
      strength: number;
    }>;
  };
  timeline?: Array<{
    date: string;
    event: string;
    type: LookupType;
    source?: string;
  }>;
  confidence: number;
  validationResults?: {
    validatedFacts: number;
    contradictions: number;
    qualityScore: number;
  };
}
