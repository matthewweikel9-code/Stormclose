import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkFeatureAccess } from "@/lib/subscriptions";
import OpenAI from "openai";

export const runtime = "nodejs";
export const maxDuration = 60;

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
});

interface NegotiationRequest {
	situation: string;
	state: string;
	carrier?: string;
	lineItem?: string;
	objectionType?: string;
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
		const access = await checkFeatureAccess(user.id, "negotiation_coach");
		if (!access.allowed) {
			return NextResponse.json(
				{ error: access.reason, tier: access.tier },
				{ status: 403 }
			);
		}

		const body = (await request.json()) as NegotiationRequest;
		const { situation, state, carrier, lineItem, objectionType } = body;

		if (!situation || !state) {
			return NextResponse.json(
				{ error: "Missing required fields" },
				{ status: 400 }
			);
		}

		const systemPrompt = `You are an expert roofing insurance negotiation coach. You help contractors negotiate with insurance adjusters during live calls.

You have deep knowledge of:
- State-specific overhead & profit regulations
- Depreciation recovery laws by state
- Insurance claim procedures and regulations
- Common adjuster tactics and how to counter them
- Industry-standard pricing justifications
- Code compliance arguments
- Manufacturer specification requirements

Your responses should be:
1. Concise and actionable (can be read during a call)
2. State-specific when applicable
3. Professional but assertive
4. Backed by industry standards and regulations
5. Ready to use immediately

Format responses with clear bullet points the contractor can read aloud.`;

		const userPrompt = `I need help negotiating with an insurance adjuster RIGHT NOW.

**State:** ${state}
${carrier ? `**Insurance Carrier:** ${carrier}` : ""}
${lineItem ? `**Line Item in Dispute:** ${lineItem}` : ""}
${objectionType ? `**Type of Objection:** ${objectionType}` : ""}

**Current Situation:**
${situation}

Please provide:
1. Key talking points I can use right now
2. Specific regulations or standards to cite
3. Questions to ask the adjuster
4. Fallback positions if needed`;

		const completion = await openai.chat.completions.create({
			model: "gpt-4o",
			messages: [
				{ role: "system", content: systemPrompt },
				{ role: "user", content: userPrompt },
			],
			temperature: 0.7,
			max_tokens: 1500,
		});

		const coaching = completion.choices[0]?.message?.content;

		if (!coaching) {
			return NextResponse.json(
				{ error: "Failed to generate coaching response" },
				{ status: 500 }
			);
		}

		// Log usage for analytics
		await (supabase.from("feature_usage") as any).insert({
			user_id: user.id,
			feature: "negotiation_coach",
			metadata: { state, carrier, objectionType },
		});

		return NextResponse.json({
			success: true,
			coaching,
			metadata: {
				state,
				carrier,
				generatedAt: new Date().toISOString(),
			},
		});
	} catch (error) {
		console.error("Negotiation coaching error:", error);
		return NextResponse.json(
			{ error: "Failed to generate coaching response" },
			{ status: 500 }
		);
	}
}
