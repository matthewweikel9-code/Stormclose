import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserTeamMemberships } from "@/lib/server/tenant";

/**
 * GET /api/storm-pipeline/mission-pack
 * Fetch latest mission pack for the user/team
 *
 * Query: ?id=uuid (optional - fetch specific pack)
 */
export async function GET(request: NextRequest) {
	try {
		const supabase = await createClient();
		const { data: { user } } = await supabase.auth.getUser();

		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { searchParams } = new URL(request.url);
		const packId = searchParams.get("id");

		const memberships = await getUserTeamMemberships(supabase, user.id);
		const teamIds = memberships.map((m) => m.team_id);

		if (packId) {
			const { data: pack, error } = await (supabase as any)
				.from("mission_packs")
				.select("*")
				.eq("id", packId)
				.eq("user_id", user.id)
				.maybeSingle();

			if (error) {
				return NextResponse.json({ error: error.message }, { status: 500 });
			}

			// Also allow team packs
			let teamPackData = null;
			if (!pack && teamIds.length > 0) {
				const res = await (supabase as any)
					.from("mission_packs")
					.select("*")
					.eq("id", packId)
					.in("team_id", teamIds)
					.maybeSingle();
				teamPackData = res.data;
			}

			const found = pack ?? teamPackData;
			if (!found) {
				return NextResponse.json({ error: "Mission pack not found" }, { status: 404 });
			}

			return NextResponse.json({ pack: found });
		}

		// Latest pack: user's own or team's
		const { data: userPacks } = await (supabase as any)
			.from("mission_packs")
			.select("*")
			.eq("user_id", user.id)
			.order("created_at", { ascending: false })
			.limit(5);

		const { data: teamPacks } =
			teamIds.length > 0
				? await (supabase as any)
						.from("mission_packs")
						.select("*")
						.in("team_id", teamIds)
						.order("created_at", { ascending: false })
						.limit(5)
				: { data: [] };

		const combined = [...(userPacks ?? []), ...(teamPacks ?? [])]
			.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
			.slice(0, 5);

		const pack = combined[0] ?? null;
		return NextResponse.json({ pack, packs: combined });
	} catch (error) {
		console.error("[Mission pack] Error:", error);
		return NextResponse.json(
			{ error: "Failed to fetch mission pack" },
			{ status: 500 }
		);
	}
}
