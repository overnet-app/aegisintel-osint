import { useState, useEffect, useMemo } from 'react';
import { Info, Brain, Search, Calculator, Scale, FileText, Zap, AlertCircle, Lightbulb, Eye, Link2, X, Filter } from 'lucide-react';
import { agentModelService, modelsService } from '../../services/api';

type ModelTier = 'free' | 'paid';

interface AgentConfig {
    provider: 'openrouter' | 'llamacpp';
    tier?: 'free' | 'paid';
    model: string;
}

interface Agent {
    id: string;
    name: string;
    icon: React.ReactNode;
    recommendation: string;
    freeRecommendation?: string;
    paidRecommendation?: string;
    localRecommendation?: string;
}

const AGENTS: Agent[] = [
    {
        id: 'architect',
        name: 'The Architect',
        icon: <Brain size={18} />,
        recommendation: 'Use a model with strong planning and strategic thinking capabilities',
        freeRecommendation: 'Models like GPT-OSS 120B or Gemma 3 27B work well for strategic planning',
        paidRecommendation: 'For complex planning, consider GPT-OSS 120B or DeepSeek R1 for advanced reasoning',
        localRecommendation: 'Any capable reasoning model with good context length',
    },
    {
        id: 'scout',
        name: 'The Scout',
        icon: <Search size={18} />,
        recommendation: 'Use a model good at information retrieval and web search understanding',
        freeRecommendation: 'Fast models like Gemma 3 4B or Qwen3 4B are efficient for search tasks',
        paidRecommendation: 'Larger models provide better understanding of search results',
        localRecommendation: 'Any fast, efficient model for quick searches',
    },
    {
        id: 'quant',
        name: 'The Quant',
        icon: <Calculator size={18} />,
        recommendation: 'Use a model that excels at mathematical calculations and financial analysis',
        freeRecommendation: 'Models with strong math capabilities like DeepSeek R1 or GPT-OSS 120B',
        paidRecommendation: 'DeepSeek R1 Distill LLaMA 70B is excellent for financial calculations',
        localRecommendation: 'Models optimized for mathematical reasoning',
    },
    {
        id: 'logician',
        name: 'The Logician',
        icon: <Scale size={18} />,
        recommendation: 'Use a model with strong logical reasoning and fact-checking abilities',
        freeRecommendation: 'GPT-OSS 120B or DeepSeek R1 are strong for logical reasoning',
        paidRecommendation: 'DeepSeek R1 Distill LLaMA 70B excels at logical validation',
        localRecommendation: 'Models optimized for reasoning and fact-checking',
    },
    {
        id: 'thinker',
        name: 'The Thinker',
        icon: <FileText size={18} />,
        recommendation: 'Use a model with excellent synthesis and narrative writing capabilities',
        freeRecommendation: 'Gemma 3 27B or GPT-OSS 120B are great for report synthesis',
        paidRecommendation: 'Larger models provide better narrative quality and coherence',
        localRecommendation: 'Models with strong language generation capabilities',
    },
    {
        id: 'rapidAnalyst',
        name: 'Rapid Analyst',
        icon: <Zap size={18} />,
        recommendation: 'Use a fast, efficient model for quick responses',
        freeRecommendation: 'Smaller models like Gemma 3 4B or Qwen3 4B for speed',
        paidRecommendation: 'Fast paid models for quick initial responses',
        localRecommendation: 'Fast local models for low-latency responses',
    },
    {
        id: 'critic',
        name: 'The Critic',
        icon: <AlertCircle size={18} />,
        recommendation: 'Use a model with strong analytical and critical thinking skills',
        freeRecommendation: 'Models with analytical capabilities like GPT-OSS 120B',
        paidRecommendation: 'Advanced reasoning models for critical analysis',
        localRecommendation: 'Models with strong analytical capabilities',
    },
    {
        id: 'hypothesis',
        name: 'Hypothesis Generator',
        icon: <Lightbulb size={18} />,
        recommendation: 'Use a model good at generating testable hypotheses and identifying gaps',
        freeRecommendation: 'Creative reasoning models like DeepSeek R1 or GPT-OSS 120B',
        paidRecommendation: 'Advanced models for hypothesis generation',
        localRecommendation: 'Models with creative reasoning capabilities',
    },
    {
        id: 'vision',
        name: 'Vision Agent',
        icon: <Eye size={18} />,
        recommendation: 'Use a multimodal vision model (supports images)',
        freeRecommendation: 'Qwen2.5-VL 7B or Gemma 3 models with vision support',
        paidRecommendation: 'Advanced vision models for image analysis',
        localRecommendation: 'Vision-capable llama.cpp models',
    },
    {
        id: 'citation',
        name: 'Citation Agent',
        icon: <Link2 size={18} />,
        recommendation: 'Use a model with strong citation extraction and verification capabilities',
        freeRecommendation: 'Models with good text understanding like Gemma 3 27B',
        paidRecommendation: 'Advanced models for citation verification',
        localRecommendation: 'Models with strong text analysis capabilities',
    },
];

