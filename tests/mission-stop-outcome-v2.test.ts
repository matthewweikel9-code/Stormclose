import { describe, expect, it } from "vitest";
import { missionsService } from "@/services/missions/missionService";

describe("mission stop outcome recording", () => {
	it("updates stop outcome payload and notes", async () => {
		const created = await missionsService.createMission("test-user", {
			name: "Outcome Mission",
			stops: [{ address: "301 Main St", lat: 32.8, lng: -96.8 }],
		});

		const stopId = created.stops[0].id;
		const updated = await missionsService.recordStopOutcome("test-user", stopId, {
			status: "interested",
			outcomeData: { interestLevel: "high", source: "door_knock" },
			notes: "Homeowner interested in next week inspection",
			arrivedAt: new Date().toISOString(),
			departedAt: new Date().toISOString(),
		});

		expect(updated.status).toBe("interested");
		expect(updated.outcomeData).toMatchObject({ interestLevel: "high" });
		expect(updated.notes).toContain("Homeowner interested");
	});
});
