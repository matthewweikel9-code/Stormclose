import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { encryptJobNimbusApiKey } from '@/lib/jobnimbus/security';

// POST /api/jobnimbus/connect - Connect to JobNimbus
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { apiKey } = await request.json();

    if (!apiKey) {
      return NextResponse.json({ error: 'API key is required' }, { status: 400 });
    }

    // Validate API key with JobNimbus
    const validationResult = await validateJobNimbusApiKey(apiKey);
    
    if (!validationResult.valid) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 400 });
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

    // Store integration (encrypted at rest)
    const { data: integration, error } = await (supabase as any)
      .from('jobnimbus_integrations')
      .upsert({
        user_id: user.id,
        api_key_encrypted: encryptedApiKey,
        jobnimbus_account_id: validationResult.accountId || null,
        company_name: validationResult.companyName,
        contacts_count: 0,
        jobs_count: 0,
        pending_changes: 0,
        settings: {
          autoSync: true,
          syncInterval: 15,
          syncContacts: true,
          syncJobs: true,
          syncNotes: true,
          syncActivities: true,
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      })
      .select()
      .single();

    if (error) {
      console.error('Error storing integration:', error);
      return NextResponse.json({ error: 'Failed to save connection' }, { status: 500 });
    }

    // Log the connection
    await (supabase as any)
      .from('jobnimbus_sync_log')
      .insert({
        user_id: user.id,
        direction: 'inbound',
        entity_type: 'contact',
        action: 'create',
        status: 'success',
        message: 'Connected to JobNimbus',
      });

    return NextResponse.json({
      success: true,
      status: {
        connected: true,
        lastSync: null,
        contactsCount: 0,
        jobsCount: 0,
        pendingSync: 0,
        errors: [],
      },
    });
  } catch (error) {
    console.error('Connect error:', error);
    return NextResponse.json({ error: 'Connection failed' }, { status: 500 });
  }
}

async function validateJobNimbusApiKey(apiKey: string): Promise<{
  valid: boolean;
  companyName?: string;
  accountId?: string;
}> {
  try {
    // Call JobNimbus API to validate
    const response = await fetch('https://app.jobnimbus.com/api1/contacts?limit=1', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      // Get company info
      const companyResponse = await fetch('https://app.jobnimbus.com/api1/settings', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
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
    }

    return { valid: false };
  } catch (error) {
    console.error('JobNimbus validation error:', error);
    return { valid: false };
  }
}
