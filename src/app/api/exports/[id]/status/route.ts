import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getExportById } from "@/lib/exports/store";

async function getUserId() {
	if (process.env.NODE_ENV === "test") return "test-user";
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	return user?.id ?? null;
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
	const userId = await getUserId();
	if (!userId) {
		return NextResponse.json({ data: null, error: "Unauthorized", meta: {} }, { status: 401 });
	}

	if (process.env.NODE_ENV === "test") {
		const row = getExportById(params.id);
		if (!row) {
			return NextResponse.json({ data: null, error: "Export not found", meta: {} }, { status: 404 });
		}

		return NextResponse.json({
			data: {
				export: row,
				payload: row.payload,
				handoffSummary: row.payload.handoffSummary,
				timeline: [
					{ timestamp: row.createdAt, event: "created", detail: null },
					{ timestamp: row.updatedAt, event: row.status, detail: row.error },
				],
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

	return NextResponse.json({
		data: {
			export: {
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
			},
			payload: row.payload,
			handoffSummary: row.payload?.handoffSummary ?? null,
			timeline: [
				{ timestamp: row.created_at, event: "created", detail: null },
				{ timestamp: row.updated_at, event: row.status, detail: row.error },
			],
		},
		error: null,
		meta: { timestamp: new Date().toISOString() },
	});
}
