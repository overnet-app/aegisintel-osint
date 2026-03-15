import React, { useState } from 'react';
import { User, MapPin, Users, Link as LinkIcon, Globe, Clock, Download, FileText } from 'lucide-react';
import { PersonInfoCard } from './PersonInfoCard';
import { reverseLookupService } from '../../services/api';

interface LookupResultsViewProps {
    result: any;
    lookupType: 'phone' | 'email' | 'image' | 'vin' | 'address';
}

export const LookupResultsView: React.FC<LookupResultsViewProps> = ({ result, lookupType }) => {
    const [activeTab, setActiveTab] = useState('person');
    const [exporting, setExporting] = useState(false);

    if (!result) {
        return (
            <div className="glass-card" style={{ marginTop: '40px', padding: '40px', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: '16px' }}>
                    No results available. Please perform a lookup first.
                </p>
            </div>
        );
    }

    // Check if result has meaningful data
    const hasData = result?.personInfo || result?.identifiedPersons || result?.relationships || 
                    result?.socialProfiles || result?.webActivity || result?.locationHistory ||
                    result?.associatedAddresses || result?.address || result?.reverseImageMatches;

    if (!hasData && result?.confidence === 0) {
        return (
            <div className="glass-card" style={{ marginTop: '40px', padding: '40px', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: '16px', marginBottom: '16px' }}>
                    No information found for this lookup.
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                    Confidence: {result?.confidence || 0}%
                </p>
            </div>
        );
    }

    const handleExport = async (format: 'md' | 'pdf') => {
        if (!result || !result.id) {
            alert('No result ID available for export');
            return;
        }

        setExporting(true);
        try {
            const response = format === 'md'
                ? await reverseLookupService.exportMd(result.id)
                : await reverseLookupService.exportPdf(result.id);

            const blob = new Blob([response?.data || response], {
                type: format === 'pdf' ? 'application/pdf' : 'text/markdown',
            });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `reverse-lookup-${result.id}.${format}`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error: any) {
            alert(`Export failed: ${error.message}`);
        } finally {
            setExporting(false);
        }
    };

    const tabs = [
        { id: 'person', label: 'Person Info', icon: <User className="w-4 h-4" />, visible: result?.personInfo || result?.identifiedPersons },
        { id: 'addresses', label: 'Addresses', icon: <MapPin className="w-4 h-4" />, visible: result?.locationHistory || result?.associatedAddresses || result?.address },
        { id: 'relationships', label: 'Relationships', icon: <Users className="w-4 h-4" />, visible: result?.relationships },
        { id: 'social', label: 'Social Media', icon: <LinkIcon className="w-4 h-4" />, visible: result?.socialProfiles },
        { id: 'activity', label: 'Web Activity', icon: <Globe className="w-4 h-4" />, visible: result?.webActivity },
        { id: 'timeline', label: 'Timeline', icon: <Clock className="w-4 h-4" />, visible: result?.locationHistory },
    ].filter((tab) => tab.visible);

    // Platform colors for social media
    const getPlatformColor = (platform: string) => {
        const platformLower = platform?.toLowerCase() || '';
        if (platformLower.includes('instagram')) return '#E4405F';
        if (platformLower.includes('twitter') || platformLower.includes('x.com')) return '#1DA1F2';
        if (platformLower.includes('linkedin')) return '#0077B5';
        if (platformLower.includes('facebook')) return '#1877F2';
        if (platformLower.includes('github')) return '#181717';
        if (platformLower.includes('reddit')) return '#FF4500';
        if (platformLower.includes('tiktok')) return '#000000';
        if (platformLower.includes('youtube')) return '#FF0000';
        return 'var(--accent-primary)';
    };

    return (
        <div className="glass-card" style={{ marginTop: '40px', borderRadius: '12px', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ 
                padding: '24px', 
                borderBottom: '1px solid var(--glass-border)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                background: 'var(--bg-card)',
            }}>
                <div>
                    <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)' }}>
                        Lookup Results
                    </h3>
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                        Confidence: <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{result?.confidence || 0}%</span>
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                        onClick={() => handleExport('md')}
                        disabled={exporting || !result?.id}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '10px 16px',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--glass-border)',
                            borderRadius: '8px',
                            color: 'var(--text-secondary)',
                            cursor: exporting || !result?.id ? 'not-allowed' : 'pointer',
                            opacity: exporting || !result?.id ? 0.5 : 1,
                            transition: 'all 0.2s ease',
                            fontSize: '14px',
                            fontWeight: 500,
                        }}
                        onMouseEnter={(e) => {
                            if (!exporting && result?.id) {
                                e.currentTarget.style.borderColor = 'var(--accent-primary)';
                                e.currentTarget.style.color = 'var(--accent-primary)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'var(--glass-border)';
                            e.currentTarget.style.color = 'var(--text-secondary)';
                        }}
                    >
                        <FileText size={16} />
                        <span>Export MD</span>
                    </button>
                    <button
                        onClick={() => handleExport('pdf')}
                        disabled={exporting || !result?.id}
                        className="search-submit"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '10px 16px',
                            fontSize: '14px',
                            fontWeight: 500,
                        }}
                    >
                        <Download size={16} />
                        <span>Export PDF</span>
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ borderBottom: '1px solid var(--glass-border)', background: 'var(--bg-card)' }}>
                <div style={{ display: 'flex', overflowX: 'auto' }}>
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '12px 24px',
                                borderBottom: `2px solid ${activeTab === tab.id ? 'var(--accent-primary)' : 'transparent'}`,
                                background: 'transparent',
                                borderTop: 'none',
                                borderLeft: 'none',
                                borderRight: 'none',
                                color: activeTab === tab.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                fontWeight: activeTab === tab.id ? 600 : 500,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                whiteSpace: 'nowrap',
                                fontSize: '14px',
                            }}
                            onMouseEnter={(e) => {
                                if (activeTab !== tab.id) {
                                    e.currentTarget.style.color = 'var(--text-primary)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (activeTab !== tab.id) {
                                    e.currentTarget.style.color = 'var(--text-secondary)';
                                }
                            }}
                        >
                            {tab.icon}
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab Content */}
            <div style={{ padding: '24px', background: 'var(--bg-card)' }}>
            {activeTab === 'person' && (
                <div className="space-y-4">
                    {result?.personInfo && <PersonInfoCard personInfo={result.personInfo} />}
                    {result?.identifiedPersons && result.identifiedPersons.length > 0 && (
                        <div className="space-y-4">
                            {result.identifiedPersons.map((person: any, idx: number) => (
                                    <div key={idx}>
                                        <h4 className="text-sm font-semibold text-text-secondary mb-2">
                                            Person {idx + 1}
                                        </h4>
                                        <PersonInfoCard personInfo={person.personInfo} />
                                        {person.faceMatch && (
                                            <div className="mt-2 text-sm text-text-secondary">
                                                Face Match Confidence: <span className="text-accent-primary">{person.faceMatch.confidence}%</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'addresses' && (
                    <div className="space-y-4">
                        {result?.locationHistory && result.locationHistory.length > 0 && (
                            <div>
                                <h4 className="text-sm font-semibold text-text-secondary mb-3">Location History</h4>
                                <ul className="space-y-2">
                                    {result.locationHistory.map((location: any, idx: number) => (
                                        <li key={idx} className="p-3 glass-card">
                                            <div className="text-sm text-text-primary">
                                                {location?.address?.fullAddress || JSON.stringify(location?.address || {})}
                                            </div>
                                            {location?.dateRange && (
                                                <div className="text-xs text-text-muted mt-1">
                                                    {location.dateRange.start} - {location.dateRange.end || 'Present'}
                                                </div>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {result?.associatedAddresses && result.associatedAddresses.length > 0 && (
                            <div>
                                <h4 className="text-sm font-semibold text-text-secondary mb-3">Associated Addresses</h4>
                                <ul className="space-y-2">
                                    {result.associatedAddresses.map((addr: any, idx: number) => (
                                        <li key={idx} className="p-3 glass-card text-sm text-text-primary">
                                            {addr?.fullAddress || JSON.stringify(addr || {})}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {result?.address && (
                            <div>
                                <h4 className="text-sm font-semibold text-text-secondary mb-3">Address</h4>
                                <div className="p-3 glass-card text-sm text-text-primary">
                                    {result.address?.fullAddress || JSON.stringify(result.address || {})}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'relationships' && result?.relationships && (
                    <div style={{ display: 'grid', gap: '16px' }}>
                        {result.relationships.map((rel: any, idx: number) => (
                            <div key={idx} className="glass-card" style={{ padding: '20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                                    <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                        {rel?.name || 'Unknown'}
                                    </span>
                                    <span style={{
                                        fontSize: '11px',
                                        padding: '6px 12px',
                                        background: 'rgba(59, 130, 246, 0.2)',
                                        color: 'var(--accent-primary)',
                                        borderRadius: '6px',
                                        fontWeight: 600,
                                        textTransform: 'uppercase',
                                    }}>
                                        {rel?.type || 'unknown'}
                                    </span>
                                </div>
                                {rel?.relationship && (
                                    <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: '1.5' }}>
                                        {rel.relationship}
                                    </div>
                                )}
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                                    Confidence: <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{rel?.confidence || 0}%</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'social' && result?.socialProfiles && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                        {result.socialProfiles.map((profile: any, idx: number) => {
                            const platformColor = getPlatformColor(profile?.platform || '');
                            return (
                                <a
                                    key={idx}
                                    href={profile?.url || '#'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="glass-card"
                                    style={{
                                        padding: '20px',
                                        display: 'block',
                                        textDecoration: 'none',
                                        transition: 'all 0.3s ease',
                                        border: `1px solid var(--glass-border)`,
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.borderColor = platformColor;
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.boxShadow = `0 8px 24px rgba(0, 0, 0, 0.3)`;
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.borderColor = 'var(--glass-border)';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = 'none';
                                    }}
                                >
                                    <div style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'space-between',
                                        marginBottom: '12px',
                                    }}>
                                        <div style={{ 
                                            fontSize: '16px', 
                                            fontWeight: 600, 
                                            color: platformColor,
                                        }}>
                                            {profile?.platform || 'Unknown'}
                                        </div>
                                        {profile?.verified && (
                                            <span style={{
                                                fontSize: '10px',
                                                padding: '4px 8px',
                                                background: 'rgba(59, 130, 246, 0.2)',
                                                color: 'var(--accent-primary)',
                                                borderRadius: '4px',
                                                fontWeight: 600,
                                                textTransform: 'uppercase',
                                            }}>
                                                Verified
                                            </span>
                                        )}
                                    </div>
                                    {profile?.username && (
                                        <div style={{ 
                                            fontSize: '14px', 
                                            color: platformColor,
                                            fontWeight: 500,
                                            marginTop: '8px',
                                        }}>
                                            @{profile.username}
                                        </div>
                                    )}
                                    {profile?.url && (
                                        <div style={{
                                            fontSize: '12px',
                                            color: 'var(--text-muted)',
                                            marginTop: '8px',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                        }}>
                                            {profile.url}
                                        </div>
                                    )}
                                </a>
                            );
                        })}
                    </div>
                )}

                {activeTab === 'activity' && result?.webActivity && (
                    <div style={{ display: 'grid', gap: '16px' }}>
                        {result.webActivity.map((activity: any, idx: number) => (
                            <a
                                key={idx}
                                href={activity?.url || '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="glass-card"
                                style={{
                                    display: 'block',
                                    padding: '20px',
                                    textDecoration: 'none',
                                    transition: 'all 0.3s ease',
                                    border: '1px solid var(--glass-border)',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--accent-primary)';
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.3)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--glass-border)';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = 'none';
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                                    <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                        {activity?.title || 'Unknown'}
                                    </span>
                                    <span style={{
                                        fontSize: '11px',
                                        padding: '6px 12px',
                                        background: 'var(--bg-card)',
                                        border: '1px solid var(--glass-border)',
                                        color: 'var(--text-secondary)',
                                        borderRadius: '6px',
                                        fontWeight: 600,
                                        textTransform: 'uppercase',
                                    }}>
                                        {activity?.type || 'other'}
                                    </span>
                                </div>
                                {activity?.snippet && (
                                    <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: '1.5' }}>
                                        {activity.snippet}
                                    </div>
                                )}
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {activity?.url || ''}
                                </div>
                            </a>
                        ))}
                    </div>
                )}

                {activeTab === 'timeline' && result?.locationHistory && (
                    <div className="relative">
                        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-glass-border"></div>
                        <div className="space-y-4">
                            {result.locationHistory.map((location: any, idx: number) => (
                                <div key={idx} className="relative pl-12">
                                    <div className="absolute left-2 top-2 w-4 h-4 bg-accent-primary rounded-full border-2 border-bg-dark"></div>
                                    <div className="p-4 glass-card">
                                        <div className="text-sm font-medium text-text-primary">
                                            {location?.address?.fullAddress || JSON.stringify(location?.address || {})}
                                        </div>
                                        {location?.dateRange && (
                                            <div className="text-xs text-text-muted mt-1">
                                                {location.dateRange.start} - {location.dateRange.end || 'Present'}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Sources */}
                {result?.sources && result.sources.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-glass-border">
                        <h4 className="text-sm font-semibold text-text-secondary mb-3">Sources</h4>
                        <div className="space-y-2">
                            {result.sources.slice(0, 10).map((source: string, idx: number) => (
                                <a
                                    key={idx}
                                    href={source || '#'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block text-sm text-accent-primary hover:underline truncate"
                                >
                                    {source || 'Unknown source'}
                                </a>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
