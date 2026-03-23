'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { User } from '@supabase/supabase-js';
import Link from 'next/link';
import {
  ArrowRight,
  Phone,
  MapPin,
  Clock,
  ChevronRight,
  Zap,
  Navigation,
  CloudRain,
  Cloud,
  Crosshair,
  Loader2,
  Sun,
  CloudLightning,
  Droplets,
  Wind,
  Brain,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  AlertTriangle,
  Route,
  Activity,
  Upload,
  Target,
} from 'lucide-react';
import { SkeletonDashboard } from '@/components/ui/skeleton';
import { OnboardingChecklist } from '@/components/dashboard/OnboardingChecklist';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface RevenueHubData {
  success: boolean;
  data: {
    kpis: {
      closedValue: number;
      activeOpportunities: number;
      dealsClosed: number;
    };
    goals: {
      daily_door_knock_goal: number;
      daily_call_goal: number;
    };
    todayCounts: {
      doorKnocks: number;
      phoneCalls: number;
      appointments: number;
    };
    recentActivities: Array<{
      id: string;
      activity_type: string;
      created_at: string;
      leads?: { id: string; address: string; city: string };
    }>;
    hotLeads: Array<{
      id: string;
      address: string;
      city: string;
      state: string;
      lead_score: number;
      status: string;
      phone?: string;
      estimated_claim?: number;
      score_reasons?: string[];
    }>;
    overdue: Array<{
      id: string;
      address: string;
      city: string;
      state: string;
      lead_score: number;
      status: string;
      phone?: string;
      days_overdue: number;
    }>;
    hailAlerts: {
      events: Array<{
        size_inches?: number;
        size?: number;
        distance_miles?: number;
      }>;
    };
  };
}

interface ForecastDay {
  date: string;
  dayOfWeek: string;
  highF: number;
  lowF: number;
  precipChance: number;
  windGustMph: number;
  severeRisk: string;
}

interface DailyBriefing {
  headline: string;
  summary: string;
  actions: string[];
  opportunity_score: number;
  weather_advisory: string;
  best_time_to_canvas: string;
}

interface BriefingRaw {
  stormCount: number;
  maxHailSize: number;
  hotLeadCount: number;
}

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

interface DashboardContentProps {
  user: User;
  subscriptionStatus: string;
  subscriptionTier: string;
  logoutAction: () => Promise<void>;
  forbiddenError?: boolean;
}

