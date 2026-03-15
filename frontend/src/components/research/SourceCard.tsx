import { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, CheckCircle, AlertCircle, Info } from 'lucide-react';

interface SourceCardProps {
  source: {
    url: string;
    title: string;
    domain: string;
    snippet: string;
    reliability: 'high' | 'medium' | 'low';
  };
}

export default function SourceCard({ source }: SourceCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const reliabilityColors = {
    high: 'var(--accent-secondary)',
    medium: 'var(--accent-warning)',
    low: 'var(--accent-danger)',
  };

  const reliabilityIcons = {
    high: CheckCircle,
    medium: Info,
    low: AlertCircle,
  };

  const ReliabilityIcon = reliabilityIcons[source.reliability];

  return (
    <div className="source-card glass">
      <div className="source-card-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="source-card-title-row">
          <ReliabilityIcon size={18} style={{ color: reliabilityColors[source.reliability] }} />
          <h4 className="source-card-title">{source.title}</h4>
        </div>
        <div className="source-card-actions">
          <span className="source-card-reliability">{source.reliability}</span>
          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
      </div>
      {isExpanded && (
        <div className="source-card-content">
          <p className="source-card-domain">{source.domain}</p>
          <p className="source-card-snippet">{source.snippet}</p>
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="source-card-link"
          >
            <ExternalLink size={14} />
            Open Source
          </a>
        </div>
      )}
    </div>
  );
}
