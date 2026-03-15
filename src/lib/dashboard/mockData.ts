export type DashboardTodayData = {
	kpi: {
		housesToHitCount: number;
		activeMissionCount: number;
		repsInFieldCount: number;
		exportsTodayCount: number;
	};
	aiDailyBrief: {
		summary: string;
		highlights: Array<{ category: string; text: string; href?: string }>;
		generatedAt: string;
		model: string;
		tokenCount: number;
	};
	housesToHitToday: Array<Record<string, unknown>>;
	topStormZones: Array<Record<string, unknown>>;
	aiDeploymentPlan: Record<string, unknown>;
	liveTeamSnapshot: Record<string, unknown>;
	unassignedHotClusters: Array<Record<string, unknown>>;
	recentQualifiedOpps: Array<Record<string, unknown>>;
	exportQueueSummary: {
		readyCount: number;
		exportedTodayCount: number;
		failedCount: number;
		retryQueueCount: number;
		successRatePercent: number;
		recentExports: Array<{
			id: string;
			address: string;
			status: "success" | "retrying" | "pending" | "failed";
			exportedAt: string;
			errorMessage?: string;
		}>;
	};
	dataHealth: Record<string, unknown>;
};

export function getDashboardTodayMockData(): DashboardTodayData {
	const now = new Date().toISOString();

	return {
		kpi: {
			housesToHitCount: 0,
			activeMissionCount: 0,
			repsInFieldCount: 0,
			exportsTodayCount: 0,
		},
		aiDailyBrief: {
			summary: "No brief generated yet. Data will appear once missions and weather signals are available.",
			highlights: [],
			generatedAt: now,
			model: "fallback",
			tokenCount: 0,
		},
		housesToHitToday: [],
		topStormZones: [],
		aiDeploymentPlan: {
			actions: [],
		},
		liveTeamSnapshot: {
			activeReps: 0,
			availableReps: 0,
		},
		unassignedHotClusters: [],
		recentQualifiedOpps: [],
		exportQueueSummary: {
			readyCount: 0,
			exportedTodayCount: 0,
			failedCount: 0,
			retryQueueCount: 0,
			successRatePercent: 100,
			recentExports: [],
		},
		dataHealth: {
			status: "ok",
			updatedAt: now,
		},
	};
}
