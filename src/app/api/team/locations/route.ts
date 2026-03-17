import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET: Fetch team member locations
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's team
    const { data: teamMember } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', user.id)
      .maybeSingle() as { data: { team_id: string } | null };

    // Get team locations (no embed - team_locations.user_id refs auth.users, not public.users)
    const today = new Date().toISOString().split('T')[0];
    
    let query = (supabase.from('team_locations') as any)
      .select('*')
      .order('updated_at', { ascending: false });

    // Filter by team if user is part of a team
    if (teamMember?.team_id) {
      query = query.eq('team_id', teamMember.team_id);
    } else {
      // Solo user - just show their own location
      query = query.eq('user_id', user.id);
    }

    const { data: locations, error } = await query;

    if (error) {
      console.error('Error fetching locations:', error);
      return NextResponse.json({ error: 'Failed to fetch locations' }, { status: 500 });
    }

    const userIds = [...new Set((locations || []).map((l: any) => l.user_id).filter(Boolean))];
    const { data: users } = userIds.length > 0
      ? await (supabase.from('users') as any).select('id, email').in('id', userIds)
      : { data: [] };
    const userById = new Map((users || []).map((u: any) => [u.id, u]));

    const { data: performance } = await (supabase.from('team_performance_daily') as any)
      .select('*')
      .in('user_id', userIds)
      .eq('date', today);

    const members = (locations || []).map((location: any) => {
      const u = userById.get(location.user_id);
      const perf = performance?.find((p: any) => p.user_id === location.user_id);
      return {
        id: location.id,
        user_id: location.user_id,
        name: u?.email?.split('@')[0] || 'Unknown',
        email: u?.email,
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        heading: location.heading,
        speed: location.speed,
        battery_level: location.battery_level,
        is_active: location.is_active,
        last_activity: location.last_activity,
        updated_at: location.updated_at,
        // Today's stats
        doors_knocked: perf?.doors_knocked || 0,
        contacts_made: perf?.contacts_made || 0,
        appointments_set: perf?.appointments_set || 0,
      };
    });

    return NextResponse.json({ members });
  } catch (error) {
    console.error('Team locations error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Update my location
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { latitude, longitude, accuracy, heading, speed, battery_level } = body;

    if (!latitude || !longitude) {
      return NextResponse.json({ error: 'Latitude and longitude required' }, { status: 400 });
    }

    // Get user's team
    const { data: teamMember2 } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', user.id)
      .single() as { data: { team_id: string } | null };

    // Determine activity based on speed
    let activity = 'idle';
    if (speed && speed > 5) {
      activity = 'driving';
    } else if (speed && speed > 0.5) {
      activity = 'knocking';
    }

    // Upsert location
    const { error } = await (supabase.from('team_locations') as any)
      .upsert({
        user_id: user.id,
        team_id: teamMember2?.team_id || null,
        latitude,
        longitude,
        accuracy: accuracy || null,
        heading: heading || null,
        speed: speed || null,
        battery_level: battery_level || null,
        is_active: true,
        last_activity: activity,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      });

    if (error) {
      console.error('Error updating location:', error);
      return NextResponse.json({ error: 'Failed to update location' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Location update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Stop tracking (set inactive)
export async function DELETE() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await (supabase.from('team_locations') as any)
      .update({ is_active: false })
      .eq('user_id', user.id);

    if (error) {
      console.error('Error stopping tracking:', error);
      return NextResponse.json({ error: 'Failed to stop tracking' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Stop tracking error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
