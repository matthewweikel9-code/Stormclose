// ── Storm Zone Summary Module ─────────────────────────────────────────────────

import type { AiContext } from "@/types/ai-context";
import { buildSystemSections } from "@/lib/ai/promptBuilder";

export interface ZoneSummaryParams {
	stormZoneId: string;
	includeCompetitiveLandscape: boolean;
	includeRevenueProjection: boolean;
	includeDeploymentRecommendation: boolean;
	audience: "manager" | "owner" | "team_meeting" | "document";
}

export interface ZoneSummaryOutput {
	narrative: string;
	keyStats: Array<{
		label: string;
		value: string;
		context: string;
	}>;
	deploymentRecommendation: {
		suggestedTeamSize: number;
		estimatedDays: number;
		priorityAreas: string[];
		reasoning: string;
	} | null;
	revenueProjection: {
		lowEstimate: number;
		midEstimate: number;
		highEstimate: number;
		assumptions: string[];
	} | null;
	urgencyScore: number;
	urgencyRationale: string;
	generatedAt: string;
	model: string;
	tokenCount: number;
}

export function buildZoneSummaryPrompt(
	ctx: AiContext,
	params: ZoneSummaryParams,
): { system: string; user: string } {
	const contextSections = buildSystemSections(ctx);

	const audienceInstructions: Record<ZoneSummaryParams["audience"], string> = {
		manager:
			"Write for a branch manager. Focus on actionable decisions: team deployment, timing, and priority areas.",
		owner:
			"Write for a company owner. Focus on revenue potential, ROI, and strategic positioning vs competitors.",
		team_meeting:
			"Write for a team meeting briefing. Keep it motivating and clear. Highlight the opportunity and specific action items.",
		document:
			"Write for a formal document. Professional tone, complete details, suitable for printing or sharing.",
	};

	const system = [
		"You are an AI storm intelligence analyst for a roofing storm sales company.",
		"Generate a narrative summary of a storm zone's opportunity.",
		audienceInstructions[params.audience],
		'Output valid JSON: { narrative: string (markdown, 3-5 paragraphs), keyStats: Array<{ label, value, context }>, deploymentRecommendation: { suggestedTeamSize, estimatedDays, priorityAreas: string[], reasoning } | null, revenueProjection: { lowEstimate, midEstimate, highEstimate, assumptions: string[] } | null, urgencyScore: number (0-100), urgencyRationale: string }.',
		"Maximum 1500 tokens.",
		"",
		contextSections,
	].join("\n");

	const user = [
		`Generate a zone summary for storm zone ${params.stormZoneId}.`,
		`Audience: ${params.audience}`,
		params.includeCompetitiveLandscape
			? "Include competitive landscape estimate."
			: null,
		params.includeRevenueProjection ? "Include revenue projections." : null,
		params.includeDeploymentRecommendation
			? "Include deployment recommendation with team size and timeline."
			: null,
		"",
		"Return only valid JSON.",
	]
		.filter(Boolean)
		.join("\n");

	return { system, user };
}

export function parseZoneSummaryOutput(
	raw: string,
	model: string,
	tokenCount: number,
): ZoneSummaryOutput {
	try {
		const parsed = JSON.parse(raw);
		return {
			narrative: String(parsed.narrative ?? raw),
			keyStats: Array.isArray(parsed.keyStats)
				? parsed.keyStats.map((s: Record<string, unknown>) => ({
						label: String(s.label ?? ""),
						value: String(s.value ?? ""),
						context: String(s.context ?? ""),
					}))
				: [],
			deploymentRecommendation: parsed.deploymentRecommendation
				? {
						suggestedTeamSize: Number(parsed.deploymentRecommendation.suggestedTeamSize ?? 2),
						estimatedDays: Number(parsed.deploymentRecommendation.estimatedDays ?? 3),
						priorityAreas: Array.isArray(parsed.deploymentRecommendation.priorityAreas)
							? parsed.deploymentRecommendation.priorityAreas.map(String)
							: [],
						reasoning: String(parsed.deploymentRecommendation.reasoning ?? ""),
					}
				: null,
			revenueProjection: parsed.revenueProjection
				? {
						lowEstimate: Number(parsed.revenueProjection.lowEstimate ?? 0),
						midEstimate: Number(parsed.revenueProjection.midEstimate ?? 0),
						highEstimate: Number(parsed.revenueProjection.highEstimate ?? 0),
						assumptions: Array.isArray(parsed.revenueProjection.assumptions)
							? parsed.revenueProjection.assumptions.map(String)
							: [],
					}
				: null,
			urgencyScore: Math.min(100, Math.max(0, Number(parsed.urgencyScore ?? 50))),
			urgencyRationale: String(parsed.urgencyRationale ?? ""),
			generatedAt: new Date().toISOString(),
			model,
			tokenCount,
		};
	} catch {
		return {
			narrative: raw,
			keyStats: [],
			deploymentRecommendation: null,
			revenueProjection: null,
			urgencyScore: 50,
			urgencyRationale: "",
			generatedAt: new Date().toISOString(),
			model,
			tokenCount,
		};
	}
}
