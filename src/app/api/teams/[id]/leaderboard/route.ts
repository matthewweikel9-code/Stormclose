import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/teams/[id]/leaderboard - Get team leaderboard
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const teamId = params.id;
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'week'; // week, month, all

    // Calculate date range
    let startDate: Date;
    const now = new Date();
    
    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(0); // All time
    }

    // Get all team members
    const { data: members, error: membersError } = await supabase
      .from('team_members')
      .select('user_id, role')
      .eq('team_id', teamId);

    if (membersError) throw membersError;

    // Get stats for each member
    const leaderboard = await Promise.all(
      (members || []).map(async (member) => {
        // Get activities in period
        const { data: activities } = await supabase
          .from('activities')
          .select('type, result')
          .eq('user_id', member.user_id)
          .gte('created_at', startDate.toISOString());

        // Calculate points
        // Door knocks: 1 point
        // Phone calls: 1 point
        // Appointments set: 5 points
        // Inspections: 10 points
        // Estimates sent: 10 points
        // Deals closed: 50 points
        const pointValues: Record<string, number> = {
          door_knock: 1,
          phone_call: 1,
          appointment_set: 5,
          inspection: 10,
          estimate_sent: 10,
          deal_closed: 50
        };

        let totalPoints = 0;
        const breakdown: Record<string, number> = {};

        (activities || []).forEach(activity => {
          const points = pointValues[activity.type] || 0;
          totalPoints += points;
          breakdown[activity.type] = (breakdown[activity.type] || 0) + 1;
        });

        // Get deals revenue
        const { data: deals } = await supabase
          .from('activities')
          .select('result')
          .eq('user_id', member.user_id)
          .eq('type', 'deal_closed')
          .gte('created_at', startDate.toISOString());

        const revenue = (deals || []).reduce((sum, deal) => {
          const amount = parseFloat(deal.result?.amount || 0);
          return sum + amount;
        }, 0);

        return {
          userId: member.user_id,
          role: member.role,
          points: totalPoints,
          revenue,
          activities: breakdown,
          totalActivities: activities?.length || 0
        };
      })
    );

    // Sort by points descending
    leaderboard.sort((a, b) => b.points - a.points);

    // Add rank
    const rankedLeaderboard = leaderboard.map((entry, index) => ({
      ...entry,
      rank: index + 1
    }));

    return NextResponse.json({
      leaderboard: rankedLeaderboard,
      period,
      teamId
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard' },
      { status: 500 }
    );
  }
}
