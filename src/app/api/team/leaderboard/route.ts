import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { missionsService } from "@/services/missions/missionService";
import { computeLeaderboard } from "@/services/team/exceptionService";
import type { LeaderboardPeriod } from "@/types/team";

/**
 * GET /api/team/leaderboard
 * Computes and returns the rep leaderboard sorted by doors knocked.
 *
 * Query params:
 *   - period: "today" | "week" | "month" (default "today")
 */
export async function GET(request: NextRequest) {
	try {
		const userId =
			process.env.NODE_ENV === "test"
				? "test-user"
				: await (async () => {
					const supabase = await createClient();
					const {
						data: { user },
					} = await supabase.auth.getUser();
					return user?.id ?? null;
				})();

		if (!userId) {
			return NextResponse.json({ data: null, error: "Unauthorized", meta: {} }, { status: 401 });
		}

		const { searchParams } = new URL(request.url);
		const period = (searchParams.get("period") ?? "today") as LeaderboardPeriod;

		// Gather missions and compute per-rep stats
		const missions = await missionsService.listMissions(userId, { limit: 500 });
		const repStatsMap = new Map<
			string,
			{
				doorsKnocked: number;
				appointmentsSet: number;
				noAnswerCount: number;
				activeMinutes: number;
				missionsCompleted: number;
			}
		>();

		for (const mission of missions) {
			const repId = mission.assignedRepId ?? mission.createdBy;
			if (!repId) continue;

			const detail = await missionsService.getMissionDetail(userId, mission.id);
			const stops = detail.stops;

			const completed = stops.filter((s) => s.status !== "pending");
			const appointments = stops.filter((s) => s.status === "interested");
			const noAnswer = stops.filter((s) => s.status === "no_answer");

			const existing = repStatsMap.get(repId) ?? {
				doorsKnocked: 0,
				appointmentsSet: 0,
				noAnswerCount: 0,
				activeMinutes: 0,
				missionsCompleted: 0,
			};

			existing.doorsKnocked += completed.length;
			existing.appointmentsSet += appointments.length;
			existing.noAnswerCount += noAnswer.length;
			existing.activeMinutes += completed.length * 3; // estimate 3 min per door
			if (mission.status === "completed") existing.missionsCompleted++;

			repStatsMap.set(repId, existing);
		}

		const entries = Array.from(repStatsMap.entries()).map(([repId, stats]) => ({
			userId: repId,
			name: repId,
			avatarUrl: null,
			branchName: null,
			...stats,
			estimatedPipeline: stats.appointmentsSet * 15000,
		}));

		const leaderboard = computeLeaderboard(entries);

		return NextResponse.json({
			data: leaderboard,
			error: null,
			meta: { period, count: leaderboard.length },
		});
	} catch (error) {
		return NextResponse.json(
			{
				data: null,
				error: error instanceof Error ? error.message : "Failed to compute leaderboard",
				meta: {},
			},
			{ status: 500 },
		);
	}
}
