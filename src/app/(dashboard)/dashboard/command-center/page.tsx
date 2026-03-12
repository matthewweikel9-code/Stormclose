'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import type { MapMarker, MapCircle } from '@/components/ui/MapboxMap';
import {
  Cloud,
  MapPin,
  Navigation,
  DollarSign,
  Search,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Zap,
  Plus,
  ArrowRight,
  Home,
  XCircle,
  Route,
  Crosshair,
  ExternalLink,
  Shield,
  Building2,
  User,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Map,
} from 'lucide-react';

// Lazy load the MapboxMap component
const MapboxMap = dynamic(
  () => import('@/components/ui/MapboxMap'),
  { ssr: false, loading: () => <div className="h-full w-full animate-pulse rounded-xl bg-storm-z1" /> }
);

// ============================================================================
// TYPES
// ============================================================================

interface StormEvent {
  id: string;
  type: string;
  severity: string;
  location?: string;
  lat: number;
  lng: number;
  hailSize?: number;
  windSpeed?: number;
  startTime: string;
  damageScore?: number;
  radius?: number;
  isActive?: boolean;
  county?: string;
  state?: string;
  comments?: string;
  path?: { lat: number; lng: number }[];
}

interface StormAlert {
  id: string;
  type: string;
  name: string;
  severity: string;
  color: string;
  body: string;
  issuedAt: string;
  expiresAt: string;
  location: string;
  emergency: boolean;
}

interface StormCell {
  id: string;
  lat: number;
  lng: number;
  hailProb: number;
  hailProbSevere: number;
  maxHailSize: number;
  tornadoProb: number;
  isRotating: boolean;
  isSevere: boolean;
  speedMph: number;
  direction: number;
  location: string;
}

interface Property {
  address: string;
  lat?: number;
  lng?: number;
  owner?: { name: string; firstName?: string; lastName?: string; mailingAddress?: string; absenteeOwner?: boolean };
  property?: { value: number; yearBuilt: number; squareFootage: number; lotSize: number; buildingType: string; bedrooms: number; bathrooms: number; stories: number };
  roof?: { type: string; material: string; age: number; complexity: string; condition: string; squareFootage: number; pitch: number };
  parcel?: { id: string; attomId?: number; fips?: string };
  assessment?: { assessedValue: number; marketValue: number; landValue: number; improvementValue: number; taxAmount: number; taxYear: number };
  sale?: { lastSaleDate: string; lastSaleAmount: number; pricePerSqft: number } | null;
  claimEstimate?: { roofReplacement: number; siding: number; gutters: number; total: number; confidence: string };
  stormExposure?: { hailEvents: number; maxHailSize: number; windEvents: number; maxWindSpeed: number; lastStormDate: string; summary: string } | null;
  neighborhood?: { avgHomeValue: number; avgRoofAge: number; claimLikelihood: number };
  source?: string;
}

interface Opportunity {
  id: string;
  name: string;
  date: string;
  location: string;
  coordinates: { lat: number; lng: number };
  severity: string;
  hailSize: number;
  windSpeed: number;
  affectedProperties: number;
  estimatedDamage: number;
  daysAgo: number;
  opportunityScore: number;
}

interface OpportunityProperty {
  id: string;
  address: string;
  city: string;
  state: string;
  damageScore: number;
  opportunityValue: number;
  roofAge: number;
  roofSquares: number;
  lastStorm: string;
  owner: string;
  tags: string[];
  priority: string;
}

interface RouteStop {
  id: string;
  address: string;
  lat?: number;
  lng?: number;
  source?: string;
}

interface OptimizedRoute {
  totalDistance: string;
  totalDuration: string;
  legs: { distance: string; duration: string; startAddress: string; endAddress: string }[];
  waypointOrder: number[] | null;
  polyline: string | null;
}

type ActiveTab = 'storm-map' | 'opportunities' | 'property-lookup' | 'smart-route';

// ============================================================================
// TAB DEFINITIONS (4 panels only — no CRM)
// ============================================================================

const tabs: { id: ActiveTab; label: string; icon: React.ElementType; badge?: string; badgeColor?: string }[] = [
  { id: 'storm-map', label: 'Storm Map', icon: Cloud, badge: 'LIVE', badgeColor: 'bg-red-500/20 text-red-400' },
  { id: 'opportunities', label: 'Opportunities', icon: DollarSign, badge: 'HOT', badgeColor: 'bg-amber-500/20 text-amber-400' },
  { id: 'property-lookup', label: 'Property Lookup', icon: Search },
  { id: 'smart-route', label: 'Smart Route', icon: Navigation },
];

// ============================================================================
// MAIN COMPONENT — shared state for cross-panel workflow
// ============================================================================

