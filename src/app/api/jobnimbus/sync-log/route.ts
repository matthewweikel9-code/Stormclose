import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/jobnimbus/sync-log
 * Fetch recent JobNimbus sync/export history for the user (surfaced in UI)
 *
 * Query: ?limit=20 (default 20)
 */
export async function GET(request: NextRequest) {
	try {
		const supabase = await createClient();
		const { data: { user } } = await supabase.auth.getUser();

		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { searchParams } = new URL(request.url);
		const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10) || 20, 100);

		const { data: logs, error } = await (supabase as any)
			.from("jobnimbus_sync_log")
			.select("id, sync_type, direction, status, error_message, message, jobnimbus_id, created_at")
			.eq("user_id", user.id)
			.order("created_at", { ascending: false })
			.limit(limit);

		if (error) {
			return NextResponse.json({ error: error.message }, { status: 500 });
		}

		return NextResponse.json({ logs: logs ?? [], summary: { total: logs?.length ?? 0 } });
	} catch (error) {
		console.error("[JobNimbus sync-log] Error:", error);
		return NextResponse.json(
			{ error: "Failed to fetch sync log" },
			{ status: 500 }
		);
	}
}
