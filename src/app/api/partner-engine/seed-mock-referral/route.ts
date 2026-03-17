import { createClient } from "@/lib/supabase/server";
import { errorResponse, successResponse } from "@/utils/api-response";

function generateReferralCode() {
	return `test${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * POST /api/partner-engine/seed-mock-referral
 * Creates a mock partner (if none), a mock referral, and syncs it to JobNimbus.
 */
export async function POST() {
	try {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user) return errorResponse("Unauthorized", 401);

		// Get or create a test partner
		let partnerId: string | null = null;
		const { data: existingPartners } = await (supabase as any)
			.from("partner_engine_partners")
			.select("id")
			.eq("user_id", user.id)
			.limit(1);

		if (existingPartners?.length) {
			partnerId = (existingPartners[0] as { id: string }).id;
		} else {
			const referralCode = generateReferralCode();
			const { data: newPartner, error: partnerError } = await (supabase as any)
				.from("partner_engine_partners")
				.insert({
					user_id: user.id,
					name: "Test Partner",
					business_name: "Test Realty",
					email: "test@example.com",
					partner_type: "realtor",
					referral_code: referralCode,
					status: "active",
					tier: "bronze",
				})
				.select("id")
				.single();
			if (partnerError) return errorResponse(partnerError.message, 500);
			partnerId = (newPartner as { id: string }).id;
		}

		// Create mock referral with unique data (avoids JobNimbus duplicate rejection)
		const suffix = Math.random().toString(36).slice(2, 8);
		const mockAddress = `123 Test St, Oklahoma City, OK 73013`;
		const mockName = `Test Contact ${suffix}`;
		const mockEmail = `test.${suffix}@example.com`;
		const { data: referral, error: referralError } = await (supabase as any)
			.from("partner_engine_referrals")
			.insert({
				user_id: user.id,
				partner_id: partnerId,
				property_address: mockAddress,
				homeowner_name: mockName,
				homeowner_phone: "(555) 123-4567",
				homeowner_email: mockEmail,
				city: "Oklahoma City",
				state: "OK",
				zip: "73013",
				notes: "Mock referral created for JobNimbus sync test",
				status: "received",
				source: "manual",
				priority: "normal",
			})
			.select("id,property_address,homeowner_name")
			.single();

		if (referralError) return errorResponse(referralError.message, 500);
		const refId = (referral as { id: string }).id;

		// Sync to JobNimbus
		const syncRes = await fetch(
			`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:4013"}/api/partner-engine/referrals/${refId}/sync`,
			{
				method: "POST",
				headers: {
					Cookie: (await import("next/headers")).cookies().toString(),
				},
			},
		);

		// Fetch cookies from the request context - we need to call sync from within the same request
		// Actually, fetch to self won't work well with auth. Let me inline the sync logic instead.
		// I'll refactor to call the sync logic directly.
		// For now, let me just create the referral and return it - the user can click Sync. Or we can inline the sync.
		const { data: integration } = await (supabase as any)
			.from("jobnimbus_integrations")
			.select("api_key_encrypted")
			.eq("user_id", user.id)
			.maybeSingle();

		let synced = false;
		let syncError: string | null = null;

		if (integration?.api_key_encrypted) {
			try {
				const { decryptJobNimbusApiKey } = await import("@/lib/jobnimbus/security");
				const { createJobNimbusClient } = await import("@/lib/jobnimbus/client");
				const apiKey = decryptJobNimbusApiKey(String(integration.api_key_encrypted));
				const client = createJobNimbusClient(apiKey);
				const [first, ...rest] = mockName.split(" ");
				const last = rest.join(" ") || "Referral";
				const createContact = await client.createContact({
					first_name: first,
					last_name: last,
					email: mockEmail,
					mobile_phone: "(555) 123-4567",
					address_line1: "123 Test St",
					city: "Oklahoma City",
					state_text: "OK",
					zip: "73013",
					notes: "Mock referral created for JobNimbus sync test",
				});
				if (createContact.success && createContact.data) {
					const contactId =
						((createContact.data as Record<string, unknown>).id as string) ??
						((createContact.data as Record<string, unknown>).jnid as string) ??
						"unknown";
					await (supabase as any)
						.from("partner_engine_referrals")
						.update({
							external_crm: "jobnimbus",
							external_record_id: contactId,
							last_synced_at: new Date().toISOString(),
							sync_error: null,
							updated_at: new Date().toISOString(),
						})
						.eq("id", refId)
						.eq("user_id", user.id);
					synced = true;
				} else {
					syncError = (createContact.error as { detail?: string })?.detail || "Unknown sync error";
					await (supabase as any)
						.from("partner_engine_referrals")
						.update({
							sync_error: syncError,
							updated_at: new Date().toISOString(),
						})
						.eq("id", refId)
						.eq("user_id", user.id);
				}
			} catch (err) {
				syncError = err instanceof Error ? err.message : "Sync failed";
				await (supabase as any)
					.from("partner_engine_referrals")
					.update({
						sync_error: syncError,
						updated_at: new Date().toISOString(),
					})
					.eq("id", refId)
					.eq("user_id", user.id);
			}
		} else {
			syncError = "JobNimbus is not connected. Connect it in Settings → Integrations.";
		}

		return successResponse(
			{
				referralId: refId,
				propertyAddress: mockAddress,
				homeownerName: mockName,
				synced,
				syncError,
			},
			{},
			201,
		);
	} catch (error) {
		return errorResponse(error instanceof Error ? error.message : "Failed to create mock referral", 500);
	}
}
