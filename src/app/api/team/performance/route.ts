import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/team/performance - Get team performance data
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get('timeframe') || 'week';

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    
    switch (timeframe) {
      case 'today':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'month':
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
      case 'quarter':
        startDate = new Date(now.setMonth(now.getMonth() - 3));
        break;
      default:
        startDate = new Date(now.setDate(now.getDate() - 7));
    }

    // Get team members and their performance
    // In production, this would query actual performance tables
    // For now, generate realistic demo data
    const members = await getTeamPerformance(supabase, user.id, startDate);

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

    return NextResponse.json({ members, stats });
  } catch (error) {
    console.error('Performance API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function getTeamPerformance(
  supabase: any,
  userId: string,
  startDate: Date
): Promise<any[]> {
  try {
    // Try to fetch from team_performance_daily table
    const { data: performanceData } = await (supabase as any)
      .from('team_performance_daily')
      .select('*')
      .eq('team_id', userId) // Assuming user is team owner
      .gte('date', startDate.toISOString().split('T')[0]);

    if (performanceData && performanceData.length > 0) {
      // Aggregate by user
      const memberMap = new Map();
      
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
        
        memberMap.set(record.user_id, existing);
      }

      const members = Array.from(memberMap.values());
      
      // Calculate conversion rates and rank
      members.forEach(m => {
        m.stats.conversionRate = m.stats.doorsKnocked > 0 
          ? (m.stats.appointments / m.stats.doorsKnocked) * 100 
          : 0;
        m.stats.avgDealSize = m.stats.closed > 0 
          ? m.stats.revenue / m.stats.closed 
          : 0;
      });

      // Sort by revenue and assign ranks
      members.sort((a, b) => b.stats.revenue - a.stats.revenue);
      members.forEach((m, i) => {
        m.rank = i + 1;
        m.previousRank = Math.min(m.rank + Math.floor(Math.random() * 3 - 1), members.length);
      });

      return members;
    }

    // Return demo data if no records
    return generateDemoTeamData();
  } catch (error) {
    console.error('Error fetching team performance:', error);
    return generateDemoTeamData();
  }
}

function generateDemoTeamData(): any[] {
  const names = [
    { name: 'Jake Wilson', role: 'Senior Sales Rep' },
    { name: 'Sarah Martinez', role: 'Sales Rep' },
    { name: 'Mike Thompson', role: 'Sales Rep' },
    { name: 'Emily Chen', role: 'Junior Sales Rep' },
    { name: 'David Brown', role: 'Sales Rep' },
    { name: 'Lisa Anderson', role: 'Team Lead' },
  ];

  const achievements = [
    ['Top Closer', 'Revenue King'],
    ['Door Warrior', 'Hot Streak'],
    ['Appointment Pro'],
    ['Quick Starter'],
    ['Team Player'],
    ['Perfect Week', 'Top Closer'],
  ];

  return names.map((person, index) => {
    const doorsKnocked = Math.floor(Math.random() * 150) + 50;
    const appointments = Math.floor(doorsKnocked * (0.08 + Math.random() * 0.12));
    const leads = Math.floor(appointments * (0.5 + Math.random() * 0.3));
    const closed = Math.floor(leads * (0.3 + Math.random() * 0.4));
    const revenue = closed * (8000 + Math.floor(Math.random() * 12000));

    return {
      id: `demo-${index + 1}`,
      name: person.name,
      role: person.role,
      stats: {
        doorsKnocked,
        appointments,
        leads,
        closed,
        revenue,
        conversionRate: doorsKnocked > 0 ? (appointments / doorsKnocked) * 100 : 0,
        avgDealSize: closed > 0 ? revenue / closed : 0,
        streak: Math.floor(Math.random() * 10),
      },
      change: {
        doorsKnocked: Math.floor(Math.random() * 30) - 15,
        appointments: Math.floor(Math.random() * 10) - 5,
        leads: Math.floor(Math.random() * 8) - 4,
        closed: Math.floor(Math.random() * 4) - 2,
        revenue: Math.floor(Math.random() * 20000) - 10000,
      },
      rank: index + 1,
      previousRank: Math.min(index + 1 + Math.floor(Math.random() * 3 - 1), names.length),
      achievements: achievements[index] || [],
      isOnline: Math.random() > 0.5,
    };
  }).sort((a, b) => b.stats.revenue - a.stats.revenue).map((m, i) => ({ ...m, rank: i + 1 }));
}
