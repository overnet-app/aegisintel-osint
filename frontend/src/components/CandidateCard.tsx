import { Github, Instagram, Linkedin, Twitter, ExternalLink, ShieldCheck, MapPin, Briefcase, Code, Music, Palette, Building, GraduationCap } from 'lucide-react';

interface CandidateCardProps {
    candidate: any;
    onSelect: (candidate: any) => void;
    isSelecting: boolean;
}

export default function CandidateCard({ candidate, onSelect, isSelecting }: CandidateCardProps) {
    const getIcon = (source: string) => {
        switch (source.toLowerCase()) {
            case 'instagram': return <Instagram size={16} />;
            case 'x':
            case 'twitter': return <Twitter size={16} />;
            case 'linkedin': return <Linkedin size={16} />;
            case 'github': return <Github size={16} />;
            default: return <ExternalLink size={16} />;
        }
    };

    const getDisplayName = (source: string) => {
        if (source.toLowerCase() === 'twitter' || source.toLowerCase() === 'x') return 'X';
        return source.charAt(0).toUpperCase() + source.slice(1);
    };

    const getPersonaIcon = (personaType?: string) => {
        switch (personaType?.toLowerCase()) {
            case 'developer': return <Code size={14} />;
            case 'musician': return <Music size={14} />;
            case 'artist': return <Palette size={14} />;
            case 'business': return <Building size={14} />;
            case 'academic': return <GraduationCap size={14} />;
            default: return <Briefcase size={14} />;
        }
    };

    const getPersonaLabel = (personaType?: string) => {
        switch (personaType?.toLowerCase()) {
            case 'developer': return 'Developer';
            case 'musician': return 'Musician';
            case 'artist': return 'Artist';
            case 'business': return 'Business';
            case 'academic': return 'Academic';
            default: return 'Professional';
        }
    };

    const persona = candidate.data?.persona;
    const location = persona?.location?.country || candidate.data?.location || null;
    const profession = persona?.profession || candidate.data?.professionKeywords?.[0] || null;
    const interests = persona?.interests || candidate.data?.hashtags || [];

    return (
        <div className="glass-card candidate-card">
            <div className="card-header">
                <div className="source-tag">
                    {getIcon(candidate.source)}
                    <span>{getDisplayName(candidate.source)}</span>
                </div>
                <div className="match-score">
                    {persona?.confidence ? (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {persona.confidence}% Confidence
                        </span>
                    ) : (
                        <span>{Math.round(candidate.confidence * 100)}% Match</span>
                    )}
                </div>
            </div>

            <div className="card-body">
                <div className="candidate-avatar">
                    {candidate.avatar ? (
                        <img 
                            src={candidate.avatar} 
                            alt={candidate.username}
                            onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                                const placeholder = (e.target as HTMLImageElement).nextElementSibling as HTMLElement;
                                if (!placeholder || !placeholder.classList.contains('avatar-placeholder')) {
                                    const newPlaceholder = document.createElement('div');
                                    newPlaceholder.className = 'avatar-placeholder';
                                    newPlaceholder.textContent = candidate.username?.[0]?.toUpperCase() || candidate.fullName?.[0]?.toUpperCase() || 'U';
                                    (e.target as HTMLImageElement).parentElement?.appendChild(newPlaceholder);
                                }
                            }}
                        />
                    ) : (
                        <div className="avatar-placeholder">{candidate.username?.[0]?.toUpperCase() || candidate.fullName?.[0]?.toUpperCase() || 'U'}</div>
                    )}
                </div>

                <div className="candidate-info">
                    <h4 className="candidate-name">{candidate.fullName || candidate.username}</h4>
                    <span className="candidate-handle">@{candidate.username}</span>
                    
                    {/* Persona Badges */}
                    <div style={{ 
                        display: 'flex', 
                        flexWrap: 'wrap', 
                        gap: '6px', 
                        marginTop: '8px',
                        marginBottom: '8px'
                    }}>
                        {persona?.personaType && (
                            <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 8px',
                                background: 'rgba(59, 130, 246, 0.2)',
                                border: '1px solid rgba(59, 130, 246, 0.3)',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 600,
                                color: 'var(--accent-primary)'
                            }}>
                                {getPersonaIcon(persona.personaType)}
                                {getPersonaLabel(persona.personaType)}
                            </span>
                        )}
                        {location && (
                            <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 8px',
                                background: 'rgba(34, 197, 94, 0.2)',
                                border: '1px solid rgba(34, 197, 94, 0.3)',
                                borderRadius: '4px',
                                fontSize: '11px',
                                color: '#22c55e'
                            }}>
                                <MapPin size={12} />
                                {location}
                            </span>
                        )}
                        {profession && (
                            <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 8px',
                                background: 'rgba(168, 85, 247, 0.2)',
                                border: '1px solid rgba(168, 85, 247, 0.3)',
                                borderRadius: '4px',
                                fontSize: '11px',
                                color: '#a855f7'
                            }}>
                                <Briefcase size={12} />
                                {profession}
                            </span>
                        )}
                    </div>

                    {/* Interests/Tags */}
                    {interests.length > 0 && (
                        <div style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '4px',
                            marginTop: '6px',
                            marginBottom: '8px'
                        }}>
                            {interests.slice(0, 5).map((interest: string, idx: number) => (
                                <span key={idx} style={{
                                    padding: '2px 6px',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    borderRadius: '3px',
                                    fontSize: '10px',
                                    color: 'var(--text-muted)'
                                }}>
                                    {interest}
                                </span>
                            ))}
                        </div>
                    )}

                    <p className="candidate-bio">{candidate.bio || 'No bio available'}</p>
                    
                    {/* Stats */}
                    {candidate.data?.stats && (
                        <div className="candidate-stats" style={{ 
                            display: 'flex', 
                            gap: '12px', 
                            marginTop: '8px', 
                            fontSize: '12px',
                            color: 'var(--text-muted)'
                        }}>
                            {candidate.data.stats.followers && (
                                <span><strong>{candidate.data.stats.followers}</strong> followers</span>
                            )}
                            {candidate.data.stats.following && (
                                <span><strong>{candidate.data.stats.following}</strong> following</span>
                            )}
                            {candidate.data.stats.posts && (
                                <span><strong>{candidate.data.stats.posts}</strong> posts</span>
                            )}
                        </div>
                    )}
                    
                    {/* Recent Post Preview */}
                    {candidate.data?.recentPost && (
                        <div className="recent-post-preview" style={{
                            marginTop: '12px',
                            padding: '8px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            borderRadius: '6px',
                            fontSize: '12px'
                        }}>
                            {candidate.data.recentPost.imageUrl && (
                                <img 
                                    src={candidate.data.recentPost.imageUrl} 
                                    alt="Recent post"
                                    style={{
                                        width: '100%',
                                        maxHeight: '120px',
                                        objectFit: 'cover',
                                        borderRadius: '4px',
                                        marginBottom: '6px'
                                    }}
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                />
                            )}
                            {candidate.data.recentPost.text && (
                                <p style={{ 
                                    margin: 0, 
                                    color: 'var(--text-secondary)',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical'
                                }}>
                                    {candidate.data.recentPost.text}
                                </p>
                            )}
                            {candidate.data.recentPost.caption && (
                                <p style={{ 
                                    margin: 0, 
                                    color: 'var(--text-secondary)',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical'
                                }}>
                                    {candidate.data.recentPost.caption}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="card-footer">
                <button
                    className="select-btn"
                    onClick={() => onSelect(candidate)}
                    disabled={isSelecting}
                >
                    {isSelecting ? 'Initializing...' : (
                        <>
                            <ShieldCheck size={16} />
                            <span>Deep Analysis</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