export default function CommandCenterPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('storm-map');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);

  // ── Shared route stops (cross-panel workflow) ──
  const [routeStops, setRouteStops] = useState<RouteStop[]>([]);

  const addToRoute = useCallback((stop: Omit<RouteStop, 'id'>) => {
    setRouteStops(prev => {
      if (prev.some(s => s.address === stop.address)) return prev;
      return [...prev, { ...stop, id: `stop-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }];
    });
  }, []);

  const removeFromRoute = useCallback((id: string) => {
    setRouteStops(prev => prev.filter(s => s.id !== id));
  }, []);

  const goToRoute = useCallback(() => {
    setActiveTab('smart-route');
  }, []);

  // Get user location ONCE at page level, share with all panels
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setLocationLoading(false);
        },
        () => {
          setUserLocation({ lat: 32.7767, lng: -96.7970 });
          setLocationLoading(false);
        },
        { timeout: 5000, maximumAge: 300000 }
      );
    } else {
      setUserLocation({ lat: 32.7767, lng: -96.7970 });
      setLocationLoading(false);
    }
  }, []);

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-storm-purple to-storm-glow shadow-lg shadow-storm-purple/20">
            <Crosshair className="h-5 w-5 text-white" />
          </span>
          Storm Operations Center
        </h1>
        <p className="mt-1 text-sm text-storm-muted">
          Storm intelligence → Property targeting → Optimized routing
        </p>
      </div>

      {/* Tab Bar */}
      <div className="mb-6 flex items-center gap-1 overflow-x-auto storm-card rounded-xl p-1.5 scrollbar-hide">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                isActive
                  ? 'bg-storm-purple/15 text-white shadow-sm'
                  : 'text-slate-400 hover:bg-storm-z2 hover:text-slate-300'
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? 'text-storm-glow' : ''}`} />
              {tab.label}
              {tab.badge && (
                <span className={`ml-1 rounded px-1.5 py-0.5 text-[10px] font-bold ${tab.badgeColor} ${tab.badge === 'LIVE' ? 'animate-pulse' : ''}`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}

        {/* Route stops indicator */}
        {routeStops.length > 0 && (
          <button
            onClick={goToRoute}
            className="ml-auto flex items-center gap-2 whitespace-nowrap rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-all"
          >
            <Route className="h-3.5 w-3.5" />
            {routeStops.length} stop{routeStops.length !== 1 ? 's' : ''} in route
            <ArrowRight className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Tab Content */}
      <div className="min-h-[calc(100vh-14rem)]">
        {locationLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-storm-purple mb-3" />
            <p className="text-sm text-storm-muted">Getting your location...</p>
          </div>
        ) : (
          <>
            {activeTab === 'storm-map' && (
              <StormMapPanel
                userLocation={userLocation!}
                addToRoute={addToRoute}
                goToRoute={goToRoute}
              />
            )}
            {activeTab === 'opportunities' && (
              <OpportunitiesPanel
                userLocation={userLocation!}
                addToRoute={addToRoute}
                goToRoute={goToRoute}
                routeStops={routeStops}
              />
            )}
            {activeTab === 'property-lookup' && (
              <PropertyLookupPanel addToRoute={addToRoute} goToRoute={goToRoute} />
            )}
            {activeTab === 'smart-route' && (
              <SmartRoutePanel
                routeStops={routeStops}
                addToRoute={addToRoute}
                removeFromRoute={removeFromRoute}
                setRouteStops={setRouteStops}
                userLocation={userLocation!}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// STORM MAP PANEL — Live radar, storm markers, click-to-discover properties
// ============================================================================

function StormMapPanel({
  userLocation,
  addToRoute,
  goToRoute,
}: {
  userLocation: { lat: number; lng: number };
  addToRoute: (stop: Omit<RouteStop, 'id'>) => void;
  goToRoute: () => void;
}) {
  const [storms, setStorms] = useState<StormEvent[]>([]);
  const [alerts, setAlerts] = useState<StormAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStorm, setSelectedStorm] = useState<StormEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const refreshRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch properties near a clicked storm
  const [nearbyProperties, setNearbyProperties] = useState<Property[]>([]);
  const [propsLoading, setPropsLoading] = useState(false);

  const fetchStorms = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        lat: String(userLocation.lat),
        lng: String(userLocation.lng),
        live: 'true',
        radius: '150',
      });
      const res = await fetch(`/api/storms?${params}`);
      if (res.ok) {
        const data = await res.json();
        setStorms(data.storms || []);
        setAlerts(data.alerts || []);
        setLastUpdated(data.lastUpdated || new Date().toISOString());
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error || 'Failed to fetch storm data');
      }
    } catch (err) {
      console.error('Error fetching storms:', err);
      setError('Network error fetching storms');
    } finally {
      setLoading(false);
    }
  }, [userLocation]);

  // Auto-refresh every 60s
  useEffect(() => {
    fetchStorms();
    refreshRef.current = setInterval(fetchStorms, 60000);
    return () => {
      if (refreshRef.current) clearInterval(refreshRef.current);
    };
  }, [fetchStorms]);

  // When user clicks a storm, fetch nearby properties from ATTOM
  const handleStormClick = useCallback(async (storm: StormEvent) => {
    setSelectedStorm(storm);
    setNearbyProperties([]);
    setPropsLoading(true);
    try {
      const res = await fetch(`/api/knock-list/properties?lat=${storm.lat}&lng=${storm.lng}&radius=5`);
      if (res.ok) {
        const data = await res.json();
        setNearbyProperties((data.properties || []).slice(0, 10).map((p: any) => ({
          address: p.address,
          lat: p.lat,
          lng: p.lng,
          owner: { name: p.ownerName || 'Unknown' },
          property: { value: p.propertyValue || 0, yearBuilt: p.yearBuilt || 0, squareFootage: p.sqft || 0 },
          roof: { age: p.roofAge || 0, squareFootage: p.roofSize || 0 },
          claimEstimate: { total: p.estimatedJobValue || 0 },
        } as Property)));
      }
    } catch { /* skip */ }
    setPropsLoading(false);
  }, []);

  // Build map markers
  const stormMarkers: MapMarker[] = storms.map((s) => ({
    id: s.id,
    lat: s.lat,
    lng: s.lng,
    type: (s.type === 'hail' ? 'hail' : s.type === 'tornado' ? 'tornado' : s.type === 'wind' ? 'wind' : 'storm') as MapMarker['type'],
    severity: (s.severity === 'severe' || s.severity === 'extreme' ? 'severe' : s.severity === 'moderate' ? 'moderate' : 'minor') as MapMarker['severity'],
    popup: `${s.type.toUpperCase()} — ${s.location || ''}${s.hailSize ? ` · ${s.hailSize}" hail` : ''}${s.windSpeed ? ` · ${s.windSpeed} mph` : ''}`,
  }));

  // Property markers when a storm is selected
  const propertyMarkers: MapMarker[] = nearbyProperties.map((p, i) => ({
    id: `prop-${i}`,
    lat: p.lat || 0,
    lng: p.lng || 0,
    type: 'property' as const,
    popup: `${p.address} — Est. $${(p.claimEstimate?.total || 0).toLocaleString()}`,
  }));

  // Impact zone circles for storms
  const impactCircles: MapCircle[] = selectedStorm
    ? [{
        id: `circle-${selectedStorm.id}`,
        center: [selectedStorm.lng, selectedStorm.lat],
        radiusMiles: selectedStorm.radius || 10,
        color: selectedStorm.severity === 'extreme' ? '#EF4444' : selectedStorm.severity === 'severe' ? '#F59E0B' : '#6D5CFF',
        opacity: 0.12,
      }]
    : [];

  const activeAlerts = alerts.filter(a => {
    return !a.expiresAt || new Date(a.expiresAt) > new Date();
  });

  return (
    <div className="space-y-4">
      {/* Active Alerts Banner */}
      {activeAlerts.length > 0 && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 space-y-2">
          {activeAlerts.slice(0, 3).map((alert) => (
            <div key={alert.id} className="flex items-start gap-3">
              <AlertTriangle className={`h-5 w-5 flex-shrink-0 mt-0.5 ${alert.emergency ? 'text-red-400 animate-pulse' : 'text-amber-400'}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">{alert.name}</p>
                <p className="text-xs text-slate-400 truncate">{alert.location} · Expires {new Date(alert.expiresAt).toLocaleTimeString()}</p>
              </div>
              {alert.emergency && (
                <span className="rounded bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-400 animate-pulse">EMERGENCY</span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map — 2 cols */}
        <div className="lg:col-span-2 h-[600px] rounded-xl overflow-hidden border border-storm-border relative">
          <MapboxMap
            center={{ lat: userLocation.lat, lng: userLocation.lng }}
            zoom={8}
            showUserLocation
            showRadar
            darkMode
            markers={[...stormMarkers, ...propertyMarkers]}
            circles={impactCircles}
            onMarkerClick={(marker) => {
              const storm = storms.find((s) => s.id === marker.id);
              if (storm) handleStormClick(storm);
            }}
            onMapClick={(lat, lng) => {
              let closest: StormEvent | null = null;
              let closestDist = Infinity;
              storms.forEach(s => {
                const d = Math.sqrt(Math.pow(s.lat - lat, 2) + Math.pow(s.lng - lng, 2));
                if (d < closestDist) { closest = s; closestDist = d; }
              });
              if (closest && closestDist < 0.5) handleStormClick(closest);
            }}
          />
          {/* Last updated overlay */}
          <div className="absolute bottom-3 left-3 rounded-lg bg-black/70 px-3 py-1.5 text-[10px] text-slate-400 backdrop-blur-sm">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse" />
            Live Radar · Updated {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : '—'}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Storm Feed */}
          <div className="storm-card p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Cloud className="h-4 w-4 text-storm-glow" />
                Storm Feed
                <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-bold text-red-400 animate-pulse">LIVE</span>
              </h3>
              <button onClick={fetchStorms} className="rounded-lg p-2 text-slate-400 hover:bg-storm-z2 hover:text-white transition-colors">
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {loading && storms.length === 0 ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse rounded-lg bg-storm-z2 h-16" />
                ))}
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <AlertTriangle className="h-10 w-10 text-red-500/50 mb-3" />
                <p className="text-sm text-red-400">{error}</p>
                <button onClick={fetchStorms} className="mt-3 text-xs text-storm-glow hover:underline">Try Again</button>
              </div>
            ) : storms.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Cloud className="h-10 w-10 text-slate-600 mb-3" />
                <p className="text-sm text-slate-400">No active storms in your area</p>
                <p className="text-xs text-slate-500 mt-1">Auto-refreshes every 60 seconds</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {storms.slice(0, 20).map((storm) => (
                  <button
                    key={storm.id}
                    onClick={() => handleStormClick(storm)}
                    className={`w-full text-left rounded-lg border p-3 transition-all ${
                      selectedStorm?.id === storm.id
                        ? 'border-storm-purple bg-storm-purple/10'
                        : 'border-storm-border bg-storm-z0 hover:border-storm-border-light'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${
                            storm.severity === 'severe' || storm.severity === 'extreme' ? 'bg-red-500 animate-pulse' :
                            storm.severity === 'moderate' ? 'bg-amber-500' : 'bg-yellow-500'
                          }`} />
                          <span className="text-sm font-medium text-white capitalize">{storm.type}</span>
                          {storm.isActive && <span className="text-[10px] text-emerald-400 font-bold">ACTIVE</span>}
                        </div>
                        <p className="mt-0.5 text-xs text-slate-400">{storm.location || storm.county || ''}</p>
                      </div>
                      <div className="text-right">
                        {storm.hailSize != null && storm.hailSize > 0 && (
                          <span className="text-xs text-amber-400 font-semibold">{storm.hailSize}&quot; hail</span>
                        )}
                        {storm.windSpeed != null && storm.windSpeed > 0 && (
                          <span className="block text-xs text-slate-500">{storm.windSpeed} mph</span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Nearby Properties — shown when a storm is clicked */}
          {selectedStorm && (
            <div className="storm-card p-4">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Home className="h-4 w-4 text-emerald-400" />
                Properties Near Storm
              </h3>
              {propsLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-storm-purple" />
                  <span className="ml-2 text-xs text-slate-400">Searching ATTOM...</span>
                </div>
              ) : nearbyProperties.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">No properties found near this storm</p>
              ) : (
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {nearbyProperties.map((prop, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg bg-storm-z0 border border-storm-border p-2.5">
                      <div className="min-w-0 flex-1 mr-2">
                        <p className="text-xs text-white truncate">{prop.address}</p>
                        <p className="text-[10px] text-slate-500">
                          Roof: {prop.roof?.age || '?'}yr · Est. ${(prop.claimEstimate?.total || 0).toLocaleString()}
                        </p>
                      </div>
                      <button
                        onClick={() => addToRoute({ address: prop.address, lat: prop.lat, lng: prop.lng, source: 'storm-map' })}
                        className="flex-shrink-0 rounded-md bg-emerald-500/10 p-1.5 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                        title="Add to Route"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={goToRoute}
                    className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-storm-purple/10 py-2 text-xs font-medium text-storm-glow hover:bg-storm-purple/20 transition-colors"
                  >
                    <Route className="h-3.5 w-3.5" />
                    Go to Smart Route
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// OPPORTUNITIES PANEL — Storm events, top properties, "Build Route" action
// ============================================================================

function OpportunitiesPanel({
  userLocation,
  addToRoute,
  goToRoute,
  routeStops,
}: {
  userLocation: { lat: number; lng: number };
  addToRoute: (stop: Omit<RouteStop, 'id'>) => void;
  goToRoute: () => void;
  routeStops: RouteStop[];
}) {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [topProperties, setTopProperties] = useState<OpportunityProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, totalValue: 0, avgScore: 0 });
  const [timeframe, setTimeframe] = useState('7d');
  const [expandedStorm, setExpandedStorm] = useState<string | null>(null);

  const fetchOpportunities = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        lat: String(userLocation.lat),
        lng: String(userLocation.lng),
        timeframe,
      });
      const res = await fetch(`/api/opportunities?${params}`);
      if (res.ok) {
        const data = await res.json();
        const storms = data.storms || [];
        setOpportunities(storms);
        setTopProperties(data.topProperties || []);
        setStats({
          total: storms.length,
          totalValue: data.stats?.totalOpportunityValue || 0,
          avgScore: storms.length > 0
            ? Math.round(storms.reduce((sum: number, o: Opportunity) => sum + (o.opportunityScore || 0), 0) / storms.length)
            : 0,
        });
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }, [userLocation, timeframe]);

  useEffect(() => {
    fetchOpportunities();
  }, [fetchOpportunities]);

  // "Build Route" from top properties
  const buildRoute = () => {
    topProperties.forEach(p => {
      addToRoute({
        address: `${p.address}, ${p.city}, ${p.state}`,
        source: 'opportunities',
      });
    });
    goToRoute();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-storm-purple" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="storm-card p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
              <DollarSign className="h-5 w-5 text-emerald-400" />
            </span>
            <div>
              <p className="text-2xl font-bold text-white">${(stats.totalValue / 1000).toFixed(0)}K</p>
              <p className="text-xs text-slate-400">Est. Opportunity Value</p>
            </div>
          </div>
        </div>
        <div className="storm-card p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-storm-purple/10">
              <Cloud className="h-5 w-5 text-storm-glow" />
            </span>
            <div>
              <p className="text-2xl font-bold text-white">{stats.total}</p>
              <p className="text-xs text-slate-400">Storm Events</p>
            </div>
          </div>
        </div>
        <div className="storm-card p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
              <TrendingUp className="h-5 w-5 text-amber-400" />
            </span>
            <div>
              <p className="text-2xl font-bold text-white">{stats.avgScore}%</p>
              <p className="text-xs text-slate-400">Avg Opportunity Score</p>
            </div>
          </div>
        </div>
      </div>

      {/* Timeframe Filter + Build Route */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {(['24h', '7d', '30d'] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`rounded-lg px-3.5 py-2 text-xs font-medium transition-all ${
                timeframe === tf
                  ? 'bg-storm-purple/15 text-white'
                  : 'bg-storm-z1 text-storm-muted hover:bg-storm-z2 hover:text-white border border-storm-border'
              }`}
            >
              {tf === '24h' ? 'Last 24h' : tf === '7d' ? 'Last 7 Days' : 'Last 30 Days'}
            </button>
          ))}
        </div>
        {topProperties.length > 0 && (
          <button
            onClick={buildRoute}
            className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-all border border-emerald-500/20"
          >
            <Route className="h-3.5 w-3.5" />
            Build Route from Top Properties
          </button>
        )}
      </div>

      {/* Storm Events Cards */}
      <div className="storm-card overflow-hidden">
        <div className="p-4 border-b border-storm-border">
          <h3 className="text-lg font-semibold text-white">Storm-Generated Opportunities</h3>
          <p className="text-xs text-slate-500 mt-0.5">Click a storm to see details · Click &quot;Add to Route&quot; to plan your canvass</p>
        </div>
        {opportunities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Cloud className="h-12 w-12 text-slate-600 mb-3" />
            <p className="text-sm text-slate-400">No storm opportunities found in this timeframe</p>
            <p className="text-xs text-slate-500 mt-1">Try expanding to 30 days</p>
          </div>
        ) : (
          <div className="divide-y divide-storm-border/50">
            {opportunities.slice(0, 15).map((opp) => (
              <div key={opp.id}>
                <button
                  onClick={() => setExpandedStorm(expandedStorm === opp.id ? null : opp.id)}
                  className="w-full flex items-center gap-4 p-4 hover:bg-storm-z2/50 transition-colors text-left"
                >
                  {/* Severity Dot */}
                  <span className={`flex-shrink-0 h-3 w-3 rounded-full ${
                    opp.severity === 'major' ? 'bg-red-500' :
                    opp.severity === 'moderate' ? 'bg-amber-500' : 'bg-yellow-500'
                  }`} />
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{opp.name}</p>
                    <p className="text-xs text-slate-500">{opp.location}</p>
                  </div>
                  {/* Score */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="h-2 w-14 rounded-full bg-storm-z2 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          opp.opportunityScore >= 80 ? 'bg-red-500' :
                          opp.opportunityScore >= 60 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${opp.opportunityScore}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-400 w-6 text-right">{opp.opportunityScore}</span>
                  </div>
                  {/* Hail / Wind */}
                  <div className="hidden md:block text-right flex-shrink-0 w-24">
                    {opp.hailSize > 0 && <span className="text-xs text-amber-400 font-semibold">{opp.hailSize}&quot; hail</span>}
                    {opp.windSpeed > 0 && <span className="block text-xs text-slate-500">{opp.windSpeed} mph</span>}
                  </div>
                  {/* Date */}
                  <div className="hidden md:block text-right flex-shrink-0 w-28">
                    <span className="text-xs text-slate-500">
                      {opp.date ? new Date(opp.date).toLocaleDateString() : '-'}
                    </span>
                    {opp.daysAgo <= 3 && (
                      <span className="block text-[10px] font-bold text-red-400">{opp.daysAgo}d ago — ACT NOW</span>
                    )}
                  </div>
                  {/* Chevron */}
                  {expandedStorm === opp.id
                    ? <ChevronUp className="h-4 w-4 text-slate-500 flex-shrink-0" />
                    : <ChevronDown className="h-4 w-4 text-slate-500 flex-shrink-0" />}
                </button>

                {/* Expanded detail */}
                {expandedStorm === opp.id && (
                  <div className="px-4 pb-4 bg-storm-z0/50">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                      <div className="rounded-xl bg-storm-z1 border border-storm-border p-3 text-center">
                        <p className="text-lg font-bold text-white">${(opp.estimatedDamage / 1000).toFixed(0)}K</p>
                        <p className="text-[10px] text-slate-500">Est. Damage</p>
                      </div>
                      <div className="rounded-xl bg-storm-z1 border border-storm-border p-3 text-center">
                        <p className="text-lg font-bold text-white">{opp.affectedProperties}</p>
                        <p className="text-[10px] text-slate-500">Properties</p>
                      </div>
                      <div className="rounded-xl bg-storm-z1 border border-storm-border p-3 text-center">
                        <p className="text-lg font-bold text-amber-400">{opp.hailSize}&quot;</p>
                        <p className="text-[10px] text-slate-500">Max Hail</p>
                      </div>
                      <div className="rounded-xl bg-storm-z1 border border-storm-border p-3 text-center">
                        <p className="text-lg font-bold text-white">{opp.windSpeed || 0}</p>
                        <p className="text-[10px] text-slate-500">Max Wind (mph)</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        addToRoute({
                          address: opp.location,
                          lat: opp.coordinates.lat,
                          lng: opp.coordinates.lng,
                          source: 'opportunities',
                        });
                      }}
                      className="flex items-center gap-2 rounded-lg bg-storm-purple/10 px-4 py-2 text-xs font-medium text-storm-glow hover:bg-storm-purple/20 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Storm Area to Route
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top Properties Section */}
      {topProperties.length > 0 && (
        <div className="storm-card overflow-hidden">
          <div className="p-4 border-b border-storm-border flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Home className="h-4 w-4 text-emerald-400" />
                Top Target Properties
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">ATTOM property data near highest-scoring storm</p>
            </div>
          </div>
          <div className="divide-y divide-storm-border/50">
            {topProperties.map((prop) => {
              const inRoute = routeStops.some(s => s.address.includes(prop.address));
              return (
                <div key={prop.id} className="flex items-center gap-4 p-4 hover:bg-storm-z2/50 transition-colors">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0 ${
                    prop.priority === 'hot' ? 'bg-red-500/10 text-red-400' :
                    prop.priority === 'warm' ? 'bg-amber-500/10 text-amber-400' :
                    'bg-slate-700/50 text-slate-400'
                  }`}>
                    <span className="text-xs font-bold">{prop.damageScore}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{prop.address}</p>
                    <p className="text-xs text-slate-500">
                      {prop.owner} · Roof: {prop.roofAge}yr · {prop.roofSquares} sq
                    </p>
                  </div>
                  <div className="text-right hidden md:block flex-shrink-0">
                    <p className="text-sm font-semibold text-emerald-400">${prop.opportunityValue?.toLocaleString()}</p>
                    <div className="flex gap-1 mt-0.5 justify-end">
                      {prop.tags?.map((t, i) => (
                        <span key={i} className="rounded bg-storm-z2 px-1.5 py-0.5 text-[10px] text-slate-400">{t}</span>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (!inRoute) {
                        addToRoute({
                          address: `${prop.address}, ${prop.city}, ${prop.state}`,
                          source: 'opportunities',
                        });
                      }
                    }}
                    disabled={inRoute}
                    className={`flex-shrink-0 rounded-md p-2 transition-colors ${
                      inRoute
                        ? 'bg-emerald-500/20 text-emerald-400 cursor-default'
                        : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                    }`}
                    title={inRoute ? 'Already in route' : 'Add to Route'}
                  >
                    {inRoute ? <Route className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// PROPERTY LOOKUP PANEL — Full intel card, claim estimate, "Add to Route"
// ============================================================================

function PropertyLookupPanel({
  addToRoute,
  goToRoute,
}: {
  addToRoute: (stop: Omit<RouteStop, 'id'>) => void;
  goToRoute: () => void;
}) {
  const [address, setAddress] = useState('');
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [addedToRoute, setAddedToRoute] = useState(false);

  const lookupProperty = async () => {
    if (!address.trim()) return;
    setLoading(true);
    setError('');
    setProperty(null);
    setAddedToRoute(false);

    try {
      const res = await fetch(`/api/property/lookup?address=${encodeURIComponent(address)}`);
      if (res.ok) {
        const data = await res.json();
        // API returns flat object: { address, lat, lng, owner, property, roof, ... }
        setProperty(data);
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.error || 'Property not found');
      }
    } catch {
      setError('Failed to look up property');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToRoute = () => {
    if (!property) return;
    addToRoute({
      address: property.address,
      lat: property.lat,
      lng: property.lng,
      source: 'property-lookup',
    });
    setAddedToRoute(true);
  };

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="storm-card p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Search className="h-5 w-5 text-storm-glow" />
          Property Intelligence Lookup
        </h3>
        <div className="flex gap-3">
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && lookupProperty()}
            placeholder="Enter property address (e.g., 123 Main St, Dallas, TX)"
            className="flex-1 rounded-lg border border-storm-border bg-storm-z0 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-storm-purple focus:ring-1 focus:ring-storm-purple/50"
          />
          <button
            onClick={lookupProperty}
            disabled={loading || !address.trim()}
            className="flex items-center gap-2 rounded-lg bg-storm-purple px-6 py-3 text-sm font-semibold text-white hover:bg-storm-purple-hover disabled:opacity-50 transition-all"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Search
          </button>
        </div>
        {error && (
          <p className="mt-3 text-sm text-red-400 flex items-center gap-1">
            <AlertTriangle className="h-4 w-4" /> {error}
          </p>
        )}
      </div>

      {/* Results */}
      {property && (
        <>
          {/* Action Bar */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleAddToRoute}
              disabled={addedToRoute}
              className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-all ${
                addedToRoute
                  ? 'bg-emerald-500/20 text-emerald-400 cursor-default'
                  : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20'
              }`}
            >
              {addedToRoute ? <Route className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {addedToRoute ? 'Added to Route' : 'Add to Route'}
            </button>
            {addedToRoute && (
              <button
                onClick={goToRoute}
                className="flex items-center gap-2 rounded-lg bg-storm-purple/10 px-4 py-2.5 text-xs font-medium text-storm-glow hover:bg-storm-purple/20 transition-colors"
              >
                <ArrowRight className="h-3.5 w-3.5" />
                Go to Smart Route
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {/* Property Overview */}
            <div className="storm-card p-6">
              <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-storm-glow" />
                Property Details
              </h3>
              <div className="space-y-3">
                {[
                  { label: 'Address', value: property.address },
                  { label: 'Value', value: property.property?.value ? `$${property.property.value.toLocaleString()}` : '-' },
                  { label: 'Year Built', value: property.property?.yearBuilt || '-' },
                  { label: 'Sq Ft', value: property.property?.squareFootage ? property.property.squareFootage.toLocaleString() : '-' },
                  { label: 'Lot Size', value: property.property?.lotSize ? `${property.property.lotSize.toLocaleString()} sqft` : '-' },
                  { label: 'Type', value: property.property?.buildingType || '-' },
                  { label: 'Bed / Bath', value: property.property?.bedrooms ? `${property.property.bedrooms} / ${property.property.bathrooms}` : '-' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-1.5 border-b border-storm-border/50 last:border-0">
                    <span className="text-xs text-slate-400">{item.label}</span>
                    <span className="text-xs text-white font-medium">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Owner Info */}
            <div className="storm-card p-6">
              <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                <User className="h-4 w-4 text-storm-glow" />
                Owner Information
              </h3>
              <div className="space-y-3">
                {[
                  { label: 'Name', value: property.owner?.name },
                  { label: 'Mailing Address', value: property.owner?.mailingAddress || '-' },
                  { label: 'Absentee Owner', value: property.owner?.absenteeOwner ? 'Yes' : 'No' },
                  { label: 'Last Sale', value: property.sale?.lastSaleDate ? new Date(property.sale.lastSaleDate).toLocaleDateString() : '-' },
                  { label: 'Last Sale Amount', value: property.sale?.lastSaleAmount ? `$${property.sale.lastSaleAmount.toLocaleString()}` : '-' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-1.5 border-b border-storm-border/50 last:border-0">
                    <span className="text-xs text-slate-400">{item.label}</span>
                    <span className="text-xs text-white font-medium">{item.value || '-'}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Roof Intel */}
            <div className="storm-card p-6">
              <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                <Shield className="h-4 w-4 text-amber-400" />
                Roof Intelligence
              </h3>
              <div className="space-y-3">
                {[
                  { label: 'Roof Age', value: property.roof?.age ? `${property.roof.age} years` : '-', highlight: property.roof?.age != null && property.roof.age >= 15 },
                  { label: 'Material', value: property.roof?.material || '-' },
                  { label: 'Type / Shape', value: property.roof?.type || '-' },
                  { label: 'Condition', value: property.roof?.condition || '-' },
                  { label: 'Roof Sqft', value: property.roof?.squareFootage ? property.roof.squareFootage.toLocaleString() : '-' },
                  { label: 'Complexity', value: property.roof?.complexity || '-' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-1.5 border-b border-storm-border/50 last:border-0">
                    <span className="text-xs text-slate-400">{item.label}</span>
                    <span className={`text-xs font-medium ${item.highlight ? 'text-amber-400' : 'text-white'}`}>
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Storm Exposure */}
            <div className="storm-card p-6">
              <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                <Cloud className="h-4 w-4 text-red-400" />
                Storm Exposure
              </h3>
              {property.stormExposure ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg bg-storm-z0 p-3">
                    <span className="text-xs text-slate-400">Hail Events</span>
                    <span className="text-sm font-bold text-white">{property.stormExposure.hailEvents}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-storm-z0 p-3">
                    <span className="text-xs text-slate-400">Max Hail Size</span>
                    <span className="text-sm font-bold text-amber-400">{property.stormExposure.maxHailSize}&quot;</span>
                  </div>
                  {property.stormExposure.lastStormDate && (
                    <div className="flex items-center justify-between rounded-lg bg-storm-z0 p-3">
                      <span className="text-xs text-slate-400">Last Storm</span>
                      <span className="text-sm font-bold text-white">{new Date(property.stormExposure.lastStormDate).toLocaleDateString()}</span>
                    </div>
                  )}
                  {property.stormExposure.summary && (
                    <p className="text-xs text-slate-500 italic mt-2">&quot;{property.stormExposure.summary}&quot;</p>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <Cloud className="h-8 w-8 text-slate-600 mb-2" />
                  <p className="text-xs text-slate-400">No recent storm exposure data</p>
                </div>
              )}
            </div>

            {/* Claim Estimate */}
            <div className="storm-card p-6">
              <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-400" />
                Claim Estimate
              </h3>
              {property.claimEstimate ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg bg-storm-z0 p-3">
                    <span className="text-xs text-slate-400">Roof Replacement</span>
                    <span className="text-sm font-bold text-emerald-400">${property.claimEstimate.roofReplacement?.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-storm-z0 p-3">
                    <span className="text-xs text-slate-400">Siding</span>
                    <span className="text-sm font-bold text-white">${property.claimEstimate.siding?.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-storm-z0 p-3">
                    <span className="text-xs text-slate-400">Gutters</span>
                    <span className="text-sm font-bold text-white">${property.claimEstimate.gutters?.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-3 mt-2">
                    <span className="text-sm font-semibold text-white">Total Estimate</span>
                    <span className="text-lg font-bold text-emerald-400">${property.claimEstimate.total?.toLocaleString()}</span>
                  </div>
                  <div className="text-center">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      property.claimEstimate.confidence === 'high' ? 'bg-emerald-500/10 text-emerald-400' :
                      property.claimEstimate.confidence === 'medium' ? 'bg-amber-500/10 text-amber-400' :
                      'bg-slate-700/50 text-slate-400'
                    }`}>
                      {property.claimEstimate.confidence} confidence
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <DollarSign className="h-8 w-8 text-slate-600 mb-2" />
                  <p className="text-xs text-slate-400">Insufficient data for claim estimate</p>
                </div>
              )}
            </div>

            {/* Neighborhood / Assessment */}
            <div className="storm-card p-6">
              <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                <Map className="h-4 w-4 text-storm-glow" />
                Neighborhood Intel
              </h3>
              <div className="space-y-3">
                {property.neighborhood && (
                  <>
                    <div className="flex items-center justify-between rounded-lg bg-storm-z0 p-3">
                      <span className="text-xs text-slate-400">Avg Home Value</span>
                      <span className="text-sm font-bold text-white">${property.neighborhood.avgHomeValue?.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-storm-z0 p-3">
                      <span className="text-xs text-slate-400">Avg Roof Age</span>
                      <span className="text-sm font-bold text-white">{property.neighborhood.avgRoofAge} yrs</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-storm-z0 p-3">
                      <span className="text-xs text-slate-400">Claim Likelihood</span>
                      <span className={`text-sm font-bold ${
                        (property.neighborhood.claimLikelihood || 0) >= 70 ? 'text-red-400' :
                        (property.neighborhood.claimLikelihood || 0) >= 50 ? 'text-amber-400' : 'text-slate-400'
                      }`}>{property.neighborhood.claimLikelihood}%</span>
                    </div>
                  </>
                )}
                {property.assessment && (
                  <>
                    <div className="flex items-center justify-between rounded-lg bg-storm-z0 p-3">
                      <span className="text-xs text-slate-400">Assessed Value</span>
                      <span className="text-sm font-bold text-white">${property.assessment.assessedValue?.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-storm-z0 p-3">
                      <span className="text-xs text-slate-400">Market Value</span>
                      <span className="text-sm font-bold text-white">${property.assessment.marketValue?.toLocaleString()}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// SMART ROUTE PANEL — Real routing, map display, Google Maps link
// ============================================================================

function SmartRoutePanel({
  routeStops,
  addToRoute,
  removeFromRoute,
  setRouteStops,
  userLocation,
}: {
  routeStops: RouteStop[];
  addToRoute: (stop: Omit<RouteStop, 'id'>) => void;
  removeFromRoute: (id: string) => void;
  setRouteStops: React.Dispatch<React.SetStateAction<RouteStop[]>>;
  userLocation: { lat: number; lng: number };
}) {
  const [newAddress, setNewAddress] = useState('');
  const [optimizedRoute, setOptimizedRoute] = useState<OptimizedRoute | null>(null);
  const [loading, setLoading] = useState(false);
  const [routeError, setRouteError] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Address autocomplete via Mapbox
  const handleAddressChange = (value: string) => {
    setNewAddress(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.length < 3) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
        if (!token) return;
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(value)}.json?access_token=${token}&types=address&country=us&limit=5`
        );
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data.features || []);
        }
      } catch { /* ignore */ }
    }, 300);
  };

  const addManualStop = (addr: string, lat?: number, lng?: number) => {
    addToRoute({ address: addr, lat, lng, source: 'manual' });
    setNewAddress('');
    setSuggestions([]);
  };

  // Optimize route via our API (uses Google Directions)
  const optimizeRoute = async () => {
    if (routeStops.length < 2) return;
    setLoading(true);
    setRouteError('');
    setOptimizedRoute(null);

    try {
      const waypoints = routeStops.map(s => s.address);
      const res = await fetch('/api/route-optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waypoints, optimizeWaypoints: true }),
      });

      if (res.ok) {
        const data = await res.json();
        setOptimizedRoute({
          totalDistance: data.routeInfo?.totalDistance || '-',
          totalDuration: data.routeInfo?.totalDuration || '-',
          legs: data.routeInfo?.legs || [],
          waypointOrder: data.waypointOrder || null,
          polyline: data.polyline || null,
        });

        // Reorder stops if optimized
        if (data.waypointOrder && data.waypointOrder.length > 0) {
          const middleStops = routeStops.slice(1, -1);
          const reordered = [
            routeStops[0],
            ...data.waypointOrder.map((idx: number) => middleStops[idx]),
            routeStops[routeStops.length - 1],
          ].filter(Boolean);
          setRouteStops(reordered);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        setRouteError(err.error || 'Failed to optimize route');
      }
    } catch (error) {
      console.error('Error:', error);
      setRouteError('Network error');
    } finally {
      setLoading(false);
    }
  };

  // Build Google Maps link for turn-by-turn
  const getGoogleMapsLink = () => {
    if (routeStops.length < 2) return '#';
    const origin = encodeURIComponent(routeStops[0].address);
    const destination = encodeURIComponent(routeStops[routeStops.length - 1].address);
    const waypoints = routeStops.slice(1, -1).map(s => encodeURIComponent(s.address)).join('|');
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypoints ? `&waypoints=${waypoints}` : ''}&travelmode=driving`;
  };

  // Build route markers for the map
  const routeMarkers: MapMarker[] = routeStops
    .filter(s => s.lat && s.lng)
    .map((s, i) => ({
      id: s.id,
      lat: s.lat!,
      lng: s.lng!,
      type: 'property' as const,
      popup: `#${i + 1} — ${s.address}`,
    }));

  // Calculate map center from stops
  const mapCenter = routeStops.length > 0 && routeStops[0].lat && routeStops[0].lng
    ? { lat: routeStops[0].lat!, lng: routeStops[0].lng! }
    : { lat: userLocation.lat, lng: userLocation.lng };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Route Builder */}
      <div className="space-y-4">
        <div className="storm-card p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Route className="h-5 w-5 text-storm-glow" />
            Route Builder
          </h3>

          {/* Add Stop */}
          <div className="relative mb-4">
            <input
              type="text"
              value={newAddress}
              onChange={(e) => handleAddressChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newAddress.trim()) {
                  addManualStop(newAddress.trim());
                }
              }}
              placeholder="Type an address to add a stop..."
              className="w-full rounded-lg border border-storm-border bg-storm-z0 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-storm-purple"
            />
            {suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 storm-card rounded-lg shadow-xl overflow-hidden">
                {suggestions.map((s: any) => (
                  <button
                    key={s.id}
                    onClick={() => addManualStop(s.place_name, s.center[1], s.center[0])}
                    className="w-full text-left px-4 py-3 text-sm text-slate-300 hover:bg-storm-z2 transition-colors border-b border-storm-border/50 last:border-0"
                  >
                    <MapPin className="inline h-3 w-3 mr-2 text-slate-500" />
                    {s.place_name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Stops List */}
          {routeStops.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Navigation className="h-10 w-10 text-slate-600 mb-3" />
              <p className="text-sm text-slate-400">No stops yet</p>
              <p className="text-xs text-slate-500 mt-1">Add stops manually or use Storm Map / Opportunities to add properties</p>
            </div>
          ) : (
            <div className="space-y-2 mb-4">
              {routeStops.map((stop, idx) => (
                <div key={stop.id} className="flex items-center gap-3 rounded-lg bg-storm-z0 border border-storm-border p-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-storm-purple/20 text-xs font-bold text-storm-glow flex-shrink-0">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-white truncate block">{stop.address}</span>
                    {stop.source && stop.source !== 'manual' && (
                      <span className="text-[10px] text-slate-500">via {stop.source}</span>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      removeFromRoute(stop.id);
                      setOptimizedRoute(null);
                    }}
                    className="flex-shrink-0 text-slate-500 hover:text-red-400 transition-colors"
                  >
                    <XCircle className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {routeError && (
            <p className="mb-3 text-sm text-red-400 flex items-center gap-1">
              <AlertTriangle className="h-4 w-4" /> {routeError}
            </p>
          )}

          <div className="flex gap-3">
            <button
              onClick={optimizeRoute}
              disabled={routeStops.length < 2 || loading}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-storm-purple px-4 py-3 text-sm font-semibold text-white hover:bg-storm-purple-hover disabled:opacity-50 transition-all"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              Optimize Route
            </button>
            {routeStops.length >= 2 && (
              <a
                href={getGoogleMapsLink()}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl bg-storm-z1 border border-storm-border px-4 py-3 text-sm font-medium text-slate-300 hover:bg-storm-z2 transition-all"
              >
                <ExternalLink className="h-4 w-4" />
                Google Maps
              </a>
            )}
          </div>

          {routeStops.length > 0 && (
            <button
              onClick={() => {
                setRouteStops([]);
                setOptimizedRoute(null);
              }}
              className="w-full mt-3 text-xs text-slate-500 hover:text-red-400 transition-colors"
            >
              Clear all stops
            </button>
          )}
        </div>
      </div>

      {/* Right: Map + Route Info */}
      <div className="space-y-4">
        {/* Route Map */}
        <div className="h-[350px] rounded-xl overflow-hidden border border-storm-border">
          <MapboxMap
            center={mapCenter}
            zoom={routeStops.length > 0 ? 11 : 10}
            showUserLocation
            darkMode
            markers={routeMarkers}
          />
        </div>

        {/* Route Details */}
        <div className="storm-card p-6">
          <h3 className="text-base font-semibold text-white mb-4">Route Details</h3>
          {optimizedRoute ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-storm-z0 border border-storm-border p-3 text-center">
                  <p className="text-xl font-bold text-white">{optimizedRoute.totalDistance}</p>
                  <p className="text-xs text-slate-400">Total Distance</p>
                </div>
                <div className="rounded-lg bg-storm-z0 border border-storm-border p-3 text-center">
                  <p className="text-xl font-bold text-white">{optimizedRoute.totalDuration}</p>
                  <p className="text-xs text-slate-400">Drive Time</p>
                </div>
              </div>

              {/* Leg-by-leg */}
              {optimizedRoute.legs.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Turn-by-Turn</p>
                  {optimizedRoute.legs.map((leg, idx) => (
                    <div key={idx} className="flex items-center gap-3 rounded-lg bg-storm-z0 p-2.5 border border-storm-border/50">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-storm-purple/20 text-[10px] font-bold text-storm-glow flex-shrink-0">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white truncate">{leg.endAddress}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-slate-400">{leg.distance}</p>
                        <p className="text-[10px] text-slate-500">{leg.duration}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Google Maps deep link */}
              <a
                href={getGoogleMapsLink()}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-sm font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-all"
              >
                <ExternalLink className="h-4 w-4" />
                Open in Google Maps for Navigation
              </a>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Navigation className="h-10 w-10 text-slate-600 mb-3" />
              <p className="text-sm text-slate-400">
                {routeStops.length < 2
                  ? 'Add at least 2 stops to calculate a route'
                  : 'Click "Optimize Route" to calculate'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
