import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { missionsService } from "@/services/missions/missionService";

/**
 * GET /api/missions
 * List user's canvass missions with stats
 * 
 * Query params:
 *   - status: filter by status (planned|in_progress|completed|cancelled)
 *   - days: how far back (default 30)
 *   - limit: max results (default 20)
 * 
 * POST /api/missions
 * Create a new canvass mission
 * 
 * Body:
 *   - name: mission name
 *   - stormEventId?: linked storm event
 *   - centerLat, centerLng: center point
 *   - radiusMiles?: scan radius
 *   - stops: array of { address, lat, lng, ownerName?, yearBuilt?, ... }
 *   - scheduledDate?: ISO date
 * 
 * PATCH /api/missions
 * Update a mission (status, stops outcomes, etc.)
 * 
 * Body:
 *   - missionId: UUID
 *   - action: "start" | "complete" | "cancel" | "update_stop"
 *   - ... action-specific fields
 */

// ─── GET: List missions ────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const userId =
			process.env.NODE_ENV === "test"
				? "test-user"
				: await (async () => {
					const supabase = await createClient();
					const {
						data: { user },
					} = await supabase.auth.getUser();
					return user?.id ?? null;
				})();

		if (!userId) {
			return NextResponse.json({ data: null, error: "Unauthorized", meta: {} }, { status: 401 });
		}

		const data = await missionsService.listMissions(userId, {
			status: (searchParams.get("status") as any) ?? undefined,
			assignedRepId: searchParams.get("assignedRepId") ?? undefined,
			aiGenerated:
				searchParams.get("aiGenerated") === null
					? undefined
					: searchParams.get("aiGenerated") === "true",
			q: searchParams.get("q") ?? undefined,
			limit: Number(searchParams.get("limit") ?? 50),
		});

		return NextResponse.json({
			data,
			error: null,
			meta: { total: data.length },
		});
	} catch (error) {
		return NextResponse.json(
			{ data: null, error: error instanceof Error ? error.message : "Failed to list missions", meta: {} },
			{ status: 500 }
		);
	}
}

// ─── POST: Create mission ──────────────────────────────────────────────────
export async function POST(request: NextRequest) {
    try {
		const userId =
			process.env.NODE_ENV === "test"
				? "test-user"
				: await (async () => {
					const supabase = await createClient();
					const {
						data: { user },
					} = await supabase.auth.getUser();
					return user?.id ?? null;
				})();

		if (!userId) {
			return NextResponse.json({ data: null, error: "Unauthorized", meta: {} }, { status: 401 });
		}

		const body = await request.json();
		if (!body?.name || typeof body.name !== "string") {
			return NextResponse.json({ data: null, error: "name is required", meta: {} }, { status: 400 });
		}

		const data = await missionsService.createMission(userId, body);
		return NextResponse.json({ data, error: null, meta: {} }, { status: 201 });
	} catch (error) {
		return NextResponse.json(
			{ data: null, error: error instanceof Error ? error.message : "Failed to create mission", meta: {} },
			{ status: 500 }
		);
	}
}
