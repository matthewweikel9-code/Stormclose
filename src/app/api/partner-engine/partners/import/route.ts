import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, successResponse } from "@/utils/api-response";
import { requirePartnerEngineAuth, requireAdmin } from "@/lib/partner-engine/auth";
import type { ParsedPartnerRow } from "@/lib/partner-engine/import-parser";

const PartnerTypeEnum = z.enum([
	"realtor",
	"insurance_agent",
	"home_inspector",
	"property_manager",
	"contractor",
	"other",
]);
const TierEnum = z.enum(["bronze", "silver", "gold", "platinum"]);

const PartnerRowSchema = z.object({
	name: z.string().min(1),
	businessName: z.string().optional().nullable(),
	email: z.string().optional().nullable(),
	phone: z.string().optional().nullable(),
	partnerType: PartnerTypeEnum.optional(),
	territory: z.string().optional().nullable(),
	city: z.string().optional().nullable(),
	state: z.string().optional().nullable(),
	zip: z.string().optional().nullable(),
	tier: TierEnum.optional(),
	notes: z.string().optional().nullable(),
});

const ImportBodySchema = z.object({
	rows: z.array(PartnerRowSchema).max(500),
});

function generateReferralCode(name: string) {
	const base = name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "partner";
	const suffix = Math.random().toString(36).slice(2, 8);
	return `${base}${suffix}`;
}

function generateInviteCode() {
	return `inv_${Math.random().toString(36).slice(2, 12)}`;
}

export async function POST(request: NextRequest) {
	try {
		const result = await requirePartnerEngineAuth();
		if (!result.ok) return errorResponse(result.error, result.status);
		const adminCheck = requireAdmin(result.auth);
		if (adminCheck) return errorResponse(adminCheck.error, adminCheck.status);

		const { supabase, userId, teamId } = result.auth;
		const body = ImportBodySchema.parse(await request.json());
		const rows = body.rows as ParsedPartnerRow[];

		if (rows.length === 0) {
			return successResponse({ imported: 0, errors: [] });
		}

		const errors: string[] = [];
		let imported = 0;
		const batchSize = 50;

		for (let i = 0; i < rows.length; i += batchSize) {
			const batch = rows.slice(i, i + batchSize);
			const inserts = batch.map((row) => ({
				user_id: userId,
				team_id: teamId,
				name: row.name,
				business_name: row.businessName ?? null,
				email: row.email ?? null,
				phone: row.phone ?? null,
				partner_type: row.partnerType ?? "other",
				referral_code: generateReferralCode(row.name),
				invite_code: generateInviteCode(),
				status: "active",
				tier: row.tier ?? "bronze",
				territory: row.territory ?? null,
				city: row.city ?? null,
				state: row.state ?? null,
				zip: row.zip ?? null,
				notes: row.notes ?? null,
				tags: [],
			}));

			const { error } = await (supabase as any)
				.from("partner_engine_partners")
				.insert(inserts);

			if (error) {
				errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
			} else {
				imported += batch.length;
			}
		}

		return successResponse({ imported, errors });
	} catch (error) {
		if (error instanceof z.ZodError) return errorResponse("Invalid payload", 400, { details: error.flatten() });
		return errorResponse(error instanceof Error ? error.message : "Failed to import partners", 500);
	}
}
