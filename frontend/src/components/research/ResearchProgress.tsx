import { Activity, CheckCircle2, Circle, Loader2 } from 'lucide-react';

interface ResearchProgressProps {
  status: 'planning' | 'researching' | 'analyzing' | 'verifying' | 'synthesizing' | 'complete' | 'error';
  currentAgent?: 'architect' | 'scout' | 'quant' | 'logician' | 'thinker';
  qualityScore?: number;
  completenessScore?: number;
  iterationCount?: number;
}

const phases = [
  { id: 'planning', label: 'The Architect', sublabel: 'Strategic Planning', icon: Circle },
  { id: 'researching', label: 'The Scout', sublabel: 'Data Retrieval', icon: Activity },
  { id: 'analyzing', label: 'The Quant', sublabel: 'Financial Analysis', icon: Activity, optional: true },
  { id: 'verifying', label: 'The Logician', sublabel: 'Validation', icon: CheckCircle2 },
  { id: 'synthesizing', label: 'The Thinker', sublabel: 'Synthesis', icon: Activity },
  { id: 'complete', label: 'Complete', sublabel: 'Report Ready', icon: CheckCircle2 },
];

export default function ResearchProgress({
  status,
  currentAgent,
  qualityScore,
  completenessScore,
  iterationCount,
}: ResearchProgressProps) {
  // Map status to phase, handling agent-specific statuses
  let phaseId = status;
  if (currentAgent === 'architect' || status === 'planning') phaseId = 'planning';
  else if (currentAgent === 'scout' || status === 'researching') phaseId = 'researching';
  else if (currentAgent === 'quant' || (status === 'analyzing' && currentAgent !== 'logician')) phaseId = 'analyzing';
  else if (currentAgent === 'logician' || status === 'verifying') phaseId = 'verifying';
  else if (currentAgent === 'thinker' || status === 'synthesizing') phaseId = 'synthesizing';
  else if (status === 'complete') phaseId = 'complete';

  const currentPhaseIndex = phases.findIndex((p) => p.id === phaseId);
  const isComplete = status === 'complete';
  const isError = status === 'error';
  
  // Filter out optional Quant phase if not needed (can be determined from context)
  const visiblePhases = phases.filter((p) => !p.optional || currentAgent === 'quant' || phaseId === 'analyzing');

  return (
    <div className="research-progress glass" style={{ padding: '20px', borderRadius: '12px', marginBottom: '24px' }}>
      <h4 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px' }}>Research Progress</h4>

      {/* Phase Timeline */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', position: 'relative' }}>
        {/* Progress Line */}
        <div
          style={{
            position: 'absolute',
            top: '12px',
            left: '0',
            right: '0',
            height: '2px',
            background: 'var(--glass-border)',
            zIndex: 0,
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '12px',
            left: '0',
            width: `${(currentPhaseIndex / (visiblePhases.length - 1)) * 100}%`,
            height: '2px',
            background: isError ? 'var(--accent-danger)' : 'var(--accent-primary)',
            zIndex: 1,
            transition: 'width 0.3s ease',
          }}
        />

        {visiblePhases.map((phase, idx) => {
          const Icon = phase.icon;
          const isActive = idx <= currentPhaseIndex;
          const isCurrent = idx === currentPhaseIndex && !isComplete && !isError;

          return (
            <div
              key={phase.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                position: 'relative',
                zIndex: 2,
                flex: 1,
              }}
            >
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: isActive
                    ? isError
                      ? 'var(--accent-danger)'
                      : 'var(--accent-primary)'
                    : 'var(--glass-bg)',
                  border: `2px solid ${
                    isActive
                      ? isError
                        ? 'var(--accent-danger)'
                        : 'var(--accent-primary)'
                      : 'var(--glass-border)'
                  }`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '8px',
                }}
              >
                {isCurrent ? (
                  <Loader2 size={14} className="animate-spin" style={{ color: '#0b1120' }} />
                ) : isActive ? (
                  <CheckCircle2 size={14} style={{ color: '#0b1120' }} />
                ) : (
                  <Circle size={14} style={{ color: 'var(--text-muted)' }} />
                )}
              </div>
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    fontSize: '11px',
                    color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                    fontWeight: isCurrent ? 600 : 400,
                  }}
                >
                  {phase.label}
                </div>
                {phase.sublabel && (
                  <div
                    style={{
                      fontSize: '9px',
                      color: isActive ? 'var(--text-muted)' : 'var(--text-muted)',
                      opacity: 0.7,
                      marginTop: '2px',
                    }}
                  >
                    {phase.sublabel}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Quality & Completeness Scores */}
      {(qualityScore !== undefined || completenessScore !== undefined) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
          {qualityScore !== undefined && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Quality Score</span>
                <span style={{ fontSize: '12px', fontWeight: 600 }}>{qualityScore}%</span>
              </div>
              <div
                style={{
                  height: '8px',
                  background: 'var(--glass-bg)',
                  borderRadius: '4px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${qualityScore}%`,
                    background:
                      qualityScore >= 80
                        ? 'var(--accent-secondary)'
                        : qualityScore >= 60
                        ? 'var(--accent-primary)'
                        : 'var(--accent-danger)',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            </div>
          )}

          {completenessScore !== undefined && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Completeness</span>
                <span style={{ fontSize: '12px', fontWeight: 600 }}>{completenessScore}%</span>
              </div>
              <div
                style={{
                  height: '8px',
                  background: 'var(--glass-bg)',
                  borderRadius: '4px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${completenessScore}%`,
                    background:
                      completenessScore >= 80
                        ? 'var(--accent-secondary)'
                        : completenessScore >= 60
                        ? 'var(--accent-primary)'
                        : 'var(--accent-danger)',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Iteration Count */}
      {iterationCount !== undefined && (
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
          Iteration: {iterationCount}
        </div>
      )}
    </div>
  );
}
