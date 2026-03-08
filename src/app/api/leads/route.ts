import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkFeatureAccess } from "@/lib/subscriptions";
import OpenAI from "openai";

export const runtime = "nodejs";
export const maxDuration = 30;

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
});

interface LeadScoringRequest {
	leads: Array<{
		id: string;
		name: string;
		address?: string;
		phone?: string;
		email?: string;
		damageType?: string;
		carrier?: string;
		claimValue?: number;
		source?: string;
		notes?: string;
	}>;
}

interface ScoredLead {
	id: string;
	name: string;
	score: number;
	closeProb: number;
	priority: "high" | "medium" | "low";
	reasoning: string;
	nextAction: string;
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
		const access = await checkFeatureAccess(user.id, "lead_scoring");
		if (!access.allowed) {
			return NextResponse.json(
				{ error: access.reason, tier: access.tier },
				{ status: 403 }
			);
		}

		const body = (await request.json()) as LeadScoringRequest;
		const { leads } = body;

		if (!leads || leads.length === 0) {
			return NextResponse.json(
				{ error: "No leads provided" },
				{ status: 400 }
			);
		}

		if (leads.length > 50) {
			return NextResponse.json(
				{ error: "Maximum 50 leads per request" },
				{ status: 400 }
			);
		}

		const systemPrompt = `You are an expert roofing sales AI that predicts which leads are most likely to close. You analyze lead data and assign scores based on:

1. Damage type severity (hail damage scores higher than minor repairs)
2. Insurance carrier (some carriers have higher approval rates)
3. Claim value potential
4. Lead source quality (referrals score highest)
5. Contact information completeness
6. Geographic factors

You must return a JSON array with each lead scored. For each lead provide:
- score: 0-100 numeric score
- closeProb: probability percentage of closing (0-100)
- priority: "high", "medium", or "low"
- reasoning: brief explanation of score
- nextAction: recommended next step

Return ONLY valid JSON, no markdown or explanation.`;

		const leadsText = leads.map((lead, i) => `
Lead ${i + 1}:
- Name: ${lead.name}
${lead.address ? `- Address: ${lead.address}` : ""}
${lead.damageType ? `- Damage Type: ${lead.damageType}` : ""}
${lead.carrier ? `- Insurance Carrier: ${lead.carrier}` : ""}
${lead.claimValue ? `- Estimated Claim Value: $${lead.claimValue}` : ""}
${lead.source ? `- Lead Source: ${lead.source}` : ""}
${lead.notes ? `- Notes: ${lead.notes}` : ""}
`).join("\n");

		const completion = await openai.chat.completions.create({
			model: "gpt-4o",
			messages: [
				{ role: "system", content: systemPrompt },
				{ role: "user", content: `Score these leads:\n${leadsText}` },
			],
			temperature: 0.3,
			max_tokens: 2000,
			response_format: { type: "json_object" },
		});

		const responseText = completion.choices[0]?.message?.content;
		
		if (!responseText) {
			return NextResponse.json(
				{ error: "Failed to score leads" },
				{ status: 500 }
			);
		}

		let scoredData;
		try {
			scoredData = JSON.parse(responseText);
		} catch {
			return NextResponse.json(
				{ error: "Failed to parse AI response" },
				{ status: 500 }
			);
		}

		// Map scores back to lead IDs
		const scoredLeads: ScoredLead[] = leads.map((lead, index) => {
			const aiScore = scoredData.leads?.[index] || scoredData[index] || {};
			return {
				id: lead.id,
				name: lead.name,
				score: aiScore.score || 50,
				closeProb: aiScore.closeProb || aiScore.close_prob || 50,
				priority: aiScore.priority || "medium",
				reasoning: aiScore.reasoning || "Unable to determine",
				nextAction: aiScore.nextAction || aiScore.next_action || "Follow up",
			};
		});

		// Sort by score descending
		scoredLeads.sort((a, b) => b.score - a.score);

		// Log usage
		await (supabase.from("feature_usage") as any).insert({
			user_id: user.id,
			feature: "lead_scoring",
			metadata: { leadCount: leads.length },
		});

		return NextResponse.json({
			success: true,
			leads: scoredLeads,
			summary: {
				total: scoredLeads.length,
				highPriority: scoredLeads.filter(l => l.priority === "high").length,
				mediumPriority: scoredLeads.filter(l => l.priority === "medium").length,
				lowPriority: scoredLeads.filter(l => l.priority === "low").length,
				avgScore: Math.round(scoredLeads.reduce((sum, l) => sum + l.score, 0) / scoredLeads.length),
			},
		});
	} catch (error) {
		console.error("Lead scoring error:", error);
		return NextResponse.json(
			{ error: "Failed to score leads" },
			{ status: 500 }
		);
	}
}
