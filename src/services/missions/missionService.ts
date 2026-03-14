import { createClient } from "@/lib/supabase/server";
import type {
	CreateMissionInput,
	Mission,
	MissionFilters,
	MissionStatus,
	MissionStop,
	StopOutcomeInput,
	UpdateMissionInput,
} from "@/types/missions";

interface MissionDetail {
	mission: Mission;
	stops: MissionStop[];
}

type MissionEventRow = {
	id: string;
	mission_id: string;
	event_type: string;
	payload: Record<string, unknown>;
	created_at: string;
};

type InMemoryState = {
	missions: Mission[];
	stops: MissionStop[];
	events: MissionEventRow[];
};

const GLOBAL_MISSION_STATE = "__stormclose_missions_v2_store__";

function getInMemoryState(): InMemoryState {
	const globalRef = globalThis as typeof globalThis & { [GLOBAL_MISSION_STATE]?: InMemoryState };
	if (!globalRef[GLOBAL_MISSION_STATE]) {
		globalRef[GLOBAL_MISSION_STATE] = { missions: [], stops: [], events: [] };
	}
	return globalRef[GLOBAL_MISSION_STATE] as InMemoryState;
}

function toMission(row: any): Mission {
	return {
		id: String(row.id),
		createdBy: String(row.created_by),
		assignedRepId: row.assigned_rep_id ? String(row.assigned_rep_id) : null,
		stormEventId: row.storm_event_id ? String(row.storm_event_id) : null,
		name: String(row.name),
		description: row.description ? String(row.description) : null,
		status: (row.status || "planned") as MissionStatus,
		aiGenerated: Boolean(row.ai_generated),
		approvedBy: row.approved_by ? String(row.approved_by) : null,
		deploymentRecommendation: (row.deployment_recommendation || {}) as Record<string, unknown>,
		centerLat: Number.isFinite(row.center_lat) ? Number(row.center_lat) : null,
		centerLng: Number.isFinite(row.center_lng) ? Number(row.center_lng) : null,
		radiusMiles: Number.isFinite(row.radius_miles) ? Number(row.radius_miles) : null,
		startedAt: row.started_at ?? null,
		completedAt: row.completed_at ?? null,
		expiresAt: row.expires_at ?? null,
		createdAt: String(row.created_at || new Date().toISOString()),
		updatedAt: String(row.updated_at || new Date().toISOString()),
	};
}

function toStop(row: any): MissionStop {
	return {
		id: String(row.id),
		missionId: String(row.mission_id),
		houseId: row.house_id ? String(row.house_id) : null,
		sequence: Number(row.sequence ?? row.stop_order ?? 0),
		status: row.status || "new",
		outcomeData: (row.outcome_data || {}) as Record<string, unknown>,
		arrivedAt: row.arrived_at ?? null,
		departedAt: row.departed_at ?? null,
		notes: row.notes ?? null,
		address: String(row.address || ""),
		city: row.city ?? null,
		state: row.state ?? null,
		zip: row.zip ?? null,
		lat: Number(row.latitude ?? row.lat ?? 0),
		lng: Number(row.longitude ?? row.lng ?? 0),
		opportunityScore: Number(row.opportunity_score ?? 0),
		scoreTier: row.score_tier ?? null,
		stormSeverity: row.storm_severity ?? null,
		createdAt: String(row.created_at || new Date().toISOString()),
		updatedAt: String(row.updated_at || new Date().toISOString()),
	};
}

function logInMemoryEvent(missionId: string, eventType: string, payload: Record<string, unknown>) {
	const state = getInMemoryState();
	state.events.unshift({
		id: crypto.randomUUID(),
		mission_id: missionId,
		event_type: eventType,
		payload,
		created_at: new Date().toISOString(),
	});
}

function canTransition(current: MissionStatus, next: MissionStatus): boolean {
	if (current === next) return true;
	if (current === "planned" && ["active", "paused", "expired"].includes(next)) return true;
	if (current === "active" && ["paused", "completed"].includes(next)) return true;
	if (current === "paused" && ["active", "expired"].includes(next)) return true;
	if (current === "expired" && next === "planned") return true;
	return false;
}

export class MissionsService {
	private isTestMode() {
		return process.env.NODE_ENV === "test";
	}

