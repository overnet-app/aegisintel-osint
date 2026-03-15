import { useState } from 'react';
import { ExternalLink, CheckCircle2, XCircle, AlertCircle, Filter } from 'lucide-react';

interface Source {
  url: string;
  title: string;
  snippet?: string;
  reliability?: 'high' | 'medium' | 'low';
  tool?: string;
  reasoning?: string;
  timestamp?: Date | string;
}

interface SourceListProps {
  sources: Source[];
  factChecks?: Array<{
    claim: string;
    verdict: 'verified' | 'partially_true' | 'unverified' | 'contradicted';
    confidence: number;
    supportingSources?: Array<{ url: string; excerpt: string; reliability: string }>;
  }>;
}

export default function SourceList({ sources, factChecks }: SourceListProps) {
  const [filter, setFilter] = useState<string>('all');
  const [expandedSources, setExpandedSources] = useState<Set<number>>(new Set());

  const toolTypes = ['all', ...Array.from(new Set(sources.map((s) => s.tool || 'unknown')))];
  const reliabilityTypes = ['all', 'high', 'medium', 'low'];

  const filteredSources = sources.filter((source) => {
    if (filter === 'all') return true;
    if (toolTypes.includes(filter)) return source.tool === filter;
    if (reliabilityTypes.includes(filter)) return source.reliability === filter;
    return true;
  });

  const toggleExpand = (index: number) => {
    const newExpanded = new Set(expandedSources);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedSources(newExpanded);
  };

  const getReliabilityIcon = (reliability?: string) => {
    switch (reliability) {
      case 'high':
        return <CheckCircle2 size={14} style={{ color: 'var(--accent-secondary)' }} />;
      case 'medium':
        return <AlertCircle size={14} style={{ color: 'var(--accent-primary)' }} />;
      case 'low':
        return <XCircle size={14} style={{ color: 'var(--accent-danger)' }} />;
      default:
        return <AlertCircle size={14} style={{ color: 'var(--text-muted)' }} />;
    }
  };

  const getReliabilityColor = (reliability?: string) => {
    switch (reliability) {
      case 'high':
        return 'var(--accent-secondary)';
      case 'medium':
        return 'var(--accent-primary)';
      case 'low':
        return 'var(--accent-danger)';
      default:
        return 'var(--text-muted)';
    }
  };

  return (
    <div className="source-list glass" style={{ padding: '20px', borderRadius: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h4 style={{ fontSize: '16px', fontWeight: 600 }}>Sources ({filteredSources.length})</h4>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <Filter size={16} style={{ color: 'var(--text-muted)' }} />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid var(--glass-border)',
              background: 'var(--glass-bg)',
              color: 'var(--text-primary)',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            <option value="all">All Sources</option>
            <optgroup label="By Tool">
              {toolTypes
                .filter((t) => t !== 'all')
                .map((tool) => (
                  <option key={tool} value={tool}>
                    {tool}
                  </option>
                ))}
            </optgroup>
            <optgroup label="By Reliability">
              {reliabilityTypes
                .filter((r) => r !== 'all')
                .map((rel) => (
                  <option key={rel} value={rel}>
                    {rel.charAt(0).toUpperCase() + rel.slice(1)}
                  </option>
                ))}
            </optgroup>
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {filteredSources.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>No sources found</p>
        ) : (
          filteredSources.map((source, idx) => {
            const isExpanded = expandedSources.has(idx);
            const factCheck = factChecks?.find((fc) =>
              fc.supportingSources?.some((s) => s.url === source.url),
            );

            return (
              <div
                key={idx}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '8px',
                  padding: '16px',
                  border: `1px solid ${getReliabilityColor(source.reliability)}20`,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onClick={() => toggleExpand(idx)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '12px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      {getReliabilityIcon(source.reliability)}
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: `${getReliabilityColor(source.reliability)}20`,
                          color: getReliabilityColor(source.reliability),
                          fontWeight: 600,
                          textTransform: 'uppercase',
                        }}
                      >
                        {source.reliability || 'unknown'}
                      </span>
                      {source.tool && (
                        <span
                          style={{
                            fontSize: '11px',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: 'var(--glass-bg)',
                            color: 'var(--text-muted)',
                          }}
                        >
                          {source.tool}
                        </span>
                      )}
                      {factCheck && (
                        <span
                          style={{
                            fontSize: '11px',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background:
                              factCheck.verdict === 'verified'
                                ? 'var(--accent-secondary)20'
                                : factCheck.verdict === 'contradicted'
                                ? 'var(--accent-danger)20'
                                : 'var(--glass-bg)',
                            color:
                              factCheck.verdict === 'verified'
                                ? 'var(--accent-secondary)'
                                : factCheck.verdict === 'contradicted'
                                ? 'var(--accent-danger)'
                                : 'var(--text-muted)',
                            fontWeight: 600,
                          }}
                        >
                          {factCheck.verdict === 'verified' ? '✓ Verified' : factCheck.verdict}
                        </span>
                      )}
                    </div>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        color: 'var(--accent-primary)',
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginBottom: '4px',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.textDecoration = 'underline';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.textDecoration = 'none';
                      }}
                    >
                      {source.title || source.url}
                      <ExternalLink size={12} />
                    </a>
                    {source.snippet && (
                      <p
                        style={{
                          fontSize: '12px',
                          color: 'var(--text-secondary)',
                          marginTop: '4px',
                          lineHeight: '1.5',
                        }}
                      >
                        {isExpanded ? source.snippet : `${source.snippet.substring(0, 150)}...`}
                      </p>
                    )}
                    {source.reasoning && isExpanded && (
                      <div
                        style={{
                          marginTop: '8px',
                          padding: '8px',
                          background: 'rgba(59, 130, 246, 0.1)',
                          borderRadius: '6px',
                          fontSize: '11px',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        <strong>Reason:</strong> {source.reasoning}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
