import { describe, expect, it } from "vitest";
import { GET as getStormZones } from "@/app/api/storm-zones/route";
import { GET as getStormZoneById } from "@/app/api/storm-zones/[id]/route";
import { POST as postGenerateMission } from "@/app/api/storm-zones/[id]/generate-mission/route";

describe("storm zones api", () => {
	it("returns storm zone list shape", async () => {
		const request = new Request("http://localhost/api/storm-zones?limit=5") as any;
		const response = await getStormZones(request);
		const payload = await response.json();

		expect(payload).toMatchObject({
			data: expect.any(Array),
			error: null,
			meta: {
				total: expect.any(Number),
				limit: expect.any(Number),
				source: expect.any(String),
			},
		});

		if (payload.data.length > 0) {
			expect(payload.data[0]).toMatchObject({
				id: expect.any(String),
				stormEventId: expect.any(String),
				name: expect.any(String),
				opportunityScore: expect.any(Number),
				houseCount: expect.any(Number),
				unworkedCount: expect.any(Number),
			});
		}
	});

	it("returns storm zone detail shape", async () => {
		const listRequest = new Request("http://localhost/api/storm-zones?limit=1") as any;
		const listResponse = await getStormZones(listRequest);
		const listPayload = await listResponse.json();
		const zoneId = listPayload.data[0]?.id;
		expect(zoneId).toBeTruthy();

		const request = new Request(`http://localhost/api/storm-zones/${zoneId}`) as any;
		const response = await getStormZoneById(request, { params: { id: zoneId } });
		const payload = await response.json();

		expect(payload).toMatchObject({
			data: {
				zone: {
					id: expect.any(String),
					name: expect.any(String),
					opportunityScore: expect.any(Number),
				},
				houses: expect.any(Array),
				severity: expect.any(String),
			},
			error: null,
		});
	});

	it("generate-mission endpoint returns mission payload", async () => {
		const request = new Request("http://localhost/api/storm-zones/zone-1/generate-mission", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ signature: "test-signature" }),
		}) as any;

		const response = await postGenerateMission(request, { params: { id: "zone-1" } });
		const payload = await response.json();

		expect(payload).toMatchObject({
			data: {
				missionId: expect.any(String),
				created: expect.any(Boolean),
				stopCount: expect.any(Number),
			},
			error: null,
		});
	});
});
