// ── Mission Copilot Module ────────────────────────────────────────────────────

import type { AiContext } from "@/types/ai-context";
import { buildSystemSections } from "@/lib/ai/promptBuilder";

export type CopilotSuggestionType =
	| "next_stop_prep"
	| "pace_check"
	| "reroute_suggestion"
	| "talking_points"
	| "zone_summary";

export interface MissionCopilotParams {
	suggestionType: CopilotSuggestionType;
	missionId: string;
	currentStopId: string | null;
	repQuestion: string | null;
}

export interface MissionCopilotOutput {
	suggestionType: CopilotSuggestionType;
	suggestion: string;
	talkingPoints: string[] | null;
	paceAnalysis: {
		currentDoorsPerHour: number;
		targetDoorsPerHour: number;
		projectedCompletion: string;
		suggestion: string;
	} | null;
	generatedAt: string;
	model: string;
	tokenCount: number;
}

export function buildMissionCopilotPrompt(
	ctx: AiContext,
	params: MissionCopilotParams,
): { system: string; user: string } {
	const contextSections = buildSystemSections(ctx);

	const typeInstructions: Record<CopilotSuggestionType, string> = {
		next_stop_prep:
			"Prepare the rep for the next stop. Include property-specific talking points, storm damage context, and suggested opening line.",
		pace_check:
			"Analyze the rep's current pace vs target. Output JSON with: currentDoorsPerHour, targetDoorsPerHour, projectedCompletion, suggestion.",
		reroute_suggestion:
			"Suggest a route adjustment based on current position and remaining stops.",
		talking_points:
			"Generate 5-7 property-specific talking points for the current stop, covering storm damage, insurance, and value proposition.",
		zone_summary:
			"Summarize the remaining opportunity in the current zone: unworked houses, priority areas, estimated time to completion.",
	};

	const system = [
		"You are an AI field sales copilot for a roofing storm sales company.",
		"You provide real-time suggestions during active missions.",
		typeInstructions[params.suggestionType],
		'Output valid JSON: { suggestion: string (markdown), talkingPoints: string[] | null, paceAnalysis: { currentDoorsPerHour, targetDoorsPerHour, projectedCompletion, suggestion } | null }.',
		"Maximum 800 tokens.",
		"",
		contextSections,
	].join("\n");

	const user = [
		`Suggestion type: ${params.suggestionType}`,
		`Mission ID: ${params.missionId}`,
		params.currentStopId ? `Current stop: ${params.currentStopId}` : null,
		params.repQuestion ? `Rep question: "${params.repQuestion}"` : null,
		"Return only valid JSON.",
	]
		.filter(Boolean)
		.join("\n");

	return { system, user };
}

export function parseMissionCopilotOutput(
	raw: string,
	params: MissionCopilotParams,
	model: string,
	tokenCount: number,
): MissionCopilotOutput {
	try {
		const parsed = JSON.parse(raw);
		return {
			suggestionType: params.suggestionType,
			suggestion: String(parsed.suggestion ?? raw),
			talkingPoints: Array.isArray(parsed.talkingPoints)
				? parsed.talkingPoints.map(String)
				: null,
			paceAnalysis: parsed.paceAnalysis
				? {
						currentDoorsPerHour: Number(parsed.paceAnalysis.currentDoorsPerHour ?? 0),
						targetDoorsPerHour: Number(parsed.paceAnalysis.targetDoorsPerHour ?? 15),
						projectedCompletion: String(parsed.paceAnalysis.projectedCompletion ?? ""),
						suggestion: String(parsed.paceAnalysis.suggestion ?? ""),
					}
				: null,
			generatedAt: new Date().toISOString(),
			model,
			tokenCount,
		};
	} catch {
		return {
			suggestionType: params.suggestionType,
			suggestion: raw,
			talkingPoints: null,
			paceAnalysis: null,
			generatedAt: new Date().toISOString(),
			model,
			tokenCount,
		};
	}
}
