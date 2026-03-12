'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Trophy, 
  Users, 
  Target,
  TrendingUp,
  DollarSign,
  Clock,
  Medal,
  Crown,
  Flame,
  Zap,
  Calendar,
  ChevronUp,
  ChevronDown,
  Minus,
  BarChart3,
  Home,
  Phone,
  FileText,
  Star,
  Award,
  RefreshCw
} from 'lucide-react';

interface TeamMember {
  id: string;
  name: string;
  avatar?: string;
  role: string;
  stats: {
    doorsKnocked: number;
    appointments: number;
    leads: number;
    closed: number;
    revenue: number;
    conversionRate: number;
    avgDealSize: number;
    streak: number;
  };
  change: {
    doorsKnocked: number;
    appointments: number;
    leads: number;
    closed: number;
    revenue: number;
  };
  rank: number;
  previousRank: number;
  achievements: string[];
  isOnline: boolean;
}

interface TeamStats {
  totalDoors: number;
  totalAppointments: number;
  totalLeads: number;
  totalClosed: number;
  totalRevenue: number;
  avgConversion: number;
  topPerformer: string;
  bestStreak: number;
}

export default function TeamPerformancePage() {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamStats, setTeamStats] = useState<TeamStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<'today' | 'week' | 'month' | 'quarter'>('week');
  const [sortBy, setSortBy] = useState<'rank' | 'revenue' | 'appointments' | 'doors'>('rank');
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);

  // Fetch team performance data
  const fetchTeamData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/team/performance?timeframe=${timeframe}`);
      if (res.ok) {
        const data = await res.json();
        setTeamMembers(data.members || []);
        setTeamStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching team data:', error);
    } finally {
      setLoading(false);
    }
  }, [timeframe]);

  useEffect(() => {
    fetchTeamData();
  }, [fetchTeamData]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toLocaleString()}`;
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return { icon: Crown, color: 'text-yellow-400', bg: 'bg-yellow-500/20' };
    if (rank === 2) return { icon: Medal, color: 'text-gray-300', bg: 'bg-gray-500/20' };
    if (rank === 3) return { icon: Medal, color: 'text-amber-600', bg: 'bg-amber-500/20' };
    return { icon: null, color: 'text-gray-400', bg: 'bg-gray-800' };
  };

  const getRankChange = (current: number, previous: number) => {
    const change = previous - current; // Lower rank is better
    if (change > 0) return { icon: ChevronUp, color: 'text-emerald-400', text: `+${change}` };
    if (change < 0) return { icon: ChevronDown, color: 'text-red-400', text: `${change}` };
    return { icon: Minus, color: 'text-gray-500', text: '-' };
  };

  const getAchievementIcon = (achievement: string) => {
    const icons: { [key: string]: any } = {
      'Top Closer': Trophy,
      'Door Warrior': Home,
      'Hot Streak': Flame,
      'Revenue King': DollarSign,
      'Appointment Pro': Calendar,
      'Quick Starter': Zap,
      'Team Player': Users,
      'Perfect Week': Star,
    };
    return icons[achievement] || Award;
  };

  const sortedMembers = [...teamMembers].sort((a, b) => {
    switch (sortBy) {
      case 'revenue': return b.stats.revenue - a.stats.revenue;
      case 'appointments': return b.stats.appointments - a.stats.appointments;
      case 'doors': return b.stats.doorsKnocked - a.stats.doorsKnocked;
      default: return a.rank - b.rank;
    }
  });

  return (
    <div className="min-h-screen bg-storm-z0 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Trophy className="h-6 w-6 text-purple-400" />
            </div>
            Team Performance
          </h1>
          <p className="text-gray-400 mt-1">
            Track team metrics, leaderboards, and achievements
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Timeframe selector */}
          <div className="flex bg-gray-800/50 rounded-lg p-1">
            {(['today', 'week', 'month', 'quarter'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  timeframe === tf
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {tf.charAt(0).toUpperCase() + tf.slice(1)}
              </button>
            ))}
          </div>

          <button
            onClick={fetchTeamData}
            className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <RefreshCw className={`h-5 w-5 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Team Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
        <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-4">
          <div className="flex items-center gap-2 text-gray-400 mb-1">
            <Home className="h-4 w-4" />
            <span className="text-sm">Total Doors</span>
          </div>
          <p className="text-2xl font-bold text-white">{teamStats?.totalDoors || 0}</p>
        </div>

        <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-4">
          <div className="flex items-center gap-2 text-blue-400 mb-1">
            <Calendar className="h-4 w-4" />
            <span className="text-sm">Appointments</span>
          </div>
          <p className="text-2xl font-bold text-blue-400">{teamStats?.totalAppointments || 0}</p>
        </div>

        <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-4">
          <div className="flex items-center gap-2 text-orange-400 mb-1">
            <Target className="h-4 w-4" />
            <span className="text-sm">Leads</span>
          </div>
          <p className="text-2xl font-bold text-orange-400">{teamStats?.totalLeads || 0}</p>
        </div>

        <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-4">
          <div className="flex items-center gap-2 text-emerald-400 mb-1">
            <FileText className="h-4 w-4" />
            <span className="text-sm">Closed Deals</span>
          </div>
          <p className="text-2xl font-bold text-emerald-400">{teamStats?.totalClosed || 0}</p>
        </div>

        <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-4">
          <div className="flex items-center gap-2 text-purple-400 mb-1">
            <DollarSign className="h-4 w-4" />
            <span className="text-sm">Revenue</span>
          </div>
          <p className="text-2xl font-bold text-purple-400">{formatCurrency(teamStats?.totalRevenue || 0)}</p>
        </div>

        <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-4">
          <div className="flex items-center gap-2 text-yellow-400 mb-1">
            <TrendingUp className="h-4 w-4" />
            <span className="text-sm">Conversion</span>
          </div>
          <p className="text-2xl font-bold text-yellow-400">{teamStats?.avgConversion?.toFixed(1) || 0}%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leaderboard */}
        <div className="lg:col-span-2">
          <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 overflow-hidden">
            <div className="p-4 border-b border-gray-700/50 flex items-center justify-between">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <Trophy className="h-5 w-5 text-purple-400" />
                Leaderboard
              </h3>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-1 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white focus:outline-none"
              >
                <option value="rank">By Rank</option>
                <option value="revenue">By Revenue</option>
                <option value="appointments">By Appointments</option>
                <option value="doors">By Doors</option>
              </select>
            </div>

            <div className="divide-y divide-gray-700/50">
              {loading ? (
                <div className="p-8 text-center">
                  <RefreshCw className="h-8 w-8 text-gray-500 animate-spin mx-auto" />
                  <p className="text-gray-400 mt-2">Loading team data...</p>
                </div>
              ) : sortedMembers.length === 0 ? (
                <div className="p-8 text-center">
                  <Users className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                  <h3 className="text-white font-medium mb-1">No team members yet</h3>
                  <p className="text-gray-400 text-sm">Invite your team to get started</p>
                </div>
              ) : (
                sortedMembers.map((member, index) => {
                  const rankBadge = getRankBadge(member.rank);
                  const rankChange = getRankChange(member.rank, member.previousRank);
                  const RankIcon = rankBadge.icon;
                  const ChangeIcon = rankChange.icon;

                  return (
                    <button
                      key={member.id}
                      onClick={() => setSelectedMember(member)}
                      className={`w-full p-4 text-left hover:bg-gray-700/30 transition-colors ${
                        selectedMember?.id === member.id ? 'bg-gray-700/50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        {/* Rank */}
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${rankBadge.bg}`}>
                          {RankIcon ? (
                            <RankIcon className={`h-5 w-5 ${rankBadge.color}`} />
                          ) : (
                            <span className={`text-lg font-bold ${rankBadge.color}`}>{member.rank}</span>
                          )}
                        </div>

                        {/* Avatar & Name */}
                        <div className="flex items-center gap-3 flex-1">
                          <div className="relative">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold">
                              {member.name.split(' ').map(n => n[0]).join('')}
                            </div>
                            {member.isOnline && (
                              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-gray-800" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-white">{member.name}</p>
                              {member.stats.streak >= 5 && (
                                <span className="flex items-center gap-1 px-1.5 py-0.5 bg-orange-500/20 rounded text-orange-400 text-xs">
                                  <Flame className="h-3 w-3" />
                                  {member.stats.streak}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-500">{member.role}</p>
                          </div>
                        </div>

                        {/* Stats */}
                        <div className="hidden md:flex items-center gap-6 text-sm">
                          <div className="text-center">
                            <p className="text-gray-500">Doors</p>
                            <p className="text-white font-medium">{member.stats.doorsKnocked}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-gray-500">Appts</p>
                            <p className="text-blue-400 font-medium">{member.stats.appointments}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-gray-500">Closed</p>
                            <p className="text-emerald-400 font-medium">{member.stats.closed}</p>
                          </div>
                          <div className="text-center min-w-[80px]">
                            <p className="text-gray-500">Revenue</p>
                            <p className="text-purple-400 font-medium">{formatCurrency(member.stats.revenue)}</p>
                          </div>
                        </div>

                        {/* Rank Change */}
                        <div className="flex items-center gap-1 min-w-[40px]">
                          <ChangeIcon className={`h-4 w-4 ${rankChange.color}`} />
                          <span className={`text-sm ${rankChange.color}`}>{rankChange.text}</span>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Selected Member Details / Achievements */}
        <div className="space-y-6">
          {/* Member Detail */}
          {selectedMember ? (
            <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xl font-bold">
                  {selectedMember.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">{selectedMember.name}</h3>
                  <p className="text-gray-400">{selectedMember.role}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-purple-400">Rank #{selectedMember.rank}</span>
                    {selectedMember.stats.streak >= 3 && (
                      <span className="flex items-center gap-1 text-orange-400 text-sm">
                        <Flame className="h-4 w-4" />
                        {selectedMember.stats.streak} day streak
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="p-3 bg-gray-900/50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-white">{selectedMember.stats.doorsKnocked}</p>
                  <p className="text-xs text-gray-500">Doors Knocked</p>
                </div>
                <div className="p-3 bg-gray-900/50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-blue-400">{selectedMember.stats.appointments}</p>
                  <p className="text-xs text-gray-500">Appointments</p>
                </div>
                <div className="p-3 bg-gray-900/50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-emerald-400">{selectedMember.stats.closed}</p>
                  <p className="text-xs text-gray-500">Closed Deals</p>
                </div>
                <div className="p-3 bg-gray-900/50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-purple-400">{formatCurrency(selectedMember.stats.revenue)}</p>
                  <p className="text-xs text-gray-500">Revenue</p>
                </div>
              </div>

              {/* Conversion Rate */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">Conversion Rate</span>
                  <span className="text-sm font-medium text-white">{selectedMember.stats.conversionRate.toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full"
                    style={{ width: `${Math.min(selectedMember.stats.conversionRate, 100)}%` }}
                  />
                </div>
              </div>

              {/* Achievements */}
              {selectedMember.achievements.length > 0 && (
                <div>
                  <p className="text-sm text-gray-400 mb-2">Achievements</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedMember.achievements.map((achievement, i) => {
                      const Icon = getAchievementIcon(achievement);
                      return (
                        <span
                          key={i}
                          className="flex items-center gap-1 px-2 py-1 bg-yellow-500/20 rounded text-yellow-400 text-xs"
                        >
                          <Icon className="h-3 w-3" />
                          {achievement}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-6 text-center">
              <Users className="h-12 w-12 text-gray-600 mx-auto mb-3" />
              <h3 className="text-white font-medium mb-1">Select a Team Member</h3>
              <p className="text-gray-400 text-sm">Click on a row to see detailed stats</p>
            </div>
          )}

          {/* Top Achievements */}
          <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-6">
            <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
              <Award className="h-5 w-5 text-yellow-400" />
              Recent Achievements
            </h3>
            <div className="space-y-3">
              {teamMembers
                .flatMap(m => m.achievements.map(a => ({ name: m.name, achievement: a })))
                .slice(0, 5)
                .map((item, i) => {
                  const Icon = getAchievementIcon(item.achievement);
                  return (
                    <div key={i} className="flex items-center gap-3 p-2 bg-gray-900/50 rounded-lg">
                      <div className="p-1.5 bg-yellow-500/20 rounded">
                        <Icon className="h-4 w-4 text-yellow-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-white text-sm">{item.achievement}</p>
                        <p className="text-xs text-gray-500">{item.name}</p>
                      </div>
                    </div>
                  );
                })}
              {teamMembers.length === 0 && (
                <p className="text-gray-500 text-center py-4">No achievements yet</p>
              )}
            </div>
          </div>

          {/* Daily Goals */}
          <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-xl border border-purple-500/30 p-6">
            <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
              <Target className="h-5 w-5 text-purple-400" />
              Team Goals
            </h3>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-400">Daily Doors (500)</span>
                  <span className="text-sm text-white">{teamStats?.totalDoors || 0}/500</span>
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-500 rounded-full"
                    style={{ width: `${Math.min(((teamStats?.totalDoors || 0) / 500) * 100, 100)}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-400">Weekly Revenue ($50K)</span>
                  <span className="text-sm text-white">{formatCurrency(teamStats?.totalRevenue || 0)}/$50K</span>
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${Math.min(((teamStats?.totalRevenue || 0) / 50000) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
