import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getExportById, updateExportStatus } from "@/lib/exports/store";
import { calculateRetryDelaySeconds, retryExport } from "@/services/exports/exportService";
import type { RetryExportRequest } from "@/types/exports";

async function getUserId() {
	if (process.env.NODE_ENV === "test") return "test-user";
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	return user?.id ?? null;
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
	const userId = await getUserId();
	if (!userId) {
		return NextResponse.json({ data: null, error: "Unauthorized", meta: {} }, { status: 401 });
	}

	let body: RetryExportRequest = {};
	try {
		body = await request.json();
	} catch {
		// no-op
	}

	if (process.env.NODE_ENV === "test") {
		const current = getExportById(params.id);
		if (!current) {
			return NextResponse.json({ data: null, error: "Export not found", meta: {} }, { status: 404 });
		}

		if (body.resetAttempts) {
			updateExportStatus(params.id, current.status, { attempts: 0 });
		}

		const retried = await retryExport(params.id);
		if (!retried) {
			return NextResponse.json({ data: null, error: "Export cannot be retried", meta: {} }, { status: 400 });
		}

		return NextResponse.json({
			data: {
				exportId: retried.id,
				newStatus: retried.status,
				nextRetryAt: retried.nextRetryAt,
			},
			error: null,
			meta: { timestamp: new Date().toISOString() },
		});
	}

	const supabase = await createClient();
	const { data: row, error } = await (supabase.from("opportunity_exports") as any)
		.select("*")
		.eq("id", params.id)
		.single();

	if (error || !row) {
		return NextResponse.json({ data: null, error: "Export not found", meta: {} }, { status: 404 });
	}

	if (!["failed", "retrying", "permanently_failed"].includes(row.status)) {
		return NextResponse.json({ data: null, error: "Export cannot be retried", meta: {} }, { status: 400 });
	}

	const currentAttempts = body.resetAttempts ? 0 : Number(row.attempts ?? 0);
	const nextAttempt = currentAttempts + 1;
	if (nextAttempt >= 3) {
		await (supabase.from("opportunity_exports") as any)
			.update({ status: "permanently_failed", attempts: nextAttempt, next_retry_at: null })
			.eq("id", params.id);
		return NextResponse.json({
			data: { exportId: params.id, newStatus: "permanently_failed", nextRetryAt: null },
			error: null,
			meta: { timestamp: new Date().toISOString() },
		});
	}

	const nextRetryAt = new Date(
		Date.now() + calculateRetryDelaySeconds(nextAttempt) * 1000,
	).toISOString();
	await (supabase.from("opportunity_exports") as any)
		.update({ status: "retrying", attempts: nextAttempt, next_retry_at: nextRetryAt })
		.eq("id", params.id);

	return NextResponse.json({
		data: { exportId: params.id, newStatus: "retrying", nextRetryAt },
		error: null,
		meta: { timestamp: new Date().toISOString() },
	});
}
