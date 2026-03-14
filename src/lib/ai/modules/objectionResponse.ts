// ── Objection Response Assistant Module ───────────────────────────────────────

import type { AiContext } from "@/types/ai-context";
import { buildSystemSections } from "@/lib/ai/promptBuilder";

export type ObjectionCategory =
	| "price"
	| "trust"
	| "timing"
	| "process"
	| "competition"
	| "insurance"
	| "decision";

export interface ObjectionResponseParams {
	objection: string;
	category: ObjectionCategory | null;
	templateId: string | null;
	homeownerName: string | null;
	projectType: string;
	keyBenefits: string[];
	evidencePoints: string[];
	tone: "consultative" | "confident" | "empathetic";
}

export interface ObjectionResponseOutput {
	response: string;
	framework: {
		listen: string;
		acknowledge: string;
		explore: string;
		respond: string;
	};
	shortVersion: string;
	followUpQuestion: string;
	generatedAt: string;
	model: string;
	tokenCount: number;
}

export function buildObjectionResponsePrompt(
	ctx: AiContext,
	params: ObjectionResponseParams,
): { system: string; user: string } {
	const contextSections = buildSystemSections(ctx);

	const system = [
		"You are a master roofing sales closer trained in the LAER objection handling framework.",
		"LAER = Listen → Acknowledge → Explore → Respond.",
		"Generate a contextual response to a homeowner objection.",
		'Output valid JSON: { response: string (full natural response), framework: { listen, acknowledge, explore, respond }, shortVersion: string (under 50 words for texting), followUpQuestion: string }.',
		"Maximum 600 tokens.",
		"",
		contextSections,
	].join("\n");

	const user = [
		`Tone: ${params.tone.toUpperCase()}`,
		params.homeownerName ? `Homeowner: ${params.homeownerName}` : null,
		`Project Type: ${params.projectType}`,
		params.category ? `Objection Category: ${params.category}` : null,
		"",
		`THE OBJECTION: "${params.objection}"`,
		"",
		`Key Benefits: ${params.keyBenefits.join("; ")}`,
		params.evidencePoints.length > 0
			? `Evidence Points: ${params.evidencePoints.join("; ")}`
			: null,
		"",
		"Return only valid JSON.",
	]
		.filter(Boolean)
		.join("\n");

	return { system, user };
}

export function parseObjectionResponseOutput(
	raw: string,
	model: string,
	tokenCount: number,
): ObjectionResponseOutput {
	try {
		const parsed = JSON.parse(raw);
		return {
			response: String(parsed.response ?? raw),
			framework: {
				listen: String(parsed.framework?.listen ?? ""),
				acknowledge: String(parsed.framework?.acknowledge ?? ""),
				explore: String(parsed.framework?.explore ?? ""),
				respond: String(parsed.framework?.respond ?? ""),
			},
			shortVersion: String(parsed.shortVersion ?? ""),
			followUpQuestion: String(parsed.followUpQuestion ?? ""),
			generatedAt: new Date().toISOString(),
			model,
			tokenCount,
		};
	} catch {
		return {
			response: raw,
			framework: { listen: "", acknowledge: "", explore: "", respond: "" },
			shortVersion: "",
			followUpQuestion: "",
			generatedAt: new Date().toISOString(),
			model,
			tokenCount,
		};
	}
}
