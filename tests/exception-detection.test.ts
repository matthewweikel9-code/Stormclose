import { describe, expect, it } from "vitest";
import { detectExceptions } from "@/services/team/exceptionService";
import type { RepState, TeamState, ZoneState } from "@/types/team";

const BASE_NOW = "2025-01-15T14:00:00.000Z";

function baseRep(overrides: Partial<RepState> = {}): RepState {
	return {
		userId: "rep-1",
		name: "Alice Rep",
		lat: 35.0,
		lng: -97.0,
		speed: 1.0,
		batteryPercent: 80,
		mode: "active_mission",
		lastHeartbeatAt: "2025-01-15T13:58:00.000Z",
		missionId: "m-1",
		missionName: "Storm Zone A",
		missionStatus: "active",
		missionStartedAt: "2025-01-15T08:00:00.000Z",
		stopsRemaining: 10,
		recentOutcomes: ["interested", "no_answer", "pending"],
		nearestStopDistanceMiles: 0.1,
		hasPlannedMission: false,
		plannedMissionName: null,
		...overrides,
	};
}

function baseZone(overrides: Partial<ZoneState> = {}): ZoneState {
	return {
		id: "zone-1",
		name: "Tornado Alley North",
		score: 80,
		centroidLat: 35.0,
		centroidLng: -97.0,
		radiusMiles: 5,
		unworkedHouseCount: 50,
		activeMissionCount: 0,
		...overrides,
	};
}

function baseState(overrides: Partial<TeamState> = {}): TeamState {
	return {
		reps: [baseRep()],
		zones: [],
		exportBacklogCount: 0,
		now: BASE_NOW,
		workingHoursStart: "08:00",
		workingHoursEnd: "20:00",
		...overrides,
	};
}

