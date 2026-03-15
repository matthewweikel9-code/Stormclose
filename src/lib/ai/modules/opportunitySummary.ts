// ── Opportunity Summary Generator Module ─────────────────────────────────────

import type { AiContext, AiOutputFormat } from "@/types/ai-context";
import { buildSystemSections } from "@/lib/ai/promptBuilder";

export interface OpportunitySummaryParams {
	houseId: string;
	includeInsuranceContext: boolean;
	includeStormEvidence: boolean;
	customSections: string[];
	outputFormat: AiOutputFormat;
}

export interface OpportunitySummaryOutput {
	content: string;
	sections: Array<{ heading: string; body: string }>;
	keyMetrics: {
		estimatedValue: string;
		stormSeverity: string;
		roofAge: string;
		interestLevel: string;
	};
	generatedAt: string;
	model: string;
	tokenCount: number;
}

export function buildOpportunitySummaryPrompt(
	ctx: AiContext,
	params: OpportunitySummaryParams,
): { system: string; user: string } {
	const contextSections = buildSystemSections(ctx);

	const system = [
		"You are an AI opportunity analyst for a roofing storm sales company.",
		"Generate a comprehensive opportunity writeup for a qualified prospect.",
		"The summary will be used for internal handoff, document generation, or export to a CRM.",
		'Output valid JSON: { content: string (full writeup in markdown), sections: Array<{ heading, body }>, keyMetrics: { estimatedValue, stormSeverity, roofAge, interestLevel } }.',
		"Maximum 2000 tokens.",
		"",
		contextSections,
	].join("\n");

	const userLines = [
		`Generate an opportunity summary for house ${params.houseId}.`,
		`Output format: ${params.outputFormat}`,
		params.includeInsuranceContext
			? "Include insurance claim context and carrier-specific details."
			: null,
		params.includeStormEvidence
			? "Include storm damage evidence: hail size, wind speed, test square data."
			: null,
		params.customSections.length > 0
			? `Include these additional sections: ${params.customSections.join(", ")}`
			: null,
		"Return only valid JSON.",
	];

	return { system, user: userLines.filter(Boolean).join("\n") };
}

export function parseOpportunitySummaryOutput(
	raw: string,
	model: string,
	tokenCount: number,
): OpportunitySummaryOutput {
	try {
		const parsed = JSON.parse(raw);
		return {
			content: String(parsed.content ?? raw),
			sections: Array.isArray(parsed.sections)
				? parsed.sections.map((s: Record<string, unknown>) => ({
						heading: String(s.heading ?? ""),
						body: String(s.body ?? ""),
					}))
				: [],
			keyMetrics: {
				estimatedValue: String(parsed.keyMetrics?.estimatedValue ?? "Unknown"),
				stormSeverity: String(parsed.keyMetrics?.stormSeverity ?? "Unknown"),
				roofAge: String(parsed.keyMetrics?.roofAge ?? "Unknown"),
				interestLevel: String(parsed.keyMetrics?.interestLevel ?? "Unknown"),
			},
			generatedAt: new Date().toISOString(),
			model,
			tokenCount,
		};
	} catch {
		return {
			content: raw,
			sections: [],
			keyMetrics: {
				estimatedValue: "Unknown",
				stormSeverity: "Unknown",
				roofAge: "Unknown",
				interestLevel: "Unknown",
			},
			generatedAt: new Date().toISOString(),
			model,
			tokenCount,
		};
	}
}
