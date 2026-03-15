import { useState, useEffect } from 'react';
import { Globe, MapPin, Activity, AlertCircle } from 'lucide-react';
import api from '../services/api';

interface LocationData {
    id: string;
    location: string;
    count: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    lastSeen: string;
}

export default function GlobalMap() {
    const [locations, setLocations] = useState<LocationData[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);

    useEffect(() => {
        const fetchLocationData = async () => {
            try {
                // Fetch dossiers and extract location data
                const response = await api.get('/dossiers');
                const dossiers = Array.isArray(response.data) ? response.data : 
                               Array.isArray(response.data?.data) ? response.data.data : [];

                // Extract location data from dossiers
                const locationMap = new Map<string, LocationData>();
                
                dossiers.forEach((dossier: any) => {
                    const geoData = dossier.content?.geolocation;
                    if (geoData?.homeLocation || geoData?.locations) {
                        const location = geoData.homeLocation || geoData.locations?.[0] || 'Unknown';
                        const existing = locationMap.get(location) || {
                            id: location,
                            location,
                            count: 0,
                            riskLevel: dossier.content?.riskAssessment?.riskLevel || 'UNKNOWN',
                            lastSeen: dossier.createdAt,
                        };
                        existing.count++;
                        if (new Date(dossier.createdAt) > new Date(existing.lastSeen)) {
                            existing.lastSeen = dossier.createdAt;
                        }
                        locationMap.set(location, existing);
                    }
                });

                setLocations(Array.from(locationMap.values()));
            } catch (error) {
                console.error('Failed to fetch location data', error);
            } finally {
                setLoading(false);
            }
        };

        fetchLocationData();
        const interval = setInterval(fetchLocationData, 30000); // Refresh every 30 seconds
        return () => clearInterval(interval);
    }, []);

    const getRiskColor = (riskLevel: string) => {
        switch (riskLevel) {
            case 'CRITICAL':
                return 'text-red';
            case 'HIGH':
                return 'text-orange';
            case 'MEDIUM':
                return 'text-yellow';
            case 'LOW':
                return 'text-green';
            default:
                return 'text-muted';
        }
    };

    if (loading) {
        return (
            <div className="p-8 text-center text-muted">
                <Globe className="animate-spin mx-auto mb-4" size={32} />
                <p>Loading global intelligence map...</p>
            </div>
        );
    }

    return (
        <div className="global-map-page fade-in">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="page-title">Global Intelligence Map</h2>
                    <p className="page-subtitle">Geographic distribution of OSINT targets and operations worldwide.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 glass-card p-0 overflow-hidden">
                    <div className="p-6 border-b border-white/10">
                        <div className="flex items-center gap-3">
                            <Globe size={20} className="text-blue" />
                            <h3 className="section-title mb-0">Geographic Distribution</h3>
                        </div>
                    </div>
                    <div className="p-8">
                        <div className="map-placeholder glass border-2 border-dashed border-white/10 rounded-lg p-16 text-center">
                            <Globe size={64} className="mx-auto mb-4 opacity-20" />
                            <p className="text-muted opacity-60 mb-2">Interactive Map Visualization</p>
                            <p className="text-xs opacity-40">
                                {locations.length > 0 
                                    ? `${locations.length} locations detected across ${locations.reduce((sum, loc) => sum + loc.count, 0)} operations`
                                    : 'No geographic data available. Location data will appear here as operations complete.'}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="glass-card p-0 overflow-hidden">
                    <div className="p-6 border-b border-white/10">
                        <div className="flex items-center gap-3">
                            <MapPin size={20} className="text-blue" />
                            <h3 className="section-title mb-0">Location List</h3>
                        </div>
                    </div>
                    <div className="location-list max-h-[600px] overflow-y-auto">
                        {locations.length === 0 ? (
                            <div className="p-8 text-center text-muted">
                                <MapPin size={32} className="mx-auto mb-4 opacity-20" />
                                <p className="text-sm opacity-60">No location data available</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-white/5">
                                {locations.map((loc) => (
                                    <div
                                        key={loc.id}
                                        className={`p-4 hover:bg-white/5 transition-all cursor-pointer ${
                                            selectedLocation?.id === loc.id ? 'bg-white/5' : ''
                                        }`}
                                        onClick={() => setSelectedLocation(loc)}
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <MapPin size={14} className="opacity-60" />
                                                <span className="font-semibold text-sm">{loc.location}</span>
                                            </div>
                                            <span className={`text-xs font-semibold ${getRiskColor(loc.riskLevel)}`}>
                                                {loc.riskLevel}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs opacity-60">
                                            <span>{loc.count} operation{loc.count !== 1 ? 's' : ''}</span>
                                            <span>{new Date(loc.lastSeen).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {selectedLocation && (
                <div className="mt-6 glass-card p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="section-title mb-0">Location Details</h3>
                        <button
                            onClick={() => setSelectedLocation(null)}
                            className="text-xs opacity-60 hover:opacity-100"
                        >
                            Close
                        </button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <span className="text-xs opacity-60 uppercase tracking-wider">Location</span>
                            <p className="font-semibold mt-1">{selectedLocation.location}</p>
                        </div>
                        <div>
                            <span className="text-xs opacity-60 uppercase tracking-wider">Operations</span>
                            <p className="font-semibold mt-1">{selectedLocation.count}</p>
                        </div>
                        <div>
                            <span className="text-xs opacity-60 uppercase tracking-wider">Risk Level</span>
                            <p className={`font-semibold mt-1 ${getRiskColor(selectedLocation.riskLevel)}`}>
                                {selectedLocation.riskLevel}
                            </p>
                        </div>
                        <div>
                            <span className="text-xs opacity-60 uppercase tracking-wider">Last Activity</span>
                            <p className="font-semibold mt-1">{new Date(selectedLocation.lastSeen).toLocaleString()}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
