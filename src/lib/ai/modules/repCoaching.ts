// ── Rep Coaching Insights Module ──────────────────────────────────────────────

import type { AiContext } from "@/types/ai-context";
import { buildSystemSections } from "@/lib/ai/promptBuilder";

export type CoachingTimeframe = "today" | "7d" | "30d" | "90d";

export interface RepCoachingParams {
	repId: string;
	timeframe: CoachingTimeframe;
	focusArea:
		| "pace"
		| "conversion"
		| "objection_handling"
		| "route_efficiency"
		| "general"
		| null;
}

export interface RepCoachingOutput {
	executiveSummary: string;
	strengths: Array<{
		area: string;
		observation: string;
		metric: string;
	}>;
	improvements: Array<{
		area: string;
		observation: string;
		metric: string;
		actionItem: string;
	}>;
	coachingActions: Array<{
		priority: 1 | 2 | 3;
		action: string;
		expectedImpact: string;
	}>;
	trend: "improving" | "stable" | "declining";
	generatedAt: string;
	model: string;
	tokenCount: number;
}

export function buildRepCoachingPrompt(
	ctx: AiContext,
	params: RepCoachingParams,
): { system: string; user: string } {
	const contextSections = buildSystemSections(ctx);

	const system = [
		"You are an AI sales performance coach for a roofing storm sales company.",
		"Analyze a rep's performance patterns and generate actionable coaching recommendations.",
		'Output valid JSON: { executiveSummary: string (2-3 sentences), strengths: Array<{ area, observation, metric }>, improvements: Array<{ area, observation, metric, actionItem }>, coachingActions: Array<{ priority: 1|2|3, action, expectedImpact }>, trend: "improving"|"stable"|"declining" }.',
		"Maximum 1500 tokens.",
		"",
		contextSections,
	].join("\n");

	const user = [
		`Analyze rep ${params.repId} performance over ${params.timeframe}.`,
		params.focusArea ? `Focus on: ${params.focusArea}` : "General performance review.",
		"Return only valid JSON.",
	].join("\n");

	return { system, user };
}

export function parseRepCoachingOutput(
	raw: string,
	model: string,
	tokenCount: number,
): RepCoachingOutput {
	try {
		const parsed = JSON.parse(raw);
		return {
			executiveSummary: String(parsed.executiveSummary ?? raw),
			strengths: Array.isArray(parsed.strengths)
				? parsed.strengths.map((s: Record<string, unknown>) => ({
						area: String(s.area ?? ""),
						observation: String(s.observation ?? ""),
						metric: String(s.metric ?? ""),
					}))
				: [],
			improvements: Array.isArray(parsed.improvements)
				? parsed.improvements.map((i: Record<string, unknown>) => ({
						area: String(i.area ?? ""),
						observation: String(i.observation ?? ""),
						metric: String(i.metric ?? ""),
						actionItem: String(i.actionItem ?? ""),
					}))
				: [],
			coachingActions: Array.isArray(parsed.coachingActions)
				? parsed.coachingActions.map((a: Record<string, unknown>) => ({
						priority: [1, 2, 3].includes(Number(a.priority)) ? (Number(a.priority) as 1 | 2 | 3) : 2,
						action: String(a.action ?? ""),
						expectedImpact: String(a.expectedImpact ?? ""),
					}))
				: [],
			trend: (["improving", "stable", "declining"].includes(String(parsed.trend))
				? parsed.trend
				: "stable") as "improving" | "stable" | "declining",
			generatedAt: new Date().toISOString(),
			model,
			tokenCount,
		};
	} catch {
		return {
			executiveSummary: raw,
			strengths: [],
			improvements: [],
			coachingActions: [],
			trend: "stable",
			generatedAt: new Date().toISOString(),
			model,
			tokenCount,
		};
	}
}