describe("Exception Detection", () => {
	describe("idle_rep", () => {
		it("emits idle_rep when rep has been stationary > 5 min", () => {
			const state = baseState({
				reps: [
					baseRep({
						lastHeartbeatAt: "2025-01-15T13:50:00.000Z", // 10 min ago
						speed: 0,
					}),
				],
			});
			const exceptions = detectExceptions(state);
			const idle = exceptions.find((e) => e.type === "idle_rep");
			expect(idle).toBeDefined();
			expect(idle!.severity).toBe("warning");
			expect(idle!.context.minutesIdle).toBeGreaterThanOrEqual(10);
		});

		it("does NOT emit idle_rep when rep has recent heartbeat", () => {
			const state = baseState({
				reps: [
					baseRep({
						lastHeartbeatAt: "2025-01-15T13:58:30.000Z", // 1.5 min ago
						speed: 0,
					}),
				],
			});
			const exceptions = detectExceptions(state);
			expect(exceptions.find((e) => e.type === "idle_rep")).toBeUndefined();
		});

		it("does NOT emit idle_rep when rep is moving fast", () => {
			const state = baseState({
				reps: [
					baseRep({
						lastHeartbeatAt: "2025-01-15T13:50:00.000Z",
						speed: 5,
					}),
				],
			});
			const exceptions = detectExceptions(state);
			expect(exceptions.find((e) => e.type === "idle_rep")).toBeUndefined();
		});
	});

	describe("heartbeat_lost", () => {
		it("emits heartbeat_lost after 15 minutes of silence", () => {
			const state = baseState({
				reps: [
					baseRep({
						lastHeartbeatAt: "2025-01-15T13:40:00.000Z", // 20 min ago
					}),
				],
			});
			const exceptions = detectExceptions(state);
			const lost = exceptions.find((e) => e.type === "heartbeat_lost");
			expect(lost).toBeDefined();
			expect(lost!.severity).toBe("critical");
		});

		it("heartbeat_lost subsumes idle_rep (only one emitted)", () => {
			const state = baseState({
				reps: [
					baseRep({
						lastHeartbeatAt: "2025-01-15T13:40:00.000Z",
						speed: 0,
					}),
				],
			});
			const exceptions = detectExceptions(state);
			expect(exceptions.filter((e) => e.type === "heartbeat_lost")).toHaveLength(1);
			expect(exceptions.filter((e) => e.type === "idle_rep")).toHaveLength(0);
		});
	});

	describe("off_route", () => {
		it("emits off_route when rep is > 0.5 miles from nearest stop", () => {
			const state = baseState({
				reps: [
					baseRep({
						nearestStopDistanceMiles: 1.2,
					}),
				],
			});
			const exceptions = detectExceptions(state);
			const offRoute = exceptions.find((e) => e.type === "off_route");
			expect(offRoute).toBeDefined();
			expect(offRoute!.context.distanceOffRouteMiles).toBe(1.2);
		});

		it("does NOT emit off_route when rep is close to stop", () => {
			const state = baseState({
				reps: [
					baseRep({
						nearestStopDistanceMiles: 0.2,
					}),
				],
			});
			const exceptions = detectExceptions(state);
			expect(exceptions.find((e) => e.type === "off_route")).toBeUndefined();
		});
	});

	describe("battery_critical", () => {
		it("emits battery_critical when battery < 10%", () => {
			const state = baseState({
				reps: [baseRep({ batteryPercent: 5 })],
			});
			const exceptions = detectExceptions(state);
			const battery = exceptions.find((e) => e.type === "battery_critical");
			expect(battery).toBeDefined();
			expect(battery!.context.batteryPercent).toBe(5);
		});

		it("does NOT emit battery_critical at 10% or above", () => {
			const state = baseState({
				reps: [baseRep({ batteryPercent: 10 })],
			});
			const exceptions = detectExceptions(state);
			expect(exceptions.find((e) => e.type === "battery_critical")).toBeUndefined();
		});
	});

	describe("low_quality_outcomes", () => {
		it("emits low_quality_outcomes after 5 consecutive rejections", () => {
			const state = baseState({
				reps: [
					baseRep({
						recentOutcomes: [
							"not_interested",
							"not_interested",
							"not_interested",
							"not_interested",
							"not_interested",
						],
					}),
				],
			});
			const exceptions = detectExceptions(state);
			const lowQuality = exceptions.find((e) => e.type === "low_quality_outcomes");
			expect(lowQuality).toBeDefined();
			expect(lowQuality!.context.consecutiveOutcomes).toBe(5);
		});

		it("does NOT emit when outcomes are mixed", () => {
			const state = baseState({
				reps: [
					baseRep({
						recentOutcomes: [
							"not_interested",
							"interested",
							"not_interested",
							"not_interested",
							"not_interested",
						],
					}),
				],
			});
			const exceptions = detectExceptions(state);
			expect(exceptions.find((e) => e.type === "low_quality_outcomes")).toBeUndefined();
		});
	});

	describe("mission_overtime", () => {
		it("emits mission_overtime when active > 10 hours", () => {
			const state = baseState({
				reps: [
					baseRep({
						missionStartedAt: "2025-01-15T02:00:00.000Z", // 12 hours ago
					}),
				],
			});
			const exceptions = detectExceptions(state);
			const overtime = exceptions.find((e) => e.type === "mission_overtime");
			expect(overtime).toBeDefined();
			expect(overtime!.context.activeHours).toBeGreaterThanOrEqual(12);
		});
	});

	describe("no_rep_in_hot_zone", () => {
		it("emits when a hot zone has no active mission and no nearby rep", () => {
			const state = baseState({
				reps: [
					baseRep({
						lat: 40.0, // far away from zone
						lng: -90.0,
					}),
				],
				zones: [baseZone({ score: 80, activeMissionCount: 0 })],
			});
			const exceptions = detectExceptions(state);
			const noRep = exceptions.find((e) => e.type === "no_rep_in_hot_zone");
			expect(noRep).toBeDefined();
			expect(noRep!.severity).toBe("critical");
		});

		it("does NOT emit when zone already has an active mission", () => {
			const state = baseState({
				reps: [baseRep({ lat: 40.0, lng: -90.0 })],
				zones: [baseZone({ score: 80, activeMissionCount: 1 })],
			});
			const exceptions = detectExceptions(state);
			expect(exceptions.find((e) => e.type === "no_rep_in_hot_zone")).toBeUndefined();
		});

		it("does NOT emit for low-score zones", () => {
			const state = baseState({
				reps: [baseRep({ lat: 40.0, lng: -90.0 })],
				zones: [baseZone({ score: 50, activeMissionCount: 0 })],
			});
			const exceptions = detectExceptions(state);
			expect(exceptions.find((e) => e.type === "no_rep_in_hot_zone")).toBeUndefined();
		});
	});

	describe("export_backlog_growing", () => {
		it("emits when backlog exceeds 10", () => {
			const state = baseState({ exportBacklogCount: 15 });
			const exceptions = detectExceptions(state);
			const backlog = exceptions.find((e) => e.type === "export_backlog_growing");
			expect(backlog).toBeDefined();
			expect(backlog!.context.backlogCount).toBe(15);
		});

		it("does NOT emit when backlog is small", () => {
			const state = baseState({ exportBacklogCount: 5 });
			const exceptions = detectExceptions(state);
			expect(exceptions.find((e) => e.type === "export_backlog_growing")).toBeUndefined();
		});
	});

	describe("mission_nearly_complete_cluster_nearby", () => {
		it("emits when rep has <= 3 stops and a nearby cluster exists", () => {
			const state = baseState({
				reps: [
					baseRep({
						stopsRemaining: 2,
						lat: 35.0,
						lng: -97.0,
					}),
				],
				zones: [
					baseZone({
						centroidLat: 35.01,
						centroidLng: -97.01,
						unworkedHouseCount: 30,
					}),
				],
			});
			const exceptions = detectExceptions(state);
			const cluster = exceptions.find((e) => e.type === "mission_nearly_complete_cluster_nearby");
			expect(cluster).toBeDefined();
			expect(cluster!.severity).toBe("info");
		});
	});

	describe("rep_inactive_during_hours", () => {
		it("emits when rep is offline during working hours with a planned mission", () => {
			const state = baseState({
				reps: [
					baseRep({
						mode: "offline",
						hasPlannedMission: true,
						plannedMissionName: "Storm Zone B",
					}),
				],
			});
			const exceptions = detectExceptions(state);
			const inactive = exceptions.find((e) => e.type === "rep_inactive_during_hours");
			expect(inactive).toBeDefined();
			expect(inactive!.context.missionName).toBe("Storm Zone B");
		});

		it("does NOT emit when outside working hours", () => {
			const state = baseState({
				reps: [
					baseRep({
						mode: "offline",
						hasPlannedMission: true,
						plannedMissionName: "Storm Zone B",
					}),
				],
				now: "2025-01-15T05:00:00.000Z", // 5 AM
				workingHoursStart: "08:00",
				workingHoursEnd: "20:00",
			});
			const exceptions = detectExceptions(state);
			expect(exceptions.find((e) => e.type === "rep_inactive_during_hours")).toBeUndefined();
		});
	});

	describe("sorting", () => {
		it("sorts critical first, then warning, then info", () => {
			const state = baseState({
				reps: [
					baseRep({
						lastHeartbeatAt: "2025-01-15T13:40:00.000Z", // heartbeat lost (critical)
						batteryPercent: 5, // battery critical (warning)
						stopsRemaining: 2,
					}),
				],
				zones: [
					baseZone({
						centroidLat: 35.01,
						centroidLng: -97.01,
						unworkedHouseCount: 30,
					}),
				],
			});
			const exceptions = detectExceptions(state);
			expect(exceptions.length).toBeGreaterThan(1);

			for (let i = 1; i < exceptions.length; i++) {
				const order = { critical: 0, warning: 1, info: 2 };
				expect(order[exceptions[i - 1].severity]).toBeLessThanOrEqual(
					order[exceptions[i].severity],
				);
			}
		});
	});
});
