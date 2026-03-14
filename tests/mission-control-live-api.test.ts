import { describe, expect, it, beforeEach } from "vitest";
import { GET } from "@/app/api/mission-control/live/route";
import { missionsService } from "@/services/missions/missionService";
import { presenceService } from "@/services/presence/presenceService";

const GLOBAL_MISSION_STATE = "__stormclose_missions_v2_store__";
const GLOBAL_PRESENCE_STATE = "__stormclose_presence_v2_store__";

function resetStores() {
	const globalRef = globalThis as any;
	globalRef[GLOBAL_MISSION_STATE] = { missions: [], stops: [], events: [] };
	globalRef[GLOBAL_PRESENCE_STATE] = { presence: [] };
}

describe("GET /api/mission-control/live", () => {
	beforeEach(() => {
		process.env.NODE_ENV = "test";
		resetStores();
	});

	it("returns 200 with valid MissionControlLiveData shape (empty data)", async () => {
		const request = new Request("http://localhost:3000/api/mission-control/live");
		const response = await GET(request as any);
		const json = await response.json();

		expect(response.status).toBe(200);
		expect(json.error).toBeNull();
		expect(json.data).toBeDefined();
		expect(json.meta.timestamp).toBeDefined();

		// KPI shape
		const { kpi } = json.data;
		expect(kpi).toBeDefined();
		expect(typeof kpi.repsInField).toBe("number");
		expect(typeof kpi.activeMissions).toBe("number");
		expect(typeof kpi.housesLeftToHit).toBe("number");
		expect(typeof kpi.qualifiedToday).toBe("number");
		expect(typeof kpi.sentToJobNimbusToday).toBe("number");

		// Empty arrays
		expect(json.data.reps).toEqual([]);
		expect(json.data.zones).toEqual([]);
		expect(json.data.stormAlerts).toEqual([]);
		expect(json.data.exceptions).toEqual([]);
		expect(Array.isArray(json.data.recentEvents)).toBe(true);
		expect(Array.isArray(json.data.insights)).toBe(true);

		// Nullable fields
		expect(json.data.priorityZone).toBeNull();
		expect(json.data.hotCluster).toBeNull();
		expect(json.data.topRep).toBeNull();

		// Timestamp
		expect(typeof json.data.timestamp).toBe("string");
	});

	it("returns KPI values of zero when no data exists", async () => {
		const request = new Request("http://localhost:3000/api/mission-control/live");
		const response = await GET(request as any);
		const json = await response.json();

		expect(json.data.kpi.repsInField).toBe(0);
		expect(json.data.kpi.activeMissions).toBe(0);
		expect(json.data.kpi.housesLeftToHit).toBe(0);
		expect(json.data.kpi.qualifiedToday).toBe(0);
		expect(json.data.kpi.sentToJobNimbusToday).toBe(0);
	});

	it("includes cache-control header with stale-while-revalidate", async () => {
		const request = new Request("http://localhost:3000/api/mission-control/live");
		const response = await GET(request as any);

		const cacheControl = response.headers.get("Cache-Control");
		expect(cacheControl).toContain("stale-while-revalidate");
	});

	it("returns rep data when presence and missions exist", async () => {
		// Create a mission with stops
		const mission = await missionsService.createMission("test-user", {
			name: "Storm Zone Alpha",
			centerLat: 35.0,
			centerLng: -97.0,
			stops: [
				{ address: "123 Main St", lat: 35.001, lng: -97.001 },
				{ address: "456 Oak Ave", lat: 35.002, lng: -97.002 },
				{ address: "789 Elm Dr", lat: 35.003, lng: -97.003 },
			],
		});

		// Activate the mission and assign rep
		await missionsService.updateMission("test-user", mission.mission.id, { status: "active", assignedRepId: "rep-1" });

		// Start presence for rep
		await presenceService.heartbeat("rep-1", {
			missionId: mission.mission.id,
			lat: 35.0,
			lng: -97.0,
			accuracy: 10,
			heading: 90,
			speed: 1.5,
		});

		const request = new Request("http://localhost:3000/api/mission-control/live");
		const response = await GET(request as any);
		const json = await response.json();

		expect(response.status).toBe(200);

		// Should have 1 rep
		expect(json.data.reps).toHaveLength(1);
		expect(json.data.reps[0].userId).toBe("rep-1");
		expect(json.data.reps[0].lat).toBe(35.0);
		expect(json.data.reps[0].lng).toBe(-97.0);
		expect(json.data.reps[0].fieldStatus).toBeDefined();
		expect(json.data.reps[0].missionName).toBe("Storm Zone Alpha");

		// Should have 1 active mission
		expect(json.data.kpi.activeMissions).toBe(1);

		// Should have houses left (3 stops, none completed)
		expect(json.data.kpi.housesLeftToHit).toBe(3);

		// Recent events should include mission activity
		expect(json.data.recentEvents.length).toBeGreaterThanOrEqual(1);
	});

	it("returns topRep when reps have door counts", async () => {
		// Create mission with stops
		const mission = await missionsService.createMission("test-user", {
			name: "Test Mission",
			centerLat: 35.0,
			centerLng: -97.0,
			stops: [
				{ address: "100 A St", lat: 35.01, lng: -97.01 },
				{ address: "200 B St", lat: 35.02, lng: -97.02 },
			],
		});

		await missionsService.updateMission("test-user", mission.mission.id, { status: "active", assignedRepId: "rep-alpha" });

		// Complete a stop with "interested" outcome
		const detail = await missionsService.getMissionDetail("test-user", mission.mission.id);
		await missionsService.recordStopOutcome("test-user", detail.stops[0].id, {
			status: "interested",
			notes: "Wants appointment",
		});

		// Add presence for rep-alpha
		await presenceService.heartbeat("rep-alpha", {
			missionId: mission.mission.id,
			lat: 35.01,
			lng: -97.01,
			accuracy: 10,
			heading: 0,
			speed: 0.5,
		});

		const request = new Request("http://localhost:3000/api/mission-control/live");
		const response = await GET(request as any);
		const json = await response.json();

		// topRep should be populated
		expect(json.data.topRep).not.toBeNull();
		expect(json.data.topRep.doorsKnocked).toBeGreaterThanOrEqual(1);

		// Qualified count should include the "interested" stop
		expect(json.data.kpi.qualifiedToday).toBeGreaterThanOrEqual(1);
	});

	it("returns insights when data exists", async () => {
		// Create and activate a mission
		const mission = await missionsService.createMission("test-user", {
			name: "Insight Mission",
			centerLat: 35.0,
			centerLng: -97.0,
			stops: [{ address: "999 Z St", lat: 35.0, lng: -97.0 }],
		});
		await missionsService.updateMission("test-user", mission.mission.id, { status: "active", assignedRepId: "rep-insight" });

		// Add a rep
		await presenceService.heartbeat("rep-insight", {
			missionId: mission.mission.id,
			lat: 35.0,
			lng: -97.0,
			accuracy: 10,
			heading: 0,
			speed: 1.0,
		});

		const request = new Request("http://localhost:3000/api/mission-control/live");
		const response = await GET(request as any);
		const json = await response.json();

		// Should have generated insights
		expect(json.data.insights.length).toBeGreaterThan(0);
		expect(typeof json.data.insights[0]).toBe("string");
	});

	it("returns ticker events for active and completed missions", async () => {
		const m1 = await missionsService.createMission("test-user", {
			name: "Active Alpha",
			centerLat: 35.0,
			centerLng: -97.0,
			stops: [{ address: "1 A", lat: 35.0, lng: -97.0 }],
		});
		await missionsService.updateMission("test-user", m1.mission.id, { status: "active" });

		const m2 = await missionsService.createMission("test-user", {
			name: "Completed Beta",
			centerLat: 35.1,
			centerLng: -97.1,
			stops: [{ address: "2 B", lat: 35.1, lng: -97.1 }],
		});
		await missionsService.updateMission("test-user", m2.mission.id, { status: "active" });
		await missionsService.updateMission("test-user", m2.mission.id, { status: "completed" });

		const request = new Request("http://localhost:3000/api/mission-control/live");
		const response = await GET(request as any);
		const json = await response.json();

		const events = json.data.recentEvents;
		expect(events.length).toBeGreaterThanOrEqual(2);

		// Should include icons and text
		const activeEvent = events.find((e: any) => e.text.includes("Active Alpha"));
		const completeEvent = events.find((e: any) => e.text.includes("Completed Beta"));
		expect(activeEvent).toBeDefined();
		expect(completeEvent).toBeDefined();
		expect(activeEvent.icon).toBe("🚀");
		expect(completeEvent.icon).toBe("✅");
	});

	it("all recentEvents have required shape", async () => {
		const mission = await missionsService.createMission("test-user", {
			name: "Shape Test",
			centerLat: 35.0,
			centerLng: -97.0,
			stops: [{ address: "1 Main", lat: 35.0, lng: -97.0 }],
		});
		await missionsService.updateMission("test-user", mission.mission.id, { status: "active" });

		const request = new Request("http://localhost:3000/api/mission-control/live");
		const response = await GET(request as any);
		const json = await response.json();

		for (const event of json.data.recentEvents) {
			expect(typeof event.id).toBe("string");
			expect(typeof event.icon).toBe("string");
			expect(typeof event.text).toBe("string");
			expect(typeof event.timestamp).toBe("string");
		}
	});

	it("rep fieldStatus is valid enum value", async () => {
		const mission = await missionsService.createMission("test-user", {
			name: "Status Mission",
			centerLat: 35.0,
			centerLng: -97.0,
			stops: [{ address: "1 Status St", lat: 35.0, lng: -97.0 }],
		});

		await missionsService.updateMission("test-user", mission.mission.id, { assignedRepId: "rep-status" });

		await presenceService.heartbeat("rep-status", {
			missionId: mission.mission.id,
			lat: 35.0,
			lng: -97.0,
			accuracy: 10,
			heading: 0,
			speed: 0.3, // ≤ 0.5 → at_door
		});

		const request = new Request("http://localhost:3000/api/mission-control/live");
		const response = await GET(request as any);
		const json = await response.json();

		const validStatuses = ["active", "at_door", "driving", "idle", "offline"];
		for (const rep of json.data.reps) {
			expect(validStatuses).toContain(rep.fieldStatus);
		}
	});
});
