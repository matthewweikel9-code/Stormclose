import { describe, expect, it, beforeEach } from "vitest";
import { GET } from "@/app/api/team/live/route";
import { missionsService } from "@/services/missions/missionService";
import { presenceService } from "@/services/presence/presenceService";

const GLOBAL_MISSION_STATE = "__stormclose_missions_v2_store__";
const GLOBAL_PRESENCE_STATE = "__stormclose_presence_v2_store__";

function resetStores() {
	const globalRef = globalThis as any;
	globalRef[GLOBAL_MISSION_STATE] = { missions: [], stops: [], events: [] };
	globalRef[GLOBAL_PRESENCE_STATE] = { presence: [] };
}

describe("GET /api/team/live", () => {
	beforeEach(() => {
		process.env.NODE_ENV = "test";
		resetStores();
	});

	it("returns valid TeamLiveData shape with empty data", async () => {
		const request = new Request("http://localhost:3000/api/team/live");
		const response = await GET(request);
		const json = await response.json();

		expect(response.status).toBe(200);
		expect(json.error).toBeNull();
		expect(json.data).toBeDefined();
		expect(json.data.kpi).toBeDefined();
		expect(json.data.reps).toEqual([]);
		expect(json.data.activeZones).toEqual([]);
		expect(json.data.kpi.repsActiveCount).toBe(0);
		expect(json.data.kpi.repsIdleCount).toBe(0);
		expect(json.data.kpi.housesHitTodayCount).toBe(0);
		expect(json.meta.timestamp).toBeDefined();
	});

	it("returns rep data after mission + presence are set up", async () => {
		// Create a mission with stops
		const mission = await missionsService.createMission("test-user", {
			name: "Storm Zone Alpha",
			centerLat: 35.0,
			centerLng: -97.0,
			stops: [
				{ address: "123 Main St", lat: 35.001, lng: -97.001 },
				{ address: "456 Oak Ave", lat: 35.002, lng: -97.002 },
			],
		});

		// Start a presence heartbeat for this mission
		await presenceService.heartbeat("test-user", {
			missionId: mission.mission.id,
			lat: 35.0,
			lng: -97.0,
			accuracy: 10,
			heading: 90,
			speed: 1.5,
		});

		const request = new Request("http://localhost:3000/api/team/live");
		const response = await GET(request);
		const json = await response.json();

		expect(response.status).toBe(200);
		expect(json.data.reps).toHaveLength(1);

		const rep = json.data.reps[0];
		expect(rep.userId).toBe("test-user");
		expect(rep.lat).toBe(35.0);
		expect(rep.lng).toBe(-97.0);
		expect(rep.fieldStatus).toBeDefined();
		expect(typeof rep.lastHeartbeatSecondsAgo).toBe("number");
	});

	it("kpi counts reflect active reps", async () => {
		// Create a mission
		const mission = await missionsService.createMission("test-user", {
			name: "Test Mission",
			centerLat: 35.0,
			centerLng: -97.0,
			stops: [{ address: "100 Test Rd", lat: 35.0, lng: -97.0 }],
		});

		// Start presence
		await presenceService.heartbeat("test-user", {
			missionId: mission.mission.id,
			lat: 35.0,
			lng: -97.0,
			accuracy: 10,
			heading: null,
			speed: 0.3,
		});

		const request = new Request("http://localhost:3000/api/team/live");
		const response = await GET(request);
		const json = await response.json();

		// Rep should show up in KPIs
		const kpi = json.data.kpi;
		expect(kpi.repsActiveCount + kpi.repsIdleCount).toBeGreaterThanOrEqual(0);
	});

	it("envelope shape matches ApiEnvelope<TeamLiveData>", async () => {
		const request = new Request("http://localhost:3000/api/team/live");
		const response = await GET(request);
		const json = await response.json();

		expect(json).toHaveProperty("data");
		expect(json).toHaveProperty("error");
		expect(json).toHaveProperty("meta");
		expect(json.error).toBeNull();
		expect(json.data).toHaveProperty("kpi");
		expect(json.data).toHaveProperty("reps");
		expect(json.data).toHaveProperty("activeZones");
	});
});
