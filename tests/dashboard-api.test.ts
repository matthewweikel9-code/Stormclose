import { describe, expect, it } from "vitest";
import { GET as getDashboardToday } from "@/app/api/dashboard/today/route";
import { GET as getDashboardAiBrief } from "@/app/api/dashboard/ai-brief/route";
import { GET as getDashboardExportSummary } from "@/app/api/dashboard/export-summary/route";

describe("dashboard api routes", () => {
	it("returns full dashboard payload shape from /api/dashboard/today", async () => {
		const response = await getDashboardToday();
		const payload = await response.json();

		expect(payload).toMatchObject({
			data: {
				kpi: {
					housesToHitCount: expect.any(Number),
					activeMissionCount: expect.any(Number),
					repsInFieldCount: expect.any(Number),
					exportsTodayCount: expect.any(Number),
				},
				aiDailyBrief: {
					summary: expect.any(String),
					highlights: expect.any(Array),
				},
				housesToHitToday: expect.any(Array),
				topStormZones: expect.any(Array),
				aiDeploymentPlan: expect.any(Object),
				liveTeamSnapshot: expect.any(Object),
				unassignedHotClusters: expect.any(Array),
				recentQualifiedOpps: expect.any(Array),
				exportQueueSummary: expect.any(Object),
				dataHealth: expect.any(Object),
			},
			error: null,
			meta: {
				generatedAt: expect.any(String),
			},
		});
	});

	it("returns AI brief payload shape from /api/dashboard/ai-brief", async () => {
		const response = await getDashboardAiBrief();
		const payload = await response.json();

		expect(payload).toMatchObject({
			data: {
				summary: expect.any(String),
				highlights: expect.any(Array),
				generatedAt: expect.any(String),
				model: expect.any(String),
				tokenCount: expect.any(Number),
			},
			error: null,
			meta: {
				generatedAt: expect.any(String),
			},
		});
	});

	it("returns export summary payload shape from /api/dashboard/export-summary", async () => {
		const response = await getDashboardExportSummary();
		const payload = await response.json();

		expect(payload).toMatchObject({
			data: {
				readyCount: expect.any(Number),
				exportedTodayCount: expect.any(Number),
				failedCount: expect.any(Number),
				retryQueueCount: expect.any(Number),
				successRatePercent: expect.any(Number),
				recentExports: expect.any(Array),
			},
			error: null,
			meta: {
				updatedAt: expect.any(String),
			},
		});
	});
});
