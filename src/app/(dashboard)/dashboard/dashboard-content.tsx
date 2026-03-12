'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { User } from '@supabase/supabase-js';
import Link from 'next/link';
import { 
  AlertTriangle, 
  Users, 
  Calendar, 
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
  Shield,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ExternalLink
} from 'lucide-react';
import { SkeletonDashboard } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

// ─── Types ───────────────────────────────────────────────────
interface DashboardStats {
  success: boolean;
  data: {
    kpis: {
      leadsGenerated: number;
      appointmentsSet: number;
      dealsClosed: number;
      pipelineValue: number;
      closeRate: number;
      closedValue: number;
    };
    activitySummary: {
      doorKnocks: number;
      phoneCalls: number;
      appointmentsSet: number;
      inspections: number;
    };
    pipeline: Record<string, number>;
    recentActivities: Array<{
      id: string;
      activity_type: string;
      title?: string;
      description?: string;
      outcome?: string;
      created_at: string;
      leads?: { id: string; address: string; city: string };
    }>;
    hotLeads: Array<any>;
    hailAlerts: {
      count: number;
      events: Array<any>;
    };
  };
}

interface Lead {
  id: string;
  name?: string;
  address: string;
  city?: string;
  state?: string;
  lead_score: number;
  score?: number;
  score_tier?: string;
  status: string;
  phone?: string;
  last_contact?: string;
  updated_at?: string;
  distance_miles?: number;
}

interface ForecastDay {
  date: string;
  dayOfWeek: string;
  highF: number;
  lowF: number;
  conditions: string;
  icon: string;
  precipChance: number;
  windSpeedMph: number;
  windGustMph: number;
  humidity: number;
  severeRisk: 'none' | 'low' | 'moderate' | 'high' | 'extreme';
  hailRisk: boolean;
  tornadoRisk: boolean;
  windRisk: boolean;
  summary: string;
}

interface DailyBriefing {
  summary: string;
  topOpportunity: {
    location: string;
    estimatedValue: string;
    reason: string;
  } | null;
  stats: {
    newStorms: number;
    propertiesIdentified: number;
    activeAlerts: number;
    estimatedTotalValue: string;
  };
  recommendedActions: string[];
  weatherOutlook: string;
}

interface DashboardContentProps {
  user: User;
  subscriptionStatus: string;
  subscriptionTier: 'free' | 'pro' | 'pro_plus';
  logoutAction: () => Promise<void>;
}

