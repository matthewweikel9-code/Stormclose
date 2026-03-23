/**
 * POST /api/adjuster-desk/pre-brief
 * Phase 3: Pre-call brief from claim context — 60-second adjuster persona drill
 *
 * Body: { claimContext: string, carrier?: string, leadId?: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: NextRequest) {
	try {
		const supabase = await createClient();
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const body = await request.json().catch(() => ({}));
		let { claimContext, carrier, leadId } = body;

		if (leadId) {
			const { data: lead } = await (supabase as any)
				.from("leads")
				.select("address, city, state, zip, estimated_claim, lead_score, notes")
				.eq("id", leadId)
				.eq("user_id", user.id)
				.maybeSingle();
			if (lead) {
				claimContext =
					(claimContext ? `${claimContext}\n\n` : "") +
					`Lead: ${lead.address}, ${lead.city} ${lead.state} ${lead.zip}. Est claim: $${lead.estimated_claim ?? "?"}. Notes: ${lead.notes ?? "—"}`;
			}
		}

		if (!claimContext?.trim()) {
			return NextResponse.json({ error: "claimContext or leadId required" }, { status: 400 });
		}

		const completion = await openai.chat.completions.create({
			model: "gpt-4o-mini",
			messages: [
				{
					role: "system",
					content: `You are a storm damage sales coach. Generate a 60-second pre-call adjuster drill.
Output: 3-5 bullet points the rep can rehearse in under 60 seconds. Include: carrier-specific landmines to avoid, key facts to state, one suggested opening line. Be concise.`,
				},
				{
					role: "user",
					content: `Pre-call brief for adjuster call.\n${carrier ? `Carrier: ${carrier}\n` : ""}\nClaim context:\n${claimContext.slice(0, 3000)}`,
				},
			],
			max_tokens: 400,
		});

		const brief = completion.choices[0]?.message?.content?.trim() ?? "Unable to generate brief.";
		return NextResponse.json({ success: true, brief });
	} catch (error) {
		console.error("[Pre-brief] Error:", error);
		return NextResponse.json({ error: "Failed to generate pre-brief" }, { status: 500 });
	}
}
