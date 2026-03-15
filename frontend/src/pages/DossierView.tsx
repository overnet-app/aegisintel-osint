import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import {
    User,
    Globe,
    Calendar,
    Activity,
    Share2,
    AlertTriangle,
    Download,
    ExternalLink,
    Clock
} from 'lucide-react';

interface PlatformInfo {
    name: string;
    handle: string;
    link: string;
}

interface Finding {
    type: string;
    content: string;
}

interface DossierViewData {
    id: string;
    subject: string;
    createdAt: string;
    summary: string;
    risk: {
        riskLevel: string;
        explanation: string;
    };
    findings: Finding[];
    platforms: PlatformInfo[];
}

export default function DossierView() {
    const { id } = useParams<{ id: string }>();
    const [dossier, setDossier] = useState<DossierViewData | null>(null);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);

    const handleExportPdf = async () => {
        try {
            setExporting(true);
            const response = await api.get(`/dossiers/${id}/pdf`);
            if (response.data.url) {
                // Open the link to the generated PDF
                window.open(response.data.url, '_blank');
            }
        } catch (error) {
            console.error('Export failed', error);
            alert('Failed to generate PDF report. Please try again.');
        } finally {
            setExporting(false);
        }
    };

    useEffect(() => {
        const fetchDossier = async () => {
            try {
                const response = await api.get(`/dossiers/${id}`);
                const data = response.data;

                // Construct UI-friendly dossier object from database content
                setDossier({
                    id: data.id,
                    subject: data.subject,
                    createdAt: data.createdAt,
                    summary: data.content.summary,
                    risk: data.content.riskAssessment || { riskLevel: 'UNKNOWN', explanation: 'N/A' },
                    findings: [
                        { type: 'AI INSIGHT', content: data.content.textAnalysis?.summary || 'Deep analysis complete.' },
                        { type: 'TEMPORAL', content: data.content.temporal?.insights?.timelineSummary || 'Activity patterns analyzed.' },
                        { type: 'GEOLOCATION', content: data.content.geolocation?.homeLocation ? `Potential home base: ${data.content.geolocation.homeLocation}` : 'Geographic extraction complete.' }
                    ],
                    // Extract platform info from correlation or search results if available
                    platforms: data.content.correlation?.nodes
                        ?.filter((n: any) => n.id.includes('http'))
                        ?.map((n: any) => ({
                            name: (n.id.includes('twitter') || n.id.includes('x.com')) ? 'X' : n.id.includes('instagram') ? 'Instagram' : 'Web',
                            handle: n.id.split('/').pop(),
                            link: n.id
                        })) || []
                });
            } catch (error) {
                console.error('Failed to fetch dossier', error);
            } finally {
                setLoading(false);
            }
        };
        fetchDossier();
    }, [id]);

    if (loading) return <div className="p-8 text-center text-muted">Gathering Intelligence Dossier...</div>;
    if (!dossier) return <div className="p-8 text-center text-danger">Intelligence Dossier not found.</div>;

    return (
        <div className="dossier-view fade-in">
            <div className="dossier-header glass-card">
                <div className="header-subject">
                    <div className="subject-avatar">
                        <div className="avatar-placeholder">{dossier.subject[0].toUpperCase()}</div>
                    </div>
                    <div className="subject-names">
                        <h2>{dossier.subject}</h2>
                        <span className="subject-query">Reference: {dossier.id.substring(0, 8)}</span>
                    </div>
                </div>
                <div className="header-actions">
                    <button
                        className="primary-btn"
                        onClick={handleExportPdf}
                        disabled={exporting}
                    >
                        <Download size={18} />
                        <span>{exporting ? 'Generating...' : 'Export PDF'}</span>
                    </button>
                </div>
            </div>

            <div className="dossier-grid">
                <div className="dossier-main">
                    <section className="glass-card dossier-section">
                        <h3 className="section-title"><User size={18} /><span>Executive Summary</span></h3>
                        <p className="summary-text" style={{ whiteSpace: 'pre-wrap' }}>{dossier.summary}</p>
                    </section>

                    {dossier.platforms.length > 0 && (
                        <section className="glass-card dossier-section">
                            <h3 className="section-title"><Share2 size={18} /><span>Platform Footprint</span></h3>
                            <div className="platform-grid">
                                {dossier.platforms.map((p: PlatformInfo, i: number) => (
                                    <a key={i} href={p.link} target="_blank" rel="noopener noreferrer" className="platform-link glass">
                                        <Globe size={16} />
                                        <div className="p-info">
                                            <span className="p-name">{p.name}</span>
                                            <span className="p-handle">@{p.handle}</span>
                                        </div>
                                        <ExternalLink size={14} className="ml-auto" />
                                    </a>
                                ))}
                            </div>
                        </section>
                    )}

                    <section className="glass-card dossier-section">
                        <h3 className="section-title"><Activity size={18} /><span>Intelligence Fragments</span></h3>
                        <div className="findings-list">
                            {dossier.findings.map((f: Finding, i: number) => (
                                <div key={i} className="finding-item glass">
                                    <div className="f-type">{f.type}</div>
                                    <div className="f-content">{f.content}</div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>

                <div className="dossier-sidebar">
                    <section className="glass-card risk-assessment">
                        <h3 className="section-title"><AlertTriangle size={18} /><span>Risk Profile</span></h3>
                        <div className="risk-visual">
                            <div className="risk-meter">
                                <div className={`meter-fill risk-${dossier.risk.riskLevel.toLowerCase()}`} style={{
                                    width: dossier.risk.riskLevel === 'LOW' ? '25%' :
                                        dossier.risk.riskLevel === 'MEDIUM' ? '50%' :
                                            dossier.risk.riskLevel === 'HIGH' ? '75%' :
                                                dossier.risk.riskLevel === 'CRITICAL' ? '100%' : '10%'
                                }}></div>
                            </div>
                            <div className="risk-value">{dossier.risk.riskLevel}</div>
                        </div>
                        <p className="risk-text mt-4 text-sm opacity-80">{dossier.risk.explanation}</p>
                    </section>

                    <section className="glass-card bio-details">
                        <div className="detail-item">
                            <Clock size={16} />
                            <span>Generated {new Date(dossier.createdAt).toLocaleString()}</span>
                        </div>
                        <div className="detail-item mt-2">
                            <Calendar size={16} />
                            <span>OSINT Scan Complete</span>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
