/**
 * GET /api/usage
 * AI usage stats for the user/team (Phase 4 metering)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserTeamMemberships } from "@/lib/server/tenant";

export async function GET(request: NextRequest) {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const memberships = await getUserTeamMemberships(supabase, user.id);
	const teamIds = memberships.map((m) => m.team_id);
	const startOfMonth = new Date();
	startOfMonth.setDate(1);
	startOfMonth.setHours(0, 0, 0, 0);

	try {
		const { data: userRows } = await (supabase as any)
			.from("ai_usage_records")
			.select("feature, token_count, request_count, created_at")
			.eq("user_id", user.id)
			.gte("created_at", startOfMonth.toISOString().split("T")[0]);

		const userRequests = (userRows ?? []).reduce((s: number, r: any) => s + (r.request_count ?? 1), 0);
		const userTokens = (userRows ?? []).reduce((s: number, r: any) => s + (r.token_count ?? 0), 0);

		let teamRequests = 0;
		let teamTokens = 0;
		if (teamIds.length > 0) {
			const { data: teamRows } = await (supabase as any)
				.from("ai_usage_records")
				.select("request_count, token_count")
				.in("team_id", teamIds)
				.gte("created_at", startOfMonth.toISOString().split("T")[0]);
			teamRequests = (teamRows ?? []).reduce((s: number, r: any) => s + (r.request_count ?? 1), 0);
			teamTokens = (teamRows ?? []).reduce((s: number, r: any) => s + (r.token_count ?? 0), 0);
		}

		return NextResponse.json({
			user: { requests: userRequests, tokens: userTokens },
			team: { requests: teamRequests, tokens: teamTokens },
			periodStart: startOfMonth.toISOString(),
		});
	} catch {
		return NextResponse.json({
			user: { requests: 0, tokens: 0 },
			team: { requests: 0, tokens: 0 },
			periodStart: startOfMonth.toISOString(),
		});
	}
}
