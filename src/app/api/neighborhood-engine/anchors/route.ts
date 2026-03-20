import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";
import { resolvePrimaryTeamId } from "@/lib/server/tenant";
import { checkFeatureAccess } from "@/lib/subscriptions/access";
import { missionsService } from "@/services/missions/missionService";
import { errorResponse, successResponse } from "@/utils/api-response";

export interface AnchorLead {
  id: string;
  address: string;
  lat: number | null;
  lng: number | null;
  source: "mission" | "referral";
  missionName?: string;
  outcome?: string;
  status?: string;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

		if (!user) {
			return errorResponse("Unauthorized", 401);
		}

		const access = await checkFeatureAccess(user.id, "lead_generator");
		if (!access.allowed) {
			return errorResponse(access.reason ?? "Upgrade required", 403);
		}

		const missionLeads: AnchorLead[] = [];
    const referralLeads: AnchorLead[] = [];
    const debug: { missionsCount?: number; missionsError?: string; stopsPerMission?: Record<string, number>; stopsErrors?: string[] } = {};

    // Use missionService (supports both DB and in-memory fallback)
    const teamId = await resolvePrimaryTeamId(supabase, user.id);
    let missions: { id: string; name: string }[] = [];
    let missionsError: Error | null = null;

    try {
      const list = await missionsService.listMissions(user.id, { limit: 50 });
      missions = list.map((m) => ({ id: m.id, name: m.name }));
    } catch (e) {
      missionsError = e instanceof Error ? e : new Error(String(e));
    }

    debug.missionsCount = missions.length;
    if (missionsError) debug.missionsError = missionsError.message;
    debug.stopsPerMission = {};
    debug.stopsErrors = [];

    for (const mission of missions) {
      try {
        const { stops } = await missionsService.getMission(user.id, mission.id);
        const stopSlice = stops.slice(0, 15);
        debug.stopsPerMission![mission.name] = stopSlice.length;

        for (const stop of stopSlice) {
          missionLeads.push({
            id: stop.id,
            address: stop.address,
            lat: stop.lat ?? null,
            lng: stop.lng ?? null,
            source: "mission",
            missionName: mission.name ?? undefined,
            outcome: stop.outcome ?? undefined,
          });
        }
      } catch (e) {
        debug.stopsErrors!.push(`${mission.name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // Referrals (referral leads)
    if (teamId) {
      const { data: refRows, error: refsError } = await (supabase.from("partner_engine_referrals") as any)
        .select("id, property_address, city, state, zip, status")
        .eq("team_id", teamId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (!refsError && Array.isArray(refRows)) {
        for (const row of refRows) {
          const fullAddress = [row.property_address, row.city, row.state, row.zip]
            .filter(Boolean)
            .join(", ");
          referralLeads.push({
            id: row.id,
            address: fullAddress || row.property_address,
            lat: null,
            lng: null,
            source: "referral",
            status: row.status ?? undefined,
          });
        }
      }
    }

    if (process.env.NODE_ENV !== "production") {
      console.log("[Neighborhood Engine Anchors]", {
        missionsCount: debug.missionsCount,
        missionLeadsCount: missionLeads.length,
        referralLeadsCount: referralLeads.length,
      });
    }

    return successResponse(
      { missionLeads, referralLeads },
      process.env.NODE_ENV !== "production" ? { debug } : {}
    );
  } catch (error) {
    console.error("[Neighborhood Engine] Anchors error:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Failed to fetch anchors",
      500
    );
  }
}
