import OpenAI from "openai";

const MODEL = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

export type AIServiceResult = {
	content: string;
	model: string;
	usage?: {
		promptTokens?: number;
		completionTokens?: number;
		totalTokens?: number;
	};
};

type ModelPricing = {
	inputPerMillionUsd: number;
	outputPerMillionUsd: number;
};

const MODEL_PRICING: Record<string, ModelPricing> = {
	"gpt-4o-mini": {
		inputPerMillionUsd: 0.15,
		outputPerMillionUsd: 0.6
	},
	"gpt-4o": {
		inputPerMillionUsd: 5,
		outputPerMillionUsd: 15
	}
};

export type InsuranceReportInput = {
	companyName: string;
	customerName: string;
	propertyAddress: string;
	damageSummary: string;
	recommendedScope: string[];
	estimatedCost?: number;
	additionalNotes?: string;
};

export type FollowUpInput = {
	customerName: string;
	projectType: string;
	lastInteractionSummary: string;
	nextAction: string;
	tone?: "friendly" | "professional" | "urgent";
};

export type ObjectionResponseInput = {
	customerName?: string;
	objection: string;
	projectType: string;
	keyBenefits: string[];
	evidencePoints?: string[];
	tone?: "consultative" | "confident" | "empathetic";
};

class AIServiceError extends Error {
	readonly code: "MISSING_API_KEY" | "OPENAI_REQUEST_FAILED" | "EMPTY_RESPONSE";

	constructor(code: AIServiceError["code"], message: string) {
		super(message);
		this.name = "AIServiceError";
		this.code = code;
	}
}

function redactSensitiveValue(input: string) {
	return input
		.replace(/sk-[A-Za-z0-9_-]+/g, "[REDACTED_API_KEY]")
		.replace(/[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{24,}/g, "[REDACTED_TOKEN]");
}

function getOpenAIClient() {
	const apiKey = process.env.OPENAI_API_KEY?.trim();

	if (!apiKey) {
		throw new AIServiceError(
			"MISSING_API_KEY",
			"Missing OPENAI_API_KEY environment variable."
		);
	}

	if (!apiKey.startsWith("sk-")) {
		throw new AIServiceError(
			"MISSING_API_KEY",
			"Invalid OPENAI_API_KEY format. Expected a key starting with 'sk-'."
		);
	}

	return new OpenAI({ apiKey });
}

async function generateFromPrompt(systemPrompt: string, userPrompt: string): Promise<AIServiceResult> {
	try {
		const client = getOpenAIClient();
		const completion = await client.chat.completions.create({
			model: MODEL,
			temperature: 0.4,
			messages: [
				{ role: "system", content: systemPrompt },
				{ role: "user", content: userPrompt }
			]
		});

		const content = completion.choices[0]?.message?.content?.trim();

		if (!content) {
			throw new AIServiceError("EMPTY_RESPONSE", "OpenAI returned an empty response.");
		}

		return {
			content,
			model: completion.model,
			usage: {
				promptTokens: completion.usage?.prompt_tokens,
				completionTokens: completion.usage?.completion_tokens,
				totalTokens: completion.usage?.total_tokens
			}
		};
	} catch (error) {
		if (error instanceof AIServiceError) {
			throw error;
		}

		const rawMessage = error instanceof Error ? error.message : "Unknown OpenAI error.";
		const sanitizedMessage = redactSensitiveValue(rawMessage);
		const message = /incorrect api key|invalid_api_key|401/i.test(rawMessage)
			? "OpenAI authentication failed. Check OPENAI_API_KEY and restart the server."
			: sanitizedMessage;

		throw new AIServiceError("OPENAI_REQUEST_FAILED", `OpenAI request failed: ${message}`);
	}
}

export async function generateInsuranceReport(data: InsuranceReportInput): Promise<AIServiceResult> {
	const systemPrompt =
		"You are an expert roofing claims assistant. Write clear, factual, insurance-friendly reports.";

	const userPrompt = [
		"Create a professional insurance report for roof damage.",
		`Company: ${data.companyName}`,
		`Customer: ${data.customerName}`,
		`Property Address: ${data.propertyAddress}`,
		`Damage Summary: ${data.damageSummary}`,
		`Recommended Scope: ${data.recommendedScope.join(", ")}`,
		data.estimatedCost !== undefined ? `Estimated Cost: $${data.estimatedCost.toLocaleString()}` : null,
		data.additionalNotes ? `Additional Notes: ${data.additionalNotes}` : null,
		"Format with sections: Overview, Findings, Recommended Scope, Cost Estimate, Next Steps."
	]
		.filter(Boolean)
		.join("\n");

	return generateFromPrompt(systemPrompt, userPrompt);
}

export async function generateFollowUp(data: FollowUpInput): Promise<AIServiceResult> {
	const tone = data.tone ?? "professional";
	const systemPrompt =
		"You are a high-converting roofing sales assistant. Write concise follow-up messages that drive response.";

	const userPrompt = [
		"Generate a customer follow-up message.",
		`Tone: ${tone}`,
		`Customer Name: ${data.customerName}`,
		`Project Type: ${data.projectType}`,
		`Last Interaction: ${data.lastInteractionSummary}`,
		`Next Action Request: ${data.nextAction}`,
		"Return 1 polished message under 140 words."
	].join("\n");

	return generateFromPrompt(systemPrompt, userPrompt);
}

export async function generateObjectionResponse(
	data: ObjectionResponseInput
): Promise<AIServiceResult> {
	const tone = data.tone ?? "consultative";
	const systemPrompt =
		"You are a roofing sales expert. Respond to objections with empathy, credibility, and clear next steps.";

	const userPrompt = [
		"Generate a response to a customer objection.",
		`Tone: ${tone}`,
		data.customerName ? `Customer Name: ${data.customerName}` : null,
		`Project Type: ${data.projectType}`,
		`Objection: ${data.objection}`,
		`Key Benefits: ${data.keyBenefits.join(", ")}`,
		data.evidencePoints?.length ? `Evidence Points: ${data.evidencePoints.join(", ")}` : null,
		"Structure as: Acknowledge concern, reassure with value, and close with one clear next step."
	]
		.filter(Boolean)
		.join("\n");

	return generateFromPrompt(systemPrompt, userPrompt);
}

export function estimateUsageCostUsd(result: AIServiceResult): number | null {
	if (!result.usage) {
		return null;
	}

	const promptTokens = result.usage.promptTokens ?? 0;
	const completionTokens = result.usage.completionTokens ?? 0;
	const pricing = MODEL_PRICING[result.model] ?? MODEL_PRICING[MODEL] ?? null;

	if (!pricing) {
		return null;
	}

	const inputCost = (promptTokens / 1_000_000) * pricing.inputPerMillionUsd;
	const outputCost = (completionTokens / 1_000_000) * pricing.outputPerMillionUsd;

	return Number((inputCost + outputCost).toFixed(6));
}

export { AIServiceError };