export function DashboardContent({ user, forbiddenError }: DashboardContentProps) {
  const userName = user.user_metadata?.full_name?.split(' ')[0] || user.email?.split('@')[0] || 'there';

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<RevenueHubData | null>(null);
  const [forecast, setForecast] = useState<ForecastDay[]>([]);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [briefingRaw, setBriefingRaw] = useState<BriefingRaw | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [briefingExpanded, setBriefingExpanded] = useState(true);
  const [nearbyLeads, setNearbyLeads] = useState<any[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const hasFetchedRef = useRef(false);
  const [jobnimbusConnected, setJobnimbusConnected] = useState(false);
  const [exportingLeadIds, setExportingLeadIds] = useState<Set<string>>(new Set());
  const [exportedLeadIds, setExportedLeadIds] = useState<Set<string>>(new Set());
  const [dataError, setDataError] = useState<string | null>(null);
  const [briefingUpgradeRequired, setBriefingUpgradeRequired] = useState(false);

  useEffect(() => {
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchDashboardData();
      autoDetectLocation();
    }
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setDataError(null);
      const res = await fetch('/api/dashboard/revenue-hub');
      if (res.ok) {
        setStats(await res.json());
      } else {
        const err = await res.json().catch(() => ({}));
        setDataError((err as { error?: string })?.error || 'Failed to load dashboard');
      }
    } catch {
      setDataError('Failed to load dashboard. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const applyLocation = useCallback((loc: { lat: number; lng: number }) => {
    setUserLocation(loc);
    setLocationError(null);
    fetchForecast(loc.lat, loc.lng);
    fetchBriefing(loc.lat, loc.lng);
    fetchNearbyLeads(loc.lat, loc.lng);
  }, []);

  const autoDetectLocation = useCallback(() => {
    setLocationError(null);
    let resolved = false;
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolved = true;
          applyLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => setLocationError('Location denied. Set default in Settings.'),
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 }
      );
    } else {
      fetch('/api/user/location')
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (data?.latitude != null && data?.longitude != null) {
            resolved = true;
            applyLocation({ lat: data.latitude, lng: data.longitude });
          } else setLocationError('Set default location in Settings.');
        })
        .catch(() => setLocationError('Location unavailable.'));
    }
  }, [applyLocation]);

  const fetchForecast = async (lat: number, lng: number) => {
    setForecastLoading(true);
    try {
      const res = await fetch(`/api/weather/forecast?lat=${lat}&lng=${lng}`);
      if (res.ok) {
        const data = await res.json();
        setForecast(data.forecast || []);
      }
    } catch {
      /* noop */
    } finally {
      setForecastLoading(false);
    }
  };

  const fetchBriefing = async (lat: number, lng: number) => {
    setBriefingLoading(true);
    setBriefingUpgradeRequired(false);
    try {
      const res = await fetch(`/api/ai/daily-briefing?lat=${lat}&lng=${lng}`);
      if (res.ok) {
        const data = await res.json();
        setBriefing(data.briefing);
        setBriefingRaw(data.raw);
      } else if (res.status === 402) {
        setBriefingUpgradeRequired(true);
      }
    } catch {
      /* noop */
    } finally {
      setBriefingLoading(false);
    }
  };

  const fetchNearbyLeads = async (lat: number, lng: number) => {
    try {
      const res = await fetch(`/api/leads/nearby?lat=${lat}&lng=${lng}&radius=10&limit=6`);
      if (res.ok) {
        const data = await res.json();
        setNearbyLeads(data.leads || []);
      }
    } catch {
      /* noop */
    }
  };

  useEffect(() => {
    fetch('/api/jobnimbus/status')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => data && setJobnimbusConnected(!!data.connected))
      .catch(() => {});
  }, []);

  const exportLeadToJobnimbus = useCallback(async (leadId: string) => {
    setExportingLeadIds((p) => new Set(p).add(leadId));
    try {
      const res = await fetch('/api/integrations/jobnimbus/export-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId }),
      });
      const data = await res.json();
      if (res.ok && (data.success || data.alreadyExported)) {
        setExportedLeadIds((p) => new Set(p).add(leadId));
      }
    } catch {
      /* noop */
    } finally {
      setExportingLeadIds((p) => { const n = new Set(p); n.delete(leadId); return n; });
    }
  }, []);

  const formatCurrency = (v: number) => (v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v.toFixed(0)}`);
  const formatActivityType = (t: string) => {
    const m: Record<string, string> = {
      door_knock: 'Door Knock', phone_call: 'Call', appointment_set: 'Appointment',
      inspection: 'Inspection', estimate_sent: 'Estimate', deal_closed: 'Closed',
      contract_signed: 'Signed', follow_up: 'Follow-up',
    };
    return m[t] || t;
  };
  const getActivityIcon = (t: string) => {
    const icons: Record<string, React.ReactNode> = {
      door_knock: <MapPin className="w-3 h-3 text-blue-400" />,
      phone_call: <Phone className="w-3 h-3 text-green-400" />,
      appointment_set: <Cloud className="w-3 h-3 text-purple-400" />,
      inspection: <Target className="w-3 h-3 text-orange-400" />,
      deal_closed: <Zap className="w-3 h-3 text-emerald-400" />,
      contract_signed: <Zap className="w-3 h-3 text-emerald-400" />,
    };
    return icons[t] || <Clock className="w-3 h-3 text-storm-subtle" />;
  };
  const timeAgo = (date: string) => {
    const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  };
  const getSevereIcon = (r: string) => {
    if (r === 'extreme' || r === 'high') return <CloudLightning className="w-5 h-5 text-red-400" />;
    if (r === 'moderate') return <CloudRain className="w-5 h-5 text-amber-400" />;
    return <Sun className="w-5 h-5 text-emerald-400/80" />;
  };
  const getSevereBg = (r: string) => {
    if (r === 'extreme' || r === 'high') return 'border-red-500/40 bg-red-500/10';
    if (r === 'moderate') return 'border-amber-500/30 bg-amber-500/5';
    return 'border-storm-border/60 bg-storm-z1/50';
  };

  const hailAlerts = stats?.data?.hailAlerts?.events || [];
  const hotLeads = stats?.data?.hotLeads || [];
  const overdue = stats?.data?.overdue || [];
  const todayCounts = stats?.data?.todayCounts;
  const goals = stats?.data?.goals;
  const recentActivities = stats?.data?.recentActivities || [];
  const kpis = stats?.data?.kpis;
  const actionLeads = [...hotLeads.slice(0, 5), ...overdue.filter((o) => !hotLeads.some((h) => h.id === o.id))].slice(0, 6);
  const severeCount = forecast.filter((d) => d.severeRisk !== 'none' && d.severeRisk !== 'low').length;

  if (loading) return <SkeletonDashboard />;
  if (dataError) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center p-8">
        <div className="max-w-sm rounded-2xl border border-amber-500/30 bg-amber-500/5 p-8 text-center">
          <AlertTriangle className="h-10 w-10 text-amber-400 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-white">Could not load dashboard</h2>
          <p className="mt-2 text-storm-muted text-sm">{dataError}</p>
          <button onClick={fetchDashboardData} className="mt-5 button-primary text-sm">
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-12">
      {forbiddenError && (
        <div className="mb-6 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          <p className="text-sm text-amber-200">
            You don&apos;t have access to that page. Contact your team admin if you need access.
          </p>
        </div>
      )}
      <OnboardingChecklist jobnimbusConnected={jobnimbusConnected} hasDefaultLocation={userLocation !== null} />

      {/* ─── Hail alert (storm-first) ───────────────────────────── */}
      {hailAlerts.length > 0 && (
        <div className="mb-6 rounded-2xl border border-red-500/40 bg-gradient-to-r from-red-600/15 via-orange-600/10 to-transparent p-4 md:p-5 animate-fade-in-up">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-red-500/20 p-3 flex-shrink-0">
                <CloudLightning className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-red-400 animate-pulse" />
                  Hail in your area
                </h2>
                <p className="text-storm-muted text-sm mt-0.5">
                  {hailAlerts[0]?.size_inches || hailAlerts[0]?.size}" hail ~{(hailAlerts[0]?.distance_miles || 0).toFixed(1)} mi away
                  {hailAlerts.length > 1 && ` · ${hailAlerts.length} events`}
                </p>
                <p className="text-amber-400 text-xs font-medium mt-1">Filing window open · act within 14 days</p>
              </div>
            </div>
            <Link
              href="/dashboard/storm-map"
              className="button-primary flex items-center justify-center gap-2 text-sm shrink-0"
            >
              Scan territory <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}

      {/* ─── Hero: 7-day weather ────────────────────────────────── */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold text-white tracking-tight">
            {userLocation ? "Territory forecast" : "Weather"}
          </h1>
          {userLocation && (
            <button
              onClick={() => fetchForecast(userLocation.lat, userLocation.lng)}
              className="text-storm-subtle hover:text-white text-xs flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${forecastLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          )}
        </div>
        {forecastLoading ? (
          <div className="rounded-2xl border border-storm-border bg-storm-z1 p-8 flex items-center justify-center gap-3">
            <Loader2 className="w-5 h-5 text-storm-glow animate-spin" />
            <span className="text-storm-muted text-sm">Loading forecast…</span>
          </div>
        ) : forecast.length > 0 ? (
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
            {forecast.map((day, i) => (
              <div
                key={day.date}
                className={`rounded-xl border p-3 text-center transition-colors ${getSevereBg(day.severeRisk)} ${i === 0 ? 'ring-1 ring-storm-purple/30' : ''}`}
              >
                <p className="text-[10px] font-medium text-storm-subtle uppercase tracking-wider">
                  {i === 0 ? 'Today' : (day.dayOfWeek || '').slice(0, 3)}
                </p>
                <div className="my-2 flex justify-center">{getSevereIcon(day.severeRisk)}</div>
                <p className="text-sm font-bold text-white">{Math.round(day.highF)}°</p>
                <p className="text-[10px] text-storm-subtle">{Math.round(day.lowF)}°</p>
                {day.precipChance > 0 && (
                  <p className="text-[10px] text-blue-400 mt-0.5 flex items-center justify-center gap-0.5">
                    <Droplets className="w-2.5 h-2.5" /> {day.precipChance}%
                  </p>
                )}
                {day.windGustMph > 30 && (
                  <p className="text-[10px] text-amber-400 mt-0.5 flex items-center justify-center gap-0.5">
                    <Wind className="w-2.5 h-2.5" /> {Math.round(day.windGustMph)}mph
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : !userLocation ? (
          <div className="rounded-2xl border border-storm-border bg-storm-z1 p-8 text-center">
            <p className="text-storm-subtle text-sm">Enable location for your forecast</p>
            {locationError && <p className="mt-2 text-xs text-amber-400">{locationError}</p>}
            <button onClick={autoDetectLocation} className="button-primary mt-4 text-sm inline-flex items-center gap-2">
              <Crosshair className="w-4 h-4" /> Enable location
            </button>
            <p className="mt-2 text-[10px] text-storm-subtle">
              <Link href="/settings/profile" className="text-storm-glow hover:underline">Or set default in Settings</Link>
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-storm-border bg-storm-z1 p-8 text-center">
            <p className="text-storm-subtle text-sm">No forecast data</p>
          </div>
        )}
      </div>

      {/* ─── Mission command: primary CTA ───────────────────────── */}
      <div className="mb-8 flex flex-col sm:flex-row gap-4">
        <Link
          href="/dashboard/storm-map"
          className="flex-1 rounded-2xl border border-storm-purple/40 bg-gradient-to-br from-storm-purple/20 to-storm-glow/10 p-5 md:p-6 hover:border-storm-purple/60 hover:shadow-glow-sm transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-storm-purple/20 p-3 group-hover:bg-storm-purple/30 transition-colors">
              <Route className="w-6 h-6 text-storm-glow" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold text-white">Storm Ops</h2>
              <p className="text-storm-muted text-sm mt-0.5">
                Live hail map, routing, and canvass ops
              </p>
              {severeCount > 0 && (
                <span className="inline-block mt-2 text-amber-400 text-xs font-medium">
                  {severeCount} severe day{severeCount > 1 ? 's' : ''} ahead
                </span>
              )}
            </div>
            <ChevronRight className="w-5 h-5 text-storm-subtle group-hover:text-storm-glow transition-colors shrink-0" />
          </div>
        </Link>
        <Link
          href="/dashboard/ai-image-engine"
          className="flex-1 rounded-2xl border border-storm-border bg-storm-z1 p-5 md:p-6 hover:border-storm-purple/30 hover:bg-storm-z2/50 transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-storm-z2 p-3 group-hover:bg-storm-purple/15 transition-colors">
              <Brain className="w-6 h-6 text-storm-glow" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold text-white">AI Image Engine</h2>
              <p className="text-storm-muted text-sm mt-0.5">
                Upload roof photo → damage report + estimate
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-storm-subtle group-hover:text-storm-glow transition-colors shrink-0" />
          </div>
        </Link>
      </div>

      {/* ─── Two-column: Actions + Sidebar ───────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Action items + AI briefing */}
        <div className="lg:col-span-2 space-y-6">
          {/* Action items: hot leads + overdue */}
          <div className="rounded-2xl border border-storm-border bg-storm-z1 overflow-hidden">
            <div className="px-4 py-3 border-b border-storm-border flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Next actions</h2>
              <span className="text-storm-subtle text-xs">
                {actionLeads.length} lead{actionLeads.length !== 1 ? 's' : ''} to act on
              </span>
            </div>
            {actionLeads.length > 0 ? (
              <div className="divide-y divide-storm-border/50">
                {actionLeads.map((lead, i) => {
                  const isOverdue = overdue.some((o) => o.id === lead.id);
                  return (
                    <div
                      key={lead.id}
                      className="px-4 py-3 hover:bg-storm-z2/30 transition-colors group flex items-center gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white text-sm truncate">{lead.address}</span>
                          {isOverdue && (() => {
                            const o = overdue.find((x) => x.id === lead.id);
                            return o ? (
                              <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
                                {o.days_overdue}d overdue
                              </span>
                            ) : null;
                          })()}
                          {!isOverdue && (
                            <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded ${
                              lead.lead_score >= 80 ? 'bg-red-500/20 text-red-400' : lead.lead_score >= 60 ? 'bg-amber-500/20 text-amber-400' : 'bg-storm-z2 text-storm-muted'
                            }`}>
                              {lead.lead_score}
                            </span>
                          )}
                        </div>
                        <p className="text-storm-subtle text-xs truncate">{lead.city}, {lead.state}</p>
                        {'estimated_claim' in lead && lead.estimated_claim && (
                          <p className="text-emerald-400 text-xs font-medium mt-0.5">
                            Est. {formatCurrency(parseFloat(String(lead.estimated_claim)))}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Link
                          href="/dashboard/ai-image-engine"
                          className="p-2 rounded-lg bg-storm-purple/15 text-storm-glow hover:bg-storm-purple/25 transition-colors"
                          title="AI Prep"
                        >
                          <Brain className="w-3.5 h-3.5" />
                        </Link>
                        {jobnimbusConnected && (
                          <button
                            onClick={(e) => { e.stopPropagation(); void exportLeadToJobnimbus(lead.id); }}
                            disabled={exportingLeadIds.has(lead.id) || exportedLeadIds.has(lead.id)}
                            className={`p-2 rounded-lg transition-colors ${
                              exportedLeadIds.has(lead.id)
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : exportingLeadIds.has(lead.id)
                                  ? 'bg-storm-z2 text-storm-subtle'
                                  : 'bg-blue-500/15 text-blue-400 hover:bg-blue-500/25'
                            }`}
                            title="JobNimbus"
                          >
                            <Upload className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {lead.phone && (
                          <a href={`tel:${lead.phone}`} className="p-2 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors" title="Call">
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <a
                          href={`https://maps.google.com?q=${encodeURIComponent(lead.address + ', ' + lead.city + ', ' + lead.state)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-lg bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 transition-colors"
                          title="Directions"
                        >
                          <Navigation className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center">
                <Target className="w-10 h-10 text-storm-subtle mx-auto mb-2" />
                <p className="text-storm-subtle text-sm">No leads to act on</p>
                <Link href="/dashboard/storm-map" className="button-primary mt-3 text-xs inline-flex items-center gap-2">
                  <Route className="w-3.5 h-3.5" /> Open Storm Ops
                </Link>
              </div>
            )}
          </div>

          {/* AI Briefing */}
          <div className="rounded-2xl border border-storm-border bg-storm-z1 overflow-hidden">
            <button
              onClick={() => setBriefingExpanded(!briefingExpanded)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-storm-z2/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-storm-glow" />
                <span className="text-sm font-semibold text-white">AI briefing</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-storm-purple/20 text-storm-glow">AI</span>
              </div>
              {briefingExpanded ? <ChevronUp className="w-4 h-4 text-storm-subtle" /> : <ChevronDown className="w-4 h-4 text-storm-subtle" />}
            </button>
            {briefingExpanded && (
              briefingLoading ? (
                <div className="p-6 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 text-storm-glow animate-spin" />
                  <span className="text-storm-muted text-sm">Analyzing territory…</span>
                </div>
              ) : briefing ? (
                <div className="px-4 pb-4 space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white">{briefing.headline}</h3>
                    <p className="text-storm-muted text-xs mt-0.5 leading-relaxed">{briefing.summary}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="text-[10px] px-2 py-1 rounded bg-storm-z2 text-storm-muted">
                      {briefingRaw?.stormCount ?? 0} storms
                    </span>
                    <span className="text-[10px] px-2 py-1 rounded bg-storm-z2 text-storm-muted">
                      {briefingRaw?.hotLeadCount ?? 0} hot leads
                    </span>
                    {briefingRaw?.maxHailSize && (
                      <span className="text-[10px] px-2 py-1 rounded bg-amber-500/15 text-amber-400">
                        {briefingRaw.maxHailSize}" max hail
                      </span>
                    )}
                  </div>
                  <div className="rounded-xl bg-storm-purple/10 border border-storm-purple/20 p-3">
                    <p className="text-[10px] font-semibold text-storm-subtle uppercase tracking-wider mb-0.5">Best canvassing window</p>
                    <p className="text-sm text-storm-muted">{briefing.best_time_to_canvas}</p>
                  </div>
                  {briefing.actions?.length > 0 && (
                    <div className="space-y-1">
                      {briefing.actions.slice(0, 3).map((a, i) => (
                        <p key={i} className="text-xs text-storm-muted flex items-start gap-2">
                          <span className="shrink-0 w-4 h-4 rounded bg-storm-purple/15 text-storm-glow text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                          {a}
                        </p>
                      ))}
                    </div>
                  )}
                  <Link href="/dashboard/storm-map" className="inline-flex items-center gap-1.5 text-xs font-medium text-storm-glow hover:text-storm-purple transition-colors">
                    Open Storm Ops <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              ) : !userLocation ? (
                <p className="px-4 pb-4 text-storm-subtle text-sm">Enable location for briefing</p>
              ) : briefingUpgradeRequired ? (
                <div className="px-4 pb-4">
                  <p className="text-storm-subtle text-sm">Pro or Enterprise required</p>
                  <Link href="/settings/billing" className="button-primary mt-2 text-xs inline-block">Upgrade</Link>
                </div>
              ) : (
                <div className="px-4 pb-4">
                  <p className="text-storm-subtle text-sm">Unable to generate briefing</p>
                  <button onClick={() => userLocation && fetchBriefing(userLocation.lat, userLocation.lng)} className="button-secondary mt-2 text-xs">
                    Retry
                  </button>
                </div>
              )
            )}
          </div>
        </div>

        {/* Right: Today + Activity */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-storm-border bg-storm-z1 p-4">
            <h2 className="text-xs font-semibold text-storm-subtle uppercase tracking-wider mb-3">Today</h2>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-storm-z2/50 p-3 text-center">
                <p className="text-lg font-bold text-white">{todayCounts?.doorKnocks || 0}</p>
                <p className="text-[10px] text-storm-subtle">Knocks</p>
                {goals?.daily_door_knock_goal && (
                  <div className="mt-1 h-0.5 bg-storm-z1 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${Math.min(100, ((todayCounts?.doorKnocks || 0) / goals.daily_door_knock_goal) * 100)}%` }}
                    />
                  </div>
                )}
              </div>
              <div className="rounded-xl bg-storm-z2/50 p-3 text-center">
                <p className="text-lg font-bold text-white">{todayCounts?.phoneCalls || 0}</p>
                <p className="text-[10px] text-storm-subtle">Calls</p>
              </div>
              <div className="rounded-xl bg-storm-z2/50 p-3 text-center">
                <p className="text-lg font-bold text-white">{todayCounts?.appointments || 0}</p>
                <p className="text-[10px] text-storm-subtle">Appts</p>
              </div>
            </div>
            <p className="mt-3 text-[10px] text-storm-subtle">
              {formatCurrency(kpis?.closedValue || 0)} closed this month · {kpis?.activeOpportunities || 0} active
            </p>
          </div>

          <div className="rounded-2xl border border-storm-border bg-storm-z1 overflow-hidden">
            <div className="px-4 py-3 border-b border-storm-border">
              <h2 className="text-xs font-semibold text-storm-subtle uppercase tracking-wider">Recent activity</h2>
            </div>
            {recentActivities.length > 0 ? (
              <div className="divide-y divide-storm-border/30">
                {recentActivities.slice(0, 5).map((a) => (
                  <div key={a.id} className="px-4 py-2.5 flex items-center gap-2">
                    {getActivityIcon(a.activity_type)}
                    <span className="text-xs text-storm-muted flex-1 truncate">
                      {formatActivityType(a.activity_type)}
                      {a.leads?.address && ` · ${a.leads.address}`}
                    </span>
                    <span className="text-[10px] text-storm-subtle">{timeAgo(a.created_at)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center">
                <Activity className="w-6 h-6 text-storm-subtle mx-auto mb-1" />
                <p className="text-storm-subtle text-xs">No activity yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Territory leads (when nearby) ──────────────────────── */}
      {nearbyLeads.length > 0 && userLocation && (
        <div className="mt-8 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 overflow-hidden">
          <div className="px-4 py-3 border-b border-emerald-500/20 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-400" />
              Nearby leads
            </h2>
            <button
              onClick={() => fetchNearbyLeads(userLocation.lat, userLocation.lng)}
              className="text-emerald-400 hover:text-emerald-300 text-xs font-medium"
            >
              Refresh
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
            {nearbyLeads.slice(0, 6).map((lead) => (
              <div key={lead.id} className="rounded-xl bg-storm-z1/50 border border-storm-border/50 p-3 hover:bg-storm-z2/50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-white text-sm truncate">{lead.address}</p>
                    <p className="text-storm-subtle text-xs">{lead.city}, {lead.state}</p>
                  </div>
                  <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-storm-z2 text-storm-muted">{lead.lead_score ?? 0}</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-emerald-400 text-xs">{lead.distance_miles} mi</span>
                  <div className="flex gap-1">
                    <Link href="/dashboard/ai-image-engine" className="p-1.5 rounded bg-storm-purple/15 text-storm-glow hover:bg-storm-purple/25">
                      <Brain className="w-3 h-3" />
                    </Link>
                    <a
                      href={`https://maps.google.com?q=${encodeURIComponent(lead.address + ', ' + lead.city + ', ' + lead.state)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded bg-blue-500/15 text-blue-400 hover:bg-blue-500/25"
                    >
                      <Navigation className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
