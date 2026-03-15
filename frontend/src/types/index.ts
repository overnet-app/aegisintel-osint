export interface User {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    role: 'ADMIN' | 'ANALYST' | 'VIEWER';
    isActive: boolean;
    preferredModel: string;
    enabledServices: {
        clarifai?: boolean;
    };
    createdAt: string;
    updatedAt: string;
};

export interface Dossier {
    id: string;
    userId: string;
    subject: string;
    content: DossierContent;
    notes?: string;
    createdAt: string;
    updatedAt: string;
}

export interface DossierContent {
    summary?: string;
    riskAssessment?: {
        riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'UNKNOWN';
        findings: string[];
        explanation: string;
    };
    relationships?: any;
    temporal?: any;
    geolocation?: any;
    imageAnalysis?: any;
    textAnalysis?: any;
    correlation?: any;
    aiInsights?: any;
}

export interface SearchSession {
    id: string;
    userId: string;
    query: string;
    type: 'PRELIMINARY' | 'DEEP' | 'IMAGE';
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
    progress: number;
    results?: SearchResult[];
    createdAt: string;
    updatedAt: string;
}

export interface SearchResult {
    id: string;
    searchSessionId: string;
    source: 'INSTAGRAM' | 'TWITTER' | 'LINKEDIN' | 'FACEBOOK' | 'TIKTOK' | 'WEB' | 'IMAGE_SEARCH' | 'OTHER';
    data: any;
    images: string[];
    metadata?: any;
    createdAt: string;
}

export interface Candidate {
    id: string;
    source: string;
    username: string;
    fullName: string;
    bio: string;
    avatar?: string;
    confidence: number;
    data: any;
}

export interface ProgressData {
    status?: string;
    progress?: number;
    step?: string;
    error?: string;
}

export interface ExifMetadata {
    gps?: {
        latitude: number;
        longitude: number;
    };
    camera?: {
        make?: string;
        model?: string;
    };
    dateTaken?: Date | string;
    software?: string;
    orientation?: number;
    width?: number;
    height?: number;
}

export interface ImageAnalysisResult {
    url: string;
    googleVision?: any;
    clarifai?: any;
    exifMetadata?: ExifMetadata | null;
    faceAnalysis?: any[];
    reverseSearchResults?: Array<{
        title: string;
        url: string;
        imageUrl?: string;
        source?: string;
    }>;
}

// Force Vite to reload this module

// Re-export research types
export * from './research.types';
