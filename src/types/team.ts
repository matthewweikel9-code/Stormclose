import type { MissionStatus, MissionStopStatus } from "@/types/missions";

// ── KPI Strip ────────────────────────────────────────────────────────────────

export interface TeamKpiStrip {
	repsActiveCount: number;
	repsIdleCount: number;
	exceptionCount: number;
	housesHitTodayCount: number;
	avgDoorsPerHour: number;
}

// ── Rep Field Status ─────────────────────────────────────────────────────────

export type RepFieldStatus = "active" | "idle" | "driving" | "at_door" | "offline" | "paused";

// ── Live Rep Position ────────────────────────────────────────────────────────

export interface TeamRepPosition {
	userId: string;
	name: string;
	avatarUrl: string | null;
	lat: number;
	lng: number;
	accuracyMeters: number;
	heading: number | null;
	speedMps: number | null;
	batteryPercent: number | null;
	fieldStatus: RepFieldStatus;
	activeMission: {
		id: string;
		name: string;
		stormZoneName: string | null;
		stopsCompleted: number;
		stopsRemaining: number;
		completionPercent: number;
	} | null;
	currentStopAddress: string | null;
	lastHeartbeatSecondsAgo: number;
	teamId: string;
	branchId: string | null;
	branchName: string | null;
}

// ── Zone Overlay (for map) ───────────────────────────────────────────────────

export interface TeamZoneOverlay {
	id: string;
	name: string;
	score: number;
	centroidLat: number;
	centroidLng: number;
	radiusMiles: number;
	unworkedHouseCount: number;
	hasCoverage: boolean;
}

// ── Team Live Response ───────────────────────────────────────────────────────

export interface TeamLiveData {
	kpi: TeamKpiStrip;
	reps: TeamRepPosition[];
	activeZones: TeamZoneOverlay[];
}

// ── Exception Types ──────────────────────────────────────────────────────────

export type ExceptionSeverity = "critical" | "warning" | "info";

export type ExceptionType =
	| "idle_rep"
	| "off_route"
	| "no_rep_in_hot_zone"
	| "mission_nearly_complete_cluster_nearby"
	| "low_quality_outcomes"
	| "export_backlog_growing"
	| "battery_critical"
	| "rep_inactive_during_hours"
	| "coverage_gap"
	| "heartbeat_lost"
	| "mission_overtime"
	| "duplicate_zone_deployment";

export interface OpsException {
	id: string;
	type: ExceptionType;
	severity: ExceptionSeverity;
	title: string;
	description: string;
	suggestedAction: string;
	context: {
		repId?: string;
		repName?: string;
		missionId?: string;
		missionName?: string;
		stormZoneId?: string;
		stormZoneName?: string;
		lat?: number;
		lng?: number;
		minutesIdle?: number;
		distanceOffRouteMiles?: number;
		consecutiveOutcomes?: number;
		batteryPercent?: number;
		backlogCount?: number;
		overlapPercent?: number;
		activeHours?: number;
	};
	acknowledged: boolean;
	acknowledgedBy: string | null;
	acknowledgedAt: string | null;
	resolvedAt: string | null;
	createdAt: string;
	expiresAt: string;
}

export interface ExceptionBadge {
	type: ExceptionType;
	severity: ExceptionSeverity;
	shortLabel: string;
}

// ── Leaderboard ──────────────────────────────────────────────────────────────

export type LeaderboardPeriod = "today" | "week" | "month";

export interface LeaderboardEntry {
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

// ── Rep Detail Drawer ────────────────────────────────────────────────────────

export interface RepDetail {
	userId: string;
	name: string;
	email: string;
	phone: string | null;
	avatarUrl: string | null;
	role: "rep";
	teamId: string;
	branchId: string | null;
	branchName: string | null;
	presence: TeamRepPosition | null;
	activeMission: {
		id: string;
		name: string;
		stormZoneName: string | null;
		status: "planned" | "active" | "paused";
		startedAt: string | null;
		stopsCompleted: number;
		stopsRemaining: number;
		completionPercent: number;
		remainingStops: Array<{
			id: string;
			address: string;
			opportunityScore: number;
			status: string;
			sequence: number;
		}>;
		routePolyline: string | null;
	} | null;
	todayStats: {
		doorsKnocked: number;
		appointmentsSet: number;
		conversionRate: number;
		activeMinutes: number;
		noAnswerCount: number;
	};
	performanceLast30Days: {
		missionsCompleted: number;
		totalDoors: number;
		totalAppointments: number;
		avgDoorsPerHour: number;
		avgConversionRate: number;
	};
	activeExceptions: OpsException[];
	recentMissions: Array<{
		id: string;
		name: string;
		status: string;
		completedAt: string | null;
		stopsTotal: number;
		stopsInterested: number;
	}>;
}

// ── Reassign Request ─────────────────────────────────────────────────────────

export interface ReassignRequest {
	repId: string;
	toMissionId?: string;
	toStormZoneId?: string;
	reason?: string;
}

export interface ReassignResponse {
	mission: {
		id: string;
		name: string;
		status: MissionStatus;
		assignedRepId: string;
	};
	previousMissionId: string | null;
}

// ── Exception Detection Input ────────────────────────────────────────────────

export interface RepState {
	userId: string;
	name: string;
	lat: number;
	lng: number;
	speed: number | null;
	batteryPercent: number | null;
	mode: "active_mission" | "idle" | "offline";
	lastHeartbeatAt: string;
	missionId: string | null;
	missionName: string | null;
	missionStatus: MissionStatus | null;
	missionStartedAt: string | null;
	stopsRemaining: number;
	recentOutcomes: MissionStopStatus[];
	nearestStopDistanceMiles: number | null;
	hasPlannedMission: boolean;
	plannedMissionName: string | null;
}

export interface ZoneState {
	id: string;
	name: string;
	score: number;
	centroidLat: number;
	centroidLng: number;
	radiusMiles: number;
	unworkedHouseCount: number;
	activeMissionCount: number;
}

export interface TeamState {
	reps: RepState[];
	zones: ZoneState[];
	exportBacklogCount: number;
	now: string;
	workingHoursStart: string;
	workingHoursEnd: string;
}
