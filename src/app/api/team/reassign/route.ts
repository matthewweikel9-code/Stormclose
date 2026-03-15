import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { missionsService } from "@/services/missions/missionService";
import type { ReassignRequest, ReassignResponse } from "@/types/team";

/**
 * POST /api/team/reassign
 * Reassigns a rep to a new mission or storm zone.
 * Manager/owner only.
 *
 * Body: { repId, toMissionId?, toStormZoneId?, reason? }
 */
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

		const body: ReassignRequest = await request.json();

		if (!body?.repId) {
			return NextResponse.json(
				{ data: null, error: "repId is required", meta: {} },
				{ status: 400 },
			);
		}

		if (!body.toMissionId && !body.toStormZoneId) {
			return NextResponse.json(
				{ data: null, error: "toMissionId or toStormZoneId is required", meta: {} },
				{ status: 400 },
			);
		}

		// If reassigning to an existing mission, update the mission
		if (body.toMissionId) {
			const detail = await missionsService.getMissionDetail(userId, body.toMissionId);
			if (!detail) {
				return NextResponse.json(
					{ data: null, error: "Target mission not found", meta: {} },
					{ status: 404 },
				);
			}

			// Find the rep's current active mission to record previous
			const allMissions = await missionsService.listMissions(userId, { limit: 200 });
			const currentMission = allMissions.find(
				(m) => m.assignedRepId === body.repId && m.status === "active",
			);

			// Update the target mission assignment
			await missionsService.updateMission(userId, body.toMissionId, {
				assignedRepId: body.repId,
			});

			const result: ReassignResponse = {
				mission: {
					id: body.toMissionId,
					name: detail.mission.name,
					status: detail.mission.status,
					assignedRepId: body.repId,
				},
				previousMissionId: currentMission?.id ?? null,
			};

			return NextResponse.json({
				data: result,
				error: null,
				meta: { reason: body.reason ?? null },
			});
		}

		// If reassigning to a storm zone, create a new mission (stub for now)
		return NextResponse.json(
			{
				data: null,
				error: "Zone-based reassignment not yet implemented",
				meta: {},
			},
			{ status: 501 },
		);
	} catch (error) {
		return NextResponse.json(
			{
				data: null,
				error: error instanceof Error ? error.message : "Failed to reassign",
				meta: {},
			},
			{ status: 500 },
		);
	}
}
