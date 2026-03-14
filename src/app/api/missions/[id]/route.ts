import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { missionsService } from "@/services/missions/missionService";

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

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
	try {
		const userId = await getUserId();
		if (!userId) {
			return NextResponse.json({ data: null, error: "Unauthorized", meta: {} }, { status: 401 });
		}

		const detail = await missionsService.getMissionDetail(userId, params.id);
		let liveRepPosition: unknown = null;
		if (process.env.NODE_ENV !== "test") {
			try {
				const supabase = await createClient();
				const { data } = await (supabase.from("rep_presence") as any)
					.select("*")
					.eq("mission_id", params.id)
					.maybeSingle();
				liveRepPosition = data || null;
			} catch {
				liveRepPosition = null;
			}
		}

		return NextResponse.json({
			data: {
				...detail,
				liveRepPosition,
			},
			error: null,
			meta: {},
		});
	} catch (error) {
		return NextResponse.json(
			{ data: null, error: error instanceof Error ? error.message : "Failed to fetch mission", meta: {} },
			{ status: 500 }
		);
	}
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
	try {
		const userId = await getUserId();
		if (!userId) {
			return NextResponse.json({ data: null, error: "Unauthorized", meta: {} }, { status: 401 });
		}

		const body = await request.json();
		const mission = await missionsService.updateMission(userId, params.id, {
			status: body?.status,
			assignedRepId: body?.assignedRepId,
			description: body?.description,
			deploymentRecommendation: body?.deploymentRecommendation,
		});
		return NextResponse.json({ data: mission, error: null, meta: {} });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Failed to update mission";
		const status = message.toLowerCase().includes("invalid transition") ? 409 : 500;
		return NextResponse.json({ data: null, error: message, meta: {} }, { status });
	}
}
