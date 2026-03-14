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

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
	try {
		const userId = await getUserId();
		if (!userId) {
			return NextResponse.json({ data: null, error: "Unauthorized", meta: {} }, { status: 401 });
		}
		const body = await request.json();
		if (!body?.status) {
			return NextResponse.json({ data: null, error: "status is required", meta: {} }, { status: 400 });
		}

		const updated = await missionsService.recordStopOutcome(userId, params.id, {
			status: body.status,
			outcomeData: body.outcomeData,
			notes: body.notes,
			arrivedAt: body.arrivedAt,
			departedAt: body.departedAt,
		});
		return NextResponse.json({ data: updated, error: null, meta: {} });
	} catch (error) {
		return NextResponse.json(
			{ data: null, error: error instanceof Error ? error.message : "Failed to record stop outcome", meta: {} },
			{ status: 500 }
		);
	}
}
