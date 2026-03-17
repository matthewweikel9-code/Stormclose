import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { errorResponse, successResponse } from "@/utils/api-response";

const CreateRewardSchema = z.object({
	referralId: z.string().uuid(),
	amount: z.number().nonnegative(),
	rewardType: z.enum(["flat", "percentage"]).optional(),
});

const UpdateRewardSchema = z.object({
	id: z.string().uuid(),
	status: z.enum(["pending", "approved", "paid", "cancelled"]),
	approvedBy: z.string().optional().nullable(),
	paidMethod: z.string().optional().nullable(),
});

function mapReward(
	row: Record<string, unknown>,
	partnerName?: string | null,
	referralAddress?: string | null
) {
	return {
		id: String(row.id ?? ""),
		partnerId: (row.partner_id as string | null) ?? null,
		partnerName: partnerName ?? (row.partner_name as string | null) ?? null,
		referralId: String(row.referral_id ?? ""),
		referralAddress: referralAddress ?? (row.referral_address as string | null) ?? null,
		amount: Number(row.amount ?? 0),
		rewardType: String(row.reward_type ?? "flat"),
		rewardRule: (row.reward_rule as string | null) ?? null,
		status: String(row.status ?? "pending"),
		approvedBy: (row.approved_by as string | null) ?? null,
		paidAt: (row.paid_at as string | null) ?? null,
		paidMethod: (row.paid_method as string | null) ?? null,
		payoutBatchId: (row.payout_batch_id as string | null) ?? null,
		createdAt: (row.created_at as string | null) ?? null,
		updatedAt: (row.updated_at as string | null) ?? null,
	};
}

async function getAuth() {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	return { supabase, userId: user?.id ?? null };
}

export async function GET() {
	try {
		const { supabase, userId } = await getAuth();
		if (!userId) return errorResponse("Unauthorized", 401);

		const { data, error } = await supabase
			.from("partner_engine_rewards")
			.select(
				"id,partner_id,referral_id,amount,reward_type,reward_rule,status,approved_by,paid_at,paid_method,payout_batch_id,created_at,updated_at,partner_engine_partners(name),partner_engine_referrals(property_address)"
			)
			.eq("user_id", userId)
			.order("created_at", { ascending: false });

		if (error) return errorResponse(error.message, 500);

		const rows = (data ?? []).map((row: Record<string, unknown>) => {
			const partner = row.partner_engine_partners as Record<string, unknown> | null;
			const referral = row.partner_engine_referrals as Record<string, unknown> | null;
			const partnerName = partner && typeof partner === "object" ? (partner.name as string) : null;
			const referralAddress = referral && typeof referral === "object" ? (referral.property_address as string) : null;
			const { partner_engine_partners: _, partner_engine_referrals: __, ...rest } = row;
			return mapReward(rest, partnerName, referralAddress);
		});

		return successResponse(rows);
	} catch (error) {
		return errorResponse(error instanceof Error ? error.message : "Failed to list rewards", 500);
	}
}

export async function POST(request: NextRequest) {
	try {
		const { supabase, userId } = await getAuth();
		if (!userId) return errorResponse("Unauthorized", 401);

		const body = CreateRewardSchema.parse(await request.json());

		const { data: referralRow, error: referralError } = await supabase
			.from("partner_engine_referrals")
			.select("id,partner_id")
			.eq("id", body.referralId)
			.eq("user_id", userId)
			.single();

		if (referralError || !referralRow) return errorResponse("Referral not found", 404);

		const partnerId = (referralRow as Record<string, unknown>).partner_id as string | null;

		const { data, error } = await supabase
			.from("partner_engine_rewards")
			.insert({
				user_id: userId,
				partner_id: partnerId,
				referral_id: body.referralId,
				amount: body.amount,
				reward_type: body.rewardType ?? "flat",
				status: "pending",
			})
			.select()
			.single();

		if (error) return errorResponse(error.message, 500);
		return successResponse(mapReward(data as Record<string, unknown>), {}, 201);
	} catch (error) {
		if (error instanceof z.ZodError) return errorResponse("Invalid payload", 400, { details: error.flatten() });
		return errorResponse(error instanceof Error ? error.message : "Failed to create reward", 500);
	}
}

export async function PATCH(request: NextRequest) {
	try {
		const { supabase, userId } = await getAuth();
		if (!userId) return errorResponse("Unauthorized", 401);

		const body = UpdateRewardSchema.parse(await request.json());
		const patch: Record<string, unknown> = {
			status: body.status,
			updated_at: new Date().toISOString(),
		};

		if (body.status === "paid") {
			patch.paid_at = new Date().toISOString();
			if (body.paidMethod !== undefined) patch.paid_method = body.paidMethod;
		}
		if (body.approvedBy !== undefined) patch.approved_by = body.approvedBy;
		if (body.status === "approved" && body.approvedBy) patch.approved_by = body.approvedBy;
		if (body.status === "cancelled") {
			patch.paid_at = null;
			patch.paid_method = null;
		}

		const { data, error } = await supabase
			.from("partner_engine_rewards")
			.update(patch)
			.eq("id", body.id)
			.eq("user_id", userId)
			.select("*,partner_engine_partners(name),partner_engine_referrals(property_address)")
			.single();

		if (error) return errorResponse(error.message, 500);

		const row = data as Record<string, unknown>;
		const partner = row.partner_engine_partners as Record<string, unknown> | null;
		const referral = row.partner_engine_referrals as Record<string, unknown> | null;
		const partnerName = partner && typeof partner === "object" ? (partner.name as string) : null;
		const referralAddress = referral && typeof referral === "object" ? (referral.property_address as string) : null;
		const { partner_engine_partners: _, partner_engine_referrals: __, ...rest } = row;
		return successResponse(mapReward(rest, partnerName, referralAddress));
	} catch (error) {
		if (error instanceof z.ZodError) return errorResponse("Invalid payload", 400, { details: error.flatten() });
		return errorResponse(error instanceof Error ? error.message : "Failed to update reward", 500);
	}
}
