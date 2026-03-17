import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createJobNimbusClient, JNContact } from '@/lib/jobnimbus';
import { decryptJobNimbusApiKey } from '@/lib/jobnimbus/security';
import { fetchRoofDataForNotes, formatRoofDataForNotes } from '@/lib/solar/solarApi';

interface ExportLeadRequest {
  leadId: string;
  // Optional overrides
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  notes?: string;
}

// Type for integration row
interface JobNimbusIntegration {
  api_key_encrypted?: string | null;
}

// Type for lead export
interface LeadExport {
  jn_contact_id?: string | null;
}

// Type for lead data
interface LeadData {
  id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  latitude?: number | null;
  longitude?: number | null;
  lead_score?: number;
  storm_date?: string;
  hail_size?: number;
  estimated_claim?: number;
  year_built?: number;
  roof_squares?: number;
  source?: string;
  notes?: string;
}

/**
 * POST /api/integrations/jobnimbus/export-lead
 * Export a lead from StormClose to JobNimbus as a contact
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get user's JobNimbus API key from unified integrations table
    const { data: integration } = await (supabase
      .from('jobnimbus_integrations') as any)
      .select('api_key_encrypted')
      .eq('user_id', user.id)
      .maybeSingle() as { data: JobNimbusIntegration | null };
    
    if (!integration?.api_key_encrypted) {
      return NextResponse.json(
        { error: 'JobNimbus not connected. Please connect your account in Settings.' },
        { status: 400 }
      );
    }

    let apiKey: string;
    try {
      apiKey = decryptJobNimbusApiKey(integration.api_key_encrypted);
    } catch (decryptError) {
      console.error('Failed to decrypt JobNimbus API key:', decryptError);
      return NextResponse.json(
        { error: 'Failed to read JobNimbus credentials. Reconnect your integration.' },
        { status: 500 }
      );
    }
    
    const body: ExportLeadRequest = await request.json();
    const { leadId, firstName, lastName, phone, email, notes } = body;
    
    if (!leadId) {
      return NextResponse.json(
        { error: 'Lead ID is required' },
        { status: 400 }
      );
    }
    
    // Get the lead from our database
    const { data: lead, error: leadError } = await (supabase
      .from('leads') as any)
      .select('*')
      .eq('id', leadId)
      .eq('user_id', user.id)
      .single() as { data: LeadData | null; error: any };
    
    if (leadError || !lead) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      );
    }
    
    // Check if already exported
    const { data: existingExport } = await (supabase
      .from('lead_exports') as any)
      .select('jn_contact_id')
      .eq('lead_id', leadId)
      .eq('destination', 'jobnimbus')
      .single() as { data: LeadExport | null };
    
    if (existingExport?.jn_contact_id) {
      return NextResponse.json({
        success: true,
        alreadyExported: true,
        contactId: existingExport.jn_contact_id,
        message: 'Lead was already exported to JobNimbus',
      });
    }
    
    // Create JobNimbus client
    const jnClient = createJobNimbusClient(apiKey);

    // Fetch roof data from Google Solar API (requires GOOGLE_SOLAR_API_KEY)
    const fullAddress = [lead.address, lead.city, lead.state, lead.zip].filter(Boolean).join(', ');
    const lat = lead.latitude ?? 0;
    const lng = lead.longitude ?? 0;
    const roofData = await fetchRoofDataForNotes(fullAddress || lead.address, lat, lng);
    if (!roofData && process.env.NODE_ENV === 'development') {
      console.info('[Export Lead] No roof data - check GOOGLE_SOLAR_API_KEY and server terminal for [Solar API] logs');
    }
    
    // Build contact object
    const contact: JNContact = {
      first_name: firstName || 'Homeowner',
      last_name: lastName || '',
      display_name: firstName && lastName ? `${firstName} ${lastName}` : `Homeowner at ${lead.address}`,
      address_line1: lead.address,
      city: lead.city,
      state_text: lead.state,
      zip: lead.zip,
      mobile_phone: phone,
      email: email,
      source_name: 'StormClose AI',
      tags: ['StormClose', 'AI Lead'],
      notes: buildLeadNotes(lead, notes, roofData),
    };
    
    // Create contact in JobNimbus
    const result = await jnClient.createContact(contact);
    
    if (!result.success || !result.data) {
      console.error('Failed to create JN contact:', result.error);
      const status = result.error?.status && result.error.status >= 400 && result.error.status < 500
        ? result.error.status
        : 500;
      return NextResponse.json(
        { error: result.error?.detail || 'Failed to export to JobNimbus' },
        { status }
      );
    }

    const contactId = result.data.id ?? (result.data as { jnid?: string }).jnid ?? '';
    const fullNotes = buildLeadNotes(lead, notes, roofData);

    // Update contact with notes/description (shows on contact record)
    if (contactId && fullNotes) {
      const patchResult = await jnClient.updateContact(contactId, { notes: fullNotes, description: fullNotes });
      if (!patchResult.success) {
        console.warn('[Export Lead] Failed to update contact notes:', patchResult.error);
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
        console.warn('[Export Lead] Activity failed:', noteResult.error);
      }
    }
    
    // Record the export
    await (supabase as any).from('lead_exports').insert({
      lead_id: leadId,
      user_id: user.id,
      destination: 'jobnimbus',
      jn_contact_id: contactId,
      exported_at: new Date().toISOString(),
    });
    
    return NextResponse.json({
      success: true,
      contactId: result.data.id,
      message: 'Lead exported to JobNimbus successfully',
    });
  } catch (error) {
    console.error('Export lead error:', error);
    return NextResponse.json(
      { error: 'Failed to export lead' },
      { status: 500 }
    );
  }
}

/**
 * Build notes string for JobNimbus contact
 */
function buildLeadNotes(
  lead: LeadData,
  additionalNotes?: string,
  roofData?: { totalAreaSqFt: number; totalSquares: number; avgPitchDegrees: number; facetCount: number; costRange: { low: number; high: number }; imageryDate: string } | null
): string {
  const lines: string[] = [
    '--- Imported from StormClose AI ---',
    '',
  ];
  
  if (lead.lead_score) {
    lines.push(`Lead Score: ${lead.lead_score}/100`);
  }
  
  if (lead.storm_date) {
    lines.push(`Storm Date: ${lead.storm_date}`);
  }
  
  if (lead.hail_size) {
    lines.push(`Hail Size: ${lead.hail_size}"`);
  }
  
  if (lead.estimated_claim) {
    lines.push(`Estimated Claim: $${Number(lead.estimated_claim).toLocaleString()}`);
  }
  
  if (lead.year_built) {
    lines.push(`Year Built: ${lead.year_built}`);
  }
  
  if (lead.roof_squares) {
    lines.push(`Roof Squares: ${lead.roof_squares}`);
  }
  
  if (lead.source) {
    lines.push(`Source: ${lead.source}`);
  }
  
  if (roofData) {
    lines.push(formatRoofDataForNotes(roofData));
  }
  
  if (lead.notes) {
    lines.push('', 'Original Notes:', lead.notes);
  }
  
  if (additionalNotes) {
    lines.push('', 'Additional Notes:', additionalNotes);
  }
  
  lines.push('', `Exported: ${new Date().toLocaleString()}`);
  
  return lines.join('\n');
}
