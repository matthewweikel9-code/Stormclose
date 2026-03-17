import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserTeamMemberships } from "@/lib/server/tenant";

// GET /api/teams - List teams for current user
export async function GET() {
	try {
		const supabase = await createClient();
		const {
			data: { user }
		} = await supabase.auth.getUser();

		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const memberships = await getUserTeamMemberships(supabase, user.id);
		if (memberships.length === 0) {
			return NextResponse.json({ teams: [] });
		}

		const teamIds = memberships.map((membership) => membership.team_id);
		const { data: teams, error: teamsError } = await (supabase.from("teams") as any)
			.select("*")
			.in("id", teamIds);

		if (teamsError) {
			throw new Error(teamsError.message);
		}

		const enrichedTeams = (teams ?? []).map((team: { id: string }) => ({
			...team,
			role: memberships.find((membership) => membership.team_id === team.id)?.role ?? "member"
		}));

		return NextResponse.json({ teams: enrichedTeams });
	} catch (error) {
		console.error("Error fetching teams:", error);
		return NextResponse.json({ error: "Failed to fetch teams" }, { status: 500 });
	}
}

// POST /api/teams - Create a new team
export async function POST(request: NextRequest) {
	try {
		const supabase = await createClient();
		const {
			data: { user }
		} = await supabase.auth.getUser();

		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const body = await request.json();
		const name = typeof body?.name === "string" ? body.name.trim() : "";

		if (!name) {
			return NextResponse.json({ error: "Team name is required" }, { status: 400 });
		}

		// Use admin client to bypass RLS (user already validated above)
		const admin = createAdminClient();

		const { data: team, error: teamError } = await (admin.from("teams") as any)
			.insert({
				name,
				owner_id: user.id
			})
			.select()
			.single();

		if (teamError) {
			console.error("Error creating team:", teamError);
			const msg = process.env.NODE_ENV === "development" ? teamError.message : "Failed to create team";
			return NextResponse.json({ error: msg }, { status: 500 });
		}

		// Add owner to team_members for role-based access
		const { error: memberError } = await (admin.from("team_members") as any).upsert(
			{
				team_id: team.id,
				user_id: user.id,
				role: "owner"
			},
			{ onConflict: "team_id,user_id" }
		);

		if (memberError) {
			console.error("Error adding owner to team_members:", memberError);
			const msg = process.env.NODE_ENV === "development" ? memberError.message : "Failed to create team";
			return NextResponse.json({ error: msg }, { status: 500 });
		}

		return NextResponse.json({ team }, { status: 201 });
	} catch (error) {
		console.error("Error creating team:", error);
		const msg = process.env.NODE_ENV === "development" && error instanceof Error ? error.message : "Failed to create team";
		return NextResponse.json({ error: msg }, { status: 500 });
	}
}
