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

export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
	try {
		const userId = await getUserId();
		if (!userId) {
			return NextResponse.json({ data: null, error: "Unauthorized", meta: {} }, { status: 401 });
		}

		const data = await missionsService.rebalanceMission(userId, params.id);
		return NextResponse.json({ data, error: null, meta: {} });
	} catch (error) {
		return NextResponse.json(
			{ data: null, error: error instanceof Error ? error.message : "Failed to rebalance mission", meta: {} },
			{ status: 500 }
		);
	}
}
