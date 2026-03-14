import type {
	ExceptionSeverity,
	ExceptionType,
	OpsException,
	RepState,
	TeamState,
	ZoneState,
} from "@/types/team";

// ── Haversine ────────────────────────────────────────────────────────────────

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

// ── Helper ───────────────────────────────────────────────────────────────────

function minutesSince(isoTimestamp: string, now: string): number {
	const diff = new Date(now).getTime() - new Date(isoTimestamp).getTime();
	return Math.max(0, diff / 60_000);
}

function hoursSince(isoTimestamp: string, now: string): number {
	return minutesSince(isoTimestamp, now) / 60;
}

function isDuringWorkingHours(now: string, start: string, end: string): boolean {
	const date = new Date(now);
	const hour = date.getHours();
	const minute = date.getMinutes();
	const currentMinutes = hour * 60 + minute;

	const [startH, startM] = start.split(":").map(Number);
	const [endH, endM] = end.split(":").map(Number);
	const startMinutes = (startH || 0) * 60 + (startM || 0);
	const endMinutes = (endH || 0) * 60 + (endM || 0);

	return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

function makeException(
	type: ExceptionType,
	severity: ExceptionSeverity,
	title: string,
	description: string,
	suggestedAction: string,
	context: OpsException["context"],
	now: string,
): OpsException {
	const expiresAt = new Date(new Date(now).getTime() + 4 * 60 * 60 * 1000).toISOString();
	return {
		id: crypto.randomUUID(),
		type,
		severity,
		title,
		description,
		suggestedAction,
		context,
		acknowledged: false,
		acknowledgedBy: null,
		acknowledgedAt: null,
		resolvedAt: null,
		createdAt: now,
		expiresAt,
	};
}

// ── Detection functions ──────────────────────────────────────────────────────

function detectIdleRep(rep: RepState, now: string): OpsException | null {
	if (rep.mode !== "active_mission") return null;
	const mins = minutesSince(rep.lastHeartbeatAt, now);
	if (mins < 5) return null;
	if (rep.speed !== null && rep.speed > 1) return null;

	return makeException(
		"idle_rep",
		"warning",
		`Idle: ${rep.name}`,
		`${rep.name} has been stationary for ${Math.round(mins)} minutes with no activity.`,
		`Check in with ${rep.name} or review their current stop.`,
		{
			repId: rep.userId,
			repName: rep.name,
			missionId: rep.missionId ?? undefined,
			missionName: rep.missionName ?? undefined,
			lat: rep.lat,
			lng: rep.lng,
			minutesIdle: Math.round(mins),
		},
		now,
	);
}

function detectOffRoute(rep: RepState, now: string): OpsException | null {
	if (rep.mode !== "active_mission") return null;
	if (rep.nearestStopDistanceMiles === null) return null;
	if (rep.nearestStopDistanceMiles <= 0.5) return null;

	return makeException(
		"off_route",
		"warning",
		`Off-Route: ${rep.name}`,
		`${rep.name} is ${rep.nearestStopDistanceMiles.toFixed(1)} miles from their nearest assigned stop.`,
		`Suggest reroute to ${rep.name} or check if they need reassignment.`,
		{
			repId: rep.userId,
			repName: rep.name,
			missionId: rep.missionId ?? undefined,
			missionName: rep.missionName ?? undefined,
			lat: rep.lat,
			lng: rep.lng,
			distanceOffRouteMiles: rep.nearestStopDistanceMiles,
		},
		now,
	);
}

function detectHeartbeatLost(rep: RepState, now: string): OpsException | null {
	if (rep.mode !== "active_mission") return null;
	const mins = minutesSince(rep.lastHeartbeatAt, now);
	if (mins < 15) return null;

	return makeException(
		"heartbeat_lost",
		"critical",
		`Heartbeat Lost: ${rep.name}`,
		`No heartbeat from ${rep.name} for ${Math.round(mins)} minutes.`,
		`Attempt to contact ${rep.name}. Last known position: (${rep.lat.toFixed(4)}, ${rep.lng.toFixed(4)}).`,
		{
			repId: rep.userId,
			repName: rep.name,
			missionId: rep.missionId ?? undefined,
			missionName: rep.missionName ?? undefined,
			lat: rep.lat,
			lng: rep.lng,
		},
		now,
	);
}

function detectBatteryCritical(rep: RepState, now: string): OpsException | null {
	if (rep.mode !== "active_mission") return null;
	if (rep.batteryPercent === null || rep.batteryPercent >= 10) return null;

	return makeException(
		"battery_critical",
		"warning",
		`Battery Critical: ${rep.name}`,
		`${rep.name}'s device is at ${rep.batteryPercent}% battery. Mission tracking may be lost.`,
		`Advise ${rep.name} to charge or complete mission soon.`,
		{
			repId: rep.userId,
			repName: rep.name,
			missionId: rep.missionId ?? undefined,
			batteryPercent: rep.batteryPercent,
		},
		now,
	);
}

function detectLowQualityOutcomes(rep: RepState, now: string): OpsException | null {
	if (rep.mode !== "active_mission") return null;
	if (rep.recentOutcomes.length < 5) return null;
	const last5 = rep.recentOutcomes.slice(-5);
	if (!last5.every((outcome) => outcome === "not_interested")) return null;

	return makeException(
		"low_quality_outcomes",
		"warning",
		`Low Quality: ${rep.name}`,
		`${rep.name} has recorded ${last5.length} consecutive rejections.`,
		`Consider coaching ${rep.name} or reassigning to a different zone.`,
		{
			repId: rep.userId,
			repName: rep.name,
			missionId: rep.missionId ?? undefined,
			missionName: rep.missionName ?? undefined,
			consecutiveOutcomes: last5.length,
		},
		now,
	);
}

function detectMissionOvertime(rep: RepState, now: string): OpsException | null {
	if (rep.missionStatus !== "active") return null;
	if (!rep.missionStartedAt) return null;
	const hours = hoursSince(rep.missionStartedAt, now);
	if (hours < 10) return null;

	return makeException(
		"mission_overtime",
		"info",
		`Mission Overtime: ${rep.missionName ?? "Mission"}`,
		`Mission '${rep.missionName ?? "Unknown"}' (${rep.name}) has been active for ${Math.round(hours)} hours.`,
		`Check on ${rep.name}. Consider completing or pausing the mission.`,
		{
			repId: rep.userId,
			repName: rep.name,
			missionId: rep.missionId ?? undefined,
			missionName: rep.missionName ?? undefined,
			activeHours: Math.round(hours),
		},
		now,
	);
}

function detectMissionNearlyCompleteClusterNearby(rep: RepState, zones: ZoneState[], now: string): OpsException | null {
	if (rep.missionStatus !== "active") return null;
	if (rep.stopsRemaining > 3) return null;

	const nearbyZone = zones.find((zone) => {
		if (zone.unworkedHouseCount < 10) return false;
		const dist = haversineMiles(rep.lat, rep.lng, zone.centroidLat, zone.centroidLng);
		return dist <= 2;
	});
	if (!nearbyZone) return null;

	const dist = haversineMiles(rep.lat, rep.lng, nearbyZone.centroidLat, nearbyZone.centroidLng);
	return makeException(
		"mission_nearly_complete_cluster_nearby",
		"info",
		`Nearby Cluster for ${rep.name}`,
		`${rep.name}'s mission is nearly complete. ${nearbyZone.unworkedHouseCount} unworked houses found ${dist.toFixed(1)} mi away in ${nearbyZone.name}.`,
		`Extend mission for ${rep.name}? Create follow-up mission for the nearby cluster.`,
		{
			repId: rep.userId,
			repName: rep.name,
			missionId: rep.missionId ?? undefined,
			missionName: rep.missionName ?? undefined,
			stormZoneId: nearbyZone.id,
			stormZoneName: nearbyZone.name,
			lat: nearbyZone.centroidLat,
			lng: nearbyZone.centroidLng,
		},
		now,
	);
}

function detectRepInactiveDuringHours(rep: RepState, now: string, workStart: string, workEnd: string): OpsException | null {
	if (rep.mode !== "offline" && rep.mode !== "idle") return null;
	if (!rep.hasPlannedMission) return null;
	if (!isDuringWorkingHours(now, workStart, workEnd)) return null;

	return makeException(
		"rep_inactive_during_hours",
		"info",
		`Undeployed: ${rep.name}`,
		`${rep.name} is offline during working hours with planned mission '${rep.plannedMissionName ?? "Unnamed"}' not started.`,
		`Deploy ${rep.name}? Their mission is ready.`,
		{
			repId: rep.userId,
			repName: rep.name,
			missionName: rep.plannedMissionName ?? undefined,
		},
		now,
	);
}

// ── Zone-level detections ────────────────────────────────────────────────────

function detectNoRepInHotZone(zone: ZoneState, reps: RepState[], now: string): OpsException | null {
	if (zone.score < 75) return null;
	if (zone.activeMissionCount > 0) return null;

	const anyRepNearby = reps.some((rep) => {
		if (rep.mode === "offline") return false;
		const dist = haversineMiles(rep.lat, rep.lng, zone.centroidLat, zone.centroidLng);
		return dist <= 10;
	});
	if (anyRepNearby) return null;

	const nearestRep = reps
		.filter((rep) => rep.mode !== "offline")
		.map((rep) => ({
			name: rep.name,
			dist: haversineMiles(rep.lat, rep.lng, zone.centroidLat, zone.centroidLng),
		}))
		.sort((a, b) => a.dist - b.dist)[0];

	return makeException(
		"no_rep_in_hot_zone",
		"critical",
		`No Rep in ${zone.name}`,
		`${zone.name} (score ${zone.score}) has ${zone.unworkedHouseCount} unworked houses and no active rep within 10 miles.`,
		nearestRep
			? `Deploy to ${zone.name}. Nearest available rep: ${nearestRep.name} (${nearestRep.dist.toFixed(1)} mi away).`
			: `Deploy to ${zone.name}. No reps currently available.`,
		{
			stormZoneId: zone.id,
			stormZoneName: zone.name,
			lat: zone.centroidLat,
			lng: zone.centroidLng,
		},
		now,
	);
}

function detectCoverageGap(zone: ZoneState, reps: RepState[], now: string): OpsException | null {
	if (zone.score < 50) return null;
	if (zone.unworkedHouseCount < 20) return null;

	const anyRepNearby = reps.some((rep) => {
		if (rep.mode === "offline") return false;
		const dist = haversineMiles(rep.lat, rep.lng, zone.centroidLat, zone.centroidLng);
		return dist <= zone.radiusMiles + 3;
	});
	if (anyRepNearby) return null;

	return makeException(
		"coverage_gap",
		"info",
		`Coverage Gap: ${zone.name}`,
		`${zone.unworkedHouseCount} unworked houses in ${zone.name} with no nearby rep.`,
		`Consider deploying a rep to cover this area.`,
		{
			stormZoneId: zone.id,
			stormZoneName: zone.name,
			lat: zone.centroidLat,
			lng: zone.centroidLng,
		},
		now,
	);
}

// ── Global detections ────────────────────────────────────────────────────────

function detectExportBacklog(backlogCount: number, now: string): OpsException | null {
	if (backlogCount <= 10) return null;

	return makeException(
		"export_backlog_growing",
		"warning",
		`Export Backlog: ${backlogCount} Items`,
		`${backlogCount} qualified opportunities have been pending export for over 2 hours.`,
		"Process the export queue or check JobNimbus connection health.",
		{ backlogCount },
		now,
	);
}

// ── Main detection function ──────────────────────────────────────────────────

/**
 * Pure function: given the current state of all reps, zones, and global
 * metrics, returns every exception that should be active right now.
 */
export function detectExceptions(state: TeamState): OpsException[] {
	const { reps, zones, exportBacklogCount, now, workingHoursStart, workingHoursEnd } = state;
	const exceptions: OpsException[] = [];

	// Per-rep detections
	for (const rep of reps) {
		// heartbeat_lost subsumes idle_rep — only emit one
		const heartbeatLost = detectHeartbeatLost(rep, now);
		if (heartbeatLost) {
			exceptions.push(heartbeatLost);
		} else {
			const idle = detectIdleRep(rep, now);
			if (idle) exceptions.push(idle);
		}

		const offRoute = detectOffRoute(rep, now);
		if (offRoute) exceptions.push(offRoute);

		const battery = detectBatteryCritical(rep, now);
		if (battery) exceptions.push(battery);

		const lowQuality = detectLowQualityOutcomes(rep, now);
		if (lowQuality) exceptions.push(lowQuality);

		const overtime = detectMissionOvertime(rep, now);
		if (overtime) exceptions.push(overtime);

		const clusterNearby = detectMissionNearlyCompleteClusterNearby(rep, zones, now);
		if (clusterNearby) exceptions.push(clusterNearby);

		const inactive = detectRepInactiveDuringHours(rep, now, workingHoursStart, workingHoursEnd);
		if (inactive) exceptions.push(inactive);
	}

	// Per-zone detections
	for (const zone of zones) {
		const noRep = detectNoRepInHotZone(zone, reps, now);
		if (noRep) exceptions.push(noRep);

		const gap = detectCoverageGap(zone, reps, now);
		if (gap) exceptions.push(gap);
	}

	// Global detections
	const backlog = detectExportBacklog(exportBacklogCount, now);
	if (backlog) exceptions.push(backlog);

	// Sort: critical first, then warning, then info; within severity, newest first
	const severityOrder: Record<ExceptionSeverity, number> = { critical: 0, warning: 1, info: 2 };
	exceptions.sort((a, b) => {
		const sevDiff = severityOrder[a.severity] - severityOrder[b.severity];
		if (sevDiff !== 0) return sevDiff;
		return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
	});

	return exceptions;
}

// ── Leaderboard Calculation ──────────────────────────────────────────────────

export interface LeaderboardInput {
	userId: string;
	name: string;
	avatarUrl: string | null;
	branchName: string | null;
	doorsKnocked: number;
	appointmentsSet: number;
	noAnswerCount: number;
	activeMinutes: number;
	missionsCompleted: number;
	estimatedPipeline: number;
}

export interface LeaderboardResult {
	rank: number;
	userId: string;
	name: string;
	avatarUrl: string | null;
	branchName: string | null;
	metrics: {
		doorsKnocked: number;
		appointmentsSet: number;
		conversionRate: number;
		noAnswerCount: number;
		doorsPerHour: number;
		activeMinutes: number;
		missionsCompleted: number;
		estimatedPipeline: number;
	};
	rankDelta: number | null;
}

export function computeLeaderboard(entries: LeaderboardInput[]): LeaderboardResult[] {
	const ranked = [...entries]
		.sort((a, b) => b.doorsKnocked - a.doorsKnocked)
		.map((entry, index) => {
			const activeHours = entry.activeMinutes / 60;
			return {
				rank: index + 1,
				userId: entry.userId,
				name: entry.name,
				avatarUrl: entry.avatarUrl,
				branchName: entry.branchName,
				metrics: {
					doorsKnocked: entry.doorsKnocked,
					appointmentsSet: entry.appointmentsSet,
					conversionRate: entry.doorsKnocked > 0
						? Math.round((entry.appointmentsSet / entry.doorsKnocked) * 100) / 100
						: 0,
					noAnswerCount: entry.noAnswerCount,
					doorsPerHour: activeHours > 0
						? Math.round((entry.doorsKnocked / activeHours) * 10) / 10
						: 0,
					activeMinutes: entry.activeMinutes,
					missionsCompleted: entry.missionsCompleted,
					estimatedPipeline: entry.estimatedPipeline,
				},
				rankDelta: null,
			};
		});

	return ranked;
}
