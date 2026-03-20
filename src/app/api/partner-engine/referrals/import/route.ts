import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, successResponse } from "@/utils/api-response";
import { requirePartnerEngineAuth, requireManager } from "@/lib/partner-engine/auth";
import type { ParsedReferralRow } from "@/lib/partner-engine/import-parser";

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

const ReferralRowSchema = z.object({
	propertyAddress: z.string().min(3),
	partnerName: z.string().optional().nullable(),
	homeownerName: z.string().optional().nullable(),
	homeownerPhone: z.string().optional().nullable(),
	homeownerEmail: z.string().optional().nullable(),
	city: z.string().optional().nullable(),
	state: z.string().optional().nullable(),
	zip: z.string().optional().nullable(),
	notes: z.string().optional().nullable(),
	priority: PriorityEnum.optional(),
	status: ReferralStatusEnum.optional(),
});

const ImportBodySchema = z.object({
	rows: z.array(ReferralRowSchema).max(500),
});

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

function buildPartnerNameToIdMap(partners: { id: string; name: string }[]): Map<string, string> {
	const map = new Map<string, string>();
	for (const p of partners) {
		const key = p.name.trim().toLowerCase();
		if (!map.has(key)) map.set(key, p.id);
	}
	return map;
}

export async function POST(request: NextRequest) {
	try {
		const result = await requirePartnerEngineAuth();
		if (!result.ok) return errorResponse(result.error, result.status);
		const managerCheck = requireManager(result.auth);
		if (managerCheck) return errorResponse(managerCheck.error, managerCheck.status);

		const { supabase, userId, teamId } = result.auth;
		const body = ImportBodySchema.parse(await request.json());
		const rows = body.rows as ParsedReferralRow[];

		if (rows.length === 0) {
			return successResponse({ imported: 0, unmatchedPartners: [], errors: [] });
		}

		// Fetch partners for name resolution
		const { data: partners } = await (supabase as any)
			.from("partner_engine_partners")
			.select("id, name")
			.eq("team_id", teamId);
		const partnerNameToId = buildPartnerNameToIdMap(partners ?? []);

		const slaContactBy = await getSlaContactBy(supabase, teamId);
		const errors: string[] = [];
		const unmatchedPartners = new Set<string>();
		let imported = 0;
		const batchSize = 50;

		for (let i = 0; i < rows.length; i += batchSize) {
			const batch = rows.slice(i, i + batchSize);
			const inserts = batch.map((row) => {
				let partnerId: string | null = null;
				if (row.partnerName && row.partnerName.trim()) {
					const key = row.partnerName.trim().toLowerCase();
					partnerId = partnerNameToId.get(key) ?? null;
					if (!partnerId) unmatchedPartners.add(row.partnerName.trim());
				}

				return {
					user_id: userId,
					team_id: teamId,
					partner_id: partnerId,
					homeowner_name: row.homeownerName ?? null,
					homeowner_phone: row.homeownerPhone ?? null,
					homeowner_email: row.homeownerEmail ?? null,
					property_address: row.propertyAddress,
					city: row.city ?? null,
					state: row.state ?? null,
					zip: row.zip ?? null,
					notes: row.notes ?? null,
					photo_urls: [],
					priority: row.priority ?? "normal",
					source: "manual",
					contract_value: 0,
					status: row.status ?? "received",
					sla_contact_by: slaContactBy?.toISOString() ?? null,
				};
			});

			const { error } = await (supabase as any)
				.from("partner_engine_referrals")
				.insert(inserts);

			if (error) {
				errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
			} else {
				imported += batch.length;
			}
		}

		return successResponse({
			imported,
			unmatchedPartners: Array.from(unmatchedPartners),
			errors,
		});
	} catch (error) {
		if (error instanceof z.ZodError) return errorResponse("Invalid payload", 400, { details: error.flatten() });
		return errorResponse(error instanceof Error ? error.message : "Failed to import referrals", 500);
	}
}
