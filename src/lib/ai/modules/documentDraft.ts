import type { AiContext } from "@/types/ai-context";
import type {
	DocumentType,
	DocumentTypeConfig,
	DocumentFormat,
} from "@/types/documents";
import { buildSystemSections } from "@/lib/ai/promptBuilder";

export const DOCUMENT_TYPE_CONFIGS: Record<DocumentType, DocumentTypeConfig> = {
	homeowner_follow_up_letter: {
		type: "homeowner_follow_up_letter",
		label: "Homeowner Follow-Up Letter",
		defaultTitle: "Homeowner Follow-Up Letter",
		defaultFormat: "pdf",
		maxWords: 420,
	},
	neighborhood_flyer: {
		type: "neighborhood_flyer",
		label: "Neighborhood Flyer",
		defaultTitle: "Neighborhood Storm Flyer",
		defaultFormat: "pdf",
		maxWords: 180,
	},
	storm_impact_summary: {
		type: "storm_impact_summary",
		label: "Storm Impact Summary",
		defaultTitle: "Storm Impact Summary",
		defaultFormat: "pdf",
		maxWords: 620,
	},
	mission_recap: {
		type: "mission_recap",
		label: "Mission Recap",
		defaultTitle: "Mission Recap",
		defaultFormat: "pdf",
		maxWords: 520,
	},
	manager_daily_summary: {
		type: "manager_daily_summary",
		label: "Manager Daily Summary",
		defaultTitle: "Manager Daily Summary",
		defaultFormat: "pdf",
		maxWords: 520,
	},
	office_summary: {
		type: "office_summary",
		label: "Office Summary",
		defaultTitle: "Office Summary",
		defaultFormat: "pdf",
		maxWords: 820,
	},
	qualified_opportunity_handoff: {
		type: "qualified_opportunity_handoff",
		label: "Qualified Opportunity Handoff Sheet",
		defaultTitle: "Qualified Opportunity Handoff",
		defaultFormat: "pdf",
		maxWords: 380,
	},
	claim_explanation_letter: {
		type: "claim_explanation_letter",
		label: "Claim Explanation Letter",
		defaultTitle: "Claim Explanation Letter",
		defaultFormat: "pdf",
		maxWords: 480,
	},
	leave_behind: {
		type: "leave_behind",
		label: "Leave-Behind Document",
		defaultTitle: "Leave-Behind Notice",
		defaultFormat: "pdf",
		maxWords: 160,
	},
	rep_field_recap: {
		type: "rep_field_recap",
		label: "Rep Field Recap",
		defaultTitle: "Rep Field Recap",
		defaultFormat: "clipboard",
		maxWords: 260,
	},
};

const DOCUMENT_TYPE_PROMPTS: Record<DocumentType, string> = {
	homeowner_follow_up_letter:
		"Write a personalized follow-up letter for a homeowner after a roofing field visit with clear next steps.",
	neighborhood_flyer:
		"Write a concise neighborhood flyer highlighting the recent storm event and free inspection offer.",
	storm_impact_summary:
		"Write a data-driven storm impact summary with severity, risk, and recommended actions.",
	mission_recap:
		"Write an operational mission recap with outcomes, metrics, and follow-up actions.",
	manager_daily_summary:
		"Write an end-of-day manager summary with key KPIs, wins, and tomorrow priorities.",
	office_summary:
		"Write an internal office summary for weekly operational review.",
	qualified_opportunity_handoff:
		"Write a concise, CRM-ready handoff summary for a qualified opportunity export.",
	claim_explanation_letter:
		"Write an educational claim explanation letter for a homeowner unfamiliar with storm claim steps.",
	leave_behind:
		"Write a short leave-behind notice suitable for print at a no-answer door.",
	rep_field_recap:
		"Write a concise rep field recap highlighting doors, outcomes, and next follow-ups.",
};

export interface DocumentDraftParams {
	documentType: DocumentType;
	format: DocumentFormat;
	contextType: string;
	contextId: string;
	overrides?: Record<string, string>;
}

export interface DocumentDraftOutput {
	title: string;
	content: string;
	wordCount: number;
	generatedAt: string;
	model: string;
	tokenCount: number;
}

export function buildDocumentDraftPrompt(
	ctx: AiContext,
	params: DocumentDraftParams,
): { system: string; user: string } {
	const config = DOCUMENT_TYPE_CONFIGS[params.documentType];
	const contextSections = buildSystemSections(ctx);
	const overrideText = Object.entries(params.overrides ?? {})
		.map(([key, value]) => `- ${key}: ${value}`)
		.join("\n");

	const system = [
		"You are an expert roofing operations copywriter for Stormclose.",
		DOCUMENT_TYPE_PROMPTS[params.documentType],
		`Target output format: ${params.format}.`,
		`Keep the response under ${config.maxWords} words.`,
		"Return valid JSON only as: { title: string, content: string }",
		"No markdown code fences.",
		"",
		contextSections,
	].join("\n");

	const user = [
		`Document type: ${params.documentType}`,
		`Context type: ${params.contextType}`,
		`Context id: ${params.contextId}`,
		overrideText ? "Overrides:\n" + overrideText : null,
	].filter(Boolean).join("\n\n");

	return { system, user };
}

export function parseDocumentDraftOutput(
	raw: string,
	params: DocumentDraftParams,
	model: string,
	tokenCount: number,
): DocumentDraftOutput {
	const fallbackTitle = DOCUMENT_TYPE_CONFIGS[params.documentType].defaultTitle;

	try {
		const parsed = JSON.parse(raw);
		const content = String(parsed.content ?? raw);
		return {
			title: String(parsed.title ?? fallbackTitle),
			content,
			wordCount: content.split(/\s+/).filter(Boolean).length,
			generatedAt: new Date().toISOString(),
			model,
			tokenCount,
		};
	} catch {
		return {
			title: fallbackTitle,
			content: raw,
			wordCount: raw.split(/\s+/).filter(Boolean).length,
			generatedAt: new Date().toISOString(),
			model,
			tokenCount,
		};
	}
}
