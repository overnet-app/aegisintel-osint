import React, { useState } from 'react';
import { Phone, Mail, Image as ImageIcon, Car, MapPin, Search, Loader2, Upload, X } from 'lucide-react';
import { reverseLookupService, searchService } from '../../services/api';
import { LookupResultsView } from './LookupResultsView';

type LookupType = 'phone' | 'email' | 'image' | 'vin' | 'address';

interface ReverseLookupPanelProps {
    onResult?: (result: any) => void;
}

export const ReverseLookupPanel: React.FC<ReverseLookupPanelProps> = ({ onResult }) => {
    const [lookupType, setLookupType] = useState<LookupType>('phone');
    const [query, setQuery] = useState('');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    const handleLookup = async () => {
        if (!query && !imageFile) {
            setError('Please enter a query or select an image');
            return;
        }

        setLoading(true);
        setError(null);
        setResult(null);

        try {
            let response;
            let lookupQuery = query;

            // Handle image upload
            if (lookupType === 'image' && imageFile) {
                try {
                    // First upload the image using the authenticated API service
                    const uploadData = await searchService.uploadImage(imageFile);
                    lookupQuery = uploadData.imageUrl;
                } catch (uploadError: any) {
                    if (uploadError.response?.status === 401) {
                        setError('Authentication failed. Please log in again.');
                        // Redirect to login if token is invalid
                        if (uploadError.response?.data?.message?.includes('Unauthorized')) {
                            localStorage.removeItem('access_token');
                            localStorage.removeItem('refresh_token');
                            window.location.href = '/login';
                        }
                        setLoading(false);
                        return;
                    }
                    throw uploadError; // Re-throw other errors
                }
            }

            switch (lookupType) {
                case 'phone':
                    response = await reverseLookupService.lookupPhone(lookupQuery);
                    break;
                case 'email':
                    response = await reverseLookupService.lookupEmail(lookupQuery);
                    break;
                case 'image':
                    response = await reverseLookupService.lookupImage(lookupQuery);
                    break;
                case 'vin':
                    response = await reverseLookupService.lookupVIN(lookupQuery);
                    break;
                case 'address':
                    response = await reverseLookupService.lookupAddress(lookupQuery);
                    break;
            }

            const resultData = response?.data || response;
            setResult(resultData);
            if (onResult) {
                onResult(resultData);
            }
        } catch (err: any) {
            setError(err.response?.data?.message || err.message || 'Lookup failed');
        } finally {
            setLoading(false);
        }
    };

    const lookupTypes: Array<{ type: LookupType; label: string; icon: React.ReactNode; placeholder: string }> = [
        { type: 'phone', label: 'Phone Number', icon: <Phone className="w-5 h-5" />, placeholder: '+1 (555) 123-4567' },
        { type: 'email', label: 'Email Address', icon: <Mail className="w-5 h-5" />, placeholder: 'example@email.com' },
        { type: 'image', label: 'Image', icon: <ImageIcon className="w-5 h-5" />, placeholder: 'Upload an image' },
        { type: 'vin', label: 'VIN Number', icon: <Car className="w-5 h-5" />, placeholder: '1HGBH41JXMN109186' },
        { type: 'address', label: 'Address', icon: <MapPin className="w-5 h-5" />, placeholder: '123 Main St, City, State 12345' },
    ];

    const [isDragging, setIsDragging] = useState(false);

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
        if (lookupType === 'image') {
            const file = e.dataTransfer.files[0];
            if (file) {
                setImageFile(file);
                setQuery(file.name);
            }
        }
    };

    return (
        <div className="space-y-6">
            {/* Lookup Type Selector - Similar to Search Mode Toggle */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', justifyContent: 'center', flexWrap: 'wrap' }}>
                {lookupTypes.map((type) => (
                    <button
                        key={type.type}
                        type="button"
                        onClick={() => {
                            setLookupType(type.type);
                            setQuery('');
                            setImageFile(null);
                            setResult(null);
                            setError(null);
                        }}
                        style={{
                            padding: '8px 20px',
                            borderRadius: '8px',
                            border: '1px solid var(--glass-border)',
                            background: lookupType === type.type ? 'var(--accent-primary)' : 'transparent',
                            color: lookupType === type.type ? '#0b1120' : 'var(--text-primary)',
                            cursor: 'pointer',
                            fontWeight: 600,
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                        }}
                    >
                        {type.icon}
                        {type.label}
                    </button>
                ))}
            </div>

            {/* Input Section */}
            {lookupType === 'image' ? (
                <div>
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
                            marginBottom: imageFile ? '16px' : '0',
                        }}
                        onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'image/*';
                            input.onchange = (e: any) => {
                                const file = e.target.files?.[0] || null;
                                if (file) {
                                    setImageFile(file);
                                    setQuery(file.name);
                                }
                            };
                            input.click();
                        }}
                    >
                        <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                                const file = e.target.files?.[0] || null;
                                if (file) {
                                    setImageFile(file);
                                    setQuery(file.name);
                                } else {
                                    setImageFile(null);
                                    setQuery('');
                                }
                            }}
                            style={{ display: 'none' }}
                            id="image-upload-input"
                        />
                        <Upload size={48} style={{ margin: '0 auto 16px', opacity: 0.6 }} />
                        <div style={{ marginBottom: '8px', fontSize: '16px', fontWeight: 600 }}>
                            {imageFile ? imageFile.name : 'Click to upload or drag and drop'}
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                            PNG, JPG, GIF up to 10MB
                        </div>
                        {imageFile && (
                            <div style={{ 
                                marginTop: '16px', 
                                padding: '12px', 
                                background: 'rgba(59, 130, 246, 0.1)', 
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px'
                            }}>
                                <ImageIcon size={20} style={{ color: 'var(--accent-primary)' }} />
                                <span style={{ fontSize: '14px' }}>{imageFile.name}</span>
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                    ({(imageFile.size / 1024 / 1024).toFixed(2)} MB)
                                </span>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setImageFile(null);
                                        setQuery('');
                                    }}
                                    style={{
                                        marginLeft: '8px',
                                        padding: '4px',
                                        background: 'transparent',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: 'var(--accent-danger)',
                                    }}
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        )}
                    </div>
                    {imageFile && (
                        <button
                            onClick={handleLookup}
                            disabled={loading}
                            className="search-submit"
                            style={{
                                width: '100%',
                                marginTop: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                            }}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="animate-spin" size={20} />
                                    <span>Searching...</span>
                                </>
                            ) : (
                                <>
                                    <Search size={20} />
                                    <span>Start Image Lookup</span>
                                </>
                            )}
                        </button>
                    )}
                </div>
            ) : (
                <form onSubmit={(e) => { e.preventDefault(); handleLookup(); }}>
                    <div className="search-input-wrapper glass">
                        <Search className="search-icon" size={20} />
                        <input
                            type="text"
                            value={query || ''}
                            onChange={(e) => setQuery(e.target.value || '')}
                            placeholder={lookupTypes.find((t) => t.type === lookupType)?.placeholder}
                            autoFocus
                        />
                        <button 
                            type="submit" 
                            disabled={loading || !query} 
                            className="search-submit"
                        >
                            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Start Lookup'}
                        </button>
                    </div>
                </form>
            )}

            {/* Error Message */}
            {error && (
                <div style={{
                    marginTop: '16px',
                    padding: '16px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '8px',
                    color: 'var(--accent-danger)',
                    display: 'flex',
                    alignItems: 'start',
                    gap: '12px'
                }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, marginBottom: '4px' }}>Error</div>
                        <div style={{ fontSize: '14px' }}>{error}</div>
                    </div>
                    <button
                        onClick={() => setError(null)}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--accent-danger)',
                            padding: '4px',
                        }}
                    >
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* Results */}
            {result && (
                <div className="results-container fade-in" style={{ marginTop: '40px' }}>
                    <LookupResultsView result={result} lookupType={lookupType} />
                </div>
            )}
        </div>
    );
};
