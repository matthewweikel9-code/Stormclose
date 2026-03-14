import type { ScoreTier, StormSeverity } from "@/types/dashboard";

export type MissionStatus = "planned" | "active" | "paused" | "completed" | "expired";

export type MissionStopStatus =
	| "new"
	| "targeted"
	| "attempted"
	| "no_answer"
	| "interested"
	| "not_interested"
	| "follow_up_needed"
	| "sent_to_jobnimbus";

export type PresenceMode = "active_mission" | "idle" | "offline";

export interface Mission {
	id: string;
	createdBy: string;
	assignedRepId: string | null;
	stormEventId: string | null;
	name: string;
	description: string | null;
	status: MissionStatus;
	aiGenerated: boolean;
	approvedBy: string | null;
	deploymentRecommendation: Record<string, unknown>;
	centerLat: number | null;
	centerLng: number | null;
	radiusMiles: number | null;
	startedAt: string | null;
	completedAt: string | null;
	expiresAt: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface MissionStop {
	id: string;
	missionId: string;
	houseId: string | null;
	sequence: number;
	status: MissionStopStatus;
	outcomeData: Record<string, unknown>;
	arrivedAt: string | null;
	departedAt: string | null;
	notes: string | null;
	address: string;
	city: string | null;
	state: string | null;
	zip: string | null;
	lat: number;
	lng: number;
	opportunityScore: number;
	scoreTier: ScoreTier | null;
	stormSeverity: StormSeverity | null;
	createdAt: string;
	updatedAt: string;
}

export interface RepPresence {
	id: string;
	userId: string;
	missionId: string | null;
	lat: number;
	lng: number;
	accuracy: number | null;
	heading: number | null;
	speed: number | null;
	recordedAt: string;
	mode: PresenceMode;
	createdAt: string;
	updatedAt: string;
}

export interface MissionEvent {
	id: string;
	missionId: string;
	eventType: string;
	payload: Record<string, unknown>;
	createdAt: string;
}

export interface CreateMissionInput {
	name: string;
	description?: string;
	assignedRepId?: string | null;
	stormEventId?: string | null;
	aiGenerated?: boolean;
	approvedBy?: string | null;
	deploymentRecommendation?: Record<string, unknown>;
	centerLat?: number | null;
	centerLng?: number | null;
	radiusMiles?: number | null;
	stops?: Array<{
		houseId?: string | null;
		sequence?: number;
		status?: MissionStopStatus;
		outcomeData?: Record<string, unknown>;
		arrivedAt?: string | null;
		departedAt?: string | null;
		notes?: string;
		address: string;
		city?: string;
		state?: string;
		zip?: string;
		lat: number;
		lng: number;
		opportunityScore?: number;
		scoreTier?: ScoreTier | null;
		stormSeverity?: StormSeverity | null;
	}>;
}

export interface UpdateMissionInput {
	status?: MissionStatus;
	assignedRepId?: string | null;
	description?: string | null;
	deploymentRecommendation?: Record<string, unknown>;
}

export interface StopOutcomeInput {
	status: MissionStopStatus;
	outcomeData?: Record<string, unknown>;
	notes?: string | null;
	arrivedAt?: string | null;
	departedAt?: string | null;
}

export interface MissionFilters {
	status?: MissionStatus;
	assignedRepId?: string;
	aiGenerated?: boolean;
	q?: string;
	limit?: number;
}

export interface NextBestHouseSuggestion {
	rank: number;
	source: "mission_stop" | "unassigned";
	stopId: string | null;
	targetId: string | null;
	address: string;
	lat: number;
	lng: number;
	distanceMiles: number;
	estimatedDriveMinutes: number;
	opportunityScore: number;
	candidateScore: number;
	reasons: string[];
	stormZoneName: string;
	estimatedValueBand: string;
}

export interface NextBestHouseResult {
	suggestions: NextBestHouseSuggestion[];
	includesUnassigned: boolean;
	estimatedRemainingCapacity: number;
	generatedAt: string;
}
