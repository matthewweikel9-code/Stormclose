import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkFeatureAccess } from "@/lib/subscriptions/access";
import { errorResponse, successResponse } from "@/utils/api-response";

export const runtime = "nodejs";
export const maxDuration = 60;

export interface DamageFinding {
	type: string;
	severity: "low" | "medium" | "high";
	description: string;
	affectedArea?: string;
}

export interface DamageReport {
	damageTypes: string[];
	findings: DamageFinding[];
	overallSeverity: "low" | "medium" | "high" | "extensive";
	estimatedAffectedSquares: number;
	repairScope: "spot_repair" | "section_repair" | "full_replacement";
	summary: string;
	recommendations: string[];
}

const SYSTEM_PROMPT = `You are an expert roofing and storm damage inspector. Analyze the provided photo(s) of a roof or property for storm damage.

Identify:
- Hail bruising / granule loss on shingles
- Missing, cracked, or lifted shingles
- Exposed underlayment
- Soft spots or potential deck damage
- Siding, vent, or gutter damage
- Any other storm-related damage

Return a JSON object with this exact structure (no markdown, no code blocks):
{
  "damageTypes": ["array of damage type strings"],
  "findings": [
    {
      "type": "damage type",
      "severity": "low" | "medium" | "high",
      "description": "brief description",
      "affectedArea": "optional - which slopes or areas"
    }
  ],
  "overallSeverity": "low" | "medium" | "high" | "extensive",
  "estimatedAffectedSquares": number (roofing squares, 1 square = 100 sq ft - estimate based on visible damage),
  "repairScope": "spot_repair" | "section_repair" | "full_replacement",
  "summary": "2-3 sentence overall assessment",
  "recommendations": ["array of actionable recommendations"]
}

If the image does not show a roof or is unclear, set overallSeverity to "low", estimatedAffectedSquares to 0, repairScope to "spot_repair", and explain in summary.`;

export async function POST(request: NextRequest) {
	try {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			return errorResponse("Unauthorized", 401);
		}

		const access = await checkFeatureAccess(user.id, "lead_generator");
		if (!access.allowed) {
			return errorResponse(access.reason ?? "Upgrade to Pro required", 403);
		}

		const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
		if (!OPENAI_API_KEY) {
			return errorResponse("AI service not configured", 500);
		}

		const body = await request.json().catch(() => ({}));
		const { imageBase64, imageUrl } = body as { imageBase64?: string; imageUrl?: string };

		let base64Data = imageBase64;
		if (imageUrl && !base64Data) {
			const imgRes = await fetch(imageUrl);
			const buffer = await imgRes.arrayBuffer();
			base64Data = Buffer.from(buffer).toString("base64");
		}

		if (!base64Data || typeof base64Data !== "string") {
			return errorResponse("Image data required (imageBase64 or imageUrl)", 400);
		}

		// Normalize: remove data URL prefix if present
		const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, "");

		const response = await fetch("https://api.openai.com/v1/chat/completions", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${OPENAI_API_KEY}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model: "gpt-4o",
				max_tokens: 1024,
				messages: [
					{ role: "system", content: SYSTEM_PROMPT },
					{
						role: "user",
						content: [
							{
								type: "text",
								text: "Analyze this roof/property photo for storm damage. Return only valid JSON.",
							},
							{
								type: "image_url",
								image_url: {
									url: `data:image/jpeg;base64,${cleanBase64}`,
								},
							},
						],
					},
				],
			}),
		});

		if (!response.ok) {
			const err = await response.json().catch(() => ({}));
			return errorResponse(
				(err as { error?: { message?: string } })?.error?.message || "AI analysis failed",
				500
			);
		}

		const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
		const content = data.choices?.[0]?.message?.content?.trim();
		if (!content) {
			return errorResponse("No analysis result", 500);
		}

		// Parse JSON (handle possible markdown code block)
		let parsed: DamageReport;
		try {
			const jsonStr = content.replace(/^```json?\s*/i, "").replace(/\s*```$/i, "").trim();
			parsed = JSON.parse(jsonStr) as DamageReport;
		} catch {
			return errorResponse("Invalid AI response format", 500);
		}

		// Validate and normalize
		const report: DamageReport = {
			damageTypes: Array.isArray(parsed.damageTypes) ? parsed.damageTypes : [],
			findings: Array.isArray(parsed.findings) ? parsed.findings : [],
			overallSeverity:
				["low", "medium", "high", "extensive"].includes(parsed.overallSeverity)
					? parsed.overallSeverity
					: "low",
			estimatedAffectedSquares: Math.max(0, Number(parsed.estimatedAffectedSquares) || 0),
			repairScope:
				["spot_repair", "section_repair", "full_replacement"].includes(parsed.repairScope)
					? parsed.repairScope
					: "spot_repair",
			summary: typeof parsed.summary === "string" ? parsed.summary : "",
			recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
		};

		return successResponse({ report });
	} catch (error) {
		console.error("[damage-analysis] Error:", error);
		return errorResponse(
			error instanceof Error ? error.message : "Damage analysis failed",
			500
		);
	}
}
