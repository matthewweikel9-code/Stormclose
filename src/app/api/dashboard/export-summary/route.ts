import { NextResponse } from "next/server";
import { getDashboardTodayMockData } from "@/lib/dashboard/mockData";
import type { ApiEnvelope, ExportQueueSummary } from "@/types/dashboard";

export async function GET() {
	// TODO: Replace with export queue service calls backed by opportunity_exports and jobnimbus_export_queue.
	const summary = getDashboardTodayMockData().exportQueueSummary;
	const payload: ApiEnvelope<ExportQueueSummary> = {
		data: summary,
		error: null,
		meta: {
			updatedAt: new Date().toISOString(),
			source: "mock",
		},
	};

	return NextResponse.json(payload);
}
