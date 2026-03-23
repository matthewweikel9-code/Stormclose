/**
 * POST /api/adjuster-desk/post-call
 * Phase 3: Post-call autopsy from notes or transcript → next steps, email draft, doc checklist
 *
 * Body: { notesOrTranscript: string, outcome?: string, carrier?: string }
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
		const { notesOrTranscript, outcome, carrier } = body;

		if (!notesOrTranscript?.trim()) {
			return NextResponse.json({ error: "notesOrTranscript required" }, { status: 400 });
		}

		const completion = await openai.chat.completions.create({
			model: "gpt-4o-mini",
			messages: [
				{
					role: "system",
					content: `You are a storm damage claims coach. Analyze post-call notes and return a JSON object:
{
  "whatWentWrong": [ "string" ],
  "nextSteps": [ "string" ],
  "emailDraft": "string",
  "docChecklist": [ "string" ]
}
- whatWentWrong: 1-3 things to improve
- nextSteps: 3-5 concrete next actions
- emailDraft: professional follow-up email to adjuster (2-4 sentences)
- docChecklist: documents/evidence to gather before next contact
Return only valid JSON.`,
				},
				{
					role: "user",
					content: `Post-call autopsy.\n${carrier ? `Carrier: ${carrier}\n` : ""}${outcome ? `Outcome: ${outcome}\n` : ""}\nNotes/transcript:\n${notesOrTranscript.slice(0, 4000)}`,
				},
			],
			max_tokens: 800,
		});

		const raw = completion.choices[0]?.message?.content?.trim() ?? "{}";
		let parsed: {
			whatWentWrong?: string[];
			nextSteps?: string[];
			emailDraft?: string;
			docChecklist?: string[];
		} = {};
		try {
			const match = raw.match(/\{[\s\S]*\}/);
			parsed = JSON.parse(match ? match[0] : "{}");
		} catch {
			parsed = { nextSteps: ["Review notes and follow up with adjuster"], emailDraft: "Please see attached.", docChecklist: [] };
		}

		return NextResponse.json({
			success: true,
			whatWentWrong: parsed.whatWentWrong ?? [],
			nextSteps: parsed.nextSteps ?? [],
			emailDraft: parsed.emailDraft ?? "",
			docChecklist: parsed.docChecklist ?? [],
		});
	} catch (error) {
		console.error("[Post-call] Error:", error);
		return NextResponse.json({ error: "Failed to analyze post-call" }, { status: 500 });
	}
}
