import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveWriteTeamIdForUser } from '@/lib/server/tenant';
import { logger } from '@/lib/logger';
import { metrics } from '@/lib/metrics';

// GET /api/team/performance - Get team performance data
export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const { correlationId, log } = logger.fromRequest(request, {
    route: '/api/team/performance',
    method: 'GET',
  });
  const { metric } = metrics.fromRequest(request, {
    route: '/api/team/performance',
    method: 'GET',
  });

  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      log.warn('team_performance.unauthorized');
      return NextResponse.json({ error: 'Unauthorized', correlationId }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get('timeframe') || 'week';
    const requestedTeamId = searchParams.get('teamId');
    let teamId: string | null = null;
    try {
      teamId = await resolveWriteTeamIdForUser(supabase, user.id, requestedTeamId);
    } catch (error) {
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : 'teamId is required',
          correlationId,
        },
        { status: 400 }
      );
    }

    if (!teamId) {
      return NextResponse.json({
        members: [],
        stats: {
          totalDoors: 0,
          totalAppointments: 0,
          totalLeads: 0,
          totalClosed: 0,
          totalRevenue: 0,
          avgConversion: 0,
          topPerformer: '',
          bestStreak: 0,
        },
        teamId: null,
        timeframe,
        correlationId,
      });
    }

    // Calculate date range
    const startDate = getStartDateForTimeframe(timeframe);

    // Get team members and their performance
    const members = await getTeamPerformance(supabase, teamId, startDate);

    // Calculate team stats
    const stats = {
      totalDoors: members.reduce((sum, m) => sum + m.stats.doorsKnocked, 0),
      totalAppointments: members.reduce((sum, m) => sum + m.stats.appointments, 0),
      totalLeads: members.reduce((sum, m) => sum + m.stats.leads, 0),
      totalClosed: members.reduce((sum, m) => sum + m.stats.closed, 0),
      totalRevenue: members.reduce((sum, m) => sum + m.stats.revenue, 0),
      avgConversion: members.length > 0 
        ? members.reduce((sum, m) => sum + m.stats.conversionRate, 0) / members.length 
        : 0,
      topPerformer: members[0]?.name || '',
      bestStreak: Math.max(...members.map(m => m.stats.streak), 0),
    };

    log.info('team_performance.success', {
      userId: user.id,
      teamId,
      timeframe,
      members: members.length,
      latencyMs: Date.now() - startedAt,
    });
    metric.increment('api_latency_ms', Date.now() - startedAt);

    return NextResponse.json({ members, stats, teamId, timeframe, correlationId });
  } catch (error) {
    log.error('team_performance.error', {
      message: error instanceof Error ? error.message : String(error),
      latencyMs: Date.now() - startedAt,
    });
    metric.increment('api_error', 1, { scope: 'team_performance' });
    return NextResponse.json({ error: 'Internal server error', correlationId }, { status: 500 });
  }
}

function getStartDateForTimeframe(timeframe: string): Date {
  const now = new Date();
  switch (timeframe) {
    case 'today':
      return new Date(now.setHours(0, 0, 0, 0));
    case 'month':
      return new Date(now.setMonth(now.getMonth() - 1));
    case 'quarter':
      return new Date(now.setMonth(now.getMonth() - 3));
    case 'week':
    default:
      return new Date(now.setDate(now.getDate() - 7));
  }
}

async function getTeamPerformance(
  supabase: any,
  teamId: string,
  startDate: Date
): Promise<any[]> {
  const { data: performanceData, error } = await (supabase as any)
    .from('team_performance_daily')
    .select('*')
    .eq('team_id', teamId)
    .gte('date', startDate.toISOString().split('T')[0]);

  if (error) {
    throw new Error(error.message || 'Failed to fetch team performance');
  }

  if (!performanceData || performanceData.length === 0) {
    return [];
  }

  const memberMap = new Map<string, any>();

  for (const record of performanceData) {
    const existing = memberMap.get(record.user_id) || {
      id: record.user_id,
      name: record.user_name || 'Team Member',
      role: 'Sales Rep',
      stats: {
        doorsKnocked: 0,
        appointments: 0,
        leads: 0,
        closed: 0,
        revenue: 0,
        conversionRate: 0,
        avgDealSize: 0,
        streak: 0,
      },
      change: {
        doorsKnocked: 0,
        appointments: 0,
        leads: 0,
        closed: 0,
        revenue: 0,
      },
      achievements: [],
      isOnline: false,
    };

    existing.stats.doorsKnocked += record.doors_knocked || 0;
    existing.stats.appointments += record.appointments || 0;
    existing.stats.leads += record.leads || 0;
    existing.stats.closed += record.closed || 0;
    existing.stats.revenue += record.revenue || 0;
    existing.stats.streak = Math.max(existing.stats.streak, record.streak || 0);
    memberMap.set(record.user_id, existing);
  }

  const members = Array.from(memberMap.values());
  members.forEach((m) => {
    m.stats.conversionRate =
      m.stats.doorsKnocked > 0 ? Math.min(100, (m.stats.appointments / m.stats.doorsKnocked) * 100) : 0;
    m.stats.avgDealSize = m.stats.closed > 0 ? m.stats.revenue / m.stats.closed : 0;
  });

  members.sort((a, b) => b.stats.revenue - a.stats.revenue);
  members.forEach((m, i) => {
    m.rank = i + 1;
    m.previousRank = m.rank;
  });

  return members;
}
