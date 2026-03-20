import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createJobNimbusClient, JNContact } from "@/lib/jobnimbus";
import { decryptJobNimbusApiKey } from "@/lib/jobnimbus/security";
import { resolveJobNimbusCredentials } from "@/lib/jobnimbus/resolve-integration";

/**
 * Parse address string into components (simple fallback when no structured fields)
 */
function parseAddress(addr: string): { address: string; city: string; state: string; zip: string } {
  const trimmed = (addr || "").trim();
  const parts = trimmed.split(",").map((s) => s.trim());
  const address = parts[0] || trimmed;
  const city = parts[1] || "";
  const stateZip = parts[2] || "";
  const [state, zip] = stateZip.split(/\s+/).filter(Boolean);
  return { address, city, state: state || "", zip: zip || "" };
}

/**
 * Normalize address for matching (lowercase, trim, collapse spaces, normalize abbreviations)
 */
function normalizeForMatch(addr: string): string {
  let s = (addr || "").trim().toLowerCase().replace(/\s+/g, " ");
  const abbrev: Record<string, string> = {
    street: "st", avenue: "ave", road: "rd", drive: "dr", lane: "ln",
    boulevard: "blvd", court: "ct", place: "pl", circle: "cir",
  };
  for (const [full, short] of Object.entries(abbrev)) {
    s = s.replace(new RegExp(`\\b${full}\\b`, "g"), short);
  }
  return s;
}

/**
 * Check if two addresses match (one contains the other or street parts match)
 */
