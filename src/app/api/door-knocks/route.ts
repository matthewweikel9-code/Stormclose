import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET: Fetch door knocks with filters
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const filter = searchParams.get('filter') || 'week';
    const outcome = searchParams.get('outcome') || 'all';

    // Calculate date range
    let startDate: Date;
    const now = new Date();
    
    switch (filter) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(0); // All time
    }

    // Build query
    let query = supabase
      .from('door_knocks')
      .select('*')
      .eq('user_id', user.id)
      .gte('knocked_at', startDate.toISOString())
      .order('knocked_at', { ascending: false });

    if (outcome !== 'all') {
      query = query.eq('outcome', outcome);
    }

    const { data: knocks, error } = await query;

    if (error) {
      console.error('Error fetching knocks:', error);
      return NextResponse.json({ error: 'Failed to fetch knocks' }, { status: 500 });
    }

    // Calculate stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const todayKnocks = knocks?.filter(k => new Date(k.knocked_at) >= today) || [];
    const weekKnocks = knocks?.filter(k => new Date(k.knocked_at) >= weekAgo) || [];
    
    const appointments = knocks?.filter(k => k.outcome === 'appointment_set').length || 0;
    const contacts = knocks?.filter(k => 
      ['appointment_set', 'interested', 'callback', 'not_interested'].includes(k.outcome)
    ).length || 0;
    const notHome = knocks?.filter(k => k.outcome === 'not_home').length || 0;

    const stats = {
      total: knocks?.length || 0,
      today: todayKnocks.length,
      thisWeek: weekKnocks.length,
      appointments,
      contacts,
      notHome,
      conversionRate: knocks && knocks.length > 0 
        ? (appointments / knocks.length) * 100 
        : 0,
    };

    // Generate heatmap data (group by location grid)
    const heatmap = generateHeatmapData(knocks || []);

    return NextResponse.json({
      knocks: knocks || [],
      stats,
      heatmap,
    });
  } catch (error) {
    console.error('Door knocks error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Log a new door knock
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      property_address,
      latitude,
      longitude,
      outcome,
      notes,
      owner_name,
      duration_seconds,
      lead_id,
    } = body;

    if (!property_address || !outcome) {
      return NextResponse.json(
        { error: 'Property address and outcome are required' },
        { status: 400 }
      );
    }

    // Get user's team
    const { data: teamMember } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', user.id)
      .single();

    // Insert door knock
    const { data: knock, error } = await supabase
      .from('door_knocks')
      .insert({
        user_id: user.id,
        team_id: teamMember?.team_id || null,
        lead_id: lead_id || null,
        property_address,
        latitude: latitude || null,
        longitude: longitude || null,
        outcome,
        notes: notes || null,
        owner_name: owner_name || null,
        duration_seconds: duration_seconds || null,
        knocked_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error logging knock:', error);
      return NextResponse.json({ error: 'Failed to log knock' }, { status: 500 });
    }

    // Update lead status if linked
    if (lead_id) {
      const statusMap: Record<string, string> = {
        appointment_set: 'appointment_set',
        interested: 'contacted',
        callback: 'contacted',
        not_interested: 'closed_lost',
      };

      if (statusMap[outcome]) {
        await supabase
          .from('leads')
          .update({ status: statusMap[outcome] })
          .eq('id', lead_id);
      }
    }

    return NextResponse.json({ success: true, knock });
  } catch (error) {
    console.error('Log knock error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper: Generate heatmap data by grouping knocks into grid cells
function generateHeatmapData(knocks: any[]): any[] {
  const gridSize = 0.01; // ~1km grid cells
  const cells: Record<string, { lat: number; lng: number; count: number; appointments: number; contacts: number }> = {};

  knocks.forEach(knock => {
    if (!knock.latitude || !knock.longitude) return;

    const cellLat = Math.floor(knock.latitude / gridSize) * gridSize;
    const cellLng = Math.floor(knock.longitude / gridSize) * gridSize;
    const key = `${cellLat},${cellLng}`;

    if (!cells[key]) {
      cells[key] = { lat: cellLat, lng: cellLng, count: 0, appointments: 0, contacts: 0 };
    }

    cells[key].count++;
    if (knock.outcome === 'appointment_set') cells[key].appointments++;
    if (['appointment_set', 'interested', 'callback', 'not_interested'].includes(knock.outcome)) {
      cells[key].contacts++;
    }
  });

  return Object.values(cells);
}
