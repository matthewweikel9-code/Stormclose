'use client';

import React, { useEffect, useState, useCallback } from 'react';
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
  Plus,
  Navigation,
  Sparkles,
  Cloud,
  ArrowRight,
  ExternalLink,
  Crosshair,
  Loader2
} from 'lucide-react';
import { SkeletonDashboard } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

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
  score?: number; // legacy alias
  score_tier?: string;
  status: string;
  phone?: string;
  last_contact?: string;
  updated_at?: string;
  distance_miles?: number;
}

interface HailAlert {
  city: string;
  state: string;
  size: number;
  date: string;
  distance_miles: number;
}

interface DashboardContentProps {
  user: User;
  subscriptionStatus: string;
  subscriptionTier: 'free' | 'pro' | 'pro_plus';
  logoutAction: () => Promise<void>;
}

export function DashboardContent({ 
  user, 
  subscriptionStatus, 
  subscriptionTier, 
  logoutAction 
}: DashboardContentProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [hotLeads, setHotLeads] = useState<Lead[]>([]);
  const [nearbyLeads, setNearbyLeads] = useState<Lead[]>([]);
  const [hailAlerts, setHailAlerts] = useState<HailAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{lat: number; lng: number} | null>(null);

  // Get user's first name from email or metadata
  const userName = user.user_metadata?.full_name?.split(' ')[0] || 
                   user.email?.split('@')[0] || 
                   'there';

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Fetch nearby leads based on user location
  const fetchNearbyLeads = useCallback(async (lat: number, lng: number, radius: number = 10) => {
    try {
      const res = await fetch(`/api/leads/nearby?lat=${lat}&lng=${lng}&radius=${radius}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        setNearbyLeads(data.leads || []);
      }
    } catch (error) {
      console.error('Error fetching nearby leads:', error);
    }
  }, []);

  // Get user's location
  const handleGetLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      return;
    }

    setLocationLoading(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        setLocationLoading(false);
        fetchNearbyLeads(latitude, longitude);
      },
      (error) => {
        let errorMessage = 'Failed to get location';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location permission denied';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location unavailable';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out';
            break;
        }
        setLocationError(errorMessage);
        setLocationLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  }, [fetchNearbyLeads]);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, leadsRes] = await Promise.all([
        fetch('/api/dashboard/stats'),
        fetch('/api/leads?tier=hot&limit=5')
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
        // Set hot leads from stats if available
        if (statsData?.data?.hotLeads) {
          setHotLeads(statsData.data.hotLeads);
        }
        // Set hail alerts from stats
        if (statsData?.data?.hailAlerts?.events) {
          setHailAlerts(statsData.data.hailAlerts.events.map((e: any) => ({
            city: e.location_name || 'Unknown',
            state: e.state,
            size: e.size_inches,
            date: e.event_date,
            distance_miles: e.distance_miles || 0
          })));
        }
      }

      // Fallback: fetch leads separately if not in stats
      if (leadsRes.ok && hotLeads.length === 0) {
        const leadsData = await leadsRes.json();
        if (leadsData.leads) {
          setHotLeads(leadsData.leads);
        }
      }

      // Check for recent hail events (would need user's location)
      // For now, we'll check if there are any hot leads (indicating storm activity)
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
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

  const getScoreColor = (tier: string) => {
    switch (tier) {
      case 'hot': return 'bg-red-500';
      case 'warm': return 'bg-orange-500';
      case 'moderate': return 'bg-yellow-500';
      default: return 'bg-blue-500';
    }
  };

  const getScoreTier = (score: number): string => {
    if (score >= 70) return 'hot';
    if (score >= 40) return 'warm';
    return 'cold';
  };

  const timeAgo = (date: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  if (loading) {
    return <SkeletonDashboard />;
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Storm Alert Banner */}
      {hailAlerts.length > 0 && (
        <div className="storm-card overflow-hidden border-red-500/30 bg-gradient-to-r from-red-600/10 to-orange-600/10 animate-fade-in-up">
          <div className="flex items-center gap-3 p-4">
            <div className="bg-red-500/20 rounded-xl p-2.5 animate-pulse">
              <CloudRain className="w-5 h-5 text-red-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-white flex items-center gap-2 text-sm">
                <span className="status-dot-danger" />
                Storm Alert — New Opportunities Detected
              </h3>
              <p className="text-storm-muted text-xs mt-0.5">
                {hailAlerts[0].size}&quot; hail reported {hailAlerts[0].distance_miles.toFixed(1)} miles away in {hailAlerts[0].city}
              </p>
            </div>
            <Link 
              href="/dashboard/leads"
              className="button-primary flex items-center gap-2 text-xs"
            >
              View Leads <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* Header with Greeting */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {getGreeting()}, {userName}
          </h1>
          <p className="text-storm-muted text-sm mt-1">
            {hotLeads.length > 0 ? (
              <span className="text-emerald-400 font-medium">{hotLeads.length} hot leads</span>
            ) : (
              <span>No hot leads</span>
            )} ready · {stats?.data?.kpis?.appointmentsSet || 0} appointments this week
          </p>
        </div>
        <div className="flex gap-3">
          <Link 
            href="/dashboard/command-center"
            className="button-primary flex items-center gap-2 text-sm"
          >
            <Cloud className="w-4 h-4" />
            Storm Command
          </Link>
          <Link 
            href="/dashboard/leads"
            className="button-secondary flex items-center gap-2 text-sm"
          >
            <Users className="w-4 h-4" />
            View Leads
          </Link>
        </div>
      </div>

      {/* Quick Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 stagger-children">
        {/* Leads Near Me */}
        <button
          onClick={handleGetLocation}
          disabled={locationLoading}
          className="group storm-card-interactive p-5 text-left disabled:opacity-50"
        >
          <div className="flex items-start justify-between">
            <div className="bg-emerald-500/15 rounded-xl p-2.5">
              {locationLoading ? (
                <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
              ) : (
                <Crosshair className="w-5 h-5 text-emerald-400" />
              )}
            </div>
            <ChevronRight className="w-4 h-4 text-storm-subtle group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
          </div>
          <h3 className="text-sm font-semibold text-white mt-4">Leads Near Me</h3>
          <p className="text-storm-subtle text-xs mt-1">
            {locationError || (nearbyLeads.length > 0 
              ? `${nearbyLeads.length} leads within 10 mi` 
              : 'Find leads near your location')}
          </p>
          <div className="mt-3">
            <Badge variant="success">
              <MapPin className="w-3 h-3" />
              {userLocation ? 'Location set' : 'Click to locate'}
            </Badge>
          </div>
        </button>

        {/* Storm Intelligence */}
        <Link 
          href="/dashboard/command-center"
          className="group storm-card-glow p-5"
        >
          <div className="flex items-start justify-between">
            <div className="bg-storm-purple/15 rounded-xl p-2.5">
              <CloudRain className="w-5 h-5 text-storm-glow" />
            </div>
            <ChevronRight className="w-4 h-4 text-storm-subtle group-hover:text-storm-glow group-hover:translate-x-0.5 transition-all" />
          </div>
          <h3 className="text-sm font-semibold text-white mt-4">Storm Command</h3>
          <p className="text-storm-subtle text-xs mt-1">Monitor weather & manage territories</p>
          <div className="mt-3">
            <Badge variant={hailAlerts.length > 0 ? "danger" : "purple"}>
              {hailAlerts.length > 0 && <span className="status-dot-danger mr-1" />}
              {hailAlerts.length > 0 ? `${hailAlerts.length} active alerts` : 'No active alerts'}
            </Badge>
          </div>
        </Link>

        {/* Hot Leads */}
        <Link 
          href="/dashboard/leads"
          className="group storm-card-interactive p-5"
        >
          <div className="flex items-start justify-between">
            <div className="bg-orange-500/15 rounded-xl p-2.5">
              <Target className="w-5 h-5 text-orange-400" />
            </div>
            <ChevronRight className="w-4 h-4 text-storm-subtle group-hover:text-orange-400 group-hover:translate-x-0.5 transition-all" />
          </div>
          <h3 className="text-sm font-semibold text-white mt-4">Hot Leads</h3>
          <p className="text-storm-subtle text-xs mt-1">AI-scored high-value opportunities</p>
          <div className="mt-3">
            <Badge variant="warning">
              <span className="status-dot bg-orange-400 animate-pulse mr-1" />
              {hotLeads.length} ready to contact
            </Badge>
          </div>
        </Link>

        {/* AI Prep */}
        <Link 
          href="/dashboard/leads"
          className="group storm-card-interactive p-5"
        >
          <div className="flex items-start justify-between">
            <div className="bg-amber-500/15 rounded-xl p-2.5">
              <Sparkles className="w-5 h-5 text-amber-400" />
            </div>
            <ChevronRight className="w-4 h-4 text-storm-subtle group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
          </div>
          <h3 className="text-sm font-semibold text-white mt-4">AI Sales Prep</h3>
          <p className="text-storm-subtle text-xs mt-1">Get briefed before every knock</p>
          <div className="mt-3">
            <Badge variant="warning">
              Prep Me for any lead →
            </Badge>
          </div>
        </Link>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hot Leads - Left Column */}
        <div className="lg:col-span-2 storm-card overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-storm-border">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="status-dot-danger" />
                <h2 className="font-semibold text-white text-sm">Hot Leads</h2>
              </div>
              <Badge variant="danger">Ready to close</Badge>
            </div>
            <Link href="/dashboard/leads" className="text-storm-glow hover:text-storm-purple text-xs flex items-center gap-1 font-medium transition-colors">
              View All <ChevronRight className="w-3.5 h-3.5" />
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
                        href="/dashboard/leads"
                        className="px-2.5 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg text-2xs font-semibold hover:from-amber-600 hover:to-orange-600 transition-colors flex items-center gap-1 shadow-depth-1"
                      >
                        <Sparkles className="w-3 h-3" />
                        Prep
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
              <h3 className="text-white font-medium text-sm mb-1.5">No hot leads yet</h3>
              <p className="text-storm-subtle text-xs mb-4">Set up Storm Command to auto-generate leads</p>
              <Link 
                href="/dashboard/command-center"
                className="button-primary inline-flex items-center gap-2 text-xs"
              >
                <Cloud className="w-3.5 h-3.5" />
                Set Up Storm Command
              </Link>
            </div>
          )}
        </div>

        {/* Activity Feed - Right Column */}
        <div className="storm-card overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-storm-border">
            <h2 className="font-semibold text-white text-sm">Recent Activity</h2>
          </div>
          
          {stats?.data?.recentActivities && stats.data.recentActivities.length > 0 ? (
            <div className="divide-y divide-storm-border/50">
              {stats.data.recentActivities.slice(0, 6).map((activity) => (
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
            <div className="p-8 text-center">
              <div className="w-12 h-12 bg-storm-z2 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Clock className="w-5 h-5 text-storm-subtle" />
              </div>
              <p className="text-storm-muted text-xs">No activity yet</p>
              <p className="text-storm-subtle text-2xs mt-1">Start working leads to see activity</p>
            </div>
          )}
        </div>
      </div>

      {/* Nearby Leads Section */}
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
              onClick={handleGetLocation}
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
                      href="/dashboard/leads"
                      className="px-2 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg text-2xs font-semibold hover:from-amber-600 hover:to-orange-600 transition-colors flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3" />
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

      {/* Bottom Row - KPIs + Pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* KPI Cards */}
        <div className="storm-card p-5">
          <h2 className="font-semibold text-white text-sm mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            Performance
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-storm-z2/50 rounded-xl p-4 border border-storm-border/50">
              <p className="text-storm-subtle text-2xs uppercase tracking-wider font-medium">Pipeline Value</p>
              <p className="text-xl font-bold text-white mt-1.5 animate-count-up">{formatCurrency(stats?.data?.kpis?.pipelineValue || 0)}</p>
              <p className="text-emerald-400 text-2xs mt-1 font-medium">{stats?.data?.kpis?.dealsClosed || 0} deals closed</p>
            </div>
            <div className="bg-storm-z2/50 rounded-xl p-4 border border-storm-border/50">
              <p className="text-storm-subtle text-2xs uppercase tracking-wider font-medium">Close Rate</p>
              <p className="text-xl font-bold text-white mt-1.5 animate-count-up">{stats?.data?.kpis?.closeRate || 0}%</p>
              <p className="text-blue-400 text-2xs mt-1 font-medium">{stats?.data?.kpis?.appointmentsSet || 0} appointments</p>
            </div>
            <div className="bg-storm-z2/50 rounded-xl p-4 border border-storm-border/50">
              <p className="text-storm-subtle text-2xs uppercase tracking-wider font-medium">Total Leads</p>
              <p className="text-xl font-bold text-white mt-1.5 animate-count-up">{stats?.data?.kpis?.leadsGenerated || 0}</p>
              <p className="text-orange-400 text-2xs mt-1 font-medium">{hotLeads.length} hot</p>
            </div>
            <div className="bg-storm-z2/50 rounded-xl p-4 border border-storm-border/50">
              <p className="text-storm-subtle text-2xs uppercase tracking-wider font-medium">Closed Value</p>
              <p className="text-xl font-bold text-white mt-1.5 animate-count-up">{formatCurrency(stats?.data?.kpis?.closedValue || 0)}</p>
              <p className="text-storm-glow text-2xs mt-1 font-medium">This month</p>
            </div>
          </div>
        </div>

        {/* Pipeline Overview */}
        <div className="storm-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white text-sm flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-400" />
              Pipeline
            </h2>
            <Link href="/dashboard/leads" className="text-storm-glow hover:text-storm-purple text-2xs flex items-center gap-1 font-medium transition-colors">
              Manage <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-3">
            <PipelineBar 
              label="New" 
              count={stats?.data?.pipeline?.new || 0} 
              total={stats?.data?.kpis?.leadsGenerated || 1}
              color="bg-storm-subtle" 
            />
            <PipelineBar 
              label="Contacted" 
              count={stats?.data?.pipeline?.contacted || 0}
              total={stats?.data?.kpis?.leadsGenerated || 1}
              color="bg-blue-500" 
            />
            <PipelineBar 
              label="Appointment" 
              count={stats?.data?.pipeline?.appointment_set || 0}
              total={stats?.data?.kpis?.leadsGenerated || 1}
              color="bg-storm-purple" 
            />
            <PipelineBar 
              label="Inspected" 
              count={stats?.data?.pipeline?.inspected || 0}
              total={stats?.data?.kpis?.leadsGenerated || 1}
              color="bg-amber-500" 
            />
            <PipelineBar 
              label="Closed Won" 
              count={stats?.data?.pipeline?.closed || 0}
              total={stats?.data?.kpis?.leadsGenerated || 1}
              color="bg-emerald-500" 
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// KPI Card Component
function KPICard({ 
  label, 
  value, 
  subtext, 
  icon, 
  color 
}: { 
  label: string; 
  value: string | number; 
  subtext: string; 
  icon: React.ReactNode; 
  color: 'blue' | 'purple' | 'green' | 'yellow' | 'emerald';
}) {
  const colors = {
    blue: 'from-blue-600 to-blue-700',
    purple: 'from-purple-600 to-purple-700',
    green: 'from-green-600 to-green-700',
    yellow: 'from-yellow-600 to-yellow-700',
    emerald: 'from-emerald-600 to-emerald-700'
  };

  return (
    <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-4 hover:border-gray-600/50 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <span className="text-gray-400 text-sm">{label}</span>
        <div className={`p-1.5 rounded-lg bg-gradient-to-br ${colors[color]} text-white`}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-gray-500 text-sm">{subtext}</p>
    </div>
  );
}

// Pipeline Bar Component
function PipelineBar({ 
  label, 
  count,
  total,
  color 
}: { 
  label: string; 
  count: number;
  total: number;
  color: string;
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

// Pipeline Stage Component (kept for compatibility)
function PipelineStage({ 
  label, 
  count, 
  color 
}: { 
  label: string; 
  count: number; 
  color: string;
}) {
  return (
    <div className="text-center">
      <div className={`${color} h-2 rounded-full mb-2`}></div>
      <p className="text-white font-semibold">{count}</p>
      <p className="text-gray-500 text-xs">{label}</p>
    </div>
  );
}
