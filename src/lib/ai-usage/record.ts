/**
 * Record AI usage for metering (Phase 4)
 */

import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
	process.env.NEXT_PUBLIC_SUPABASE_URL!,
	process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type AIFeature =
	| "supplement"
	| "supplement_unified"
	| "negotiation"
	| "briefing"
	| "storm_briefing"
	| "storm_pipeline"
	| "objection"
	| "estimate_ocr"
	| "xactimate_analyze"
	| "voice_notes"
	| "post_call"
	| "pre_brief"
	| "coaching_digest";

export async function recordAIUsage(params: {
	userId: string;
	teamId?: string | null;
	feature: AIFeature;
	tokenCount?: number;
}): Promise<void> {
	try {
		const today = new Date().toISOString().split("T")[0];
		await supabaseAdmin.from("ai_usage_records").insert({
			user_id: params.userId,
			team_id: params.teamId ?? null,
			feature: params.feature,
			token_count: params.tokenCount ?? 0,
			request_count: 1,
			created_at: today,
		});
	} catch {
		// Non-blocking; table may not exist yet
	}
}
