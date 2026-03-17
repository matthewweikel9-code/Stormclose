import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserRoleForTeam } from "@/lib/server/tenant";

// GET /api/teams/[id]/leaderboard - Get team leaderboard
export async function GET(
	request: NextRequest,
	{ params }: { params: { id: string } }
) {
	try {
		const teamId = params.id;
		const { searchParams } = new URL(request.url);
		const period = searchParams.get("period") || "week"; // week, month, all
		const supabase = await createClient();
		const {
			data: { user }
		} = await supabase.auth.getUser();

		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const actorRole = await getUserRoleForTeam(supabase, user.id, teamId);
		if (!actorRole) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		let startDate: Date;
		const now = new Date();

		switch (period) {
			case "week":
				startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
				break;
			case "month":
				startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
				break;
			default:
				startDate = new Date(0);
		}

		const { data: members, error: membersError } = await (supabase.from("team_members") as any)
			.select("user_id, role")
			.eq("team_id", teamId);

		if (membersError) throw new Error(membersError.message);

		const pointValues: Record<string, number> = {
			door_knock: 1,
			phone_call: 1,
			appointment_set: 5,
			inspection: 10,
			estimate_sent: 10,
			contract_signed: 25,
			job_completed: 50
		};

		const leaderboard = await Promise.all(
			(members ?? []).map(async (member: { user_id: string; role: string }) => {
				const { data: activities } = await (supabase.from("activities") as any)
					.select("activity_type")
					.eq("team_id", teamId)
					.eq("user_id", member.user_id)
					.gte("created_at", startDate.toISOString());

				let totalPoints = 0;
				const breakdown: Record<string, number> = {};

				for (const activity of activities ?? []) {
					const type = activity.activity_type ?? "unknown";
					totalPoints += pointValues[type] ?? 0;
					breakdown[type] = (breakdown[type] || 0) + 1;
				}

				const { data: closedLeads } = await (supabase.from("leads") as any)
					.select("estimated_claim, actual_claim")
					.eq("team_id", teamId)
					.eq("assigned_to", member.user_id)
					.eq("status", "closed")
					.gte("status_changed_at", startDate.toISOString());

				const revenue = (closedLeads ?? []).reduce((sum: number, lead: any) => {
					const value = Number(lead.actual_claim ?? lead.estimated_claim ?? 0);
					return sum + (Number.isFinite(value) ? value : 0);
				}, 0);

				return {
					userId: member.user_id,
					role: member.role,
					points: totalPoints,
					revenue,
					activities: breakdown,
					totalActivities: activities?.length || 0
				};
			})
		);

		leaderboard.sort((a, b) => {
			if (b.points !== a.points) return b.points - a.points;
			return b.revenue - a.revenue;
		});

		const rankedLeaderboard = leaderboard.map((entry, index) => ({
			...entry,
			rank: index + 1
		}));

		return NextResponse.json({
			leaderboard: rankedLeaderboard,
			period,
			teamId
		});
	} catch (error) {
		console.error("Error fetching leaderboard:", error);
		return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 });
	}
}
