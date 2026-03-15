import { useState, useEffect, useRef } from 'react';
import { Search as SearchIcon, Loader2, Info, Upload, X, Image as ImageIcon, BookOpen } from 'lucide-react';
import { useSearchProgress } from '../hooks/useSearchProgress';
import { useNotifications } from '../context/NotificationContext';
import CandidateCard from '../components/CandidateCard';
import ResearchPanel from '../components/research/ResearchPanel';
import api, { searchService } from '../services/api';

interface Candidate {
    id: string;
    source: string;
    username: string;
    fullName: string;
    bio: string;
    avatar?: string;
    confidence: number;
    data: any;
}

interface ExifMetadata {
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

interface ImageAnalysisResult {
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

type SearchMode = 'text' | 'image' | 'research';

export default function SearchPage() {
    const { success, error: notifyError, info } = useNotifications();
    const [searchMode, setSearchMode] = useState<SearchMode>('text');
    const [query, setQuery] = useState('');
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectionActive, setSelectionActive] = useState<string | null>(null);
    const [uploadedImage, setUploadedImage] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [imageAnalysisResult, setImageAnalysisResult] = useState<ImageAnalysisResult | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [researchStarted, setResearchStarted] = useState(false);

    const { progress } = useSearchProgress(sessionId || undefined);

    useEffect(() => {
        if (progress?.status === 'COMPLETED' || progress?.progress === 100) {
            fetchResults();
        }
    }, [progress, sessionId, query]);

    useEffect(() => {
        if (searchMode === 'text') {
            clearImage();
        }
    }, [searchMode]);

    const fetchResults = async () => {
        if (!sessionId) return;
        try {
            const response = await api.get(`/search/${sessionId}`);
            const results = response.data.results || [];

            // Check if this is an image search result
            const imageResults = results.filter((r: any) => r.source === 'IMAGE_SEARCH');
            if (imageResults.length > 0) {
                // Build image analysis result
                const exifResult = imageResults.find((r: any) => r.data.type === 'EXIF_METADATA');
                const analysisResult = imageResults.find((r: any) => r.data.type === 'IMAGE_ANALYSIS');
                const faceResult = imageResults.find((r: any) => r.data.type === 'FACE_ANALYSIS');
                const reverseResults = results.filter((r: any) => r.data.type === 'REVERSE_IMAGE_MATCH');

                setImageAnalysisResult({
                    url: imagePreview || '',
                    googleVision: analysisResult?.data?.googleVision,
                    clarifai: analysisResult?.data?.clarifai,
                    exifMetadata: exifResult?.data || null,
                    faceAnalysis: faceResult?.data?.faces || [],
                    reverseSearchResults: reverseResults.map((r: any) => ({
                        title: r.data.title,
                        url: r.data.url,
                        imageUrl: r.data.imageUrl,
                        source: r.data.source,
                    })),
                });
                // Show success notification for image search
                success(
                    'Image Analysis Completed',
                    `Found ${reverseResults.length} reverse image matches and completed analysis.`,
                    6000
                );
            } else {
                // Regular search results - filter out invalid/empty results
                const validCandidates: Candidate[] = results
                    .filter((r: any) => {
                        // Skip WEB_PAGE results - only show profiles
                        if (r.data?.type === 'WEB_PAGE') return false;
                        
                        const fullName = r.data?.fullName || r.data?.name || '';
                        const username = r.data?.username || '';
                        
                        // Filter out "Unknown Target", "unknown", and empty names
                        // Allow through if we have a valid username even without fullName
                        const hasValidName = (fullName && 
                            fullName.toLowerCase() !== 'unknown target' && 
                            fullName.toLowerCase() !== 'unknown' &&
                            fullName.trim().length > 0) || (username && username.trim().length > 0);
                        
                        // Must have some content (bio, stats with any value, recent post, or avatar)
                        // Stats can be strings like "1.2K" so check for existence not numeric value
                        const hasStats = r.data?.stats && Object.values(r.data.stats).some((v: any) => 
                            v !== null && v !== undefined && String(v).trim().length > 0
                        );
                        const hasContent = r.data?.bio || hasStats || r.data?.recentPost || r.data?.avatarUrl;
                        
                        return hasValidName && hasContent;
                    })
                    .map((r: any) => ({
                        id: r.id,
                        source: r.source,
                        data: r.data,
                        username: r.data.username || r.data.screenName || 'unknown',
                        fullName: r.data.fullName || r.data.name || '',
                        bio: r.data.bio || r.data.description || '',
                        avatar: r.data.avatarUrl || r.images?.[0], // Use avatarUrl or first image
                        confidence: r.data.confidence || 1.0,
                    }));
                setCandidates(validCandidates);
                // Show success notification for text search
                success(
                    'Search Completed',
                    `Found ${validCandidates.length} profile${validCandidates.length !== 1 ? 's' : ''} for "${query}".`,
                    6000
                );
            }

            setIsSearching(false);
        } catch (error) {
            console.error('Failed to fetch results', error);
            notifyError(
                'Search Failed',
                'Failed to fetch search results. Please try again.',
                8000
            );
            setIsSearching(false);
        }
    };

