import { NextRequest } from "next/server";
import { handleNextRoute, withStatus } from "@/lib/api-middleware";
import { createClient } from "@/lib/supabase/server";
import { createMissionFromStorm } from "@/services/missionService";

export async function POST(request: NextRequest) {
  return handleNextRoute(
    request,
    async ({ setUserId }) => {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setUserId(user?.id);

      if (!user) {
        return withStatus(401, { error: "Unauthorized" });
      }

      try {
        const body = await request.json();
        const stormId = body?.stormId;
        const options = body?.options || {};

        if (typeof stormId !== "string" || stormId.trim().length === 0) {
          return withStatus(400, { error: "stormId is required" });
        }

        if (typeof options.signature !== "string" || options.signature.trim().length === 0) {
          return withStatus(400, { error: "options.signature is required" });
        }

        const result = await createMissionFromStorm(user.id, stormId, options);

        return {
          success: true,
          missionId: result.missionId,
          created: result.created,
          stopCount: result.selectedStops.length,
          stops: result.selectedStops,
        };
      } catch (error) {
        return withStatus(500, {
          error: "Failed to create mission from storm",
          details: error instanceof Error ? error.message : String(error),
        });
      }
    },
    { route: "/api/missions/create-from-storm" }
  );
}
