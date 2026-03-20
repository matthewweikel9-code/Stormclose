import { NextRequest } from "next/server";
import { errorResponse, successResponse } from "@/utils/api-response";
import { requirePartnerEngineAuth } from "@/lib/partner-engine/auth";
import { fetchRoofDataForNotes } from "@/lib/solar/solarApi";

export async function POST(request: NextRequest) {
	try {
		const result = await requirePartnerEngineAuth();
		if (!result.ok) return errorResponse(result.error, result.status);

		const { teamId } = result.auth;
		const body = (await request.json()) as { referralId?: string };
		const { referralId } = body;

		if (!referralId) return errorResponse("referralId is required", 400);

		const { supabase } = result.auth;

		const { data: ref, error: refError } = await (supabase as any)
			.from("partner_engine_referrals")
			.select("id,partner_id,homeowner_name,property_address,city,state,zip,notes,status,partner_engine_partners(name,partner_type)")
			.eq("id", referralId)
			.eq("team_id", teamId)
			.single();

		if (refError || !ref) return errorResponse("Referral not found", 404);

		const r = ref as Record<string, unknown>;
		const partner = r.partner_engine_partners as Record<string, unknown> | null;
		const partnerName = partner && typeof partner === "object" ? (partner.name as string) : null;
		const partnerType = partner && typeof partner === "object" ? (partner.partner_type as string) : "other";

		const fullAddress = [r.property_address, r.city, r.state, r.zip].filter(Boolean).join(", ");
		const roofData = await fetchRoofDataForNotes(fullAddress || String(r.property_address ?? ""), 0, 0);

		const sourceLabel = partnerName || "Your trusted referral partner";
		const typeLabel =
			partnerType === "realtor"
				? "real estate professional"
				: partnerType === "insurance_agent"
					? "insurance professional"
					: partnerType === "property_manager"
						? "property manager"
						: "referral partner";

		const trustPack = {
			sourceName: partnerName,
			sourceLabel,
			personalizedIntro: `${r.homeowner_name ? `Hi ${String(r.homeowner_name).split(" ")[0]},` : "Hi,"} You were referred by ${sourceLabel} — a trusted ${typeLabel} who knows our work. We're here to help with your roof.`,
			companyCredibility: "StormClose is a trusted roofing partner with insurance documentation support, professional inspections, and a track record of successful claims.",
			propertyAddress: r.property_address,
			stormContext: roofData
				? `Property roof: ${roofData.totalSquares} squares (${roofData.totalAreaSqFt.toLocaleString()} sq ft). Estimated replacement range: $${roofData.costRange.low.toLocaleString()} - $${roofData.costRange.high.toLocaleString()}.`
				: null,
			estimateRange: roofData ? { low: roofData.costRange.low, high: roofData.costRange.high } : null,
			nextSteps: "We'll reach out shortly to schedule a free inspection. Reply to this message or call us to get started.",
			cta: "Schedule your free inspection",
		};

		return successResponse(trustPack);
	} catch (error) {
		return errorResponse(error instanceof Error ? error.message : "Failed to generate Trust Pack", 500);
	}
}
