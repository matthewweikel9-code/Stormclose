import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listExports } from "@/lib/exports/store";
import type { ApiEnvelope, ExportQueueSummary } from "@/types/dashboard";

export async function GET() {
	let summary: ExportQueueSummary;

	if (process.env.NODE_ENV === "test") {
		const data = listExports({ limit: 5 });
		summary = {
			readyCount: data.readyCount,
			exportedTodayCount: data.exportedTodayCount,
			failedCount: data.failedCount,
			retryQueueCount: data.retryingCount,
			successRatePercent:
				data.exportedTodayCount + data.failedCount > 0
					? Math.round((data.exportedTodayCount / (data.exportedTodayCount + data.failedCount)) * 100)
					: 100,
			recentExports: data.exports.slice(0, 5).map((row) => ({
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
		const { data: rows, error } = await (supabase.from("opportunity_exports") as any)
			.select("*")
			.order("created_at", { ascending: false })
			.limit(100);

		if (error) {
			return NextResponse.json(
				{ data: null, error: error.message, meta: { updatedAt: new Date().toISOString() } },
				{ status: 500 },
			);
		}

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

		summary = {
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
