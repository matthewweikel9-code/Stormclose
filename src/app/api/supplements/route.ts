import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkFeatureAccess } from "@/lib/subscriptions";
import OpenAI from "openai";

export const runtime = "nodejs";
export const maxDuration = 60;

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
});

interface SupplementRequest {
	adjusterEstimate: string;
	damageType: string;
	state: string;
	roofType?: string;
	propertyAge?: string;
}

export async function POST(request: Request) {
	try {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Check feature access
		const access = await checkFeatureAccess(user.id, "supplement_generator");
		if (!access.allowed) {
			return NextResponse.json(
				{ error: access.reason, tier: access.tier },
				{ status: 403 }
			);
		}

		const body = (await request.json()) as SupplementRequest;
		const { adjusterEstimate, damageType, state, roofType, propertyAge } = body;

		if (!adjusterEstimate || !damageType || !state) {
			return NextResponse.json(
				{ error: "Missing required fields" },
				{ status: 400 }
			);
		}

		const systemPrompt = `You are an expert roofing insurance supplement specialist. Your job is to analyze adjuster estimates and identify commonly missed or underpaid line items.

You have deep knowledge of:
- Xactimate pricing and line item codes
- State-specific roofing requirements and pricing
- Insurance company patterns for undervaluing claims
- Industry-standard repair methodologies
- Code compliance requirements

When analyzing an estimate, identify:
1. Missing line items that should be included
2. Underpriced labor rates
3. Missing overhead & profit
4. Code compliance items not included
5. Manufacturer specifications not followed
6. Proper measurements and quantities

Format your response as a professional supplement request that can be sent to the insurance company.`;

		const userPrompt = `Analyze this adjuster's estimate and generate a supplement request.

**State:** ${state}
**Damage Type:** ${damageType}
${roofType ? `**Roof Type:** ${roofType}` : ""}
${propertyAge ? `**Property Age:** ${propertyAge} years` : ""}

**Adjuster's Estimate:**
${adjusterEstimate}

Please provide:
1. Summary of missing/underpaid items
2. Detailed line-item breakdown with Xactimate codes where applicable
3. Justification for each item
4. Recommended supplement total
5. Professional language for insurance submission`;

		const completion = await openai.chat.completions.create({
			model: "gpt-4o",
			messages: [
				{ role: "system", content: systemPrompt },
				{ role: "user", content: userPrompt },
			],
			temperature: 0.7,
			max_tokens: 3000,
		});

		const supplement = completion.choices[0]?.message?.content;

		if (!supplement) {
			return NextResponse.json(
				{ error: "Failed to generate supplement" },
				{ status: 500 }
			);
		}

		// Log usage for analytics
		await (supabase.from("feature_usage") as any).insert({
			user_id: user.id,
			feature: "supplement_generator",
			metadata: { damageType, state, roofType },
		});

		return NextResponse.json({
			success: true,
			supplement,
			metadata: {
				damageType,
				state,
				generatedAt: new Date().toISOString(),
			},
		});
	} catch (error) {
		console.error("Supplement generation error:", error);
		return NextResponse.json(
			{ error: "Failed to generate supplement" },
			{ status: 500 }
		);
	}
}