	async listMissions(userId: string, filters: MissionFilters = {}): Promise<Mission[]> {
		if (this.isTestMode()) {
			const state = getInMemoryState();
			return state.missions
				.filter((mission) => mission.createdBy === userId || mission.assignedRepId === userId)
				.filter((mission) => (filters.status ? mission.status === filters.status : true))
				.filter((mission) =>
					filters.aiGenerated === undefined ? true : mission.aiGenerated === filters.aiGenerated
				)
				.filter((mission) =>
					filters.q ? mission.name.toLowerCase().includes(filters.q.toLowerCase()) : true
				)
				.slice(0, filters.limit ?? 50);
		}

		const supabase = await createClient();
		let query = (supabase.from("missions") as any)
			.select("*")
			.or(`created_by.eq.${userId},assigned_rep_id.eq.${userId}`)
			.order("created_at", { ascending: false })
			.limit(filters.limit ?? 50);

		if (filters.status) {
			query = query.eq("status", filters.status);
		}
		if (filters.aiGenerated !== undefined) {
			query = query.eq("ai_generated", filters.aiGenerated);
		}
		if (filters.q) {
			query = query.ilike("name", `%${filters.q}%`);
		}

		const { data, error } = await query;
		if (error) throw error;
		return (data || []).map(toMission);
	}

	async createMission(userId: string, input: CreateMissionInput): Promise<MissionDetail> {
		const now = new Date().toISOString();
		if (this.isTestMode()) {
			const state = getInMemoryState();
			const mission: Mission = {
				id: crypto.randomUUID(),
				createdBy: userId,
				assignedRepId: input.assignedRepId ?? null,
				stormEventId: input.stormEventId ?? null,
				name: input.name,
				description: input.description ?? null,
				status: "planned",
				aiGenerated: Boolean(input.aiGenerated),
				approvedBy: input.approvedBy ?? null,
				deploymentRecommendation: input.deploymentRecommendation ?? {},
				centerLat: input.centerLat ?? null,
				centerLng: input.centerLng ?? null,
				radiusMiles: input.radiusMiles ?? null,
				startedAt: null,
				completedAt: null,
				expiresAt: null,
				createdAt: now,
				updatedAt: now,
			};
			state.missions.unshift(mission);

			const stops: MissionStop[] = (input.stops || []).map((stop, index) => ({
				id: crypto.randomUUID(),
				missionId: mission.id,
				houseId: stop.houseId ?? null,
				sequence: stop.sequence ?? index + 1,
				status: stop.status ?? "new",
				outcomeData: stop.outcomeData ?? {},
				arrivedAt: stop.arrivedAt ?? null,
				departedAt: stop.departedAt ?? null,
				notes: stop.notes ?? null,
				address: stop.address,
				city: stop.city ?? null,
				state: stop.state ?? null,
				zip: stop.zip ?? null,
				lat: stop.lat,
				lng: stop.lng,
				opportunityScore: stop.opportunityScore ?? 0,
				scoreTier: stop.scoreTier ?? null,
				stormSeverity: stop.stormSeverity ?? null,
				createdAt: now,
				updatedAt: now,
			}));

			state.stops.push(...stops);
			logInMemoryEvent(mission.id, "mission_created", { userId, aiGenerated: mission.aiGenerated });
			return { mission, stops };
		}

		const supabase = await createClient();
		const { data: created, error } = await (supabase.from("missions") as any)
			.insert({
				created_by: userId,
				assigned_rep_id: input.assignedRepId ?? null,
				storm_event_id: input.stormEventId ?? null,
				name: input.name,
				description: input.description ?? null,
				status: "planned",
				ai_generated: Boolean(input.aiGenerated),
				approved_by: input.approvedBy ?? null,
				deployment_recommendation: input.deploymentRecommendation ?? {},
				center_lat: input.centerLat ?? null,
				center_lng: input.centerLng ?? null,
				radius_miles: input.radiusMiles ?? null,
			})
			.select("*")
			.single();

		if (error) throw error;
		const mission = toMission(created);

		if ((input.stops || []).length > 0) {
			const { error: stopErr } = await (supabase.from("mission_stops") as any).insert(
				(input.stops || []).map((stop, index) => ({
					mission_id: mission.id,
					user_id: userId,
					house_id: stop.houseId ?? null,
					sequence: stop.sequence ?? index + 1,
					status: stop.status ?? "new",
					outcome_data: stop.outcomeData ?? {},
					arrived_at: stop.arrivedAt ?? null,
					departed_at: stop.departedAt ?? null,
					notes: stop.notes ?? null,
					address: stop.address,
					city: stop.city ?? null,
					state: stop.state ?? null,
					zip: stop.zip ?? null,
					latitude: stop.lat,
					longitude: stop.lng,
					opportunity_score: stop.opportunityScore ?? 0,
					score_tier: stop.scoreTier ?? null,
					storm_severity: stop.stormSeverity ?? null,
					stop_order: stop.sequence ?? index + 1,
					outcome: "pending",
				}))
			);
			if (stopErr) throw stopErr;
		}

		await (supabase.from("mission_events") as any).insert({
			mission_id: mission.id,
			event_type: "mission_created",
			payload: { userId, aiGenerated: mission.aiGenerated },
		});

		return this.getMissionDetail(userId, mission.id);
	}

