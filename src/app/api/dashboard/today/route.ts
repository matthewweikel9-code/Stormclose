import { NextResponse } from "next/server";
import { getDashboardTodayMockData } from "@/lib/dashboard/mockData";
import type { ApiEnvelope, DashboardTodayData } from "@/types/dashboard";

export async function GET() {
	// TODO: Replace mock data with service-layer calls to storms, houses, missions, team, exports, and freshness providers.
	const data = getDashboardTodayMockData();
	const payload: ApiEnvelope<DashboardTodayData> = {
		data,
		error: null,
		meta: {
			generatedAt: new Date().toISOString(),
			source: "mock",
		},
	};

	return NextResponse.json(payload);
}
