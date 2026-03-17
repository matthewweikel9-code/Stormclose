import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveWriteTeamIdForUser } from '@/lib/server/tenant';

export const dynamic = 'force-dynamic';

// GET /api/team/goals - Team goals and progress
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const teamId = await resolveWriteTeamIdForUser(supabase, user.id, null);
    if (!teamId) {
      return NextResponse.json({
        teamGoal: 0,
        teamRevenue: 0,
        progress: 0,
        members: [],
      });
    }

    // Get team members
    const { data: members } = await (supabase.from('team_members') as any)
      .select('user_id')
      .eq('team_id', teamId);
    const userIds = (members ?? []).map((m: any) => m.user_id);

    if (userIds.length === 0) {
      return NextResponse.json({
        teamGoal: 0,
        teamRevenue: 0,
        progress: 0,
        members: [],
      });
    }

    // Current month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

    // Get user goals for team members
    const { data: goalsRows } = await (supabase.from('user_goals') as any)
      .select('user_id, monthly_revenue_goal, monthly_deal_goal')
      .in('user_id', userIds)
      .eq('month', monthStart);

    const goalByUser = new Map<string, { revenue: number; deals: number }>();
    for (const row of goalsRows ?? []) {
      goalByUser.set(row.user_id, {
        revenue: parseFloat(row.monthly_revenue_goal) || 25000,
        deals: parseInt(row.monthly_deal_goal, 10) || 4,
      });
    }

    // Get team performance for this month
    const { data: perfData } = await (supabase as any)
      .from('team_performance_daily')
      .select('user_id, user_name, revenue, closed')
      .eq('team_id', teamId)
      .gte('date', monthStart);

    const memberStats = new Map<string, { name: string; revenue: number; closed: number }>();
    for (const row of perfData ?? []) {
      const existing = memberStats.get(row.user_id) || { name: row.user_name || 'Team Member', revenue: 0, closed: 0 };
      existing.revenue += parseFloat(row.revenue) || 0;
      existing.closed += parseInt(row.closed, 10) || 0;
      memberStats.set(row.user_id, existing);
    }

    const teamGoal = Array.from(goalByUser.values()).reduce((s, g) => s + g.revenue, 0)
      || userIds.length * 25000;
    const teamRevenue = Array.from(memberStats.values()).reduce((s, m) => s + m.revenue, 0);
    const progress = teamGoal > 0 ? Math.min(100, Math.round((teamRevenue / teamGoal) * 100)) : 0;

    const memberProgress = userIds.map((uid: string) => {
      const goal = goalByUser.get(uid) || { revenue: 25000, deals: 4 };
      const stats = memberStats.get(uid) || { name: 'Team Member', revenue: 0, closed: 0 };
      const pct = goal.revenue > 0 ? Math.min(100, Math.round((stats.revenue / goal.revenue) * 100)) : 0;
      return {
        id: uid,
        name: stats.name,
        goal: goal.revenue,
        revenue: stats.revenue,
        closed: stats.closed,
        progress: pct,
      };
    });

    return NextResponse.json({
      teamGoal,
      teamRevenue,
      progress,
      members: memberProgress.sort((a: { revenue: number }, b: { revenue: number }) => b.revenue - a.revenue),
    });
  } catch (error) {
    console.error('Team goals error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
