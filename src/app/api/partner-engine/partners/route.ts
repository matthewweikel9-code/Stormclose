import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { errorResponse, successResponse } from "@/utils/api-response";

const PartnerTypeEnum = z.enum([
	"realtor",
	"insurance_agent",
	"home_inspector",
	"property_manager",
	"contractor",
	"other",
]);
const StatusEnum = z.enum(["active", "paused", "archived"]);
const TierEnum = z.enum(["bronze", "silver", "gold", "platinum"]);

const CreatePartnerSchema = z.object({
	name: z.string().min(1),
	businessName: z.string().optional().nullable(),
	email: z.string().email().optional().nullable(),
	phone: z.string().optional().nullable(),
	partnerType: PartnerTypeEnum.optional(),
	territory: z.string().optional().nullable(),
	city: z.string().optional().nullable(),
	state: z.string().optional().nullable(),
	zip: z.string().optional().nullable(),
	tier: TierEnum.optional(),
	notes: z.string().optional().nullable(),
	tags: z.array(z.string()).optional().nullable(),
});

const UpdatePartnerSchema = z.object({
	id: z.string().uuid(),
	name: z.string().min(1).optional(),
	businessName: z.string().optional().nullable(),
	email: z.string().email().optional().nullable(),
	phone: z.string().optional().nullable(),
	partnerType: PartnerTypeEnum.optional(),
	territory: z.string().optional().nullable(),
	city: z.string().optional().nullable(),
	state: z.string().optional().nullable(),
	zip: z.string().optional().nullable(),
	tier: TierEnum.optional(),
	status: StatusEnum.optional(),
	notes: z.string().optional().nullable(),
	tags: z.array(z.string()).optional().nullable(),
	notifyEmail: z.boolean().optional(),
	notifySms: z.boolean().optional(),
	notifyInApp: z.boolean().optional(),
});

function generateReferralCode(name: string) {
	const base = name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "partner";
	const suffix = Math.random().toString(36).slice(2, 8);
	return `${base}${suffix}`;
}

function generateInviteCode() {
	return `inv_${Math.random().toString(36).slice(2, 12)}`;
}

function mapPartner(row: Record<string, unknown>) {
	return {
		id: String(row.id ?? ""),
		name: String(row.name ?? ""),
		businessName: (row.business_name as string | null) ?? null,
		email: (row.email as string | null) ?? null,
		phone: (row.phone as string | null) ?? null,
		partnerType: String(row.partner_type ?? "other"),
		referralCode: String(row.referral_code ?? ""),
		inviteCode: (row.invite_code as string | null) ?? null,
		status: String(row.status ?? "active"),
		tier: String(row.tier ?? "bronze"),
		territory: (row.territory as string | null) ?? null,
		city: (row.city as string | null) ?? null,
		state: (row.state as string | null) ?? null,
		zip: (row.zip as string | null) ?? null,
		totalReferrals: Number(row.total_referrals ?? 0),
		totalInstalls: Number(row.total_installs ?? 0),
		totalRevenue: Number(row.total_revenue ?? 0),
		totalRewardsPaid: Number(row.total_rewards_paid ?? 0),
		lastActiveAt: (row.last_active_at as string | null) ?? null,
		notes: (row.notes as string | null) ?? null,
		tags: (row.tags as string[] | null) ?? [],
		notifyEmail: Boolean(row.notify_email ?? true),
		notifySms: Boolean(row.notify_sms ?? false),
		notifyInApp: Boolean(row.notify_in_app ?? true),
		createdAt: (row.created_at as string | null) ?? null,
		updatedAt: (row.updated_at as string | null) ?? null,
	};
}

async function getAuth() {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	return { supabase, userId: user?.id ?? null };
}

