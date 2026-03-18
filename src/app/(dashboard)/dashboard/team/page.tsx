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
  DoorOpen,
  Calendar,
  Zap,
  DollarSign,
  Target,
  Brain,
  TrendingUp,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
  { id: 'performance', label: 'Performance', icon: Trophy },
  { id: 'activity', label: 'Activity', icon: Activity },
  { id: 'field-map', label: 'Live Map', icon: Map },
  { id: 'jobnimbus', label: 'JobNimbus', icon: Link2 },
  { id: 'territories', label: 'Territories', icon: MapPin },
  { id: 'notes', label: 'Notes', icon: StickyNote },
];

function formatRevenue(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export default function TeamPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('performance');

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-storm-purple/20 to-storm-glow/10 shadow-glow-sm">
            <Users className="h-6 w-6 text-storm-glow" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Company</h1>
            <p className="mt-0.5 text-sm text-storm-muted">Performance, live tracking, and territory management</p>
          </div>
        </div>
        <Link
          href="/settings/team"
          className="button-secondary flex items-center gap-2 text-sm"
        >
          <Settings className="h-4 w-4" />
          Manage Company
        </Link>
      </div>

      {/* Tab Bar */}
      <div className="mb-6 glass rounded-2xl p-1.5 overflow-x-auto scrollbar-hide">
        <div className="flex items-center gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-storm-purple/15 text-storm-glow shadow-glow-sm'
                    : 'text-storm-muted hover:bg-storm-z2/60 hover:text-white'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-storm-glow' : ''}`} />
                {tab.label}
                {isActive && (
                  <div className="absolute inset-x-3 -bottom-[7px] h-[2px] rounded-full bg-gradient-to-r from-storm-purple to-storm-glow" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="min-h-[calc(100vh-14rem)] animate-fade-in">
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

// ════════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ════════════════════════════════════════════════════════════════

function RankMedal({ rank }: { rank: number }) {
  if (rank === 0) {
    return (
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400/30 to-orange-500/20 text-amber-400 text-sm font-bold border border-amber-500/30 shadow-[0_0_8px_rgba(245,158,11,0.25)]">
        1
      </span>
    );
  }
  if (rank === 1) {
    return (
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-slate-300/20 to-slate-400/10 text-slate-300 text-sm font-bold border border-slate-400/20">
        2
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-700/25 to-orange-800/15 text-amber-600 text-sm font-bold border border-amber-700/25">
        3
      </span>
    );
  }
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-storm-z2 text-storm-subtle text-sm font-bold border border-storm-border/50">
      {rank + 1}
    </span>
  );
}

function SkeletonRows({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="skeleton h-9 w-9 rounded-xl" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-4 w-3/4 rounded" />
            <div className="skeleton h-2 w-1/2 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// TEAM PERFORMANCE PANEL
// ════════════════════════════════════════════════════════════════

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
    return (
      <div className="space-y-5 animate-fade-in">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 stagger-children">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="storm-card p-5 space-y-3">
              <div className="skeleton h-10 w-10 rounded-xl" />
              <div className="skeleton h-7 w-20 rounded-lg" />
              <div className="skeleton h-3 w-16 rounded" />
            </div>
          ))}
        </div>
        <div className="storm-card"><SkeletonRows count={5} /></div>
      </div>
    );
  }

  const sorted = [...members].sort((a, b) => b.stats.revenue - a.stats.revenue);
  const topPerformer = sorted[0];
  const maxRevenue = Math.max(...sorted.map((m) => m.revenue ?? m.stats.revenue), 1);
  const topKnocker = sorted.length > 0 ? sorted.reduce((a, b) => a.stats.doorsKnocked >= b.stats.doorsKnocked ? a : b) : null;
  const topCloser = sorted.length > 0 ? sorted.reduce((a, b) => a.stats.dealsClosed >= b.stats.dealsClosed ? a : b) : null;

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
    <div className="space-y-5">
      {/* Period Filter + Briefing */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1 rounded-xl bg-storm-z1 p-1 border border-storm-border">
          {(['today', 'week', 'month'] as const).map((p) => (
            <button
              key={p}
              onClick={() => { setPeriod(p); setLoading(true); }}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
                period === p
                  ? 'bg-storm-purple/15 text-storm-glow shadow-sm'
                  : 'text-storm-muted hover:bg-storm-z2 hover:text-white'
              }`}
            >
              {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : 'This Month'}
            </button>
          ))}
        </div>
        <button
          onClick={generateBriefing}
          disabled={briefingLoading || members.length === 0}
          className="button-secondary flex items-center gap-2 text-sm"
        >
          {briefingLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4 text-storm-glow" />}
          {briefingLoading ? 'Generating...' : 'AI Briefing'}
        </button>
      </div>

      {/* AI Briefing */}
      {briefing && (
        <div className="storm-card-glow overflow-hidden border-storm-purple/20">
          <div className="glow-line" />
          <div className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="rounded-lg bg-storm-purple/15 p-1.5">
                <Brain className="h-4 w-4 text-storm-glow" />
              </div>
              <h3 className="text-sm font-semibold text-white">AI Team Briefing</h3>
              <Badge variant="purple">AI Generated</Badge>
            </div>
            <p className="text-sm text-storm-muted whitespace-pre-wrap leading-relaxed">{briefing}</p>
          </div>
        </div>
      )}

      {/* KPI Row */}
      {teamStats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 stagger-children">
          <KpiCard icon={<DoorOpen className="h-5 w-5" />} iconBg="bg-blue-500/15" iconColor="text-blue-400" accentBorder="border-blue-500/20" label="Doors Knocked" value={teamStats.totalDoors} />
          <KpiCard icon={<Calendar className="h-5 w-5" />} iconBg="bg-storm-purple/15" iconColor="text-storm-glow" accentBorder="border-storm-purple/20" label="Appointments" value={teamStats.totalAppointments} />
          <KpiCard icon={<Zap className="h-5 w-5" />} iconBg="bg-emerald-500/15" iconColor="text-emerald-400" accentBorder="border-emerald-500/20" label="Deals Closed" value={teamStats.totalClosed} />
          <KpiCard icon={<DollarSign className="h-5 w-5" />} iconBg="bg-amber-500/15" iconColor="text-amber-400" accentBorder="border-amber-500/20" label="Revenue" value={teamStats.totalRevenue} prefix="$" />
          <KpiCard icon={<Target className="h-5 w-5" />} iconBg="bg-cyan-500/15" iconColor="text-cyan-400" accentBorder="border-cyan-500/20" label="Avg Conversion" value={Math.round(teamStats.avgConversion)} suffix="%" />
        </div>
      )}

      {/* Goals & Progress */}
      {goals && (goals.teamGoal > 0 || (goals.members?.length ?? 0) > 0) && (
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-storm-glow" />
              <h3 className="text-sm font-semibold text-white">Monthly Goals</h3>
            </div>
            {goals.teamGoal > 0 && (
              <span className="text-2xl font-bold text-gradient-purple tabular-nums">{goals.progress}%</span>
            )}
          </div>
          {goals.teamGoal > 0 && (
            <div className="mb-4">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-storm-muted">Team revenue goal</span>
                <span className="text-white font-medium tabular-nums">{formatRevenue(goals.teamRevenue)} / {formatRevenue(goals.teamGoal)}</span>
              </div>
              <div className="h-2.5 rounded-full bg-storm-z1 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-storm-purple to-storm-glow transition-all duration-700 ease-out"
                  style={{ width: `${Math.min(100, goals.progress)}%` }}
                />
              </div>
            </div>
          )}
          {(goals.members?.length ?? 0) > 0 && (
            <div className="space-y-2.5">
              {goals.members.slice(0, 5).map((m) => (
                <div key={m.id || m.name} className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-storm-z2 text-2xs font-bold text-storm-muted border border-storm-border/50">
                    {m.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm text-white w-24 truncate font-medium">{m.name}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-storm-z1 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-storm-purple/60 to-storm-glow/40 transition-all duration-500"
                      style={{ width: `${Math.min(100, m.progress)}%` }}
                    />
                  </div>
                  <span className="text-xs text-storm-muted w-20 text-right tabular-nums">{formatRevenue(m.revenue)}</span>
                  <span className="text-2xs text-storm-subtle w-10 text-right tabular-nums">{m.progress}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Top Performer */}
      {topPerformer && topPerformer.stats.revenue > 0 && (
        <div className="storm-card-glow overflow-hidden border-amber-500/20">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
          <div className="p-5">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400/20 to-orange-500/10 shadow-[0_0_16px_rgba(245,158,11,0.2)]">
                <Trophy className="h-7 w-7 text-amber-400" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-amber-400 font-semibold uppercase tracking-wider">Rep of the Period</p>
                <p className="text-xl font-bold text-white mt-0.5">{topPerformer.name}</p>
              </div>
              <div className="flex gap-2">
                <div className="rounded-xl bg-storm-z2/50 border border-storm-border/50 px-3 py-2 text-center">
                  <p className="text-sm font-bold text-amber-400 tabular-nums">{formatRevenue(topPerformer.stats.revenue)}</p>
                  <p className="text-2xs text-storm-subtle">Revenue</p>
                </div>
                <div className="rounded-xl bg-storm-z2/50 border border-storm-border/50 px-3 py-2 text-center">
                  <p className="text-sm font-bold text-emerald-400 tabular-nums">{topPerformer.stats.dealsClosed}</p>
                  <p className="text-2xs text-storm-subtle">Deals</p>
                </div>
                <div className="rounded-xl bg-storm-z2/50 border border-storm-border/50 px-3 py-2 text-center">
                  <p className="text-sm font-bold text-white tabular-nums">{topPerformer.stats.doorsKnocked}</p>
                  <p className="text-2xs text-storm-subtle">Doors</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Achievement Badges */}
      {sorted.length > 0 && (() => {
        const hasBadges = (sorted[0]?.stats.revenue ?? 0) > 0 || (topKnocker?.stats.doorsKnocked ?? 0) > 0 || (topCloser?.stats.dealsClosed ?? 0) > 0;
        if (!hasBadges) return null;
        return (
          <div className="flex flex-wrap gap-2">
            {sorted[0] && sorted[0].stats.revenue > 0 && (
              <Badge variant="warning"><Trophy className="h-3 w-3" /> Top Earner: {sorted[0].name}</Badge>
            )}
            {topKnocker && topKnocker.stats.doorsKnocked > 0 && (
              <Badge variant="info"><DoorOpen className="h-3 w-3" /> Most Doors: {topKnocker.name}</Badge>
            )}
            {topCloser && topCloser.stats.dealsClosed > 0 && (
              <Badge variant="success"><Zap className="h-3 w-3" /> Top Closer: {topCloser.name}</Badge>
            )}
          </div>
        );
      })()}

      {/* Leaderboard */}
      <div className="storm-card overflow-hidden">
        <div className="glow-line" />
        <div className="flex items-center justify-between p-4 pb-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-white">Team Leaderboard</h3>
          </div>
          {sorted.length > 0 && (
            <Badge variant="default">{sorted.length} members</Badge>
          )}
        </div>
        {members.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-storm-z2 mb-3">
              <Users className="h-7 w-7 text-storm-subtle" />
            </div>
            <p className="text-sm font-medium text-white">No team performance data yet</p>
            <p className="text-xs text-storm-subtle mt-1">Create a team and invite members to see the leaderboard</p>
            <Link href="/settings/team" className="button-secondary mt-4 text-xs">
              Go to Team Settings
            </Link>
          </div>
        ) : (
          <div className="space-y-0 px-4 pb-4 stagger-children">
            {sorted.map((member, idx) => (
              <div
                key={member.id}
                className="flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-storm-z2/50"
              >
                <RankMedal rank={idx} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {activeUserIds.has(member.id) && (
                      <span className="status-dot-live flex-shrink-0" />
                    )}
                    <span className="text-sm font-medium text-white truncate">{member.name}</span>
                    <span className="text-2xs text-storm-subtle">{member.role}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-storm-z2 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-storm-purple to-storm-glow transition-all duration-700 ease-out"
                        style={{ width: `${Math.max((member.stats.revenue / maxRevenue) * 100, 4)}%` }}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-right flex-shrink-0">
                  <div>
                    <p className="text-sm font-bold text-storm-glow tabular-nums">{formatRevenue(member.stats.revenue)}</p>
                    <p className="text-2xs text-storm-subtle">Revenue</p>
                  </div>
                  <div className="hidden md:block">
                    <p className="text-sm font-medium text-white tabular-nums">{member.stats.doorsKnocked}</p>
                    <p className="text-2xs text-storm-subtle">Doors</p>
                  </div>
                  <div className="hidden md:block">
                    <p className="text-sm font-medium text-emerald-400 tabular-nums">{member.stats.dealsClosed}</p>
                    <p className="text-2xs text-storm-subtle">Deals</p>
                  </div>
                  <div className="hidden lg:block">
                    <p className={`text-sm font-medium tabular-nums ${
                      member.stats.conversionRate >= 20 ? 'text-emerald-400' :
                      member.stats.conversionRate >= 10 ? 'text-amber-400' : 'text-storm-subtle'
                    }`}>{Math.round(member.stats.conversionRate)}%</p>
                    <p className="text-2xs text-storm-subtle">Conv</p>
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

function KpiCard({ icon, iconBg, iconColor, accentBorder, label, value, prefix = '', suffix = '' }: {
  icon: React.ReactNode; iconBg: string; iconColor: string; accentBorder: string; label: string; value: number; prefix?: string; suffix?: string;
}) {
  return (
    <div className={`storm-card-glow relative overflow-hidden border ${accentBorder} p-5`}>
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-storm-purple/30 to-transparent" />
      <div className="flex items-center justify-between mb-2">
        <div className={`rounded-xl p-2 ${iconBg}`}>
          <span className={iconColor}>{icon}</span>
        </div>
      </div>
      <p className="text-2xl font-bold text-white tabular-nums animate-count-up">
        {prefix}{value.toLocaleString()}{suffix}
      </p>
      <p className="mt-0.5 text-xs uppercase tracking-wider text-storm-subtle font-medium">{label}</p>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// ACTIVITY FEED PANEL
// ════════════════════════════════════════════════════════════════

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

const ACTIVITY_COLORS: Record<string, string> = {
  door_knock: 'from-blue-500/20 to-blue-600/10 text-blue-400',
  phone_call: 'from-emerald-500/20 to-emerald-600/10 text-emerald-400',
  appointment_set: 'from-storm-purple/20 to-storm-glow/10 text-storm-glow',
  contract_signed: 'from-amber-500/20 to-amber-600/10 text-amber-400',
  inspection: 'from-orange-500/20 to-orange-600/10 text-orange-400',
  estimate_sent: 'from-cyan-500/20 to-cyan-600/10 text-cyan-400',
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
    return (
      <div className="storm-card animate-fade-in">
        <div className="p-4 border-b border-storm-border">
          <div className="skeleton h-5 w-40 rounded" />
        </div>
        <SkeletonRows count={6} />
      </div>
    );
  }

  return (
    <div className="storm-card overflow-hidden">
      <div className="glow-line" />
      <div className="flex items-center justify-between p-4 pb-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-storm-glow" />
          <h3 className="text-sm font-semibold text-white">Team Activity Feed</h3>
          {activities.length > 0 && (
            <Badge variant="default">{activities.length}</Badge>
          )}
        </div>
        <p className="text-2xs text-storm-subtle">Recent activity across your team</p>
      </div>
      {activities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-storm-z2 mb-3">
            <Activity className="h-7 w-7 text-storm-subtle" />
          </div>
          <p className="text-sm font-medium text-white">No team activity yet</p>
          <p className="text-xs text-storm-subtle mt-1">Activity from door knocks, appointments, and deals will appear here</p>
          <Link href="/settings/team" className="button-secondary mt-4 text-xs">
            Invite team members
          </Link>
        </div>
      ) : (
        <div className="max-h-[600px] overflow-y-auto stagger-children">
          {activities.map((a) => {
            const colorCls = ACTIVITY_COLORS[a.activity_type] || 'from-storm-z2 to-storm-z1 text-storm-muted';
            const badgeVariant = a.activity_type === 'contract_signed' ? 'success' as const
              : a.activity_type === 'appointment_set' ? 'purple' as const
              : 'default' as const;
            return (
              <div key={a.id} className="flex items-start gap-3 px-4 py-3.5 hover:bg-storm-z2/30 transition-colors border-l-2 border-transparent hover:border-storm-purple/30">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${colorCls} text-sm font-semibold`}>
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
                    <p className="text-xs text-storm-subtle mt-0.5 line-clamp-1">{a.description}</p>
                  )}
                  <p className="text-2xs text-storm-subtle mt-1">
                    {a.created_at ? new Date(a.created_at).toLocaleString() : ''}
                  </p>
                </div>
                <Badge variant={badgeVariant} className="shrink-0">
                  {ACTIVITY_LABELS[a.activity_type] || a.activity_type}
                </Badge>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// TEAM NOTES PANEL
