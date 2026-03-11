import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// POST /api/jobnimbus/webhook - Handle webhooks from JobNimbus
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Get webhook signature for verification (in production)
    const signature = request.headers.get('x-jobnimbus-signature');
    
    // Extract event type
    const eventType = body.event || body.type;
    const entityType = body.entity_type || 'unknown';
    const entityId = body.jnid || body.id;

    console.log('JobNimbus webhook received:', eventType, entityType);

    // Find user by matching the JobNimbus account
    // In production, this would use a more robust lookup
    const supabase = await createClient();
    
    // For now, we'll need the user_id from headers or payload
    // JobNimbus webhooks include account info we can use
    const accountId = body.account_id || body.account?.jnid;

    if (!accountId) {
      console.error('No account ID in webhook payload');
      return NextResponse.json({ received: true });
    }

    // Find integration by account
    const { data: integration } = await (supabase as any)
      .from('jobnimbus_integrations')
      .select('user_id')
      .eq('jobnimbus_account_id', accountId)
      .single();

    const userId = integration?.user_id;

    if (!userId) {
      console.warn('No matching integration for account:', accountId);
      return NextResponse.json({ received: true });
    }

    // Store webhook event
    await (supabase as any)
      .from('jobnimbus_webhook_events')
      .insert({
        user_id: userId,
        event_type: eventType,
        entity_type: entityType,
        entity_id: entityId,
        payload: body,
        payload_preview: JSON.stringify(body).slice(0, 200),
        received_at: new Date().toISOString(),
        processed: false,
      });

    // Process the webhook
    await processWebhook(supabase, userId, eventType, entityType, body);

    return NextResponse.json({ received: true, processed: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ received: true, error: 'Processing failed' });
  }
}

async function processWebhook(
  supabase: any,
  userId: string,
  eventType: string,
  entityType: string,
  payload: any
) {
  try {
    const action = eventType.includes('create') ? 'create' 
                 : eventType.includes('update') ? 'update'
                 : eventType.includes('delete') ? 'delete'
                 : 'update';

    // Handle different entity types
    switch (entityType) {
      case 'contact':
        await handleContactWebhook(supabase, userId, action, payload);
        break;
      case 'job':
        await handleJobWebhook(supabase, userId, action, payload);
        break;
      case 'note':
        await handleNoteWebhook(supabase, userId, action, payload);
        break;
      case 'activity':
        await handleActivityWebhook(supabase, userId, action, payload);
        break;
      default:
        console.log('Unhandled entity type:', entityType);
    }

    // Log the sync
    await (supabase as any)
      .from('jobnimbus_sync_log')
      .insert({
        user_id: userId,
        direction: 'inbound',
        entity_type: entityType,
        action,
        status: 'success',
        message: `Webhook: ${eventType}`,
        jobnimbus_id: payload.jnid,
      });

    // Mark webhook as processed
    await (supabase as any)
      .from('jobnimbus_webhook_events')
      .update({ processed: true })
      .eq('entity_id', payload.jnid)
      .eq('user_id', userId);

  } catch (error) {
    console.error('Webhook processing error:', error);
    
    await (supabase as any)
      .from('jobnimbus_sync_log')
      .insert({
        user_id: userId,
        direction: 'inbound',
        entity_type: entityType,
        action: 'update',
        status: 'failed',
        message: `Webhook failed: ${error}`,
        jobnimbus_id: payload.jnid,
      });
  }
}

async function handleContactWebhook(
  supabase: any,
  userId: string,
  action: string,
  payload: any
) {
  const contact = payload.contact || payload;
  
  if (action === 'delete') {
    await (supabase as any)
      .from('jobnimbus_contacts')
      .delete()
      .eq('user_id', userId)
      .eq('jobnimbus_id', contact.jnid);
    return;
  }

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

  await (supabase as any)
    .from('jobnimbus_contacts')
    .upsert(contactData, {
      onConflict: 'user_id,jobnimbus_id',
    });
}

async function handleJobWebhook(
  supabase: any,
  userId: string,
  action: string,
  payload: any
) {
  const job = payload.job || payload;
  
  if (action === 'delete') {
    await (supabase as any)
      .from('jobnimbus_jobs')
      .delete()
      .eq('user_id', userId)
      .eq('jobnimbus_id', job.jnid);
    return;
  }

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

  await (supabase as any)
    .from('jobnimbus_jobs')
    .upsert(jobData, {
      onConflict: 'user_id,jobnimbus_id',
    });
}

async function handleNoteWebhook(
  supabase: any,
  userId: string,
  action: string,
  payload: any
) {
  const note = payload.note || payload;
  
  if (action === 'delete') {
    await (supabase as any)
      .from('jobnimbus_notes')
      .delete()
      .eq('user_id', userId)
      .eq('jobnimbus_id', note.jnid);
    return;
  }

  const noteData = {
    user_id: userId,
    jobnimbus_id: note.jnid,
    parent_jnid: note.parent?.jnid,
    parent_type: note.parent?.type,
    note: note.note,
    created_by: note.created_by_name,
    raw_data: note,
    synced_at: new Date().toISOString(),
  };

  await (supabase as any)
    .from('jobnimbus_notes')
    .upsert(noteData, {
      onConflict: 'user_id,jobnimbus_id',
    });
}

async function handleActivityWebhook(
  supabase: any,
  userId: string,
  action: string,
  payload: any
) {
  const activity = payload.activity || payload;
  
  if (action === 'delete') {
    await (supabase as any)
      .from('jobnimbus_activities')
      .delete()
      .eq('user_id', userId)
      .eq('jobnimbus_id', activity.jnid);
    return;
  }

  const activityData = {
    user_id: userId,
    jobnimbus_id: activity.jnid,
    parent_jnid: activity.parent?.jnid,
    parent_type: activity.parent?.type,
    type: activity.record_type_name,
    title: activity.title,
    date_start: activity.date_start,
    date_end: activity.date_end,
    completed: activity.is_completed,
    raw_data: activity,
    synced_at: new Date().toISOString(),
  };

  await (supabase as any)
    .from('jobnimbus_activities')
    .upsert(activityData, {
      onConflict: 'user_id,jobnimbus_id',
    });
}
