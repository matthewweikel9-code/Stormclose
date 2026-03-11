'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users,
  MapPin,
  BarChart3,
  Link2,
  Trophy,
  Target,
  Phone,
  DoorOpen,
  Calendar,
  Clock,
  Loader2,
  RefreshCw,
  Navigation,
  Activity,
  Battery,
  ChevronRight,
  AlertTriangle,
  Zap,
  Settings,
  ExternalLink,
  Map,
  Star,
  Award,
  TrendingUp,
} from 'lucide-react';

type ActiveTab = 'performance' | 'field-map' | 'jobnimbus' | 'territories';

const tabs: { id: ActiveTab; label: string; icon: React.ElementType }[] = [
  { id: 'performance', label: 'Team Performance', icon: Trophy },
  { id: 'field-map', label: 'Live Field Map', icon: Map },
  { id: 'jobnimbus', label: 'JobNimbus', icon: Link2 },
  { id: 'territories', label: 'Territories', icon: MapPin },
];

export default function TeamPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('performance');

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/20">
            <Users className="h-5 w-5 text-white" />
          </span>
          Team
        </h1>
        <p className="mt-1 text-sm text-slate-400">Team performance, live tracking, CRM integration, and territory management</p>
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
                  ? 'bg-emerald-500/15 text-white shadow-sm'
                  : 'text-slate-400 hover:bg-[#1E293B] hover:text-slate-300'
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? 'text-emerald-400' : ''}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="min-h-[calc(100vh-14rem)]">
        {activeTab === 'performance' && <PerformancePanel />}
        {activeTab === 'field-map' && <FieldMapPanel />}
        {activeTab === 'jobnimbus' && <JobNimbusPanel />}
        {activeTab === 'territories' && <TerritoriesPanel />}
      </div>
    </div>
  );
}

// ============================================================================
// TEAM PERFORMANCE PANEL
// ============================================================================

interface TeamMemberPerf {
  id: string;
  name: string;
  role: string;
  avatar?: string;
  stats: {
    doorsKnocked: number;
    appointmentsSet: number;
    inspections: number;
    dealsClosed: number;
    revenue: number;
    conversionRate: number;
  };
}

