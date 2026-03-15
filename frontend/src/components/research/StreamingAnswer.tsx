import { useEffect, useRef, useState } from 'react';
import CitationPopover from './CitationPopover';
import SourceCard from './SourceCard';

interface StreamingChunk {
  type: 'text' | 'citation' | 'thinking' | 'tool_call' | 'follow_up';
  content: string;
  citation?: {
    id: string;
    text: string;
    source: {
      url: string;
      title: string;
      domain: string;
      snippet: string;
      reliability: 'high' | 'medium' | 'low';
    };
    position: number;
  };
  metadata?: Record<string, any>;
}

interface StreamingAnswerProps {
  chunks: StreamingChunk[];
  citations: Array<{
    id: string;
    text: string;
    source: {
      url: string;
      title: string;
      domain: string;
      snippet: string;
      reliability: 'high' | 'medium' | 'low';
    };
    position: number;
  }>;
  sources: Array<{
    url: string;
    title: string;
    domain: string;
    snippet: string;
    reliability: 'high' | 'medium' | 'low';
  }>;
}

export default function StreamingAnswer({ chunks, citations, sources }: StreamingAnswerProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [currentCitations, setCurrentCitations] = useState(citations);
  const textEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Process chunks to build displayed text
    let text = '';
    for (const chunk of chunks) {
      if (chunk.type === 'text') {
        text += chunk.content;
      } else if (chunk.type === 'citation' && chunk.citation) {
        // Citations are inserted inline
        const citationId = chunk.citation.id;
        const citationText = chunk.citation.text;
        // Replace citation text with citation marker
        text = text.replace(citationText, `${citationText}${citationId}`);
      }
    }
    setDisplayedText(text);
  }, [chunks]);

  useEffect(() => {
    setCurrentCitations(citations);
  }, [citations]);

  useEffect(() => {
    // Auto-scroll to bottom when new content arrives
    if (textEndRef.current) {
      textEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [displayedText]);

  // Insert citations into text at their positions
  const renderTextWithCitations = () => {
    if (currentCitations.length === 0) {
      return <p>{displayedText}</p>;
    }

    // Sort citations by position
    const sortedCitations = [...currentCitations].sort((a, b) => a.position - b.position);
    
    // Build segments with citations
    const segments: Array<{ text: string; citation?: typeof sortedCitations[0] }> = [];
    let lastPos = 0;

    for (const citation of sortedCitations) {
      if (citation.position > lastPos) {
        segments.push({
          text: displayedText.substring(lastPos, citation.position),
        });
      }
      segments.push({
        text: citation.text,
        citation,
      });
      lastPos = citation.position + citation.text.length;
    }

    // Add remaining text
    if (lastPos < displayedText.length) {
      segments.push({
        text: displayedText.substring(lastPos),
      });
    }

    return (
      <p>
        {segments.map((segment, idx) => {
          if (segment.citation) {
            return (
              <CitationPopover key={idx} citation={segment.citation}>
                <span className="citation-inline">
                  {segment.text}
                  <sup className="citation-marker">{segment.citation.id}</sup>
                </span>
              </CitationPopover>
            );
          }
          return <span key={idx}>{segment.text}</span>;
        })}
      </p>
    );
  };

  return (
    <div className="streaming-answer glass">
      <div className="streaming-answer-content">
        {renderTextWithCitations()}
        <div ref={textEndRef} />
      </div>
      
      {sources.length > 0 && (
        <div className="streaming-answer-sources">
          <h3 className="streaming-answer-sources-title">Sources</h3>
          <div className="streaming-answer-sources-list">
            {sources.map((source, idx) => (
              <SourceCard key={idx} source={source} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
