import { describe, expect, it } from "vitest";
import { getVisibleDashboardWidgets } from "@/config/dashboardWidgets";

describe("dashboard widget visibility", () => {
	it("shows full dashboard widgets for owner", () => {
		expect(getVisibleDashboardWidgets("owner")).toEqual([
			"aiDailyBrief",
			"housesToHitToday",
			"topStormZones",
			"aiDeploymentPlan",
			"liveTeamSnapshot",
			"unassignedHotClusters",
			"recentQualifiedOpps",
			"exportQueueSummary",
			"dataHealth",
		]);
	});

	it("hides owner/manager widgets for reps", () => {
		expect(getVisibleDashboardWidgets("rep")).toEqual([
			"aiDailyBrief",
			"housesToHitToday",
			"recentQualifiedOpps",
		]);
	});

	it("shows export and team widgets for office admin but hides owner-only analytics", () => {
		expect(getVisibleDashboardWidgets("office_admin")).toEqual([
			"aiDailyBrief",
			"housesToHitToday",
			"liveTeamSnapshot",
			"recentQualifiedOpps",
			"exportQueueSummary",
		]);
	});
});