function addressesMatch(a: string, b: string): boolean {
  const na = normalizeForMatch(a);
  const nb = normalizeForMatch(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const streetA = (na.split(",")[0] || na).trim();
  const streetB = (nb.split(",")[0] || nb).trim();
  if (!streetA || !streetB) return false;
  return streetA.includes(streetB) || streetB.includes(streetA);
}

function formatReportNote(data: {
  propertyAddress: string;
  roofType: string;
  shingleType: string;
  insuranceCompany: string;
  damageNotes: string;
  reportExcerpt: string;
}): string {
  const lines: string[] = [
    "StormClose AI Report",
    "",
    "Property: " + data.propertyAddress,
    "",
    "Property Details",
    "• Roof Type: " + data.roofType,
    "• Shingle Type: " + data.shingleType,
    "• Insurance: " + data.insuranceCompany,
    "",
  ];
  if (data.damageNotes) {
    lines.push("Damage Summary", data.damageNotes, "");
  }
  if (data.reportExcerpt) {
    lines.push("Full Report", "─────────────────", data.reportExcerpt, "");
  }
  lines.push("Added from StormClose AI • " + new Date().toLocaleString());
  return lines.join("\n");
}

function formatEstimateNote(data: {
  propertyAddress: string;
  claimNumber: string;
  carrier: string;
  rcv: number | null;
  acv: number | null;
  status: string;
}): string {
  const rcv = data.rcv != null ? `$${Number(data.rcv).toLocaleString()}` : "N/A";
  const acv = data.acv != null ? `$${Number(data.acv).toLocaleString()}` : "N/A";
  const lines: string[] = [
    "StormClose Xactimate Estimate",
    "",
    "Property: " + data.propertyAddress,
    "",
    "Claim Details",
    "• Claim #: " + data.claimNumber,
    "• Carrier: " + data.carrier,
    "• Status: " + data.status,
    "",
    "Amounts",
    "• RCV: " + rcv,
    "• ACV: " + acv,
    "",
    "Added from StormClose AI • " + new Date().toLocaleString(),
  ];
  return lines.join("\n");
}

async function addDocumentToExistingContact(
  supabase: any,
  jnClient: ReturnType<typeof import("@/lib/jobnimbus").createJobNimbusClient>,
  userId: string,
  entityType: string,
  entityId: string,
  contactId: string,
  notes: string
) {
  const actResult = await jnClient.createActivity({
    contact_id: contactId,
    type: "note",
    title: entityType === "report" ? "StormClose AI Report" : "StormClose Xactimate Estimate",
    note: notes,
  });

  if (!actResult.success) {
    const errDetail = actResult.error?.detail || "Failed to add note to existing contact";
    console.warn("[Export Document] Failed to add activity:", actResult.error);
    return NextResponse.json(
      { error: `JobNimbus: ${errDetail}` },
      { status: 500 }
    );
  }

  await (supabase as any).from("document_exports").insert({
    user_id: userId,
    entity_type: entityType,
    entity_id: entityId,
    jn_contact_id: contactId,
    exported_at: new Date().toISOString(),
  });

  return NextResponse.json({
    success: true,
    contactId,
    addedToExisting: true,
    message: "Document added to existing JobNimbus contact",
  });
}

/**
 * POST /api/integrations/jobnimbus/export-document
 * Export a report or Xactimate estimate to JobNimbus as a contact.
 * Body: { entityType: 'report' | 'xactimate_estimate', entityId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const integration = await resolveJobNimbusCredentials(supabase, user.id);

    if (!integration?.api_key_encrypted) {
      return NextResponse.json(
        { error: "JobNimbus not connected. Connect in Settings or use your team’s JobNimbus connection." },
        { status: 400 }
      );
    }

    let apiKey: string;
    try {
      apiKey = decryptJobNimbusApiKey(integration.api_key_encrypted);
    } catch {
      return NextResponse.json(
        { error: "Failed to read JobNimbus credentials. Reconnect your integration." },
        { status: 500 }
      );
    }

    let body: { entityType?: string; entityId?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { entityType, entityId } = body;
    if (!entityType || !entityId) {
      return NextResponse.json(
        { error: "entityType and entityId are required" },
        { status: 400 }
      );
    }

    if (!["report", "xactimate_estimate"].includes(entityType)) {
      return NextResponse.json(
        { error: "entityType must be 'report' or 'xactimate_estimate'" },
        { status: 400 }
      );
    }

    // Check if already exported
    const { data: existing } = await (supabase as any)
      .from("document_exports")
      .select("jn_contact_id")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .maybeSingle();

    if (existing?.jn_contact_id) {
      return NextResponse.json({
        success: true,
        alreadyExported: true,
        contactId: existing.jn_contact_id,
        message: "Document was already exported to JobNimbus",
      });
    }

    const jnClient = createJobNimbusClient(apiKey);
    let notes: string;
    let propertyAddress: string;

    if (entityType === "report") {
      const { data: report, error } = await (supabase as any)
        .from("reports")
        .select("id, property_address, roof_type, shingle_type, damage_notes, insurance_company, report_content, created_at")
        .eq("id", entityId)
        .eq("user_id", user.id)
        .single();

      if (error || !report) {
        return NextResponse.json({ error: "Report not found" }, { status: 404 });
      }

      propertyAddress = report.property_address || "";
      const reportExcerpt = (report.report_content || "").slice(0, 3000).trim();
      notes = formatReportNote({
        propertyAddress,
        roofType: report.roof_type || "N/A",
        shingleType: report.shingle_type || "N/A",
        insuranceCompany: report.insurance_company || "N/A",
        damageNotes: report.damage_notes || "",
        reportExcerpt,
      });
    } else {
      const { data: estimate, error } = await (supabase as any)
        .from("xactimate_estimates")
        .select("id, property_address, claim_number, insurance_carrier, original_rcv, original_acv, status, created_at, lead_id")
        .eq("id", entityId)
        .eq("user_id", user.id)
        .single();

      if (error || !estimate) {
        return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
      }

      propertyAddress = estimate.property_address || "";
      notes = formatEstimateNote({
        propertyAddress,
        claimNumber: estimate.claim_number || "N/A",
        carrier: estimate.insurance_carrier || "N/A",
        rcv: estimate.original_rcv,
        acv: estimate.original_acv,
        status: estimate.status || "N/A",
      });

      // For xactimate: if estimate has lead_id, check lead_exports first
      if (estimate.lead_id) {
        const { data: leadExport } = await (supabase as any)
          .from("lead_exports")
          .select("jn_contact_id")
          .eq("lead_id", estimate.lead_id)
          .eq("user_id", user.id)
          .eq("destination", "jobnimbus")
          .not("jn_contact_id", "is", null)
          .maybeSingle();

        if (leadExport?.jn_contact_id) {
          const actResult = await jnClient.createActivity({
            contact_id: leadExport.jn_contact_id,
            type: "note",
            title: "StormClose Xactimate Estimate",
            note: notes,
          });

          if (actResult.success) {
            await (supabase as any).from("document_exports").insert({
              user_id: user.id,
              entity_type: entityType,
              entity_id: entityId,
              jn_contact_id: leadExport.jn_contact_id,
              exported_at: new Date().toISOString(),
            });
            return NextResponse.json({
              success: true,
              contactId: leadExport.jn_contact_id,
              addedToExisting: true,
              message: "Estimate added to existing JobNimbus contact",
            });
          }
        }
      }
    }

    // Find existing JobNimbus contact for this address (from leads exported via Appointment Set)
    let jnContactId: string | null = null;

    // 1. Check mission_stops (from Storm Ops) — most likely match for appointment-flow reports
    const { data: stops } = await (supabase as any)
      .from("mission_stops")
      .select("id, address, city, state, zip, lead_id")
      .eq("user_id", user.id)
      .not("lead_id", "is", null);

    const matchingStop = (stops || []).find((s: any) => {
      const stopAddr = [s.address, s.city, s.state, s.zip].filter(Boolean).join(", ");
      return addressesMatch(stopAddr, propertyAddress);
    });

    if (matchingStop?.lead_id) {
      const { data: le } = await (supabase as any)
        .from("lead_exports")
        .select("jn_contact_id")
        .eq("lead_id", matchingStop.lead_id)
        .eq("user_id", user.id)
        .eq("destination", "jobnimbus")
        .not("jn_contact_id", "is", null)
        .maybeSingle();
      if (le?.jn_contact_id) jnContactId = le.jn_contact_id;
    }

    // 2. Fallback: check leads by address
    if (!jnContactId) {
      const { data: exportedLeads } = await (supabase as any)
        .from("leads")
        .select("id, address, city, state, zip")
        .eq("user_id", user.id);

      const { data: exports } = await (supabase as any)
        .from("lead_exports")
        .select("lead_id, jn_contact_id")
        .eq("user_id", user.id)
        .eq("destination", "jobnimbus")
        .not("jn_contact_id", "is", null);

      const exportByLeadId = new Map((exports || []).map((e: any) => [e.lead_id, e.jn_contact_id]));
      const existingLead = (exportedLeads || []).find((l: any) => {
        const leadAddr = [l.address, l.city, l.state, l.zip].filter(Boolean).join(", ");
        return addressesMatch(leadAddr, propertyAddress);
      });
      const val = existingLead ? exportByLeadId.get(existingLead.id) : undefined;
      jnContactId = typeof val === "string" ? val : null;
    }

    if (jnContactId) {
      return addDocumentToExistingContact(
        supabase,
        jnClient,
        user.id,
        entityType,
        entityId,
        jnContactId,
        notes
      );
    }

    // 3. Search JobNimbus directly for existing contact with this address
    const searchResult = await jnClient.searchContactsByAddress(propertyAddress);
    if (searchResult.success && searchResult.data && searchResult.data.length > 0) {
      const existingContact = searchResult.data[0] as { id?: string; jnid?: string };
      const contactId = existingContact.jnid ?? existingContact.id ?? "";
      if (contactId) {
        return addDocumentToExistingContact(
          supabase,
          jnClient,
          user.id,
          entityType,
          entityId,
          contactId,
          notes
        );
      }
    }

    // No existing contact — create new one
    const { address, city, state, zip } = parseAddress(propertyAddress);
    const contact: JNContact = {
      first_name: "Homeowner",
      last_name: "",
      display_name: entityType === "report" ? `Report - ${address || "Property"}` : `Estimate - ${address || "Property"}`,
      address_line1: address || propertyAddress,
      city,
      state_text: state,
      zip,
      source_name: "StormClose AI",
      tags: entityType === "report" ? ["StormClose", "AI Report"] : ["StormClose", "Xactimate"],
      notes,
      description: notes,
    };

    const result = await jnClient.createContact(contact);

    if (!result.success || !result.data) {
      const errDetail = result.error?.detail || result.error?.title || "Unknown error";
      console.error("[Export Document] JobNimbus createContact failed:", result.error);
      const status = result.error?.status && result.error.status >= 400 && result.error.status < 500
        ? result.error.status
        : 500;
      return NextResponse.json(
        { error: `JobNimbus: ${errDetail}` },
        { status }
      );
    }

    const contactId = result.data.id ?? (result.data as { jnid?: string }).jnid ?? "";

    try {
      await (supabase as any).from("document_exports").insert({
        user_id: user.id,
        entity_type: entityType,
        entity_id: entityId,
        jn_contact_id: contactId,
        exported_at: new Date().toISOString(),
      });
    } catch (trackErr) {
      console.warn("[Export Document] Could not record in document_exports:", trackErr);
    }

    return NextResponse.json({
      success: true,
      contactId,
      message: "Document exported to JobNimbus successfully",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[Export Document] Error:", err);
    return NextResponse.json(
      { error: msg.includes("JOBNIMBUS") ? msg : `Export failed: ${msg}` },
      { status: 500 }
    );
  }
}
