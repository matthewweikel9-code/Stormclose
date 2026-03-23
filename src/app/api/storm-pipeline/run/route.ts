import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveWriteTeamIdForUser } from "@/lib/server/tenant";
import { runStormPipeline } from "@/lib/storm-pipeline/orchestrator";

/**
 * POST /api/storm-pipeline/run
 * Trigger storm-to-rep pipeline: re-score, briefing, mission pack
 *
 * Body:
 *   - triggerType: 'storm_alert' | 'territory_update' | 'manual'
 *   - triggerId?: string (alert id, territory id)
 *   - territoryId?: string
 *   - stormAlertId?: string
 *   - centerLat?, centerLng?, radiusMiles? (for manual/radius scope)
 */
export async function POST(request: NextRequest) {
	try {
		const supabase = await createClient();
		const { data: { user } } = await supabase.auth.getUser();

		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		let body: {
			triggerType?: "storm_alert" | "territory_update" | "manual";
			triggerId?: string;
			territoryId?: string;
			stormAlertId?: string;
			centerLat?: number;
			centerLng?: number;
			radiusMiles?: number;
		};
		try {
			body = await request.json();
		} catch {
			return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
		}

		const triggerType = body.triggerType ?? "manual";
		const territoryId = body.territoryId;
		const stormAlertId = body.stormAlertId;

		let teamId: string | null = null;
		try {
			teamId = await resolveWriteTeamIdForUser(supabase, user.id, null);
		} catch {
			// Single-user mode
		}

		const result = await runStormPipeline({
			triggerType,
			triggerId: body.triggerId ?? territoryId ?? stormAlertId ?? undefined,
			userId: user.id,
			teamId,
			territoryId: territoryId ?? undefined,
			stormAlertId: stormAlertId ?? undefined,
			centerLat: body.centerLat,
			centerLng: body.centerLng,
			radiusMiles: body.radiusMiles ?? 5,
		});

		return NextResponse.json(result);
	} catch (error) {
		console.error("[Storm pipeline] Error:", error);
		return NextResponse.json(
			{ error: "Pipeline failed", details: String(error) },
			{ status: 500 }
		);
	}
}