export async function GET(request: NextRequest) {
	try {
		const { supabase, userId } = await getAuth();
		if (!userId) return errorResponse("Unauthorized", 401);

		const url = new URL(request.url);
		const q = url.searchParams.get("q");
		const partnerType = url.searchParams.get("partnerType");
		const status = url.searchParams.get("status");
		const tier = url.searchParams.get("tier");
		const territory = url.searchParams.get("territory");

		const selectCols =
			"id,name,business_name,email,phone,partner_type,referral_code,invite_code,status,tier,territory,city,state,zip,total_referrals,total_installs,total_revenue,total_rewards_paid,last_active_at,notes,tags,notify_email,notify_sms,notify_in_app,created_at,updated_at";

		let query = supabase
			.from("partner_engine_partners")
			.select(selectCols)
			.eq("user_id", userId)
			.order("created_at", { ascending: false });

		if (q) {
			query = query.or(`name.ilike.%${q}%,business_name.ilike.%${q}%,email.ilike.%${q}%`);
		}
		if (partnerType) query = query.eq("partner_type", partnerType);
		if (status) query = query.eq("status", status);
		if (tier) query = query.eq("tier", tier);
		if (territory) query = query.eq("territory", territory);

		const { data, error } = await query;
		if (error) return errorResponse(error.message, 500);
		return successResponse((data ?? []).map((row) => mapPartner(row as Record<string, unknown>)));
	} catch (error) {
		return errorResponse(error instanceof Error ? error.message : "Failed to list partners", 500);
	}
}

export async function POST(request: NextRequest) {
	try {
		const { supabase, userId } = await getAuth();
		if (!userId) return errorResponse("Unauthorized", 401);

		const body = CreatePartnerSchema.parse(await request.json());
		const referralCode = generateReferralCode(body.name);
		const inviteCode = generateInviteCode();

		const insert: Record<string, unknown> = {
			user_id: userId,
			name: body.name,
			business_name: body.businessName ?? null,
			email: body.email ?? null,
			phone: body.phone ?? null,
			partner_type: body.partnerType ?? "other",
			referral_code: referralCode,
			invite_code: inviteCode,
			status: "active",
			tier: body.tier ?? "bronze",
			territory: body.territory ?? null,
			city: body.city ?? null,
			state: body.state ?? null,
			zip: body.zip ?? null,
			notes: body.notes ?? null,
			tags: body.tags ?? [],
		};

		const { data, error } = await supabase
			.from("partner_engine_partners")
			.insert(insert)
			.select()
			.single();

		if (error) return errorResponse(error.message, 500);
		return successResponse(mapPartner(data as Record<string, unknown>), {}, 201);
	} catch (error) {
		if (error instanceof z.ZodError) return errorResponse("Invalid payload", 400, { details: error.flatten() });
		return errorResponse(error instanceof Error ? error.message : "Failed to create partner", 500);
	}
}

export async function PATCH(request: NextRequest) {
	try {
		const { supabase, userId } = await getAuth();
		if (!userId) return errorResponse("Unauthorized", 401);

		const body = UpdatePartnerSchema.parse(await request.json());
		const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

		if (body.name !== undefined) patch.name = body.name;
		if (body.businessName !== undefined) patch.business_name = body.businessName;
		if (body.email !== undefined) patch.email = body.email;
		if (body.phone !== undefined) patch.phone = body.phone;
		if (body.partnerType !== undefined) patch.partner_type = body.partnerType;
		if (body.territory !== undefined) patch.territory = body.territory;
		if (body.city !== undefined) patch.city = body.city;
		if (body.state !== undefined) patch.state = body.state;
		if (body.zip !== undefined) patch.zip = body.zip;
		if (body.tier !== undefined) patch.tier = body.tier;
		if (body.status !== undefined) patch.status = body.status;
		if (body.notes !== undefined) patch.notes = body.notes;
		if (body.tags !== undefined) patch.tags = body.tags;
		if (body.notifyEmail !== undefined) patch.notify_email = body.notifyEmail;
		if (body.notifySms !== undefined) patch.notify_sms = body.notifySms;
		if (body.notifyInApp !== undefined) patch.notify_in_app = body.notifyInApp;

		const { data, error } = await supabase
			.from("partner_engine_partners")
			.update(patch)
			.eq("id", body.id)
			.eq("user_id", userId)
			.select()
			.single();

		if (error) return errorResponse(error.message, 500);
		return successResponse(mapPartner(data as Record<string, unknown>));
	} catch (error) {
		if (error instanceof z.ZodError) return errorResponse("Invalid payload", 400, { details: error.flatten() });
		return errorResponse(error instanceof Error ? error.message : "Failed to update partner", 500);
	}
}
