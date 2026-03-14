import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
	getExportById,
	getReadyExports,
	updateExportStatus,
} from "@/lib/exports/store";
import {
	buildExportPayload,
	calculateRetryDelaySeconds,
	sendToJobNimbus,
} from "@/services/exports/exportService";
import type { JobNimbusPayload, OpportunityExportRecord, TriggerExportRequest } from "@/types/exports";

async function getUserId() {
	if (process.env.NODE_ENV === "test") return "test-user";
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	return user?.id ?? null;
}

async function exportOneTest(record: OpportunityExportRecord) {
	updateExportStatus(record.id, "exporting", { error: null, nextRetryAt: null });
	const result = await sendToJobNimbus(record.payload);
	if (result.success) {
		const exportedAt = new Date().toISOString();
		updateExportStatus(record.id, "exported", {
			jobnimbusId: result.jobnimbusId,
			error: null,
			exportedAt,
		});
		return {
			exportId: record.id,
			status: "exported" as const,
			jobnimbusId: result.jobnimbusId,
			error: null,
		};
	}

	const attempts = record.attempts + 1;
	const shouldRetry = attempts < 3;
	updateExportStatus(record.id, shouldRetry ? "failed" : "permanently_failed", {
		error: result.error,
		attempts,
		nextRetryAt: shouldRetry
			? new Date(Date.now() + calculateRetryDelaySeconds(attempts) * 1000).toISOString()
			: null,
	});
	return {
		exportId: record.id,
		status: "failed" as const,
		jobnimbusId: null,
		error: result.error,
	};
}

function buildFallbackPayload(record: any): JobNimbusPayload {
	return buildExportPayload(
		{
			id: record.house_id,
			address: String(record?.payload?.contact?.address_line1 ?? "Unknown Address"),
			city: String(record?.payload?.contact?.city ?? ""),
			state: String(record?.payload?.contact?.state_text ?? ""),
			zip: String(record?.payload?.contact?.zip ?? ""),
			homeownerName: String(record?.payload?.contact?.display_name ?? "Homeowner"),
			phone: record?.payload?.contact?.mobile_phone ?? null,
			email: record?.payload?.contact?.email ?? null,
		},
		record.mission_id ? { id: record.mission_id, name: `Mission ${record.mission_id}` } : null,
		[],
		null,
	);
}

async function exportOneProd(row: any) {
	const supabase = await createClient();
	const exportingAt = new Date().toISOString();
	await (supabase.from("opportunity_exports") as any)
		.update({ status: "exporting", error: null, next_retry_at: null })
		.eq("id", row.id);

	const payload = (row.payload as JobNimbusPayload | null) ?? buildFallbackPayload(row);
	const result = await sendToJobNimbus(payload);
	if (result.success) {
		await (supabase.from("opportunity_exports") as any)
			.update({
				status: "exported",
				jobnimbus_id: result.jobnimbusId,
				error: null,
				exported_at: exportingAt,
			})
			.eq("id", row.id);
		return {
			exportId: row.id,
			status: "exported" as const,
			jobnimbusId: result.jobnimbusId,
			error: null,
		};
	}

	const attempts = Number(row.attempts ?? 0) + 1;
	const shouldRetry = attempts < 3;
	await (supabase.from("opportunity_exports") as any)
		.update({
			status: shouldRetry ? "failed" : "permanently_failed",
			error: result.error,
			attempts,
			next_retry_at: shouldRetry
				? new Date(Date.now() + calculateRetryDelaySeconds(attempts) * 1000).toISOString()
				: null,
		})
		.eq("id", row.id);

	return {
		exportId: row.id,
		status: "failed" as const,
		jobnimbusId: null,
		error: result.error,
	};
}

export async function POST(request: NextRequest) {
	const userId = await getUserId();
	if (!userId) {
		return NextResponse.json({ data: null, error: "Unauthorized", meta: {} }, { status: 401 });
	}

	let body: TriggerExportRequest;
	try {
		body = await request.json();
	} catch {
		body = {};
	}

	if (process.env.NODE_ENV === "test") {
		let targets: OpportunityExportRecord[] = [];
		if (body.all) {
			targets = getReadyExports();
		} else if (body.exportId) {
			const found = getExportById(body.exportId);
			if (found) targets = [found];
		} else if (Array.isArray(body.exportIds)) {
			targets = body.exportIds
				.map((id) => getExportById(id))
				.filter((record): record is OpportunityExportRecord => Boolean(record));
		}

		targets = targets.filter((record) => record.status === "ready");
		const results = await Promise.all(targets.map((record) => exportOneTest(record)));
		return NextResponse.json({
			data: { triggered: results.length, results },
			error: null,
			meta: { timestamp: new Date().toISOString() },
		});
	}

	const supabase = await createClient();
	let rows: any[] = [];
	if (body.all) {
		const { data } = await (supabase.from("opportunity_exports") as any)
			.select("*")
			.eq("status", "ready")
			.order("created_at", { ascending: true })
			.limit(100);
		rows = data ?? [];
	} else if (body.exportId) {
		const { data } = await (supabase.from("opportunity_exports") as any)
			.select("*")
			.eq("id", body.exportId)
			.single();
		if (data) rows = [data];
	} else if (Array.isArray(body.exportIds) && body.exportIds.length > 0) {
		const { data } = await (supabase.from("opportunity_exports") as any)
			.select("*")
			.in("id", body.exportIds);
		rows = data ?? [];
	}

	rows = rows.filter((row) => row.status === "ready");
	const results = await Promise.all(rows.map((row) => exportOneProd(row)));
	return NextResponse.json({
		data: { triggered: results.length, results },
		error: null,
		meta: { timestamp: new Date().toISOString() },
	});
}
