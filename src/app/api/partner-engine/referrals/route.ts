import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, successResponse } from "@/utils/api-response";
import { requirePartnerEngineAuth, requireManager } from "@/lib/partner-engine/auth";

const ReferralStatusEnum = z.enum([
	"received",
	"contacted",
	"inspection_scheduled",
	"inspection_complete",
	"claim_filed",
	"approved",
	"roof_installed",
	"closed",
	"lost",
]);
const PriorityEnum = z.enum(["low", "normal", "high", "urgent"]);
const SourceEnum = z.enum(["partner_link", "manual", "storm_alert", "api"]);

const CreateReferralSchema = z.object({
	partnerId: z.string().uuid().optional().nullable(),
	homeownerName: z.string().optional().nullable(),
	homeownerPhone: z.string().optional().nullable(),
	homeownerEmail: z.string().email().optional().nullable(),
	propertyAddress: z.string().min(3),
	city: z.string().optional().nullable(),
	state: z.string().optional().nullable(),
	zip: z.string().optional().nullable(),
	notes: z.string().optional().nullable(),
	photoUrls: z.array(z.string().url()).optional().nullable(),
	priority: PriorityEnum.optional(),
	source: SourceEnum.optional(),
	contractValue: z.number().nonnegative().optional(),
});

const UpdateReferralSchema = z.object({
	id: z.string().uuid(),
	status: ReferralStatusEnum.optional(),
	jobId: z.string().uuid().optional().nullable(),
	contractValue: z.number().nonnegative().optional(),
	lostReason: z.string().optional().nullable(),
	priority: PriorityEnum.optional(),
	notes: z.string().optional().nullable(),
});

function mapReferral(row: Record<string, unknown>, partnerName?: string | null) {
	return {
		id: String(row.id ?? ""),
		partnerId: (row.partner_id as string | null) ?? null,
		partnerName: partnerName ?? (row.partner_name as string | null) ?? null,
		homeownerName: (row.homeowner_name as string | null) ?? null,
		homeownerPhone: (row.homeowner_phone as string | null) ?? null,
		homeownerEmail: (row.homeowner_email as string | null) ?? null,
		propertyAddress: String(row.property_address ?? ""),
		city: (row.city as string | null) ?? null,
		state: (row.state as string | null) ?? null,
		zip: (row.zip as string | null) ?? null,
		notes: (row.notes as string | null) ?? null,
		photoUrls: (row.photo_urls as string[] | null) ?? [],
		status: String(row.status ?? "received"),
		priority: String(row.priority ?? "normal"),
		source: String(row.source ?? "manual"),
		lostReason: (row.lost_reason as string | null) ?? null,
		jobId: (row.job_id as string | null) ?? null,
		contractValue: Number(row.contract_value ?? 0),
		slaContactBy: (row.sla_contact_by as string | null) ?? null,
		firstContactedAt: (row.first_contacted_at as string | null) ?? null,
		externalCrm: (row.external_crm as string | null) ?? null,
		externalRecordId: (row.external_record_id as string | null) ?? null,
		lastSyncedAt: (row.last_synced_at as string | null) ?? null,
		syncError: (row.sync_error as string | null) ?? null,
		createdAt: (row.created_at as string | null) ?? null,
		updatedAt: (row.updated_at as string | null) ?? null,
	};
}

async function getSlaContactBy(supabase: any, teamId: string): Promise<Date | null> {
	const { data } = await (supabase as any)
		.from("partner_engine_settings")
		.select("sla_contact_hours")
		.eq("team_id", teamId)
		.maybeSingle();
	const hours = data?.sla_contact_hours ?? 24;
	const deadline = new Date();
	deadline.setHours(deadline.getHours() + hours);
	return deadline;
}

export async function GET(request: NextRequest) {
	try {
		const result = await requirePartnerEngineAuth();
		if (!result.ok) return errorResponse(result.error, result.status);

		const { supabase, teamId } = result.auth;

		const url = new URL(request.url);
		const status = url.searchParams.get("status");
		const partnerId = url.searchParams.get("partnerId");
		const priority = url.searchParams.get("priority");
		const source = url.searchParams.get("source");

		let query = (supabase as any)
			.from("partner_engine_referrals")
			.select(
				"id,partner_id,homeowner_name,homeowner_phone,homeowner_email,property_address,city,state,zip,notes,photo_urls,status,priority,source,lost_reason,job_id,contract_value,sla_contact_by,first_contacted_at,external_crm,external_record_id,last_synced_at,sync_error,created_at,updated_at,partner_engine_partners(name)"
			)
			.eq("team_id", teamId)
			.order("created_at", { ascending: false });

		if (status) query = query.eq("status", status);
		if (partnerId) query = query.eq("partner_id", partnerId);
		if (priority) query = query.eq("priority", priority);
		if (source) query = query.eq("source", source);

		const { data, error } = await query;
		if (error) return errorResponse(error.message, 500);

		const rows = (data ?? []).map((row: Record<string, unknown>) => {
			const partner = row.partner_engine_partners as Record<string, unknown> | null;
			const partnerName = partner && typeof partner === "object" ? (partner.name as string) : null;
			const { partner_engine_partners: _, ...rest } = row as Record<string, unknown>;
			return mapReferral(rest, partnerName);
		});

		return successResponse(rows);
	} catch (error) {
		return errorResponse(error instanceof Error ? error.message : "Failed to list referrals", 500);
	}
}

