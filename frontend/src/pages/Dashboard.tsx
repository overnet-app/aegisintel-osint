import { useState, useEffect } from 'react';
import api from '../services/api';
import { Shield, Users, Database, AlertCircle, ExternalLink, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';

interface AnalyticsStats {
    totalSearches: number;
    riskDistribution: {
        LOW: number;
        MEDIUM: number;
        HIGH: number;
        CRITICAL: number;
        UNKNOWN: number;
    };
    topPlatforms: Array<{ name: string; count: number }>;
    recentActivity: Array<{
        id: string;
        subject: string;
        createdAt: string;
        riskLevel: string;
    }>;
}

export default function Dashboard() {
    const [stats, setStats] = useState<AnalyticsStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const response = await api.get('/dossiers/analytics');
                // Ensure we have a valid stats object
                const data = response.data;
                setStats({
                    totalSearches: data?.totalSearches || 0,
                    riskDistribution: data?.riskDistribution || { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0, UNKNOWN: 0 },
                    topPlatforms: Array.isArray(data?.topPlatforms) ? data.topPlatforms : [],
                    recentActivity: Array.isArray(data?.recentActivity) ? data.recentActivity : [],
                });
            } catch (error) {
                console.error('Failed to fetch analytics', error);
                // Set default empty stats on error
                setStats({
                    totalSearches: 0,
                    riskDistribution: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0, UNKNOWN: 0 },
                    topPlatforms: [],
                    recentActivity: [],
                });
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    if (loading) return <div className="p-8 text-center text-muted">Synchronizing with Analytics Grid...</div>;

    const highRiskAlerts = (stats?.riskDistribution?.HIGH || 0) + (stats?.riskDistribution?.CRITICAL || 0);

    return (
        <div className="dashboard-page fade-in">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="page-title">Intelligence Dashboard</h2>
                    <p className="page-subtitle">Real-time overview of active OSINT operations and target intelligence.</p>
                </div>
                <div className="flex gap-2">
                    <Link to="/search" className="primary-btn text-sm py-2">New Investigation</Link>
                </div>
            </div>

            <div className="stats-grid">
                <div className="glass-card stat-card">
                    <div className="flex justify-between items-start mb-2">
                        <span className="stat-label">Total Investigations</span>
                        <Users size={16} className="opacity-40" />
                    </div>
                    <span className="stat-value">{stats?.totalSearches || 0}</span>
                </div>
                <div className="glass-card stat-card">
                    <div className="flex justify-between items-start mb-2">
                        <span className="stat-label">Platforms Indexed</span>
                        <Database size={16} className="opacity-40" />
                    </div>
                    <span className="stat-value">{stats?.topPlatforms?.length || 0}</span>
                </div>
                <div className="glass-card stat-card">
                    <div className="flex justify-between items-start mb-2">
                        <span className="stat-label">Risk Level: High</span>
                        <AlertCircle size={16} className="text-red opacity-60" />
                    </div>
                    <span className="stat-value text-red">{highRiskAlerts}</span>
                </div>
                <div className="glass-card stat-card">
                    <div className="flex justify-between items-start mb-2">
                        <span className="stat-label">Security Score</span>
                        <Shield size={16} className="text-green opacity-60" />
                    </div>
                    <span className="stat-value text-green">94%</span>
                </div>
            </div>

            <div className="content-grid mt-8">
                <div className="glass-card recent-activity">
                    <div className="flex items-center gap-2 mb-6">
                        <Activity size={18} className="opacity-60" />
                        <h3 className="section-title mb-0">Recent Activity Feed</h3>
                    </div>
                    <div className="activity-list">
                        {stats?.recentActivity?.length > 0 ? (
                            stats.recentActivity.map((activity: any) => (
                                <Link
                                    key={activity.id}
                                    to={`/dossiers/${activity.id}`}
                                    className="activity-item"
                                >
                                    <div className="flex flex-col" style={{ flex: 1 }}>
                                        <span className="font-semibold">{activity.subject}</span>
                                        <span className="text-xs">{new Date(activity.createdAt).toLocaleString()}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span 
                                            className={`risk-badge ${
                                                activity.riskLevel === 'HIGH' || activity.riskLevel === 'CRITICAL' 
                                                    ? 'risk-high' 
                                                    : activity.riskLevel === 'MEDIUM' 
                                                    ? 'risk-medium' 
                                                    : 'risk-low'
                                            }`}
                                        >
                                            {activity.riskLevel}
                                        </span>
                                        <ExternalLink size={14} style={{ opacity: 0.4, flexShrink: 0 }} />
                                    </div>
                                </Link>
                            ))
                        ) : (
                            <div className="text-center">
                                No recent activity detected. Start a search to begin.
                            </div>
                        )}
                    </div>
                </div>

                <div className="glass-card platform-distribution">
                    <div className="flex items-center gap-2 mb-6">
                        <Database size={18} className="opacity-60" />
                        <h3 className="section-title mb-0">Platform Distribution</h3>
                    </div>
                    <div className="platform-list">
                        {stats?.topPlatforms?.length > 0 ? (
                            stats.topPlatforms.map((platform: any) => (
                                <div key={platform.name} className="platform-stat">
                                    <div className="flex">
                                        <span className="opacity-60">{platform.name}</span>
                                        <span className="font-mono">{platform.count}</span>
                                    </div>
                                    <div className="h-1">
                                        <div
                                            className="bg-accent-primary"
                                            style={{ width: `${Math.min((platform.count / (stats.totalSearches || 1)) * 100, 100)}%` }}
                                        ></div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center">
                                Not enough data for distribution analysis.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
