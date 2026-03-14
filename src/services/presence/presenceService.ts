import { createClient } from "@/lib/supabase/server";
import { rankNextBestHouse } from "@/lib/nextBestHouse";
import { missionsService } from "@/services/missions/missionService";
import type { NextBestHouseResult, PresenceMode, RepPresence } from "@/types/missions";

type InMemoryPresenceState = {
	presence: RepPresence[];
};

const GLOBAL_PRESENCE_STATE = "__stormclose_presence_v2_store__";

function getInMemoryPresenceState(): InMemoryPresenceState {
	const globalRef = globalThis as typeof globalThis & { [GLOBAL_PRESENCE_STATE]?: InMemoryPresenceState };
	if (!globalRef[GLOBAL_PRESENCE_STATE]) {
		globalRef[GLOBAL_PRESENCE_STATE] = { presence: [] };
	}
	return globalRef[GLOBAL_PRESENCE_STATE] as InMemoryPresenceState;
}

function toPresence(row: any): RepPresence {
	return {
		id: String(row.id),
		userId: String(row.user_id),
		missionId: row.mission_id ? String(row.mission_id) : null,
		lat: Number(row.lat),
		lng: Number(row.lng),
		accuracy: Number.isFinite(row.accuracy) ? Number(row.accuracy) : null,
		heading: Number.isFinite(row.heading) ? Number(row.heading) : null,
		speed: Number.isFinite(row.speed) ? Number(row.speed) : null,
		recordedAt: String(row.recorded_at || new Date().toISOString()),
		mode: (row.mode || "idle") as PresenceMode,
		createdAt: String(row.created_at || new Date().toISOString()),
		updatedAt: String(row.updated_at || new Date().toISOString()),
	};
}

function nextIntervalForSpeed(speed: number | null): number {
	if (speed !== null && speed > 2) return 15;
	if (speed !== null && speed <= 0.5) return 60;
	return 30;
}

export interface PresenceHeartbeatInput {
	missionId: string;
	lat: number;
	lng: number;
	accuracy: number | null;
	heading: number | null;
	speed: number | null;
}

export interface PresenceHeartbeatResult {
	presence: RepPresence;
	nextBest: NextBestHouseResult;
	nextIntervalSeconds: number;
}

export class PresenceService {
	private isTestMode() {
		return process.env.NODE_ENV === "test";
	}

	async startMission(userId: string, missionId: string) {
		const mission = await missionsService.updateMission(userId, missionId, { status: "active" });
		const presence = await this.upsertPresence(userId, {
			missionId,
			lat: mission.centerLat ?? 0,
			lng: mission.centerLng ?? 0,
			accuracy: null,
			heading: null,
			speed: 0,
		}, "active_mission");
		return { mission, presence };
	}

	async endMission(userId: string, missionId: string, mode: "idle" | "offline" = "idle") {
		const mission = await missionsService.updateMission(userId, missionId, { status: "paused" });
		const presence = await this.upsertPresence(
			userId,
			{
				missionId,
				lat: mission.centerLat ?? 0,
				lng: mission.centerLng ?? 0,
				accuracy: null,
				heading: null,
				speed: 0,
			},
			mode
		);
		return { mission, presence };
	}

	async heartbeat(userId: string, input: PresenceHeartbeatInput): Promise<PresenceHeartbeatResult> {
		const detail = await missionsService.getMissionDetail(userId, input.missionId);
		const presence = await this.upsertPresence(userId, input, "active_mission");

		const remainingStops = detail.stops
			.filter((stop) => !["sent_to_jobnimbus", "not_interested"].includes(stop.status))
			.map((stop) => ({
				id: stop.id,
				address: stop.address,
				lat: stop.lat,
				lng: stop.lng,
				opportunityScore: stop.opportunityScore,
				stormAgeDays: 5,
				estimatedValueBand: "$10k–$20k",
				attemptCount: Number((stop.outcomeData?.attemptCount as number) || 0),
				status: stop.status,
				stormZoneName: "Mission Zone",
			}));

		const nextBest = rankNextBestHouse({
			currentLat: input.lat,
			currentLng: input.lng,
			remainingStops,
			nearbyUnassigned: [],
			currentTime: new Date().toISOString(),
			workingHoursEnd: "18:00",
			avgMinutesPerStop: 12,
			allowMidMissionAdditions: true,
		});

		return {
			presence,
			nextBest,
			nextIntervalSeconds: nextIntervalForSpeed(input.speed),
		};
	}

	private async upsertPresence(userId: string, input: PresenceHeartbeatInput, mode: PresenceMode): Promise<RepPresence> {
		const now = new Date().toISOString();
		if (this.isTestMode()) {
			const state = getInMemoryPresenceState();
			const existing = state.presence.find((item) => item.userId === userId);
			if (existing) {
				existing.missionId = input.missionId;
				existing.lat = input.lat;
				existing.lng = input.lng;
				existing.accuracy = input.accuracy;
				existing.heading = input.heading;
				existing.speed = input.speed;
				existing.mode = mode;
				existing.recordedAt = now;
				existing.updatedAt = now;
				return existing;
			}

			const created: RepPresence = {
				id: crypto.randomUUID(),
				userId,
				missionId: input.missionId,
				lat: input.lat,
				lng: input.lng,
				accuracy: input.accuracy,
				heading: input.heading,
				speed: input.speed,
				recordedAt: now,
				mode,
				createdAt: now,
				updatedAt: now,
			};
			state.presence.push(created);
			return created;
		}

		const supabase = await createClient();
		const { data, error } = await (supabase.from("rep_presence") as any)
			.upsert(
				{
					user_id: userId,
					mission_id: input.missionId,
					lat: input.lat,
					lng: input.lng,
					accuracy: input.accuracy,
					heading: input.heading,
					speed: input.speed,
					recorded_at: now,
					mode,
					updated_at: now,
				},
				{ onConflict: "user_id" }
			)
			.select("*")
			.single();
		if (error) throw error;
		return toPresence(data);
	}
}

export const presenceService = new PresenceService();
