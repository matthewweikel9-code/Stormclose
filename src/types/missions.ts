export type MissionStatus = "planned" | "active" | "paused" | "completed" | "expired";

export type Mission = {
	id: string;
	name: string;
	status: MissionStatus;
	centerLat?: number | null;
	centerLng?: number | null;
	createdAt?: string;
	assignedRepId?: string | null;
};

export type MissionStopStatus =
	| "pending"
	| "targeted"
	| "attempted"
	| "interested"
	| "not_interested"
	| "follow_up_needed"
	| "no_answer"
	| "completed";

export type MissionStop = {
	id: string;
	missionId: string;
	houseId?: string | null;
	address: string;
	city?: string | null;
	state?: string | null;
	sequence?: number | null;
	lat: number;
	lng: number;
	status: MissionStopStatus;
};