// ════════════════════════════════════════════════════════════════

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
    return <div className="storm-card animate-fade-in"><SkeletonRows count={4} /></div>;
  }

  return (
    <div className="storm-card overflow-hidden">
      <div className="glow-line" />
      <div className="p-4 pb-3">
        <div className="flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-storm-glow" />
          <h3 className="text-sm font-semibold text-white">Company Notes</h3>
          {notes.length > 0 && <Badge variant="default">{notes.length}</Badge>}
        </div>
        <p className="text-2xs text-storm-subtle mt-1">Shared notes visible to the entire team</p>
      </div>
      <form onSubmit={handleSubmit} className="px-4 pb-4">
        <div className="glass-subtle rounded-xl p-3">
          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Add a note for the team..."
            className="w-full bg-transparent text-sm text-white placeholder-storm-subtle outline-none resize-none"
            rows={3}
            maxLength={5000}
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-2xs text-storm-subtle">{newNote.length}/5000</span>
            <button
              type="submit"
              disabled={!newNote.trim() || submitting}
              className="button-primary text-xs px-3 py-1.5"
            >
              {submitting ? 'Posting...' : 'Post Note'}
            </button>
          </div>
        </div>
      </form>
      {notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-storm-z2 mb-3">
            <StickyNote className="h-6 w-6 text-storm-subtle" />
          </div>
          <p className="text-sm font-medium text-white">No notes yet</p>
          <p className="text-xs text-storm-subtle mt-1">Add a note to get started</p>
        </div>
      ) : (
        <div className="divide-y divide-storm-border/30 max-h-[400px] overflow-y-auto">
          {notes.map((n) => (
            <div key={n.id} className="px-4 py-3.5 hover:bg-storm-z2/30 transition-colors group">
              <p className="text-sm text-white whitespace-pre-wrap leading-relaxed">{n.content}</p>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-5 w-5 items-center justify-center rounded-md bg-storm-z2 text-[10px] font-bold text-storm-muted">
                    {n.user_name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-2xs text-storm-subtle">{n.user_name} · {new Date(n.created_at).toLocaleString()}</span>
                </div>
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// LIVE FIELD MAP PANEL
// ════════════════════════════════════════════════════════════════

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
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 animate-fade-in">
        <div className="lg:col-span-2 skeleton h-[500px] rounded-2xl" />
        <div className="storm-card"><SkeletonRows count={4} /></div>
      </div>
    );
  }

  const activeMembers = teamMembers.filter((m) => m.is_active);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTracking}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                isTracking
                  ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/20'
                  : 'bg-storm-purple/15 text-storm-glow hover:bg-storm-purple/25 border border-storm-purple/20'
              }`}
            >
              <Navigation className={`h-4 w-4 ${isTracking ? 'animate-pulse' : ''}`} />
              {isTracking ? 'Stop Tracking' : 'Start Tracking'}
            </button>
            <button onClick={() => { setLoading(true); fetchLocations(); }} className="rounded-xl p-2.5 text-storm-muted hover:bg-storm-z2 hover:text-white transition-colors border border-storm-border">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-2 text-xs text-storm-subtle">
            <span className="status-dot-live" />
            Updated {lastUpdate.toLocaleTimeString()}
          </div>
        </div>

        <div className="h-[500px] storm-card overflow-hidden rounded-2xl">
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
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-storm-z2 mb-3">
                <Map className="h-8 w-8 text-storm-subtle" />
              </div>
              <p className="text-sm font-medium text-white">{activeMembers.length} team member{activeMembers.length !== 1 ? 's' : ''} active</p>
              <p className="text-xs text-storm-subtle mt-1">Add NEXT_PUBLIC_MAPBOX_TOKEN to enable live map</p>
            </div>
          )}
        </div>
      </div>

      <div className="storm-card overflow-hidden">
        <div className="glow-line" />
        <div className="p-4 pb-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-storm-glow" />
            <h3 className="text-sm font-semibold text-white">Team</h3>
            <Badge variant={activeMembers.length > 0 ? 'success' : 'default'}>
              {activeMembers.length > 0 && <span className="status-dot-live mr-1" />}
              {activeMembers.length} active
            </Badge>
          </div>
        </div>
        {teamMembers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-storm-z2 mb-3">
              <Users className="h-6 w-6 text-storm-subtle" />
            </div>
            <p className="text-sm font-medium text-white">No team members tracked</p>
            <p className="text-xs text-storm-subtle mt-1">Start tracking to share your location</p>
          </div>
        ) : (
          <div className="space-y-1.5 px-3 pb-3 max-h-[450px] overflow-y-auto">
            {teamMembers.map((member) => (
              <div key={member.id} className="rounded-xl border border-storm-border/50 bg-storm-z0/50 p-3 hover:border-storm-border-light transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${member.is_active ? 'bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.6)] animate-pulse' : 'bg-storm-subtle'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{member.name}</p>
                    <p className="text-2xs text-storm-subtle">{member.last_activity || '—'}</p>
                  </div>
                  {(member.battery_level != null) && (
                    <div className="flex items-center gap-1 text-2xs text-storm-subtle">
                      <Battery className="h-3 w-3" />
                      {member.battery_level}%
                    </div>
                  )}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  <div className="rounded-lg bg-storm-z1/80 px-2 py-1 text-center">
                    <p className="text-sm font-bold text-white tabular-nums">{member.doors_knocked}</p>
                    <p className="text-[10px] text-storm-subtle">Doors</p>
                  </div>
                  <div className="rounded-lg bg-storm-z1/80 px-2 py-1 text-center">
                    <p className="text-sm font-bold text-storm-glow tabular-nums">{member.appointments_set ?? member.contacts_made ?? 0}</p>
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

// ════════════════════════════════════════════════════════════════
// JOBNIMBUS PANEL
// ════════════════════════════════════════════════════════════════

function JobNimbusPanel() {
  const [connected, setConnected] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const res = await fetch('/api/jobnimbus/status');
        if (res.ok) {
          const data = await res.json();
          setConnected(data.connected);
          if (data.connected) {
            setSyncStatus(data.syncStatus);
            setLastSynced(data.syncStatus?.lastSynced || null);
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
        setLastSynced(new Date().toISOString());
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {!connected ? (
        <div className="storm-card-glow p-8 max-w-lg mx-auto text-center border-storm-purple/20">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-storm-purple/15 mx-auto mb-4">
            <Link2 className="h-7 w-7 text-storm-glow" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Connect JobNimbus</h3>
          <p className="text-sm text-storm-muted mb-2">Sync your StormClose data to JobNimbus so your leads, appointments, and deals flow directly into your CRM.</p>
          <p className="text-xs text-storm-subtle mb-6">StormClose handles the field work — JobNimbus handles the pipeline.</p>
          <div className="space-y-3">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter JobNimbus API Key"
              className="dashboard-input"
            />
            {error && (
              <p className="text-sm text-red-400 flex items-center justify-center gap-1">
                <AlertTriangle className="h-4 w-4" /> {error}
              </p>
            )}
            <button onClick={connectJobNimbus} disabled={loading || !apiKey.trim()}
              className="button-primary w-full flex items-center justify-center gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              Connect
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15">
                  <Link2 className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">JobNimbus Connected</span>
                    <span className="status-dot-live" />
                  </div>
                  <p className="text-2xs text-storm-subtle mt-0.5">
                    {lastSynced ? `Last synced ${new Date(lastSynced).toLocaleString()}` : 'Ready to sync'}
                  </p>
                </div>
              </div>
              <button onClick={syncData} disabled={loading}
                className="button-secondary flex items-center gap-2 text-sm">
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Sync Now
              </button>
            </div>

            {syncStatus && (
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-storm-z2/50 border border-storm-border/50 p-3 text-center">
                  <p className="text-lg font-bold text-white tabular-nums">{syncStatus.contacts || 0}</p>
                  <p className="text-2xs text-storm-subtle">Records Synced</p>
                </div>
                <div className="rounded-xl bg-storm-z2/50 border border-storm-border/50 p-3 text-center">
                  <p className="text-lg font-bold text-white tabular-nums">{syncStatus.jobs || 0}</p>
                  <p className="text-2xs text-storm-subtle">Jobs Created</p>
                </div>
                <div className="rounded-xl bg-storm-z2/50 border border-storm-border/50 p-3 text-center">
                  <p className="text-lg font-bold text-emerald-400 tabular-nums">{syncStatus.estimates || 0}</p>
                  <p className="text-2xs text-storm-subtle">Estimates Pushed</p>
                </div>
              </div>
            )}
          </div>

          <div className="storm-card p-5">
            <h3 className="text-sm font-semibold text-white mb-1">How it works</h3>
            <p className="text-xs text-storm-subtle mb-4">StormClose automatically pushes your field data to JobNimbus. Manage your pipeline, contacts, and estimates inside JobNimbus.</p>
            <div className="space-y-2.5">
              <div className="flex items-center gap-3 text-sm">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/15 text-blue-400 text-xs font-bold">1</div>
                <span className="text-storm-muted">Your reps knock doors and log activity in StormClose</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-storm-purple/15 text-storm-glow text-xs font-bold">2</div>
                <span className="text-storm-muted">Leads, appointments, and deals sync to JobNimbus</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400 text-xs font-bold">3</div>
                <span className="text-storm-muted">Manage your pipeline and estimates in JobNimbus</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// TERRITORIES PANEL
// ════════════════════════════════════════════════════════════════

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
    return (
      <div className="space-y-5 animate-fade-in">
        <div className="skeleton h-10 w-48 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
          {[1, 2, 3].map((i) => (
            <div key={i} className="storm-card p-5 space-y-3">
              <div className="skeleton h-5 w-32 rounded" />
              <div className="skeleton h-3 w-24 rounded" />
              <div className="grid grid-cols-2 gap-2">
                <div className="skeleton h-14 rounded-lg" />
                <div className="skeleton h-14 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-storm-glow" />
          <h3 className="text-sm font-semibold text-white">Territory Management</h3>
          {territories.length > 0 && <Badge variant="default">{territories.length}</Badge>}
        </div>
        <button onClick={() => setShowCreate(!showCreate)}
          className="button-secondary flex items-center gap-2 text-sm">
          + New Territory
        </button>
      </div>

      {showCreate && (
        <div className="storm-card p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Create Territory</h3>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-2xs text-storm-subtle uppercase tracking-wider mb-1.5 font-medium">Name</label>
              <input type="text" value={newTerritory.name} onChange={(e) => setNewTerritory({ ...newTerritory, name: e.target.value })}
                placeholder="e.g., North Dallas" className="dashboard-input" />
            </div>
            <div>
              <label className="block text-2xs text-storm-subtle uppercase tracking-wider mb-1.5 font-medium">City</label>
              <input type="text" value={newTerritory.city} onChange={(e) => setNewTerritory({ ...newTerritory, city: e.target.value })}
                placeholder="Dallas" className="dashboard-input" />
            </div>
            <div>
              <label className="block text-2xs text-storm-subtle uppercase tracking-wider mb-1.5 font-medium">State</label>
              <input type="text" value={newTerritory.state} onChange={(e) => setNewTerritory({ ...newTerritory, state: e.target.value })}
                placeholder="TX" className="dashboard-input" />
            </div>
            <div>
              <label className="block text-2xs text-storm-subtle uppercase tracking-wider mb-1.5 font-medium">ZIP Codes</label>
              <input type="text" value={newTerritory.zip_codes} onChange={(e) => setNewTerritory({ ...newTerritory, zip_codes: e.target.value })}
                placeholder="75201, 75202, 75203" className="dashboard-input" />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={createTerritory} disabled={!newTerritory.name.trim()}
              className="button-primary text-sm">
              Create Territory
            </button>
            <button onClick={() => setShowCreate(false)}
              className="button-secondary text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {territories.length === 0 ? (
        <div className="storm-card p-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-storm-z2 mx-auto mb-3">
            <MapPin className="h-7 w-7 text-storm-subtle" />
          </div>
          <p className="text-sm font-medium text-white">No territories created yet</p>
          <p className="text-xs text-storm-subtle mt-1">Create territories to assign areas to team members</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
          {territories.map((territory) => (
            <div key={territory.id} className="storm-card-interactive p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="text-sm font-semibold text-white">{territory.name}</h4>
                  <p className="text-2xs text-storm-subtle mt-0.5">{territory.city}, {territory.state}</p>
                </div>
                <Badge variant={territory.status === 'active' ? 'success' : 'default'}>
                  {territory.status}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="rounded-xl bg-storm-z2/50 border border-storm-border/50 p-2.5 text-center">
                  <p className="text-lg font-bold text-white tabular-nums">{territory.total_properties}</p>
                  <p className="text-[10px] text-storm-subtle">Properties</p>
                </div>
                <div className="rounded-xl bg-storm-z2/50 border border-storm-border/50 p-2.5 text-center">
                  <p className="text-lg font-bold text-storm-glow tabular-nums">{territory.active_leads}</p>
                  <p className="text-[10px] text-storm-subtle">Active Leads</p>
                </div>
              </div>
              {territory.assigned_to && (
                <p className="text-2xs text-storm-muted flex items-center gap-1">
                  <Users className="h-3 w-3" /> {territory.assigned_to}
                </p>
              )}
              {territory.zip_codes?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {territory.zip_codes.slice(0, 5).map((zip) => (
                    <span key={zip} className="rounded-md bg-storm-z2/50 border border-storm-border/30 px-1.5 py-0.5 text-[10px] text-storm-subtle">{zip}</span>
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
