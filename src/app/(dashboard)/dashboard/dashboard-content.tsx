'use client';

import React, { useEffect, useState } from 'react';
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
  ExternalLink
} from 'lucide-react';

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
  const [hailAlerts, setHailAlerts] = useState<HailAlert[]>([]);
  const [loading, setLoading] = useState(true);

  // Get user's first name from email or metadata
  const userName = user.user_metadata?.full_name?.split(' ')[0] || 
                   user.email?.split('@')[0] || 
                   'there';

  useEffect(() => {
    fetchDashboardData();
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
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Storm Alert Banner - Only shows if recent hail nearby */}
      {hailAlerts.length > 0 && (
        <div className="bg-gradient-to-r from-red-600 to-orange-600 rounded-xl p-4 shadow-lg border border-red-500/50">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 rounded-full p-2 animate-pulse">
              <CloudRain className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-white flex items-center gap-2">
                🚨 Storm Alert — New Opportunities Detected
              </h3>
              <p className="text-white/90 text-sm">
                {hailAlerts[0].size}" hail reported {hailAlerts[0].distance_miles.toFixed(1)} miles away in {hailAlerts[0].city}
              </p>
            </div>
            <Link 
              href="/dashboard/leads"
              className="bg-white text-red-600 px-4 py-2 rounded-lg font-medium hover:bg-white/90 transition-colors flex items-center gap-2"
            >
              View Leads <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}

      {/* Header with Greeting */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {getGreeting()}, {userName}!
          </h1>
          <p className="text-gray-400 mt-1">
            {hotLeads.length > 0 ? (
              <span className="text-green-400 font-medium">{hotLeads.length} hot leads</span>
            ) : (
              <span>No hot leads</span>
            )} ready • {stats?.data?.kpis?.appointmentsSet || 0} appointments this week
          </p>
        </div>
        <div className="flex gap-3">
          <Link 
            href="/dashboard/territories"
            className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-all shadow-lg shadow-purple-500/25"
          >
            <Cloud className="w-4 h-4" />
            Storm Command
          </Link>
          <Link 
            href="/dashboard/leads"
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <Users className="w-4 h-4" />
            View Leads
          </Link>
        </div>
      </div>

      {/* Quick Action Cards - High Impact Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Storm Intelligence Card */}
        <Link 
          href="/dashboard/territories"
          className="group bg-gradient-to-br from-purple-900/50 to-indigo-900/50 rounded-xl border border-purple-500/30 p-5 hover:border-purple-500/50 transition-all hover:shadow-lg hover:shadow-purple-500/10"
        >
          <div className="flex items-start justify-between">
            <div className="bg-purple-500/20 rounded-lg p-2.5">
              <CloudRain className="w-6 h-6 text-purple-400" />
            </div>
            <ChevronRight className="w-5 h-5 text-purple-400 group-hover:translate-x-1 transition-transform" />
          </div>
          <h3 className="text-lg font-semibold text-white mt-4">Storm Command</h3>
          <p className="text-purple-300/70 text-sm mt-1">Monitor weather & manage territories</p>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-1 rounded-full">
              {hailAlerts.length > 0 ? `${hailAlerts.length} active alerts` : 'No active alerts'}
            </span>
          </div>
        </Link>

        {/* Hot Leads Card */}
        <Link 
          href="/dashboard/leads"
          className="group bg-gradient-to-br from-orange-900/50 to-red-900/50 rounded-xl border border-orange-500/30 p-5 hover:border-orange-500/50 transition-all hover:shadow-lg hover:shadow-orange-500/10"
        >
          <div className="flex items-start justify-between">
            <div className="bg-orange-500/20 rounded-lg p-2.5">
              <Target className="w-6 h-6 text-orange-400" />
            </div>
            <ChevronRight className="w-5 h-5 text-orange-400 group-hover:translate-x-1 transition-transform" />
          </div>
          <h3 className="text-lg font-semibold text-white mt-4">Hot Leads</h3>
          <p className="text-orange-300/70 text-sm mt-1">AI-scored high-value opportunities</p>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs bg-orange-500/20 text-orange-300 px-2 py-1 rounded-full flex items-center gap-1">
              <span className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></span>
              {hotLeads.length} ready to contact
            </span>
          </div>
        </Link>

        {/* AI Prep Card */}
        <Link 
          href="/dashboard/leads"
          className="group bg-gradient-to-br from-yellow-900/50 to-amber-900/50 rounded-xl border border-yellow-500/30 p-5 hover:border-yellow-500/50 transition-all hover:shadow-lg hover:shadow-yellow-500/10"
        >
          <div className="flex items-start justify-between">
            <div className="bg-yellow-500/20 rounded-lg p-2.5">
              <Sparkles className="w-6 h-6 text-yellow-400" />
            </div>
            <ChevronRight className="w-5 h-5 text-yellow-400 group-hover:translate-x-1 transition-transform" />
          </div>
          <h3 className="text-lg font-semibold text-white mt-4">AI Sales Prep</h3>
          <p className="text-yellow-300/70 text-sm mt-1">Get briefed before every knock</p>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded-full">
              Prep Me for any lead →
            </span>
          </div>
        </Link>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hot Leads - Left Column */}
        <div className="lg:col-span-2 bg-gray-800/50 rounded-xl border border-gray-700/50 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-gray-700/50">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                <h2 className="font-semibold text-white text-lg">Hot Leads</h2>
              </div>
              <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
                Ready to close
              </span>
            </div>
            <Link href="/dashboard/leads" className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1 font-medium">
              View All <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          
          {hotLeads.length > 0 ? (
            <div className="divide-y divide-gray-700/50">
              {hotLeads.slice(0, 5).map((lead, index) => (
                <div 
                  key={lead.id}
                  className="p-4 hover:bg-gray-700/30 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                          index === 0 ? 'bg-yellow-500 text-yellow-900' :
                          index === 1 ? 'bg-gray-300 text-gray-700' :
                          index === 2 ? 'bg-amber-600 text-amber-100' :
                          'bg-gray-600 text-gray-300'
                        }`}>
                          {index + 1}
                        </span>
                        <h3 className="font-medium text-white truncate">{lead.address || lead.name || 'Unknown'}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          (lead.lead_score || lead.score || 0) >= 80 ? 'bg-red-500 text-white' :
                          (lead.lead_score || lead.score || 0) >= 60 ? 'bg-orange-500 text-white' :
                          'bg-yellow-500 text-yellow-900'
                        }`}>
                          {lead.lead_score || lead.score || 0}
                        </span>
                      </div>
                      <p className="text-gray-400 text-sm truncate">{lead.city}, {lead.state}</p>
                    </div>
                    <div className="flex gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link
                        href="/dashboard/leads"
                        className="px-3 py-1.5 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg text-xs font-medium hover:from-yellow-600 hover:to-orange-600 transition-colors flex items-center gap-1"
                      >
                        <Sparkles className="w-3 h-3" />
                        Prep Me
                      </Link>
                      {lead.phone && (
                        <a 
                          href={`tel:${lead.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 bg-green-600/20 text-green-400 rounded-lg hover:bg-green-600/30 transition-colors"
                        >
                          <Phone className="w-4 h-4" />
                        </a>
                      )}
                      <a 
                        href={`https://maps.google.com?q=${encodeURIComponent(lead.address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/30 transition-colors"
                      >
                        <MapPin className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Target className="w-8 h-8 text-gray-500" />
              </div>
              <h3 className="text-white font-medium mb-2">No hot leads yet</h3>
              <p className="text-gray-400 text-sm mb-4">Set up Storm Command to auto-generate leads</p>
              <Link 
                href="/dashboard/territories"
                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Cloud className="w-4 h-4" />
                Set Up Storm Command
              </Link>
            </div>
          )}
        </div>

        {/* Activity Feed - Right Column */}
        <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-gray-700/50">
            <h2 className="font-semibold text-white">Recent Activity</h2>
          </div>
          
          {stats?.data?.recentActivities && stats.data.recentActivities.length > 0 ? (
            <div className="divide-y divide-gray-700/50">
              {stats.data.recentActivities.slice(0, 6).map((activity) => (
                <div key={activity.id} className="p-3 hover:bg-gray-700/30 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {getActivityIcon(activity.activity_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white">
                        <span className="font-medium">{formatActivityType(activity.activity_type)}</span>
                      </p>
                      {activity.leads?.address && (
                        <p className="text-gray-500 text-xs truncate mt-0.5">{activity.leads.address}</p>
                      )}
                    </div>
                    <span className="text-gray-500 text-xs whitespace-nowrap">
                      {timeAgo(activity.created_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <div className="w-12 h-12 bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-3">
                <Clock className="w-6 h-6 text-gray-500" />
              </div>
              <p className="text-gray-400 text-sm">No activity yet</p>
              <p className="text-gray-500 text-xs mt-1">Start working leads to see activity</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row - KPIs + Pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* KPI Cards */}
        <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-5">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-400" />
            Performance
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-700/30 rounded-lg p-4">
              <p className="text-gray-400 text-xs uppercase tracking-wide">Pipeline Value</p>
              <p className="text-2xl font-bold text-white mt-1">{formatCurrency(stats?.data?.kpis?.pipelineValue || 0)}</p>
              <p className="text-green-400 text-xs mt-1">{stats?.data?.kpis?.dealsClosed || 0} deals closed</p>
            </div>
            <div className="bg-gray-700/30 rounded-lg p-4">
              <p className="text-gray-400 text-xs uppercase tracking-wide">Close Rate</p>
              <p className="text-2xl font-bold text-white mt-1">{stats?.data?.kpis?.closeRate || 0}%</p>
              <p className="text-blue-400 text-xs mt-1">{stats?.data?.kpis?.appointmentsSet || 0} appointments</p>
            </div>
            <div className="bg-gray-700/30 rounded-lg p-4">
              <p className="text-gray-400 text-xs uppercase tracking-wide">Total Leads</p>
              <p className="text-2xl font-bold text-white mt-1">{stats?.data?.kpis?.leadsGenerated || 0}</p>
              <p className="text-orange-400 text-xs mt-1">{hotLeads.length} hot</p>
            </div>
            <div className="bg-gray-700/30 rounded-lg p-4">
              <p className="text-gray-400 text-xs uppercase tracking-wide">Closed Value</p>
              <p className="text-2xl font-bold text-white mt-1">{formatCurrency(stats?.data?.kpis?.closedValue || 0)}</p>
              <p className="text-purple-400 text-xs mt-1">This month</p>
            </div>
          </div>
        </div>

        {/* Pipeline Overview */}
        <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-400" />
              Pipeline
            </h2>
            <Link href="/dashboard/leads" className="text-blue-400 hover:text-blue-300 text-xs flex items-center gap-1">
              Manage <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-3">
            <PipelineBar 
              label="New" 
              count={stats?.data?.pipeline?.new || 0} 
              total={stats?.data?.kpis?.leadsGenerated || 1}
              color="bg-gray-500" 
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
              color="bg-purple-500" 
            />
            <PipelineBar 
              label="Inspected" 
              count={stats?.data?.pipeline?.inspected || 0}
              total={stats?.data?.kpis?.leadsGenerated || 1}
              color="bg-yellow-500" 
            />
            <PipelineBar 
              label="Closed Won" 
              count={stats?.data?.pipeline?.closed || 0}
              total={stats?.data?.kpis?.leadsGenerated || 1}
              color="bg-green-500" 
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
      <div className="w-24 text-sm text-gray-400">{label}</div>
      <div className="flex-1 bg-gray-700/50 rounded-full h-2 overflow-hidden">
        <div 
          className={`${color} h-full rounded-full transition-all duration-500`}
          style={{ width: `${Math.max(percentage, count > 0 ? 5 : 0)}%` }}
        />
      </div>
      <div className="w-8 text-right text-sm font-medium text-white">{count}</div>
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
