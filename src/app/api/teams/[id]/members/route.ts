import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/teams/[id]/members - List team members
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const teamId = params.id;

    const { data: members, error } = await supabase
      .from('team_members')
      .select(`
        id,
        user_id,
        role,
        created_at
      `)
      .eq('team_id', teamId);

    if (error) throw error;

    // Get member stats
    const memberStats = await Promise.all(
      (members || []).map(async (member) => {
        // Get activity counts for each member
        const [leadsRes, dealsRes, activitiesRes] = await Promise.all([
          supabase
            .from('leads')
            .select('id', { count: 'exact', head: true })
            .eq('assigned_to', member.user_id)
            .eq('team_id', teamId),
          supabase
            .from('activities')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', member.user_id)
            .eq('type', 'deal_closed'),
          supabase
            .from('activities')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', member.user_id)
            .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        ]);

        return {
          ...member,
          stats: {
            leads: leadsRes.count || 0,
            deals: dealsRes.count || 0,
            weeklyActivities: activitiesRes.count || 0
          }
        };
      })
    );

    return NextResponse.json({ members: memberStats });
  } catch (error) {
    console.error('Error fetching team members:', error);
    return NextResponse.json(
      { error: 'Failed to fetch team members' },
      { status: 500 }
    );
  }
}

// POST /api/teams/[id]/members - Add team member
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const teamId = params.id;
    const body = await request.json();
    const { userId, email, role = 'member' } = body;

    // Either userId or email must be provided
    let targetUserId = userId;

    if (!targetUserId && email) {
      // Look up user by email (would need auth system integration)
      // For now, require userId
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    if (!targetUserId) {
      return NextResponse.json(
        { error: 'User ID or email is required' },
        { status: 400 }
      );
    }

    // Check if already a member
    const { data: existing } = await supabase
      .from('team_members')
      .select('id')
      .eq('team_id', teamId)
      .eq('user_id', targetUserId)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'User is already a team member' },
        { status: 400 }
      );
    }

    // Add member
    const { data: member, error } = await supabase
      .from('team_members')
      .insert({
        team_id: teamId,
        user_id: targetUserId,
        role
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ member }, { status: 201 });
  } catch (error) {
    console.error('Error adding team member:', error);
    return NextResponse.json(
      { error: 'Failed to add team member' },
      { status: 500 }
    );
  }
}

// DELETE /api/teams/[id]/members - Remove team member
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const teamId = params.id;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Can't remove owner
    const { data: member } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .single();

    if (member?.role === 'owner') {
      return NextResponse.json(
        { error: 'Cannot remove team owner' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('team_id', teamId)
      .eq('user_id', userId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing team member:', error);
    return NextResponse.json(
      { error: 'Failed to remove team member' },
      { status: 500 }
    );
  }
}
