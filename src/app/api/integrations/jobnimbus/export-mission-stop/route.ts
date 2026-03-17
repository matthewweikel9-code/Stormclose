import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createJobNimbusClient, JNContact } from '@/lib/jobnimbus';
import { decryptJobNimbusApiKey } from '@/lib/jobnimbus/security';
import { resolveWriteTeamIdForUser } from '@/lib/server/tenant';
import { calculateLeadScore } from '@/lib/lead-scoring';
import { fetchRoofDataForNotes, formatRoofDataForNotes } from '@/lib/solar/solarApi';

interface JobNimbusIntegration {
  api_key_encrypted?: string | null;
}

interface MissionStopRow {
  id: string;
  mission_id: string;
  user_id: string;
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  latitude: number;
  longitude: number;
  owner_name: string | null;
  homeowner_name: string | null;
  homeowner_phone: string | null;
  homeowner_email: string | null;
  estimated_claim: number | null;
  roof_age: number | null;
  lead_id: string | null;
}

/**
 * POST /api/integrations/jobnimbus/export-mission-stop
 * Export a mission stop to JobNimbus. Creates a lead from the stop if needed, then exports.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: { stopId?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const { stopId } = body;
    if (!stopId) {
      return NextResponse.json({ error: 'stopId is required' }, { status: 400 });
    }

    // Fetch mission stop and verify ownership
    const { data: stop, error: stopError } = await (supabase as any)
      .from('mission_stops')
      .select('id, mission_id, user_id, address, city, state, zip, latitude, longitude, owner_name, homeowner_name, homeowner_phone, homeowner_email, estimated_claim, roof_age, lead_id')
      .eq('id', stopId)
      .eq('user_id', user.id)
      .single() as { data: MissionStopRow | null; error: any };

    if (stopError || !stop) {
      return NextResponse.json({ error: 'Mission stop not found' }, { status: 404 });
    }

    let leadId = stop.lead_id;

    // Create lead from stop if not already linked
    if (!leadId) {
      let scoreResult = {
        totalScore: 50,
        stormProximityScore: 0,
        roofAgeScore: 0,
        roofSizeScore: 0,
        propertyValueScore: 0,
        hailHistoryScore: 0,
      };
      try {
        scoreResult = await calculateLeadScore({
          latitude: stop.latitude,
          longitude: stop.longitude,
        });
      } catch (scoreErr) {
        console.warn('Lead scoring failed, using defaults:', scoreErr);
      }

      let resolvedTeamId: string | null = null;
      try {
        resolvedTeamId = await resolveWriteTeamIdForUser(supabase, user.id, null);
      } catch {
        // Single-user, no team required
      }

      const leadPayload = {
        user_id: user.id,
        team_id: resolvedTeamId,
        address: (stop.address && String(stop.address).trim()) || 'Unknown address',
        city: stop.city ?? '',
        state: stop.state ?? '',
        zip: stop.zip ?? '',
        latitude: stop.latitude,
        longitude: stop.longitude,
        estimated_claim: stop.estimated_claim,
        source: 'mission_stop',
        lead_score: Math.min(100, Math.max(0, Math.round(scoreResult.totalScore))),
        storm_proximity_score: Math.round(scoreResult.stormProximityScore),
        roof_age_score: Math.round(scoreResult.roofAgeScore),
        roof_size_score: Math.round(scoreResult.roofSizeScore),
        property_value_score: Math.round(scoreResult.propertyValueScore),
        hail_history_score: Math.round(scoreResult.hailHistoryScore),
        status: 'new',
      };

      // Use admin client to bypass RLS (user already verified via server client)
      const supabaseAdmin = createAdminClient();
      const { data: newLead, error: leadInsertError } = await (supabaseAdmin as any)
        .from('leads')
        .insert(leadPayload)
        .select('id')
        .single();

      if (leadInsertError || !newLead) {
        const errMsg = leadInsertError?.message || 'Unknown error';
        console.error('Failed to create lead from stop:', leadInsertError);
        return NextResponse.json(
          { error: `Failed to create lead: ${errMsg}` },
          { status: 500 }
        );
      }

      leadId = newLead.id;

      // Link stop to lead (admin client for RLS bypass)
      await (supabaseAdmin as any)
        .from('mission_stops')
        .update({ lead_id: leadId, updated_at: new Date().toISOString() })
        .eq('id', stopId)
        .eq('user_id', user.id);
    }

    // Check if already exported (via lead)
    const { data: existingExport } = await (supabase as any)
      .from('lead_exports')
      .select('jn_contact_id')
      .eq('lead_id', leadId)
      .eq('destination', 'jobnimbus')
      .maybeSingle();

    if (existingExport?.jn_contact_id) {
      return NextResponse.json({
        success: true,
        alreadyExported: true,
        contactId: existingExport.jn_contact_id,
        leadId,
        message: 'Stop was already exported to JobNimbus',
      });
    }

    // Get JobNimbus integration
    const { data: integration } = await (supabase as any)
      .from('jobnimbus_integrations')
      .select('api_key_encrypted')
      .eq('user_id', user.id)
      .maybeSingle() as { data: JobNimbusIntegration | null };

    if (!integration?.api_key_encrypted) {
      return NextResponse.json(
        { error: 'JobNimbus not connected. Connect in Settings → Integrations.' },
        { status: 400 }
      );
    }

    const apiKey = decryptJobNimbusApiKey(integration.api_key_encrypted);
    const jnClient = createJobNimbusClient(apiKey);

    const parts = (stop.homeowner_name || stop.owner_name || 'Homeowner').trim().split(/\s+/);
    const firstName = parts[0] || 'Homeowner';
    const lastName = parts.slice(1).join(' ') || '';

    // Fetch roof data from Google Solar API (requires GOOGLE_SOLAR_API_KEY in .env.local)
    const fullAddress = [stop.address, stop.city, stop.state, stop.zip].filter(Boolean).join(', ');
    const roofData = await fetchRoofDataForNotes(fullAddress || stop.address, stop.latitude, stop.longitude);
    if (!roofData && process.env.NODE_ENV === 'development') {
      console.info('[Export] No roof data - ensure GOOGLE_SOLAR_API_KEY is set in .env.local');
    }

    const notesLines = [
      '--- Imported from StormClose (Mission Stop) ---',
      '',
      stop.owner_name && !stop.homeowner_name ? `Owner: ${stop.owner_name}` : null,
      stop.estimated_claim ? `Estimated Claim: $${Number(stop.estimated_claim).toLocaleString()}` : null,
      stop.roof_age ? `Roof Age: ${stop.roof_age} years` : null,
      roofData ? formatRoofDataForNotes(roofData) : null,
      '',
      `Exported: ${new Date().toLocaleString()}`,
    ].filter(Boolean);

    const contact: JNContact = {
      first_name: firstName,
      last_name: lastName,
      display_name: `${firstName} ${lastName}`.trim() || `Homeowner at ${stop.address}`,
      address_line1: stop.address,
      city: stop.city ?? undefined,
      state_text: stop.state ?? undefined,
      zip: stop.zip ?? undefined,
      mobile_phone: stop.homeowner_phone ?? undefined,
      email: stop.homeowner_email ?? undefined,
      notes: notesLines.join('\n'),
    };

    const result = await jnClient.createContact(contact);
    if (!result.success || !result.data) {
      console.error('JobNimbus create contact error:', result.error);
      const jnStatus = (result.error as { status?: number })?.status;
      const status = jnStatus && jnStatus >= 400 && jnStatus < 500 ? jnStatus : 500;
      return NextResponse.json(
        { error: (result.error as { detail?: string })?.detail || 'Failed to export to JobNimbus' },
        { status }
      );
    }

    const contactId = (result.data as { id?: string }).id ?? (result.data as { jnid?: string }).jnid ?? '';
    const fullNotes = notesLines.join('\n');

    // Update contact with notes and description (JobNimbus may show description on contact record)
    if (contactId && fullNotes) {
      const patchResult = await jnClient.updateContact(contactId, { notes: fullNotes, description: fullNotes });
      if (!patchResult.success) {
        console.warn('[JobNimbus] Failed to update contact notes:', patchResult.error);
      }
    }

    // Also try adding as activity (for Activity tab)
    if (contactId && fullNotes) {
      const noteResult = await jnClient.createActivity({
        contact_id: contactId,
        type: 'activity',
        title: 'StormClose Import',
        note: fullNotes,
      });
      if (!noteResult.success) {
        console.warn('[JobNimbus] Activity creation failed:', noteResult.error);
      }
    }

    await (supabase as any).from('lead_exports').insert({
      lead_id: leadId,
      user_id: user.id,
      destination: 'jobnimbus',
      jn_contact_id: contactId,
    });

    return NextResponse.json({
      success: true,
      contactId,
      leadId,
      message: 'Mission stop exported to JobNimbus successfully',
    });
  } catch (error) {
    console.error('Export mission stop error:', error);
    return NextResponse.json(
      { error: 'Failed to export mission stop' },
      { status: 500 }
    );
  }
}
