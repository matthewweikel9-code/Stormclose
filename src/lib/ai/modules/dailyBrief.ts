// ── Daily Brief Generator Module ─────────────────────────────────────────────

import type { AiContext } from "@/types/ai-context";
import { buildSystemSections } from "@/lib/ai/promptBuilder";

export interface DailyBriefParams {
	briefDate: string;
	focusAreas: string | null;
	force: boolean;
}

export interface DailyBriefOutput {
	summary: string;
	highlights: Array<{
		category: "storm" | "mission" | "team" | "export" | "opportunity";
		text: string;
		href: string | null;
	}>;
	generatedAt: string;
	model: string;
	tokenCount: number;
}

export function buildDailyBriefPrompt(
	ctx: AiContext,
	params: DailyBriefParams,
): { system: string; user: string } {
	const contextSections = buildSystemSections(ctx);

	const system = [
		"You are an AI operations analyst for a roofing storm sales company.",
		"Generate a morning operations brief summarizing storm activity, mission status, team coverage, and export throughput.",
		"Output valid JSON matching this schema: { summary: string (markdown, 2-4 paragraphs), highlights: Array<{ category, text, href }> }.",
		"Categories: storm, mission, team, export, opportunity.",
		"Keep href null unless you can reference a real route.",
		"Maximum 1500 tokens in your response.",
		"",
		contextSections,
	].join("\n");

	const user = [
		`Generate the daily operations brief for ${params.briefDate}.`,
		params.focusAreas ? `Focus areas: ${params.focusAreas}` : null,
		"Return only valid JSON. No markdown code fences.",
	]
		.filter(Boolean)
		.join("\n");

	return { system, user };
}

export function parseDailyBriefOutput(
	raw: string,
	model: string,
	tokenCount: number,
): DailyBriefOutput {
	try {
		const parsed = JSON.parse(raw);
		return {
			summary: String(parsed.summary ?? raw),
			highlights: Array.isArray(parsed.highlights)
				? parsed.highlights.map((h: Record<string, unknown>) => ({
						category: String(h.category ?? "opportunity"),
						text: String(h.text ?? ""),
						href: h.href ? String(h.href) : null,
					}))
				: [],
			generatedAt: new Date().toISOString(),
			model,
			tokenCount,
		};
	} catch {
		return {
			summary: raw,
			highlights: [],
			generatedAt: new Date().toISOString(),
			model,
			tokenCount,
		};
	}
}
