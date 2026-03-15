import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { presenceService } from "@/services/presence/presenceService";
import { errorResponse, successResponse } from "@/utils/api-response";
import { metrics } from "@/lib/metrics";
import { logger } from "@/lib/logger";

const HeartbeatSchema = z.object({
	missionId: z.string().min(1),
	lat: z.number().finite().gte(-90).lte(90),
	lng: z.number().finite().gte(-180).lte(180),
	accuracy: z.number().finite().nonnegative().nullable().optional(),
	heading: z.number().finite().nullable().optional(),
	speed: z.number().finite().nullable().optional(),
});

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
	const start = Date.now();
	try {
		const userId = await getUserId();
		if (!userId) {
			return errorResponse("Unauthorized", 401);
		}
		const body = HeartbeatSchema.parse(await request.json());

		const result = await presenceService.heartbeat(userId, {
			missionId: body.missionId,
			lat: body.lat,
			lng: body.lng,
			accuracy: Number.isFinite(body.accuracy ?? null) ? Number(body.accuracy) : null,
			heading: Number.isFinite(body.heading ?? null) ? Number(body.heading) : null,
			speed: Number.isFinite(body.speed ?? null) ? Number(body.speed) : null,
		});

		metrics.increment("heartbeat_received", 1, { missionId: body.missionId });
		metrics.increment("api_latency_ms", Date.now() - start, {
			route: "/api/presence/heartbeat",
			method: "POST",
		});
		logger.info("presence.heartbeat", {
			userId,
			missionId: body.missionId,
			latencyMs: Date.now() - start,
		});

		return successResponse({
			presence: result.presence,
			nextBestHouse: result.nextBest,
			nextIntervalSeconds: result.nextIntervalSeconds,
		});
	} catch (error) {
		if (error instanceof z.ZodError) {
			return errorResponse("Invalid heartbeat payload", 400, { details: error.flatten() });
		}
		return errorResponse(error instanceof Error ? error.message : "Failed heartbeat", 500);
	}
}