export async function POST(request: NextRequest) {
	try {
		const result = await requirePartnerEngineAuth();
		if (!result.ok) return errorResponse(result.error, result.status);
		const managerCheck = requireManager(result.auth);
		if (managerCheck) return errorResponse(managerCheck.error, managerCheck.status);

		const { supabase, userId, teamId } = result.auth;
		const body = CreateReferralSchema.parse(await request.json());
		const slaContactBy = await getSlaContactBy(supabase, teamId);

		const insert: Record<string, unknown> = {
			user_id: userId,
			team_id: teamId,
			partner_id: body.partnerId ?? null,
			homeowner_name: body.homeownerName ?? null,
			homeowner_phone: body.homeownerPhone ?? null,
			homeowner_email: body.homeownerEmail ?? null,
			property_address: body.propertyAddress,
			city: body.city ?? null,
			state: body.state ?? null,
			zip: body.zip ?? null,
			notes: body.notes ?? null,
			photo_urls: body.photoUrls ?? [],
			priority: body.priority ?? "normal",
			source: body.source ?? "manual",
			contract_value: body.contractValue ?? 0,
			status: "received",
			sla_contact_by: slaContactBy?.toISOString() ?? null,
		};

		const { data, error } = await (supabase as any)
			.from("partner_engine_referrals")
			.insert(insert)
			.select()
			.single();

		if (error) return errorResponse(error.message, 500);
		return successResponse(mapReferral(data as Record<string, unknown>), {}, 201);
	} catch (error) {
		if (error instanceof z.ZodError) return errorResponse("Invalid payload", 400, { details: error.flatten() });
		return errorResponse(error instanceof Error ? error.message : "Failed to create referral", 500);
	}
}

export async function PATCH(request: NextRequest) {
	try {
		const result = await requirePartnerEngineAuth();
		if (!result.ok) return errorResponse(result.error, result.status);
		const managerCheck = requireManager(result.auth);
		if (managerCheck) return errorResponse(managerCheck.error, managerCheck.status);

		const { supabase, userId, teamId } = result.auth;
		const body = UpdateReferralSchema.parse(await request.json());
		const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

		if (body.status !== undefined) patch.status = body.status;
		if (body.jobId !== undefined) patch.job_id = body.jobId;
		if (body.contractValue !== undefined) patch.contract_value = body.contractValue;
		if (body.lostReason !== undefined) patch.lost_reason = body.lostReason;
		if (body.priority !== undefined) patch.priority = body.priority;
		if (body.notes !== undefined) patch.notes = body.notes;

		const { data: existing, error: fetchError } = await (supabase as any)
			.from("partner_engine_referrals")
			.select("id,status,partner_id")
			.eq("id", body.id)
			.eq("team_id", teamId)
			.single();

		if (fetchError || !existing) return errorResponse("Referral not found", 404);

		const prevStatus = (existing as Record<string, unknown>).status as string;
		const newStatus = body.status as string | undefined;

		const { data, error } = await (supabase as any)
			.from("partner_engine_referrals")
			.update(patch)
			.eq("id", body.id)
			.eq("team_id", teamId)
			.select("*,partner_engine_partners(name)")
			.single();

		if (error) return errorResponse(error.message, 500);

		if (newStatus === "roof_installed" && prevStatus !== "roof_installed") {
			const { data: settings } = await (supabase as any)
				.from("partner_engine_settings")
				.select("auto_reward_on_install,default_reward_amount,default_reward_type")
				.eq("team_id", teamId)
				.maybeSingle();

			const autoReward = settings?.auto_reward_on_install ?? true;
			if (autoReward) {
				const amount = Number(settings?.default_reward_amount ?? 250);
				const partnerId = (existing as Record<string, unknown>).partner_id as string | null;
				await (supabase as any).from("partner_engine_rewards").insert({
					user_id: userId,
					team_id: teamId,
					partner_id: partnerId,
					referral_id: body.id,
					amount,
					reward_type: settings?.default_reward_type ?? "flat",
					status: "pending",
				});
			}
		}

		const row = data as Record<string, unknown>;
		const partner = row.partner_engine_partners as Record<string, unknown> | null;
		const partnerName = partner && typeof partner === "object" ? (partner.name as string) : null;
		const { partner_engine_partners: _, ...rest } = row;
		return successResponse(mapReferral(rest, partnerName));
	} catch (error) {
		if (error instanceof z.ZodError) return errorResponse("Invalid payload", 400, { details: error.flatten() });
		return errorResponse(error instanceof Error ? error.message : "Failed to update referral", 500);
	}
}
