import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createJobNimbusClient } from '@/lib/jobnimbus';

// Type for user_settings with JN fields (not yet in generated types)
interface UserSettingsWithJN {
  jobnimbus_api_key?: string | null;
  jobnimbus_connected_at?: string | null;
}

/**
 * POST /api/integrations/jobnimbus/connect
 * Save/update JobNimbus API key for the user
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const { apiKey } = body;
    
    if (!apiKey || typeof apiKey !== 'string') {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      );
    }
    
    // Test the API key by making a test request
    const client = createJobNimbusClient(apiKey);
    const isValid = await client.testConnection();
    
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid API key. Please check your JobNimbus API key and try again.' },
        { status: 400 }
      );
    }
    
    // Save to user_settings - using type assertion since new columns aren't in generated types yet
    const { error: upsertError } = await (supabase
      .from('user_settings') as any)
      .upsert({
        user_id: user.id,
        jobnimbus_api_key: apiKey,
        jobnimbus_connected_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      });
    
    if (upsertError) {
      console.error('Failed to save JobNimbus connection:', upsertError);
      return NextResponse.json(
        { error: 'Failed to save connection' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'JobNimbus connected successfully',
    });
  } catch (error) {
    console.error('JobNimbus connect error:', error);
    return NextResponse.json(
      { error: 'Failed to connect to JobNimbus' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/integrations/jobnimbus/connect
 * Check if user has JobNimbus connected
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { data: settings } = await (supabase
      .from('user_settings') as any)
      .select('jobnimbus_api_key, jobnimbus_connected_at')
      .eq('user_id', user.id)
      .single() as { data: UserSettingsWithJN | null };
    
    return NextResponse.json({
      connected: !!settings?.jobnimbus_api_key,
      connectedAt: settings?.jobnimbus_connected_at || null,
    });
  } catch (error) {
    console.error('JobNimbus status check error:', error);
    return NextResponse.json(
      { error: 'Failed to check connection status' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/integrations/jobnimbus/connect
 * Disconnect JobNimbus
 */
export async function DELETE() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { error } = await (supabase
      .from('user_settings') as any)
      .update({
        jobnimbus_api_key: null,
        jobnimbus_connected_at: null,
      })
      .eq('user_id', user.id);
    
    if (error) {
      console.error('Failed to disconnect JobNimbus:', error);
      return NextResponse.json(
        { error: 'Failed to disconnect' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'JobNimbus disconnected',
    });
  } catch (error) {
    console.error('JobNimbus disconnect error:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect' },
      { status: 500 }
    );
  }
}
