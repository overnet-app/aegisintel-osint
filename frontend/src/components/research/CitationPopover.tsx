import { useState } from 'react';
import { ExternalLink, CheckCircle, AlertCircle, Info } from 'lucide-react';

interface CitationPopoverProps {
  citation: {
    id: string;
    text: string;
    source: {
      url: string;
      title: string;
      domain: string;
      snippet: string;
      reliability: 'high' | 'medium' | 'low';
    };
  };
  children: React.ReactNode;
}

export default function CitationPopover({ citation, children }: CitationPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);

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

  const ReliabilityIcon = reliabilityIcons[citation.source.reliability];

  return (
    <span className="citation-wrapper" onMouseEnter={() => setIsOpen(true)} onMouseLeave={() => setIsOpen(false)}>
      <span className="citation-link">{children}</span>
      {isOpen && (
        <div className="citation-popover">
          <div className="citation-popover-header">
            <ReliabilityIcon size={16} style={{ color: reliabilityColors[citation.source.reliability] }} />
            <span className="citation-popover-id">{citation.id}</span>
            <span className="citation-popover-reliability">{citation.source.reliability}</span>
          </div>
          <div className="citation-popover-content">
            <h4 className="citation-popover-title">{citation.source.title}</h4>
            <p className="citation-popover-domain">{citation.source.domain}</p>
            <p className="citation-popover-snippet">{citation.source.snippet}</p>
            <a
              href={citation.source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="citation-popover-link"
            >
              <ExternalLink size={14} />
              View Source
            </a>
          </div>
        </div>
      )}
    </span>
  );
}
