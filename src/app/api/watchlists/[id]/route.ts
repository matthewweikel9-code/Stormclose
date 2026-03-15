import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateWatchlist } from "@/lib/storms/watchlistStore";
import type { UpdateWatchlistInput } from "@/types/storms";

export async function PATCH(request: NextRequest, context: { params: { id: string } }) {
	const watchlistId = context.params.id;
	const body = (await request.json().catch(() => null)) as UpdateWatchlistInput | null;
	if (!body) {
		return NextResponse.json({ data: null, error: "Invalid body", meta: {} }, { status: 400 });
	}

	if (process.env.NODE_ENV === "test") {
		const updated = updateWatchlist("test-user", watchlistId, body);
		if (!updated) {
			return NextResponse.json({ data: null, error: "Watchlist not found", meta: { id: watchlistId } }, { status: 404 });
		}
		return NextResponse.json({ data: updated, error: null, meta: { source: "mock" } });
	}

	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	const userId = user?.id ?? "test-user";
	const useMock = !user;

	if (useMock) {
		const updated = updateWatchlist(userId, watchlistId, body);
		if (!updated) {
			return NextResponse.json({ data: null, error: "Watchlist not found", meta: { id: watchlistId } }, { status: 404 });
		}
		return NextResponse.json({ data: updated, error: null, meta: { source: "mock" } });
	}

	const updatePayload: Record<string, unknown> = {};
	if (typeof body.name === "string") {
		updatePayload.name = body.name;
	}
	if (typeof body.boundsWkt === "string") {
		updatePayload.bounds = body.boundsWkt;
	}
	if (typeof body.alertThreshold === "number") {
		updatePayload.alert_threshold = body.alertThreshold;
	}
	if (typeof body.active === "boolean") {
		updatePayload.active = body.active;
	}

	if (Object.keys(updatePayload).length === 0) {
		return NextResponse.json({ data: null, error: "No patch fields supplied", meta: {} }, { status: 400 });
	}

	const { data, error } = await (supabase.from("territory_watchlists") as any)
		.update(updatePayload)
		.eq("id", watchlistId)
		.eq("user_id", userId)
		.select("*")
		.maybeSingle();

	if (error) {
		return NextResponse.json({ data: null, error: error.message, meta: {} }, { status: 500 });
	}

	if (!data) {
		return NextResponse.json({ data: null, error: "Watchlist not found", meta: { id: watchlistId } }, { status: 404 });
	}

	return NextResponse.json({
		data: {
			id: data.id,
			userId: data.user_id,
			name: data.name,
			boundsWkt: typeof data.bounds === "string" ? data.bounds : body.boundsWkt ?? "",
			alertThreshold: Number(data.alert_threshold) || 70,
			active: Boolean(data.active),
			createdAt: data.created_at,
		},
		error: null,
		meta: { source: "db" },
	});
}
