import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

    // Store integration (encrypted in production)
    const { data: integration, error } = await (supabase as any)
      .from('jobnimbus_integrations')
      .upsert({
        user_id: user.id,
        api_key_encrypted: apiKey, // In production, encrypt this
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
      if (companyResponse.ok) {
        const companyData = await companyResponse.json();
        companyName = companyData.company_name || companyName;
      }

      return { valid: true, companyName };
    }

    return { valid: false };
  } catch (error) {
    console.error('JobNimbus validation error:', error);
    // For development/demo, allow any key
    if (process.env.NODE_ENV === 'development') {
      return { valid: true, companyName: 'Demo Company' };
    }
    return { valid: false };
  }
}
