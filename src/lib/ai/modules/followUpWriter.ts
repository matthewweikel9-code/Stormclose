// ── Follow-Up Writer Module ───────────────────────────────────────────────────

import type { AiContext } from "@/types/ai-context";
import { buildSystemSections } from "@/lib/ai/promptBuilder";

export type FollowUpChannel = "text" | "email" | "voicemail_script";

export type FollowUpSituation =
	| "post_inspection"
	| "waiting_insurance"
	| "quote_sent"
	| "ghosted"
	| "post_work"
	| "referral_request"
	| "no_answer_followup"
	| "custom";

export interface FollowUpWriterParams {
	situation: FollowUpSituation;
	channel: FollowUpChannel;
	houseId: string | null;
	homeownerName: string;
	lastInteraction: string;
	desiredNextAction: string;
	daysSinceLastContact: number;
	touchNumber: number;
	customInstructions: string | null;
}

export interface FollowUpWriterOutput {
	message: string;
	subjectLine: string | null;
	channel: FollowUpChannel;
	wordCount: number;
	suggestedSendTime: string;
	nextTouchSuggestion: {
		day: number;
		channel: FollowUpChannel;
		purpose: string;
	} | null;
	generatedAt: string;
	model: string;
	tokenCount: number;
}

export function buildFollowUpWriterPrompt(
	ctx: AiContext,
	params: FollowUpWriterParams,
): { system: string; user: string } {
	const contextSections = buildSystemSections(ctx);

	const system = [
		"You are an elite roofing sales communication specialist.",
		"Draft follow-up messages using the AIDA framework (Attention, Interest, Desire, Action).",
		"Produce high-converting, personalized messages for homeowner follow-up.",
		`Output valid JSON: { message: string, subjectLine: string | null (email only), wordCount: number, suggestedSendTime: string (e.g. "Tomorrow 9am"), nextTouchSuggestion: { day, channel, purpose } | null }.`,
		"Maximum 500 tokens.",
		"Text messages: max 140 words. Emails: max 200 words. Voicemail scripts: max 100 words.",
		"",
		contextSections,
	].join("\n");

	const user = [
		`Situation: ${params.situation}`,
		`Channel: ${params.channel}`,
		`Homeowner: ${params.homeownerName}`,
		`Last interaction: ${params.lastInteraction}`,
		`Desired next action: ${params.desiredNextAction}`,
		`Days since last contact: ${params.daysSinceLastContact}`,
		`This is touch #${params.touchNumber} in the sequence.`,
		params.customInstructions ? `Custom instructions: ${params.customInstructions}` : null,
		"",
		"Return only valid JSON.",
	]
		.filter(Boolean)
		.join("\n");

	return { system, user };
}

export function parseFollowUpWriterOutput(
	raw: string,
	params: FollowUpWriterParams,
	model: string,
	tokenCount: number,
): FollowUpWriterOutput {
	try {
		const parsed = JSON.parse(raw);
		const message = String(parsed.message ?? raw);
		return {
			message,
			subjectLine: params.channel === "email" && parsed.subjectLine
				? String(parsed.subjectLine)
				: null,
			channel: params.channel,
			wordCount: message.split(/\s+/).length,
			suggestedSendTime: String(parsed.suggestedSendTime ?? "Tomorrow morning"),
			nextTouchSuggestion: parsed.nextTouchSuggestion
				? {
						day: Number(parsed.nextTouchSuggestion.day ?? 3),
						channel: String(parsed.nextTouchSuggestion.channel ?? "text") as FollowUpChannel,
						purpose: String(parsed.nextTouchSuggestion.purpose ?? ""),
					}
				: null,
			generatedAt: new Date().toISOString(),
			model,
			tokenCount,
		};
	} catch {
		const message = raw;
		return {
			message,
			subjectLine: null,
			channel: params.channel,
			wordCount: message.split(/\s+/).length,
			suggestedSendTime: "Tomorrow morning",
			nextTouchSuggestion: null,
			generatedAt: new Date().toISOString(),
			model,
			tokenCount,
		};
	}
}
