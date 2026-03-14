import { beforeEach, describe, expect, it } from "vitest";
import { createExport, getExportById, resetExportsStore } from "@/lib/exports/store";
import {
	buildExportPayload,
	calculateRetryDelaySeconds,
	retryExport,
} from "@/services/exports/exportService";

describe("exportService", () => {
	beforeEach(() => {
		resetExportsStore();
	});

	it("buildExportPayload returns JobNimbus payload shape", () => {
		const payload = buildExportPayload(
			{
				id: "house-1",
				address: "123 Oak St",
				city: "Dallas",
				state: "TX",
				zip: "75201",
				homeownerName: "John Smith",
				phone: "(214) 555-1234",
				email: "john@example.com",
				estimatedValueBand: "$10k-$20k",
				opportunityScore: 84,
			},
			{ id: "mission-1", name: "North Dallas" },
			[{ outcome: "interested", notes: "Visible hail damage" }],
			"Additional rep notes",
		);

		expect(payload).toMatchObject({
			contact: {
				first_name: "John",
				last_name: "Smith",
				address_line1: "123 Oak St",
				source_name: "Stormclose AI",
			},
			job: {
				name: expect.stringContaining("123 Oak St"),
			},
			activity: {
				type: "note",
			},
			handoffSummary: expect.any(String),
		});
	});

	it("retryExport applies exponential backoff and status transition", async () => {
		const payload = buildExportPayload(
			{
				id: "house-2",
				address: "456 Pine",
				city: "Dallas",
				state: "TX",
				zip: "75202",
			},
			null,
			[],
			null,
		);
		const record = createExport({
			houseId: "house-2",
			missionId: null,
			missionStopId: "stop-2",
			createdBy: "test-user",
			payload,
			status: "failed",
			attempts: 1,
		});

		const result = await retryExport(record.id);
		expect(result?.status).toBe("retrying");
		expect(result?.nextRetryAt).toEqual(expect.any(String));
		expect(result?.attempts).toBe(2);

		const stored = getExportById(record.id);
		expect(stored?.status).toBe("retrying");
	});

	it("retryExport transitions to permanently_failed at max attempts", async () => {
		const payload = buildExportPayload(
			{
				id: "house-3",
				address: "789 Cedar",
				city: "Dallas",
				state: "TX",
				zip: "75203",
			},
			null,
			[],
			null,
		);
		const record = createExport({
			houseId: "house-3",
			missionId: null,
			missionStopId: "stop-3",
			createdBy: "test-user",
			payload,
			status: "failed",
			attempts: 2,
		});

		const result = await retryExport(record.id);
		expect(result?.status).toBe("permanently_failed");
		expect(result?.nextRetryAt).toBeNull();
	});

	it("calculateRetryDelaySeconds grows with attempt count", () => {
		expect(calculateRetryDelaySeconds(1)).toBeLessThan(calculateRetryDelaySeconds(2));
		expect(calculateRetryDelaySeconds(2)).toBeLessThan(calculateRetryDelaySeconds(3));
	});
});
