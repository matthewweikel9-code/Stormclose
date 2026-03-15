import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { missionsService } from "@/services/missions/missionService";
import { errorResponse, successResponse } from "@/utils/api-response";
import { logger } from "@/lib/logger";

const MissionsQuerySchema = z.object({
	status: z.string().optional(),
	assignedRepId: z.string().optional(),
	aiGenerated: z.enum(["true", "false"]).optional(),
	q: z.string().optional(),
	limit: z.coerce.number().int().positive().max(200).optional(),
});

const CreateMissionSchema = z.object({
	name: z.string().min(1),
}).passthrough();

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
		const parsedQuery = MissionsQuerySchema.parse({
			status: searchParams.get("status") ?? undefined,
			assignedRepId: searchParams.get("assignedRepId") ?? undefined,
			aiGenerated: searchParams.get("aiGenerated") ?? undefined,
			q: searchParams.get("q") ?? undefined,
			limit: searchParams.get("limit") ?? undefined,
		});
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
			return errorResponse("Unauthorized", 401);
		}

		const data = await missionsService.listMissions(userId, {
			status: (parsedQuery.status as any) ?? undefined,
			assignedRepId: parsedQuery.assignedRepId,
			aiGenerated:
				parsedQuery.aiGenerated === undefined
					? undefined
					: parsedQuery.aiGenerated === "true",
			q: parsedQuery.q,
			limit: parsedQuery.limit ?? 50,
		});

		logger.info("missions.list", { userId, total: data.length });
		return successResponse(data, { total: data.length });
	} catch (error) {
		if (error instanceof z.ZodError) {
			return errorResponse("Invalid query parameters", 400, { details: error.flatten() });
		}
		return errorResponse(error instanceof Error ? error.message : "Failed to list missions", 500);
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
			return errorResponse("Unauthorized", 401);
		}

		const body = CreateMissionSchema.parse(await request.json());

		const data = await missionsService.createMission(userId, body);
		logger.info("missions.create", { userId, missionId: data.mission.id });
		return successResponse(data, {}, 201);
	} catch (error) {
		if (error instanceof z.ZodError) {
			return errorResponse("Invalid request payload", 400, { details: error.flatten() });
		}
		return errorResponse(error instanceof Error ? error.message : "Failed to create mission", 500);
	}
}
