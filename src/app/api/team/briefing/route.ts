import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveWriteTeamIdForUser } from '@/lib/server/tenant';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// POST: Generate AI team briefing
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const teamId = await resolveWriteTeamIdForUser(supabase, user.id, null);
    if (!teamId) {
      return NextResponse.json({ error: 'Create a team first' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'AI not configured' }, { status: 503 });
    }

    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 7);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const [perfRes, goalsRes, activitiesRes] = await Promise.all([
      (supabase as any).from('team_performance_daily').select('*').eq('team_id', teamId).gte('date', weekStart.toISOString().split('T')[0]),
      (supabase as any).from('team_members').select('user_id').eq('team_id', teamId),
      (supabase as any).from('activities').select('activity_type, user_id, created_at').eq('team_id', teamId).gte('created_at', weekStart.toISOString()).limit(100),
    ]);

    const perfData = perfRes.data || [];
    const memberIds = (goalsRes.data || []).map((m: any) => m.user_id);
    let teamGoal = 0;
    if (memberIds.length > 0) {
      const { data: ug } = await (supabase as any).from('user_goals').select('monthly_revenue_goal').in('user_id', memberIds).eq('month', monthStart);
      teamGoal = (ug || []).reduce((s: number, r: any) => s + (parseFloat(r.monthly_revenue_goal) || 25000), 0) || memberIds.length * 25000;
    }
    const goals = { teamGoal };
    const activities = activitiesRes.data || [];

    const userIds = [...new Set(perfData.map((r: any) => r.user_id))];
    const { data: users } = userIds.length > 0
      ? await (supabase.from('users') as any).select('id, email').in('id', userIds)
      : { data: [] };
    const nameById = new Map((users || []).map((u: any) => [u.id, u.email?.split('@')[0] || 'Team Member']));

    const memberMap = new Map<string, { name: string; doors: number; appointments: number; closed: number; revenue: number }>();
    for (const row of perfData) {
      const existing = memberMap.get(row.user_id) || { name: nameById.get(row.user_id) || row.user_name || 'Team Member', doors: 0, appointments: 0, closed: 0, revenue: 0 };
      existing.doors += row.doors_knocked || 0;
      existing.appointments += row.appointments_set ?? row.appointments ?? 0;
      existing.closed += row.deals_closed ?? row.closed ?? 0;
      existing.revenue += parseFloat(row.closed_value ?? row.revenue) || 0;
      memberMap.set(row.user_id, existing);
    }

    const members = Array.from(memberMap.values()).sort((a, b) => b.revenue - a.revenue);
    const teamDoors = members.reduce((s, m) => s + m.doors, 0);
    const teamRevenue = members.reduce((s, m) => s + m.revenue, 0);
    const teamClosed = members.reduce((s, m) => s + m.closed, 0);
    const teamAppointments = members.reduce((s, m) => s + m.appointments, 0);
    const progress = teamGoal > 0 ? Math.min(100, Math.round((teamRevenue / teamGoal) * 100)) : 0;

    const prompt = `You are a sales team coach. Generate a concise, motivating team briefing (2-3 short paragraphs) for the past week.

TEAM DATA:
- Total doors knocked: ${teamDoors}
- Appointments set: ${teamAppointments}
- Deals closed: ${teamClosed}
- Revenue: $${teamRevenue.toLocaleString()}
- Monthly goal: $${(goals.teamGoal || 0).toLocaleString()} (${progress}% progress)

TOP PERFORMERS:
${members.slice(0, 3).map((m, i) => `${i + 1}. ${m.name}: ${m.doors} doors, ${m.closed} deals, $${m.revenue.toLocaleString()}`).join('\n')}

Write a brief, actionable summary. Start with the headline win or highlight. End with one specific call to action. Keep it under 150 words. Use a casual, motivating tone.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
    });

    const briefing = completion.choices[0]?.message?.content?.trim() || 'Unable to generate briefing.';

    return NextResponse.json({ briefing, members: members.slice(0, 5), teamRevenue, teamClosed, teamDoors });
  } catch (error) {
    console.error('Team briefing error:', error);
    return NextResponse.json({ error: 'Failed to generate briefing' }, { status: 500 });
  }
}
