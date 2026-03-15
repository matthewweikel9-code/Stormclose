import { describe, expect, it } from "vitest";
import { POST as postMissions } from "@/app/api/missions/route";
import { POST as postStartMission } from "@/app/api/presence/start-mission/route";
import { POST as postHeartbeat } from "@/app/api/presence/heartbeat/route";

describe("presence heartbeat endpoint", () => {
	it("returns expected response shape with next-best house", async () => {
		const missionResponse = await postMissions(
			new Request("http://localhost/api/missions", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: "Heartbeat Mission",
					stops: [
						{ address: "601 Main St", lat: 32.8, lng: -96.8, opportunityScore: 90 },
						{ address: "602 Main St", lat: 32.81, lng: -96.81, opportunityScore: 70 },
					],
				}),
			}) as any
		);
		const missionPayload = await missionResponse.json();
		const missionId = missionPayload.data?.mission?.id;
		expect(missionId).toBeTruthy();

		const startResponse = await postStartMission(
			new Request("http://localhost/api/presence/start-mission", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ missionId }),
			}) as any
		);
		expect(startResponse.status).toBe(200);

		const response = await postHeartbeat(
			new Request("http://localhost/api/presence/heartbeat", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					missionId,
					lat: 32.8002,
					lng: -96.8001,
					accuracy: 9,
					heading: 180,
					speed: 3,
				}),
			}) as any
		);
		const payload = await response.json();

		expect(payload).toMatchObject({
			data: {
				presence: {
					id: expect.any(String),
					userId: expect.any(String),
					missionId: expect.any(String),
					lat: expect.any(Number),
					lng: expect.any(Number),
					mode: expect.any(String),
				},
				nextBestHouse: {
					suggestions: expect.any(Array),
					includesUnassigned: expect.any(Boolean),
					estimatedRemainingCapacity: expect.any(Number),
					generatedAt: expect.any(String),
				},
				nextIntervalSeconds: expect.any(Number),
			},
			error: null,
		});
	});
});
