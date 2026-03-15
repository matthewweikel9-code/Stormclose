import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createWatchlist, listWatchlists } from "@/lib/storms/watchlistStore";
import { getMockWatchlists } from "@/lib/storms/mockStormsData";
import type { CreateWatchlistInput } from "@/types/storms";

function getWktPoint(lat: number, lng: number): string {
	return `POLYGON((${lng - 0.05} ${lat - 0.05},${lng + 0.05} ${lat - 0.05},${lng + 0.05} ${lat + 0.05},${lng - 0.05} ${lat + 0.05},${lng - 0.05} ${lat - 0.05}))`;
}

export async function GET() {
	if (process.env.NODE_ENV === "test") {
		const userId = "test-user";
		const inMemory = listWatchlists(userId);
		const data = inMemory.length > 0 ? inMemory : getMockWatchlists(userId);
		return NextResponse.json({ data, error: null, meta: { total: data.length, source: "mock" } });
	}

	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	const userId = user?.id ?? "test-user";
	const useMock = !user;

	if (useMock) {
		const inMemory = listWatchlists(userId);
		const data = inMemory.length > 0 ? inMemory : getMockWatchlists(userId);
		return NextResponse.json({ data, error: null, meta: { total: data.length, source: "mock" } });
	}

	const { data, error } = await (supabase.from("territory_watchlists") as any)
		.select("*")
		.eq("user_id", userId)
		.order("created_at", { ascending: false });

	if (error) {
		return NextResponse.json({ data: null, error: error.message, meta: {} }, { status: 500 });
	}

	return NextResponse.json({
		data: (data || []).map((row: any) => ({
			id: row.id,
			userId: row.user_id,
			name: row.name,
			boundsWkt: typeof row.bounds === "string" ? row.bounds : getWktPoint(32.9, -96.8),
			alertThreshold: Number(row.alert_threshold) || 70,
			active: Boolean(row.active),
			createdAt: row.created_at,
		})),
		error: null,
		meta: { total: data?.length ?? 0, source: "db" },
	});
}

export async function POST(request: NextRequest) {
	if (process.env.NODE_ENV === "test") {
		const userId = "test-user";
		const body = (await request.json().catch(() => null)) as CreateWatchlistInput | null;
		if (!body || !body.name || !body.boundsWkt) {
			return NextResponse.json({ data: null, error: "name and boundsWkt are required", meta: {} }, { status: 400 });
		}
		const created = createWatchlist(userId, body);
		return NextResponse.json({ data: created, error: null, meta: { source: "mock" } }, { status: 201 });
	}

	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	const userId = user?.id ?? "test-user";
	const body = (await request.json().catch(() => null)) as CreateWatchlistInput | null;

	if (!body || !body.name || !body.boundsWkt) {
		return NextResponse.json({ data: null, error: "name and boundsWkt are required", meta: {} }, { status: 400 });
	}

	const useMock = !user;
	if (useMock) {
		const created = createWatchlist(userId, body);
		return NextResponse.json({ data: created, error: null, meta: { source: "mock" } }, { status: 201 });
	}

	const payload = {
		user_id: userId,
		name: body.name,
		bounds: body.boundsWkt,
		alert_threshold: body.alertThreshold ?? 70,
		active: body.active ?? true,
	};

	const { data, error } = await (supabase.from("territory_watchlists") as any)
		.insert(payload)
		.select("*")
		.single();

	if (error) {
		return NextResponse.json({ data: null, error: error.message, meta: {} }, { status: 500 });
	}

	return NextResponse.json(
		{
			data: {
				id: data.id,
				userId: data.user_id,
				name: data.name,
				boundsWkt: typeof data.bounds === "string" ? data.bounds : body.boundsWkt,
				alertThreshold: Number(data.alert_threshold) || 70,
				active: Boolean(data.active),
				createdAt: data.created_at,
			},
			error: null,
			meta: { source: "db" },
		},
		{ status: 201 }
	);
}
