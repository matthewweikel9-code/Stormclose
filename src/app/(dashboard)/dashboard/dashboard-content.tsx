'use client';

import React, { useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
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
  Navigation
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
        <div className="bg-gradient-to-r from-red-600 to-orange-600 rounded-xl p-4 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 rounded-full p-2">
              <CloudRain className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-white">🚨 Storm Alert</h3>
              <p className="text-white/90 text-sm">
                {hailAlerts[0].size}" hail reported {hailAlerts[0].distance_miles.toFixed(1)} miles away in {hailAlerts[0].city}
              </p>
            </div>
            <button className="bg-white text-red-600 px-4 py-2 rounded-lg font-medium hover:bg-white/90 transition-colors">
              View Leads
            </button>
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
            {stats?.data?.kpis?.appointmentsSet || 0} appointments this week • {hotLeads.length} hot leads ready
          </p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => window.location.href = '/dashboard/leads'}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            View Leads
          </button>
          <button 
            onClick={() => window.location.href = '/dashboard/route-planner'}
            className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <Navigation className="w-4 h-4" />
            Route Planner
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KPICard
          label="Total Leads"
          value={stats?.data?.kpis?.leadsGenerated || 0}
          subtext={`${hotLeads.length} hot`}
          icon={<Users className="w-5 h-5" />}
          color="blue"
        />
        <KPICard
          label="Appointments"
          value={stats?.data?.kpis?.appointmentsSet || 0}
          subtext="this week"
          icon={<Calendar className="w-5 h-5" />}
          color="purple"
        />
        <KPICard
          label="Deals Closed"
          value={stats?.data?.kpis?.dealsClosed || 0}
          subtext="this month"
          icon={<Zap className="w-5 h-5" />}
          color="green"
        />
        <KPICard
          label="Pipeline"
          value={formatCurrency(stats?.data?.kpis?.pipelineValue || 0)}
          subtext={`${stats?.data?.kpis?.dealsClosed || 0} deals closed`}
          icon={<DollarSign className="w-5 h-5" />}
          color="yellow"
        />
        <KPICard
          label="Close Rate"
          value={`${stats?.data?.kpis?.closeRate || 0}%`}
          subtext={`${stats?.data?.activitySummary?.appointmentsSet || 0} appts set`}
          icon={<TrendingUp className="w-5 h-5" />}
          color="emerald"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hot Leads - Left Column */}
        <div className="lg:col-span-2 bg-gray-800/50 rounded-xl border border-gray-700/50 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-gray-700/50">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <h2 className="font-semibold text-white">Hot Leads</h2>
            </div>
            <a href="/dashboard/leads" className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1">
              View All <ChevronRight className="w-4 h-4" />
            </a>
          </div>
          
          {hotLeads.length > 0 ? (
            <div className="divide-y divide-gray-700/50">
              {hotLeads.map((lead) => (
                <div 
                  key={lead.id}
                  className="p-4 hover:bg-gray-700/30 transition-colors cursor-pointer"
                  onClick={() => window.location.href = `/dashboard/leads`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-white">{lead.address || lead.name || 'Unknown'}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium text-white ${getScoreColor(lead.score_tier || getScoreTier(lead.lead_score))}`}>
                          {lead.lead_score || lead.score || 0}
                        </span>
                      </div>
                      <p className="text-gray-400 text-sm mt-0.5">{lead.address}</p>
                      {lead.phone && (
                        <p className="text-gray-500 text-sm mt-1">{lead.phone}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          window.location.href = `tel:${lead.phone}`;
                        }}
                        className="p-2 bg-green-600/20 text-green-400 rounded-lg hover:bg-green-600/30 transition-colors"
                      >
                        <Phone className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(`https://maps.google.com?q=${encodeURIComponent(lead.address)}`, '_blank');
                        }}
                        className="p-2 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/30 transition-colors"
                      >
                        <MapPin className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No hot leads yet</p>
              <p className="text-gray-500 text-sm mt-1">Import leads or sync storm data to get started</p>
            </div>
          )}
        </div>

        {/* Activity Feed - Right Column */}
        <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-gray-700/50">
            <h2 className="font-semibold text-white">Recent Activity</h2>
            <a href="/dashboard/leads" className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1">
              View All <ChevronRight className="w-4 h-4" />
            </a>
          </div>
          
          {stats?.data?.recentActivities && stats.data.recentActivities.length > 0 ? (
            <div className="divide-y divide-gray-700/50">
              {stats.data.recentActivities.slice(0, 8).map((activity) => (
                <div key={activity.id} className="p-3 hover:bg-gray-700/30 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {getActivityIcon(activity.activity_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white">
                        <span className="font-medium">{formatActivityType(activity.activity_type)}</span>
                        {activity.leads?.address && (
                          <span className="text-gray-400"> • {activity.leads.address}</span>
                        )}
                      </p>
                      {activity.description && (
                        <p className="text-gray-500 text-xs truncate mt-0.5">{activity.description}</p>
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
              <Clock className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No activity yet</p>
              <p className="text-gray-500 text-sm mt-1">Start knocking doors to see your activity here</p>
            </div>
          )}
        </div>
      </div>

      {/* Pipeline Overview */}
      <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-700/50">
          <h2 className="font-semibold text-white">Pipeline Overview</h2>
          <a href="/dashboard/leads" className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1">
            View Pipeline <ChevronRight className="w-4 h-4" />
          </a>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-5 gap-2">
            <PipelineStage 
              label="New" 
              count={stats?.data?.pipeline?.new || 0} 
              color="bg-gray-500" 
            />
            <PipelineStage 
              label="Contacted" 
              count={stats?.data?.pipeline?.contacted || 0} 
              color="bg-blue-500" 
            />
            <PipelineStage 
              label="Appointment" 
              count={stats?.data?.pipeline?.appointment_set || 0} 
              color="bg-purple-500" 
            />
            <PipelineStage 
              label="Inspected" 
              count={stats?.data?.pipeline?.inspected || 0} 
              color="bg-yellow-500" 
            />
            <PipelineStage 
              label="Closed" 
              count={stats?.data?.pipeline?.closed || 0} 
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

// Pipeline Stage Component
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
