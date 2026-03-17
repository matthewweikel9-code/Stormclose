import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createJobNimbusClient } from "@/lib/jobnimbus/client";
import { decryptJobNimbusApiKey } from "@/lib/jobnimbus/security";
import { errorResponse, successResponse } from "@/utils/api-response";

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
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user) return errorResponse("Unauthorized", 401);

		const { data: integration, error: integrationError } = await (supabase
			.from("jobnimbus_integrations") as any)
			.select("api_key_encrypted")
			.eq("user_id", user.id)
			.maybeSingle();
		if (integrationError) return errorResponse(integrationError.message, 500);
		if (!integration?.api_key_encrypted) return errorResponse("JobNimbus is not connected", 400);

		const { data: referral, error: referralError } = await (supabase.from("partner_engine_referrals") as any)
			.select("id,homeowner_name,homeowner_phone,homeowner_email,property_address,city,state,zip,notes,external_record_id,last_synced_at")
			.eq("id", id)
			.eq("user_id", user.id)
			.single();
		if (referralError) return errorResponse("Referral not found", 404);

		const ref = referral as Record<string, unknown>;
		if (ref.external_record_id && ref.last_synced_at) {
			return successResponse({ referralId: id, externalCrm: "jobnimbus", externalRecordId: ref.external_record_id, alreadySynced: true });
		}

		const apiKey = decryptJobNimbusApiKey(String(integration.api_key_encrypted));
		const client = createJobNimbusClient(apiKey);

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
			notes: (ref.notes as string | null) ?? "Referral submitted via StormClose Partner Engine",
		});

		if (!createContact.success || !createContact.data) {
			const detail = createContact.error?.detail || "Unknown sync error";
			await (supabase.from("partner_engine_referrals") as any)
				.update({ sync_error: detail, updated_at: new Date().toISOString() })
				.eq("id", id)
				.eq("user_id", user.id);
			return errorResponse(`JobNimbus sync failed: ${detail}`, 502);
		}

		const contactId =
			((createContact.data as Record<string, unknown>).id as string | undefined) ??
			((createContact.data as Record<string, unknown>).jnid as string | undefined) ??
			"unknown";

		const { error: updateError } = await (supabase.from("partner_engine_referrals") as any)
			.update({
				external_crm: "jobnimbus",
				external_record_id: contactId,
				last_synced_at: new Date().toISOString(),
				sync_error: null,
				updated_at: new Date().toISOString(),
			})
			.eq("id", id)
			.eq("user_id", user.id);
		if (updateError) return errorResponse(updateError.message, 500);

		return successResponse({ referralId: id, externalCrm: "jobnimbus", externalRecordId: contactId });
	} catch (error) {
		return errorResponse(error instanceof Error ? error.message : "Failed to sync referral", 500);
	}
}
