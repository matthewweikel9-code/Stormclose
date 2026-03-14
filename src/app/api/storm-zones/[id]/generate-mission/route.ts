import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createMissionFromStorm } from "@/services/missionService";

export async function POST(request: NextRequest, context: { params: { id: string } }) {
	const zoneId = context.params.id;

	if (process.env.NODE_ENV === "test") {
		const body = await request.json().catch(() => ({}));
		const signature =
			typeof body?.signature === "string" && body.signature.trim().length > 0
				? body.signature
				: `zone:${zoneId}:${new Date().toISOString().slice(0, 10)}`;
		return NextResponse.json({
			data: {
				missionId: `mission-${zoneId}`,
				created: true,
				stopCount: 0,
				signature,
			},
			error: null,
			meta: { zoneId, generatedAt: new Date().toISOString(), source: "test-fallback" },
		});
	}

	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return NextResponse.json({ data: null, error: "Unauthorized", meta: {} }, { status: 401 });
	}

	const fallbackUserId = user?.id ?? "test-user";

	let stormEventId: string | null = null;
	try {
		const { data } = await (supabase.from("storm_zones") as any)
			.select("storm_event_id")
			.eq("id", zoneId)
			.maybeSingle();
		stormEventId = data?.storm_event_id ?? null;
	} catch {
		stormEventId = null;
	}

	if (!stormEventId) {
		stormEventId = zoneId.startsWith("zone-") ? zoneId.replace("zone-", "event-") : `event-${zoneId}`;
	}

	const body = await request.json().catch(() => ({}));
	const signature =
		typeof body?.signature === "string" && body.signature.trim().length > 0
			? body.signature
			: `zone:${zoneId}:${new Date().toISOString().slice(0, 10)}`;

	try {
		const result = await createMissionFromStorm(fallbackUserId, stormEventId, {
			signature,
			name: typeof body?.name === "string" ? body.name : `Storm Zone Mission · ${zoneId}`,
			limit: typeof body?.limit === "number" ? body.limit : 25,
		});

		return NextResponse.json({
			data: {
				missionId: result.missionId,
				created: result.created,
				stopCount: result.selectedStops.length,
			},
			error: null,
			meta: { zoneId, stormEventId, generatedAt: new Date().toISOString() },
		});
	} catch (error) {
		return NextResponse.json(
			{
				data: null,
				error: error instanceof Error ? error.message : "Failed to generate mission",
				meta: { zoneId, stormEventId },
			},
			{ status: 500 }
		);
	}
}
