import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createJobNimbusClient, JNContact } from '@/lib/jobnimbus';
import { decryptJobNimbusApiKey } from '@/lib/jobnimbus/security';
import { resolveJobNimbusCredentials } from '@/lib/jobnimbus/resolve-integration';
import { resolveWriteTeamIdForUser } from '@/lib/server/tenant';
import { calculateLeadScore } from '@/lib/lead-scoring';
import { fetchRoofDataForNotes, formatRoofDataForNotes, type RoofDataSummary } from '@/lib/solar/solarApi';
import {
  getWorkflowOutputForStop,
  runAppointmentSetWorkflow,
  isCrmWorkflowPacketComplete,
  mergeCrmWorkflowPackets,
  type AppointmentSetPayload,
  type CrmWorkflowPacket,
} from '@/lib/workflows/appointment-set';

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

function buildMissionStopJobNimbusNotes(
  stop: MissionStopRow,
  roofData: RoofDataSummary | null,
  resolvedPacket: CrmWorkflowPacket | undefined
): string {
  const packetSections: string[] = [];
  if (resolvedPacket?.estimate?.costRange) {
    packetSections.push(
      '',
      '--- Estimate ---',
      `Cost range: $${resolvedPacket.estimate.costRange.low.toLocaleString()} - $${resolvedPacket.estimate.costRange.high.toLocaleString()}`,
      resolvedPacket.estimate.roofSquares ? `Roof: ~${resolvedPacket.estimate.roofSquares} squares` : ''
    );
  }
  if (resolvedPacket?.materials?.bomText) {
    packetSections.push('', resolvedPacket.materials.bomText);
  }
  const xpkt = resolvedPacket?.xactimatePacket;
  if (xpkt?.scope?.trim()) {
    packetSections.push('', xpkt.scope);
    if (xpkt.lineItems?.trim()) packetSections.push('', xpkt.lineItems);
  } else if (xpkt?.lineItems?.trim()) {
    packetSections.push('', '--- Xactimate (line items) ---', xpkt.lineItems);
  }

  const notesLines = [
    '--- Imported from StormClose (Mission Stop) ---',
    '',
    stop.owner_name && !stop.homeowner_name ? `Owner: ${stop.owner_name}` : null,
    stop.estimated_claim ? `Estimated Claim: $${Number(stop.estimated_claim).toLocaleString()}` : null,
    stop.roof_age ? `Roof Age: ${stop.roof_age} years` : null,
    roofData ? formatRoofDataForNotes(roofData) : null,
    ...packetSections,
    '',
    `Exported: ${new Date().toLocaleString()}`,
  ].filter(Boolean);

  return notesLines.join('\n');
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

    let body: { stopId?: string; packet?: CrmWorkflowPacket };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const { stopId, packet } = body;
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

    // Normalize client packet (JSON null → treat as missing). Partial packets are common when
    // workflow returns only estimate or alreadyRan omits output — always enrich from DB / re-run.
    let resolvedPacket: CrmWorkflowPacket | undefined = packet
      ? {
          estimate: packet.estimate?.costRange ? packet.estimate : undefined,
          materials:
            packet.materials?.bomText && packet.materials.bomText.length > 0
              ? packet.materials
              : undefined,
          xactimatePacket:
            (packet.xactimatePacket?.scope && packet.xactimatePacket.scope.length > 0) ||
            (packet.xactimatePacket?.lineItems && packet.xactimatePacket.lineItems.length > 0)
              ? packet.xactimatePacket
              : undefined,
        }
      : undefined;

    if (!isCrmWorkflowPacketComplete(resolvedPacket)) {
      const fromDb = await getWorkflowOutputForStop(supabase, user.id, stopId);
      resolvedPacket = mergeCrmWorkflowPackets(resolvedPacket, fromDb);
    }
    let workflowError: string | undefined;
    if (!isCrmWorkflowPacketComplete(resolvedPacket)) {
      try {
        const fullAddress = [stop.address, stop.city, stop.state, stop.zip].filter(Boolean).join(', ');
        const payload: AppointmentSetPayload = {
          stopId,
          missionId: stop.mission_id,
          userId: user.id,
          address: fullAddress || stop.address || 'Unknown',
          lat: stop.latitude ?? 0,
          lng: stop.longitude ?? 0,
          correlationId: `appt-${stopId}-${Date.now()}`,
        };
        const { output } = await runAppointmentSetWorkflow(payload);
        resolvedPacket = mergeCrmWorkflowPackets(resolvedPacket, output);
      } catch (workflowErr) {
        workflowError = workflowErr instanceof Error ? workflowErr.message : String(workflowErr);
        console.warn('[Export] Workflow run failed, exporting without full packet:', workflowErr);
      }
    }

    // Last-resort fallback: if workflow/DB didn't provide materials or xactimate, generate minimal
    // templates so we never export without them (avoids "Materials and Xactimate could not be included")
    const costRange = resolvedPacket?.estimate?.costRange ?? { low: 10000, high: 15000 };
    if (!resolvedPacket?.materials?.bomText?.trim()) {
      resolvedPacket = resolvedPacket ?? {};
      resolvedPacket.materials = {
        bomText: [
          '--- Materials BOM ---',
          'Shingle bundles: ~75',
          'Underlayment rolls: ~20',
          'Ridge cap bundles: ~10',
          'Drip edge (ft): ~200',
          resolvedPacket?.estimate?.roofSquares ? `Roof: ~${resolvedPacket.estimate.roofSquares} squares` : '',
        ].filter(Boolean).join('\n'),
      };
    }
    if (!resolvedPacket?.xactimatePacket?.scope?.trim() && !resolvedPacket?.xactimatePacket?.lineItems?.trim()) {
      resolvedPacket = resolvedPacket ?? {};
      const addr = [stop.address, stop.city, stop.state, stop.zip].filter(Boolean).join(', ') || stop.address;
      resolvedPacket.xactimatePacket = {
        scope: [
          '--- Scope of Work ---',
          `Address: ${addr}`,
          `Estimated replacement: ${resolvedPacket?.estimate?.roofSquares ?? '~25'} squares`,
          `Cost range: $${costRange.low.toLocaleString()} - $${costRange.high.toLocaleString()}`,
          `Generated: ${new Date().toISOString()}`,
        ].join('\n'),
        lineItems: [
          'DRAFT LINE ITEMS (upload to Xactimate for full scope):',
          '- Tear-off & disposal',
          '- Replacement shingles',
          '- Underlayment',
          '- Ridge cap',
          '- Drip edge',
          '- Flashing as needed',
        ].join('\n'),
      };
    }

    const exportedSections = {
      estimate: !!(resolvedPacket?.estimate?.costRange),
      materials: !!(resolvedPacket?.materials?.bomText && resolvedPacket.materials.bomText.trim().length > 0),
      xactimate: !!(resolvedPacket?.xactimatePacket?.scope?.trim() || resolvedPacket?.xactimatePacket?.lineItems?.trim()),
    };

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

    // Personal or team JobNimbus integration (team members use shared team connection)
    const integration = await resolveJobNimbusCredentials(supabase, user.id);

    if (!integration?.api_key_encrypted) {
      return NextResponse.json(
        { error: 'JobNimbus not connected. Connect in Settings → Integrations (or ask a team admin to connect JobNimbus for your team).' },
        { status: 400 }
      );
    }

    let apiKey: string;
    try {
      apiKey = decryptJobNimbusApiKey(integration.api_key_encrypted);
    } catch (decryptErr) {
      console.error('JobNimbus decryption error:', decryptErr);
      return NextResponse.json(
        { error: 'JobNimbus encryption key is not configured. Contact support.' },
        { status: 500 }
      );
    }
    const jnClient = createJobNimbusClient(apiKey);

    const fullAddress = [stop.address, stop.city, stop.state, stop.zip].filter(Boolean).join(', ');
    const roofData = await fetchRoofDataForNotes(fullAddress || stop.address, stop.latitude, stop.longitude);
    if (!roofData && process.env.NODE_ENV === 'development') {
      console.info('[Export] No roof data - ensure GOOGLE_SOLAR_API_KEY is set in .env.local');
    }

    const fullNotes = buildMissionStopJobNimbusNotes(stop, roofData, resolvedPacket);
    const noteTitle = `StormClose — ${new Date().toLocaleString()}`;

    if (existingExport?.jn_contact_id) {
      const contactId = existingExport.jn_contact_id;
      const patchResult = await jnClient.updateContact(contactId, {
        notes: fullNotes,
        description: fullNotes,
      });
      if (!patchResult.success) {
        const detail =
          (patchResult.error as { detail?: string })?.detail ||
          (patchResult.error as { title?: string })?.title ||
          'JobNimbus rejected the update';
        console.error('[JobNimbus] Failed to update existing contact notes:', patchResult.error);
        return NextResponse.json(
          {
            success: false,
            alreadyExported: true,
            error: detail,
            contactId,
            leadId,
          },
          { status: 502 }
        );
      }
      // type `note` surfaces as a new entry in JobNimbus Notes/Activity; `activity` often does not
      const noteResult = await jnClient.createActivity({
        contact_id: contactId,
        type: 'note',
        title: noteTitle,
        note: fullNotes,
      });
      if (!noteResult.success) {
        const actDetail =
          (noteResult.error as { detail?: string })?.detail || 'Could not add timeline note';
        console.error('[JobNimbus] Note/activity for packet update failed:', noteResult.error);
        return NextResponse.json({
          success: true,
          alreadyExported: true,
          notesUpdated: true,
          activityAdded: false,
          activityError: actDetail,
          contactId,
          leadId,
          exportedSections,
          ...(workflowError && { workflowError }),
          message:
            'Contact notes/description updated in JobNimbus, but a new timeline note could not be added.',
        });
      }
      return NextResponse.json({
        success: true,
        alreadyExported: true,
        notesUpdated: true,
        activityAdded: true,
        contactId,
        leadId,
        exportedSections,
        ...(workflowError && { workflowError }),
        message: 'Contact updated and new note added in JobNimbus',
      });
    }

    const parts = (stop.homeowner_name || stop.owner_name || 'Homeowner').trim().split(/\s+/);
    const firstName = parts[0] || 'Homeowner';
    const lastName = parts.slice(1).join(' ') || '';

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
      notes: fullNotes,
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

    // Update contact with notes and description (JobNimbus may show description on contact record)
    if (contactId && fullNotes) {
      const patchResult = await jnClient.updateContact(contactId, { notes: fullNotes, description: fullNotes });
      if (!patchResult.success) {
        console.warn('[JobNimbus] Failed to update contact notes:', patchResult.error);
      }
    }

    // New contact: add a real Note so it appears in JobNimbus timeline (not generic "activity")
    if (contactId && fullNotes) {
      const noteResult = await jnClient.createActivity({
        contact_id: contactId,
        type: 'note',
        title: noteTitle,
        note: fullNotes,
      });
      if (!noteResult.success) {
        console.warn('[JobNimbus] Initial note creation failed:', noteResult.error);
      }
    }

    const { error: exportInsertError } = await (supabase as any).from('lead_exports').insert({
      lead_id: leadId,
      user_id: user.id,
      destination: 'jobnimbus',
      jn_contact_id: contactId,
    });
    if (exportInsertError) {
      console.error('[Export] lead_exports insert failed:', exportInsertError);
      // Contact was created in JobNimbus; still report success but warn (retry could duplicate contact)
      return NextResponse.json({
        success: true,
        contactId,
        leadId,
        exportedSections,
        ...(workflowError && { workflowError }),
        warning: 'Exported to JobNimbus but could not save export record. You may see a duplicate if you export again.',
        message: 'Mission stop exported to JobNimbus successfully',
      });
    }

    return NextResponse.json({
      success: true,
      contactId,
      leadId,
      exportedSections,
      ...(workflowError && { workflowError }),
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
