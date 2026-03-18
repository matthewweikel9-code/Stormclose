import { NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorResponse, successResponse } from "@/utils/api-response";

const PublicReferralSchema = z.object({
	companySlug: z.string().min(1),
	referralCode: z.string().min(3),
	propertyAddress: z.string().min(3),
	homeownerName: z.string().optional().nullable(),
	homeownerPhone: z.string().optional().nullable(),
	homeownerEmail: z.string().email().optional().nullable(),
	city: z.string().optional().nullable(),
	state: z.string().optional().nullable(),
	zip: z.string().optional().nullable(),
	notes: z.string().optional().nullable(),
});

export async function POST(request: NextRequest) {
	try {
		const supabase = createAdminClient();
		const body = PublicReferralSchema.parse(await request.json());

		const { data: partner, error: partnerError } = await (supabase as any)
			.from("partner_engine_partners")
			.select("id,user_id,team_id,status")
			.eq("referral_code", body.referralCode)
			.maybeSingle();

		if (partnerError) return errorResponse(partnerError.message, 500);
		if (!partner || (partner as Record<string, unknown>).status !== "active") {
			return errorResponse("Referral link is invalid or inactive", 404);
		}

		const userId = (partner as Record<string, unknown>).user_id as string;
		const teamId = (partner as Record<string, unknown>).team_id as string | null;
		const partnerId = (partner as Record<string, unknown>).id as string;

		const { data, error } = await (supabase as any)
			.from("partner_engine_referrals")
			.insert({
				user_id: userId,
				team_id: teamId,
				partner_id: partnerId,
				property_address: body.propertyAddress,
				homeowner_name: body.homeownerName ?? null,
				homeowner_phone: body.homeownerPhone ?? null,
				homeowner_email: body.homeownerEmail ?? null,
				city: body.city ?? null,
				state: body.state ?? null,
				zip: body.zip ?? null,
				notes: body.notes ?? null,
				status: "received",
				source: "partner_link",
				priority: "normal",
			})
			.select("id,status,created_at")
			.single();

		if (error) return errorResponse(error.message, 500);

		await (supabase as any)
			.from("partner_engine_partners")
			.update({ last_active_at: new Date().toISOString() })
			.eq("id", partnerId);

		return successResponse(
			{
				id: (data as Record<string, unknown>).id,
				status: (data as Record<string, unknown>).status,
				createdAt: (data as Record<string, unknown>).created_at,
				companySlug: body.companySlug,
			},
			{},
			201,
		);
	} catch (error) {
		if (error instanceof z.ZodError) return errorResponse("Invalid payload", 400, { details: error.flatten() });
		return errorResponse(error instanceof Error ? error.message : "Failed to submit referral", 500);
	}
}
