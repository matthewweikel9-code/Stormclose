// ── Negotiation Coach Module ──────────────────────────────────────────────────

import type { AiContext } from "@/types/ai-context";
import { buildSystemSections } from "@/lib/ai/promptBuilder";

export type NegotiationScenario =
	| "initial_pricing"
	| "competitor_comparison"
	| "insurance_supplement"
	| "scope_reduction"
	| "payment_terms"
	| "adjuster_meeting"
	| "custom";

export interface NegotiationCoachParams {
	scenario: NegotiationScenario;
	houseId: string | null;
	situationDescription: string;
	homeownerConcern: string | null;
	competitorQuote: number | null;
	ourQuote: number | null;
	insuranceClaimAmount: number | null;
}

export interface NegotiationCoachOutput {
	strategy: string;
	talkingPoints: string[];
	avoidSaying: string[];
	pricingGuidance: {
		suggestedAnchorPrice: string | null;
		justification: string;
		concessionLadder: string[];
	} | null;
	closingTechnique: {
		name: string;
		script: string;
	};
	generatedAt: string;
	model: string;
	tokenCount: number;
}

export function buildNegotiationCoachPrompt(
	ctx: AiContext,
	params: NegotiationCoachParams,
): { system: string; user: string } {
	const contextSections = buildSystemSections(ctx);

	const system = [
		"You are a strategic negotiation coach for a roofing storm sales company.",
		"Provide pricing, scope, and insurance negotiation guidance tailored to the property and situation.",
		"You are NOT a price calculator — you are a strategic advisor.",
		'Output valid JSON: { strategy: string (markdown), talkingPoints: string[], avoidSaying: string[], pricingGuidance: { suggestedAnchorPrice, justification, concessionLadder: string[] } | null, closingTechnique: { name, script } }.',
		"Maximum 1200 tokens.",
		"",
		contextSections,
	].join("\n");

	const user = [
		`Scenario: ${params.scenario}`,
		`Situation: ${params.situationDescription}`,
		params.homeownerConcern ? `Homeowner concern: "${params.homeownerConcern}"` : null,
		params.competitorQuote ? `Competitor quote: $${params.competitorQuote.toLocaleString()}` : null,
		params.ourQuote ? `Our quote: $${params.ourQuote.toLocaleString()}` : null,
		params.insuranceClaimAmount
			? `Insurance claim amount: $${params.insuranceClaimAmount.toLocaleString()}`
			: null,
		"",
		"Return only valid JSON.",
	]
		.filter(Boolean)
		.join("\n");

	return { system, user };
}

export function parseNegotiationCoachOutput(
	raw: string,
	model: string,
	tokenCount: number,
): NegotiationCoachOutput {
	try {
		const parsed = JSON.parse(raw);
		return {
			strategy: String(parsed.strategy ?? raw),
			talkingPoints: Array.isArray(parsed.talkingPoints)
				? parsed.talkingPoints.map(String)
				: [],
			avoidSaying: Array.isArray(parsed.avoidSaying)
				? parsed.avoidSaying.map(String)
				: [],
			pricingGuidance: parsed.pricingGuidance
				? {
						suggestedAnchorPrice: parsed.pricingGuidance.suggestedAnchorPrice
							? String(parsed.pricingGuidance.suggestedAnchorPrice)
							: null,
						justification: String(parsed.pricingGuidance.justification ?? ""),
						concessionLadder: Array.isArray(parsed.pricingGuidance.concessionLadder)
							? parsed.pricingGuidance.concessionLadder.map(String)
							: [],
					}
				: null,
			closingTechnique: {
				name: String(parsed.closingTechnique?.name ?? "Direct Ask"),
				script: String(parsed.closingTechnique?.script ?? ""),
			},
			generatedAt: new Date().toISOString(),
			model,
			tokenCount,
		};
	} catch {
		return {
			strategy: raw,
			talkingPoints: [],
			avoidSaying: [],
			pricingGuidance: null,
			closingTechnique: { name: "Direct Ask", script: "" },
			generatedAt: new Date().toISOString(),
			model,
			tokenCount,
		};
	}
}
