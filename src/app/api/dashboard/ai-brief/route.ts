import { NextResponse } from "next/server";
import { getDashboardTodayMockData } from "@/lib/dashboard/mockData";
import type { AIDailyBrief, ApiEnvelope } from "@/types/dashboard";

export async function GET() {
	// TODO: Replace with AI brief retrieval/generation service backed by ai_sessions and feature flags.
	const brief = getDashboardTodayMockData().aiDailyBrief;
	const payload: ApiEnvelope<AIDailyBrief> = {
		data: brief,
		error: null,
		meta: {
			generatedAt: brief.generatedAt,
			source: "mock",
		},
	};

	return NextResponse.json(payload);
}
