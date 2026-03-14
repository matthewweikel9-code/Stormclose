import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listExports } from "@/lib/exports/store";
import type { ExportStatus } from "@/types/exports";

async function getUserId() {
	if (process.env.NODE_ENV === "test") return "test-user";
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	return user?.id ?? null;
}

function parseStatuses(input: string | null): ExportStatus[] | undefined {
	if (!input) return undefined;
	const values = input
		.split(",")
		.map((v) => v.trim())
		.filter(Boolean) as ExportStatus[];
	return values.length ? values : undefined;
}

export async function GET(request: NextRequest) {
	const userId = await getUserId();
	if (!userId) {
		return NextResponse.json({ data: null, error: "Unauthorized", meta: {} }, { status: 401 });
	}

	const { searchParams } = new URL(request.url);
	const status = parseStatuses(searchParams.get("status"));
	const q = searchParams.get("q") ?? undefined;
	const limit = Number(searchParams.get("limit") ?? "50");
	const offset = Number(searchParams.get("offset") ?? "0");

	if (process.env.NODE_ENV === "test") {
		const data = listExports({
			status,
			q,
			limit: Number.isFinite(limit) && limit > 0 ? limit : 50,
			offset: Number.isFinite(offset) && offset >= 0 ? offset : 0,
		});
		return NextResponse.json({
			data,
			error: null,
			meta: { timestamp: new Date().toISOString() },
		});
	}

	const supabase = await createClient();
	let query = (supabase.from("opportunity_exports") as any)
		.select("*")
		.order("created_at", { ascending: false })
		.range(offset, offset + Math.max(1, limit) - 1);

	if (status && status.length === 1) {
		query = query.eq("status", status[0]);
	} else if (status && status.length > 1) {
		query = query.in("status", status);
	}

	const { data: rows, error } = await query;
	if (error) {
		return NextResponse.json({ data: null, error: error.message, meta: {} }, { status: 500 });
	}

	const exports = (rows ?? []).map((row: any) => ({
		id: row.id,
		houseId: row.house_id,
		missionId: row.mission_id,
		missionStopId: row.mission_stop_id,
		status: row.status,
		payload: row.payload,
		jobnimbusId: row.jobnimbus_id,
		error: row.error,
		attempts: row.attempts,
		nextRetryAt: row.next_retry_at,
		exportedAt: row.exported_at,
		createdBy: row.created_by,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	}));

	const filtered = q
		? exports.filter((record: any) => {
			const address = String(record?.payload?.contact?.address_line1 ?? "").toLowerCase();
			const displayName = String(record?.payload?.contact?.display_name ?? "").toLowerCase();
			const queryString = q.toLowerCase();
			return address.includes(queryString) || displayName.includes(queryString);
		})
		: exports;

	const today = new Date().toISOString().slice(0, 10);
	return NextResponse.json({
		data: {
			exports: filtered,
			total: filtered.length,
			readyCount: filtered.filter((record: any) => record.status === "ready").length,
			exportedTodayCount: filtered.filter(
				(record: any) => record.status === "exported" && record.exportedAt?.startsWith(today),
			).length,
			failedCount: filtered.filter((record: any) => record.status === "failed").length,
			retryingCount: filtered.filter((record: any) => record.status === "retrying").length,
		},
		error: null,
		meta: { timestamp: new Date().toISOString() },
	});
}
