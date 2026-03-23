/**
 * POST /api/team/coaching-digest
 * Phase 3: Manager weekly digest — trends by carrier/objection, coaching highlights
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveWriteTeamIdForUser } from "@/lib/server/tenant";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: NextRequest) {
	try {
		const supabase = await createClient();
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const teamId = await resolveWriteTeamIdForUser(supabase, user.id, null);
		if (!teamId) {
			return NextResponse.json({ error: "Create a team first" }, { status: 400 });
		}

		const weekStart = new Date();
		weekStart.setDate(weekStart.getDate() - 7);

		const { data: perfData } = await (supabase as any)
			.from("team_performance_daily")
			.select("user_id, doors_knocked, appointments_set, deals_closed, closed_value")
			.eq("team_id", teamId)
			.gte("date", weekStart.toISOString().split("T")[0]);

		const totalDoors = (perfData ?? []).reduce((s: number, r: any) => s + (r.doors_knocked ?? 0), 0);
		const totalClosed = (perfData ?? []).reduce((s: number, r: any) => s + (r.deals_closed ?? 0), 0);
		const totalRev = (perfData ?? []).reduce((s: number, r: any) => s + (parseFloat(r.closed_value) || 0), 0);
		const briefing = `This week: ${totalDoors} doors, ${totalClosed} deals closed, $${totalRev.toLocaleString()} revenue.`;

		const completion = await openai.chat.completions.create({
			model: "gpt-4o-mini",
			messages: [
				{
					role: "system",
					content: `You are a sales team coach. Generate a 2-paragraph weekly coaching digest.
Paragraph 1: Highlight one win and one area to improve.
Paragraph 2: One specific drill or focus for next week (e.g., objection handling on State Farm calls, documentation for supplements).
Keep it under 120 words. Casual, motivating tone.`,
				},
				{
					role: "user",
					content: `Team performance: ${briefing} Generate coaching digest.`,
				},
			],
			max_tokens: 250,
		});

		const digest = completion.choices[0]?.message?.content?.trim() ?? "Unable to generate digest.";
		return NextResponse.json({ success: true, digest });
	} catch (error) {
		console.error("[Coaching digest] Error:", error);
		return NextResponse.json({ error: "Failed to generate digest" }, { status: 500 });
	}
}
