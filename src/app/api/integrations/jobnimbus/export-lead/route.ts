import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createJobNimbusClient, JNContact } from '@/lib/jobnimbus';

interface ExportLeadRequest {
  leadId: string;
  // Optional overrides
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  notes?: string;
}

// Type for user settings with JN fields
interface UserSettingsWithJN {
  jobnimbus_api_key?: string | null;
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
    
    // Get user's JobNimbus API key
    const { data: settings } = await (supabase
      .from('user_settings') as any)
      .select('jobnimbus_api_key')
      .eq('user_id', user.id)
      .single() as { data: UserSettingsWithJN | null };
    
    if (!settings?.jobnimbus_api_key) {
      return NextResponse.json(
        { error: 'JobNimbus not connected. Please connect your account in Settings.' },
        { status: 400 }
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
    const jnClient = createJobNimbusClient(settings.jobnimbus_api_key);
    
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
      notes: buildLeadNotes(lead, notes),
    };
    
    // Create contact in JobNimbus
    const result = await jnClient.createContact(contact);
    
    if (!result.success || !result.data) {
      console.error('Failed to create JN contact:', result.error);
      return NextResponse.json(
        { error: result.error?.detail || 'Failed to export to JobNimbus' },
        { status: 500 }
      );
    }
    
    // Record the export
    await (supabase.from('lead_exports') as any).insert({
      lead_id: leadId,
      user_id: user.id,
      destination: 'jobnimbus',
      jn_contact_id: result.data.id,
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
function buildLeadNotes(lead: LeadData, additionalNotes?: string): string {
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
  
  if (lead.notes) {
    lines.push('', 'Original Notes:', lead.notes);
  }
  
  if (additionalNotes) {
    lines.push('', 'Additional Notes:', additionalNotes);
  }
  
  lines.push('', `Exported: ${new Date().toLocaleString()}`);
  
  return lines.join('\n');
}
