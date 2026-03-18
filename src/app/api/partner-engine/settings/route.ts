import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, successResponse } from "@/utils/api-response";
import { requirePartnerEngineAuth, requireAdmin } from "@/lib/partner-engine/auth";

const PutSettingsSchema = z.object({
	companySlug: z.string().min(1).optional(),
	defaultRewardType: z.enum(["flat", "percentage"]).optional(),
	defaultRewardAmount: z.number().nonnegative().optional(),
	slaContactHours: z.number().int().min(1).max(168).optional(),
	autoRewardOnInstall: z.boolean().optional(),
	notifyPartnersOnStorm: z.boolean().optional(),
	jobnimbusSyncStage: z.string().optional(),
});

function mapSettings(row: Record<string, unknown>) {
	return {
		companySlug: String(row.company_slug ?? ""),
		defaultRewardType: String(row.default_reward_type ?? "flat"),
		defaultRewardAmount: Number(row.default_reward_amount ?? 250),
		slaContactHours: Number(row.sla_contact_hours ?? 24),
		autoRewardOnInstall: Boolean(row.auto_reward_on_install ?? true),
		notifyPartnersOnStorm: Boolean(row.notify_partners_on_storm ?? false),
		jobnimbusSyncStage: String(row.jobnimbus_sync_stage ?? "received"),
		createdAt: (row.created_at as string | null) ?? null,
		updatedAt: (row.updated_at as string | null) ?? null,
	};
}

export async function GET() {
	try {
		const result = await requirePartnerEngineAuth();
		if (!result.ok) return errorResponse(result.error, result.status);

		const { supabase, teamId } = result.auth;

		const { data, error } = await (supabase as any)
			.from("partner_engine_settings")
			.select("company_slug,default_reward_type,default_reward_amount,sla_contact_hours,auto_reward_on_install,notify_partners_on_storm,jobnimbus_sync_stage,created_at,updated_at")
			.eq("team_id", teamId)
			.maybeSingle();

		if (error) return errorResponse(error.message, 500);

		if (!data) {
			return successResponse({
				companySlug: "",
				defaultRewardType: "flat",
				defaultRewardAmount: 250,
				slaContactHours: 24,
				autoRewardOnInstall: true,
				notifyPartnersOnStorm: false,
				jobnimbusSyncStage: "received",
				createdAt: null,
				updatedAt: null,
			});
		}

		return successResponse(mapSettings(data as Record<string, unknown>));
	} catch (error) {
		return errorResponse(error instanceof Error ? error.message : "Failed to load settings", 500);
	}
}

export async function PUT(request: NextRequest) {
	try {
		const result = await requirePartnerEngineAuth();
		if (!result.ok) return errorResponse(result.error, result.status);
		const adminCheck = requireAdmin(result.auth);
		if (adminCheck) return errorResponse(adminCheck.error, adminCheck.status);

		const { supabase, userId, teamId } = result.auth;
		const body = PutSettingsSchema.parse(await request.json());

		const { data: existing } = await (supabase as any)
			.from("partner_engine_settings")
			.select("*")
			.eq("team_id", teamId)
			.maybeSingle();

		const existingRow = existing as Record<string, unknown> | null;
		const payload = {
			user_id: userId,
			team_id: teamId,
			company_slug: body.companySlug ?? existingRow?.company_slug ?? `team-${teamId}`,
			default_reward_type: body.defaultRewardType ?? existingRow?.default_reward_type ?? "flat",
			default_reward_amount: body.defaultRewardAmount ?? existingRow?.default_reward_amount ?? 250,
			sla_contact_hours: body.slaContactHours ?? existingRow?.sla_contact_hours ?? 24,
			auto_reward_on_install: body.autoRewardOnInstall ?? existingRow?.auto_reward_on_install ?? true,
			notify_partners_on_storm: body.notifyPartnersOnStorm ?? existingRow?.notify_partners_on_storm ?? false,
			jobnimbus_sync_stage: body.jobnimbusSyncStage ?? existingRow?.jobnimbus_sync_stage ?? "received",
			updated_at: new Date().toISOString(),
		};

		const { data, error } = await (supabase as any)
			.from("partner_engine_settings")
			.upsert(payload, { onConflict: "team_id" })
			.select()
			.single();

		if (error) return errorResponse(error.message, 500);
		return successResponse(mapSettings(data as Record<string, unknown>));
	} catch (error) {
		if (error instanceof z.ZodError) return errorResponse("Invalid payload", 400, { details: error.flatten() });
		return errorResponse(error instanceof Error ? error.message : "Failed to update settings", 500);
	}
}
