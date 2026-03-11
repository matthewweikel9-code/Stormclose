import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// POST /api/jobnimbus/disconnect - Disconnect from JobNimbus
export async function POST() {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Delete integration
    await (supabase as any)
      .from('jobnimbus_integrations')
      .delete()
      .eq('user_id', user.id);

    // Delete synced data
    await (supabase as any)
      .from('jobnimbus_contacts')
      .delete()
      .eq('user_id', user.id);

    await (supabase as any)
      .from('jobnimbus_jobs')
      .delete()
      .eq('user_id', user.id);

    // Log disconnect
    await (supabase as any)
      .from('jobnimbus_sync_log')
      .insert({
        user_id: user.id,
        direction: 'outbound',
        entity_type: 'contact',
        action: 'delete',
        status: 'success',
        message: 'Disconnected from JobNimbus',
      });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Disconnect error:', error);
    return NextResponse.json({ error: 'Disconnect failed' }, { status: 500 });
  }
}
