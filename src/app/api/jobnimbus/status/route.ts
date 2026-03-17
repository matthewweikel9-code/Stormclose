import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET /api/jobnimbus/status - Get sync status
export async function GET() {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has JobNimbus connected
    const { data: integration } = await (supabase as any)
      .from('jobnimbus_integrations')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!integration) {
      return NextResponse.json({
        connected: false,
        status: null,
        logs: [],
        webhookEvents: [],
      });
    }

    // Get sync logs
    const { data: logs } = await (supabase as any)
      .from('jobnimbus_sync_log')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    // Get webhook events (if table exists)
    let webhookEvents: any[] = [];
    try {
      const { data: events } = await (supabase as any)
        .from('jobnimbus_webhook_events')
        .select('*')
        .eq('user_id', user.id)
        .order('received_at', { ascending: false })
        .limit(20);
      webhookEvents = events || [];
    } catch (e) {
      // Table may not exist
    }

    // Calculate stats
    const status = {
      connected: true,
      lastSync: integration.last_sync_at,
      contactsCount: integration.contacts_count || 0,
      jobsCount: integration.jobs_count || 0,
      pendingSync: integration.pending_changes || 0,
      errors: [],
    };

    return NextResponse.json({
      connected: true,
      status,
      logs: logs || [],
      webhookEvents,
    });
  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
