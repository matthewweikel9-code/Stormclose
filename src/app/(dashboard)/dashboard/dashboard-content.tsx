'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { User } from '@supabase/supabase-js';
import Link from 'next/link';
import { 
  DollarSign, 
  TrendingUp,
  Phone,
  MapPin,
  Clock,
  ChevronRight,
  Zap,
  Target,
  CloudRain,
  Navigation,
  Sparkles,
  Cloud,
  ArrowRight,
  Crosshair,
  Loader2,
  Sun,
  CloudLightning,
  Droplets,
  Wind,
  ThermometerSun,
  BarChart3,
  Brain,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Flame,
  Trophy,
  AlertTriangle,
  Calendar,
  Route,
  Timer,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { SkeletonDashboard } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface RevenueHubData {
  success: boolean;
  data: {
    kpis: {
      leadsGenerated: number;
      activeOpportunities: number;
      appointmentsSet: number;
      dealsClosed: number;
      dealsClosedAllTime: number;
      pipelineValue: number;
      weightedPipeline: number;
      closeRate: number;
      closedValue: number;
      closedValueAllTime: number;
      avgDealSize: number;
      revenueChangePercent: number;
      activityChangePercent: number;
      projectedRevenue: number;
      commissionEarned: number;
    };
    goals: {
      monthly_revenue_goal: number;
      commission_rate: number;
      daily_door_knock_goal: number;
      daily_call_goal: number;
      weekly_appointment_goal: number;
      monthly_deal_goal: number;
    };
    streak: {
      closingStreak: number;
      daysSinceLastClose: number;
    };
    activitySummary: {
      doorKnocks: number;
      phoneCalls: number;
      appointmentsSet: number;
      inspections: number;
      estimatesSent: number;
      dealsClosedActivity: number;
    };
    todayCounts: {
      doorKnocks: number;
      phoneCalls: number;
      appointments: number;
      totalToday: number;
    };
    pipeline: Record<string, number>;
    funnel: Array<{ stage: string; lead_count: number; stage_value: number; conversion_rate: number }>;
    recentActivities: Array<{
      id: string;
      activity_type: string;
      title?: string;
      description?: string;
      outcome?: string;
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
      score_reasons: string[];
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
      revenue_at_risk: number;
    }>;
    hailAlerts: {
      count: number;
      events: Array<{
        size_inches?: number;
        size?: number;
        distance_miles?: number;
        location_name?: string;
      }>;
    };
    snapshots: Array<{
      snapshot_date: string;
      pipeline_value: number;
      closed_value: number;
      total_leads: number;
      deals_closed: number;
    }>;
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
  hailRisk: string;
  tornadoRisk: string;
  windRisk: string;
  summary: string;
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
  stormLocations: string[];
}

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

interface DashboardContentProps {
  user: User;
  subscriptionStatus: string;
  subscriptionTier: string;
  logoutAction: () => Promise<void>;
}

export function DashboardContent({ user }: DashboardContentProps) {
  const userName = user.user_metadata?.full_name?.split(' ')[0] || user.email?.split('@')[0] || 'there';

  // ─── State ─────────────────────────────────────────────────
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
  const [activeTab, setActiveTab] = useState<'priority' | 'overdue' | 'pipeline'>('priority');
  const hasFetchedRef = useRef(false);

  // ─── Data Fetching ─────────────────────────────────────────
  useEffect(() => {
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchDashboardData();
      autoDetectLocation();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/dashboard/revenue-hub');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching revenue hub data:', error);
    } finally {
      setLoading(false);
    }
  };

  const autoDetectLocation = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = { lat: position.coords.latitude, lng: position.coords.longitude };
          setUserLocation(loc);
          fetchForecast(loc.lat, loc.lng);
          fetchBriefing(loc.lat, loc.lng);
          fetchNearbyLeads(loc.lat, loc.lng);
        },
        () => console.log('Location access denied')
      );
    }
  }, []);

  const fetchForecast = async (lat: number, lng: number) => {
    setForecastLoading(true);
    try {
      const res = await fetch(`/api/weather/forecast?lat=${lat}&lng=${lng}`);
      if (res.ok) {
        const data = await res.json();
        setForecast(data.forecast || []);
      }
    } catch (e) { console.error('Forecast error:', e); }
    finally { setForecastLoading(false); }
  };

  const fetchBriefing = async (lat: number, lng: number) => {
    setBriefingLoading(true);
    try {
      const res = await fetch(`/api/ai/daily-briefing?lat=${lat}&lng=${lng}`);
      if (res.ok) {
        const data = await res.json();
        setBriefing(data.briefing);
        setBriefingRaw(data.raw);
      }
    } catch (e) { console.error('Briefing error:', e); }
    finally { setBriefingLoading(false); }
  };

  const fetchNearbyLeads = async (lat: number, lng: number) => {
    try {
      const res = await fetch(`/api/leads/nearby?lat=${lat}&lng=${lng}&radius=10&limit=6`);
      if (res.ok) {
        const data = await res.json();
        setNearbyLeads(data.leads || []);
      }
    } catch (e) { console.error('Nearby leads error:', e); }
  };

  // ─── Helpers ─────────────────────────────────────────────
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  const formatActivityType = (type: string) => {
    const types: Record<string, string> = {
      door_knock: 'Door Knock',
      phone_call: 'Phone Call',
      appointment_set: 'Appointment Set',
      inspection: 'Inspection',
      estimate_sent: 'Estimate Sent',
      deal_closed: 'Deal Closed',
      contract_signed: 'Contract Signed',
      follow_up: 'Follow Up',
    };
    return types[type] || type;
  };

  const getActivityIcon = (type: string) => {
    const icons: Record<string, React.ReactNode> = {
      door_knock: <MapPin className="w-3.5 h-3.5 text-blue-400" />,
      phone_call: <Phone className="w-3.5 h-3.5 text-green-400" />,
      appointment_set: <Calendar className="w-3.5 h-3.5 text-purple-400" />,
      inspection: <Target className="w-3.5 h-3.5 text-orange-400" />,
      estimate_sent: <DollarSign className="w-3.5 h-3.5 text-yellow-400" />,
      deal_closed: <Zap className="w-3.5 h-3.5 text-emerald-400" />,
      contract_signed: <Zap className="w-3.5 h-3.5 text-emerald-400" />,
    };
    return icons[type] || <Clock className="w-3.5 h-3.5 text-gray-400" />;
  };

  const timeAgo = (date: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const getSevereIcon = (risk: string) => {
    switch (risk) {
      case 'extreme':
      case 'high': return <CloudLightning className="w-4 h-4 text-red-400" />;
      case 'moderate': return <CloudRain className="w-4 h-4 text-amber-400" />;
      default: return <Sun className="w-4 h-4 text-emerald-400" />;
    }
  };

  const getSevereColor = (risk: string) => {
    switch (risk) {
      case 'extreme':
      case 'high': return 'border-red-500/30 bg-red-500/5';
      case 'moderate': return 'border-amber-500/30 bg-amber-500/5';
      default: return 'border-storm-border bg-storm-z1/30';
    }
  };

  // ─── Loading State ─────────────────────────────────────────
  if (loading) {
    return <SkeletonDashboard />;
  }

  // ─── Derived Data ──────────────────────────────────────────
  const kpis = stats?.data?.kpis;
  const goals = stats?.data?.goals;
  const streak = stats?.data?.streak;
  const hailAlerts = stats?.data?.hailAlerts?.events || [];
  const hotLeads = stats?.data?.hotLeads || [];
  const overdue = stats?.data?.overdue || [];
  const funnel = stats?.data?.funnel || [];
  const pipeline = stats?.data?.pipeline;
  const recentActivities = stats?.data?.recentActivities || [];
  const todayCounts = stats?.data?.todayCounts;
  const severeCount = forecast.filter(d => d.severeRisk !== 'none' && d.severeRisk !== 'low').length;
  const goalProgress = goals && kpis
    ? Math.min(100, Math.round((kpis.closedValue / (goals.monthly_revenue_goal || 1)) * 100))
    : 0;

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="space-y-5 pb-8">

      {/* ══════════════════════════════════════════════════════
          MODULE 1 — STORM REVENUE RADAR
          ══════════════════════════════════════════════════════ */}
      {hailAlerts.length > 0 && (
        <div className="storm-card overflow-hidden border-red-500/30 bg-gradient-to-r from-red-600/10 via-orange-600/5 to-storm-z1 animate-fade-in-up">
          <div className="flex items-center gap-4 p-4">
            <div className="bg-red-500/20 rounded-xl p-3 animate-pulse flex-shrink-0">
              <CloudLightning className="w-6 h-6 text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-white flex items-center gap-2 text-sm">
                <span className="status-dot-danger" />
                ⚡ Storm Revenue Detected
              </h3>
              <p className="text-storm-muted text-xs mt-0.5">
                {hailAlerts[0]?.size_inches || hailAlerts[0]?.size}&quot; hail reported {(hailAlerts[0]?.distance_miles || 0).toFixed(1)}mi away
                {hailAlerts.length > 1 && ` · ${hailAlerts.length} total events`}
              </p>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-amber-400 text-xs font-semibold flex items-center gap-1">
                  <Timer className="w-3 h-3" />
                  Filing window open
                </span>
                <span className="text-storm-subtle text-2xs">Act within 14 days for best results</span>
              </div>
            </div>
            <Link
              href="/dashboard/storm-map"
              className="button-primary flex items-center gap-2 text-xs flex-shrink-0"
            >
              Scan Storm <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          MODULE 2 — REVENUE COMMAND BAR
          ══════════════════════════════════════════════════════ */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            {getGreeting()}, {userName}
            {streak && streak.closingStreak >= 2 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-500/15 text-orange-400 text-xs font-bold border border-orange-500/20">
                <Flame className="w-3.5 h-3.5" />
                {streak.closingStreak}-deal streak
              </span>
            )}
            {streak && streak.daysSinceLastClose > 5 && streak.closingStreak < 2 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-medium border border-amber-500/15">
                <AlertTriangle className="w-3 h-3" />
                {streak.daysSinceLastClose}d since last close
              </span>
            )}
          </h1>

          {/* Revenue Pulse */}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-storm-muted text-sm">
              <span className="text-emerald-400 font-semibold">{formatCurrency(kpis?.closedValue || 0)}</span> closed
            </span>
            <span className="text-storm-border">·</span>
            <span className="text-storm-muted text-sm">
              <span className="text-amber-400 font-semibold">{formatCurrency(kpis?.weightedPipeline || 0)}</span> weighted pipeline
            </span>
            <span className="text-storm-border">·</span>
            <span className="text-storm-muted text-sm">
              On pace for <span className="text-white font-semibold">{formatCurrency(kpis?.projectedRevenue || 0)}</span>
            </span>
            {severeCount > 0 && (
              <>
                <span className="text-storm-border">·</span>
                <span className="text-amber-400 text-sm font-medium">{severeCount} severe day{severeCount > 1 ? 's' : ''} ahead</span>
              </>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2">
          <Link href="/dashboard/storm-map" className="button-primary flex items-center gap-2 text-sm">
            <Cloud className="w-4 h-4" /> Storm Ops
          </Link>
          <Link href="/dashboard/ai-tools" className="button-secondary flex items-center gap-2 text-sm">
            <Brain className="w-4 h-4" /> AI Assistant
          </Link>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          MODULE 3 — REVENUE SCOREBOARD (6 KPI Cards)
          ══════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 stagger-children">
        {/* Card 1: Monthly Revenue + Goal Ring */}
        <div className="storm-card p-4 relative overflow-hidden">
          <div className="flex items-center justify-between mb-1.5">
            <div className="bg-emerald-500/15 rounded-lg p-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <TrendIndicator value={kpis?.revenueChangePercent || 0} />
          </div>
          <p className="text-xl font-bold text-white">{formatCurrency(kpis?.closedValue || 0)}</p>
          <p className="text-storm-subtle text-2xs mt-0.5">Closed this month</p>
          <div className="mt-2.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-2xs text-storm-subtle">Goal: {formatCurrency(goals?.monthly_revenue_goal || 25000)}</span>
              <span className="text-2xs font-semibold text-storm-glow">{goalProgress}%</span>
            </div>
            <div className="h-1.5 bg-storm-z2 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-storm-purple to-emerald-500 transition-all duration-1000 ease-out"
                style={{ width: `${goalProgress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 2: Pipeline Value */}
        <div className="storm-card p-4">
          <div className="flex items-center justify-between mb-1.5">
            <div className="bg-storm-purple/15 rounded-lg p-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-storm-glow" />
            </div>
            <Badge variant="purple" className="text-[9px]">{kpis?.activeOpportunities || 0} active</Badge>
          </div>
          <p className="text-xl font-bold text-white">{formatCurrency(kpis?.pipelineValue || 0)}</p>
          <p className="text-storm-subtle text-2xs mt-0.5">Pipeline value</p>
          <p className="text-storm-subtle text-2xs mt-1">
            Weighted: <span className="text-storm-muted font-medium">{formatCurrency(kpis?.weightedPipeline || 0)}</span>
          </p>
        </div>

        {/* Card 3: Close Rate */}
        <div className="storm-card p-4">
          <div className="flex items-center justify-between mb-1.5">
            <div className="bg-blue-500/15 rounded-lg p-1.5">
              <Target className="w-3.5 h-3.5 text-blue-400" />
            </div>
          </div>
          <p className="text-xl font-bold text-white">{kpis?.closeRate || 0}%</p>
          <p className="text-storm-subtle text-2xs mt-0.5">Close rate</p>
          <p className="text-storm-subtle text-2xs mt-1">{kpis?.dealsClosed || 0} deals this month</p>
        </div>

        {/* Card 4: Avg Deal Size */}
        <div className="storm-card p-4">
          <div className="flex items-center justify-between mb-1.5">
            <div className="bg-amber-500/15 rounded-lg p-1.5">
              <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
            </div>
          </div>
          <p className="text-xl font-bold text-white">{formatCurrency(kpis?.avgDealSize || 0)}</p>
          <p className="text-storm-subtle text-2xs mt-0.5">Avg deal size</p>
          <p className="text-storm-subtle text-2xs mt-1">{kpis?.dealsClosedAllTime || 0} all-time</p>
        </div>

        {/* Card 5: Projected Revenue */}
        <div className="storm-card p-4">
          <div className="flex items-center justify-between mb-1.5">
            <div className="bg-cyan-500/15 rounded-lg p-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <Badge variant="info" className="text-[9px]">Projected</Badge>
          </div>
          <p className="text-xl font-bold text-white">{formatCurrency(kpis?.projectedRevenue || 0)}</p>
          <p className="text-storm-subtle text-2xs mt-0.5">Month-end projection</p>
        </div>

        {/* Card 6: Commission Earned */}
        <div className="storm-card p-4 border-emerald-500/20">
          <div className="flex items-center justify-between mb-1.5">
            <div className="bg-emerald-500/15 rounded-lg p-1.5">
              <Trophy className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <span className="text-2xs text-storm-subtle">{((goals?.commission_rate || 0.10) * 100).toFixed(0)}%</span>
          </div>
          <p className="text-xl font-bold text-emerald-400">{formatCurrency(kpis?.commissionEarned || 0)}</p>
          <p className="text-storm-subtle text-2xs mt-0.5">Commission earned</p>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          MODULE 4 — 7-DAY SEVERE WEATHER OUTLOOK
          ══════════════════════════════════════════════════════ */}
      <div className="storm-card overflow-hidden">
        <div className="flex items-center justify-between p-3.5 border-b border-storm-border">
          <div className="flex items-center gap-2">
            <ThermometerSun className="w-4 h-4 text-storm-glow" />
            <h2 className="font-semibold text-white text-sm">7-Day Severe Outlook</h2>
            {severeCount > 0 && (
              <Badge variant="warning">
                <CloudLightning className="w-3 h-3" />
                {severeCount} severe
              </Badge>
            )}
          </div>
          {userLocation && (
            <button
              onClick={() => fetchForecast(userLocation.lat, userLocation.lng)}
              className="text-storm-subtle hover:text-white text-xs flex items-center gap-1 transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${forecastLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          )}
        </div>

        {forecastLoading ? (
          <div className="p-6 flex items-center justify-center gap-3">
            <Loader2 className="w-5 h-5 text-storm-glow animate-spin" />
            <span className="text-storm-muted text-sm">Loading forecast...</span>
          </div>
        ) : forecast.length > 0 ? (
          <div className="grid grid-cols-7 divide-x divide-storm-border/50">
            {forecast.map((day, i) => (
              <div
                key={day.date}
                className={`p-3 text-center transition-colors hover:bg-storm-z2/30 ${getSevereColor(day.severeRisk)} ${i === 0 ? 'bg-storm-z1/50' : ''}`}
              >
                <p className="text-2xs font-medium text-storm-subtle uppercase tracking-wider">
                  {i === 0 ? 'Today' : (day.dayOfWeek || '').slice(0, 3)}
                </p>
                <div className="my-1.5 flex justify-center">{getSevereIcon(day.severeRisk)}</div>
                <p className="text-sm font-bold text-white">{Math.round(day.highF)}°</p>
                <p className="text-2xs text-storm-subtle">{Math.round(day.lowF)}°</p>
                {day.precipChance > 0 && (
                  <div className="mt-1 flex items-center justify-center gap-0.5">
                    <Droplets className="w-2.5 h-2.5 text-blue-400" />
                    <span className="text-2xs text-blue-400">{day.precipChance}%</span>
                  </div>
                )}
                {day.windGustMph > 30 && (
                  <div className="mt-0.5 flex items-center justify-center gap-0.5">
                    <Wind className="w-2.5 h-2.5 text-amber-400" />
                    <span className="text-2xs text-amber-400">{Math.round(day.windGustMph)}mph</span>
                  </div>
                )}
                {day.severeRisk !== 'none' && day.severeRisk !== 'low' && (
                  <div className="mt-1">
                    <Badge variant={day.severeRisk === 'high' || day.severeRisk === 'extreme' ? 'danger' : 'warning'} className="text-[9px] px-1.5">
                      {day.severeRisk === 'high' || day.severeRisk === 'extreme' ? 'SEVERE' : 'WATCH'}
                    </Badge>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : !userLocation ? (
          <div className="p-6 text-center">
            <p className="text-storm-subtle text-sm">Enable location to see your territory forecast</p>
            <button onClick={autoDetectLocation} className="button-primary mt-3 text-xs inline-flex items-center gap-2">
              <Crosshair className="w-3.5 h-3.5" /> Enable Location
            </button>
          </div>
        ) : (
          <div className="p-5 text-center">
            <p className="text-storm-subtle text-sm">No forecast data available</p>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════
          MODULE 5 — AI WAR ROOM BRIEFING
          ══════════════════════════════════════════════════════ */}
      <div className="storm-card-glow overflow-hidden">
        <button
          onClick={() => setBriefingExpanded(!briefingExpanded)}
          className="w-full flex items-center justify-between p-4 border-b border-storm-border hover:bg-storm-z1/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-storm-glow" />
            <h2 className="font-semibold text-white text-sm">AI War Room Briefing</h2>
            <Badge variant="purple">
              <Sparkles className="w-3 h-3" />
              AI Generated
            </Badge>
          </div>
          {briefingExpanded ? <ChevronUp className="w-4 h-4 text-storm-subtle" /> : <ChevronDown className="w-4 h-4 text-storm-subtle" />}
        </button>

        {briefingExpanded && (
          briefingLoading ? (
            <div className="p-6 flex items-center justify-center gap-3">
              <Loader2 className="w-5 h-5 text-storm-glow animate-spin" />
              <span className="text-storm-muted text-sm">AI is analyzing your territory...</span>
            </div>
          ) : briefing ? (
            <div className="p-5 space-y-4">
              {/* Headline */}
              <div>
                <h3 className="text-base font-semibold text-white">{briefing.headline}</h3>
                <p className="text-storm-muted text-sm leading-relaxed mt-1">{briefing.summary}</p>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-storm-z1/50 rounded-xl p-3 border border-storm-border/50 text-center">
                  <p className="text-lg font-bold text-white">{briefingRaw?.stormCount ?? 0}</p>
                  <p className="text-2xs text-storm-subtle mt-0.5">Storms</p>
                </div>
                <div className="bg-storm-z1/50 rounded-xl p-3 border border-storm-border/50 text-center">
                  <p className="text-lg font-bold text-white">{briefingRaw?.hotLeadCount ?? 0}</p>
                  <p className="text-2xs text-storm-subtle mt-0.5">Hot Leads</p>
                </div>
                <div className="bg-storm-z1/50 rounded-xl p-3 border border-storm-border/50 text-center">
                  <p className="text-lg font-bold text-amber-400">{briefingRaw?.maxHailSize ? `${briefingRaw.maxHailSize}"` : '—'}</p>
                  <p className="text-2xs text-storm-subtle mt-0.5">Max Hail</p>
                </div>
                <div className="bg-storm-z1/50 rounded-xl p-3 border border-storm-border/50 text-center">
                  <p className="text-lg font-bold text-emerald-400">{briefing.opportunity_score}</p>
                  <p className="text-2xs text-storm-subtle mt-0.5">Opp. Score</p>
                </div>
              </div>

              {/* Best Canvassing Window */}
              <div className="bg-gradient-to-r from-storm-purple/10 to-storm-glow/5 border border-storm-purple/20 rounded-xl p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Target className="w-4 h-4 text-storm-glow" />
                      <h3 className="font-semibold text-white text-sm">Best Canvassing Window</h3>
                    </div>
                    <p className="text-storm-muted text-xs mt-1">{briefing.best_time_to_canvas}</p>
                  </div>
                  <Link href="/dashboard/storm-map" className="button-primary text-xs flex items-center gap-1.5">
                    Open Storm Ops <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>

              {/* Actions + Advisory */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {briefing.actions && briefing.actions.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-storm-muted uppercase tracking-wider mb-2">Recommended Actions</h3>
                    <div className="space-y-1.5">
                      {briefing.actions.map((action, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-storm-muted">
                          <span className="flex items-center justify-center w-5 h-5 rounded-md bg-storm-purple/15 text-storm-glow text-2xs font-bold flex-shrink-0 mt-0.5">{i + 1}</span>
                          <span>{action}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {briefing.weather_advisory && (
                  <div className="bg-storm-z1/30 rounded-lg p-3 border border-storm-border/50 h-fit">
                    <div className="flex items-center gap-2 mb-1">
                      <Cloud className="w-3.5 h-3.5 text-blue-400" />
                      <span className="text-2xs font-semibold text-storm-subtle uppercase tracking-wider">Weather Advisory</span>
                    </div>
                    <p className="text-xs text-storm-muted">{briefing.weather_advisory}</p>
                  </div>
                )}
              </div>
            </div>
          ) : !userLocation ? (
            <div className="p-6 text-center">
              <Brain className="w-8 h-8 text-storm-subtle mx-auto mb-2" />
              <p className="text-storm-subtle text-sm">Enable location for your personalized AI briefing</p>
            </div>
          ) : (
            <div className="p-6 text-center">
              <p className="text-storm-subtle text-sm">Unable to generate briefing</p>
              <button
                onClick={() => userLocation && fetchBriefing(userLocation.lat, userLocation.lng)}
                className="button-secondary mt-3 text-xs inline-flex items-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Retry
              </button>
            </div>
          )
        )}
      </div>

      {/* ══════════════════════════════════════════════════════
          MODULE 6 — SMART PRIORITY QUEUE + FUNNEL + GAME PLAN
          ══════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ── Left (2/3): Tabbed Lead Intelligence ── */}
        <div className="lg:col-span-2 storm-card overflow-hidden">
          {/* Tab Bar */}
          <div className="flex items-center border-b border-storm-border">
            <TabButton active={activeTab === 'priority'} onClick={() => setActiveTab('priority')} icon={<Zap className="w-3.5 h-3.5" />} label="Priority Queue" count={hotLeads.length > 0 ? hotLeads.length : undefined} countColor="bg-red-500/15 text-red-400" />
            <TabButton active={activeTab === 'overdue'} onClick={() => setActiveTab('overdue')} icon={<AlertTriangle className="w-3.5 h-3.5" />} label="Overdue" count={overdue.length > 0 ? overdue.length : undefined} countColor="bg-amber-500/15 text-amber-400" activeColor="border-amber-400" />
            <TabButton active={activeTab === 'pipeline'} onClick={() => setActiveTab('pipeline')} icon={<BarChart3 className="w-3.5 h-3.5" />} label="Pipeline" activeColor="border-blue-400" />
          </div>

          {/* Priority Queue Tab */}
          {activeTab === 'priority' && (
            hotLeads.length > 0 ? (
              <div className="divide-y divide-storm-border/50">
                {hotLeads.slice(0, 8).map((lead, index) => (
                  <div key={lead.id} className="p-3.5 hover:bg-storm-z2/50 transition-all duration-200 group">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <RankBadge rank={index} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <h3 className="font-medium text-white text-sm truncate">{lead.address || 'Unknown'}</h3>
                            <Badge variant={lead.lead_score >= 80 ? 'danger' : lead.lead_score >= 60 ? 'warning' : 'default'}>
                              {lead.lead_score}
                            </Badge>
                          </div>
                          <p className="text-storm-subtle text-xs truncate">{lead.city}, {lead.state}</p>
                          {/* Score Reasons */}
                          {lead.score_reasons && lead.score_reasons.length > 0 && (
                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                              {lead.score_reasons.slice(0, 3).map((reason, ri) => (
                                <span key={ri} className="text-2xs px-1.5 py-0.5 rounded bg-storm-z2 text-storm-muted border border-storm-border/50">
                                  {reason}
                                </span>
                              ))}
                            </div>
                          )}
                          {lead.estimated_claim && (
                            <p className="text-emerald-400 text-xs font-medium mt-1">
                              Est. claim: {formatCurrency(parseFloat(String(lead.estimated_claim)))}
                            </p>
                          )}
                        </div>
                      </div>
                      {/* Inline Actions */}
                      <div className="flex gap-1.5 flex-shrink-0 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link href="/dashboard/ai-tools" className="px-2 py-1.5 bg-gradient-to-r from-storm-purple to-storm-glow text-white rounded-lg text-2xs font-semibold hover:opacity-90 transition-opacity flex items-center gap-1 shadow-depth-1">
                          <Brain className="w-3 h-3" /> AI Prep
                        </Link>
                        {lead.phone && (
                          <a href={`tel:${lead.phone}`} onClick={(e) => e.stopPropagation()} className="p-1.5 bg-emerald-500/15 text-emerald-400 rounded-lg hover:bg-emerald-500/25 transition-colors">
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <a href={`https://maps.google.com?q=${encodeURIComponent(lead.address)}`} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-blue-500/15 text-blue-400 rounded-lg hover:bg-blue-500/25 transition-colors">
                          <Navigation className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={<Target className="w-7 h-7 text-storm-subtle" />} title="No priority leads yet" description="Open Storm Ops to detect hail and wind damage leads" actionHref="/dashboard/storm-map" actionLabel="Open Storm Ops" />
            )
          )}

          {/* Overdue Tab */}
          {activeTab === 'overdue' && (
            overdue.length > 0 ? (
              <div className="divide-y divide-storm-border/50">
                {overdue.map((lead) => (
                  <div key={lead.id} className="p-3.5 hover:bg-storm-z2/50 transition-all group">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="bg-amber-500/15 rounded-lg p-1.5 flex-shrink-0 mt-0.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <h3 className="font-medium text-white text-sm truncate">{lead.address}</h3>
                            <Badge variant="warning">{lead.days_overdue}d overdue</Badge>
                          </div>
                          <p className="text-storm-subtle text-xs">{lead.city}, {lead.state} · {lead.status.replace(/_/g, ' ')}</p>
                          {lead.revenue_at_risk > 0 && (
                            <p className="text-red-400 text-xs font-medium mt-1">
                              <DollarSign className="w-3 h-3 inline" />
                              {formatCurrency(lead.revenue_at_risk)} at risk
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1.5 flex-shrink-0 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                        {lead.phone && (
                          <a href={`tel:${lead.phone}`} className="p-1.5 bg-emerald-500/15 text-emerald-400 rounded-lg hover:bg-emerald-500/25 transition-colors">
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <a href={`https://maps.google.com?q=${encodeURIComponent(lead.address)}`} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-blue-500/15 text-blue-400 rounded-lg hover:bg-blue-500/25 transition-colors">
                          <Navigation className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={<Activity className="w-7 h-7 text-storm-subtle" />} title="All caught up!" description="No overdue follow-ups. Keep up the great work." />
            )
          )}

          {/* Pipeline Tab */}
          {activeTab === 'pipeline' && (
            <div className="p-4 space-y-4">
              {funnel.length > 0 ? (
                <div className="space-y-1.5">
                  <h3 className="text-xs font-semibold text-storm-muted uppercase tracking-wider mb-3">Conversion Funnel</h3>
                  {funnel.map((stage, i) => {
                    const maxCount = Math.max(...funnel.map(s => Number(s.lead_count) || 0), 1);
                    const barWidth = Math.max(((Number(stage.lead_count) || 0) / maxCount) * 100, 4);
                    const colors = ['bg-storm-subtle', 'bg-blue-500', 'bg-storm-purple', 'bg-amber-500', 'bg-orange-500', 'bg-emerald-500'];
                    return (
                      <div key={stage.stage}>
                        <div className="flex items-center gap-3">
                          <div className="w-28 text-xs text-storm-muted font-medium capitalize">{stage.stage.replace(/_/g, ' ')}</div>
                          <div className="flex-1 bg-storm-z2 rounded-full h-6 overflow-hidden">
                            <div
                              className={`${colors[i] || 'bg-storm-subtle'} h-full rounded-full transition-all duration-700 ease-out flex items-center`}
                              style={{ width: `${barWidth}%` }}
                            >
                              <span className="text-[10px] font-bold text-white pl-2 whitespace-nowrap">{stage.lead_count}</span>
                            </div>
                          </div>
                          <div className="w-20 text-right">
                            <span className="text-xs font-semibold text-white">{formatCurrency(Number(stage.stage_value) || 0)}</span>
                          </div>
                        </div>
                        {i < funnel.length - 1 && (
                          <div className="flex items-center ml-28 pl-4 py-0.5">
                            <ChevronDown className="w-3 h-3 text-storm-subtle" />
                            <span className="text-2xs text-storm-subtle ml-1">{Number(stage.conversion_rate || 0).toFixed(0)}% conversion</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2.5">
                  <h3 className="text-xs font-semibold text-storm-muted uppercase tracking-wider mb-3">Pipeline Stages</h3>
                  <PipelineBar label="New" count={pipeline?.new || 0} total={kpis?.leadsGenerated || 1} color="bg-storm-subtle" />
                  <PipelineBar label="Contacted" count={pipeline?.contacted || 0} total={kpis?.leadsGenerated || 1} color="bg-blue-500" />
                  <PipelineBar label="Appointment" count={pipeline?.appointment_set || 0} total={kpis?.leadsGenerated || 1} color="bg-storm-purple" />
                  <PipelineBar label="Inspected" count={pipeline?.inspected || 0} total={kpis?.leadsGenerated || 1} color="bg-amber-500" />
                  <PipelineBar label="Signed" count={pipeline?.signed || 0} total={kpis?.leadsGenerated || 1} color="bg-orange-500" />
                  <PipelineBar label="Closed Won" count={pipeline?.closed || 0} total={kpis?.leadsGenerated || 1} color="bg-emerald-500" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right (1/3): Today's Game Plan + Activity Feed ── */}
        <div className="space-y-5">
          {/* Today's Game Plan */}
          <div className="storm-card overflow-hidden border-storm-purple/20">
            <div className="flex items-center justify-between p-3.5 border-b border-storm-border bg-gradient-to-r from-storm-purple/5 to-transparent">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-storm-glow" />
                <h2 className="font-semibold text-white text-sm">Today&apos;s Game Plan</h2>
              </div>
              <Badge variant="purple" className="text-[9px]">
                {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </Badge>
            </div>
            <div className="p-3.5 space-y-3">
              {/* Today's Activity Counters */}
              <div className="grid grid-cols-3 gap-2">
                <MiniCounter label="Knocks" value={todayCounts?.doorKnocks || 0} goal={goals?.daily_door_knock_goal || 30} />
                <MiniCounter label="Calls" value={todayCounts?.phoneCalls || 0} goal={goals?.daily_call_goal || 20} color="bg-green-500" />
                <MiniCounter label="Appts" value={todayCounts?.appointments || 0} />
              </div>

              {/* Overdue Alert */}
              {overdue.length > 0 && (
                <button
                  onClick={() => setActiveTab('overdue')}
                  className="w-full flex items-center gap-2 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-left hover:bg-amber-500/15 transition-colors"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                  <span className="text-xs text-amber-400 font-medium">{overdue.length} leads need follow-up</span>
                  <ChevronRight className="w-3 h-3 text-amber-400/50 ml-auto" />
                </button>
              )}

              {/* Quick Action Links */}
              <div className="space-y-1.5">
                <QuickAction href="/dashboard/storm-map" icon={<Route className="w-3.5 h-3.5 text-storm-glow" />} iconBg="bg-storm-purple/15" title="Open Storm Ops" subtitle="Live weather, routing, and canvass ops" />
                {hotLeads.length > 0 && hotLeads[0]?.phone && (
                  <QuickAction href={`tel:${hotLeads[0].phone}`} icon={<Phone className="w-3.5 h-3.5 text-emerald-400" />} iconBg="bg-emerald-500/15" title="Call Top Lead" subtitle={hotLeads[0]?.address || 'Next highest scored'} isExternal />
                )}
              </div>
            </div>
          </div>

          {/* Activity Feed */}
          <div className="storm-card overflow-hidden">
            <div className="flex items-center justify-between p-3.5 border-b border-storm-border">
              <h2 className="font-semibold text-white text-sm flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-400" />
                Activity Feed
              </h2>
              <TrendIndicator value={kpis?.activityChangePercent || 0} label="vs last mo" />
            </div>

            {/* Effort → Result Summary */}
            <div className="px-3.5 pt-3 pb-2 border-b border-storm-border/50">
              <p className="text-2xs text-storm-subtle">
                {stats?.data?.activitySummary?.doorKnocks || 0} knocks + {stats?.data?.activitySummary?.phoneCalls || 0} calls → {stats?.data?.activitySummary?.appointmentsSet || 0} appts → {kpis?.dealsClosed || 0} deals
              </p>
            </div>

            {recentActivities.length > 0 ? (
              <div className="divide-y divide-storm-border/30">
                {recentActivities.slice(0, 6).map((activity) => (
                  <div key={activity.id} className="px-3.5 py-2.5 hover:bg-storm-z2/30 transition-all duration-200">
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5">{getActivityIcon(activity.activity_type)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white">
                          <span className="font-medium">{formatActivityType(activity.activity_type)}</span>
                        </p>
                        {activity.leads?.address && (
                          <p className="text-storm-subtle text-2xs truncate mt-0.5">{activity.leads.address}</p>
                        )}
                      </div>
                      <span className="text-storm-subtle text-2xs whitespace-nowrap">{timeAgo(activity.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-5 text-center">
                <Clock className="w-5 h-5 text-storm-subtle mx-auto mb-2" />
                <p className="text-storm-muted text-xs">No activity yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          MODULE 7 — TERRITORY LEADS
          ══════════════════════════════════════════════════════ */}
      {nearbyLeads.length > 0 && (
        <div className="storm-card overflow-hidden border-emerald-500/20 animate-fade-in-up">
          <div className="flex items-center justify-between p-3.5 border-b border-storm-border bg-emerald-900/10">
            <div className="flex items-center gap-3">
              <Crosshair className="w-4 h-4 text-emerald-400" />
              <h2 className="font-semibold text-white text-sm">Territory Leads</h2>
              <Badge variant="success">Within 10 miles</Badge>
            </div>
            <button
              onClick={() => userLocation && fetchNearbyLeads(userLocation.lat, userLocation.lng)}
              className="text-emerald-400 hover:text-emerald-300 text-xs flex items-center gap-1 font-medium transition-colors"
            >
              <Navigation className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-3.5 stagger-children">
            {nearbyLeads.slice(0, 6).map((lead) => (
              <div
                key={lead.id}
                className="bg-storm-z2/50 rounded-xl p-3.5 hover:bg-storm-z2 transition-all duration-200 border border-storm-border/50"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-white text-sm truncate">{lead.address}</h3>
                    <p className="text-storm-subtle text-xs">{lead.city}, {lead.state}</p>
                  </div>
                  <Badge variant={(lead.lead_score || 0) >= 70 ? 'danger' : (lead.lead_score || 0) >= 40 ? 'warning' : 'default'}>
                    {lead.lead_score || 0}
                  </Badge>
                </div>
                <div className="flex items-center justify-between mt-2.5">
                  <span className="text-emerald-400 text-xs font-medium flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {lead.distance_miles} mi
                  </span>
                  <div className="flex gap-1.5">
                    <Link href="/dashboard/ai-tools" className="px-2 py-1 bg-gradient-to-r from-storm-purple to-storm-glow text-white rounded-lg text-2xs font-semibold hover:opacity-90 transition-opacity flex items-center gap-1">
                      <Brain className="w-3 h-3" /> Prep
                    </Link>
                    <a
                      href={`https://maps.google.com?q=${encodeURIComponent(lead.address + ', ' + lead.city + ', ' + lead.state)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 bg-blue-500/15 text-blue-400 rounded-lg hover:bg-blue-500/25 transition-colors"
                    >
                      <Navigation className="w-3.5 h-3.5" />
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

// ═══════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════

function TrendIndicator({ value, label }: { value: number; label?: string }) {
  if (value === 0) return null;
  const isUp = value > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-2xs font-semibold ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
      {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {Math.abs(value)}%
      {label && <span className="text-storm-subtle font-normal ml-0.5">{label}</span>}
    </span>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const styles = rank === 0
    ? 'bg-gradient-to-br from-amber-500/30 to-orange-500/20 text-amber-400 border border-amber-500/30'
    : rank === 1
    ? 'bg-storm-z2 text-storm-muted border border-storm-border'
    : rank === 2
    ? 'bg-amber-700/15 text-amber-500 border border-amber-700/20'
    : 'bg-storm-z2 text-storm-subtle border border-storm-border/50';
  return (
    <span className={`flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold flex-shrink-0 ${styles}`}>
      {rank + 1}
    </span>
  );
}

function TabButton({ active, onClick, icon, label, count, countColor = 'bg-red-500/15 text-red-400', activeColor = 'border-storm-glow' }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string;
  count?: number; countColor?: string; activeColor?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
        active ? `${activeColor} text-white` : 'border-transparent text-storm-subtle hover:text-storm-muted'
      }`}
    >
      {icon}
      {label}
      {count !== undefined && (
        <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${countColor}`}>{count}</span>
      )}
    </button>
  );
}

function MiniCounter({ label, value, goal, color = 'bg-blue-500' }: { label: string; value: number; goal?: number; color?: string }) {
  return (
    <div className="bg-storm-z2/50 rounded-lg p-2.5 text-center border border-storm-border/30">
      <p className="text-lg font-bold text-white">{value}</p>
      <p className="text-2xs text-storm-subtle">{label}</p>
      {goal && (
        <div className="mt-1 h-1 bg-storm-z1 rounded-full overflow-hidden">
          <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${Math.min(100, (value / goal) * 100)}%` }} />
        </div>
      )}
    </div>
  );
}

function QuickAction({ href, icon, iconBg, title, subtitle, isExternal }: {
  href: string; icon: React.ReactNode; iconBg: string; title: string; subtitle: string; isExternal?: boolean;
}) {
  const Component = isExternal ? 'a' : Link;
  const extraProps = isExternal ? { target: undefined } : {};
  return (
    <Component href={href} {...extraProps} className="flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-storm-z2/50 transition-colors group">
      <div className={`${iconBg} rounded-lg p-1.5`}>{icon}</div>
      <div className="flex-1">
        <p className="text-xs font-medium text-white">{title}</p>
        <p className="text-2xs text-storm-subtle truncate">{subtitle}</p>
      </div>
      <ChevronRight className="w-3.5 h-3.5 text-storm-subtle group-hover:text-white transition-colors" />
    </Component>
  );
}

function PipelineBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-24 text-xs text-storm-muted font-medium">{label}</div>
      <div className="flex-1 bg-storm-z2 rounded-full h-1.5 overflow-hidden">
        <div className={`${color} h-full rounded-full transition-all duration-700 ease-out`} style={{ width: `${Math.max(percentage, count > 0 ? 5 : 0)}%` }} />
      </div>
      <div className="w-8 text-right text-xs font-semibold text-white">{count}</div>
    </div>
  );
}

function EmptyState({ icon, title, description, actionHref, actionLabel }: {
  icon: React.ReactNode; title: string; description: string; actionHref?: string; actionLabel?: string;
}) {
  return (
    <div className="p-8 text-center">
      <div className="w-14 h-14 bg-storm-z2 rounded-2xl flex items-center justify-center mx-auto mb-3">{icon}</div>
      <h3 className="text-white font-medium text-sm mb-1">{title}</h3>
      <p className="text-storm-subtle text-xs mb-4">{description}</p>
      {actionHref && actionLabel && (
        <Link href={actionHref} className="button-primary inline-flex items-center gap-2 text-xs">
          <Cloud className="w-3.5 h-3.5" /> {actionLabel}
        </Link>
      )}
    </div>
  );
}
