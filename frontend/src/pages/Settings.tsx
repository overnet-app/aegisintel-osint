import { useEffect, useState, useMemo } from 'react';
import { Shield, Save, Cpu, Lock, Key, Globe, Search as SearchIcon, BookOpen, RefreshCw, Settings as SettingsIcon, X, Filter } from 'lucide-react';
import api from '../services/api';
import { modelsService } from '../services/api';
import AgentModelSettings from '../components/settings/AgentModelSettings';

type ModelTier = 'free' | 'paid';

interface OpenRouterModel {
    id: string;
    name: string;
    provider: string;
    description: string;
    tier: ModelTier;
    contextLength?: number;
    modality?: string;
    supportsVision: boolean;
}

export default function SettingsPage() {
    const [preferredModel, setPreferredModel] = useState('google/gemma-3-4b-it:free');
    const [modelTier, setModelTier] = useState<ModelTier>('free');
    const [researchProvider, setResearchProvider] = useState<'openrouter' | 'llamacpp'>('openrouter');
    const [researchModelTier, setResearchModelTier] = useState<ModelTier>('free');
    const [researchModel, setResearchModel] = useState('google/gemma-3-27b-it');
    const [defaultModel, setDefaultModel] = useState('google/gemma-3-27b-it');
    const [defaultModelSearch, setDefaultModelSearch] = useState('');
    const [defaultModelProviderFilter, setDefaultModelProviderFilter] = useState<string>('all');
    const [credentials, setCredentials] = useState({
        googleVision: '',
        clarifai: '',
        openRouter: '',
    });
    const [enabledServices, setEnabledServices] = useState({
        clarifai: true,
    });
    const [saveStatus, setSaveStatus] = useState<string | null>(null);
    const [openRouterModels, setOpenRouterModels] = useState<OpenRouterModel[]>([]);
    const [modelsLoading, setModelsLoading] = useState(true);
    const [modelsError, setModelsError] = useState<string | null>(null);
    const [preferredModelSearch, setPreferredModelSearch] = useState('');
    const [preferredModelProviderFilter, setPreferredModelProviderFilter] = useState<string>('all');
    const [researchModelSearch, setResearchModelSearch] = useState('');
    const [researchModelProviderFilter, setResearchModelProviderFilter] = useState<string>('all');

    const fetchOpenRouterModels = async () => {
        setModelsLoading(true);
        setModelsError(null);
        try {
            const response = await modelsService.getOpenRouterModels();
            setOpenRouterModels(response.data.models || []);
        } catch (error: any) {
            console.error('Failed to fetch OpenRouter models', error);
            setModelsError(error.response?.data?.message || 'Failed to fetch models. Please check your OpenRouter API key.');
        } finally {
            setModelsLoading(false);
        }
    };

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const response = await api.get('/users/me');
                if (response.data.preferredModel) {
                    setPreferredModel(response.data.preferredModel);
                }
                if (response.data.researchModelProvider) {
                    setResearchProvider(response.data.researchModelProvider);
                }
                if (response.data.researchModelTier) {
                    setResearchModelTier(response.data.researchModelTier);
                }
                if (response.data.researchModel) {
                    setResearchModel(response.data.researchModel);
                }
                if (response.data.defaultModel) {
                    setDefaultModel(response.data.defaultModel);
                }
                if (response.data.thirdPartyKeys) {
                    setCredentials(prev => ({ ...prev, ...response.data.thirdPartyKeys }));
                }
                if (response.data.enabledServices) {
                    setEnabledServices(prev => ({ ...prev, ...response.data.enabledServices }));
                }
            } catch (error) {
                console.error('Failed to fetch user settings', error);
            }
        };
        fetchSettings();
        fetchOpenRouterModels();
    }, []);

    const handleSave = async () => {
        setSaveStatus('Saving...');
        try {
            await Promise.all([
                api.put('/users/settings/model', { model: preferredModel }),
                api.put('/users/settings/research-model', {
                    provider: researchProvider,
                    tier: researchModelTier,
                    model: researchModel,
                }),
                api.put('/users/settings/default-model', { model: defaultModel }),
                api.put('/users/settings/credentials', { keys: credentials }),
                api.put('/users/settings/services', { services: enabledServices }),
            ]);
            setSaveStatus('Settings saved successfully');
            setTimeout(() => setSaveStatus(null), 3000);
        } catch (error) {
            setSaveStatus('Error saving settings');
        }
    };

    const handleCredentialChange = (key: string, value: string) => {
        setCredentials(prev => ({ ...prev, [key]: value }));
    };

    const toggleService = (service: 'clarifai') => {
        setEnabledServices(prev => ({ ...prev, [service]: !prev[service] }));
    };

    return (
        <div className="settings-page fade-in">
            <h2 className="page-title">System Configuration</h2>
            <p className="page-subtitle">Manage your OSINT environment, API keys, and AI model preferences.</p>

            <div className="settings-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: '32px' }}>
                <div className="settings-main">
                    <section className="glass-card" style={{ padding: '32px', marginBottom: '32px' }}>
                        <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '16px', marginBottom: '24px' }}>
                            <Cpu size={20} className="text-blue" />
                            <span>Intelligence Analysis Engine</span>
                        </h3>

                        <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '14px' }}>
                            Select the primary model used for deep intelligence gathering and persona reconstruction.
                            Use <strong>Free</strong> models for initial triage, and switch to <strong>Paid</strong> models only when you explicitly want to spend credits.
                        </p>

                        {/* Free / Paid toggle */}
                        <div style={{ display: 'inline-flex', borderRadius: '999px', border: '1px solid var(--glass-border)', padding: '3px', marginBottom: '20px' }}>
                            {(['free', 'paid'] as ModelTier[]).map(tier => (
                                <button
                                    key={tier}
                                    type="button"
                                    onClick={() => setModelTier(tier)}
                                    style={{
                                        padding: '6px 16px',
                                        borderRadius: '999px',
                                        border: 'none',
                                        cursor: 'pointer',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.06em',
                                        background: modelTier === tier ? 'var(--accent-primary)' : 'transparent',
                                        color: modelTier === tier ? '#0b1120' : 'var(--text-secondary)',
                                        transition: 'all 0.2s ease',
                                    }}
                                >
                                    {tier === 'free' ? 'Free Models' : 'Paid Models'}
                                </button>
                            ))}
                        </div>

                        {modelsLoading ? (
                            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                Loading models from OpenRouter...
                            </div>
                        ) : modelsError ? (
                            <div style={{ padding: '20px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                                <p style={{ color: 'var(--accent-danger)', marginBottom: '12px' }}>{modelsError}</p>
                                <button
                                    onClick={fetchOpenRouterModels}
                                    style={{
                                        padding: '8px 16px',
                                        background: 'var(--accent-primary)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        fontSize: '13px',
                                    }}
                                >
                                    <RefreshCw size={14} />
                                    Retry
                                </button>
                            </div>
                        ) : (
                            <>
                                {/* Search Input */}
                                <div style={{ position: 'relative', marginBottom: '12px' }}>
                                    <SearchIcon 
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
                                        value={preferredModelSearch}
                                        onChange={(e) => setPreferredModelSearch(e.target.value)}
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
                                    {preferredModelSearch && (
                                        <button
                                            onClick={() => setPreferredModelSearch('')}
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
                                            title="Clear search"
                                        >
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>

                                {/* Provider Filter */}
                                {(() => {
                                    const filteredModels = openRouterModels.filter(m => m.tier === modelTier);
                                    const providers = Array.from(new Set(filteredModels.map(m => m.provider)));
                                    const searchLower = preferredModelSearch.toLowerCase().trim();
                                    const searchFiltered = searchLower 
                                        ? filteredModels.filter(m => 
                                            m.name.toLowerCase().includes(searchLower) ||
                                            m.provider.toLowerCase().includes(searchLower) ||
                                            m.description.toLowerCase().includes(searchLower) ||
                                            m.id.toLowerCase().includes(searchLower)
                                          )
                                        : filteredModels;
                                    const providerFiltered = preferredModelProviderFilter === 'all'
                                        ? searchFiltered
                                        : searchFiltered.filter(m => m.provider.toLowerCase() === preferredModelProviderFilter.toLowerCase());
                                    
                                    return (
                                        <>
                                            {providers.length > 0 && (
                                                <div style={{ marginBottom: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                                    <Filter size={14} style={{ color: 'var(--text-muted)' }} />
                                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginRight: '8px' }}>Filter:</span>
                                                    {['all', ...providers].map(provider => (
                                                        <button
                                                            key={provider}
                                                            type="button"
                                                            onClick={() => setPreferredModelProviderFilter(provider)}
                                                            style={{
                                                                padding: '4px 12px',
                                                                borderRadius: '6px',
                                                                border: '1px solid var(--glass-border)',
                                                                background: preferredModelProviderFilter === provider ? 'var(--accent-primary)' : 'transparent',
                                                                color: preferredModelProviderFilter === provider ? '#0b1120' : 'var(--text-secondary)',
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

                                            {/* Result Count */}
                                            <div style={{ marginBottom: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                                                Showing {Math.min(5, providerFiltered.length)} of {providerFiltered.length} models
                                            </div>

                                            {/* Model List with Scroll */}
                                            <div 
                                                className="model-selector" 
                                                style={{ 
                                                    display: 'grid', 
                                                    gap: '12px',
                                                    maxHeight: '400px',
                                                    overflowY: 'auto',
                                                    paddingRight: '8px',
                                                }}
                                            >
                                                {providerFiltered.length === 0 ? (
                                                    <div style={{ 
                                                        padding: '40px 20px', 
                                                        textAlign: 'center', 
                                                        color: 'var(--text-muted)',
                                                        background: 'rgba(255, 255, 255, 0.02)',
                                                        borderRadius: '8px',
                                                        border: '1px dashed var(--glass-border)'
                                                    }}>
                                                        <SearchIcon size={24} style={{ marginBottom: '12px', opacity: 0.5 }} />
                                                        <p style={{ fontSize: '13px', margin: 0 }}>
                                                            No models found matching your search criteria
                                                        </p>
                                                        {(preferredModelSearch || preferredModelProviderFilter !== 'all') && (
                                                            <button
                                                                onClick={() => {
                                                                    setPreferredModelSearch('');
                                                                    setPreferredModelProviderFilter('all');
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
                                                    providerFiltered.map((model) => {
                                                        const searchLower = preferredModelSearch.toLowerCase();
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
                                                                className={`model-option glass ${preferredModel === model.id ? 'active' : ''}`}
                                                                onClick={() => setPreferredModel(model.id)}
                                                                style={{
                                                                    padding: '16px',
                                                                    borderRadius: '12px',
                                                                    cursor: 'pointer',
                                                                    border: `1px solid ${preferredModel === model.id ? 'var(--accent-primary)' : 'var(--glass-border)'}`,
                                                                    background: preferredModel === model.id ? 'rgba(59, 130, 246, 0.05)' : 'transparent',
                                                                    transition: 'all 0.2s ease',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '16px'
                                                                }}
                                                            >
                                                                <div className={`radio-indicator ${preferredModel === model.id ? 'checked' : ''}`} style={{
                                                                    width: '18px',
                                                                    height: '18px',
                                                                    borderRadius: '50%',
                                                                    border: `2px solid ${preferredModel === model.id ? 'var(--accent-primary)' : 'var(--text-muted)'}`,
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    flexShrink: 0,
                                                                }}>
                                                                    {preferredModel === model.id && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-primary)' }} />}
                                                                </div>

                                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                                        <span style={{ fontWeight: 700, fontSize: '14px' }}>{highlightText(model.name)}</span>
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
                                        </>
                                    );
                                })()}
                            </>
                        )}

                        <div className="service-toggles" style={{ marginTop: '32px', borderTop: '1px solid var(--glass-border)', paddingTop: '24px', display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
                            {[
                                { id: 'clarifai', name: 'Biometric Fingerprinting', provider: 'Clarifai', description: 'Enable AI face matching across platforms.' },
                            ].map((service) => (
                                <div key={service.id} className="service-toggle-item glass" style={{ padding: '16px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                            <span style={{ fontWeight: 600, fontSize: '14px' }}>{service.name}</span>
                                        </div>
                                        <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{service.description}</p>
                                    </div>
                                    <button
                                        onClick={() => toggleService(service.id as 'clarifai')}
                                        style={{
                                            width: '44px',
                                            height: '24px',
                                            borderRadius: '12px',
                                            background: enabledServices[service.id as keyof typeof enabledServices] ? 'var(--accent-primary)' : 'rgba(255,255,255,0.1)',
                                            position: 'relative',
                                            transition: 'all 0.3s ease',
                                            cursor: 'pointer',
                                            border: 'none',
                                            flexShrink: 0
                                        }}
                                    >
                                        <div style={{
                                            width: '18px',
                                            height: '18px',
                                            borderRadius: '50%',
                                            background: 'white',
                                            position: 'absolute',
                                            top: '3px',
                                            left: enabledServices[service.id as keyof typeof enabledServices] ? '23px' : '3px',
                                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                        }} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="glass-card" style={{ padding: '32px', marginBottom: '32px' }}>
                        <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '16px', marginBottom: '24px' }}>
                            <BookOpen size={20} className="text-blue" />
                            <span>Deep Research Model</span>
                        </h3>

                        <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '14px' }}>
                            Configure the AI model used for Deep Research queries. Choose between OpenRouter (cloud) or llama.cpp (local).
                        </p>

                        {/* Provider Selection */}
                        <div style={{ marginBottom: '24px' }}>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Provider
                            </label>
                            <div style={{ display: 'inline-flex', borderRadius: '999px', border: '1px solid var(--glass-border)', padding: '3px' }}>
                                {(['openrouter', 'llamacpp'] as const).map(provider => (
                                    <button
                                        key={provider}
                                        type="button"
                                        onClick={() => setResearchProvider(provider)}
                                        style={{
                                            padding: '6px 16px',
                                            borderRadius: '999px',
                                            border: 'none',
                                            cursor: 'pointer',
                                            fontSize: '12px',
                                            fontWeight: 600,
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.06em',
                                            background: researchProvider === provider ? 'var(--accent-primary)' : 'transparent',
                                            color: researchProvider === provider ? '#0b1120' : 'var(--text-secondary)',
                                            transition: 'all 0.2s ease',
                                        }}
                                    >
                                        {provider === 'llamacpp' ? 'Local (llama.cpp)' : 'OpenRouter'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {researchProvider === 'openrouter' && (
                            <>
                                {/* Free / Paid toggle for OpenRouter */}
                                <div style={{ display: 'inline-flex', borderRadius: '999px', border: '1px solid var(--glass-border)', padding: '3px', marginBottom: '20px' }}>
                                    {(['free', 'paid'] as ModelTier[]).map(tier => (
                                        <button
                                            key={tier}
                                            type="button"
                                            onClick={() => setResearchModelTier(tier)}
                                            style={{
                                                padding: '6px 16px',
                                                borderRadius: '999px',
                                                border: 'none',
                                                cursor: 'pointer',
                                                fontSize: '12px',
                                                fontWeight: 600,
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.06em',
                                                background: researchModelTier === tier ? 'var(--accent-primary)' : 'transparent',
                                                color: researchModelTier === tier ? '#0b1120' : 'var(--text-secondary)',
                                                transition: 'all 0.2s ease',
                                            }}
                                        >
                                            {tier === 'free' ? 'Free Models' : 'Paid Models'}
                                        </button>
                                    ))}
                                </div>

                                {modelsLoading ? (
                                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        Loading models from OpenRouter...
                                    </div>
                                ) : modelsError ? (
                                    <div style={{ padding: '20px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                                        <p style={{ color: 'var(--accent-danger)', marginBottom: '12px' }}>{modelsError}</p>
                                        <button
                                            onClick={fetchOpenRouterModels}
                                            style={{
                                                padding: '8px 16px',
                                                background: 'var(--accent-primary)',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                fontSize: '13px',
                                            }}
                                        >
                                            <RefreshCw size={14} />
                                            Retry
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        {/* Search Input */}
                                        <div style={{ position: 'relative', marginBottom: '12px' }}>
                                            <SearchIcon 
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
                                                value={researchModelSearch}
                                                onChange={(e) => setResearchModelSearch(e.target.value)}
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
                                            {researchModelSearch && (
                                                <button
                                                    onClick={() => setResearchModelSearch('')}
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
                                                    title="Clear search"
                                                >
                                                    <X size={14} />
                                                </button>
                                            )}
                                        </div>

                                        {/* Provider Filter */}
                                        {(() => {
                                            const filteredModels = openRouterModels.filter(m => m.tier === researchModelTier);
                                            const providers = Array.from(new Set(filteredModels.map(m => m.provider)));
                                            const searchLower = researchModelSearch.toLowerCase().trim();
                                            const searchFiltered = searchLower 
                                                ? filteredModels.filter(m => 
                                                    m.name.toLowerCase().includes(searchLower) ||
                                                    m.provider.toLowerCase().includes(searchLower) ||
                                                    m.description.toLowerCase().includes(searchLower) ||
                                                    m.id.toLowerCase().includes(searchLower)
                                                  )
                                                : filteredModels;
                                            const providerFiltered = researchModelProviderFilter === 'all'
                                                ? searchFiltered
                                                : searchFiltered.filter(m => m.provider.toLowerCase() === researchModelProviderFilter.toLowerCase());
                                            
                                            return (
                                                <>
                                                    {providers.length > 0 && (
                                                        <div style={{ marginBottom: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                                            <Filter size={14} style={{ color: 'var(--text-muted)' }} />
                                                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginRight: '8px' }}>Filter:</span>
                                                            {['all', ...providers].map(provider => (
                                                                <button
                                                                    key={provider}
                                                                    type="button"
                                                                    onClick={() => setResearchModelProviderFilter(provider)}
                                                                    style={{
                                                                        padding: '4px 12px',
                                                                        borderRadius: '6px',
                                                                        border: '1px solid var(--glass-border)',
                                                                        background: researchModelProviderFilter === provider ? 'var(--accent-primary)' : 'transparent',
                                                                        color: researchModelProviderFilter === provider ? '#0b1120' : 'var(--text-secondary)',
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

                                                    {/* Result Count */}
                                                    <div style={{ marginBottom: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                                                        Showing {Math.min(5, providerFiltered.length)} of {providerFiltered.length} models
                                                    </div>

                                                    {/* Model List with Scroll */}
                                                    <div 
                                                        className="model-selector" 
                                                        style={{ 
                                                            display: 'grid', 
                                                            gap: '12px',
                                                            maxHeight: '500px',
                                                            overflowY: 'auto',
                                                            paddingRight: '8px',
                                                        }}
                                                    >
                                                        {providerFiltered.length === 0 ? (
                                                            <div style={{ 
                                                                padding: '40px 20px', 
                                                                textAlign: 'center', 
                                                                color: 'var(--text-muted)',
                                                                background: 'rgba(255, 255, 255, 0.02)',
                                                                borderRadius: '8px',
                                                                border: '1px dashed var(--glass-border)'
                                                            }}>
                                                                <SearchIcon size={24} style={{ marginBottom: '12px', opacity: 0.5 }} />
                                                                <p style={{ fontSize: '13px', margin: 0 }}>
                                                                    No models found matching your search criteria
                                                                </p>
                                                                {(researchModelSearch || researchModelProviderFilter !== 'all') && (
                                                                    <button
                                                                        onClick={() => {
                                                                            setResearchModelSearch('');
                                                                            setResearchModelProviderFilter('all');
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
                                                            providerFiltered.map((model) => {
                                                                const searchLower = researchModelSearch.toLowerCase();
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
                                                                        className={`model-option glass ${researchModel === model.id ? 'active' : ''}`}
                                                                        onClick={() => setResearchModel(model.id)}
                                                                        style={{
                                                                            padding: '16px',
                                                                            borderRadius: '12px',
                                                                            cursor: 'pointer',
                                                                            border: `1px solid ${researchModel === model.id ? 'var(--accent-primary)' : 'var(--glass-border)'}`,
                                                                            background: researchModel === model.id ? 'rgba(59, 130, 246, 0.05)' : 'transparent',
                                                                            transition: 'all 0.2s ease',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            gap: '16px'
                                                                        }}
                                                                    >
                                                                        <div className={`radio-indicator ${researchModel === model.id ? 'checked' : ''}`} style={{
                                                                            width: '18px',
                                                                            height: '18px',
                                                                            borderRadius: '50%',
                                                                            border: `2px solid ${researchModel === model.id ? 'var(--accent-primary)' : 'var(--text-muted)'}`,
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center',
                                                                            flexShrink: 0,
                                                                        }}>
                                                                            {researchModel === model.id && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-primary)' }} />}
                                                                        </div>

                                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                                                <span style={{ fontWeight: 700, fontSize: '14px' }}>{highlightText(model.name)}</span>
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
                                                </>
                                            );
                                        })()}
                                    </>
                                )}
                            </>
                        )}

                        {researchProvider === 'llamacpp' && (
                            <div style={{ padding: '20px', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                                <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                                    <strong>Local llama.cpp Server</strong><br />
                                    Make sure your llama.cpp server is running at the configured endpoint.
                                    The model will be determined by your llama.cpp server configuration.
                                </p>
                            </div>
                        )}
                    </section>

                    <section className="glass-card" style={{ padding: '32px', marginBottom: '32px' }}>
                        <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '16px', marginBottom: '24px' }}>
                            <Globe size={20} className="text-blue" />
                            <span>Default Model</span>
                        </h3>

                        <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '14px' }}>
                            Set the default model used as a fallback when no specific model is configured for an agent. This model will be used when agent-specific configurations are not set.
                        </p>

                        {modelsLoading ? (
                            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                Loading models from OpenRouter...
                            </div>
                        ) : modelsError ? (
                            <div style={{ padding: '20px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                                <p style={{ color: 'var(--accent-danger)', marginBottom: '12px' }}>{modelsError}</p>
                                <button
                                    onClick={fetchOpenRouterModels}
                                    style={{
                                        padding: '8px 16px',
                                        background: 'var(--accent-primary)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        fontSize: '13px',
                                    }}
                                >
                                    <RefreshCw size={14} />
                                    Retry
                                </button>
                            </div>
                        ) : (
                            <>
                                {/* Search Input */}
                                <div style={{ position: 'relative', marginBottom: '12px' }}>
                                    <SearchIcon 
                                        size={16} 
                                        style={{ 
                                            position: 'absolute', 
                                            left: '12px', 
                                            top: '50%', 
                                            transform: 'translateY(-50%)', 
                                            color: 'var(--text-muted)' 
                                        }} 
                                    />
                                    <input
                                        type="text"
                                        placeholder="Search models..."
                                        value={defaultModelSearch}
                                        onChange={(e) => setDefaultModelSearch(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '10px 12px 10px 40px',
                                            background: 'rgba(255,255,255,0.05)',
                                            border: '1px solid var(--glass-border)',
                                            borderRadius: '8px',
                                            color: 'var(--text-primary)',
                                            fontSize: '14px',
                                        }}
                                    />
                                    {defaultModelSearch && (
                                        <button
                                            onClick={() => setDefaultModelSearch('')}
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
                                        >
                                            <X size={16} />
                                        </button>
                                    )}
                                </div>

                                {/* Provider Filter */}
                                {(() => {
                                    const providers = Array.from(new Set(openRouterModels.map(m => m.provider))).sort();
                                    return (
                                        <>
                                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                                                <button
                                                    onClick={() => setDefaultModelProviderFilter('all')}
                                                    style={{
                                                        padding: '6px 12px',
                                                        borderRadius: '6px',
                                                        border: '1px solid var(--glass-border)',
                                                        background: defaultModelProviderFilter === 'all' ? 'var(--accent-primary)' : 'transparent',
                                                        color: defaultModelProviderFilter === 'all' ? '#0b1120' : 'var(--text-secondary)',
                                                        cursor: 'pointer',
                                                        fontSize: '12px',
                                                        fontWeight: 600,
                                                        transition: 'all 0.2s ease',
                                                    }}
                                                >
                                                    All
                                                </button>
                                                {providers.map(provider => (
                                                    <button
                                                        key={provider}
                                                        onClick={() => setDefaultModelProviderFilter(provider)}
                                                        style={{
                                                            padding: '6px 12px',
                                                            borderRadius: '6px',
                                                            border: '1px solid var(--glass-border)',
                                                            background: defaultModelProviderFilter === provider ? 'var(--accent-primary)' : 'transparent',
                                                            color: defaultModelProviderFilter === provider ? '#0b1120' : 'var(--text-secondary)',
                                                            cursor: 'pointer',
                                                            fontSize: '12px',
                                                            fontWeight: 600,
                                                            transition: 'all 0.2s ease',
                                                        }}
                                                    >
                                                        {provider}
                                                    </button>
                                                ))}
                                            </div>

                                            {(() => {
                                                const filteredModels = openRouterModels;
                                                const searchLower = defaultModelSearch.toLowerCase().trim();
                                                const searchFiltered = searchLower
                                                    ? filteredModels.filter(m => 
                                                        m.name.toLowerCase().includes(searchLower) ||
                                                        m.provider.toLowerCase().includes(searchLower) ||
                                                        m.description?.toLowerCase().includes(searchLower) ||
                                                        m.id.toLowerCase().includes(searchLower)
                                                    )
                                                    : filteredModels;
                                                const providerFiltered = defaultModelProviderFilter === 'all'
                                                    ? searchFiltered
                                                    : searchFiltered.filter(m => m.provider.toLowerCase() === defaultModelProviderFilter.toLowerCase());

                                                const highlightText = (text: string) => {
                                                    if (!defaultModelSearch) return text;
                                                    const parts = text.split(new RegExp(`(${defaultModelSearch})`, 'gi'));
                                                    return parts.map((part, i) => 
                                                        part.toLowerCase() === defaultModelSearch.toLowerCase() 
                                                            ? <strong key={i} style={{ color: 'var(--accent-primary)' }}>{part}</strong>
                                                            : part
                                                    );
                                                };

                                                return (
                                                    <>
                                                        {(defaultModelSearch || defaultModelProviderFilter !== 'all') && (
                                                            <div style={{ marginBottom: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                                                                {providerFiltered.length} model{providerFiltered.length !== 1 ? 's' : ''} found
                                                            </div>
                                                        )}

                                                        <div style={{ 
                                                            maxHeight: '400px', 
                                                            overflowY: 'auto', 
                                                            display: 'grid', 
                                                            gridTemplateColumns: '1fr', 
                                                            gap: '8px',
                                                            paddingRight: '4px'
                                                        }}>
                                                            {providerFiltered.length === 0 ? (
                                                                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                                                    No models found matching your search
                                                                </div>
                                                            ) : (
                                                                providerFiltered.map((model) => {
                                                                    return (
                                                                        <div
                                                                            key={model.id}
                                                                            onClick={() => setDefaultModel(model.id)}
                                                                            className={`model-option glass ${defaultModel === model.id ? 'active' : ''}`}
                                                                            style={{
                                                                                padding: '12px',
                                                                                borderRadius: '8px',
                                                                                cursor: 'pointer',
                                                                                transition: 'all 0.2s ease',
                                                                                border: `1px solid ${defaultModel === model.id ? 'var(--accent-primary)' : 'var(--glass-border)'}`,
                                                                                background: defaultModel === model.id ? 'rgba(59, 130, 246, 0.05)' : 'transparent',
                                                                                display: 'flex',
                                                                                alignItems: 'center',
                                                                                gap: '12px',
                                                                            }}
                                                                        >
                                                                            <div className={`radio-indicator ${defaultModel === model.id ? 'checked' : ''}`} style={{
                                                                                width: '20px',
                                                                                height: '20px',
                                                                                borderRadius: '50%',
                                                                                display: 'flex',
                                                                                alignItems: 'center',
                                                                                justifyContent: 'center',
                                                                                flexShrink: 0,
                                                                                border: `2px solid ${defaultModel === model.id ? 'var(--accent-primary)' : 'var(--text-muted)'}`,
                                                                                transition: 'all 0.2s ease',
                                                                            }}>
                                                                                {defaultModel === model.id && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-primary)' }} />}
                                                                            </div>
                                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                                                                                    <span style={{ fontWeight: 700, fontSize: '14px' }}>{highlightText(model.name)}</span>
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
                                                    </>
                                                );
                                            })()}
                                        </>
                                    );
                                })()}
                            </>
                        )}
                    </section>

                    <section className="glass-card" style={{ padding: '32px', marginBottom: '32px' }}>
                        <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '16px', marginBottom: '24px' }}>
                            <SettingsIcon size={20} className="text-blue" />
                            <span>Agent Model Configuration</span>
                        </h3>

                        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '14px' }}>
                            Configure specific models for each research agent to optimize performance. Each agent can use a model best suited for its task.
                        </p>

                        <AgentModelSettings />
                    </section>

                    <section className="glass-card" style={{ padding: '32px', marginBottom: '32px' }}>
                        <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '16px', marginBottom: '24px' }}>
                            <Key size={20} className="text-blue" />
                            <span>External Intelligence Credentials</span>
                        </h3>

                        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '14px' }}>
                            Configure API keys for third-party intelligence providers. These keys are used for deep scanning, facial recognition, and cross-platform correlation.
                        </p>

                        <div className="credentials-form" style={{ display: 'grid', gap: '20px' }}>
                            {[
                                { id: 'googleVision', name: 'Google Cloud Vision API', icon: Globe },
                                { id: 'clarifai', name: 'Clarifai Personal Access Token', icon: Cpu },
                                { id: 'openRouter', name: 'OpenRouter API Key', icon: Shield },
                            ].map((provider) => (
                                <div key={provider.id} className="credential-field">
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        {provider.name}
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type="password"
                                            value={credentials[provider.id as keyof typeof credentials]}
                                            onChange={(e) => handleCredentialChange(provider.id, e.target.value)}
                                            placeholder={`Enter ${provider.name}...`}
                                            className="glass"
                                            style={{
                                                width: '100%',
                                                padding: '12px 16px',
                                                paddingRight: '40px',
                                                borderRadius: '8px',
                                                border: '1px solid var(--glass-border)',
                                                background: 'rgba(255, 255, 255, 0.03)',
                                                color: 'var(--text-primary)',
                                                fontSize: '14px',
                                                fontFamily: 'JetBrains Mono, monospace'
                                            }}
                                        />
                                        <Lock size={14} style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="glass-card" style={{ padding: '32px' }}>
                        <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '16px', marginBottom: '24px' }}>
                            <Lock size={20} className="text-blue" />
                            <span>Data Protection (GDPR)</span>
                        </h3>

                        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '14px' }}>
                            Manage your personal footprint and history. These actions are irreversible and will be logged in the system audit.
                        </p>

                        <div style={{ display: 'flex', gap: '16px' }}>
                            <button className="glass" style={{ padding: '12px 24px', borderRadius: '8px', color: 'var(--accent-danger)', border: '1px solid rgba(239, 68, 68, 0.2)', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                                Mask Search History
                            </button>
                            <button className="glass" style={{ padding: '12px 24px', borderRadius: '8px', color: 'var(--accent-danger)', border: '1px solid rgba(239, 68, 68, 0.2)', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                                Purge Digital Dossiers
                            </button>
                        </div>
                    </section>
                </div>

                <div className="settings-sidebar">
                    <div className="glass-card" style={{ padding: '24px', position: 'sticky', top: '24px' }}>
                        <button
                            className="primary-btn"
                            onClick={handleSave}
                            disabled={saveStatus === 'Saving...'}
                            style={{ width: '100%', justifyContent: 'center', height: '48px', marginBottom: '16px' }}
                        >
                            <Save size={18} />
                            <span>Save Changes</span>
                        </button>
                        {saveStatus && <p style={{ fontSize: '12px', textAlign: 'center', color: saveStatus.includes('Error') ? 'var(--accent-danger)' : 'var(--accent-secondary)' }}>{saveStatus}</p>}

                        <div style={{ marginTop: '24px', borderTop: '1px solid var(--glass-border)', paddingTop: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-muted)', fontSize: '13px' }}>
                                <Shield size={16} />
                                <span>Encrypted on Transmission</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
