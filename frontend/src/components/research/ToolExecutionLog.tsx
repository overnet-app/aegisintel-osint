import { useState } from 'react';
import { ChevronDown, ChevronUp, Clock, Zap } from 'lucide-react';

interface ToolExecution {
  step?: number;
  tool: string;
  query?: string;
  result?: string;
  error?: string;
  timestamp?: Date | string;
}

interface ToolExecutionLogProps {
  executions: ToolExecution[];
}

const toolIcons: Record<string, string> = {
  web_search: '🔍',
  finance: '💰',
  wikipedia: '📚',
  document: '📄',
  calculator: '🧮',
};

export default function ToolExecutionLog({ executions }: ToolExecutionLogProps) {
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

  const toggleExpand = (index: number) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedItems(newExpanded);
  };

  return (
    <div className="tool-execution-log glass" style={{ padding: '20px', borderRadius: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
        <Zap size={18} style={{ color: 'var(--accent-primary)' }} />
        <h4 style={{ fontSize: '16px', fontWeight: 600 }}>Tool Execution Log ({executions.length})</h4>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {executions.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
            No tool executions yet
          </p>
        ) : (
          executions.map((execution, idx) => {
            const isExpanded = expandedItems.has(idx);
            const icon = toolIcons[execution.tool] || '⚙️';

            return (
              <div
                key={idx}
                style={{
                  background: execution.error
                    ? 'rgba(239, 68, 68, 0.1)'
                    : 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '8px',
                  padding: '16px',
                  border: `1px solid ${
                    execution.error ? 'var(--accent-danger)40' : 'var(--glass-border)'
                  }`,
                  transition: 'all 0.2s ease',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'start',
                    cursor: 'pointer',
                  }}
                  onClick={() => toggleExpand(idx)}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '18px' }}>{icon}</span>
                      <span style={{ fontSize: '14px', fontWeight: 600 }}>{execution.tool}</span>
                      {execution.step && (
                        <span
                          style={{
                            fontSize: '11px',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: 'var(--glass-bg)',
                            color: 'var(--text-muted)',
                          }}
                        >
                          Step {execution.step}
                        </span>
                      )}
                      {execution.error && (
                        <span
                          style={{
                            fontSize: '11px',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: 'var(--accent-danger)20',
                            color: 'var(--accent-danger)',
                            fontWeight: 600,
                          }}
                        >
                          Error
                        </span>
                      )}
                    </div>
                    {execution.query && (
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                        <strong>Query:</strong> {execution.query}
                      </p>
                    )}
                    {execution.result && (
                      <p
                        style={{
                          fontSize: '12px',
                          color: 'var(--text-secondary)',
                          marginTop: '8px',
                          lineHeight: '1.5',
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {isExpanded
                          ? execution.result
                          : `${execution.result.substring(0, 200)}${execution.result.length > 200 ? '...' : ''}`}
                      </p>
                    )}
                    {execution.error && (
                      <p
                        style={{
                          fontSize: '12px',
                          color: 'var(--accent-danger)',
                          marginTop: '8px',
                          padding: '8px',
                          background: 'rgba(239, 68, 68, 0.1)',
                          borderRadius: '6px',
                        }}
                      >
                        <strong>Error:</strong> {execution.error}
                      </p>
                    )}
                  </div>
                  {execution.result && execution.result.length > 200 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpand(idx);
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  )}
                </div>
                {execution.timestamp && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      marginTop: '8px',
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                    }}
                  >
                    <Clock size={12} />
                    {new Date(execution.timestamp).toLocaleTimeString()}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
