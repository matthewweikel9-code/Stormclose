import type { DashboardTodayData as DashboardTodayDataShape } from "@/lib/dashboard/mockData";

export type ApiEnvelope<T> = {
	data: T | null;
	error: string | null;
	meta?: Record<string, unknown>;
};

export type DashboardTodayData = DashboardTodayDataShape;
