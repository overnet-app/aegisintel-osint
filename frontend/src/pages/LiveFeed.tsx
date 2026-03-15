import { useState, useEffect } from 'react';
import { Activity, Clock, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import api from '../services/api';

interface ActivityEvent {
    id: string;
    type: string;
    message: string;
    timestamp: string;
    status: 'SUCCESS' | 'ERROR' | 'WARNING' | 'INFO';
    metadata?: any;
}

export default function LiveFeed() {
    const [events, setEvents] = useState<ActivityEvent[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Simulate live feed - in production, this would be WebSocket or SSE
        const fetchEvents = async () => {
            try {
                // For now, fetch recent search sessions as events
                const response = await api.get('/search?limit=50');
                const sessions = Array.isArray(response.data) ? response.data : [];
                
                const formattedEvents: ActivityEvent[] = sessions.map((session: any) => ({
                    id: session.id,
                    type: session.type,
                    message: `${session.type === 'DEEP' ? 'Deep search' : 'Preliminary search'} initiated for "${session.query}"`,
                    timestamp: session.createdAt,
                    status: session.status === 'COMPLETED' ? 'SUCCESS' : 
                           session.status === 'FAILED' ? 'ERROR' : 
                           session.status === 'RUNNING' ? 'INFO' : 'WARNING',
                    metadata: session,
                }));

                setEvents(formattedEvents);
            } catch (error) {
                console.error('Failed to fetch activity feed', error);
            } finally {
                setLoading(false);
            }
        };

        fetchEvents();
        // Refresh every 5 seconds
        const interval = setInterval(fetchEvents, 5000);
        return () => clearInterval(interval);
    }, []);

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'SUCCESS':
                return <CheckCircle size={16} className="text-green" />;
            case 'ERROR':
                return <XCircle size={16} className="text-red" />;
            case 'WARNING':
                return <AlertCircle size={16} className="text-orange" />;
            default:
                return <Activity size={16} className="text-blue" />;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'SUCCESS':
                return 'border-green/20 bg-green/5';
            case 'ERROR':
                return 'border-red/20 bg-red/5';
            case 'WARNING':
                return 'border-orange/20 bg-orange/5';
            default:
                return 'border-blue/20 bg-blue/5';
        }
    };

    if (loading) {
        return (
            <div className="p-8 text-center text-muted">
                <Activity className="animate-spin mx-auto mb-4" size={32} />
                <p>Initializing live feed...</p>
            </div>
        );
    }

    return (
        <div className="live-feed-page fade-in">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="page-title">Live Activity Feed</h2>
                    <p className="page-subtitle">Real-time monitoring of all OSINT operations and system events.</p>
                </div>
                <div className="flex items-center gap-2 text-sm opacity-60">
                    <div className="w-2 h-2 bg-green rounded-full animate-pulse"></div>
                    <span>Live</span>
                </div>
            </div>

            <div className="glass-card p-0 overflow-hidden">
                <div className="p-6 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <Activity size={20} className="text-blue" />
                        <h3 className="section-title mb-0">System Events</h3>
                    </div>
                </div>

                <div className="activity-feed">
                    {events.length === 0 ? (
                        <div className="p-12 text-center text-muted">
                            <Activity size={48} className="mx-auto mb-4 opacity-20" />
                            <p className="opacity-60">No activity detected. Operations will appear here in real-time.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-white/5">
                            {events.map((event) => (
                                <div
                                    key={event.id}
                                    className={`p-4 hover:bg-white/5 transition-all ${getStatusColor(event.status)} border-l-4`}
                                >
                                    <div className="flex items-start gap-4">
                                        <div className="mt-0.5">
                                            {getStatusIcon(event.status)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-semibold text-sm">{event.message}</span>
                                                <span className={`text-[10px] px-2 py-0.5 rounded uppercase tracking-wider ${event.status === 'SUCCESS' ? 'text-green bg-green/10' :
                                                    event.status === 'ERROR' ? 'text-red bg-red/10' :
                                                    event.status === 'WARNING' ? 'text-orange bg-orange/10' :
                                                    'text-blue bg-blue/10'
                                                }`}>
                                                    {event.type}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs opacity-50">
                                                <Clock size={12} />
                                                <span>{new Date(event.timestamp).toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
