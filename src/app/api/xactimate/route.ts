import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/xactimate - Fetch all estimates for the user
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = (supabase as any)
      .from('xactimate_estimates')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: estimates, error } = await query;

    if (error) {
      console.error('Error fetching estimates:', error);
      return NextResponse.json({ error: 'Failed to fetch estimates' }, { status: 500 });
    }

    // Calculate stats
    const stats = {
      total: estimates?.length || 0,
      analyzed: estimates?.filter((e: any) => e.status === 'analyzed' || e.status === 'supplemented').length || 0,
      missingItems: estimates?.reduce((sum: number, e: any) => sum + (e.ai_analysis?.missing_items?.length || 0), 0) || 0,
      potentialRecovery: estimates?.reduce((sum: number, e: any) => sum + (e.ai_analysis?.suggested_supplement || 0), 0) || 0,
    };

    return NextResponse.json({ estimates: estimates || [], stats });
  } catch (error) {
    console.error('Xactimate API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/xactimate - Create a new estimate manually
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    
    const {
      claim_number,
      property_address,
      insurance_carrier,
      adjuster_name,
      adjuster_email,
      original_rcv,
      original_acv,
      depreciation,
      deductible,
    } = body;

    if (!property_address || !insurance_carrier) {
      return NextResponse.json(
        { error: 'Property address and insurance carrier are required' },
        { status: 400 }
      );
    }

    const { data: estimate, error } = await (supabase as any)
      .from('xactimate_estimates')
      .insert({
        user_id: user.id,
        claim_number,
        property_address,
        insurance_carrier,
        adjuster_name,
        adjuster_email,
        original_rcv: original_rcv || 0,
        original_acv: original_acv || 0,
        depreciation: depreciation || 0,
        deductible: deductible || 0,
        status: 'uploaded',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating estimate:', error);
      return NextResponse.json({ error: 'Failed to create estimate' }, { status: 500 });
    }

    return NextResponse.json({ estimate });
  } catch (error) {
    console.error('Xactimate API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
