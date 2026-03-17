'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  Users,
  MapPin,
  Link2,
  Trophy,
  Loader2,
  RefreshCw,
  Navigation,
  Activity,
  Battery,
  AlertTriangle,
  Map,
  Settings,
  StickyNote,
  Trash2,
} from 'lucide-react';
import type { MapMarker } from '@/components/ui/MapboxMap';

const MapboxMap = dynamic(() => import('@/components/ui/MapboxMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-storm-z0">
      <Loader2 className="h-8 w-8 animate-spin text-storm-purple" />
    </div>
  ),
});

type ActiveTab = 'performance' | 'activity' | 'field-map' | 'jobnimbus' | 'territories' | 'notes';

const tabs: { id: ActiveTab; label: string; icon: React.ElementType }[] = [
  { id: 'performance', label: 'Team Performance', icon: Trophy },
  { id: 'activity', label: 'Activity Feed', icon: Activity },
  { id: 'field-map', label: 'Live Field Map', icon: Map },
  { id: 'jobnimbus', label: 'JobNimbus', icon: Link2 },
  { id: 'territories', label: 'Territories', icon: MapPin },
  { id: 'notes', label: 'Team Notes', icon: StickyNote },
];

export default function TeamPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('performance');

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-storm-purple/15 text-storm-glow shadow-glow-sm">
              <Users className="h-5 w-5" />
            </span>
            Team
          </h1>
          <p className="mt-1 text-sm text-storm-muted">Team performance, live tracking, CRM integration, and territory management</p>
        </div>
        <Link
          href="/settings/team"
          className="flex items-center gap-2 rounded-lg border border-storm-border px-4 py-2 text-sm text-storm-muted hover:bg-storm-z2 hover:text-white transition-colors"
        >
          <Settings className="h-4 w-4" />
          Manage Team
        </Link>
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
                  ? 'bg-storm-purple/15 text-storm-glow shadow-sm'
                  : 'text-storm-muted hover:bg-storm-z2 hover:text-white'
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? 'text-storm-glow' : ''}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="min-h-[calc(100vh-14rem)]">
        {activeTab === 'performance' && <PerformancePanel />}
        {activeTab === 'activity' && <ActivityFeedPanel />}
        {activeTab === 'field-map' && <FieldMapPanel />}
        {activeTab === 'jobnimbus' && <JobNimbusPanel />}
        {activeTab === 'territories' && <TerritoriesPanel />}
        {activeTab === 'notes' && <TeamNotesPanel />}
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
    appointments?: number;
    inspections?: number;
    dealsClosed: number;
    closed?: number;
    revenue: number;
    conversionRate: number;
  };
}

interface TeamStats {
  totalDoors: number;
  totalAppointments: number;
  totalRevenue: number;
  totalClosed: number;
  avgConversion: number;
  topPerformer: string;
}