    const handleFileSelect = (file: File) => {
        if (!file.type.startsWith('image/')) {
            alert('Please select a valid image file (JPG, PNG, GIF, or WebP)');
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            alert('File size must be less than 10MB');
            return;
        }

        setUploadedImage(file);
        const reader = new FileReader();
        reader.onloadend = () => {
            setImagePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) {
            handleFileSelect(file);
        }
    };

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleFileSelect(file);
        }
    };

    const handleImageUpload = async () => {
        if (!uploadedImage) return;

        setIsSearching(true);
        setCandidates([]);
        setSessionId(null);
        setUploadProgress(0);
        info('Image Upload Started', 'Analyzing image and performing reverse search...', 3000);

        try {
            const response = await searchService.uploadImage(uploadedImage, (progress) => {
                setUploadProgress(progress);
            });
            setSessionId(response.sessionId);
        } catch (error: any) {
            console.error('Image upload failed', error);
            notifyError(
                'Image Upload Failed',
                error.response?.data?.message || 'Failed to upload image. Please try again.',
                8000
            );
            setIsSearching(false);
        }
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query) return;

        setIsSearching(true);
        setCandidates([]);
        setSessionId(null);
        info('Search Started', `Searching for "${query}"...`, 3000);

        try {
            const response = await api.post('/search', { query, type: 'PRELIMINARY' });
            setSessionId(response.data.id);
        } catch (error: any) {
            console.error('Search failed', error);
            notifyError(
                'Search Failed',
                error.response?.data?.message || 'Failed to start search. Please try again.',
                8000
            );
            setIsSearching(false);
        }
    };

    const clearImage = () => {
        setUploadedImage(null);
        setImagePreview(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleSelect = async (candidate: Candidate) => {
        setSelectionActive(candidate.id);
        info('Deep Search Started', `Starting comprehensive analysis for ${candidate.username}...`, 3000);
        
        try {
            // Start Deep Search for the selected candidate with selectedProfile and persona context
            const persona = candidate.data?.persona;
            const selectedProfile: any = {
                platform: candidate.source,
                username: candidate.username,
                url: candidate.data?.url || `https://${candidate.source.toLowerCase()}.com/${candidate.username}`,
            };
            
            // Include persona context if available
            if (persona) {
                selectedProfile.persona = {
                    type: persona.type || candidate.data?.personaType,
                    profession: persona.profession || candidate.data?.professionKeywords?.[0],
                    location: persona.location?.country || candidate.data?.location,
                    interests: persona.interests || candidate.data?.hashtags || [],
                };
            }
            
            const response = await api.post('/search', {
                query: candidate.username,
                type: 'DEEP',
                selectedProfile: selectedProfile,
            });
            // Redirect to deep search tracker
            window.location.href = `/search/deep/${response.data.id}`;
        } catch (error: any) {
            console.error('Deep search failed', error);
            notifyError(
                'Deep Search Failed',
                error.response?.data?.message || 'Failed to start deep search. Please try again.',
                8000
            );
            setSelectionActive(null);
        }
    };

    return (
        <div className="search-page">
            <div className="search-hero">
                <h2 className="page-title">Target Intelligence Search</h2>
                <p className="page-subtitle">
                    {searchMode === 'text' 
                        ? 'Enter a username, email, or full name to begin preliminary intelligence gathering.'
                        : searchMode === 'image'
                        ? 'Upload an image to perform OSINT analysis including EXIF extraction, face recognition, and reverse image search.'
                        : 'Enter a research query for deep analysis using AI agents and multiple data sources.'}
                </p>
            </div>

            {/* Search Mode Toggle */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', justifyContent: 'center' }}>
                <button
                    type="button"
                    onClick={() => setSearchMode('text')}
                    style={{
                        padding: '8px 20px',
                        borderRadius: '8px',
                        border: '1px solid var(--glass-border)',
                        background: searchMode === 'text' ? 'var(--accent-primary)' : 'transparent',
                        color: searchMode === 'text' ? '#0b1120' : 'var(--text-primary)',
                        cursor: 'pointer',
                        fontWeight: 600,
                        transition: 'all 0.2s ease',
                    }}
                >
                    <SearchIcon size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
                    Text Search
                </button>
                <button
                    type="button"
                    onClick={() => setSearchMode('image')}
                    style={{
                        padding: '8px 20px',
                        borderRadius: '8px',
                        border: '1px solid var(--glass-border)',
                        background: searchMode === 'image' ? 'var(--accent-primary)' : 'transparent',
                        color: searchMode === 'image' ? '#0b1120' : 'var(--text-primary)',
                        cursor: 'pointer',
                        fontWeight: 600,
                        transition: 'all 0.2s ease',
                    }}
                >
                    <ImageIcon size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
                    Image Search
                </button>
                <button
                    type="button"
                    onClick={() => setSearchMode('research')}
                    style={{
                        padding: '8px 20px',
                        borderRadius: '8px',
                        border: '1px solid var(--glass-border)',
                        background: searchMode === 'research' ? 'var(--accent-primary)' : 'transparent',
                        color: searchMode === 'research' ? '#0b1120' : 'var(--text-primary)',
                        cursor: 'pointer',
                        fontWeight: 600,
                        transition: 'all 0.2s ease',
                    }}
                >
                    <BookOpen size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
                    Deep Research
                </button>
            </div>

            {searchMode === 'research' ? (
                <div className="search-container">
                    <form onSubmit={(e) => { 
                        e.preventDefault(); 
                        if (query && !researchStarted) {
                            setResearchStarted(true);
                        }
                    }}>
                        <div className="search-input-wrapper glass">
                            <SearchIcon className="search-icon" size={20} />
                            <input
                                type="text"
                                placeholder="Enter research query (e.g., 'NVIDIA stock performance over 10 years')..."
                                value={query}
                                onChange={(e) => {
                                    setQuery(e.target.value);
                                    setResearchStarted(false); // Reset when query changes
                                }}
                                autoFocus
                            />
                        </div>
                        {!researchStarted && (
                            <button 
                                type="submit"
                                disabled={!query || isSearching}
                                style={{
                                    marginTop: '16px',
                                    padding: '12px 32px',
                                    background: query ? 'var(--accent-primary)' : 'var(--glass-bg)',
                                    border: '1px solid var(--glass-border)',
                                    borderRadius: '8px',
                                    color: query ? '#0b1120' : 'var(--text-muted)',
                                    cursor: query ? 'pointer' : 'not-allowed',
                                    fontSize: '16px',
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    margin: '16px auto 0',
                                    transition: 'all 0.2s ease',
                                }}
                            >
                                {isSearching ? <Loader2 className="animate-spin" size={18} /> : <SearchIcon size={18} />}
                                Start Deep Research
                            </button>
                        )}
                    </form>
                    {query && researchStarted && <ResearchPanel query={query} autoStart={true} />}
                </div>
            ) : searchMode === 'text' ? (
                <form className="search-container" onSubmit={handleSearch}>
                    <div className="search-input-wrapper glass">
                        <SearchIcon className="search-icon" size={20} />
                        <input
                            type="text"
                            placeholder="Search target profile (e.g. @username or full name)..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            autoFocus
                        />
                        <button type="submit" disabled={isSearching} className="search-submit">
                            {isSearching ? <Loader2 className="animate-spin" size={20} /> : 'Gather Intel'}
                        </button>
                    </div>
                </form>
            ) : (
                <div className="search-container">
                    <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        style={{
                            border: `2px dashed ${isDragging ? 'var(--accent-primary)' : 'var(--glass-border)'}`,
                            borderRadius: '12px',
                            padding: '40px',
                            textAlign: 'center',
                            background: isDragging ? 'rgba(59, 130, 246, 0.1)' : 'var(--glass-bg)',
                            transition: 'all 0.2s ease',
                            cursor: 'pointer',
                        }}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileInputChange}
                            style={{ display: 'none' }}
                        />
                        {imagePreview ? (
                            <div style={{ position: 'relative', display: 'inline-block' }}>
                                <img
                                    src={imagePreview}
                                    alt="Preview"
                                    style={{
                                        maxWidth: '100%',
                                        maxHeight: '400px',
                                        borderRadius: '8px',
                                        marginBottom: '16px',
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        clearImage();
                                    }}
                                    style={{
                                        position: 'absolute',
                                        top: '8px',
                                        right: '8px',
                                        background: 'rgba(0, 0, 0, 0.7)',
                                        border: 'none',
                                        borderRadius: '50%',
                                        width: '32px',
                                        height: '32px',
                                        color: 'white',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        ) : (
                            <>
                                <Upload size={48} style={{ margin: '0 auto 16px', color: 'var(--accent-primary)' }} />
                                <p style={{ marginBottom: '8px', fontWeight: 600 }}>Drag & drop an image here</p>
                                <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>or click to browse</p>
                                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                                    Supported: JPG, PNG, GIF, WebP (Max 10MB)
                                </p>
                            </>
                        )}
                    </div>
                    {uploadedImage && (
                        <button
                            type="button"
                            onClick={handleImageUpload}
                            disabled={isSearching}
                            style={{
                                marginTop: '16px',
                                width: '100%',
                                padding: '12px',
                                background: 'var(--accent-primary)',
                                color: '#0b1120',
                                border: 'none',
                                borderRadius: '8px',
                                fontWeight: 600,
                                cursor: isSearching ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                            }}
                        >
                            {isSearching ? (
                                <>
                                    <Loader2 className="animate-spin" size={20} />
                                    {uploadProgress > 0 ? `Uploading... ${uploadProgress}%` : 'Analyzing...'}
                                </>
                            ) : (
                                <>
                                    <Upload size={20} />
                                    Analyze Image
                                </>
                            )}
                        </button>
                    )}
                </div>
            )}

            {!isSearching && candidates.length === 0 && (
                <div className="search-history-label">Press / for quick search or enter command</div>
            )}

            {isSearching && (
                <div className="search-status-overlay" style={{ marginTop: '40px' }}>
                    <div className="status-terminal glass" style={{ padding: '24px', borderRadius: '12px' }}>
                        <div className="terminal-line" style={{ color: 'var(--accent-secondary)' }}>
                            {progress?.status || 'Searching across 12+ platforms...'}
                        </div>
                        <div className="terminal-progress-bar" style={{ height: '2px', background: '#333', marginTop: '12px', borderRadius: '2px', overflow: 'hidden' }}>
                            <div
                                className="progress-fill"
                                style={{
                                    height: '100%',
                                    background: 'var(--accent-primary)',
                                    width: `${progress?.progress || 30}%`,
                                    transition: 'width 0.5s ease'
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}

            {imageAnalysisResult && (
                <div className="results-container fade-in" style={{ marginTop: '40px' }}>
                    <h3 style={{ marginBottom: '24px', fontSize: '20px', fontWeight: 600 }}>Image Analysis Results</h3>
                    
                    {/* EXIF Metadata */}
                    {imageAnalysisResult.exifMetadata && (
                        <div className="glass-card" style={{ padding: '20px', marginBottom: '20px', borderRadius: '12px' }}>
                            <h4 style={{ marginBottom: '12px', fontSize: '16px', fontWeight: 600 }}>EXIF Metadata</h4>
                            <div style={{ display: 'grid', gap: '8px', fontSize: '14px' }}>
                                {imageAnalysisResult.exifMetadata.camera && (
                                    <div>
                                        <strong>Camera:</strong> {imageAnalysisResult.exifMetadata.camera.make} {imageAnalysisResult.exifMetadata.camera.model}
                                    </div>
                                )}
                                {imageAnalysisResult.exifMetadata.gps && (
                                    <div>
                                        <strong>Location:</strong> {imageAnalysisResult.exifMetadata.gps.latitude.toFixed(6)}, {imageAnalysisResult.exifMetadata.gps.longitude.toFixed(6)}
                                    </div>
                                )}
                                {imageAnalysisResult.exifMetadata.dateTaken && (
                                    <div>
                                        <strong>Date Taken:</strong> {new Date(imageAnalysisResult.exifMetadata.dateTaken).toLocaleString()}
                                    </div>
                                )}
                                {imageAnalysisResult.exifMetadata.software && (
                                    <div>
                                        <strong>Software:</strong> {imageAnalysisResult.exifMetadata.software}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Face Analysis */}
                    {imageAnalysisResult.faceAnalysis && imageAnalysisResult.faceAnalysis.length > 0 && (
                        <div className="glass-card" style={{ padding: '20px', marginBottom: '20px', borderRadius: '12px' }}>
                            <h4 style={{ marginBottom: '12px', fontSize: '16px', fontWeight: 600 }}>Face Detection</h4>
                            <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                                {imageAnalysisResult.faceAnalysis.length} face(s) detected
                            </p>
                        </div>
                    )}

                    {/* Reverse Image Search Results */}
                    {imageAnalysisResult.reverseSearchResults && imageAnalysisResult.reverseSearchResults.length > 0 && (
                        <div className="glass-card" style={{ padding: '20px', marginBottom: '20px', borderRadius: '12px' }}>
                            <h4 style={{ marginBottom: '12px', fontSize: '16px', fontWeight: 600 }}>Reverse Image Search</h4>
                            <div style={{ display: 'grid', gap: '12px' }}>
                                {imageAnalysisResult.reverseSearchResults.map((result, idx) => (
                                    <a
                                        key={idx}
                                        href={result.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                            padding: '12px',
                                            background: 'rgba(255, 255, 255, 0.05)',
                                            borderRadius: '8px',
                                            textDecoration: 'none',
                                            color: 'var(--text-primary)',
                                            display: 'block',
                                            transition: 'all 0.2s ease',
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                        }}
                                    >
                                        <div style={{ fontWeight: 600, marginBottom: '4px' }}>{result.title}</div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{result.url}</div>
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {candidates.length > 0 && (
                <div className="results-container fade-in">
                    <div className="results-header" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', color: 'var(--text-muted)' }}>
                        <Info size={16} />
                        <span style={{ fontSize: '13px', fontWeight: '500' }}>
                            Preliminary search found {candidates.length} potential matches. Select a candidate for high-fidelity deep analysis.
                        </span>
                    </div>
                    <div className="results-grid">
                        {candidates.map(candidate => (
                            <CandidateCard
                                key={candidate.id}
                                candidate={candidate}
                                onSelect={handleSelect}
                                isSelecting={selectionActive === candidate.id}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
