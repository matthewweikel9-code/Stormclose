import { NextResponse } from "next/server";
import { getDashboardTodayMockData } from "@/lib/dashboard/mockData";
import { createClient } from "@/lib/supabase/server";
import { listExports } from "@/lib/exports/store";
import type { ApiEnvelope, DashboardTodayData } from "@/types/dashboard";

export async function GET() {
	const data = getDashboardTodayMockData();

	if (process.env.NODE_ENV === "test") {
		const exportData = listExports({ limit: 5 });
		data.exportQueueSummary = {
			readyCount: exportData.readyCount,
			exportedTodayCount: exportData.exportedTodayCount,
			failedCount: exportData.failedCount,
			retryQueueCount: exportData.retryingCount,
			successRatePercent:
				exportData.exportedTodayCount + exportData.failedCount > 0
					? Math.round((exportData.exportedTodayCount / (exportData.exportedTodayCount + exportData.failedCount)) * 100)
					: 100,
			recentExports: exportData.exports.slice(0, 5).map((row) => ({
				id: row.id,
				address: row.payload.contact.address_line1,
				status:
					row.status === "exported"
						? "success"
						: row.status === "retrying"
							? "retrying"
							: row.status === "ready" || row.status === "exporting"
								? "pending"
								: "failed",
				exportedAt: row.exportedAt ?? row.updatedAt,
				errorMessage: row.error,
			})),
		};
	} else {
		const supabase = await createClient();
		const { data: rows } = await (supabase.from("opportunity_exports") as any)
			.select("*")
			.order("created_at", { ascending: false })
			.limit(100);

		const records = rows ?? [];
		const today = new Date().toISOString().slice(0, 10);
		const readyCount = records.filter((row: any) => row.status === "ready").length;
		const exportedTodayCount = records.filter(
			(row: any) => row.status === "exported" && String(row.exported_at ?? "").startsWith(today),
		).length;
		const failedCount = records.filter(
			(row: any) => row.status === "failed" || row.status === "permanently_failed",
		).length;
		const retryQueueCount = records.filter((row: any) => row.status === "retrying").length;

		data.exportQueueSummary = {
			readyCount,
			exportedTodayCount,
			failedCount,
			retryQueueCount,
			successRatePercent:
				exportedTodayCount + failedCount > 0
					? Math.round((exportedTodayCount / (exportedTodayCount + failedCount)) * 100)
					: 100,
			recentExports: records.slice(0, 5).map((row: any) => ({
				id: row.id,
				address: String(row?.payload?.contact?.address_line1 ?? "Unknown address"),
				status:
					row.status === "exported"
						? "success"
						: row.status === "retrying"
							? "retrying"
							: row.status === "ready" || row.status === "exporting"
								? "pending"
								: "failed",
				exportedAt: row.exported_at ?? row.updated_at,
				errorMessage: row.error,
			})),
		};
	}

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
