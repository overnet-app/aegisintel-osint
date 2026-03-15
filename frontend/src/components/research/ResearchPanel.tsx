import { useState, useEffect } from 'react';
import { Loader2, FileText, FileDown, ChevronDown, ChevronUp, Search as SearchIcon } from 'lucide-react';
import { researchService } from '../../services/api';
import { io, Socket } from 'socket.io-client';
import { useNotifications } from '../../context/NotificationContext';
import ResearchProgress from './ResearchProgress';
import SourceList from './SourceList';
import ToolExecutionLog from './ToolExecutionLog';
import StreamingAnswer from './StreamingAnswer';
import FollowUpQuestions from './FollowUpQuestions';
import StockChart from './charts/StockChart';
import ComparisonChart from './charts/ComparisonChart';
import SentimentChart from './charts/SentimentChart';
import PredictionChart from './charts/PredictionChart';
import StatisticsTable from './charts/StatisticsTable';
import SentimentIndicator from './SentimentIndicator';
import PredictionCard from './PredictionCard';

interface ResearchPanelProps {
  query: string;
  onComplete?: (sessionId: string) => void;
  autoStart?: boolean; // If false, wait for manual start
}

export default function ResearchPanel({ query, onComplete, autoStart = true }: ResearchPanelProps) {
  const { success, error: notifyError } = useNotifications();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('idle'); // Changed from 'planning' to 'idle'
  const [currentAgent, setCurrentAgent] = useState<'architect' | 'scout' | 'quant' | 'logician' | 'thinker' | undefined>(undefined);
  const [plan, setPlan] = useState<any>(null);
  const [findings, setFindings] = useState<any[]>([]);
  const [analysis, setAnalysis] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [modelInfo, setModelInfo] = useState<{ provider?: string; model?: string } | null>(null);
  const [sources, setSources] = useState<any[]>([]);
  const [toolExecutions, setToolExecutions] = useState<any[]>([]);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['progress', 'plan']));
  const [streamingChunks, setStreamingChunks] = useState<any[]>([]);
  const [rapidResponse, setRapidResponse] = useState<any>(null);
  const [followUpQuestions, setFollowUpQuestions] = useState<any[]>([]);

  const startResearch = async () => {
    if (!query) return;
    
    try {
      setStatus('planning');
      // Use user's research model settings (no override)
      const response = await researchService.start(query);
      setSessionId(response.data.id);
      
      // Connect to WebSocket
      const ws = io(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/events`, {
        transports: ['websocket'],
      });

      ws.on('connect', () => {
        ws.emit('join-job', { jobId: response.data.id });
      });

      // Listen for streaming events
      ws.on('research:stream_chunk', (chunk: any) => {
        setStreamingChunks((prev) => [...prev, chunk]);
      });

      ws.on('research:citation_added', (chunk: any) => {
        setStreamingChunks((prev) => [...prev, chunk]);
      });

      ws.on('research:rapid_response', (data: any) => {
        setRapidResponse(data.response);
        if (data.response?.citations) {
          setStreamingChunks((prev) => [
            ...prev,
            ...data.response.citations.map((cit: any) => ({
              type: 'citation',
              citation: cit,
            })),
          ]);
        }
      });

      ws.on('research:follow_ups', (data: any) => {
        setFollowUpQuestions(data.questions || []);
      });

      ws.on('progress', (data: any) => {
        switch (data.type) {
          case 'research:session_started':
            if (data.model) {
              setModelInfo(data.model);
            }
            break;
          case 'research:architect_planning':
            setStatus('planning');
            setCurrentAgent('architect');
            break;
          case 'research:architect_complete':
            setPlan(data.plan);
            setStatus('researching');
            setCurrentAgent('scout');
            break;
          case 'research:scout_searching':
            setStatus('researching');
            setCurrentAgent('scout');
            break;
          case 'research:scout_complete':
            // Scout findings are tracked via individual tool_executed events
            // findingsCount is just a number for display purposes
            if (data.plan?.requiresQuant) {
              setStatus('analyzing');
              setCurrentAgent('quant');
            } else {
              setStatus('verifying');
              setCurrentAgent('logician');
            }
            break;
          case 'research:quant_analyzing':
            setStatus('analyzing');
            setCurrentAgent('quant');
            break;
          case 'research:quant_complete':
            setAnalysis((prev: any) => ({ ...prev, quantAnalysis: data.analysis }));
            setStatus('verifying');
            setCurrentAgent('logician');
            break;
          case 'research:logician_validating':
            setStatus('verifying');
            setCurrentAgent('logician');
            break;
          case 'research:logician_complete':
            setAnalysis((prev: any) => ({ ...prev, logicianVerdict: data.verdict }));
            setStatus('synthesizing');
            setCurrentAgent('thinker');
            break;
          case 'research:thinker_synthesizing':
            setStatus('synthesizing');
            setCurrentAgent('thinker');
            break;
          case 'research:thinker_complete':
            setResult((prev: any) => ({ ...prev, thinkerReport: data.report }));
            break;
          case 'research:tool_executed':
            setFindings((prev) => [...prev, data]);
            setToolExecutions((prev) => [
              ...prev,
              {
                step: data.step,
                tool: data.tool,
                query: data.query,
                result: data.fullResult || data.result,
                timestamp: new Date(),
              },
            ]);
            break;
          case 'research:analysis_update':
            setAnalysis((prev: any) => ({ ...prev, ...data.analysis }));
            break;
          case 'research:complete':
            setResult(data.result);
            setStatus('complete');
            setCurrentAgent(undefined);
            if (data.result?.sources) {
              setSources(data.result.sources);
            } else if (data.sources) {
              setSources(data.sources);
            } else if (response.data.id) {
              // Fallback: fetch sources if not in result
              researchService.getSources(response.data.id).then((res) => {
                setSources(res.data.sources || []);
              }).catch(console.error);
            }
            if (data.toolExecutions) {
              setToolExecutions(data.toolExecutions);
            }
            // Show success notification
            success(
              'Deep Research Completed',
              `Research on "${query}" has been completed successfully.`,
              8000
            );
            if (onComplete) {
              onComplete(response.data.id);
            }
            break;
          case 'research:planning':
            setStatus('planning');
            setCurrentAgent('architect');
            break;
          case 'research:verifying':
            setStatus('verifying');
            setCurrentAgent('logician');
            break;
          case 'research:error':
            setStatus('error');
            setCurrentAgent(undefined);
            console.error('Research error:', data.error, data.details);
            // Show error notification
            notifyError(
              'Research Failed',
              data.error || 'An error occurred during research. Please try again.',
              10000
            );
            break;
        }
      });

      setSocket(ws);
    } catch (error) {
      console.error('Failed to start research:', error);
      setStatus('idle');
    }
  };

  useEffect(() => {
    if (!query) {
      setSessionId(null);
      setStatus('idle');
      setPlan(null);
      setFindings([]);
      setAnalysis(null);
      setResult(null);
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    // Only auto-start if autoStart is true
    if (autoStart) {
      startResearch();
    }

    return () => {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
    };
  }, [query, autoStart]);

  // Manual start function
  const handleStart = () => {
    if (!query) return;
    setStatus('planning');
    startResearch();
  };

  const handleExport = async (type: 'md' | 'pdf') => {
    if (!sessionId) return;

    try {
      const response = type === 'md' 
        ? await researchService.exportMd(sessionId)
        : await researchService.exportPdf(sessionId);

      const blob = new Blob([response.data], {
        type: type === 'md' ? 'text/markdown' : 'application/pdf',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `research-${sessionId}.${type}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error(`Failed to export ${type}:`, error);
    }
  };

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  return (
    <div className="research-panel glass" style={{ padding: '24px', borderRadius: '12px', marginTop: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '4px' }}>Deep Research</h3>
          {modelInfo && (
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Using: {modelInfo.provider === 'llamacpp' ? 'Local llama.cpp' : modelInfo.model || 'OpenRouter'}
            </p>
          )}
        </div>
        {status === 'complete' && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => handleExport('md')}
              style={{
                padding: '8px 16px',
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13px',
              }}
            >
              <FileText size={16} />
              Markdown
            </button>
            <button
              onClick={() => handleExport('pdf')}
              style={{
                padding: '8px 16px',
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13px',
              }}
            >
              <FileDown size={16} />
              PDF
            </button>
          </div>
        )}
      </div>

      {status === 'idle' && (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p style={{ marginBottom: '20px', fontSize: '16px', color: 'var(--text-muted)' }}>
            Ready to start deep research on: <strong>{query}</strong>
          </p>
          <button
            onClick={handleStart}
            style={{
              padding: '12px 32px',
              background: 'var(--accent-primary)',
              border: 'none',
              borderRadius: '8px',
              color: '#0b1120',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              margin: '0 auto',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.9';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
          >
            <SearchIcon size={18} />
            Start Deep Research
          </button>
        </div>
      )}

      {status === 'planning' && (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Loader2 className="animate-spin" size={32} style={{ margin: '0 auto 16px' }} />
          <p>Creating research plan...</p>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
            This may take up to 60 seconds
          </p>
        </div>
      )}

      {status === 'error' && (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p style={{ color: '#ef4444', marginBottom: '16px' }}>Research failed</p>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
            There was an error during the research process. Please try again.
          </p>
          <button
            onClick={handleStart}
            style={{
              marginTop: '20px',
              padding: '10px 24px',
              background: 'var(--accent-primary)',
              border: 'none',
              borderRadius: '8px',
              color: '#0b1120',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600,
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Streaming Answer (Quick Response) */}
      {(rapidResponse || streamingChunks.length > 0) && (
        <div style={{ marginBottom: '24px' }}>
          <StreamingAnswer
            chunks={streamingChunks}
            citations={rapidResponse?.citations || []}
            sources={rapidResponse?.sources || []}
          />
        </div>
      )}

      {/* Follow-up Questions */}
      {followUpQuestions.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <FollowUpQuestions
            questions={followUpQuestions}
            onQuestionClick={(question) => {
              // TODO: Start new research with the follow-up question
              console.log('Follow-up question clicked:', question);
            }}
          />
        </div>
      )}

      {/* Research Progress */}
      {status !== 'planning' && (
        <div style={{ marginBottom: '24px' }}>
          <button
            onClick={() => toggleSection('progress')}
            style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 600,
            }}
          >
            <span>Progress</span>
            {expandedSections.has('progress') ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          {expandedSections.has('progress') && (
            <ResearchProgress
              status={status as any}
              currentAgent={currentAgent}
              qualityScore={analysis?.qualityScore || analysis?.logicianVerdict?.qualityScore}
              completenessScore={analysis?.completenessScore || analysis?.logicianVerdict?.completenessScore}
              iterationCount={result?.findings?.length || toolExecutions.length}
            />
          )}
        </div>
      )}

      {/* Research Plan */}
      {plan && (
        <div style={{ marginBottom: '24px' }}>
          <button
            onClick={() => toggleSection('plan')}
            style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 600,
            }}
          >
            <span>Research Plan</span>
            {expandedSections.has('plan') ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          {expandedSections.has('plan') && (
            <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '16px', borderRadius: '8px' }}>
              <p><strong>Type:</strong> {plan.queryType}</p>
              <p><strong>Complexity:</strong> {plan.complexity}</p>
              <p><strong>Steps:</strong> {plan.researchStrategy?.length || 0}</p>
              {plan.subQuestions && plan.subQuestions.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  <strong>Sub-Questions:</strong>
                  <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
                    {plan.subQuestions.map((q: any, idx: number) => (
                      <li key={idx} style={{ fontSize: '13px', marginBottom: '4px' }}>
                        {q.question} (Priority: {q.priority})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tool Execution Log */}
      {toolExecutions.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <button
            onClick={() => toggleSection('tools')}
            style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 600,
            }}
          >
            <span>Tool Executions</span>
            {expandedSections.has('tools') ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          {expandedSections.has('tools') && <ToolExecutionLog executions={toolExecutions} />}
        </div>
      )}

      {/* Analysis */}
      {analysis && (
        <div style={{ marginBottom: '24px' }}>
          <button
            onClick={() => toggleSection('analysis')}
            style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 600,
            }}
          >
            <span>Analysis</span>
            {expandedSections.has('analysis') ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          {expandedSections.has('analysis') && (
            <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '16px', borderRadius: '8px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '12px' }}>
                <div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Quality Score</p>
                  <p style={{ fontSize: '20px', fontWeight: 600 }}>{analysis.qualityScore}%</p>
                </div>
                <div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Completeness</p>
                  <p style={{ fontSize: '20px', fontWeight: 600 }}>{analysis.completenessScore}%</p>
                </div>
              </div>
              {analysis.summary && (
                <p style={{ marginTop: '12px', fontSize: '13px', lineHeight: '1.6' }}>{analysis.summary}</p>
              )}
              {analysis.gaps && analysis.gaps.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  <strong style={{ fontSize: '13px' }}>Identified Gaps:</strong>
                  <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
                    {analysis.gaps.slice(0, 5).map((gap: any, idx: number) => (
                      <li key={idx} style={{ fontSize: '12px', marginBottom: '4px' }}>
                        {gap.question} (Importance: {gap.importance}/10)
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sources */}
      {sources.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <button
            onClick={() => toggleSection('sources')}
            style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 600,
            }}
          >
            <span>Sources ({sources.length})</span>
            {expandedSections.has('sources') ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          {expandedSections.has('sources') && (
            <SourceList sources={sources} factChecks={result?.analysis?.factChecks} />
          )}
        </div>
      )}

      {/* Visualizations */}
      {result && result.thinkerReport && result.thinkerReport.visualizations && (
        <div style={{ marginBottom: '24px' }}>
          <button
            onClick={() => toggleSection('visualizations')}
            style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 600,
            }}
          >
            <span>Visualizations</span>
            {expandedSections.has('visualizations') ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          {expandedSections.has('visualizations') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Charts */}
              {result.thinkerReport.visualizations.charts && result.thinkerReport.visualizations.charts.length > 0 && (
                <div>
                  {result.thinkerReport.visualizations.charts.map((chart, idx) => {
                    if (chart.series.length > 1) {
                      return <ComparisonChart key={idx} chartData={chart} />;
                    } else {
                      return <StockChart key={idx} chartData={chart} />;
                    }
                  })}
                </div>
              )}

              {/* Statistics Table */}
              {result.thinkerReport.visualizations.statistics && (
                <StatisticsTable statistics={result.thinkerReport.visualizations.statistics} />
              )}

              {/* Sentiment */}
              {result.thinkerReport.visualizations.sentiment && (
                <div>
                  <SentimentIndicator sentimentData={result.thinkerReport.visualizations.sentiment} />
                  <div style={{ marginTop: '16px' }}>
                    <SentimentChart sentimentData={result.thinkerReport.visualizations.sentiment} />
                  </div>
                </div>
              )}

              {/* Predictions */}
              {result.thinkerReport.visualizations.predictions && analysis?.quantAnalysis?.financialData?.currentPrice && (
                <div>
                  <PredictionCard 
                    predictionData={result.thinkerReport.visualizations.predictions} 
                    currentPrice={analysis.quantAnalysis.financialData.currentPrice}
                  />
                  <div style={{ marginTop: '16px' }}>
                    <PredictionChart 
                      predictionData={result.thinkerReport.visualizations.predictions}
                      currentPrice={analysis.quantAnalysis.financialData.currentPrice}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Final Result */}
      {result && (
        <div>
          <button
            onClick={() => toggleSection('result')}
            style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 600,
            }}
          >
            <span>Final Result</span>
            {expandedSections.has('result') ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          {expandedSections.has('result') && (
            <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '16px', borderRadius: '8px' }}>
              {result.thinkerReport ? (
                <div>
                  <div style={{ marginBottom: '16px' }}>
                    <h4 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Executive Summary</h4>
                    <p style={{ fontSize: '14px', lineHeight: '1.6' }}>{result.thinkerReport.executiveSummary}</p>
                  </div>
                  
                  {result.thinkerReport.detailedFindings && result.thinkerReport.detailedFindings.length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                      <h4 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Detailed Findings</h4>
                      {result.thinkerReport.detailedFindings.map((finding, idx) => (
                        <div key={idx} style={{ marginBottom: '12px', padding: '12px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px' }}>
                          <h5 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>{finding.topic}</h5>
                          <p style={{ fontSize: '13px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{finding.content}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {result.thinkerReport.logicalConclusion && (
                    <div>
                      <h4 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Conclusion</h4>
                      <p style={{ fontSize: '14px', lineHeight: '1.6' }}>{result.thinkerReport.logicalConclusion}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ fontSize: '14px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                  {result.summary || 'Research completed successfully.'}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
