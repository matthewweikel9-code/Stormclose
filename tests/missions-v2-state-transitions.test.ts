import { describe, expect, it } from "vitest";
import { missionsService } from "@/services/missions/missionService";

describe("missions v2 state transitions", () => {
	it("allows planned -> active -> paused -> active -> completed", async () => {
		const created = await missionsService.createMission("test-user", {
			name: "Transition Mission",
			stops: [
				{ address: "101 Main St", lat: 32.8, lng: -96.8 },
				{ address: "102 Main St", lat: 32.81, lng: -96.81 },
			],
		});

		expect(created.mission.status).toBe("planned");

		const active = await missionsService.updateMission("test-user", created.mission.id, { status: "active" });
		expect(active.status).toBe("active");

		const paused = await missionsService.updateMission("test-user", created.mission.id, { status: "paused" });
		expect(paused.status).toBe("paused");

		const resumed = await missionsService.updateMission("test-user", created.mission.id, { status: "active" });
		expect(resumed.status).toBe("active");

		const completed = await missionsService.updateMission("test-user", created.mission.id, { status: "completed" });
		expect(completed.status).toBe("completed");
	});

	it("rejects invalid transition planned -> completed", async () => {
		const created = await missionsService.createMission("test-user", {
			name: "Invalid Transition Mission",
			stops: [{ address: "201 Main St", lat: 32.8, lng: -96.8 }],
		});

		await expect(
			missionsService.updateMission("test-user", created.mission.id, { status: "completed" })
		).rejects.toThrow(/Invalid transition/i);
	});
});