export default function AgentModelSettings() {
    const [agentConfigs, setAgentConfigs] = useState<Record<string, AgentConfig>>({});
    const [openRouterModels, setOpenRouterModels] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
    const [saveStatus, setSaveStatus] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState<Record<string, string>>({});
    const [filterProvider, setFilterProvider] = useState<Record<string, string>>({});

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [configsResponse, modelsResponse] = await Promise.all([
                    agentModelService.getAgentModelConfigs(),
                    modelsService.getOpenRouterModels(),
                ]);
                
                setAgentConfigs(configsResponse.data.agentModelConfig || {});
                setOpenRouterModels(modelsResponse.data.models || []);
            } catch (error) {
                console.error('Failed to fetch agent model configs', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const updateAgentConfig = async (agentId: string, config: AgentConfig) => {
        try {
            await agentModelService.updateAgentModelConfig(agentId, config);
            setAgentConfigs(prev => ({ ...prev, [agentId]: config }));
            setSaveStatus(`Saved configuration for ${AGENTS.find(a => a.id === agentId)?.name}`);
            setTimeout(() => setSaveStatus(null), 3000);
        } catch (error) {
            console.error('Failed to update agent config', error);
            setSaveStatus('Error saving configuration');
            setTimeout(() => setSaveStatus(null), 3000);
        }
    };

    const getAgentConfig = (agentId: string): AgentConfig => {
        return agentConfigs[agentId] || {
            provider: 'openrouter',
            tier: 'free',
            model: '',
        };
    };

    if (loading) {
        return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading agent configurations...</div>;
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {saveStatus && (
                <div style={{
                    padding: '12px 16px',
                    background: saveStatus.includes('Error') ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                    border: `1px solid ${saveStatus.includes('Error') ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
                    borderRadius: '8px',
                    color: saveStatus.includes('Error') ? 'var(--accent-danger)' : 'var(--accent-secondary)',
                    fontSize: '13px',
                }}>
                    {saveStatus}
                </div>
            )}

            {AGENTS.map((agent) => {
                const config = getAgentConfig(agent.id);
                const isExpanded = expandedAgent === agent.id;
                
                // Get base filtered models
                let agentModels = openRouterModels.filter(m => 
                    agent.id === 'vision' ? m.supportsVision : true
                );
                
                // Apply tier filter
                agentModels = agentModels.filter(m => m.tier === config.tier);
                
                // Apply search filter
                const search = (searchQuery[agent.id] || '').toLowerCase().trim();
                if (search) {
                    agentModels = agentModels.filter(m => 
                        m.name.toLowerCase().includes(search) ||
                        m.provider.toLowerCase().includes(search) ||
                        m.description.toLowerCase().includes(search) ||
                        m.id.toLowerCase().includes(search)
                    );
                }
                
                // Apply provider filter
                const providerFilter = filterProvider[agent.id];
                if (providerFilter && providerFilter !== 'all') {
                    agentModels = agentModels.filter(m => 
                        m.provider.toLowerCase() === providerFilter.toLowerCase()
                    );
                }
                
                const totalModels = openRouterModels.filter(m => 
                    agent.id === 'vision' ? m.supportsVision : true
                ).filter(m => m.tier === config.tier).length;

                return (
                    <div
                        key={agent.id}
                        className="glass-card"
                        style={{
                            padding: '20px',
                            borderRadius: '12px',
                            border: '1px solid var(--glass-border)',
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                cursor: 'pointer',
                                marginBottom: isExpanded ? '16px' : 0,
                            }}
                            onClick={() => setExpandedAgent(isExpanded ? null : agent.id)}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ color: 'var(--accent-primary)' }}>{agent.icon}</div>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '4px' }}>
                                        {agent.name}
                                    </div>
                                    {config.model && (
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                            Current: {config.provider === 'llamacpp' ? 'Local (llama.cpp)' : config.model}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div
                                    style={{
                                        position: 'relative',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <Info
                                        size={16}
                                        style={{ color: 'var(--text-muted)', cursor: 'help' }}
                                        onMouseEnter={(e) => {
                                            const tooltip = document.createElement('div');
                                            tooltip.textContent = config.provider === 'llamacpp' 
                                                ? agent.localRecommendation || agent.recommendation
                                                : config.tier === 'paid'
                                                ? agent.paidRecommendation || agent.recommendation
                                                : agent.freeRecommendation || agent.recommendation;
                                            tooltip.style.cssText = `
                                                position: absolute;
                                                bottom: 100%;
                                                right: 0;
                                                margin-bottom: 8px;
                                                padding: 8px 12px;
                                                background: rgba(0, 0, 0, 0.9);
                                                color: white;
                                                border-radius: 6px;
                                                font-size: 12px;
                                                white-space: nowrap;
                                                z-index: 1000;
                                                pointer-events: none;
                                            `;
                                            e.currentTarget.parentElement?.appendChild(tooltip);
                                        }}
                                        onMouseLeave={(e) => {
                                            const tooltip = e.currentTarget.parentElement?.querySelector('div');
                                            if (tooltip) tooltip.remove();
                                        }}
                                    />
                                </div>
                                <span style={{ fontSize: '20px', color: 'var(--text-muted)' }}>
                                    {isExpanded ? '−' : '+'}
                                </span>
                            </div>
                        </div>

                        {isExpanded && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                                {/* Provider Selection */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Provider
                                    </label>
                                    <div style={{ display: 'inline-flex', borderRadius: '999px', border: '1px solid var(--glass-border)', padding: '3px' }}>
                                        {(['openrouter', 'llamacpp'] as const).map(provider => (
                                            <button
                                                key={provider}
                                                type="button"
                                                onClick={() => updateAgentConfig(agent.id, { ...config, provider })}
                                                style={{
                                                    padding: '6px 16px',
                                                    borderRadius: '999px',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    fontSize: '12px',
                                                    fontWeight: 600,
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.06em',
                                                    background: config.provider === provider ? 'var(--accent-primary)' : 'transparent',
                                                    color: config.provider === provider ? '#0b1120' : 'var(--text-secondary)',
                                                    transition: 'all 0.2s ease',
                                                }}
                                            >
                                                {provider === 'llamacpp' ? 'Local (llama.cpp)' : 'OpenRouter'}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {config.provider === 'openrouter' && (
                                    <>
                                        {/* Tier Selection */}
                                        <div>
                                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                Tier
                                            </label>
                                            <div style={{ display: 'inline-flex', borderRadius: '999px', border: '1px solid var(--glass-border)', padding: '3px' }}>
                                                {(['free', 'paid'] as ModelTier[]).map(tier => (
                                                    <button
                                                        key={tier}
                                                        type="button"
                                                        onClick={() => updateAgentConfig(agent.id, { ...config, tier })}
                                                        style={{
                                                            padding: '6px 16px',
                                                            borderRadius: '999px',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            fontSize: '12px',
                                                            fontWeight: 600,
                                                            textTransform: 'uppercase',
                                                            letterSpacing: '0.06em',
                                                            background: config.tier === tier ? 'var(--accent-primary)' : 'transparent',
                                                            color: config.tier === tier ? '#0b1120' : 'var(--text-secondary)',
                                                            transition: 'all 0.2s ease',
                                                        }}
                                                    >
                                                        {tier === 'free' ? 'Free Models' : 'Paid Models'}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Model Selection */}
                                        <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                    Model
                                                </label>
                                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                                    Showing {agentModels.length} of {totalModels}
                                                </span>
                                            </div>
                                            
                                            {/* Search Input */}
                                            <div style={{ position: 'relative', marginBottom: '12px' }}>
                                                <Search 
                                                    size={16} 
                                                    style={{ 
                                                        position: 'absolute', 
                                                        left: '12px', 
                                                        top: '50%', 
                                                        transform: 'translateY(-50%)', 
                                                        color: 'var(--text-muted)',
                                                        pointerEvents: 'none'
                                                    }} 
                                                />
                                                <input
                                                    type="text"
                                                    placeholder="Search models by name, provider, or description..."
                                                    value={searchQuery[agent.id] || ''}
                                                    onChange={(e) => setSearchQuery(prev => ({ ...prev, [agent.id]: e.target.value }))}
                                                    style={{
                                                        width: '100%',
                                                        padding: '10px 12px 10px 36px',
                                                        borderRadius: '8px',
                                                        border: '1px solid var(--glass-border)',
                                                        background: 'rgba(255, 255, 255, 0.03)',
                                                        color: 'var(--text-primary)',
                                                        fontSize: '13px',
                                                        fontFamily: 'inherit',
                                                    }}
                                                />
                                                {(searchQuery[agent.id] || filterProvider[agent.id]) && (
                                                    <button
                                                        onClick={() => {
                                                            setSearchQuery(prev => {
                                                                const next = { ...prev };
                                                                delete next[agent.id];
                                                                return next;
                                                            });
                                                            setFilterProvider(prev => {
                                                                const next = { ...prev };
                                                                delete next[agent.id];
                                                                return next;
                                                            });
                                                        }}
                                                        style={{
                                                            position: 'absolute',
                                                            right: '8px',
                                                            top: '50%',
                                                            transform: 'translateY(-50%)',
                                                            background: 'transparent',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            color: 'var(--text-muted)',
                                                            padding: '4px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                        }}
                                                        title="Clear filters"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                )}
                                            </div>
                                            
                                            {/* Provider Filter */}
                                            {agentModels.length > 0 && (
                                                <div style={{ marginBottom: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                                    <Filter size={14} style={{ color: 'var(--text-muted)' }} />
                                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginRight: '8px' }}>Filter by provider:</span>
                                                    {['all', ...Array.from(new Set(openRouterModels.filter(m => m.tier === config.tier).map(m => m.provider)))].map(provider => (
                                                        <button
                                                            key={provider}
                                                            type="button"
                                                            onClick={() => setFilterProvider(prev => ({ ...prev, [agent.id]: provider === 'all' ? '' : provider }))}
                                                            style={{
                                                                padding: '4px 12px',
                                                                borderRadius: '6px',
                                                                border: '1px solid var(--glass-border)',
                                                                background: (filterProvider[agent.id] || 'all') === provider ? 'var(--accent-primary)' : 'transparent',
                                                                color: (filterProvider[agent.id] || 'all') === provider ? '#0b1120' : 'var(--text-secondary)',
                                                                cursor: 'pointer',
                                                                fontSize: '11px',
                                                                fontWeight: 600,
                                                                transition: 'all 0.2s ease',
                                                            }}
                                                        >
                                                            {provider === 'all' ? 'All' : provider}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                            
                                            {/* Model List */}
                                            <div style={{ display: 'grid', gap: '12px', maxHeight: '300px', overflowY: 'auto' }}>
                                                {agentModels.length === 0 ? (
                                                    <div style={{ 
                                                        padding: '40px 20px', 
                                                        textAlign: 'center', 
                                                        color: 'var(--text-muted)',
                                                        background: 'rgba(255, 255, 255, 0.02)',
                                                        borderRadius: '8px',
                                                        border: '1px dashed var(--glass-border)'
                                                    }}>
                                                        <Search size={24} style={{ marginBottom: '12px', opacity: 0.5 }} />
                                                        <p style={{ fontSize: '13px', margin: 0 }}>
                                                            {searchQuery[agent.id] || filterProvider[agent.id] 
                                                                ? 'No models found matching your search criteria'
                                                                : 'No models available for this tier'}
                                                        </p>
                                                        {(searchQuery[agent.id] || filterProvider[agent.id]) && (
                                                            <button
                                                                onClick={() => {
                                                                    setSearchQuery(prev => {
                                                                        const next = { ...prev };
                                                                        delete next[agent.id];
                                                                        return next;
                                                                    });
                                                                    setFilterProvider(prev => {
                                                                        const next = { ...prev };
                                                                        delete next[agent.id];
                                                                        return next;
                                                                    });
                                                                }}
                                                                style={{
                                                                    marginTop: '12px',
                                                                    padding: '6px 16px',
                                                                    background: 'var(--accent-primary)',
                                                                    color: '#0b1120',
                                                                    border: 'none',
                                                                    borderRadius: '6px',
                                                                    cursor: 'pointer',
                                                                    fontSize: '12px',
                                                                    fontWeight: 600,
                                                                }}
                                                            >
                                                                Clear Filters
                                                            </button>
                                                        )}
                                                    </div>
                                                ) : (
                                                    agentModels.map((model) => {
                                                        const searchLower = (searchQuery[agent.id] || '').toLowerCase();
                                                        const highlightText = (text: string) => {
                                                            if (!searchLower) return text;
                                                            const parts = text.split(new RegExp(`(${searchLower})`, 'gi'));
                                                            return parts.map((part, i) => 
                                                                part.toLowerCase() === searchLower ? (
                                                                    <mark key={i} style={{ background: 'rgba(59, 130, 246, 0.3)', padding: '0 2px', borderRadius: '2px' }}>
                                                                        {part}
                                                                    </mark>
                                                                ) : part
                                                            );
                                                        };
                                                        
                                                        return (
                                                    <div
                                                        key={model.id}
                                                        onClick={() => updateAgentConfig(agent.id, { ...config, model: model.id })}
                                                        style={{
                                                            padding: '16px',
                                                            borderRadius: '8px',
                                                            cursor: 'pointer',
                                                            border: `1px solid ${config.model === model.id ? 'var(--accent-primary)' : 'var(--glass-border)'}`,
                                                            background: config.model === model.id ? 'rgba(59, 130, 246, 0.05)' : 'transparent',
                                                            transition: 'all 0.2s ease',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '12px',
                                                        }}
                                                    >
                                                        <div className={`radio-indicator ${config.model === model.id ? 'checked' : ''}`} style={{
                                                            width: '18px',
                                                            height: '18px',
                                                            borderRadius: '50%',
                                                            border: `2px solid ${config.model === model.id ? 'var(--accent-primary)' : 'var(--text-muted)'}`,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            flexShrink: 0,
                                                        }}>
                                                            {config.model === model.id && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-primary)' }} />}
                                                        </div>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                                <span style={{ fontWeight: 600, fontSize: '14px' }}>{highlightText(model.name)}</span>
                                                                <span style={{ fontSize: '11px', fontWeight: 700, background: '#1e293b', padding: '2px 8px', borderRadius: '4px', color: 'var(--text-muted)' }}>
                                                                    {highlightText(model.provider)}
                                                                </span>
                                                            </div>
                                                            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                                                                {highlightText(model.description)}
                                                            </p>
                                                            {model.contextLength && (
                                                                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                                                                    Context: {model.contextLength.toLocaleString()} tokens
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </div>
                                    </>
                                )}

                                {config.provider === 'llamacpp' && (
                                    <div style={{ padding: '20px', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                                        <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                                            <strong>Local llama.cpp Server</strong><br />
                                            The model will be determined by your llama.cpp server configuration.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
