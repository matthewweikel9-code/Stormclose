import { beforeEach, describe, expect, it } from "vitest";
import { GET as listExportsRoute } from "@/app/api/exports/route";
import { POST as triggerExportRoute } from "@/app/api/exports/jobnimbus/route";
import { POST as retryExportRoute } from "@/app/api/exports/[id]/retry/route";
import { GET as statusExportRoute } from "@/app/api/exports/[id]/status/route";
import { GET as previewExportRoute } from "@/app/api/exports/[id]/preview/route";
import { createExport, getExportById, resetExportsStore } from "@/lib/exports/store";
import { buildExportPayload } from "@/services/exports/exportService";

describe("exports api", () => {
	beforeEach(() => {
		resetExportsStore();
	});

	function seedReadyExport() {
		const payload = buildExportPayload(
			{
				id: "house-1",
				address: "123 Oak St",
				city: "Dallas",
				state: "TX",
				zip: "75201",
				homeownerName: "John Smith",
			},
			{ id: "mission-1", name: "North Dallas" },
			[{ outcome: "interested", notes: "Strong interest" }],
			null,
		);
		return createExport({
			houseId: "house-1",
			missionId: "mission-1",
			missionStopId: "stop-1",
			createdBy: "test-user",
			payload,
			status: "ready",
		});
	}

	it("GET /api/exports returns list with counts", async () => {
		seedReadyExport();
		const request = new Request("http://localhost/api/exports") as any;
		const response = await listExportsRoute(request);
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload).toMatchObject({
			data: {
				exports: expect.any(Array),
				readyCount: 1,
			},
			error: null,
		});
	});

	it("POST /api/exports/jobnimbus exports one record", async () => {
		const record = seedReadyExport();
		const request = new Request("http://localhost/api/exports/jobnimbus", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ exportId: record.id }),
		}) as any;
		const response = await triggerExportRoute(request);
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload.data.triggered).toBe(1);
		expect(payload.data.results[0].status).toBe("exported");
		expect(getExportById(record.id)?.status).toBe("exported");
	});

	it("POST /api/exports/[id]/retry retries failed export", async () => {
		const seed = seedReadyExport();
		const failedRecord = createExport({
			houseId: seed.houseId,
			missionId: seed.missionId,
			missionStopId: seed.missionStopId,
			createdBy: seed.createdBy,
			payload: seed.payload,
			status: "failed",
			attempts: 1,
			error: "timeout",
		});

		const failed = getExportById(failedRecord.id);
		expect(failed).not.toBeNull();

		const request = new Request(`http://localhost/api/exports/${failedRecord.id}/retry`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ resetAttempts: false }),
		}) as any;
		const response = await retryExportRoute(request, { params: { id: failedRecord.id } });
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload.data.newStatus).toBe("retrying");
	});

	it("GET /api/exports/[id]/status and preview return expected shape", async () => {
		const record = seedReadyExport();

		const statusRequest = new Request(`http://localhost/api/exports/${record.id}/status`) as any;
		const statusResponse = await statusExportRoute(statusRequest, { params: { id: record.id } });
		const statusPayload = await statusResponse.json();
		expect(statusResponse.status).toBe(200);
		expect(statusPayload).toMatchObject({
			data: {
				export: { id: record.id },
				payload: expect.any(Object),
				timeline: expect.any(Array),
			},
			error: null,
		});

		const previewRequest = new Request(`http://localhost/api/exports/${record.id}/preview`) as any;
		const previewResponse = await previewExportRoute(previewRequest, { params: { id: record.id } });
		const previewPayload = await previewResponse.json();
		expect(previewResponse.status).toBe(200);
		expect(previewPayload).toMatchObject({
			data: {
				exportId: record.id,
				payload: expect.any(Object),
				validationWarnings: expect.any(Array),
			},
			error: null,
		});
	});
});
