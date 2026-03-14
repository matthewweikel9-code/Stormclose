// ── Mission Control Types ────────────────────────────────────────────────────
// Data contract for GET /api/mission-control/live

export type LiveBadgeStatus = "live" | "delayed" | "offline";

export type RepDotStatus = "active" | "at_door" | "driving" | "idle" | "offline";

// ── KPI Values ───────────────────────────────────────────────────────────────

export interface MissionControlKpi {
	repsInField: number;
	activeMissions: number;
	housesLeftToHit: number;
	qualifiedToday: number;
	sentToJobNimbusToday: number;
}

// ── Rep position for map ─────────────────────────────────────────────────────

export interface McRepPosition {
	userId: string;
	name: string;
	lat: number;
	lng: number;
	fieldStatus: RepDotStatus;
	missionName: string | null;
	completionPercent: number;
	lastHeartbeatSecondsAgo: number;
}

// ── Zone overlay for map ─────────────────────────────────────────────────────

export interface McZoneOverlay {
	id: string;
	name: string;
	score: number;
	centroidLat: number;
	centroidLng: number;
	radiusMiles: number;
	houseCount: number;
	unworkedCount: number;
}

// ── Priority zone ────────────────────────────────────────────────────────────

export interface McPriorityZone {
	name: string;
	score: number;
	houseCount: number;
	unworkedCount: number;
}

// ── Hot cluster ──────────────────────────────────────────────────────────────

export interface McHotCluster {
	name: string;
	houseCount: number;
	distanceFromNearestRepMiles: number;
}

// ── Top rep ──────────────────────────────────────────────────────────────────

export interface McTopRep {
	name: string;
	doorsKnocked: number;
	appointmentsSet: number;
	conversionRate: number;
}

// ── Storm alert ──────────────────────────────────────────────────────────────

export interface McStormAlert {
	id: string;
	zoneName: string;
	eventCount: number;
	maxHailSizeInches: number | null;
	houseCount: number;
	detectedAt: string;
}

// ── Ops exception (subset for MC) ────────────────────────────────────────────

export interface McException {
	id: string;
	type: string;
	severity: "critical" | "warning" | "info";
	title: string;
	description: string;
}

// ── Ticker event ─────────────────────────────────────────────────────────────

export interface McTickerEvent {
	id: string;
	icon: string;
	text: string;
	timestamp: string;
}

// ── Aggregated response ──────────────────────────────────────────────────────

export interface MissionControlLiveData {
	/** Server timestamp */
	timestamp: string;

	/** KPI tower values */
	kpi: MissionControlKpi;

	/** All active rep positions (fed to map) */
	reps: McRepPosition[];

	/** Active storm zones for map overlay */
	zones: McZoneOverlay[];

	/** Highest-score active zone */
	priorityZone: McPriorityZone | null;

	/** Nearest unworked cluster */
	hotCluster: McHotCluster | null;

	/** Today's leading rep */
	topRep: McTopRep | null;

	/** AI-generated one-liner insights (batch of 5-10) */
	insights: string[];

	/** Recent events for bottom ticker (last 50) */
	recentEvents: McTickerEvent[];

	/** Active storm alerts */
	stormAlerts: McStormAlert[];

	/** Active ops exceptions */
	exceptions: McException[];
}
