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
	const systemPrompt = `You are an expert roofing claims assistant with comprehensive knowledge of roofing materials and labor costs. Write clear, factual, insurance-friendly reports with accurate cost estimates.

## ROOFING COST REFERENCE DATA (2024-2026 National Averages)

### SHINGLE COSTS (per square = 100 sq ft)
- 3-Tab Asphalt: $90-$120/sq materials, $150-$250/sq installed
- Architectural/Dimensional: $120-$180/sq materials, $250-$400/sq installed  
- Premium Designer: $180-$350/sq materials, $400-$700/sq installed
- Impact Resistant (Class 4): $150-$250/sq materials, $350-$550/sq installed
- Metal Shingles: $300-$500/sq materials, $600-$1,200/sq installed
- Synthetic/Composite: $400-$600/sq materials, $700-$1,000/sq installed
- Cedar Shake: $450-$650/sq materials, $800-$1,400/sq installed
- Slate: $800-$1,500/sq materials, $1,500-$3,000/sq installed
- Tile (Clay/Concrete): $400-$1,000/sq materials, $800-$1,800/sq installed

### UNDERLAYMENT (per square)
- Synthetic Felt (15/30 lb): $15-$25/sq
- Synthetic (Tiger Paw, etc.): $25-$45/sq
- Ice & Water Shield: $50-$100/sq

### VENTILATION
- Ridge Vent: $4-$8 per linear foot
- Box Vents: $50-$150 each installed
- Power Vents: $300-$600 each installed
- Soffit Vents: $3-$5 per linear foot

### FLASHING & ACCESSORIES
- Drip Edge: $2-$5 per linear foot
- Step Flashing: $5-$10 per linear foot
- Valley Flashing (W-Valley): $10-$20 per linear foot
- Pipe Boots: $15-$75 each
- Chimney Flashing Kit: $200-$500
- Skylight Flashing: $150-$400 each

### LABOR RATES
- Tear-off (1 layer): $1.00-$1.50/sq ft
- Tear-off (2+ layers): $1.50-$2.50/sq ft
- Install Labor: $2.00-$4.00/sq ft (varies by region)
- Steep Slope Premium: Add 25-50%
- Multi-Story Premium: Add 10-20% per additional story

### ADDITIONAL ITEMS
- Plywood/OSB Decking Repair: $75-$125 per sheet (4x8)
- Fascia Board Replacement: $8-$15 per linear foot
- Gutter Replacement: $10-$25 per linear foot
- Disposal/Dump Fees: $150-$300 per load

### TYPICAL ROOF SIZES
- Small (1,000-1,500 sq ft): 10-15 squares
- Medium (1,500-2,500 sq ft): 15-25 squares
- Large (2,500-3,500 sq ft): 25-35 squares
- Very Large (3,500+ sq ft): 35+ squares

Use this data to provide accurate, itemized cost estimates. Always show a range (low-high) and note that prices vary by region. Include line items for: Materials, Labor, Tear-off (if applicable), Accessories, Permits, and Overhead/Profit (typically 10-20%).`;

	const userPrompt = [
		"Create a professional insurance report for roof damage with a detailed cost estimate.",
		`Company: ${data.companyName}`,
		`Customer: ${data.customerName}`,
		`Property Address: ${data.propertyAddress}`,
		`Damage Summary: ${data.damageSummary}`,
		`Recommended Scope: ${data.recommendedScope.join(", ")}`,
		data.estimatedCost !== undefined ? `Budget Reference: $${data.estimatedCost.toLocaleString()}` : null,
		data.additionalNotes ? `Additional Notes: ${data.additionalNotes}` : null,
		"",
		"Format with sections:",
		"1. EXECUTIVE SUMMARY - Brief overview of damage and recommended action",
		"2. PROPERTY DETAILS - Address, roof type, approximate size",
		"3. DAMAGE ASSESSMENT - Detailed findings from inspection",
		"4. RECOMMENDED SCOPE OF WORK - Itemized repair/replacement items",
		"5. COST ESTIMATE - Detailed line-item breakdown with materials, labor, and total",
		"6. INSURANCE DOCUMENTATION - Key points for the claim",
		"7. NEXT STEPS - Clear action items for homeowner and adjuster",
		"",
		"IMPORTANT: Provide a detailed, itemized cost estimate based on the roof type and damage described. Show material costs, labor, and total. Give a realistic range."
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