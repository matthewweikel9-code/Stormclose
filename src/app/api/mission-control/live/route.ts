import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { missionsService } from "@/services/missions/missionService";
import { presenceService } from "@/services/presence/presenceService";
import type {
	MissionControlLiveData,
	MissionControlKpi,
	McRepPosition,
	McZoneOverlay,
	McPriorityZone,
	McHotCluster,
	McTopRep,
	McTickerEvent,
	McStormAlert,
	McException,
	RepDotStatus,
} from "@/types/mission-control";
import type { RepFieldStatus } from "@/types/team";

/**
 * GET /api/mission-control/live
 *
 * Single aggregated endpoint returning all Mission Control widget data.
 * Designed for 30-second polling from a fullscreen TV display.
 *
 * Returns: { data: MissionControlLiveData, error, meta }
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
			return NextResponse.json(
				{ data: null, error: "Unauthorized", meta: {} },
				{ status: 401 },
			);
		}

		const now = new Date();

		// ── Gather raw data ──────────────────────────────────────────────

		const missions = await missionsService.listMissions(userId, { limit: 200 });
		const presenceRecords = presenceService.getAllPresence();

		// ── Build rep positions ──────────────────────────────────────────

		const reps: McRepPosition[] = [];
		const repDoorCounts = new Map<string, { doors: number; interested: number }>();

		for (const presence of presenceRecords) {
			const mission = missions.find((m) => m.id === presence.missionId);
			const detail = mission
				? await missionsService.getMissionDetail(userId, mission.id)
				: null;
			const completedStops = detail
				? detail.stops.filter((s) => s.status !== "pending" && s.status !== "new").length
				: 0;
			const interestedStops = detail
				? detail.stops.filter((s) => s.status === "interested").length
				: 0;
			const totalStops = detail ? detail.stops.length : 0;

			const heartbeatAge = Math.round(
				(now.getTime() - new Date(presence.recordedAt).getTime()) / 1000,
			);

			let fieldStatus: RepDotStatus = "active";
			if (heartbeatAge > 900) fieldStatus = "offline";
			else if (presence.mode === "idle") fieldStatus = "idle";
			else if ((presence.speed ?? 0) > 2) fieldStatus = "driving";
			else if ((presence.speed ?? 0) <= 0.5) fieldStatus = "at_door";

			reps.push({
				userId: presence.userId,
				name: presence.userId, // Name resolved from user profile in production
				lat: presence.lat,
				lng: presence.lng,
				fieldStatus,
				missionName: mission?.name ?? null,
				completionPercent:
					totalStops > 0
						? Math.round((completedStops / totalStops) * 100)
						: 0,
				lastHeartbeatSecondsAgo: heartbeatAge,
			});

			// Track per-rep door counts for leaderboard
			const existing = repDoorCounts.get(presence.userId) ?? { doors: 0, interested: 0 };
			existing.doors += completedStops;
			existing.interested += interestedStops;
			repDoorCounts.set(presence.userId, existing);
		}

		// ── KPIs ─────────────────────────────────────────────────────────

		const activeMissions = missions.filter((m) => m.status === "active");
		let totalHousesLeft = 0;
		let totalQualified = 0;
		let totalSentToJN = 0;
		let totalHousesHit = 0;

		for (const mission of activeMissions) {
			const detail = await missionsService.getMissionDetail(userId, mission.id);
			for (const stop of detail.stops) {
				if (stop.status === "new" || stop.status === "pending") {
					totalHousesLeft++;
				} else {
					totalHousesHit++;
				}
				if (stop.status === "interested") {
					totalQualified++;
				}
				if (stop.status === "sent_to_jobnimbus") {
					totalSentToJN++;
				}
			}
		}

		const activeReps = reps.filter(
			(r) => r.fieldStatus !== "offline" && r.fieldStatus !== "idle",
		);

		const kpi: MissionControlKpi = {
			repsInField: activeReps.length,
			activeMissions: activeMissions.length,
			housesLeftToHit: totalHousesLeft,
			qualifiedToday: totalQualified,
			sentToJobNimbusToday: totalSentToJN,
		};

		// ── Zones (placeholder — would come from storm_zones table) ─────

		const zones: McZoneOverlay[] = [];

		// ── Priority zone (highest score) ────────────────────────────────

		const priorityZone: McPriorityZone | null =
			zones.length > 0
				? (() => {
						const best = [...zones].sort((a, b) => b.score - a.score)[0];
						return {
							name: best.name,
							score: best.score,
							houseCount: best.houseCount,
							unworkedCount: best.unworkedCount,
						};
					})()
				: null;

		// ── Hot cluster (nearest unworked to any rep) ────────────────────

		const hotCluster: McHotCluster | null =
			zones.length > 0 && reps.length > 0
				? (() => {
						const unworked = zones.filter((z) => z.unworkedCount > 20);
						if (unworked.length === 0) return null;
						let nearest = unworked[0];
						let minDist = Infinity;
						for (const z of unworked) {
							for (const rep of reps) {
								const dist = haversineMiles(rep.lat, rep.lng, z.centroidLat, z.centroidLng);
								if (dist < minDist) {
									minDist = dist;
									nearest = z;
								}
							}
						}
						return {
							name: nearest.name,
							houseCount: nearest.houseCount,
							distanceFromNearestRepMiles: Math.round(minDist * 10) / 10,
						};
					})()
				: null;

		// ── Top rep today ────────────────────────────────────────────────

		let topRep: McTopRep | null = null;
		if (repDoorCounts.size > 0) {
			let bestUserId = "";
			let bestDoors = 0;
			for (const [uid, counts] of repDoorCounts) {
				if (counts.doors > bestDoors) {
					bestDoors = counts.doors;
					bestUserId = uid;
				}
			}
			if (bestUserId) {
				const counts = repDoorCounts.get(bestUserId)!;
				topRep = {
					name: bestUserId, // Name resolved from user profile in production
					doorsKnocked: counts.doors,
					appointmentsSet: counts.interested,
					conversionRate:
						counts.doors > 0
							? Math.round((counts.interested / counts.doors) * 100)
							: 0,
				};
			}
		}

		// ── Insights (static placeholders — AI-generated in production) ──

		const insights: string[] = generateInsights(kpi, reps.length, totalHousesHit);

		// ── Recent events (from mission state changes) ───────────────────

		const recentEvents: McTickerEvent[] = buildTickerEvents(missions, now);

		// ── Storm alerts (placeholder) ───────────────────────────────────

		const stormAlerts: McStormAlert[] = [];

		// ── Exceptions (placeholder) ─────────────────────────────────────

		const exceptions: McException[] = [];

		// ── Response ─────────────────────────────────────────────────────

		const data: MissionControlLiveData = {
			timestamp: now.toISOString(),
			kpi,
			reps,
			zones,
			priorityZone,
			hotCluster,
			topRep,
			insights,
			recentEvents,
			stormAlerts,
			exceptions,
		};

		return NextResponse.json(
			{
				data,
				error: null,
				meta: { timestamp: now.toISOString() },
			},
			{
				headers: {
					"Cache-Control": "public, s-maxage=10, stale-while-revalidate=30",
				},
			},
		);
	} catch (error) {
		return NextResponse.json(
			{
				data: null,
				error:
					error instanceof Error
						? error.message
						: "Failed to load mission control data",
				meta: {},
			},
			{ status: 500 },
		);
	}
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
	const toRad = (deg: number) => (deg * Math.PI) / 180;
	const R = 3958.8;
	const dLat = toRad(lat2 - lat1);
	const dLng = toRad(lng2 - lng1);
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
	return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function generateInsights(
	kpi: MissionControlKpi,
	totalReps: number,
	housesHit: number,
): string[] {
	const insights: string[] = [];

	if (kpi.repsInField > 0) {
		insights.push(
			`${kpi.repsInField} rep${kpi.repsInField === 1 ? "" : "s"} actively working in the field right now.`,
		);
	}

	if (kpi.activeMissions > 0) {
		insights.push(
			`${kpi.activeMissions} active mission${kpi.activeMissions === 1 ? "" : "s"} in progress across all teams.`,
		);
	}

	if (housesHit > 0) {
		insights.push(`${housesHit} doors knocked today — keep the momentum going.`);
	}

	if (kpi.qualifiedToday > 0) {
		insights.push(
			`${kpi.qualifiedToday} qualified opportunit${kpi.qualifiedToday === 1 ? "y" : "ies"} identified today.`,
		);
	}

	if (kpi.sentToJobNimbusToday > 0) {
		insights.push(
			`${kpi.sentToJobNimbusToday} opportunit${kpi.sentToJobNimbusToday === 1 ? "y" : "ies"} exported to JobNimbus today.`,
		);
	}

	if (insights.length === 0) {
		insights.push("No field activity yet today. Deploy reps to active storm zones.");
	}

	return insights;
}

function buildTickerEvents(
	missions: Array<{ id: string; name: string; status: string; createdAt: string; updatedAt: string }>,
	now: Date,
): McTickerEvent[] {
	const events: McTickerEvent[] = [];

	for (const mission of missions) {
		if (mission.status === "active") {
			events.push({
				id: `mc-evt-${mission.id}-active`,
				icon: "🚀",
				text: `Mission "${mission.name}" is active`,
				timestamp: mission.updatedAt,
			});
		}
		if (mission.status === "completed") {
			events.push({
				id: `mc-evt-${mission.id}-complete`,
				icon: "✅",
				text: `Mission "${mission.name}" completed`,
				timestamp: mission.updatedAt,
			});
		}
	}

	// Sort newest first, limit to 50
	events.sort(
		(a, b) =>
			new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
	);

	return events.slice(0, 50);
}
