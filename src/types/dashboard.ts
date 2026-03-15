export type StormSeverity = "extreme" | "severe" | "moderate" | "minor";
export type ScoreTier = "hot" | "warm" | "moderate" | "cold";

export interface DashboardKpiStrip {
	housesToHitCount: number;
	activeMissionCount: number;
	repsInFieldCount: number;
	exportsTodayCount: number;
}

export interface AIDailyBriefHighlight {
	category: "storm" | "mission" | "team" | "export" | "opportunity";
	text: string;
	href: string | null;
}

export interface AIDailyBrief {
	summary: string;
	highlights: AIDailyBriefHighlight[];
	generatedAt: string;
	model: string;
	tokenCount: number;
}

export type HouseStatus =
	| "new"
	| "targeted"
	| "attempted"
	| "no_answer"
	| "interested"
	| "not_interested"
	| "follow_up_needed"
	| "sent_to_jobnimbus";

export interface HouseToHit {
	id: string;
	address: string;
	neighborhood: string;
	city: string;
	state: string;
	zip: string;
	stormZoneId: string;
	stormZoneName: string;
	opportunityScore: number;
	scoreTier: ScoreTier;
	stormAgeDays: number;
	stormSeverity: StormSeverity;
	estimatedValueBand: "$5k–$10k" | "$10k–$20k" | "$20k–$40k" | "$40k+" | "Unknown";
	assignedRepId: string | null;
	assignedRepName: string | null;
	missionId: string | null;
	status: HouseStatus;
	distanceMiles: number | null;
	aiRankingReason: string;
	lat: number;
	lng: number;
	yearBuilt: number | null;
	roofAge: number | null;
	assessedValue: number | null;
}

export interface ZoneGeometry {
	type: "Polygon";
	coordinates: number[][][];
}

export interface StormZoneSummary {
	id: string;
	name: string;
	score: number;
	severity: StormSeverity;
	houseCount: number;
	unworkedHouseCount: number;
	stormAgeDays: number;
	lat: number;
	lng: number;
	geometry: ZoneGeometry | null;
	activeMissionCount: number;
}

export interface DeploymentAssignment {
	repId: string;
	repName: string;
	stormZoneId: string;
	stormZoneName: string;
	estimatedHouseCount: number;
	missionCreated: boolean;
	missionId: string | null;
}

export interface AIDeploymentPlan {
	generated: boolean;
	generatedAt: string | null;
	status: "pending_approval" | "approved" | "auto_applied" | "expired";
	assignments: DeploymentAssignment[];
	reasoning: string;
}

export interface RepSnapshotRow {
	id: string;
	name: string;
	avatarUrl: string | null;
	fieldStatus: "active" | "idle" | "offline" | "paused";
	activeMissionId: string | null;
	activeMissionName: string | null;
	housesCompleted: number;
	housesRemaining: number;
	lastHeartbeatSecondsAgo: number;
}

export interface LiveTeamSnapshot {
	totalReps: number;
	repsInField: number;
	repsIdle: number;
	repsUndeployed: number;
	reps: RepSnapshotRow[];
}

export interface HotCluster {
	id: string;
	label: string;
	stormZoneId: string;
	stormZoneName: string;
	unworkedHouseCount: number;
	avgOpportunityScore: number;
	lat: number;
	lng: number;
	nearestRepDistanceMiles: number | null;
	nearestRepName: string | null;
}

export interface RecentQualifiedOpportunity {
	id: string;
	address: string;
	city: string;
	state: string;
	opportunityScore: number;
	estimatedValueBand: "$5k–$10k" | "$10k–$20k" | "$20k–$40k" | "$40k+" | "Unknown";
	repName: string;
	qualifiedAt: string;
	exportStatus: "not_exported" | "queued" | "exported" | "failed";
	stormZoneName: string;
}

export interface RecentExportRow {
	id: string;
	address: string;
	status: "success" | "failed" | "pending" | "retrying";
	exportedAt: string;
	errorMessage: string | null;
}

export interface ExportQueueSummary {
	readyCount: number;
	exportedTodayCount: number;
	failedCount: number;
	retryQueueCount: number;
	successRatePercent: number;
	recentExports: RecentExportRow[];
}

export interface DataSourceStatus {
	source: "xweather" | "nws" | "corelogic" | "jobnimbus" | "openai" | "mapbox" | "google_directions";
	label: string;
	lastSyncAt: string | null;
	minutesSinceSync: number | null;
	status: "healthy" | "stale" | "down" | "unknown";
	lastError: string | null;
}

export interface DataHealth {
	sources: DataSourceStatus[];
	overallHealth: "healthy" | "degraded" | "unhealthy";
}

export interface DashboardTodayData {
	kpi: DashboardKpiStrip;
	aiDailyBrief: AIDailyBrief;
	housesToHitToday: HouseToHit[];
	topStormZones: StormZoneSummary[];
	aiDeploymentPlan: AIDeploymentPlan;
	liveTeamSnapshot: LiveTeamSnapshot;
	unassignedHotClusters: HotCluster[];
	recentQualifiedOpps: RecentQualifiedOpportunity[];
	exportQueueSummary: ExportQueueSummary;
	dataHealth: DataHealth;
}

export interface ApiEnvelope<T> {
	data: T;
	error: string | null;
	meta: Record<string, unknown>;
}