function PerformancePanel() {
  const [members, setMembers] = useState<TeamMemberPerf[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('week');

  useEffect(() => {
    const fetchPerformance = async () => {
      try {
        const res = await fetch(`/api/team/performance?period=${period}`);
        if (res.ok) {
          const data = await res.json();
          setMembers(data.members || data.data || []);
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchPerformance();
  }, [period]);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>;
  }

  const topPerformer = members.sort((a, b) => b.stats.revenue - a.stats.revenue)[0];

  return (
    <div className="space-y-6">
      {/* Period Filter */}
      <div className="flex items-center gap-2">
        {(['today', 'week', 'month'] as const).map((p) => (
          <button
            key={p}
            onClick={() => { setPeriod(p); setLoading(true); }}
            className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition-all ${
              period === p
                ? 'bg-emerald-500/15 text-emerald-400'
                : 'bg-[#111827] text-slate-400 hover:bg-[#1E293B] hover:text-white border border-[#1F2937]'
            }`}
          >
            {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : 'This Month'}
          </button>
        ))}
      </div>

      {/* Top Performer */}
      {topPerformer && (
        <div className="rounded-xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20">
              <Trophy className="h-7 w-7 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-emerald-400 font-semibold uppercase tracking-wider">Top Performer</p>
              <p className="text-xl font-bold text-white">{topPerformer.name}</p>
              <p className="text-sm text-slate-400">${topPerformer.stats.revenue.toLocaleString()} revenue · {topPerformer.stats.dealsClosed} deals</p>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard */}
      <div className="rounded-xl border border-[#1F2937] bg-[#111827] overflow-hidden">
        <div className="p-4 border-b border-[#1F2937]">
          <h3 className="text-lg font-semibold text-white">Team Leaderboard</h3>
        </div>
        {members.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Users className="h-12 w-12 text-slate-600 mb-3" />
            <p className="text-sm text-slate-400">No team performance data</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1F2937] text-left text-xs text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Doors</th>
                  <th className="px-4 py-3">Appts</th>
                  <th className="px-4 py-3">Deals</th>
                  <th className="px-4 py-3">Revenue</th>
                  <th className="px-4 py-3">Conv %</th>
                </tr>
              </thead>
              <tbody>
                {members
                  .sort((a, b) => b.stats.revenue - a.stats.revenue)
                  .map((member, idx) => (
                    <tr key={member.id} className="border-b border-[#1F2937]/50 hover:bg-[#1E293B]/50 transition-colors">
                      <td className="px-4 py-3">
                        {idx === 0 ? <span className="text-amber-400">🥇</span> :
                         idx === 1 ? <span className="text-slate-400">🥈</span> :
                         idx === 2 ? <span className="text-amber-600">🥉</span> :
                         <span className="text-sm text-slate-500">{idx + 1}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-white">{member.name}</p>
                        <p className="text-xs text-slate-500">{member.role}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-white">{member.stats.doorsKnocked}</td>
                      <td className="px-4 py-3 text-sm text-white">{member.stats.appointmentsSet}</td>
                      <td className="px-4 py-3 text-sm text-emerald-400 font-semibold">{member.stats.dealsClosed}</td>
                      <td className="px-4 py-3 text-sm text-white font-medium">${member.stats.revenue.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={`text-sm font-medium ${
                          member.stats.conversionRate >= 20 ? 'text-emerald-400' :
                          member.stats.conversionRate >= 10 ? 'text-amber-400' : 'text-slate-400'
                        }`}>
                          {member.stats.conversionRate}%
                        </span>
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
// LIVE FIELD MAP PANEL
// ============================================================================

interface FieldTeamMember {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  is_active: boolean;
  doors_knocked: number;
  appointments_set: number;
  battery_level: number;
  last_activity: string;
  updated_at: string;
}

function FieldMapPanel() {
  const [teamMembers, setTeamMembers] = useState<FieldTeamMember[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const watchIdRef = useRef<number | null>(null);

  const fetchLocations = useCallback(async () => {
    try {
      const res = await fetch('/api/team/locations');
      if (res.ok) {
        const data = await res.json();
        setTeamMembers(data.members || []);
        setLastUpdate(new Date());
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLocations();
    const interval = setInterval(fetchLocations, 30000);
    return () => clearInterval(interval);
  }, [fetchLocations]);

  const toggleTracking = () => {
    if (isTracking) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setIsTracking(false);
    } else {
      if (!navigator.geolocation) return;
      setIsTracking(true);
      watchIdRef.current = navigator.geolocation.watchPosition(
        async (pos) => {
          try {
            await fetch('/api/team/locations', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                accuracy: pos.coords.accuracy,
                heading: pos.coords.heading || 0,
                speed: pos.coords.speed || 0,
                battery_level: 100,
              }),
            });
          } catch { /* ignore */ }
        },
        () => setIsTracking(false),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
      );
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>;
  }

  const activeMembers = teamMembers.filter((m) => m.is_active);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Map placeholder + controls */}
      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTracking}
              className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                isTracking
                  ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25'
                  : 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
              }`}
            >
              <Navigation className={`h-4 w-4 ${isTracking ? 'animate-pulse' : ''}`} />
              {isTracking ? 'Stop Tracking' : 'Start Tracking'}
            </button>
            <button onClick={fetchLocations} className="rounded-lg p-2.5 text-slate-400 hover:bg-[#1E293B] hover:text-white transition-colors">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
          <span className="text-xs text-slate-500">Updated {lastUpdate.toLocaleTimeString()}</span>
        </div>

        <div className="h-[500px] rounded-xl border border-[#1F2937] bg-[#111827] flex items-center justify-center">
          <div className="text-center">
            <Map className="h-16 w-16 text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-400">{activeMembers.length} team member{activeMembers.length !== 1 ? 's' : ''} active</p>
            <p className="text-xs text-slate-500 mt-1">Live GPS tracking map</p>
          </div>
        </div>
      </div>

      {/* Team List */}
      <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-4">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-emerald-400" />
          Team ({activeMembers.length} active)
        </h3>
        {teamMembers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-10 w-10 text-slate-600 mb-3" />
            <p className="text-sm text-slate-400">No team members tracked</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[450px] overflow-y-auto">
            {teamMembers.map((member) => (
              <div key={member.id} className="rounded-lg border border-[#1F2937] bg-[#0B0F1A] p-3">
                <div className="flex items-center gap-3">
                  <div className={`h-2 w-2 rounded-full ${member.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{member.name}</p>
                    <p className="text-xs text-slate-500">{member.last_activity}</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <Battery className="h-3 w-3" />
                    {member.battery_level}%
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div className="rounded bg-[#111827] px-2 py-1 text-center">
                    <p className="text-sm font-bold text-white">{member.doors_knocked}</p>
                    <p className="text-[10px] text-slate-500">Doors</p>
                  </div>
                  <div className="rounded bg-[#111827] px-2 py-1 text-center">
                    <p className="text-sm font-bold text-emerald-400">{member.appointments_set}</p>
                    <p className="text-[10px] text-slate-500">Appts</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// JOBNIMBUS PANEL
// ============================================================================

function JobNimbusPanel() {
  const [connected, setConnected] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const res = await fetch('/api/jobnimbus/status');
        if (res.ok) {
          const data = await res.json();
          setConnected(data.connected);
          if (data.connected) {
            setSyncStatus(data.syncStatus);
          }
        }
      } catch { /* ignore */ }
    };
    checkConnection();
  }, []);

  const connectJobNimbus = async () => {
    if (!apiKey.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/jobnimbus/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Connection failed');
      setConnected(true);
      setContacts(data.contacts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setLoading(false);
    }
  };

  const syncData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/jobnimbus/sync', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setSyncStatus(data);
        setContacts(data.contacts || []);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {!connected ? (
        <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-8 max-w-lg mx-auto text-center">
          <Link2 className="h-12 w-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Connect JobNimbus</h3>
          <p className="text-sm text-slate-400 mb-6">Enter your JobNimbus API key to sync contacts, jobs, and activities.</p>
          <div className="space-y-3">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter JobNimbus API Key"
              className="w-full rounded-lg border border-[#1F2937] bg-[#0B0F1A] px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-[#6D5CFF]"
            />
            {error && (
              <p className="text-sm text-red-400 flex items-center justify-center gap-1">
                <AlertTriangle className="h-4 w-4" /> {error}
              </p>
            )}
            <button onClick={connectJobNimbus} disabled={loading || !apiKey.trim()}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#6D5CFF] px-4 py-3 text-sm font-semibold text-white hover:bg-[#5B4AE8] disabled:opacity-50 transition-all">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              Connect
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Sync Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-sm text-emerald-400 font-medium">Connected to JobNimbus</span>
            </div>
            <button onClick={syncData} disabled={loading}
              className="flex items-center gap-2 rounded-lg border border-[#1F2937] px-4 py-2 text-sm text-slate-400 hover:bg-[#1E293B] hover:text-white transition-colors">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Sync Now
            </button>
          </div>

          {/* Sync Stats */}
          {syncStatus && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-4 text-center">
                <p className="text-2xl font-bold text-white">{syncStatus.contacts || 0}</p>
                <p className="text-xs text-slate-400">Contacts</p>
              </div>
              <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-4 text-center">
                <p className="text-2xl font-bold text-white">{syncStatus.jobs || 0}</p>
                <p className="text-xs text-slate-400">Jobs</p>
              </div>
              <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-4 text-center">
                <p className="text-2xl font-bold text-white">{syncStatus.estimates || 0}</p>
                <p className="text-xs text-slate-400">Estimates</p>
              </div>
              <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-4 text-center">
                <p className="text-2xl font-bold text-emerald-400">${(syncStatus.totalValue || 0).toLocaleString()}</p>
                <p className="text-xs text-slate-400">Pipeline</p>
              </div>
            </div>
          )}

          {/* Contacts */}
          <div className="rounded-xl border border-[#1F2937] bg-[#111827] overflow-hidden">
            <div className="p-4 border-b border-[#1F2937]">
              <h3 className="text-lg font-semibold text-white">Recent Contacts</h3>
            </div>
            {contacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Users className="h-10 w-10 text-slate-600 mb-3" />
                <p className="text-sm text-slate-400">No contacts synced yet</p>
              </div>
            ) : (
              <div className="divide-y divide-[#1F2937]/50">
                {contacts.slice(0, 15).map((contact: any, idx: number) => (
                  <div key={contact.id || idx} className="flex items-center gap-4 p-4 hover:bg-[#1E293B]/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">{contact.name || contact.display_name}</p>
                      <p className="text-xs text-slate-500">{contact.address || contact.email}</p>
                    </div>
                    {contact.status && (
                      <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-slate-700/50 text-slate-400">{contact.status}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// TERRITORIES PANEL
// ============================================================================

interface Territory {
  id: string;
  name: string;
  assigned_to: string;
  city: string;
  state: string;
  zip_codes: string[];
  total_properties: number;
  active_leads: number;
  status: string;
  created_at: string;
}

function TerritoriesPanel() {
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTerritory, setNewTerritory] = useState({ name: '', city: '', state: '', zip_codes: '' });

  useEffect(() => {
    const fetchTerritories = async () => {
      try {
        const res = await fetch('/api/territories');
        if (res.ok) {
          const data = await res.json();
          setTerritories(data.territories || data.data || []);
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchTerritories();
  }, []);

  const createTerritory = async () => {
    if (!newTerritory.name.trim()) return;
    try {
      const res = await fetch('/api/territories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newTerritory,
          zip_codes: newTerritory.zip_codes.split(',').map((z) => z.trim()),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setTerritories([data.territory || data, ...territories]);
        setNewTerritory({ name: '', city: '', state: '', zip_codes: '' });
        setShowCreate(false);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <MapPin className="h-5 w-5 text-emerald-400" />
          Territory Management
        </h3>
        <button onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 rounded-lg bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-400 hover:bg-emerald-500/25 transition-all">
          + New Territory
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Create Territory</h3>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Name</label>
              <input type="text" value={newTerritory.name} onChange={(e) => setNewTerritory({ ...newTerritory, name: e.target.value })}
                placeholder="e.g., North Dallas" className="w-full rounded-lg border border-[#1F2937] bg-[#0B0F1A] px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">City</label>
              <input type="text" value={newTerritory.city} onChange={(e) => setNewTerritory({ ...newTerritory, city: e.target.value })}
                placeholder="Dallas" className="w-full rounded-lg border border-[#1F2937] bg-[#0B0F1A] px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">State</label>
              <input type="text" value={newTerritory.state} onChange={(e) => setNewTerritory({ ...newTerritory, state: e.target.value })}
                placeholder="TX" className="w-full rounded-lg border border-[#1F2937] bg-[#0B0F1A] px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">ZIP Codes</label>
              <input type="text" value={newTerritory.zip_codes} onChange={(e) => setNewTerritory({ ...newTerritory, zip_codes: e.target.value })}
                placeholder="75201, 75202, 75203" className="w-full rounded-lg border border-[#1F2937] bg-[#0B0F1A] px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500" />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={createTerritory} disabled={!newTerritory.name.trim()}
              className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50 transition-all">
              Create Territory
            </button>
            <button onClick={() => setShowCreate(false)}
              className="rounded-lg border border-[#1F2937] px-4 py-2 text-sm text-slate-400 hover:bg-[#1E293B] transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Territories Grid */}
      {territories.length === 0 ? (
        <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-16 text-center">
          <MapPin className="h-12 w-12 text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-400">No territories created yet</p>
          <p className="text-xs text-slate-500 mt-1">Create territories to assign areas to team members</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {territories.map((territory) => (
            <div key={territory.id} className="rounded-xl border border-[#1F2937] bg-[#111827] p-5 hover:border-[#374151] transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="text-sm font-semibold text-white">{territory.name}</h4>
                  <p className="text-xs text-slate-500">{territory.city}, {territory.state}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  territory.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700/50 text-slate-400'
                }`}>
                  {territory.status}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="rounded-lg bg-[#0B0F1A] p-2 text-center">
                  <p className="text-lg font-bold text-white">{territory.total_properties}</p>
                  <p className="text-[10px] text-slate-500">Properties</p>
                </div>
                <div className="rounded-lg bg-[#0B0F1A] p-2 text-center">
                  <p className="text-lg font-bold text-emerald-400">{territory.active_leads}</p>
                  <p className="text-[10px] text-slate-500">Active Leads</p>
                </div>
              </div>
              {territory.assigned_to && (
                <p className="text-xs text-slate-400 flex items-center gap-1">
                  <Users className="h-3 w-3" /> {territory.assigned_to}
                </p>
              )}
              {territory.zip_codes?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {territory.zip_codes.slice(0, 5).map((zip) => (
                    <span key={zip} className="rounded bg-[#0B0F1A] px-1.5 py-0.5 text-[10px] text-slate-500">{zip}</span>
                  ))}
                  {territory.zip_codes.length > 5 && (
                    <span className="text-[10px] text-slate-600">+{territory.zip_codes.length - 5} more</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
