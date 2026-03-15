// ── Export Summary Writer Module ──────────────────────────────────────────────

import type { AiContext } from "@/types/ai-context";
import { buildSystemSections } from "@/lib/ai/promptBuilder";

export interface ExportSummaryParams {
	houseId: string;
	exportId: string | null;
	includeStormEvidence: boolean;
	includeVisitTimeline: boolean;
	customNotes: string | null;
}

export interface ExportSummaryOutput {
	summary: string;
	crmFields: {
		contactName: string;
		contactPhone: string | null;
		contactEmail: string | null;
		propertyAddress: string;
		leadSource: string;
		estimatedValue: string;
		stormEvent: string;
		damageType: string;
		interestLevel: "high" | "medium" | "low";
		nextAction: string;
		appointmentDate: string | null;
	};
	visitTimeline: Array<{
		timestamp: string;
		action: string;
		outcome: string;
	}>;
	generatedAt: string;
	model: string;
	tokenCount: number;
}

export function buildExportSummaryPrompt(
	ctx: AiContext,
	params: ExportSummaryParams,
): { system: string; user: string } {
	const contextSections = buildSystemSections(ctx);

	const system = [
		"You are an AI export specialist for a roofing storm sales company.",
		"Generate a structured handoff summary for a qualified opportunity being exported to JobNimbus (CRM).",
		"The summary must be comprehensive yet concise — it will be attached as a note in the CRM record.",
		'Output valid JSON: { summary: string (plain text), crmFields: { contactName, contactPhone, contactEmail, propertyAddress, leadSource, estimatedValue, stormEvent, damageType, interestLevel, nextAction, appointmentDate }, visitTimeline: Array<{ timestamp, action, outcome }> }.',
		"Maximum 1000 tokens.",
		"",
		contextSections,
	].join("\n");

	const user = [
		`Generate export summary for house ${params.houseId}.`,
		params.includeStormEvidence
			? "Include storm damage evidence (hail size, wind speed, damage indicators)."
			: null,
		params.includeVisitTimeline ? "Include visit timeline with timestamps." : null,
		params.customNotes ? `Additional notes: ${params.customNotes}` : null,
		"",
		"Return only valid JSON.",
	]
		.filter(Boolean)
		.join("\n");

	return { system, user };
}

export function parseExportSummaryOutput(
	raw: string,
	model: string,
	tokenCount: number,
): ExportSummaryOutput {
	try {
		const parsed = JSON.parse(raw);
		return {
			summary: String(parsed.summary ?? raw),
			crmFields: {
				contactName: String(parsed.crmFields?.contactName ?? "Unknown"),
				contactPhone: parsed.crmFields?.contactPhone
					? String(parsed.crmFields.contactPhone)
					: null,
				contactEmail: parsed.crmFields?.contactEmail
					? String(parsed.crmFields.contactEmail)
					: null,
				propertyAddress: String(parsed.crmFields?.propertyAddress ?? ""),
				leadSource: String(parsed.crmFields?.leadSource ?? "Stormclose AI"),
				estimatedValue: String(parsed.crmFields?.estimatedValue ?? "Unknown"),
				stormEvent: String(parsed.crmFields?.stormEvent ?? "Unknown"),
				damageType: String(parsed.crmFields?.damageType ?? "Unknown"),
				interestLevel: (["high", "medium", "low"].includes(parsed.crmFields?.interestLevel)
					? parsed.crmFields.interestLevel
					: "medium") as "high" | "medium" | "low",
				nextAction: String(parsed.crmFields?.nextAction ?? "Follow up"),
				appointmentDate: parsed.crmFields?.appointmentDate
					? String(parsed.crmFields.appointmentDate)
					: null,
			},
			visitTimeline: Array.isArray(parsed.visitTimeline)
				? parsed.visitTimeline.map((v: Record<string, unknown>) => ({
						timestamp: String(v.timestamp ?? ""),
						action: String(v.action ?? ""),
						outcome: String(v.outcome ?? ""),
					}))
				: [],
			generatedAt: new Date().toISOString(),
			model,
			tokenCount,
		};
	} catch {
		return {
			summary: raw,
			crmFields: {
				contactName: "Unknown",
				contactPhone: null,
				contactEmail: null,
				propertyAddress: "",
				leadSource: "Stormclose AI",
				estimatedValue: "Unknown",
				stormEvent: "Unknown",
				damageType: "Unknown",
				interestLevel: "medium",
				nextAction: "Follow up",
				appointmentDate: null,
			},
			visitTimeline: [],
			generatedAt: new Date().toISOString(),
			model,
			tokenCount,
		};
	}
}
