import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSearchProgress } from '../hooks/useSearchProgress';
import { useNotifications } from '../context/NotificationContext';
import {
    Shield,
    Search,
    Share2,
    History,
    CheckCircle2,
    AlertCircle,
    FileText,
    FileDown,
    Download,
    Loader2,
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import api from '../services/api';
import StreamingAnswer from '../components/research/StreamingAnswer';

const STAGES = [
    { id: 'SCRAPING', label: 'Data Collection', icon: Search, weight: 30 },
    { id: 'AI_ANALYSIS', label: 'AI Intelligence Processing', icon: Shield, weight: 60 },
    { id: 'CORRELATION', label: 'Identity Resolution', icon: Share2, weight: 80 },
    { id: 'REPORT', label: 'Dossier Construction', icon: History, weight: 100 }
];

export default function DeepSearchTracker() {
    const { sessionId } = useParams();
    const navigate = useNavigate();
    const { success, error: notifyError } = useNotifications();
    const { progress } = useSearchProgress(sessionId);
    const [activeStage, setActiveStage] = useState(0);
    const [logs, setLogs] = useState<string[]>([]);
    const [hasNotified, setHasNotified] = useState(false);
    const [socket, setSocket] = useState<Socket | null>(null);
    const [streamingChunks, setStreamingChunks] = useState<any[]>([]);
    const [agentProgress, setAgentProgress] = useState<Record<string, any>>({});
    const [validationResults, setValidationResults] = useState<any>(null);
    const [qualityScores, setQualityScores] = useState<{ quality: number; completeness: number } | null>(null);
    const [citations, setCitations] = useState<any[]>([]);
    const [isExporting, setIsExporting] = useState<'pdf' | 'md' | null>(null);
    const socketRef = useRef<Socket | null>(null);

    // WebSocket connection for OSINT streaming
    useEffect(() => {
        if (!sessionId) return;

        const ws = io(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/events`, {
            transports: ['websocket'],
        });

        ws.on('connect', () => {
            ws.emit('join-job', { jobId: sessionId });
        });

        // Listen for OSINT streaming events
        ws.on('research:stream_chunk', (chunk: any) => {
            setStreamingChunks((prev) => [...prev, chunk]);
            if (chunk.content) {
                setLogs((prev) => [...prev.slice(-9), chunk.content].slice(-10));
            }
        });

        ws.on('research:citation_added', (chunk: any) => {
            if (chunk.citation) {
                setCitations((prev) => [...prev, chunk.citation]);
            }
        });

        ws.on('research:thinking', (chunk: any) => {
            if (chunk.content) {
                setLogs((prev) => [...prev.slice(-9), `[Thinking] ${chunk.content}`].slice(-10));
            }
        });

        ws.on('research:tool_executing', (data: any) => {
            setLogs((prev) => [...prev.slice(-9), `[Tool] ${data.tool}: ${data.query || ''}`].slice(-10));
        });

        ws.on('research:agent_progress', (data: any) => {
            setAgentProgress((prev) => ({
                ...prev,
                [data.agent]: data,
            }));
        });

        ws.on('research:validation_update', (data: any) => {
            setValidationResults(data);
        });

        ws.on('research:quality_update', (data: any) => {
            setQualityScores({
                quality: data.qualityScore || 0,
                completeness: data.completenessScore || 0,
            });
        });

        ws.on('progress', (data: any) => {
            if (data.step) {
                setLogs((prev) => [...prev.slice(-9), data.step].slice(-10));
            }
        });

        socketRef.current = ws;
        setSocket(ws);

        return () => {
            ws.disconnect();
        };
    }, [sessionId]);

    useEffect(() => {
        if (!progress) return;

        // Auto-advance stages based on progress percentage
        const currentWeight = progress.progress || 0;
        const stageIdx = STAGES.findIndex(s => s.weight >= currentWeight);
        if (stageIdx !== -1) setActiveStage(stageIdx);

        if (progress.step && !logs.includes(progress.step)) {
            setLogs(prev => [...prev.slice(-4), progress.step]);
        }

        if (progress.status === 'COMPLETED' || progress.progress === 100) {
            if (!hasNotified) {
                success(
                    'Deep Search Completed',
                    'Intelligence dossier has been generated successfully.',
                    8000,
                    {
                        label: 'View Dossier',
                        onClick: () => navigate(`/dossiers/${progress.dossierId || 'latest'}`),
                    }
                );
                setHasNotified(true);
            }
        }

        if (progress.status === 'FAILED') {
            if (!hasNotified) {
                notifyError(
                    'Deep Search Failed',
                    progress.error || 'An error occurred during deep search.',
                    10000
                );
                setHasNotified(true);
            }
        }
    }, [progress, navigate, logs, hasNotified, success, notifyError]);

    const handleExport = async (format: 'pdf' | 'md') => {
        if (!sessionId) return;

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

    return (
        <div className="tracker-page">
            <div className="tracker-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h2 className="page-title">Deep Intelligence Gathering</h2>
                    <p className="page-subtitle">Ref: {sessionId}</p>
                </div>
                {progress?.status === 'COMPLETED' && (
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
                )}
            </div>

            <div className="tracker-visual">
                <div className="pulse-container">
                    <div className="pulse-core">
                        <Shield size={48} color="var(--accent-primary)" />
                        <div className="pulse-ring"></div>
                        <div className="pulse-ring delay-1"></div>
                    </div>
                </div>

                <div className="tracker-status-box glass-card">
                    <div className="status-label">Current Phase</div>
                    <div className="status-value">{progress?.status || 'Initializing...'}</div>
                    <div className="status-percentage">{progress?.progress || 0}%</div>
                </div>
            </div>

            <div className="stages-container">
                {STAGES.map((stage, idx) => {
                    const isCompleted = activeStage > idx;
                    const isActive = activeStage === idx;
                    const Icon = stage.icon;

                    return (
                        <div key={stage.id} className={`stage-item ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}`}>
                            <div className="stage-icon-wrapper">
                                {isCompleted ? <CheckCircle2 size={24} /> : <Icon size={24} />}
                            </div>
                            <div className="stage-info">
                                <span className="stage-label">{stage.label}</span>
                                <span className="stage-status">
                                    {isCompleted ? 'Finalized' : isActive ? 'Processing...' : 'Pending'}
                                </span>
                                {isActive && (
                                    <div className="stage-sub-status">
                                        {progress?.step || 'Aggregating fragments...'}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Quality Scores */}
            {qualityScores && (
                <div className="glass-card" style={{ padding: '20px', marginBottom: '20px', borderRadius: '12px' }}>
                    <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: 600 }}>Research Quality Metrics</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Quality Score</div>
                            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--accent-primary)' }}>
                                {qualityScores.quality}%
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Completeness Score</div>
                            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--accent-primary)' }}>
                                {qualityScores.completeness}%
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Validation Results */}
            {validationResults && (
                <div className="glass-card" style={{ padding: '20px', marginBottom: '20px', borderRadius: '12px' }}>
                    <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: 600 }}>Validation Results</h3>
                    <div style={{ display: 'grid', gap: '8px', fontSize: '14px' }}>
                        {validationResults.validatedFactsCount !== undefined && (
                            <div>Validated Facts: <strong>{validationResults.validatedFactsCount}</strong></div>
                        )}
                        {validationResults.contradictionsCount !== undefined && (
                            <div>Contradictions: <strong>{validationResults.contradictionsCount}</strong></div>
                        )}
                        {validationResults.fallaciesCount !== undefined && (
                            <div>Logical Fallacies: <strong>{validationResults.fallaciesCount}</strong></div>
                        )}
                    </div>
                </div>
            )}

            {/* Streaming Answer */}
            {streamingChunks.length > 0 && (
                <div className="glass-card" style={{ padding: '20px', marginBottom: '20px', borderRadius: '12px' }}>
                    <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: 600 }}>Real-Time Intelligence Stream</h3>
                    <StreamingAnswer chunks={streamingChunks} />
                </div>
            )}

            {/* Citations */}
            {citations.length > 0 && (
                <div className="glass-card" style={{ padding: '20px', marginBottom: '20px', borderRadius: '12px' }}>
                    <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: 600 }}>Sources Discovered ({citations.length})</h3>
                    <div style={{ display: 'grid', gap: '8px' }}>
                        {citations.slice(0, 10).map((citation: any, idx: number) => (
                            <a
                                key={idx}
                                href={citation.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    padding: '8px 12px',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    borderRadius: '6px',
                                    textDecoration: 'none',
                                    color: 'var(--text-primary)',
                                    fontSize: '13px',
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
                                {citation.title || citation.url}
                            </a>
                        ))}
                    </div>
                </div>
            )}

            <div className="activity-log glass-card mt-8">
                <h3 className="section-title text-sm opacity-60 mb-4 px-2 tracking-widest uppercase">Live Intelligence Stream</h3>
                <div className="log-entries">
                    {logs.map((log, i) => (
                        <div key={i} className="log-entry glass border-0 mb-2 py-2 px-3 rounded flex items-center gap-3">
                            <span className="text-xs font-mono opacity-40">{new Date().toLocaleTimeString()}</span>
                            <span className="text-sm">{log}</span>
                        </div>
                    ))}
                    {logs.length === 0 && (
                        <div className="log-entry glass border-0 mb-2 py-2 px-3 rounded text-sm opacity-40 italic">
                            Waiting for neural grid handshake...
                        </div>
                    )}
                </div>
            </div>

            <div className="tracker-footer">
                <div className="warning-box">
                    <AlertCircle size={16} />
                    <span>Do not close this window. Analysis is being distributed across the Aegis Neural Grid.</span>
                </div>
            </div>
        </div>
    );
}
