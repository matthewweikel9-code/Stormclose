import { NextRequest } from "next/server";
import { createJobNimbusClient } from "@/lib/jobnimbus/client";
import { decryptJobNimbusApiKey } from "@/lib/jobnimbus/security";
import { errorResponse, successResponse } from "@/utils/api-response";
import { requirePartnerEngineAuth, requireManager } from "@/lib/partner-engine/auth";
import { fetchRoofDataForNotes, formatRoofDataForNotes } from "@/lib/solar/solarApi";

function splitName(fullName: string | null | undefined) {
	if (!fullName) return { first: "Homeowner", last: "Referral" };
	const parts = fullName.trim().split(/\s+/);
	if (parts.length === 1) return { first: parts[0], last: "Referral" };
	return { first: parts[0], last: parts.slice(1).join(" ") };
}

export async function POST(
	_request: NextRequest,
	{ params }: { params: { id: string } }
) {
	try {
		const { id } = params;
		const result = await requirePartnerEngineAuth();
		if (!result.ok) return errorResponse(result.error, result.status);
		const managerCheck = requireManager(result.auth);
		if (managerCheck) return errorResponse(managerCheck.error, managerCheck.status);

		const { supabase, teamId } = result.auth;

		const integration = await import("@/lib/jobnimbus/team-integration").then((m) =>
			m.getJobNimbusIntegrationForTeam(supabase, teamId)
		);
		if (!integration?.api_key_encrypted) return errorResponse("JobNimbus is not connected. Connect it in Settings → Integrations.", 400);

		const { data: referral, error: referralError } = await (supabase as any)
			.from("partner_engine_referrals")
			.select("id,homeowner_name,homeowner_phone,homeowner_email,property_address,city,state,zip,notes,external_record_id,last_synced_at")
			.eq("id", id)
			.eq("team_id", teamId)
			.single();
		if (referralError) return errorResponse("Referral not found", 404);

		const ref = referral as Record<string, unknown>;
		if (ref.external_record_id && ref.last_synced_at) {
			return successResponse({ referralId: id, externalCrm: "jobnimbus", externalRecordId: ref.external_record_id, alreadySynced: true });
		}

		const apiKey = decryptJobNimbusApiKey(String(integration.api_key_encrypted));
		const client = createJobNimbusClient(apiKey);

		// Fetch roof data from Google Solar API (same flow as Appointment Set)
		const fullAddress = [ref.property_address, ref.city, ref.state, ref.zip]
			.filter(Boolean)
			.join(", ");
		const roofData = await fetchRoofDataForNotes(
			fullAddress || String(ref.property_address ?? ""),
			0,
			0
		);

		const notesLines = [
			"--- Referral from StormClose Partner Engine ---",
			"",
			(ref.notes as string | null) || "Referral submitted via StormClose Partner Engine",
			roofData ? formatRoofDataForNotes(roofData) : null,
			"",
			`Synced: ${new Date().toLocaleString()}`,
		].filter(Boolean);
		const notes = notesLines.join("\n");

		const names = splitName(ref.homeowner_name as string | null);
		const createContact = await client.createContact({
			first_name: names.first,
			last_name: names.last,
			email: (ref.homeowner_email as string | null) ?? undefined,
			mobile_phone: (ref.homeowner_phone as string | null) ?? undefined,
			address_line1: String(ref.property_address ?? ""),
			city: (ref.city as string | null) ?? undefined,
			state_text: (ref.state as string | null) ?? undefined,
			zip: (ref.zip as string | null) ?? undefined,
			notes,
		});

		if (!createContact.success || !createContact.data) {
			const detail = createContact.error?.detail || "Unknown sync error";
			await (supabase as any)
				.from("partner_engine_referrals")
				.update({ sync_error: detail, updated_at: new Date().toISOString() })
				.eq("id", id)
				.eq("team_id", teamId);
			return errorResponse(`JobNimbus sync failed: ${detail}`, 502);
		}

		const contactId =
			((createContact.data as Record<string, unknown>).id as string | undefined) ??
			((createContact.data as Record<string, unknown>).jnid as string | undefined) ??
			"unknown";

		const { error: updateError } = await (supabase as any)
			.from("partner_engine_referrals")
			.update({
				external_crm: "jobnimbus",
				external_record_id: contactId,
				last_synced_at: new Date().toISOString(),
				sync_error: null,
				updated_at: new Date().toISOString(),
			})
			.eq("id", id)
			.eq("team_id", teamId);
		if (updateError) return errorResponse(updateError.message, 500);

		return successResponse({ referralId: id, externalCrm: "jobnimbus", externalRecordId: contactId });
	} catch (error) {
		return errorResponse(error instanceof Error ? error.message : "Failed to sync referral", 500);
	}
}
