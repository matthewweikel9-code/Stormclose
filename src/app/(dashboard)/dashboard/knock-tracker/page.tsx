'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  MapPin, 
  Home, 
  Calendar, 
  Clock, 
  Filter,
  Download,
  RefreshCw,
  CheckCircle,
  XCircle,
  Phone,
  User,
  ChevronDown,
  Target,
  TrendingUp,
  BarChart3
} from 'lucide-react';

interface DoorKnock {
  id: string;
  property_address: string;
  latitude: number;
  longitude: number;
  outcome: 'appointment_set' | 'interested' | 'callback' | 'not_home' | 'not_interested';
  notes?: string;
  owner_name?: string;
  knocked_at: string;
  duration_seconds?: number;
}

interface HeatmapCell {
  lat: number;
  lng: number;
  count: number;
  appointments: number;
  contacts: number;
}

interface KnockStats {
  total: number;
  today: number;
  thisWeek: number;
  appointments: number;
  contacts: number;
  notHome: number;
  conversionRate: number;
}

const OUTCOME_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  appointment_set: { bg: 'bg-emerald-500', text: 'text-emerald-400', label: 'Appointment' },
  interested: { bg: 'bg-blue-500', text: 'text-blue-400', label: 'Interested' },
  callback: { bg: 'bg-amber-500', text: 'text-amber-400', label: 'Callback' },
  not_home: { bg: 'bg-slate-500', text: 'text-slate-400', label: 'Not Home' },
  not_interested: { bg: 'bg-red-500', text: 'text-red-400', label: 'Not Interested' },
};

