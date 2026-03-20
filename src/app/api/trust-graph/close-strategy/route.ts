import { NextRequest } from "next/server";
import { errorResponse, successResponse } from "@/utils/api-response";
import { requirePartnerEngineAuth } from "@/lib/partner-engine/auth";

const SOURCE_STRATEGIES: Record<string, { opener: string; objection: string; rebuttal: string; urgency: string }> = {
	realtor: {
		opener: "You were referred by [Partner] — they know we move fast and keep things clean for closings. We're here to help with your roof. Can we schedule a quick inspection this week?",
		objection: "I'm not sure I need a new roof right now.",
		rebuttal: "Totally understand. The inspection is free and takes about 15 minutes. [Partner] referred you because they've seen our work and trust us. We'll give you a clear picture — no pressure.",
		urgency: "Speed and clean process.",
	},
	insurance_agent: {
		opener: "You were referred by [Partner], your insurance professional. They know we handle documentation and claims professionally. We'd like to schedule a free inspection to assess your roof.",
		objection: "I'm worried about my insurance rates going up.",
		rebuttal: "Storm damage is a covered peril — filing a claim for storm damage typically doesn't penalize you. [Partner] referred you because they've seen our work with insurance companies. We document everything properly.",
		urgency: "Documentation and professionalism.",
	},
	property_manager: {
		opener: "You were referred by [Partner], your property manager. They know we work efficiently with tenants and owners. We're here to help with your roof — can we schedule an inspection?",
		objection: "I need to check with the owner first.",
		rebuttal: "Of course. [Partner] referred you because they trust our process. We can provide a summary for the owner and work around tenant schedules.",
		urgency: "Efficiency and coordination.",
	},
	home_inspector: {
		opener: "You were referred by [Partner], who inspected your property. They know we address the issues they flag. We'd like to schedule a follow-up to assess your roof.",
		objection: "The inspector said it might be minor.",
		rebuttal: "We'll give you a clear assessment. [Partner] referred you because they've seen our work. If it's minor, we'll tell you. If it's more, we'll help you understand your options.",
		urgency: "Accuracy and follow-through.",
	},
	contractor: {
		opener: "You were referred by [Partner], a contractor who knows our work. We're here to help with your roof. Can we schedule a free inspection?",
		objection: "I'm not sure I need a roofer.",
		rebuttal: "[Partner] referred you because they've seen our quality and process. They wouldn't send you our way if they didn't think we could help. Let's take a look — no obligation.",
		urgency: "Quality and trust.",
	},
	other: {
		opener: "You were referred by [Partner] — someone who trusts our work. We're here to help with your roof. Can we schedule a free inspection?",
		objection: "I need to think about it.",
		rebuttal: "Of course. [Partner] referred you because they've seen our results. The inspection is free and takes about 15 minutes. We'll give you a clear picture so you can decide.",
		urgency: "Trust and results.",
	},
};

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
			.select("id,partner_id,homeowner_name,property_address,status,partner_engine_partners(name,partner_type)")
			.eq("id", referralId)
			.eq("team_id", teamId)
			.single();

		if (refError || !ref) return errorResponse("Referral not found", 404);

		const r = ref as Record<string, unknown>;
		const partner = r.partner_engine_partners as Record<string, unknown> | null;
		const partnerName = partner && typeof partner === "object" ? (partner.name as string) : "Your referral partner";
		const partnerType = partner && typeof partner === "object" ? (partner.partner_type as string) : "other";

		const strategy = SOURCE_STRATEGIES[partnerType] ?? SOURCE_STRATEGIES.other;
		const opener = strategy.opener.replace("[Partner]", partnerName);
		const rebuttal = strategy.rebuttal.replace("[Partner]", partnerName);
		const status = String(r.status ?? "received");

		const recommendedAction =
			status === "received"
				? "Contact within 24 hours. Schedule inspection."
				: status === "contacted"
					? "Follow up with inspection scheduling."
					: "Move to next stage in pipeline.";

		const closeStrategy = {
			firstCallScript: opener,
			likelyObjection: strategy.objection,
			rebuttal,
			urgencyAngle: strategy.urgency,
			credibilityAngle: `Referral from ${partnerName} — leverage their trust.`,
			recommendedAction,
		};

		return successResponse(closeStrategy);
	} catch (error) {
		return errorResponse(error instanceof Error ? error.message : "Failed to generate close strategy", 500);
	}
}
