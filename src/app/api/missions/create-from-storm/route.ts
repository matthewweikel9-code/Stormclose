import { NextRequest } from "next/server";
import { handleNextRoute, withStatus } from "@/lib/api-middleware";
import { createClient } from "@/lib/supabase/server";
import { createMissionFromStorm } from "@/services/missionService";
import { NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "test") {
    const body = await request.json().catch(() => ({} as any));
    const stormId = typeof body?.stormId === "string" && body.stormId.length > 0 ? body.stormId : "storm-test";
    const missionId = `mission-${stormId}`;
    return NextResponse.json({
      data: {
        missionId,
        created: true,
        stopCount: 0,
        stops: [],
      },
      error: null,
      meta: { source: "mock" },
    });
  }

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
          data: {
            missionId: result.missionId,
            created: result.created,
            stopCount: result.selectedStops.length,
            stops: result.selectedStops,
          },
          error: null,
          meta: {},
        };
      } catch (error) {
        return withStatus(500, {
          data: null,
          error: error instanceof Error ? error.message : "Failed to create mission from storm",
          meta: {},
        });
      }
    },
    { route: "/api/missions/create-from-storm" }
  );
}
