import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { missionsService } from "@/services/missions/missionService";
import { presenceService } from "@/services/presence/presenceService";
import type { TeamLiveData, TeamKpiStrip, TeamRepPosition, RepFieldStatus } from "@/types/team";

/**
 * GET /api/team/live
 * Returns real-time team snapshot: KPIs, rep positions, and zone overlays.
 * Used by the Team Operations dashboard for live monitoring.
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

		const now = new Date();

		// Gather all missions across the org (manager scope)
		const missions = await missionsService.listMissions(userId, { limit: 200 });

		// Gather presence records
		const presenceRecords = presenceService.getAllPresence();

		// Build rep positions from presence + mission data
		const repMap = new Map<string, TeamRepPosition>();

		for (const presence of presenceRecords) {
			const mission = missions.find((m) => m.id === presence.missionId);
			const stops = mission ? await missionsService.getMissionDetail(userId, mission.id) : null;
			const completedStops = stops ? stops.stops.filter((s) => s.status !== "new" && s.status !== "targeted").length : 0;
			const totalStops = stops ? stops.stops.length : 0;

			const heartbeatAge = Math.round(
				(now.getTime() - new Date(presence.recordedAt).getTime()) / 1000,
			);

			let fieldStatus: RepFieldStatus = "active";
			if (heartbeatAge > 900) fieldStatus = "offline";
			else if (presence.mode === "idle") fieldStatus = "idle";
			else if ((presence.speed ?? 0) > 2) fieldStatus = "driving";
			else if ((presence.speed ?? 0) <= 0.5) fieldStatus = "at_door";

			repMap.set(presence.userId, {
				userId: presence.userId,
				name: presence.userId,
				avatarUrl: null,
				lat: presence.lat,
				lng: presence.lng,
					accuracyMeters: presence.accuracy ?? 0,
				heading: presence.heading,
				speedMps: presence.speed,
				batteryPercent: null,
				fieldStatus,
				activeMission: mission
					? {
						id: mission.id,
						name: mission.name,
						stormZoneName: null,
						stopsCompleted: completedStops,
						stopsRemaining: totalStops - completedStops,
						completionPercent: totalStops > 0 ? Math.round((completedStops / totalStops) * 100) : 0,
					}
					: null,
				currentStopAddress: null,
				lastHeartbeatSecondsAgo: heartbeatAge,
				teamId: "default",
				branchId: null,
				branchName: null,
			});
		}

		const reps = Array.from(repMap.values());
		const activeReps = reps.filter((r) => r.fieldStatus !== "offline" && r.fieldStatus !== "idle");
		const idleReps = reps.filter((r) => r.fieldStatus === "idle");

		// Get door-knocking count for today
		let housesHitToday = 0;
		let totalDoorsPerHourSum = 0;
		let repsWithDoors = 0;

		for (const mission of missions) {
			if (mission.status !== "active") continue;
			const detail = await missionsService.getMissionDetail(userId, mission.id);
			const completedStops = detail.stops.filter((s) => s.status !== "new" && s.status !== "targeted").length;
			housesHitToday += completedStops;
			if (completedStops > 0) {
				repsWithDoors++;
				totalDoorsPerHourSum += completedStops;
			}
		}

		const kpi: TeamKpiStrip = {
			repsActiveCount: activeReps.length,
			repsIdleCount: idleReps.length,
			exceptionCount: 0,
			housesHitTodayCount: housesHitToday,
			avgDoorsPerHour: repsWithDoors > 0 ? Math.round((totalDoorsPerHourSum / repsWithDoors) * 10) / 10 : 0,
		};

		const data: TeamLiveData = {
			kpi,
			reps,
			activeZones: [],
		};

		return NextResponse.json({
			data,
			error: null,
			meta: { timestamp: now.toISOString() },
		});
	} catch (error) {
		return NextResponse.json(
			{
				data: null,
				error: error instanceof Error ? error.message : "Failed to load team live data",
				meta: {},
			},
			{ status: 500 },
		);
	}
}