	async getMissionDetail(userId: string, missionId: string): Promise<MissionDetail> {
		if (this.isTestMode()) {
			const state = getInMemoryState();
			const mission = state.missions.find((row) => row.id === missionId);
			if (!mission) {
				throw new Error("Mission not found");
			}
			if (mission.createdBy !== userId && mission.assignedRepId !== userId) {
				throw new Error("Forbidden");
			}
			const stops = state.stops
				.filter((stop) => stop.missionId === mission.id)
				.sort((a, b) => a.sequence - b.sequence);
			return { mission, stops };
		}

		const supabase = await createClient();
		const { data: missionRow, error: missionError } = await (supabase.from("missions") as any)
			.select("*")
			.eq("id", missionId)
			.or(`created_by.eq.${userId},assigned_rep_id.eq.${userId}`)
			.single();
		if (missionError || !missionRow) {
			throw new Error("Mission not found");
		}

		const { data: stopRows, error: stopError } = await (supabase.from("mission_stops") as any)
			.select("*")
			.eq("mission_id", missionId)
			.order("sequence", { ascending: true });
		if (stopError) throw stopError;

		return {
			mission: toMission(missionRow),
			stops: (stopRows || []).map(toStop),
		};
	}

	async updateMission(userId: string, missionId: string, patch: UpdateMissionInput): Promise<Mission> {
		if (this.isTestMode()) {
			const state = getInMemoryState();
			const mission = state.missions.find((row) => row.id === missionId);
			if (!mission) throw new Error("Mission not found");
			if (mission.createdBy !== userId && mission.assignedRepId !== userId) throw new Error("Forbidden");

			const nextStatus = patch.status ?? mission.status;
			if (patch.status && !canTransition(mission.status, nextStatus)) {
				throw new Error(`Invalid transition ${mission.status} -> ${patch.status}`);
			}

			mission.status = nextStatus;
			mission.assignedRepId = patch.assignedRepId === undefined ? mission.assignedRepId : patch.assignedRepId;
			mission.description = patch.description === undefined ? mission.description : patch.description;
			mission.deploymentRecommendation = patch.deploymentRecommendation ?? mission.deploymentRecommendation;
			if (patch.status === "active" && !mission.startedAt) mission.startedAt = new Date().toISOString();
			if (patch.status === "completed") mission.completedAt = new Date().toISOString();
			mission.updatedAt = new Date().toISOString();
			logInMemoryEvent(mission.id, "mission_updated", { patch, userId });
			return mission;
		}

		const current = await this.getMissionDetail(userId, missionId);
		if (patch.status && !canTransition(current.mission.status, patch.status)) {
			throw new Error(`Invalid transition ${current.mission.status} -> ${patch.status}`);
		}

		const supabase = await createClient();
		const updatePayload: Record<string, unknown> = {
			updated_at: new Date().toISOString(),
		};
		if (patch.status) updatePayload.status = patch.status;
		if (patch.assignedRepId !== undefined) updatePayload.assigned_rep_id = patch.assignedRepId;
		if (patch.description !== undefined) updatePayload.description = patch.description;
		if (patch.deploymentRecommendation) {
			updatePayload.deployment_recommendation = patch.deploymentRecommendation;
		}
		if (patch.status === "active") {
			updatePayload.started_at = new Date().toISOString();
		}
		if (patch.status === "completed") {
			updatePayload.completed_at = new Date().toISOString();
		}

		const { data, error } = await (supabase.from("missions") as any)
			.update(updatePayload)
			.eq("id", missionId)
			.or(`created_by.eq.${userId},assigned_rep_id.eq.${userId}`)
			.select("*")
			.single();
		if (error) throw error;

		await (supabase.from("mission_events") as any).insert({
			mission_id: missionId,
			event_type: "mission_updated",
			payload: { patch, userId },
		});

		return toMission(data);
	}

