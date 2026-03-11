import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// POST /api/jobnimbus/sync - Trigger sync with JobNimbus
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { full = false } = await request.json().catch(() => ({}));

    // Get integration
    const { data: integration } = await (supabase as any)
      .from('jobnimbus_integrations')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!integration) {
      return NextResponse.json({ error: 'Not connected to JobNimbus' }, { status: 400 });
    }

    const apiKey = integration.api_key_encrypted;

    // Sync contacts
    const contactsResult = await syncContacts(supabase, user.id, apiKey, full);
    
    // Sync jobs
    const jobsResult = await syncJobs(supabase, user.id, apiKey, full);

    // Update integration stats
    await (supabase as any)
      .from('jobnimbus_integrations')
      .update({
        last_sync_at: new Date().toISOString(),
        contacts_count: contactsResult.count,
        jobs_count: jobsResult.count,
        pending_changes: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    // Log sync
    await (supabase as any)
      .from('jobnimbus_sync_log')
      .insert({
        user_id: user.id,
        direction: 'inbound',
        entity_type: 'contact',
        action: 'update',
        status: 'success',
        message: `Synced ${contactsResult.count} contacts and ${jobsResult.count} jobs`,
      });

    return NextResponse.json({
      success: true,
      contacts: contactsResult,
      jobs: jobsResult,
    });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}

async function syncContacts(
  supabase: any,
  userId: string,
  apiKey: string,
  full: boolean
): Promise<{ count: number; created: number; updated: number }> {
  try {
    // Fetch contacts from JobNimbus
    const response = await fetch('https://app.jobnimbus.com/api1/contacts?limit=100', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch contacts');
    }

    const data = await response.json();
    const contacts = data.results || [];

    let created = 0;
    let updated = 0;

    for (const contact of contacts) {
      // Check if contact exists
      const { data: existing } = await (supabase as any)
        .from('jobnimbus_contacts')
        .select('id')
        .eq('user_id', userId)
        .eq('jobnimbus_id', contact.jnid)
        .single();

      const contactData = {
        user_id: userId,
        jobnimbus_id: contact.jnid,
        first_name: contact.first_name,
        last_name: contact.last_name,
        display_name: contact.display_name,
        email: contact.email,
        mobile_phone: contact.mobile_phone,
        home_phone: contact.home_phone,
        address_line1: contact.address_line1,
        city: contact.city,
        state_text: contact.state_text,
        zip: contact.zip,
        status: contact.status,
        tags: contact.tags || [],
        raw_data: contact,
        synced_at: new Date().toISOString(),
      };

      if (existing) {
        await (supabase as any)
          .from('jobnimbus_contacts')
          .update(contactData)
          .eq('id', existing.id);
        updated++;
      } else {
        await (supabase as any)
          .from('jobnimbus_contacts')
          .insert(contactData);
        created++;
      }
    }

    return { count: contacts.length, created, updated };
  } catch (error) {
    console.error('Contact sync error:', error);
    return { count: 0, created: 0, updated: 0 };
  }
}

async function syncJobs(
  supabase: any,
  userId: string,
  apiKey: string,
  full: boolean
): Promise<{ count: number; created: number; updated: number }> {
  try {
    // Fetch jobs from JobNimbus
    const response = await fetch('https://app.jobnimbus.com/api1/jobs?limit=100', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch jobs');
    }

    const data = await response.json();
    const jobs = data.results || [];

    let created = 0;
    let updated = 0;

    for (const job of jobs) {
      // Check if job exists
      const { data: existing } = await (supabase as any)
        .from('jobnimbus_jobs')
        .select('id')
        .eq('user_id', userId)
        .eq('jobnimbus_id', job.jnid)
        .single();

      const jobData = {
        user_id: userId,
        jobnimbus_id: job.jnid,
        contact_jnid: job.primary?.jnid,
        number: job.number,
        name: job.name,
        status: job.status,
        status_name: job.status_name,
        address_line1: job.address_line1,
        city: job.city,
        state_text: job.state_text,
        zip: job.zip,
        sales_rep: job.sales_rep,
        total: job.total,
        raw_data: job,
        synced_at: new Date().toISOString(),
      };

      if (existing) {
        await (supabase as any)
          .from('jobnimbus_jobs')
          .update(jobData)
          .eq('id', existing.id);
        updated++;
      } else {
        await (supabase as any)
          .from('jobnimbus_jobs')
          .insert(jobData);
        created++;
      }
    }

    return { count: jobs.length, created, updated };
  } catch (error) {
    console.error('Job sync error:', error);
    return { count: 0, created: 0, updated: 0 };
  }
}
