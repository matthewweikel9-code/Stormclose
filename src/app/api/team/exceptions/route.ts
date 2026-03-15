import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { detectExceptions } from "@/services/team/exceptionService";
import { missionsService } from "@/services/missions/missionService";
import { presenceService } from "@/services/presence/presenceService";
import type { RepState, ZoneState, TeamState } from "@/types/team";

/**
 * GET /api/team/exceptions
 * Runs exception detection against the current team state and returns
 * all active exceptions sorted by severity.
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

		const now = new Date().toISOString();
		const missions = await missionsService.listMissions(userId, { limit: 200 });
		const presenceRecords = presenceService.getAllPresence();

		// Build RepState array
		const reps: RepState[] = [];
		for (const presence of presenceRecords) {
			const mission = missions.find((m) => m.id === presence.missionId);
			let recentOutcomes: RepState["recentOutcomes"] = [];
			let stopsRemaining = 0;
			let nearestStopDistanceMiles: number | null = null;

			if (mission) {
				const detail = await missionsService.getMissionDetail(userId, mission.id);
				const completed = detail.stops.filter((s) => s.status !== "new" && s.status !== "targeted");
				stopsRemaining = detail.stops.filter((s) => s.status === "new" || s.status === "targeted").length;
				recentOutcomes = completed.slice(-10).map((s) => s.status) as RepState["recentOutcomes"];

				// Calculate nearest stop distance
				const pendingStops = detail.stops.filter((s) => s.status === "new" || s.status === "targeted");
				if (pendingStops.length > 0) {
					const distances = pendingStops.map((s) => {
						const dLat = s.lat - presence.lat;
						const dLng = s.lng - presence.lng;
						return Math.sqrt(dLat * dLat + dLng * dLng) * 69; // rough miles
					});
					nearestStopDistanceMiles = Math.min(...distances);
				}
			}

			const hasPlannedMission = missions.some(
				(m) => m.assignedRepId === presence.userId && m.status === "planned",
			);
			const plannedMission = missions.find(
				(m) => m.assignedRepId === presence.userId && m.status === "planned",
			);

			reps.push({
				userId: presence.userId,
				name: presence.userId,
				lat: presence.lat,
				lng: presence.lng,
				speed: presence.speed,
				batteryPercent: null,
				mode: mission ? "active_mission" : presence.mode === "idle" ? "idle" : "offline",
				lastHeartbeatAt: presence.recordedAt,
				missionId: mission?.id ?? null,
				missionName: mission?.name ?? null,
				missionStatus: mission?.status ?? null,
				missionStartedAt: mission?.startedAt ?? null,
				stopsRemaining,
				recentOutcomes,
				nearestStopDistanceMiles,
				hasPlannedMission,
				plannedMissionName: plannedMission?.name ?? null,
			});
		}

		const zones: ZoneState[] = []; // TODO: wire up real storm zones
		const state: TeamState = {
			reps,
			zones,
			exportBacklogCount: 0,
			now,
			workingHoursStart: "08:00",
			workingHoursEnd: "20:00",
		};

		const exceptions = detectExceptions(state);

		return NextResponse.json({
			data: exceptions,
			error: null,
			meta: { count: exceptions.length, timestamp: now },
		});
	} catch (error) {
		return NextResponse.json(
			{
				data: null,
				error: error instanceof Error ? error.message : "Failed to detect exceptions",
				meta: {},
			},
			{ status: 500 },
		);
	}
}