	async recordStopOutcome(userId: string, stopId: string, input: StopOutcomeInput): Promise<MissionStop> {
		if (this.isTestMode()) {
			const state = getInMemoryState();
			const stop = state.stops.find((row) => row.id === stopId);
			if (!stop) throw new Error("Stop not found");
			const mission = state.missions.find((row) => row.id === stop.missionId);
			if (!mission) throw new Error("Mission not found");
			if (mission.createdBy !== userId && mission.assignedRepId !== userId) throw new Error("Forbidden");
			stop.status = input.status;
			stop.outcomeData = input.outcomeData ?? stop.outcomeData;
			stop.notes = input.notes ?? stop.notes;
			stop.arrivedAt = input.arrivedAt ?? stop.arrivedAt;
			stop.departedAt = input.departedAt ?? stop.departedAt;
			stop.updatedAt = new Date().toISOString();
			logInMemoryEvent(stop.missionId, "stop_outcome", { stopId, input, userId });
			return stop;
		}

		const supabase = await createClient();
		const { data: stopRow, error: findError } = await (supabase.from("mission_stops") as any)
			.select("mission_id")
			.eq("id", stopId)
			.single();
		if (findError || !stopRow) throw new Error("Stop not found");

		await this.getMissionDetail(userId, String(stopRow.mission_id));

		const { data, error } = await (supabase.from("mission_stops") as any)
			.update({
				status: input.status,
				outcome_data: input.outcomeData ?? {},
				notes: input.notes ?? null,
				arrived_at: input.arrivedAt ?? null,
				departed_at: input.departedAt ?? null,
				updated_at: new Date().toISOString(),
			})
			.eq("id", stopId)
			.select("*")
			.single();
		if (error) throw error;

		await (supabase.from("mission_events") as any).insert({
			mission_id: String(stopRow.mission_id),
			event_type: "stop_outcome",
			payload: { stopId, input, userId },
		});

		return toStop(data);
	}

	async rebalanceMission(userId: string, missionId: string): Promise<{ mission: Mission; stops: MissionStop[]; changed: boolean }> {
		const detail = await this.getMissionDetail(userId, missionId);
		const remaining = detail.stops.filter((stop) => !["sent_to_jobnimbus", "not_interested"].includes(stop.status));
		const sorted = [...remaining].sort((a, b) => b.opportunityScore - a.opportunityScore);
		const changed = sorted.some((stop, index) => stop.sequence !== index + 1);

		if (this.isTestMode()) {
			if (changed) {
				sorted.forEach((stop, index) => {
					stop.sequence = index + 1;
					stop.updatedAt = new Date().toISOString();
				});
				logInMemoryEvent(missionId, "mission_rebalanced", { userId, changed });
			}
			return {
				mission: detail.mission,
				stops: detail.stops.sort((a, b) => a.sequence - b.sequence),
				changed,
			};
		}

		if (changed) {
			const supabase = await createClient();
			for (let index = 0; index < sorted.length; index += 1) {
				const stop = sorted[index];
				await (supabase.from("mission_stops") as any)
					.update({ sequence: index + 1, stop_order: index + 1 })
					.eq("id", stop.id);
			}
			await (supabase.from("mission_events") as any).insert({
				mission_id: missionId,
				event_type: "mission_rebalanced",
				payload: { userId, changed },
			});
		}

		const refreshed = await this.getMissionDetail(userId, missionId);
		return {
			mission: refreshed.mission,
			stops: refreshed.stops,
			changed,
		};
	}
}

export const missionsService = new MissionsService();
