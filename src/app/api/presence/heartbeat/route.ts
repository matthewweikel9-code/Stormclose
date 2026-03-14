import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { presenceService } from "@/services/presence/presenceService";

async function getUserId() {
	if (process.env.NODE_ENV === "test") {
		return "test-user";
	}
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	return user?.id ?? null;
}

export async function POST(request: NextRequest) {
	try {
		const userId = await getUserId();
		if (!userId) {
			return NextResponse.json({ data: null, error: "Unauthorized", meta: {} }, { status: 401 });
		}
		const body = await request.json();
		if (!body?.missionId || !Number.isFinite(body?.lat) || !Number.isFinite(body?.lng)) {
			return NextResponse.json(
				{ data: null, error: "missionId, lat, and lng are required", meta: {} },
				{ status: 400 }
			);
		}

		const result = await presenceService.heartbeat(userId, {
			missionId: body.missionId,
			lat: Number(body.lat),
			lng: Number(body.lng),
			accuracy: Number.isFinite(body.accuracy) ? Number(body.accuracy) : null,
			heading: Number.isFinite(body.heading) ? Number(body.heading) : null,
			speed: Number.isFinite(body.speed) ? Number(body.speed) : null,
		});

		return NextResponse.json({
			data: {
				presence: result.presence,
				nextBestHouse: result.nextBest,
				nextIntervalSeconds: result.nextIntervalSeconds,
			},
			error: null,
			meta: {},
		});
	} catch (error) {
		return NextResponse.json(
			{ data: null, error: error instanceof Error ? error.message : "Failed heartbeat", meta: {} },
			{ status: 500 }
		);
	}
}
