'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import type { MapMarker } from '@/components/ui/MapboxMap';
import {
  Cloud,
  MapPin,
  Target,
  ClipboardList,
  Navigation,
  DoorOpen,
  DollarSign,
  Search,
  RefreshCw,
  Loader2,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  Zap,
  Eye,
  Plus,
  Filter,
  ArrowRight,
  Star,
  Home,
  Phone,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  Users,
  Route,
  Crosshair,
  BarChart3,
} from 'lucide-react';

// Lazy load the MapboxMap component
const MapboxMap = dynamic(
  () => import('@/components/ui/MapboxMap'),
  { ssr: false, loading: () => <div className="h-full w-full animate-pulse rounded-xl bg-[#111827]" /> }
);

// ============================================================================
// TYPES
// ============================================================================

interface StormEvent {
  id: string;
  type: string;
  severity: string;
  location: string;
  coordinates: { lat: number; lng: number };
  hail_size?: number;
  wind_speed?: number;
  timestamp: string;
  affected_properties?: number;
}

interface Property {
  id: string;
  address: string;
  city?: string;
  state?: string;
  zip?: string;
  owner_name?: string;
  phone?: string;
  email?: string;
  property_value?: number;
  year_built?: number;
  roof_age?: number;
  roof_type?: string;
  roof_sqft?: number;
  stories?: number;
  damage_score?: number;
  lead_score?: number;
  score_tier?: string;
  status?: string;
  last_contact?: string;
  latitude?: number;
  longitude?: number;
  distance_miles?: number;
}

interface KnockListItem {
  id: string;
  address: string;
  city?: string;
  state?: string;
  priority: string;
  score: number;
  status: string;
  notes?: string;
  attempts: number;
  last_attempt?: string;
  latitude?: number;
  longitude?: number;
}

interface DoorKnock {
  id: string;
  address: string;
  outcome: string;
  notes?: string;
  latitude?: number;
  longitude?: number;
  created_at: string;
}

interface RouteStop {
  address: string;
  lat?: number;
  lng?: number;
  priority?: string;
}

interface Opportunity {
  id: string;
  address: string;
  city?: string;
  state?: string;
  damage_score: number;
  estimated_value: number;
  storm_date?: string;
  status: string;
}

type ActiveTab = 'storm-map' | 'opportunities' | 'property-lookup' | 'lead-scoring' | 'knock-list' | 'smart-route' | 'knock-tracker';

// ============================================================================
// TAB DEFINITIONS
// ============================================================================

