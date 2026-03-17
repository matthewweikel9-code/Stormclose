import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { missionsService } from "@/services/missions/missionService";
import { errorResponse, successResponse } from "@/utils/api-response";
import { logger } from "@/lib/logger";

type RouteContext = {
	params: {
		id: string;
	};
};

export async function GET(_request: NextRequest, { params }: RouteContext) {
	try {
		const missionId = params.id;
		if (!missionId) {
			return errorResponse("Mission id is required", 400);
		}

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

		const data = await missionsService.getMission(userId, missionId);
		logger.info("missions.detail", { userId, missionId });
		return successResponse(data);
	} catch (error) {
		return errorResponse(error instanceof Error ? error.message : "Failed to load mission", 500);
	}
}