// ─── Component ───────────────────────────────────────────────
export function DashboardContent({ 
  user, 
  subscriptionStatus, 
  subscriptionTier, 
  logoutAction 
}: DashboardContentProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [hotLeads, setHotLeads] = useState<Lead[]>([]);
  const [nearbyLeads, setNearbyLeads] = useState<Lead[]>([]);
  const [forecast, setForecast] = useState<ForecastDay[]>([]);
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{lat: number; lng: number} | null>(null);
  const [briefingExpanded, setBriefingExpanded] = useState(true);
  const locationFetched = useRef(false);

  const userName = user.user_metadata?.full_name?.split(' ')[0] || 
                   user.email?.split('@')[0] || 
                   'there';

  // ─── Data Fetching ───────────────────────────────────────
  useEffect(() => {
    fetchDashboardData();
    autoDetectLocation();
  }, []);

  const autoDetectLocation = useCallback(() => {
    if (locationFetched.current) return;
    if (!navigator.geolocation) return;
    locationFetched.current = true;
    setLocationLoading(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        setLocationLoading(false);
        fetchNearbyLeads(latitude, longitude);
        fetchForecast(latitude, longitude);
        fetchBriefing(latitude, longitude);
      },
      () => {
        setLocationLoading(false);
        // Still attempt forecast with a default (user can retry)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  const fetchNearbyLeads = useCallback(async (lat: number, lng: number) => {
    try {
      const res = await fetch(`/api/leads/nearby?lat=${lat}&lng=${lng}&radius=10&limit=10`);
      if (res.ok) {
        const data = await res.json();
        setNearbyLeads(data.leads || []);
      }
    } catch (error) {
      console.error('Error fetching nearby leads:', error);
    }
  }, []);

  const fetchForecast = useCallback(async (lat: number, lng: number) => {
    setForecastLoading(true);
    try {
      const res = await fetch(`/api/weather/forecast?lat=${lat}&lng=${lng}`);
      if (res.ok) {
        const data = await res.json();
        setForecast(data.forecast || []);
      }
    } catch (error) {
      console.error('Error fetching forecast:', error);
    } finally {
      setForecastLoading(false);
    }
  }, []);

  const fetchBriefing = useCallback(async (lat: number, lng: number) => {
    setBriefingLoading(true);
    try {
      const res = await fetch(`/api/ai/daily-briefing?lat=${lat}&lng=${lng}`);
      if (res.ok) {
        const data = await res.json();
        setBriefing(data.briefing || null);
      }
    } catch (error) {
      console.error('Error fetching briefing:', error);
    } finally {
      setBriefingLoading(false);
    }
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, leadsRes] = await Promise.all([
        fetch('/api/dashboard/stats'),
        fetch('/api/leads?tier=hot&limit=5')
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
        if (statsData?.data?.hotLeads) {
          setHotLeads(statsData.data.hotLeads);
        }
      }

      if (leadsRes.ok && hotLeads.length === 0) {
        const leadsData = await leadsRes.json();
        if (leadsData.leads) {
          setHotLeads(leadsData.leads);
        }
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
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
      deal_closed: 'Deal Closed'
    };
    return types[type] || type;
  };

  const getActivityIcon = (type: string) => {
    const icons: Record<string, React.ReactNode> = {
      door_knock: <MapPin className="w-4 h-4 text-blue-400" />,
      phone_call: <Phone className="w-4 h-4 text-green-400" />,
      appointment_set: <Calendar className="w-4 h-4 text-purple-400" />,
      inspection: <Target className="w-4 h-4 text-orange-400" />,
      estimate_sent: <DollarSign className="w-4 h-4 text-yellow-400" />,
      deal_closed: <Zap className="w-4 h-4 text-emerald-400" />
    };
    return icons[type] || <Clock className="w-4 h-4 text-gray-400" />;
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

  if (loading) {
    return <SkeletonDashboard />;
  }

  const hailAlerts = stats?.data?.hailAlerts?.events || [];
  const kpis = stats?.data?.kpis;
  const severeCount = forecast.filter(d => d.severeRisk !== 'none' && d.severeRisk !== 'low').length;

  return (
    <div className="space-y-6 pb-8">
      {/* ─── Storm Alert Banner ─── */}
      {hailAlerts.length > 0 && (
        <div className="storm-card overflow-hidden border-red-500/30 bg-gradient-to-r from-red-600/10 to-orange-600/10 animate-fade-in-up">
          <div className="flex items-center gap-3 p-4">
            <div className="bg-red-500/20 rounded-xl p-2.5 animate-pulse">
              <CloudLightning className="w-5 h-5 text-red-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-white flex items-center gap-2 text-sm">
                <span className="status-dot-danger" />
                Storm Alert — Revenue Opportunity Detected
              </h3>
              <p className="text-storm-muted text-xs mt-0.5">
                {hailAlerts[0]?.size_inches || hailAlerts[0]?.size}&quot; hail reported {(hailAlerts[0]?.distance_miles || 0).toFixed(1)} miles away
              </p>
            </div>
            <Link 
              href="/dashboard/command-center"
              className="button-primary flex items-center gap-2 text-xs"
            >
              Open Storm Ops <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* ─── Header ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {getGreeting()}, {userName}
          </h1>
          <p className="text-storm-muted text-sm mt-1">
            Revenue Intelligence Hub · {' '}
            {severeCount > 0 ? (
              <span className="text-amber-400 font-medium">{severeCount} severe weather day{severeCount > 1 ? 's' : ''} ahead</span>
            ) : (
              <span className="text-emerald-400 font-medium">Clear skies in forecast</span>
            )}
          </p>
        </div>
        <div className="flex gap-3">
          <Link 
            href="/dashboard/command-center"
            className="button-primary flex items-center gap-2 text-sm"
          >
            <Cloud className="w-4 h-4" />
            Storm Ops
          </Link>
          <Link 
            href="/dashboard/ai-tools"
            className="button-secondary flex items-center gap-2 text-sm"
          >
            <Brain className="w-4 h-4" />
            AI Assistant
          </Link>
        </div>
      </div>

      {/* ─── 7-Day Severe Weather Forecast Strip ─── */}
      <div className="storm-card overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-storm-border">
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
                <div className="my-2 flex justify-center">
                  {getSevereIcon(day.severeRisk)}
                </div>
                <p className="text-sm font-bold text-white">{Math.round(day.highF)}°</p>
                <p className="text-2xs text-storm-subtle">{Math.round(day.lowF)}°</p>
                {day.precipChance > 0 && (
                  <div className="mt-1.5 flex items-center justify-center gap-0.5">
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
                  <div className="mt-1.5">
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
            <button 
              onClick={autoDetectLocation}
              className="button-primary mt-3 text-xs inline-flex items-center gap-2"
            >
              <Crosshair className="w-3.5 h-3.5" />
              Enable Location
            </button>
          </div>
        ) : (
          <div className="p-6 text-center">
            <p className="text-storm-subtle text-sm">No forecast data available</p>
          </div>
        )}
      </div>

      {/* ─── AI Daily Briefing ─── */}
      <div className="storm-card-glow overflow-hidden">
        <button 
          onClick={() => setBriefingExpanded(!briefingExpanded)}
          className="w-full flex items-center justify-between p-4 border-b border-storm-border hover:bg-storm-z1/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-storm-glow" />
            <h2 className="font-semibold text-white text-sm">AI Daily Briefing</h2>
            <Badge variant="purple">
              <Sparkles className="w-3 h-3" />
              AI Generated
            </Badge>
          </div>
          {briefingExpanded ? (
            <ChevronUp className="w-4 h-4 text-storm-subtle" />
          ) : (
            <ChevronDown className="w-4 h-4 text-storm-subtle" />
          )}
        </button>
        
        {briefingExpanded && (
          briefingLoading ? (
            <div className="p-6 flex items-center justify-center gap-3">
              <Loader2 className="w-5 h-5 text-storm-glow animate-spin" />
              <span className="text-storm-muted text-sm">AI is analyzing your territory...</span>
            </div>
          ) : briefing ? (
            <div className="p-5 space-y-5">
              {/* Summary */}
              <p className="text-storm-muted text-sm leading-relaxed">{briefing.summary}</p>

              {/* Stats Row */}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-storm-z1/50 rounded-xl p-3 border border-storm-border/50 text-center">
                  <p className="text-lg font-bold text-white">{briefing.stats.newStorms}</p>
                  <p className="text-2xs text-storm-subtle mt-0.5">New Storms</p>
                </div>
                <div className="bg-storm-z1/50 rounded-xl p-3 border border-storm-border/50 text-center">
                  <p className="text-lg font-bold text-white">{briefing.stats.propertiesIdentified}</p>
                  <p className="text-2xs text-storm-subtle mt-0.5">Properties</p>
                </div>
                <div className="bg-storm-z1/50 rounded-xl p-3 border border-storm-border/50 text-center">
                  <p className="text-lg font-bold text-amber-400">{briefing.stats.activeAlerts}</p>
                  <p className="text-2xs text-storm-subtle mt-0.5">Active Alerts</p>
                </div>
                <div className="bg-storm-z1/50 rounded-xl p-3 border border-storm-border/50 text-center">
                  <p className="text-lg font-bold text-emerald-400">{briefing.stats.estimatedTotalValue}</p>
                  <p className="text-2xs text-storm-subtle mt-0.5">Est. Value</p>
                </div>
              </div>

              {/* Top Opportunity */}
              {briefing.topOpportunity && (
                <div className="bg-gradient-to-r from-storm-purple/10 to-storm-glow/5 border border-storm-purple/20 rounded-xl p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Target className="w-4 h-4 text-storm-glow" />
                        <h3 className="font-semibold text-white text-sm">Top Opportunity</h3>
                      </div>
                      <p className="text-storm-muted text-xs mt-1">{briefing.topOpportunity.location}</p>
                      <p className="text-storm-subtle text-xs mt-0.5">{briefing.topOpportunity.reason}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-emerald-400">{briefing.topOpportunity.estimatedValue}</p>
                      <Link 
                        href="/dashboard/command-center"
                        className="text-storm-glow hover:text-storm-purple text-2xs font-medium transition-colors flex items-center gap-1 mt-1 justify-end"
                      >
                        View in Storm Ops <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                </div>
              )}

              {/* Recommended Actions */}
              {briefing.recommendedActions.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-storm-muted uppercase tracking-wider mb-2">Recommended Actions</h3>
                  <div className="space-y-1.5">
                    {briefing.recommendedActions.map((action, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-storm-muted">
                        <span className="flex items-center justify-center w-5 h-5 rounded-md bg-storm-purple/15 text-storm-glow text-2xs font-bold flex-shrink-0 mt-0.5">{i + 1}</span>
                        <span>{action}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Weather Outlook */}
              {briefing.weatherOutlook && (
                <div className="bg-storm-z1/30 rounded-lg p-3 border border-storm-border/50">
                  <div className="flex items-center gap-2 mb-1">
                    <Cloud className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-2xs font-semibold text-storm-subtle uppercase tracking-wider">Weather Outlook</span>
                  </div>
                  <p className="text-xs text-storm-muted">{briefing.weatherOutlook}</p>
                </div>
              )}
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
                <RefreshCw className="w-3.5 h-3.5" />
                Retry
              </button>
            </div>
          )
        )}
      </div>

      {/* ─── Revenue KPIs ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 stagger-children">
        <div className="storm-card p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-emerald-500/15 rounded-xl p-2">
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <Badge variant="success">Revenue</Badge>
          </div>
          <p className="text-2xl font-bold text-white animate-count-up">{formatCurrency(kpis?.pipelineValue || 0)}</p>
          <p className="text-storm-subtle text-2xs mt-1">Active pipeline</p>
        </div>

        <div className="storm-card p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-storm-purple/15 rounded-xl p-2">
              <TrendingUp className="w-4 h-4 text-storm-glow" />
            </div>
            <Badge variant="purple">{kpis?.closeRate || 0}%</Badge>
          </div>
          <p className="text-2xl font-bold text-white animate-count-up">{formatCurrency(kpis?.closedValue || 0)}</p>
          <p className="text-storm-subtle text-2xs mt-1">Closed this month</p>
        </div>

        <div className="storm-card p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-orange-500/15 rounded-xl p-2">
              <Target className="w-4 h-4 text-orange-400" />
            </div>
            <Badge variant="warning">{hotLeads.length} hot</Badge>
          </div>
          <p className="text-2xl font-bold text-white animate-count-up">{kpis?.leadsGenerated || 0}</p>
          <p className="text-storm-subtle text-2xs mt-1">Total leads</p>
        </div>

        <div className="storm-card p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-blue-500/15 rounded-xl p-2">
              <Calendar className="w-4 h-4 text-blue-400" />
            </div>
            <Badge variant="default">{kpis?.dealsClosed || 0} won</Badge>
          </div>
          <p className="text-2xl font-bold text-white animate-count-up">{kpis?.appointmentsSet || 0}</p>
          <p className="text-storm-subtle text-2xs mt-1">Appointments set</p>
        </div>
      </div>

      {/* ─── Main Content: Hot Leads + Activity ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Storm Opportunity Pipeline - Left */}
        <div className="lg:col-span-2 storm-card overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-storm-border">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="status-dot-danger" />
                <h2 className="font-semibold text-white text-sm">Storm Opportunity Pipeline</h2>
              </div>
              <Badge variant="danger">Highest value first</Badge>
            </div>
            <Link href="/dashboard/command-center" className="text-storm-glow hover:text-storm-purple text-xs flex items-center gap-1 font-medium transition-colors">
              Storm Ops <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          
          {hotLeads.length > 0 ? (
            <div className="divide-y divide-storm-border">
              {hotLeads.slice(0, 5).map((lead, index) => (
                <div 
                  key={lead.id}
                  className="p-4 hover:bg-storm-z2/50 transition-all duration-200 group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`flex items-center justify-center w-6 h-6 rounded-lg text-2xs font-bold ${
                          index === 0 ? 'bg-amber-500/20 text-amber-400' :
                          index === 1 ? 'bg-storm-z2 text-storm-muted' :
                          index === 2 ? 'bg-amber-700/20 text-amber-500' :
                          'bg-storm-z2 text-storm-subtle'
                        }`}>
                          {index + 1}
                        </span>
                        <h3 className="font-medium text-white text-sm truncate">{lead.address || lead.name || 'Unknown'}</h3>
                        <Badge variant={
                          (lead.lead_score || lead.score || 0) >= 80 ? 'danger' :
                          (lead.lead_score || lead.score || 0) >= 60 ? 'warning' :
                          'default'
                        }>
                          {lead.lead_score || lead.score || 0}
                        </Badge>
                      </div>
                      <p className="text-storm-subtle text-xs truncate ml-8">{lead.city}, {lead.state}</p>
                    </div>
                    <div className="flex gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link
                        href="/dashboard/ai-tools"
                        className="px-2.5 py-1.5 bg-gradient-to-r from-storm-purple to-storm-glow text-white rounded-lg text-2xs font-semibold hover:opacity-90 transition-opacity flex items-center gap-1 shadow-depth-1"
                      >
                        <Brain className="w-3 h-3" />
                        AI Prep
                      </Link>
                      {lead.phone && (
                        <a 
                          href={`tel:${lead.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 bg-emerald-500/15 text-emerald-400 rounded-lg hover:bg-emerald-500/25 transition-colors"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <a 
                        href={`https://maps.google.com?q=${encodeURIComponent(lead.address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 bg-blue-500/15 text-blue-400 rounded-lg hover:bg-blue-500/25 transition-colors"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <div className="w-14 h-14 bg-storm-z2 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Target className="w-7 h-7 text-storm-subtle" />
              </div>
              <h3 className="text-white font-medium text-sm mb-1.5">No storm opportunities yet</h3>
              <p className="text-storm-subtle text-xs mb-4">Open Storm Ops to detect hail and wind damage leads</p>
              <Link 
                href="/dashboard/command-center"
                className="button-primary inline-flex items-center gap-2 text-xs"
              >
                <Cloud className="w-3.5 h-3.5" />
                Open Storm Ops
              </Link>
            </div>
          )}
        </div>

        {/* Activity + Pipeline - Right */}
        <div className="space-y-6">
          {/* Recent Activity */}
          <div className="storm-card overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-storm-border">
              <h2 className="font-semibold text-white text-sm">Recent Activity</h2>
            </div>
            
            {stats?.data?.recentActivities && stats.data.recentActivities.length > 0 ? (
              <div className="divide-y divide-storm-border/50">
                {stats.data.recentActivities.slice(0, 5).map((activity) => (
                  <div key={activity.id} className="p-3 hover:bg-storm-z2/30 transition-all duration-200">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {getActivityIcon(activity.activity_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white">
                          <span className="font-medium">{formatActivityType(activity.activity_type)}</span>
                        </p>
                        {activity.leads?.address && (
                          <p className="text-storm-subtle text-2xs truncate mt-0.5">{activity.leads.address}</p>
                        )}
                      </div>
                      <span className="text-storm-subtle text-2xs whitespace-nowrap">
                        {timeAgo(activity.created_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center">
                <Clock className="w-5 h-5 text-storm-subtle mx-auto mb-2" />
                <p className="text-storm-muted text-xs">No activity yet</p>
              </div>
            )}
          </div>

          {/* Pipeline Overview */}
          <div className="storm-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-white text-sm flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-400" />
                Pipeline
              </h2>
            </div>
            <div className="space-y-2.5">
              <PipelineBar label="New" count={stats?.data?.pipeline?.new || 0} total={kpis?.leadsGenerated || 1} color="bg-storm-subtle" />
              <PipelineBar label="Contacted" count={stats?.data?.pipeline?.contacted || 0} total={kpis?.leadsGenerated || 1} color="bg-blue-500" />
              <PipelineBar label="Appointment" count={stats?.data?.pipeline?.appointment_set || 0} total={kpis?.leadsGenerated || 1} color="bg-storm-purple" />
              <PipelineBar label="Inspected" count={stats?.data?.pipeline?.inspected || 0} total={kpis?.leadsGenerated || 1} color="bg-amber-500" />
              <PipelineBar label="Closed Won" count={stats?.data?.pipeline?.closed || 0} total={kpis?.leadsGenerated || 1} color="bg-emerald-500" />
            </div>
          </div>
        </div>
      </div>

      {/* ─── Nearby Leads Section ─── */}
      {nearbyLeads.length > 0 && (
        <div className="storm-card overflow-hidden border-emerald-500/20 animate-fade-in-up">
          <div className="flex items-center justify-between p-4 border-b border-storm-border bg-emerald-900/10">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Crosshair className="w-4 h-4 text-emerald-400" />
                <h2 className="font-semibold text-white text-sm">Leads Near You</h2>
              </div>
              <Badge variant="success">Within 10 miles</Badge>
            </div>
            <button
              onClick={() => userLocation && fetchNearbyLeads(userLocation.lat, userLocation.lng)}
              className="text-emerald-400 hover:text-emerald-300 text-xs flex items-center gap-1 font-medium transition-colors"
            >
              <Navigation className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 stagger-children">
            {nearbyLeads.slice(0, 6).map((lead) => (
              <div 
                key={lead.id}
                className="bg-storm-z2/50 rounded-xl p-4 hover:bg-storm-z2 transition-all duration-200 border border-storm-border/50"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-white text-sm truncate">{lead.address}</h3>
                    <p className="text-storm-subtle text-xs">{lead.city}, {lead.state}</p>
                  </div>
                  <Badge variant={
                    (lead.lead_score || 0) >= 70 ? 'danger' :
                    (lead.lead_score || 0) >= 40 ? 'warning' :
                    'default'
                  }>
                    {lead.lead_score || 0}
                  </Badge>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-emerald-400 text-xs font-medium flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {lead.distance_miles} mi
                  </span>
                  <div className="flex gap-2">
                    <Link
                      href="/dashboard/ai-tools"
                      className="px-2 py-1 bg-gradient-to-r from-storm-purple to-storm-glow text-white rounded-lg text-2xs font-semibold hover:opacity-90 transition-opacity flex items-center gap-1"
                    >
                      <Brain className="w-3 h-3" />
                      Prep
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

// ─── Pipeline Bar Component ──────────────────────────────
function PipelineBar({ 
  label, count, total, color 
}: { 
  label: string; count: number; total: number; color: string;
}) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
  
  return (
    <div className="flex items-center gap-3">
      <div className="w-24 text-xs text-storm-muted font-medium">{label}</div>
      <div className="flex-1 bg-storm-z2 rounded-full h-1.5 overflow-hidden">
        <div 
          className={`${color} h-full rounded-full transition-all duration-700 ease-out`}
          style={{ width: `${Math.max(percentage, count > 0 ? 5 : 0)}%` }}
        />
      </div>
      <div className="w-8 text-right text-xs font-semibold text-white">{count}</div>
    </div>
  );
}