const tabs: { id: ActiveTab; label: string; icon: React.ElementType; badge?: string; badgeColor?: string }[] = [
  { id: 'storm-map', label: 'Storm Map', icon: Cloud, badge: 'LIVE', badgeColor: 'bg-red-500/20 text-red-400' },
  { id: 'opportunities', label: 'Opportunities', icon: DollarSign, badge: 'HOT', badgeColor: 'bg-amber-500/20 text-amber-400' },
  { id: 'property-lookup', label: 'Property Lookup', icon: Search },
  { id: 'lead-scoring', label: 'Lead Scoring', icon: Target, badge: 'AI', badgeColor: 'bg-[#6D5CFF]/20 text-[#A78BFA]' },
  { id: 'knock-list', label: 'Knock List', icon: ClipboardList },
  { id: 'smart-route', label: 'Smart Route', icon: Navigation },
  { id: 'knock-tracker', label: 'Knock Tracker', icon: DoorOpen },
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function CommandCenterPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('storm-map');

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#6D5CFF] to-[#A78BFA] shadow-lg shadow-[#6D5CFF]/20">
            <Crosshair className="h-5 w-5 text-white" />
          </span>
          Command Center
        </h1>
        <p className="mt-1 text-sm text-slate-400">Real-time storm intelligence, lead management, and route optimization</p>
      </div>

      {/* Tab Bar */}
      <div className="mb-6 flex items-center gap-1 overflow-x-auto rounded-xl bg-[#111827] p-1.5 border border-[#1F2937] scrollbar-hide">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                isActive
                  ? 'bg-[#6D5CFF]/15 text-white shadow-sm'
                  : 'text-slate-400 hover:bg-[#1E293B] hover:text-slate-300'
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? 'text-[#A78BFA]' : ''}`} />
              {tab.label}
              {tab.badge && (
                <span className={`ml-1 rounded px-1.5 py-0.5 text-[10px] font-bold ${tab.badgeColor} ${tab.badge === 'LIVE' ? 'animate-pulse' : ''}`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="min-h-[calc(100vh-14rem)]">
        {activeTab === 'storm-map' && <StormMapPanel />}
        {activeTab === 'opportunities' && <OpportunitiesPanel />}
        {activeTab === 'property-lookup' && <PropertyLookupPanel />}
        {activeTab === 'lead-scoring' && <LeadScoringPanel />}
        {activeTab === 'knock-list' && <KnockListPanel />}
        {activeTab === 'smart-route' && <SmartRoutePanel />}
        {activeTab === 'knock-tracker' && <KnockTrackerPanel />}
      </div>
    </div>
  );
}

// ============================================================================
// STORM MAP PANEL
// ============================================================================

function StormMapPanel() {
  const [storms, setStorms] = useState<StormEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStorm, setSelectedStorm] = useState<StormEvent | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  const fetchStorms = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (userLocation) {
        params.set('lat', String(userLocation.lat));
        params.set('lng', String(userLocation.lng));
      }
      const res = await fetch(`/api/storms?${params}`);
      if (res.ok) {
        const data = await res.json();
        setStorms(data.storms || data.data || []);
      }
    } catch (error) {
      console.error('Error fetching storms:', error);
    } finally {
      setLoading(false);
    }
  }, [userLocation]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setUserLocation({ lat: 32.7767, lng: -96.7970 }) // Dallas fallback
      );
    }
  }, []);

  useEffect(() => {
    if (userLocation) fetchStorms();
  }, [userLocation, fetchStorms]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Map */}
      <div className="lg:col-span-2 h-[600px] rounded-xl overflow-hidden border border-[#1F2937]">
        {userLocation ? (
          <MapboxMap
            center={{ lat: userLocation.lat, lng: userLocation.lng }}
            zoom={8}
            showUserLocation
            markers={storms.map((s: StormEvent) => ({
              id: s.id,
              lat: s.coordinates.lat,
              lng: s.coordinates.lng,
              type: (s.type === 'hail' ? 'hail' : s.type === 'tornado' ? 'tornado' : s.type === 'wind' ? 'wind' : 'storm') as MapMarker['type'],
              severity: (s.severity === 'severe' ? 'severe' : s.severity === 'moderate' ? 'moderate' : 'minor') as MapMarker['severity'],
              popup: `${s.type} - ${s.location}`,
            }))}
            onMarkerClick={(marker) => {
              const storm = storms.find((s: StormEvent) => s.id === marker.id);
              if (storm) setSelectedStorm(storm);
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-[#111827]">
            <Loader2 className="h-8 w-8 animate-spin text-[#6D5CFF]" />
          </div>
        )}
      </div>

      {/* Storm Feed */}
      <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Cloud className="h-5 w-5 text-[#A78BFA]" />
            Live Storm Feed
          </h3>
          <button onClick={fetchStorms} className="rounded-lg p-2 text-slate-400 hover:bg-[#1E293B] hover:text-white transition-colors">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse rounded-lg bg-[#1E293B] h-20" />
            ))}
          </div>
        ) : storms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Cloud className="h-12 w-12 text-slate-600 mb-3" />
            <p className="text-sm text-slate-400">No active storms in your area</p>
            <p className="text-xs text-slate-500 mt-1">We&apos;ll alert you when storms are detected</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {storms.map((storm) => (
              <button
                key={storm.id}
                onClick={() => setSelectedStorm(storm)}
                className={`w-full text-left rounded-lg border p-3 transition-all ${
                  selectedStorm?.id === storm.id
                    ? 'border-[#6D5CFF] bg-[#6D5CFF]/10'
                    : 'border-[#1F2937] bg-[#0B0F1A] hover:border-[#374151]'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${
                        storm.severity === 'severe' ? 'bg-red-500 animate-pulse' :
                        storm.severity === 'significant' ? 'bg-amber-500' : 'bg-yellow-500'
                      }`} />
                      <span className="text-sm font-medium text-white">{storm.type}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">{storm.location}</p>
                  </div>
                  <div className="text-right">
                    {storm.hail_size && (
                      <span className="text-xs text-amber-400 font-semibold">{storm.hail_size}&quot; hail</span>
                    )}
                    {storm.wind_speed && (
                      <span className="block text-xs text-slate-500">{storm.wind_speed} mph</span>
                    )}
                  </div>
                </div>
                {storm.affected_properties && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-emerald-400">
                    <Home className="h-3 w-3" />
                    {storm.affected_properties.toLocaleString()} properties affected
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// OPPORTUNITIES PANEL
// ============================================================================

function OpportunitiesPanel() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, totalValue: 0, avgScore: 0 });

  useEffect(() => {
    const fetchOpportunities = async () => {
      try {
        const res = await fetch('/api/opportunities');
        if (res.ok) {
          const data = await res.json();
          const opps = data.opportunities || data.data || [];
          setOpportunities(opps);
          setStats({
            total: opps.length,
            totalValue: opps.reduce((sum: number, o: Opportunity) => sum + (o.estimated_value || 0), 0),
            avgScore: opps.length > 0 ? Math.round(opps.reduce((sum: number, o: Opportunity) => sum + (o.damage_score || 0), 0) / opps.length) : 0,
          });
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchOpportunities();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-[#6D5CFF]" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
              <DollarSign className="h-5 w-5 text-emerald-400" />
            </span>
            <div>
              <p className="text-2xl font-bold text-white">${(stats.totalValue / 1000).toFixed(0)}K</p>
              <p className="text-xs text-slate-400">Pipeline Value</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#6D5CFF]/10">
              <Target className="h-5 w-5 text-[#A78BFA]" />
            </span>
            <div>
              <p className="text-2xl font-bold text-white">{stats.total}</p>
              <p className="text-xs text-slate-400">Active Opportunities</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
              <TrendingUp className="h-5 w-5 text-amber-400" />
            </span>
            <div>
              <p className="text-2xl font-bold text-white">{stats.avgScore}%</p>
              <p className="text-xs text-slate-400">Avg Damage Score</p>
            </div>
          </div>
        </div>
      </div>

      {/* Opportunities Table */}
      <div className="rounded-xl border border-[#1F2937] bg-[#111827] overflow-hidden">
        <div className="p-4 border-b border-[#1F2937]">
          <h3 className="text-lg font-semibold text-white">Storm-Generated Opportunities</h3>
        </div>
        {opportunities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <DollarSign className="h-12 w-12 text-slate-600 mb-3" />
            <p className="text-sm text-slate-400">No opportunities yet</p>
            <p className="text-xs text-slate-500 mt-1">Opportunities are generated when storms hit residential areas</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1F2937] text-left text-xs text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-3">Address</th>
                  <th className="px-4 py-3">Damage Score</th>
                  <th className="px-4 py-3">Est. Value</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Storm Date</th>
                </tr>
              </thead>
              <tbody>
                {opportunities.slice(0, 20).map((opp) => (
                  <tr key={opp.id} className="border-b border-[#1F2937]/50 hover:bg-[#1E293B]/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm text-white">{opp.address}</p>
                      {(opp.city || opp.state) && (
                        <p className="text-xs text-slate-500">{opp.city}, {opp.state}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-16 rounded-full bg-[#1E293B] overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              opp.damage_score >= 80 ? 'bg-red-500' :
                              opp.damage_score >= 60 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${opp.damage_score}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-400">{opp.damage_score}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-emerald-400 font-medium">
                      ${opp.estimated_value?.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        opp.status === 'new' ? 'bg-blue-500/10 text-blue-400' :
                        opp.status === 'contacted' ? 'bg-amber-500/10 text-amber-400' :
                        opp.status === 'inspection' ? 'bg-emerald-500/10 text-emerald-400' :
                        'bg-slate-700/50 text-slate-400'
                      }`}>
                        {opp.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {opp.storm_date ? new Date(opp.storm_date).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// PROPERTY LOOKUP PANEL
// ============================================================================

function PropertyLookupPanel() {
  const [address, setAddress] = useState('');
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const lookupProperty = async () => {
    if (!address.trim()) return;
    setLoading(true);
    setError('');
    setProperty(null);

    try {
      const res = await fetch(`/api/property-lookup?address=${encodeURIComponent(address)}`);
      if (res.ok) {
        const data = await res.json();
        setProperty(data.property || data);
      } else {
        const err = await res.json();
        setError(err.error || 'Property not found');
      }
    } catch {
      setError('Failed to look up property');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Search className="h-5 w-5 text-[#A78BFA]" />
          Property Intelligence Lookup
        </h3>
        <div className="flex gap-3">
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && lookupProperty()}
            placeholder="Enter property address (e.g., 123 Main St, Dallas, TX)"
            className="flex-1 rounded-lg border border-[#1F2937] bg-[#0B0F1A] px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-[#6D5CFF] focus:ring-1 focus:ring-[#6D5CFF]/50"
          />
          <button
            onClick={lookupProperty}
            disabled={loading || !address.trim()}
            className="flex items-center gap-2 rounded-lg bg-[#6D5CFF] px-6 py-3 text-sm font-semibold text-white hover:bg-[#5B4AE8] disabled:opacity-50 transition-all"
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Property Details */}
          <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Property Details</h3>
            <div className="space-y-3">
              {[
                { label: 'Address', value: property.address },
                { label: 'Owner', value: property.owner_name },
                { label: 'Property Value', value: property.property_value ? `$${property.property_value.toLocaleString()}` : '-' },
                { label: 'Year Built', value: property.year_built },
                { label: 'Roof Type', value: property.roof_type },
                { label: 'Roof Age', value: property.roof_age ? `${property.roof_age} years` : '-' },
                { label: 'Roof Sqft', value: property.roof_sqft ? property.roof_sqft.toLocaleString() : '-' },
                { label: 'Stories', value: property.stories },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between py-2 border-b border-[#1F2937]/50 last:border-0">
                  <span className="text-sm text-slate-400">{item.label}</span>
                  <span className="text-sm text-white font-medium">{item.value || '-'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Damage Assessment */}
          <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Storm Damage Assessment</h3>
            {property.damage_score !== undefined && (
              <div className="text-center py-6">
                <div className="relative mx-auto h-32 w-32">
                  <svg className="h-32 w-32 -rotate-90" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="50" fill="none" stroke="#1E293B" strokeWidth="10" />
                    <circle
                      cx="60" cy="60" r="50" fill="none"
                      stroke={property.damage_score >= 80 ? '#EF4444' : property.damage_score >= 60 ? '#F59E0B' : '#10B981'}
                      strokeWidth="10"
                      strokeDasharray={`${(property.damage_score / 100) * 314} 314`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold text-white">{property.damage_score}</span>
                    <span className="text-xs text-slate-400">Score</span>
                  </div>
                </div>
                <p className={`mt-4 text-sm font-semibold ${
                  property.damage_score >= 80 ? 'text-red-400' :
                  property.damage_score >= 60 ? 'text-amber-400' : 'text-emerald-400'
                }`}>
                  {property.damage_score >= 80 ? 'High Damage Likelihood' :
                   property.damage_score >= 60 ? 'Moderate Damage Risk' : 'Low Damage Risk'}
                </p>
              </div>
            )}
            {property.lead_score !== undefined && (
              <div className="mt-4 flex items-center justify-between rounded-lg bg-[#0B0F1A] p-3">
                <span className="text-sm text-slate-400">Lead Score</span>
                <span className={`text-lg font-bold ${
                  property.lead_score >= 80 ? 'text-emerald-400' :
                  property.lead_score >= 60 ? 'text-amber-400' : 'text-slate-400'
                }`}>{property.lead_score}/100</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// LEAD SCORING PANEL
// ============================================================================

function LeadScoringPanel() {
  const [leads, setLeads] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'ranked' | 'neighborhoods'>('ranked');

  useEffect(() => {
    const fetchLeads = async () => {
      try {
        const res = await fetch('/api/leads/score');
        if (res.ok) {
          const data = await res.json();
          setLeads(data.leads || data.data || []);
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchLeads();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-[#6D5CFF]" /></div>;
  }

  const hotLeads = leads.filter((l) => (l.lead_score || l.damage_score || 0) >= 80);
  const warmLeads = leads.filter((l) => {
    const score = l.lead_score || l.damage_score || 0;
    return score >= 50 && score < 80;
  });

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
              <Zap className="h-5 w-5 text-red-400" />
            </span>
            <div>
              <p className="text-2xl font-bold text-white">{hotLeads.length}</p>
              <p className="text-xs text-slate-400">Hot Leads (80+)</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
              <Star className="h-5 w-5 text-amber-400" />
            </span>
            <div>
              <p className="text-2xl font-bold text-white">{warmLeads.length}</p>
              <p className="text-xs text-slate-400">Warm Leads (50-79)</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#6D5CFF]/10">
              <Target className="h-5 w-5 text-[#A78BFA]" />
            </span>
            <div>
              <p className="text-2xl font-bold text-white">{leads.length}</p>
              <p className="text-xs text-slate-400">Total Scored Leads</p>
            </div>
          </div>
        </div>
      </div>

      {/* Leads Table */}
      <div className="rounded-xl border border-[#1F2937] bg-[#111827] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-[#1F2937]">
          <h3 className="text-lg font-semibold text-white">AI-Scored Leads</h3>
          <div className="flex items-center gap-1 rounded-lg bg-[#0B0F1A] p-1">
            <button
              onClick={() => setView('ranked')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                view === 'ranked' ? 'bg-[#6D5CFF]/15 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Ranked
            </button>
            <button
              onClick={() => setView('neighborhoods')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                view === 'neighborhoods' ? 'bg-[#6D5CFF]/15 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Neighborhoods
            </button>
          </div>
        </div>

        {leads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Target className="h-12 w-12 text-slate-600 mb-3" />
            <p className="text-sm text-slate-400">No scored leads yet</p>
            <p className="text-xs text-slate-500 mt-1">Leads are scored based on storm data and property characteristics</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1F2937] text-left text-xs text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Address</th>
                  <th className="px-4 py-3">Score</th>
                  <th className="px-4 py-3">Tier</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Distance</th>
                </tr>
              </thead>
              <tbody>
                {leads
                  .sort((a, b) => (b.lead_score || b.damage_score || 0) - (a.lead_score || a.damage_score || 0))
                  .slice(0, 25)
                  .map((lead, idx) => {
                    const score = lead.lead_score || lead.damage_score || 0;
                    return (
                      <tr key={lead.id} className="border-b border-[#1F2937]/50 hover:bg-[#1E293B]/50 transition-colors">
                        <td className="px-4 py-3 text-sm text-slate-500">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-white">{lead.address}</p>
                          {lead.city && <p className="text-xs text-slate-500">{lead.city}, {lead.state}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-sm font-bold ${
                            score >= 80 ? 'text-emerald-400' :
                            score >= 60 ? 'text-amber-400' : 'text-slate-400'
                          }`}>{score}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            score >= 80 ? 'bg-red-500/10 text-red-400' :
                            score >= 60 ? 'bg-amber-500/10 text-amber-400' :
                            'bg-slate-700/50 text-slate-400'
                          }`}>
                            {score >= 80 ? '🔥 Hot' : score >= 60 ? '⚡ Warm' : 'Cold'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400">{lead.status || 'New'}</td>
                        <td className="px-4 py-3 text-xs text-slate-400">
                          {lead.distance_miles ? `${lead.distance_miles.toFixed(1)} mi` : '-'}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// KNOCK LIST PANEL
// ============================================================================

function KnockListPanel() {
  const [items, setItems] = useState<KnockListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const fetchKnockList = async () => {
      try {
        const res = await fetch('/api/knock-list/properties');
        if (res.ok) {
          const data = await res.json();
          setItems(data.properties || data.data || []);
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchKnockList();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-[#6D5CFF]" /></div>;
  }

  const filteredItems = filter === 'all' ? items : items.filter((i) => i.status === filter);

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="flex items-center gap-3">
        {['all', 'pending', 'contacted', 'appointment', 'not-interested'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              filter === f
                ? 'bg-[#6D5CFF]/15 text-white'
                : 'bg-[#111827] text-slate-400 hover:bg-[#1E293B] hover:text-white border border-[#1F2937]'
            }`}
          >
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1).replace('-', ' ')} ({f === 'all' ? items.length : items.filter((i) => i.status === f).length})
          </button>
        ))}
      </div>

      {/* List */}
      <div className="rounded-xl border border-[#1F2937] bg-[#111827] overflow-hidden">
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <ClipboardList className="h-12 w-12 text-slate-600 mb-3" />
            <p className="text-sm text-slate-400">No properties in knock list</p>
            <p className="text-xs text-slate-500 mt-1">Add properties from Lead Scoring or Opportunities</p>
          </div>
        ) : (
          <div className="divide-y divide-[#1F2937]/50">
            {filteredItems.map((item) => (
              <div key={item.id} className="flex items-center gap-4 p-4 hover:bg-[#1E293B]/50 transition-colors">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                  item.priority === 'high' ? 'bg-red-500/10 text-red-400' :
                  item.priority === 'medium' ? 'bg-amber-500/10 text-amber-400' :
                  'bg-slate-700/50 text-slate-400'
                }`}>
                  <span className="text-sm font-bold">{item.score}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{item.address}</p>
                  <p className="text-xs text-slate-500">
                    {item.city}, {item.state} · {item.attempts} attempt{item.attempts !== 1 ? 's' : ''}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  item.status === 'appointment' ? 'bg-emerald-500/10 text-emerald-400' :
                  item.status === 'contacted' ? 'bg-blue-500/10 text-blue-400' :
                  item.status === 'not-interested' ? 'bg-red-500/10 text-red-400' :
                  'bg-slate-700/50 text-slate-400'
                }`}>
                  {item.status}
                </span>
                {item.last_attempt && (
                  <span className="text-xs text-slate-500 hidden md:block">
                    {new Date(item.last_attempt).toLocaleDateString()}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// SMART ROUTE PANEL
// ============================================================================

function SmartRoutePanel() {
  const [stops, setStops] = useState<RouteStop[]>([]);
  const [newAddress, setNewAddress] = useState('');
  const [optimizedRoute, setOptimizedRoute] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Address autocomplete
  const handleAddressChange = (value: string) => {
    setNewAddress(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.length < 3) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(value)}.json?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}&types=address&country=us&limit=5`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data.features || []);
        }
      } catch { /* ignore */ }
    }, 300);
  };

  const addStop = (address: string, lat?: number, lng?: number) => {
    setStops([...stops, { address, lat, lng }]);
    setNewAddress('');
    setSuggestions([]);
  };

  const removeStop = (index: number) => {
    setStops(stops.filter((_, i) => i !== index));
    setOptimizedRoute(null);
  };

  const optimizeRoute = async () => {
    if (stops.length < 2) return;
    setLoading(true);
    try {
      const res = await fetch('/api/route-optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stops: stops.map((s) => s.address) }),
      });
      if (res.ok) {
        const data = await res.json();
        setOptimizedRoute(data);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Route Builder */}
      <div className="space-y-4">
        <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Route className="h-5 w-5 text-[#A78BFA]" />
            Build Your Route
          </h3>

          {/* Add Stop */}
          <div className="relative mb-4">
            <input
              type="text"
              value={newAddress}
              onChange={(e) => handleAddressChange(e.target.value)}
              placeholder="Type an address to add a stop..."
              className="w-full rounded-lg border border-[#1F2937] bg-[#0B0F1A] px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-[#6D5CFF]"
            />
            {suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg border border-[#1F2937] bg-[#111827] shadow-xl overflow-hidden">
                {suggestions.map((s: any) => (
                  <button
                    key={s.id}
                    onClick={() => addStop(s.place_name, s.center[1], s.center[0])}
                    className="w-full text-left px-4 py-3 text-sm text-slate-300 hover:bg-[#1E293B] transition-colors border-b border-[#1F2937]/50 last:border-0"
                  >
                    <MapPin className="inline h-3 w-3 mr-2 text-slate-500" />
                    {s.place_name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Stops List */}
          {stops.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Navigation className="h-10 w-10 text-slate-600 mb-3" />
              <p className="text-sm text-slate-400">Add at least 2 stops to build a route</p>
            </div>
          ) : (
            <div className="space-y-2 mb-4">
              {stops.map((stop, idx) => (
                <div key={idx} className="flex items-center gap-3 rounded-lg bg-[#0B0F1A] border border-[#1F2937] p-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#6D5CFF]/20 text-xs font-bold text-[#A78BFA]">
                    {idx + 1}
                  </span>
                  <span className="flex-1 text-sm text-white truncate">{stop.address}</span>
                  <button onClick={() => removeStop(idx)} className="text-slate-500 hover:text-red-400 transition-colors">
                    <XCircle className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={optimizeRoute}
            disabled={stops.length < 2 || loading}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#6D5CFF] px-4 py-3 text-sm font-semibold text-white hover:bg-[#5B4AE8] disabled:opacity-50 transition-all"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            Optimize Route
          </button>
        </div>
      </div>

      {/* Route Results */}
      <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Optimized Route</h3>
        {optimizedRoute ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-[#0B0F1A] border border-[#1F2937] p-3 text-center">
                <p className="text-lg font-bold text-white">{optimizedRoute.totalDistance || '-'}</p>
                <p className="text-xs text-slate-400">Total Miles</p>
              </div>
              <div className="rounded-lg bg-[#0B0F1A] border border-[#1F2937] p-3 text-center">
                <p className="text-lg font-bold text-white">{optimizedRoute.totalTime || '-'}</p>
                <p className="text-xs text-slate-400">Est. Time</p>
              </div>
            </div>
            {optimizedRoute.optimizedOrder && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-300">Optimized Order:</p>
                {optimizedRoute.optimizedOrder.map((addr: string, idx: number) => (
                  <div key={idx} className="flex items-center gap-3 rounded-lg bg-[#0B0F1A] p-3 border border-[#1F2937]/50">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-400">
                      {idx + 1}
                    </span>
                    <span className="text-sm text-white truncate">{addr}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Navigation className="h-12 w-12 text-slate-600 mb-3" />
            <p className="text-sm text-slate-400">Add stops and optimize to see your route</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// KNOCK TRACKER PANEL
// ============================================================================

function KnockTrackerPanel() {
  const [knocks, setKnocks] = useState<DoorKnock[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLogForm, setShowLogForm] = useState(false);
  const [newKnock, setNewKnock] = useState({ address: '', outcome: 'no_answer', notes: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchKnocks = async () => {
      try {
        const res = await fetch('/api/door-knocks');
        if (res.ok) {
          const data = await res.json();
          setKnocks(data.knocks || data.data || []);
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchKnocks();
  }, []);

  const logKnock = async () => {
    if (!newKnock.address.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/door-knocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newKnock),
      });
      if (res.ok) {
        const data = await res.json();
        setKnocks([data.knock || data, ...knocks]);
        setNewKnock({ address: '', outcome: 'no_answer', notes: '' });
        setShowLogForm(false);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const outcomeIcons: Record<string, { icon: React.ElementType; color: string; label: string }> = {
    appointment: { icon: Calendar, color: 'text-emerald-400', label: 'Appointment Set' },
    interested: { icon: Star, color: 'text-amber-400', label: 'Interested' },
    not_interested: { icon: XCircle, color: 'text-red-400', label: 'Not Interested' },
    no_answer: { icon: DoorOpen, color: 'text-slate-400', label: 'No Answer' },
    callback: { icon: Phone, color: 'text-blue-400', label: 'Call Back' },
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-[#6D5CFF]" /></div>;
  }

  const todayKnocks = knocks.filter((k) => {
    const knockDate = new Date(k.created_at).toDateString();
    return knockDate === new Date().toDateString();
  });

  return (
    <div className="space-y-6">
      {/* Today's Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-4 text-center">
          <p className="text-2xl font-bold text-white">{todayKnocks.length}</p>
          <p className="text-xs text-slate-400">Today&apos;s Knocks</p>
        </div>
        <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-4 text-center">
          <p className="text-2xl font-bold text-emerald-400">{todayKnocks.filter((k) => k.outcome === 'appointment').length}</p>
          <p className="text-xs text-slate-400">Appointments</p>
        </div>
        <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-4 text-center">
          <p className="text-2xl font-bold text-amber-400">{todayKnocks.filter((k) => k.outcome === 'interested').length}</p>
          <p className="text-xs text-slate-400">Interested</p>
        </div>
        <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-4 text-center">
          <p className="text-2xl font-bold text-slate-400">
            {todayKnocks.length > 0
              ? `${Math.round((todayKnocks.filter((k) => ['appointment', 'interested'].includes(k.outcome)).length / todayKnocks.length) * 100)}%`
              : '0%'}
          </p>
          <p className="text-xs text-slate-400">Contact Rate</p>
        </div>
      </div>

      {/* Log Knock Button / Form */}
      {!showLogForm ? (
        <button
          onClick={() => setShowLogForm(true)}
          className="flex items-center gap-2 rounded-xl bg-[#6D5CFF] px-6 py-3 text-sm font-semibold text-white hover:bg-[#5B4AE8] transition-all"
        >
          <Plus className="h-4 w-4" /> Log Door Knock
        </button>
      ) : (
        <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Log Door Knock</h3>
          <div className="space-y-4">
            <input
              type="text"
              value={newKnock.address}
              onChange={(e) => setNewKnock({ ...newKnock, address: e.target.value })}
              placeholder="Property address"
              className="w-full rounded-lg border border-[#1F2937] bg-[#0B0F1A] px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-[#6D5CFF]"
            />
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {Object.entries(outcomeIcons).map(([key, { icon: Icon, color, label }]) => (
                <button
                  key={key}
                  onClick={() => setNewKnock({ ...newKnock, outcome: key })}
                  className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-xs transition-all ${
                    newKnock.outcome === key
                      ? 'border-[#6D5CFF] bg-[#6D5CFF]/10'
                      : 'border-[#1F2937] bg-[#0B0F1A] hover:border-[#374151]'
                  }`}
                >
                  <Icon className={`h-5 w-5 ${color}`} />
                  <span className="text-slate-300">{label}</span>
                </button>
              ))}
            </div>
            <textarea
              value={newKnock.notes}
              onChange={(e) => setNewKnock({ ...newKnock, notes: e.target.value })}
              placeholder="Notes (optional)"
              rows={2}
              className="w-full rounded-lg border border-[#1F2937] bg-[#0B0F1A] px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-[#6D5CFF] resize-none"
            />
            <div className="flex gap-3">
              <button
                onClick={logKnock}
                disabled={!newKnock.address.trim() || submitting}
                className="flex items-center gap-2 rounded-lg bg-[#6D5CFF] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#5B4AE8] disabled:opacity-50 transition-all"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                Save
              </button>
              <button
                onClick={() => setShowLogForm(false)}
                className="rounded-lg border border-[#1F2937] px-6 py-2.5 text-sm text-slate-400 hover:bg-[#1E293B] transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Knock History */}
      <div className="rounded-xl border border-[#1F2937] bg-[#111827] overflow-hidden">
        <div className="p-4 border-b border-[#1F2937]">
          <h3 className="text-lg font-semibold text-white">Recent Door Knocks</h3>
        </div>
        {knocks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <DoorOpen className="h-12 w-12 text-slate-600 mb-3" />
            <p className="text-sm text-slate-400">No door knocks logged yet</p>
          </div>
        ) : (
          <div className="divide-y divide-[#1F2937]/50">
            {knocks.slice(0, 20).map((knock) => {
              const info = outcomeIcons[knock.outcome] || outcomeIcons.no_answer;
              const Icon = info.icon;
              return (
                <div key={knock.id} className="flex items-center gap-4 p-4 hover:bg-[#1E293B]/50 transition-colors">
                  <Icon className={`h-5 w-5 ${info.color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{knock.address}</p>
                    {knock.notes && <p className="text-xs text-slate-500 truncate">{knock.notes}</p>}
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${info.color}`}>
                    {info.label}
                  </span>
                  <span className="text-xs text-slate-500 hidden md:block">
                    {new Date(knock.created_at).toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
