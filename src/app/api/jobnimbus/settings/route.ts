import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveJobNimbusIntegrationRow } from '@/lib/jobnimbus/resolve-integration';

export const dynamic = 'force-dynamic';

// PUT /api/jobnimbus/settings - Update sync settings
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const settings = await request.json();

    const integration = await resolveJobNimbusIntegrationRow(supabase, user.id);
    if (!integration?.id) {
      return NextResponse.json({ error: 'Not connected to JobNimbus' }, { status: 400 });
    }

    const { error } = await (supabase as any)
      .from('jobnimbus_integrations')
      .update({
        settings,
        updated_at: new Date().toISOString(),
      })
      .eq('id', integration.id as string);

    if (error) {
      console.error('Settings update error:', error);
      return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/jobnimbus/settings - Get sync settings
export async function GET() {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const integration = await resolveJobNimbusIntegrationRow(supabase, user.id);

    return NextResponse.json({ settings: (integration?.settings as object) || {} });
  } catch (error) {
    console.error('Settings fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
