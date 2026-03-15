import { useState } from 'react';
import { FileDown, FileText, Download, Loader2, CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react';
import api from '../../services/api';
import { useNotifications } from '../../context/NotificationContext';

interface OSINTReportViewerProps {
    sessionId: string;
    dossierData?: any;
}

export default function OSINTReportViewer({ sessionId, dossierData }: OSINTReportViewerProps) {
    const { success, error: notifyError } = useNotifications();
    const [isExporting, setIsExporting] = useState<'pdf' | 'md' | null>(null);

    const handleExport = async (format: 'pdf' | 'md') => {
        setIsExporting(format);
        try {
            const response = await api.get(`/search/${sessionId}/export/${format}`, {
                responseType: 'blob',
            });

            const blob = new Blob([response.data]);
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `osint-report-${sessionId}.${format}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            success('Export Successful', `OSINT report exported as ${format.toUpperCase()}`, 3000);
        } catch (error: any) {
            notifyError(
                'Export Failed',
                error.response?.data?.message || 'Failed to export report. Please try again.',
                8000
            );
        } finally {
            setIsExporting(null);
        }
    };

    const content = dossierData?.content || {};
    const researchAgentResults = content.researchAgentResults || {};
    const accuracyScore = content.accuracyScore || {};

    return (
        <div className="osint-report-viewer" style={{ padding: '24px' }}>
            {/* Header with Export Buttons */}
            <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                marginBottom: '32px',
                paddingBottom: '16px',
                borderBottom: '2px solid var(--glass-border)',
            }}>
                <div>
                    <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
                        OSINT Intelligence Report
                    </h2>
                    <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                        Session: {sessionId}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                        onClick={() => handleExport('md')}
                        disabled={isExporting === 'md'}
                        style={{
                            padding: '10px 20px',
                            borderRadius: '8px',
                            border: '1px solid var(--glass-border)',
                            background: isExporting === 'md' ? 'rgba(59, 130, 246, 0.3)' : 'var(--accent-primary)',
                            color: '#0b1120',
                            cursor: isExporting === 'md' ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontWeight: 600,
                            transition: 'all 0.2s ease',
                        }}
                    >
                        {isExporting === 'md' ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : (
                            <FileText size={16} />
                        )}
                        Export MD
                    </button>
                    <button
                        onClick={() => handleExport('pdf')}
                        disabled={isExporting === 'pdf'}
                        style={{
                            padding: '10px 20px',
                            borderRadius: '8px',
                            border: '1px solid var(--glass-border)',
                            background: isExporting === 'pdf' ? 'rgba(59, 130, 246, 0.3)' : 'var(--accent-primary)',
                            color: '#0b1120',
                            cursor: isExporting === 'pdf' ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontWeight: 600,
                            transition: 'all 0.2s ease',
                        }}
                    >
                        {isExporting === 'pdf' ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : (
                            <FileDown size={16} />
                        )}
                        Export PDF
                    </button>
                </div>
            </div>

            {/* Accuracy Score */}
            {accuracyScore.overallScore !== undefined && (
                <div className="glass-card" style={{ padding: '20px', marginBottom: '24px', borderRadius: '12px' }}>
                    <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Info size={18} />
                        Accuracy Assessment
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                        <div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Overall Score</div>
                            <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--accent-primary)' }}>
                                {accuracyScore.overallScore}%
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                Confidence: {accuracyScore.confidence || 'medium'}
                            </div>
                        </div>
                        {accuracyScore.breakdown && (
                            <>
                                <div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Multi-Agent Consensus</div>
                                    <div style={{ fontSize: '20px', fontWeight: 600 }}>
                                        {accuracyScore.breakdown.multiAgentConsensus}%
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Source Reliability</div>
                                    <div style={{ fontSize: '20px', fontWeight: 600 }}>
                                        {accuracyScore.breakdown.sourceReliability}%
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Cross-Platform Verification</div>
                                    <div style={{ fontSize: '20px', fontWeight: 600 }}>
                                        {accuracyScore.breakdown.crossPlatformVerification}%
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Research Agent Results */}
            {researchAgentResults.logicianVerdict && (
                <div className="glass-card" style={{ padding: '20px', marginBottom: '24px', borderRadius: '12px' }}>
                    <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: 600 }}>Validation Results</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                        <div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Validated Facts</div>
                            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--accent-primary)' }}>
                                {researchAgentResults.logicianVerdict.validatedFactsCount || 0}
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Contradictions</div>
                            <div style={{ fontSize: '24px', fontWeight: 700, color: researchAgentResults.logicianVerdict.contradictionsCount > 0 ? '#ef4444' : 'var(--accent-primary)' }}>
                                {researchAgentResults.logicianVerdict.contradictionsCount || 0}
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Quality Score</div>
                            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--accent-primary)' }}>
                                {researchAgentResults.logicianVerdict.qualityScore || 0}%
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Fact-Checking Results */}
            {researchAgentResults.factCheckResults && researchAgentResults.factCheckResults.length > 0 && (
                <div className="glass-card" style={{ padding: '20px', marginBottom: '24px', borderRadius: '12px' }}>
                    <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: 600 }}>Fact-Checking Results</h3>
                    <div style={{ display: 'grid', gap: '12px' }}>
                        {researchAgentResults.factCheckResults.slice(0, 10).map((result: any, idx: number) => (
                            <div
                                key={idx}
                                style={{
                                    padding: '12px',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    borderRadius: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                }}
                            >
                                {result.verdict === 'verified' ? (
                                    <CheckCircle2 size={20} color="#10b981" />
                                ) : result.verdict === 'contradicted' ? (
                                    <XCircle size={20} color="#ef4444" />
                                ) : (
                                    <AlertTriangle size={20} color="#f59e0b" />
                                )}
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>
                                        {result.claim}
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                        Verdict: <strong>{result.verdict}</strong> • Confidence: {result.confidence}%
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Profile Verification */}
            {content.profileVerification && content.profileVerification.length > 0 && (
                <div className="glass-card" style={{ padding: '20px', marginBottom: '24px', borderRadius: '12px' }}>
                    <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: 600 }}>Profile Verification</h3>
                    <div style={{ display: 'grid', gap: '12px' }}>
                        {content.profileVerification.map((profile: any, idx: number) => (
                            <div
                                key={idx}
                                style={{
                                    padding: '16px',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    borderRadius: '8px',
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <div>
                                        <div style={{ fontSize: '16px', fontWeight: 600 }}>
                                            {profile.platform} / {profile.username}
                                        </div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                            Authenticity: {profile.authenticityScore}% • Consistency: {profile.consistencyScore}%
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        {profile.isVerified && (
                                            <span style={{ padding: '4px 8px', background: '#10b981', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                                                VERIFIED
                                            </span>
                                        )}
                                        {profile.isBot && (
                                            <span style={{ padding: '4px 8px', background: '#ef4444', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                                                BOT
                                            </span>
                                        )}
                                        {profile.isImpersonation && (
                                            <span style={{ padding: '4px 8px', background: '#f59e0b', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                                                IMPERSONATION
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {profile.redFlags && profile.redFlags.length > 0 && (
                                    <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--glass-border)' }}>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Red Flags:</div>
                                        {profile.redFlags.map((flag: any, flagIdx: number) => (
                                            <div key={flagIdx} style={{ fontSize: '12px', color: flag.severity === 'high' ? '#ef4444' : '#f59e0b' }}>
                                                • {flag.description}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Summary */}
            {content.summary && (
                <div className="glass-card" style={{ padding: '20px', marginBottom: '24px', borderRadius: '12px' }}>
                    <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: 600 }}>Executive Summary</h3>
                    <p style={{ fontSize: '14px', lineHeight: '1.7', color: 'var(--text-secondary)' }}>
                        {content.summary}
                    </p>
                </div>
            )}

            {/* Risk Assessment */}
            {content.riskAssessment && (
                <div className="glass-card" style={{ padding: '20px', marginBottom: '24px', borderRadius: '12px' }}>
                    <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: 600 }}>Risk Assessment</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 600 }}>Risk Level:</span>
                        <span
                            style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                background:
                                    content.riskAssessment.riskLevel === 'HIGH' || content.riskAssessment.riskLevel === 'CRITICAL'
                                        ? 'rgba(239, 68, 68, 0.2)'
                                        : content.riskAssessment.riskLevel === 'MEDIUM'
                                        ? 'rgba(245, 158, 11, 0.2)'
                                        : 'rgba(16, 185, 129, 0.2)',
                                color:
                                    content.riskAssessment.riskLevel === 'HIGH' || content.riskAssessment.riskLevel === 'CRITICAL'
                                        ? '#ef4444'
                                        : content.riskAssessment.riskLevel === 'MEDIUM'
                                        ? '#f59e0b'
                                        : '#10b981',
                            }}
                        >
                            {content.riskAssessment.riskLevel || 'UNKNOWN'}
                        </span>
                    </div>
                    {content.riskAssessment.factors && content.riskAssessment.factors.length > 0 && (
                        <div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>Risk Factors:</div>
                            <ul style={{ margin: 0, paddingLeft: '20px' }}>
                                {content.riskAssessment.factors.map((factor: string, idx: number) => (
                                    <li key={idx} style={{ fontSize: '14px', marginBottom: '4px' }}>
                                        {factor}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
