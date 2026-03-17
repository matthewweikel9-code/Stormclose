import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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

		const { name, description } = await request.json();

		if (!name || typeof name !== "string") {
			return NextResponse.json({ error: "Team name is required" }, { status: 400 });
		}

		const { data: team, error: teamError } = await (supabase.from("teams") as any)
			.insert({
				name: name.trim(),
				description: typeof description === "string" ? description : null,
				owner_id: user.id
			})
			.select()
			.single();

		if (teamError) {
			throw new Error(teamError.message);
		}

		// Keep membership table in sync for role-based access checks.
		const { error: memberError } = await (supabase.from("team_members") as any).upsert(
			{
				team_id: team.id,
				user_id: user.id,
				role: "owner"
			},
			{ onConflict: "team_id,user_id" }
		);

		if (memberError) {
			throw new Error(memberError.message);
		}

		return NextResponse.json({ team }, { status: 201 });
	} catch (error) {
		console.error("Error creating team:", error);
		return NextResponse.json({ error: "Failed to create team" }, { status: 500 });
	}
}
