import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { presenceService } from "@/services/presence/presenceService";

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
	try {
		const userId = await getUserId();
		if (!userId) {
			return NextResponse.json({ data: null, error: "Unauthorized", meta: {} }, { status: 401 });
		}

		const body = await request.json();
		if (!body?.missionId) {
			return NextResponse.json({ data: null, error: "missionId is required", meta: {} }, { status: 400 });
		}

		const mode = body?.mode === "offline" ? "offline" : "idle";
		const data = await presenceService.endMission(userId, body.missionId, mode);
		return NextResponse.json({ data, error: null, meta: {} });
	} catch (error) {
		return NextResponse.json(
			{ data: null, error: error instanceof Error ? error.message : "Failed to end mission", meta: {} },
			{ status: 500 }
		);
	}
}
