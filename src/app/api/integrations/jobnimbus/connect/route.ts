import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { encryptJobNimbusApiKey } from '@/lib/jobnimbus/security';

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
    
    const validation = await validateJobNimbusApiKey(apiKey);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Invalid API key. Please check your JobNimbus API key and try again.' },
        { status: 400 }
      );
    }

    let encryptedApiKey: string;
    try {
      encryptedApiKey = encryptJobNimbusApiKey(apiKey);
    } catch (encryptionError) {
      console.error('JobNimbus API key encryption failed:', encryptionError);
      return NextResponse.json(
        { error: 'JobNimbus encryption is not configured. Set JOBNIMBUS_ENCRYPTION_KEY.' },
        { status: 500 }
      );
    }

    // Unified storage model: jobnimbus_integrations.
    const { error: upsertError } = await (supabase as any)
      .from('jobnimbus_integrations')
      .upsert({
        user_id: user.id,
        api_key_encrypted: encryptedApiKey,
        jobnimbus_account_id: validation.accountId || null,
        company_name: validation.companyName || null,
        settings: {
          autoSync: true,
          syncInterval: 15,
          syncContacts: true,
          syncJobs: true,
          syncNotes: true,
          syncActivities: true,
        },
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      });
    
    if (upsertError) {
      console.error('Failed to save JobNimbus connection:', upsertError);
      const msg = upsertError.message || 'Failed to save connection';
      return NextResponse.json(
        { error: msg },
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
    
    const { data: integration } = await (supabase as any)
      .from('jobnimbus_integrations')
      .select('id, created_at, updated_at')
      .eq('user_id', user.id)
      .maybeSingle();
    
    return NextResponse.json({
      connected: !!integration,
      connectedAt: integration?.updated_at || integration?.created_at || null,
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
    
    const { error } = await (supabase as any)
      .from('jobnimbus_integrations')
      .delete()
      .eq('user_id', user.id);
    
    if (error) {
      console.error('Failed to disconnect JobNimbus:', error);
      return NextResponse.json(
        { error: 'Failed to disconnect' },
        { status: 500 }
      );
    }

    // Best-effort cleanup for legacy columns.
    try {
      await (supabase
        .from('user_settings') as any)
        .update({
          jobnimbus_api_key: null,
          jobnimbus_connected_at: null,
        })
        .eq('user_id', user.id);
    } catch {
      // Ignore if legacy columns/table shape differ.
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

async function validateJobNimbusApiKey(apiKey: string): Promise<{
  valid: boolean;
  companyName?: string;
  accountId?: string;
}> {
  try {
    const response = await fetch('https://app.jobnimbus.com/api1/contacts?limit=1', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return { valid: false };
    }

    const companyResponse = await fetch('https://app.jobnimbus.com/api1/settings', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    let companyName = 'Unknown Company';
    let accountId: string | undefined;
    if (companyResponse.ok) {
      const companyData = await companyResponse.json();
      companyName = companyData.company_name || companyName;
      accountId = companyData.jnid || companyData.id || companyData.account?.jnid;
    }

    return { valid: true, companyName, accountId };
  } catch (error) {
    console.error('JobNimbus validation error:', error);
    return { valid: false };
  }
}