export default function KnockTrackerPage() {
  const [knocks, setKnocks] = useState<DoorKnock[]>([]);
  const [stats, setStats] = useState<KnockStats | null>(null);
  const [heatmapData, setHeatmapData] = useState<HeatmapCell[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all'>('week');
  const [outcomeFilter, setOutcomeFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'heatmap'>('heatmap');
  const [selectedKnock, setSelectedKnock] = useState<DoorKnock | null>(null);

  // Fetch knock data
  const fetchKnocks = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/door-knocks?filter=${dateFilter}&outcome=${outcomeFilter}`);
      if (res.ok) {
        const data = await res.json();
        setKnocks(data.knocks || []);
        setStats(data.stats);
        setHeatmapData(data.heatmap || []);
      }
    } catch (error) {
      console.error('Error fetching knocks:', error);
    } finally {
      setLoading(false);
    }
  }, [dateFilter, outcomeFilter]);

  useEffect(() => {
    fetchKnocks();
  }, [fetchKnocks]);

  const getTimeSince = (dateString: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Address', 'Outcome', 'Owner', 'Notes', 'Date', 'Duration (sec)'];
    const rows = knocks.map(k => [
      k.property_address,
      OUTCOME_COLORS[k.outcome]?.label || k.outcome,
      k.owner_name || '',
      k.notes || '',
      new Date(k.knocked_at).toLocaleString(),
      k.duration_seconds?.toString() || '',
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `knock-tracker-${dateFilter}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-[#0B0F1A] p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Target className="h-6 w-6 text-purple-400" />
            </div>
            Knock Tracker
          </h1>
          <p className="text-gray-400 mt-1">
            Track door knocks, visualize coverage, and analyze performance
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('heatmap')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                viewMode === 'heatmap' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Heatmap
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                viewMode === 'list' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              List
            </button>
          </div>

          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 transition-colors"
          >
            <Download className="h-4 w-4" />
            Export
          </button>

          <button
            onClick={fetchKnocks}
            className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <RefreshCw className={`h-5 w-5 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
        <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-4">
          <div className="flex items-center gap-2 text-gray-400 mb-1">
            <Home className="h-4 w-4" />
            <span className="text-sm">Total Knocks</span>
          </div>
          <p className="text-2xl font-bold text-white">{stats?.total || 0}</p>
        </div>

        <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-4">
          <div className="flex items-center gap-2 text-gray-400 mb-1">
            <Calendar className="h-4 w-4" />
            <span className="text-sm">Today</span>
          </div>
          <p className="text-2xl font-bold text-white">{stats?.today || 0}</p>
        </div>

        <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-4">
          <div className="flex items-center gap-2 text-emerald-400 mb-1">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm">Appointments</span>
          </div>
          <p className="text-2xl font-bold text-emerald-400">{stats?.appointments || 0}</p>
        </div>

        <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-4">
          <div className="flex items-center gap-2 text-blue-400 mb-1">
            <Phone className="h-4 w-4" />
            <span className="text-sm">Contacts Made</span>
          </div>
          <p className="text-2xl font-bold text-blue-400">{stats?.contacts || 0}</p>
        </div>

        <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-4">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <XCircle className="h-4 w-4" />
            <span className="text-sm">Not Home</span>
          </div>
          <p className="text-2xl font-bold text-slate-400">{stats?.notHome || 0}</p>
        </div>

        <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-4">
          <div className="flex items-center gap-2 text-purple-400 mb-1">
            <TrendingUp className="h-4 w-4" />
            <span className="text-sm">Conversion</span>
          </div>
          <p className="text-2xl font-bold text-purple-400">
            {stats?.conversionRate ? `${stats.conversionRate.toFixed(1)}%` : '0%'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex bg-gray-800 rounded-lg overflow-hidden">
          {(['today', 'week', 'month', 'all'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setDateFilter(filter)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                dateFilter === filter
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </button>
          ))}
        </div>

        <select
          value={outcomeFilter}
          onChange={(e) => setOutcomeFilter(e.target.value)}
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="all">All Outcomes</option>
          <option value="appointment_set">Appointments</option>
          <option value="interested">Interested</option>
          <option value="callback">Callbacks</option>
          <option value="not_home">Not Home</option>
          <option value="not_interested">Not Interested</option>
        </select>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map / Heatmap */}
        <div className="lg:col-span-2">
          <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 overflow-hidden h-[600px]">
            {viewMode === 'heatmap' ? (
              <div className="relative h-full bg-gradient-to-br from-gray-900 to-gray-800">
                {/* Grid overlay */}
                <div 
                  className="absolute inset-0 opacity-10"
                  style={{
                    backgroundImage: 'linear-gradient(#6D5CFF 1px, transparent 1px), linear-gradient(90deg, #6D5CFF 1px, transparent 1px)',
                    backgroundSize: '40px 40px'
                  }}
                />

                {/* Heatmap visualization */}
                <div className="absolute inset-0 p-4">
                  {/* Heatmap cells */}
                  {heatmapData.map((cell, index) => (
                    <div
                      key={index}
                      className="absolute rounded-full opacity-60 blur-sm"
                      style={{
                        left: `${10 + (index * 8) % 80}%`,
                        top: `${10 + (index * 12) % 80}%`,
                        width: `${Math.min(cell.count * 10, 100)}px`,
                        height: `${Math.min(cell.count * 10, 100)}px`,
                        background: `radial-gradient(circle, ${
                          cell.appointments > 0 ? 'rgba(16, 185, 129, 0.8)' : 
                          cell.contacts > 0 ? 'rgba(59, 130, 246, 0.8)' : 
                          'rgba(148, 163, 184, 0.6)'
                        } 0%, transparent 70%)`,
                      }}
                    />
                  ))}

                  {/* Individual knock markers */}
                  {knocks.slice(0, 50).map((knock, index) => (
                    <div
                      key={knock.id}
                      className="absolute cursor-pointer group"
                      style={{
                        left: `${15 + (index * 7) % 70}%`,
                        top: `${15 + (index * 11) % 70}%`,
                      }}
                      onClick={() => setSelectedKnock(knock)}
                    >
                      <div className={`w-4 h-4 rounded-full ${OUTCOME_COLORS[knock.outcome]?.bg || 'bg-gray-500'} shadow-lg`} />
                      
                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        <div className="bg-gray-900 text-white px-3 py-2 rounded-lg shadow-lg whitespace-nowrap text-sm">
                          <p className="font-medium">{knock.property_address.split(',')[0]}</p>
                          <p className={OUTCOME_COLORS[knock.outcome]?.text}>
                            {OUTCOME_COLORS[knock.outcome]?.label}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Legend */}
                <div className="absolute bottom-4 left-4 bg-gray-900/90 backdrop-blur px-4 py-3 rounded-lg">
                  <p className="text-xs text-gray-400 mb-2">Outcomes</p>
                  <div className="flex flex-wrap gap-3">
                    {Object.entries(OUTCOME_COLORS).map(([key, value]) => (
                      <div key={key} className="flex items-center gap-1.5">
                        <div className={`w-3 h-3 rounded-full ${value.bg}`} />
                        <span className="text-xs text-gray-300">{value.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Stats overlay */}
                <div className="absolute top-4 right-4 bg-gray-900/90 backdrop-blur px-4 py-3 rounded-lg">
                  <p className="text-sm text-gray-400">Showing {knocks.length} knocks</p>
                </div>
              </div>
            ) : (
              /* List View */
              <div className="h-full overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <RefreshCw className="h-8 w-8 text-gray-500 animate-spin" />
                  </div>
                ) : knocks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-8">
                    <Target className="h-12 w-12 text-gray-600 mb-4" />
                    <h3 className="text-lg font-semibold text-white mb-2">No knocks recorded</h3>
                    <p className="text-gray-400">Start knocking doors to see your activity here</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-700/50">
                    {knocks.map((knock) => (
                      <div
                        key={knock.id}
                        className="p-4 hover:bg-gray-700/30 cursor-pointer transition-colors"
                        onClick={() => setSelectedKnock(knock)}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-3 h-3 rounded-full mt-1.5 ${OUTCOME_COLORS[knock.outcome]?.bg || 'bg-gray-500'}`} />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-white truncate">{knock.property_address}</p>
                            <div className="flex items-center gap-3 mt-1 text-sm">
                              <span className={OUTCOME_COLORS[knock.outcome]?.text}>
                                {OUTCOME_COLORS[knock.outcome]?.label}
                              </span>
                              {knock.owner_name && (
                                <span className="text-gray-500 flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {knock.owner_name}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-400">{getTimeSince(knock.knocked_at)}</p>
                            {knock.duration_seconds && (
                              <p className="text-xs text-gray-500">{Math.round(knock.duration_seconds / 60)}m</p>
                            )}
                          </div>
                        </div>
                        {knock.notes && (
                          <p className="mt-2 text-sm text-gray-400 pl-6 truncate">{knock.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar - Selected Knock Details & Quick Actions */}
        <div className="space-y-4">
          {/* Selected Knock Details */}
          {selectedKnock ? (
            <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white">Knock Details</h3>
                <button
                  onClick={() => setSelectedKnock(null)}
                  className="text-gray-400 hover:text-white"
                >
                  ×
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-400">Address</p>
                  <p className="text-white">{selectedKnock.property_address}</p>
                </div>

                <div className="flex gap-4">
                  <div>
                    <p className="text-sm text-gray-400">Outcome</p>
                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded ${OUTCOME_COLORS[selectedKnock.outcome]?.bg}/20 ${OUTCOME_COLORS[selectedKnock.outcome]?.text}`}>
                      {OUTCOME_COLORS[selectedKnock.outcome]?.label}
                    </span>
                  </div>
                  {selectedKnock.owner_name && (
                    <div>
                      <p className="text-sm text-gray-400">Owner</p>
                      <p className="text-white">{selectedKnock.owner_name}</p>
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-sm text-gray-400">Time</p>
                  <p className="text-white">{formatDate(selectedKnock.knocked_at)}</p>
                </div>

                {selectedKnock.notes && (
                  <div>
                    <p className="text-sm text-gray-400">Notes</p>
                    <p className="text-gray-300">{selectedKnock.notes}</p>
                  </div>
                )}

                <div className="pt-3 border-t border-gray-700/50 flex gap-2">
                  <button className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
                    Export to JobNimbus
                  </button>
                  <button className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors">
                    Add to Route
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-6 text-center">
              <MapPin className="h-8 w-8 text-gray-600 mx-auto mb-2" />
              <p className="text-gray-400">Click a knock on the map to see details</p>
            </div>
          )}

          {/* Outcome Breakdown */}
          <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-4">
            <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-purple-400" />
              Outcome Breakdown
            </h3>

            <div className="space-y-3">
              {Object.entries(OUTCOME_COLORS).map(([key, value]) => {
                const count = knocks.filter(k => k.outcome === key).length;
                const percentage = knocks.length > 0 ? (count / knocks.length) * 100 : 0;
                
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className={value.text}>{value.label}</span>
                      <span className="text-gray-400">{count}</span>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${value.bg} transition-all duration-500`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Log */}
          <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-4">
            <h3 className="font-semibold text-white mb-4">Quick Log Knock</h3>
            <p className="text-sm text-gray-400 mb-4">
              Use the mobile app for best results, or enter manually below.
            </p>
            <button className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors">
              + Log New Knock
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