function PerformancePanel() {
  const [members, setMembers] = useState<TeamMemberPerf[]>([]);
  const [teamStats, setTeamStats] = useState<TeamStats | null>(null);
  const [goals, setGoals] = useState<{ teamGoal: number; teamRevenue: number; progress: number; members: { id?: string; name: string; goal: number; revenue: number; progress: number }[] } | null>(null);
  const [activeUserIds, setActiveUserIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('week');
  const [briefing, setBriefing] = useState<string | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);

  useEffect(() => {
    const fetchPerformance = async () => {
      try {
        const [perfRes, locRes, goalsRes] = await Promise.allSettled([
          fetch(`/api/team/performance?timeframe=${period}`),
          fetch('/api/team/locations'),
          fetch('/api/team/goals'),
        ]);
        const res = perfRes.status === 'fulfilled' ? perfRes.value : null;
        if (res?.ok) {
          const data = await res.json();
          const raw = data.members || data.data || [];
          setMembers(raw.map((m: any) => ({
            ...m,
            stats: {
              doorsKnocked: m.stats?.doorsKnocked ?? 0,
              appointmentsSet: m.stats?.appointmentsSet ?? m.stats?.appointments ?? 0,
              dealsClosed: m.stats?.dealsClosed ?? m.stats?.closed ?? 0,
              revenue: m.stats?.revenue ?? 0,
              conversionRate: m.stats?.conversionRate ?? 0,
            },
          })));
          setTeamStats(data.stats ? {
            totalDoors: data.stats.totalDoors ?? 0,
            totalAppointments: data.stats.totalAppointments ?? 0,
            totalRevenue: data.stats.totalRevenue ?? 0,
            totalClosed: data.stats.totalClosed ?? 0,
            avgConversion: data.stats.avgConversion ?? 0,
            topPerformer: data.stats.topPerformer ?? '',
          } : null);
        }
        if (locRes.status === 'fulfilled' && locRes.value.ok) {
          const loc = await locRes.value.json();
          const active = new Set<string>((loc.members || []).filter((m: any) => m.is_active).map((m: any) => m.user_id as string));
          setActiveUserIds(active);
        }
        if (goalsRes.status === 'fulfilled' && goalsRes.value.ok) {
          const g = await goalsRes.value.json();
          setGoals(g);
        } else {
          setGoals(null);
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
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-storm-purple" /></div>;
  }

  const sorted = [...members].sort((a, b) => b.stats.revenue - a.stats.revenue);
  const topPerformer = sorted[0];

  const generateBriefing = async () => {
    setBriefingLoading(true);
    setBriefing(null);
    try {
      const res = await fetch('/api/team/briefing', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setBriefing(data.briefing || '');
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setBriefingLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Period Filter + Briefing */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
        {(['today', 'week', 'month'] as const).map((p) => (
          <button
            key={p}
            onClick={() => { setPeriod(p); setLoading(true); }}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              period === p
                ? 'bg-storm-purple/15 text-storm-glow'
                : 'bg-storm-z1 text-storm-muted hover:bg-storm-z2 hover:text-white border border-storm-border'
            }`}
          >
            {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : 'This Month'}
          </button>
        ))}
        </div>
        <button
          onClick={generateBriefing}
          disabled={briefingLoading || members.length === 0}
          className="flex items-center gap-2 rounded-lg bg-storm-purple/15 px-4 py-2 text-sm font-medium text-storm-glow hover:bg-storm-purple/25 disabled:opacity-50 transition-all border border-storm-purple/30"
        >
          {briefingLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
          {briefingLoading ? 'Generating...' : 'One-Click Briefing'}
        </button>
      </div>
      {briefing && (
        <div className="storm-card p-6 border-storm-purple/20">
          <h3 className="text-sm font-semibold text-storm-glow mb-2">AI Team Briefing</h3>
          <p className="text-sm text-white whitespace-pre-wrap leading-relaxed">{briefing}</p>
        </div>
      )}

      {/* Team KPI Strip */}
      {teamStats && (teamStats.totalDoors > 0 || teamStats.totalRevenue > 0) && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="storm-card p-4">
            <p className="text-2xl font-bold text-white">{teamStats.totalDoors.toLocaleString()}</p>
            <p className="text-xs text-storm-muted">Doors Knocked</p>
          </div>
          <div className="storm-card p-4">
            <p className="text-2xl font-bold text-white">{teamStats.totalAppointments.toLocaleString()}</p>
            <p className="text-xs text-storm-muted">Appointments</p>
          </div>
          <div className="storm-card p-4">
            <p className="text-2xl font-bold text-storm-glow">{teamStats.totalClosed.toLocaleString()}</p>
            <p className="text-xs text-storm-muted">Deals Closed</p>
          </div>
          <div className="storm-card p-4">
            <p className="text-2xl font-bold text-storm-glow">${teamStats.totalRevenue.toLocaleString()}</p>
            <p className="text-xs text-storm-muted">Revenue</p>
          </div>
          <div className="storm-card p-4">
            <p className="text-2xl font-bold text-white">{Math.round(teamStats.avgConversion)}%</p>
            <p className="text-xs text-storm-muted">Avg Conversion</p>
          </div>
        </div>
      )}

      {/* Goals & Progress */}
      {goals && (goals.teamGoal > 0 || goals.members?.length) && (
        <div className="storm-card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Goals & Progress</h3>
          <div className="space-y-4">
            {goals.teamGoal > 0 && (
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-storm-muted">Team revenue goal</span>
                  <span className="text-white font-medium">${goals.teamRevenue.toLocaleString()} / ${goals.teamGoal.toLocaleString()}</span>
                </div>
                <div className="h-2 rounded-full bg-storm-z1 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-storm-purple to-storm-glow transition-all"
                    style={{ width: `${Math.min(100, goals.progress)}%` }}
                  />
                </div>
                <p className="text-xs text-storm-subtle mt-1">{goals.progress}% of monthly goal</p>
              </div>
            )}
            {goals.members?.length > 0 && (
              <div className="space-y-3">
                {goals.members.slice(0, 5).map((m) => (
                  <div key={m.id || m.name} className="flex items-center gap-3">
                    <span className="text-sm text-white w-24 truncate">{m.name}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-storm-z1 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-storm-purple/60 transition-all"
                        style={{ width: `${Math.min(100, m.progress)}%` }}
                      />
                    </div>
                    <span className="text-xs text-storm-muted w-16 text-right">{m.progress}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Top Performer - Rep of the Week / Gamification */}
      {topPerformer && topPerformer.stats.revenue > 0 && (
        <div className="rounded-xl bg-gradient-to-r from-storm-purple/10 to-storm-glow/5 border border-storm-purple/20 p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-storm-purple/20">
              <Trophy className="h-7 w-7 text-storm-glow" />
            </div>
            <div>
              <p className="text-xs text-storm-glow font-semibold uppercase tracking-wider">Rep of the Period</p>
              <p className="text-xl font-bold text-white">{topPerformer.name}</p>
              <p className="text-sm text-storm-muted">${topPerformer.stats.revenue.toLocaleString()} revenue · {topPerformer.stats.dealsClosed} deals</p>
            </div>
          </div>
        </div>
      )}
      {/* Badges - Top performers */}
      {sorted.length > 0 && (() => {
        const topKnocker = sorted.reduce((a, b) => a.stats.doorsKnocked >= b.stats.doorsKnocked ? a : b);
        const topCloser = sorted.reduce((a, b) => a.stats.dealsClosed >= b.stats.dealsClosed ? a : b);
        const hasBadges = (sorted[0]?.stats.revenue ?? 0) > 0 || topKnocker.stats.doorsKnocked > 0 || topCloser.stats.dealsClosed > 0;
        if (!hasBadges) return null;
        return (
          <div className="storm-card p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Achievements</h3>
            <div className="flex flex-wrap gap-2">
              {sorted[0] && sorted[0].stats.revenue > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-storm-purple/15 px-3 py-1 text-xs font-medium text-storm-glow">
                  <Trophy className="h-3.5 w-3.5" /> Top Earner: {sorted[0].name}
                </span>
              )}
              {topKnocker.stats.doorsKnocked > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-storm-z1 px-3 py-1 text-xs font-medium text-storm-muted">
                  <Navigation className="h-3.5 w-3.5" /> Most Doors: {topKnocker.name}
                </span>
              )}
              {topCloser.stats.dealsClosed > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-storm-success/10 px-3 py-1 text-xs font-medium text-storm-success">
                  <Activity className="h-3.5 w-3.5" /> Top Closer: {topCloser.name}
                </span>
              )}
            </div>
          </div>
        );
      })()}

      {/* Leaderboard */}
      <div className="storm-card overflow-hidden">
        <div className="p-4 border-b border-storm-border">
          <h3 className="text-lg font-semibold text-white">Team Leaderboard</h3>
        </div>
        {members.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Users className="h-12 w-12 text-storm-subtle mb-3" />
            <p className="text-sm text-storm-muted">No team performance data yet</p>
            <p className="text-xs text-storm-subtle mt-1">Create a team and invite members to see the leaderboard</p>
            <Link href="/settings/team" className="mt-4 text-sm font-medium text-storm-glow hover:text-storm-purple transition-colors">
              Go to Team Settings →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-storm-border text-left text-xs text-storm-muted uppercase tracking-wider">
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
                {sorted.map((member, idx) => (
                  <tr key={member.id} className="border-b border-storm-border/50 hover:bg-storm-z2/50 transition-colors">
                    <td className="px-4 py-3">
                      {idx === 0 ? <span className="text-amber-400 font-bold">1st</span> :
                       idx === 1 ? <span className="text-storm-muted font-medium">2nd</span> :
                       idx === 2 ? <span className="text-amber-600 font-medium">3rd</span> :
                       <span className="text-sm text-storm-subtle">{idx + 1}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {activeUserIds.has(member.id) && (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-storm-success" title="Online" />
                        )}
                        <div>
                          <p className="text-sm font-medium text-white">{member.name}</p>
                          <p className="text-xs text-storm-subtle">{member.role}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-white">{member.stats.doorsKnocked}</td>
                    <td className="px-4 py-3 text-sm text-white">{member.stats.appointmentsSet}</td>
                    <td className="px-4 py-3 text-sm text-storm-glow font-semibold">{member.stats.dealsClosed}</td>
                    <td className="px-4 py-3 text-sm text-white font-medium">${member.stats.revenue.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-medium ${
                        member.stats.conversionRate >= 20 ? 'text-storm-success' :
                        member.stats.conversionRate >= 10 ? 'text-amber-400' : 'text-storm-subtle'
                      }`}>
                        {Math.round(member.stats.conversionRate)}%
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
// ACTIVITY FEED PANEL
// ============================================================================

const ACTIVITY_LABELS: Record<string, string> = {
  door_knock: 'Door knock',
  phone_call: 'Phone call',
  email: 'Email',
  text_message: 'Text',
  appointment_set: 'Appointment set',
  appointment_completed: 'Appointment completed',
  inspection: 'Inspection',
  estimate_sent: 'Estimate sent',
  contract_signed: 'Deal closed',
  job_completed: 'Job completed',
  follow_up: 'Follow-up',
  note: 'Note',
  status_change: 'Status change',
};

function ActivityFeedPanel() {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const res = await fetch('/api/activities?scope=team&limit=50');
        if (res.ok) {
          const data = await res.json();
          setActivities(data.activities || []);
        } else {
          setActivities([]);
        }
      } catch (error) {
        console.error('Error:', error);
        setActivities([]);
      } finally {
        setLoading(false);
      }
    };
    fetchActivities();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-storm-purple" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="storm-card overflow-hidden">
        <div className="p-4 border-b border-storm-border">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Activity className="h-5 w-5 text-storm-glow" />
            Team Activity Feed
          </h3>
          <p className="text-xs text-storm-muted mt-1">Recent activity across your team</p>
        </div>
        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Activity className="h-12 w-12 text-storm-subtle mb-3" />
            <p className="text-sm text-storm-muted">No team activity yet</p>
            <p className="text-xs text-storm-subtle mt-1">Activity from door knocks, appointments, and deals will appear here</p>
            <Link href="/settings/team" className="mt-4 text-sm font-medium text-storm-glow hover:text-storm-purple transition-colors">
              Invite team members to get started
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-storm-border max-h-[500px] overflow-y-auto">
            {activities.map((a) => (
              <li key={a.id} className="p-4 hover:bg-storm-z2/50 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-storm-purple/15 text-storm-glow text-sm font-semibold">
                    {(a.user_name || '?')[0].toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white">
                      <span className="font-medium">{a.user_name || 'Team Member'}</span>
                      {' '}
                      <span className="text-storm-muted">{ACTIVITY_LABELS[a.activity_type] || a.activity_type}</span>
                      {a.leads?.address && (
                        <span className="text-storm-subtle"> at {a.leads.address}</span>
                      )}
                    </p>
                    {a.description && (
                      <p className="text-xs text-storm-subtle mt-0.5">{a.description}</p>
                    )}
                    <p className="text-xs text-storm-subtle mt-1">
                      {a.created_at ? new Date(a.created_at).toLocaleString() : ''}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    a.activity_type === 'contract_signed' ? 'bg-storm-success/10 text-storm-success' :
                    a.activity_type === 'appointment_set' ? 'bg-storm-purple/15 text-storm-glow' :
                    'bg-storm-z1 text-storm-muted'
                  }`}>
                    {ACTIVITY_LABELS[a.activity_type] || a.activity_type}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// TEAM NOTES PANEL
// ============================================================================

function TeamNotesPanel() {
  const [notes, setNotes] = useState<{ id: string; content: string; user_name: string; created_at: string; is_mine?: boolean }[]>([]);
  const [newNote, setNewNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch('/api/team/notes');
      if (res.ok) {
        const data = await res.json();
        setNotes(data.notes || []);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/team/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newNote.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setNotes((prev) => [data.note, ...prev]);
        setNewNote('');
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/team/notes?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setNotes((prev) => prev.filter((n) => n.id !== id));
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-storm-purple" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="storm-card overflow-hidden">
        <div className="p-4 border-b border-storm-border">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <StickyNote className="h-5 w-5 text-storm-glow" />
            Team Notes
          </h3>
          <p className="text-xs text-storm-muted mt-1">Shared notes for your team</p>
        </div>
        <form onSubmit={handleSubmit} className="p-4 border-b border-storm-border">
          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Add a note for the team..."
            className="w-full rounded-lg border border-storm-border bg-storm-z0 px-3 py-2 text-sm text-white placeholder-storm-subtle outline-none focus:border-storm-purple resize-none"
            rows={3}
            maxLength={5000}
          />
          <button
            type="submit"
            disabled={!newNote.trim() || submitting}
            className="mt-2 rounded-lg bg-storm-purple px-4 py-2 text-sm font-medium text-white hover:bg-storm-purple-hover disabled:opacity-50 transition-all"
          >
            {submitting ? 'Posting...' : 'Post Note'}
          </button>
        </form>
        {notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <StickyNote className="h-10 w-10 text-storm-subtle mb-2" />
            <p className="text-sm text-storm-muted">No notes yet</p>
            <p className="text-xs text-storm-subtle mt-1">Add a note to get started</p>
          </div>
        ) : (
          <ul className="divide-y divide-storm-border max-h-[400px] overflow-y-auto">
            {notes.map((n) => (
              <li key={n.id} className="p-4 hover:bg-storm-z2/50 transition-colors group">
                <p className="text-sm text-white whitespace-pre-wrap">{n.content}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-storm-subtle">{n.user_name} · {new Date(n.created_at).toLocaleString()}</span>
                  {n.is_mine && (
                    <button
                      onClick={() => handleDelete(n.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-storm-muted hover:text-red-400 transition-all"
                      title="Delete note"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
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
  user_id?: string;
  name: string;
  latitude?: number | null;
  longitude?: number | null;
  is_active: boolean;
  doors_knocked: number;
  appointments_set?: number;
  contacts_made?: number;
  battery_level?: number;
  last_activity?: string;
  updated_at: string;
}

const DEFAULT_CENTER = { lat: 32.7767, lng: -96.7970 };

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

  const membersWithLocation = teamMembers.filter((m) => m.latitude != null && m.longitude != null);
  const mapMarkers: MapMarker[] = membersWithLocation.map((m) => ({
    id: m.id,
    lat: m.latitude!,
    lng: m.longitude!,
    type: 'location',
    popup: `${m.name} · ${m.doors_knocked} doors`,
    color: m.is_active ? '#10B981' : '#64748B',
    size: m.is_active ? 12 : 8,
  }));
  const mapCenter = membersWithLocation.length > 0
    ? {
        lat: membersWithLocation.reduce((s, m) => s + m.latitude!, 0) / membersWithLocation.length,
        lng: membersWithLocation.reduce((s, m) => s + m.longitude!, 0) / membersWithLocation.length,
      }
    : DEFAULT_CENTER;
  const hasMapbox = typeof process.env.NEXT_PUBLIC_MAPBOX_TOKEN === 'string' && process.env.NEXT_PUBLIC_MAPBOX_TOKEN.length > 0;

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-storm-purple" /></div>;
  }

  const activeMembers = teamMembers.filter((m) => m.is_active);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTracking}
              className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                isTracking
                  ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25'
                  : 'bg-storm-purple/15 text-storm-glow hover:bg-storm-purple/25'
              }`}
            >
              <Navigation className={`h-4 w-4 ${isTracking ? 'animate-pulse' : ''}`} />
              {isTracking ? 'Stop Tracking' : 'Start Tracking'}
            </button>
            <button onClick={() => { setLoading(true); fetchLocations(); }} className="rounded-lg p-2.5 text-storm-muted hover:bg-storm-z2 hover:text-white transition-colors">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
          <span className="text-xs text-storm-subtle">Updated {lastUpdate.toLocaleTimeString()}</span>
        </div>

        <div className="h-[500px] storm-card overflow-hidden rounded-xl">
          {hasMapbox ? (
            <MapboxMap
              center={mapCenter}
              zoom={membersWithLocation.length > 1 ? 11 : 12}
              markers={mapMarkers}
              showUserLocation={true}
              darkMode={true}
              className="w-full h-full"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-storm-z0">
              <Map className="h-16 w-16 text-storm-subtle mx-auto mb-3" />
              <p className="text-sm text-storm-muted">{activeMembers.length} team member{activeMembers.length !== 1 ? 's' : ''} active</p>
              <p className="text-xs text-storm-subtle mt-1">Add NEXT_PUBLIC_MAPBOX_TOKEN to enable live map</p>
            </div>
          )}
        </div>
      </div>

      <div className="storm-card p-4">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-storm-glow" />
          Team ({activeMembers.length} active)
        </h3>
        {teamMembers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-10 w-10 text-storm-subtle mb-3" />
            <p className="text-sm text-storm-muted">No team members tracked</p>
            <p className="text-xs text-storm-subtle mt-1">Start tracking to share your location</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[450px] overflow-y-auto">
            {teamMembers.map((member) => (
              <div key={member.id} className="rounded-lg border border-storm-border bg-storm-z0 p-3 hover:border-storm-border-light transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`h-2 w-2 rounded-full flex-shrink-0 ${member.is_active ? 'bg-storm-success animate-pulse' : 'bg-storm-subtle'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{member.name}</p>
                    <p className="text-xs text-storm-subtle">{member.last_activity || '—'}</p>
                  </div>
                  {(member.battery_level != null) && (
                    <div className="flex items-center gap-1 text-xs text-storm-subtle">
                      <Battery className="h-3 w-3" />
                      {member.battery_level}%
                    </div>
                  )}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div className="rounded bg-storm-z1 px-2 py-1 text-center">
                    <p className="text-sm font-bold text-white">{member.doors_knocked}</p>
                    <p className="text-[10px] text-storm-subtle">Doors</p>
                  </div>
                  <div className="rounded bg-storm-z1 px-2 py-1 text-center">
                    <p className="text-sm font-bold text-storm-glow">{member.appointments_set ?? member.contacts_made ?? 0}</p>
                    <p className="text-[10px] text-storm-subtle">Appts</p>
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
        <div className="storm-card p-8 max-w-lg mx-auto text-center">
          <Link2 className="h-12 w-12 text-storm-subtle mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Connect JobNimbus</h3>
          <p className="text-sm text-storm-muted mb-6">Enter your JobNimbus API key to sync contacts, jobs, and activities.</p>
          <div className="space-y-3">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter JobNimbus API Key"
              className="w-full rounded-lg border border-storm-border bg-storm-z0 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-storm-purple"
            />
            {error && (
              <p className="text-sm text-red-400 flex items-center justify-center gap-1">
                <AlertTriangle className="h-4 w-4" /> {error}
              </p>
            )}
            <button onClick={connectJobNimbus} disabled={loading || !apiKey.trim()}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-storm-purple px-4 py-3 text-sm font-semibold text-white hover:bg-storm-purple-hover disabled:opacity-50 transition-all">
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
              <span className="flex h-3 w-3 rounded-full bg-storm-success animate-pulse" />
              <span className="text-sm text-storm-glow font-medium">Connected to JobNimbus</span>
            </div>
            <button onClick={syncData} disabled={loading}
              className="flex items-center gap-2 rounded-lg border border-storm-border px-4 py-2 text-sm text-storm-muted hover:bg-storm-z2 hover:text-white transition-colors">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Sync Now
            </button>
          </div>

          {/* Sync Stats */}
          {syncStatus && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="storm-card p-4 text-center">
                <p className="text-2xl font-bold text-white">{syncStatus.contacts || 0}</p>
                <p className="text-xs text-storm-muted">Contacts</p>
              </div>
              <div className="storm-card p-4 text-center">
                <p className="text-2xl font-bold text-white">{syncStatus.jobs || 0}</p>
                <p className="text-xs text-storm-muted">Jobs</p>
              </div>
              <div className="storm-card p-4 text-center">
                <p className="text-2xl font-bold text-white">{syncStatus.estimates || 0}</p>
                <p className="text-xs text-storm-muted">Estimates</p>
              </div>
              <div className="storm-card p-4 text-center">
                <p className="text-2xl font-bold text-storm-glow">${(syncStatus.totalValue || 0).toLocaleString()}</p>
                <p className="text-xs text-storm-muted">Pipeline</p>
              </div>
            </div>
          )}

          {/* Contacts */}
          <div className="storm-card overflow-hidden">
            <div className="p-4 border-b border-storm-border">
              <h3 className="text-lg font-semibold text-white">Recent Contacts</h3>
            </div>
            {contacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Users className="h-10 w-10 text-storm-subtle mb-3" />
                <p className="text-sm text-storm-muted">No contacts synced yet</p>
              </div>
            ) : (
              <div className="divide-y divide-storm-border/50">
                {contacts.slice(0, 15).map((contact: any, idx: number) => (
                  <div key={contact.id || idx} className="flex items-center gap-4 p-4 hover:bg-storm-z2/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">{contact.name || contact.display_name}</p>
                      <p className="text-xs text-storm-subtle">{contact.address || contact.email}</p>
                    </div>
                    {contact.status && (
                      <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-storm-z1 text-storm-muted">{contact.status}</span>
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
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-storm-purple" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <MapPin className="h-5 w-5 text-storm-glow" />
          Territory Management
        </h3>
        <button onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 rounded-lg bg-storm-purple/15 px-4 py-2 text-sm font-medium text-storm-glow hover:bg-storm-purple/25 transition-all">
          + New Territory
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="storm-card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Create Territory</h3>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-sm text-storm-muted mb-1">Name</label>
              <input type="text" value={newTerritory.name} onChange={(e) => setNewTerritory({ ...newTerritory, name: e.target.value })}
                placeholder="e.g., North Dallas" className="w-full rounded-lg border border-storm-border bg-storm-z0 px-3 py-2 text-sm text-white placeholder-storm-subtle outline-none focus:border-storm-purple" />
            </div>
            <div>
              <label className="block text-sm text-storm-muted mb-1">City</label>
              <input type="text" value={newTerritory.city} onChange={(e) => setNewTerritory({ ...newTerritory, city: e.target.value })}
                placeholder="Dallas" className="w-full rounded-lg border border-storm-border bg-storm-z0 px-3 py-2 text-sm text-white placeholder-storm-subtle outline-none focus:border-storm-purple" />
            </div>
            <div>
              <label className="block text-sm text-storm-muted mb-1">State</label>
              <input type="text" value={newTerritory.state} onChange={(e) => setNewTerritory({ ...newTerritory, state: e.target.value })}
                placeholder="TX" className="w-full rounded-lg border border-storm-border bg-storm-z0 px-3 py-2 text-sm text-white placeholder-storm-subtle outline-none focus:border-storm-purple" />
            </div>
            <div>
              <label className="block text-sm text-storm-muted mb-1">ZIP Codes</label>
              <input type="text" value={newTerritory.zip_codes} onChange={(e) => setNewTerritory({ ...newTerritory, zip_codes: e.target.value })}
                placeholder="75201, 75202, 75203" className="w-full rounded-lg border border-storm-border bg-storm-z0 px-3 py-2 text-sm text-white placeholder-storm-subtle outline-none focus:border-storm-purple" />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={createTerritory} disabled={!newTerritory.name.trim()}
              className="flex items-center gap-2 rounded-lg bg-storm-purple px-4 py-2 text-sm font-semibold text-white hover:bg-storm-purple-hover disabled:opacity-50 transition-all">
              Create Territory
            </button>
            <button onClick={() => setShowCreate(false)}
              className="rounded-lg border border-storm-border px-4 py-2 text-sm text-storm-muted hover:bg-storm-z2 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Territories Grid */}
      {territories.length === 0 ? (
        <div className="storm-card p-16 text-center">
          <MapPin className="h-12 w-12 text-storm-subtle mx-auto mb-3" />
          <p className="text-sm text-storm-muted">No territories created yet</p>
          <p className="text-xs text-storm-subtle mt-1">Create territories to assign areas to team members</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {territories.map((territory) => (
            <div key={territory.id} className="storm-card p-5 hover:border-storm-border-light transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="text-sm font-semibold text-white">{territory.name}</h4>
                  <p className="text-xs text-storm-subtle">{territory.city}, {territory.state}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  territory.status === 'active' ? 'bg-storm-success/10 text-storm-success' : 'bg-storm-z1 text-storm-muted'
                }`}>
                  {territory.status}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="rounded-lg bg-storm-z0 p-2 text-center">
                  <p className="text-lg font-bold text-white">{territory.total_properties}</p>
                  <p className="text-[10px] text-storm-subtle">Properties</p>
                </div>
                <div className="rounded-lg bg-storm-z0 p-2 text-center">
                  <p className="text-lg font-bold text-storm-glow">{territory.active_leads}</p>
                  <p className="text-[10px] text-storm-subtle">Active Leads</p>
                </div>
              </div>
              {territory.assigned_to && (
                <p className="text-xs text-storm-muted flex items-center gap-1">
                  <Users className="h-3 w-3" /> {territory.assigned_to}
                </p>
              )}
              {territory.zip_codes?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {territory.zip_codes.slice(0, 5).map((zip) => (
                    <span key={zip} className="rounded bg-storm-z0 px-1.5 py-0.5 text-[10px] text-storm-subtle">{zip}</span>
                  ))}
                  {territory.zip_codes.length > 5 && (
                    <span className="text-[10px] text-storm-subtle">+{territory.zip_codes.length - 5} more</span>
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
