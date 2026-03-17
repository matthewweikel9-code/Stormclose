import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserRoleForTeam, hasMinimumRole, type TeamRole } from "@/lib/server/tenant";

const VALID_TEAM_ROLES: TeamRole[] = ["owner", "admin", "manager", "member"];

function normalizeRole(value: unknown): TeamRole {
	if (typeof value !== "string") return "member";
	return VALID_TEAM_ROLES.includes(value as TeamRole) ? (value as TeamRole) : "member";
}

async function requireActorRole(supabase: any, teamId: string, userId: string): Promise<TeamRole | null> {
	return getUserRoleForTeam(supabase, userId, teamId);
}

// GET /api/teams/[id]/members - List team members
export async function GET(
	_request: NextRequest,
	{ params }: { params: { id: string } }
) {
	try {
		const teamId = params.id;
		const supabase = await createClient();
		const {
			data: { user }
		} = await supabase.auth.getUser();

		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const actorRole = await requireActorRole(supabase, teamId, user.id);
		if (!actorRole) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		const { data: members, error } = await (supabase.from("team_members") as any)
			.select("id, user_id, role, created_at")
			.eq("team_id", teamId);

		if (error) throw new Error(error.message);

		const memberStats = await Promise.all(
			(members ?? []).map(async (member: { user_id: string }) => {
				const [leadsRes, dealsRes, activitiesRes] = await Promise.all([
					(supabase.from("leads") as any)
						.select("id", { count: "exact", head: true })
						.eq("assigned_to", member.user_id)
						.eq("team_id", teamId),
					(supabase.from("activities") as any)
						.select("id", { count: "exact", head: true })
						.eq("user_id", member.user_id)
						.eq("activity_type", "deal_closed")
						.eq("team_id", teamId),
					(supabase.from("activities") as any)
						.select("id", { count: "exact", head: true })
						.eq("user_id", member.user_id)
						.eq("team_id", teamId)
						.gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
				]);

				return {
					...member,
					stats: {
						leads: leadsRes.count || 0,
						deals: dealsRes.count || 0,
						weeklyActivities: activitiesRes.count || 0
					}
				};
			})
		);

		return NextResponse.json({ members: memberStats });
	} catch (error) {
		console.error("Error fetching team members:", error);
		return NextResponse.json({ error: "Failed to fetch team members" }, { status: 500 });
	}
}

// POST /api/teams/[id]/members - Add team member
export async function POST(
	request: NextRequest,
	{ params }: { params: { id: string } }
) {
	try {
		const teamId = params.id;
		const supabase = await createClient();
		const {
			data: { user }
		} = await supabase.auth.getUser();

		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const actorRole = await requireActorRole(supabase, teamId, user.id);
		if (!hasMinimumRole(actorRole, "admin")) {
			return NextResponse.json({ error: "Only owners/admins can add members" }, { status: 403 });
		}

		const body = await request.json();
		const { userId, role } = body;
		const targetUserId = typeof userId === "string" ? userId : null;
		const targetRole = normalizeRole(role);

		if (!targetUserId) {
			return NextResponse.json({ error: "User ID is required" }, { status: 400 });
		}

		if (targetRole === "owner" && actorRole !== "owner") {
			return NextResponse.json({ error: "Only an owner can add another owner" }, { status: 403 });
		}

		const { data: existing } = await (supabase.from("team_members") as any)
			.select("id")
			.eq("team_id", teamId)
			.eq("user_id", targetUserId)
			.maybeSingle();

		if (existing) {
			return NextResponse.json({ error: "User is already a team member" }, { status: 400 });
		}

		const { data: member, error } = await (supabase.from("team_members") as any)
			.insert({
				team_id: teamId,
				user_id: targetUserId,
				role: targetRole
			})
			.select()
			.single();

		if (error) throw new Error(error.message);

		return NextResponse.json({ member }, { status: 201 });
	} catch (error) {
		console.error("Error adding team member:", error);
		return NextResponse.json({ error: "Failed to add team member" }, { status: 500 });
	}
}

// DELETE /api/teams/[id]/members - Remove team member
export async function DELETE(
	request: NextRequest,
	{ params }: { params: { id: string } }
) {
	try {
		const teamId = params.id;
		const { searchParams } = new URL(request.url);
		const targetUserId = searchParams.get("userId");
		const supabase = await createClient();
		const {
			data: { user }
		} = await supabase.auth.getUser();

		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		if (!targetUserId) {
			return NextResponse.json({ error: "User ID is required" }, { status: 400 });
		}

		const actorRole = await requireActorRole(supabase, teamId, user.id);
		if (!hasMinimumRole(actorRole, "admin")) {
			return NextResponse.json({ error: "Only owners/admins can remove members" }, { status: 403 });
		}

		const { data: member } = await (supabase.from("team_members") as any)
			.select("role")
			.eq("team_id", teamId)
			.eq("user_id", targetUserId)
			.maybeSingle();

		if (member?.role === "owner") {
			return NextResponse.json({ error: "Cannot remove team owner" }, { status: 400 });
		}

		const { error } = await (supabase.from("team_members") as any)
			.delete()
			.eq("team_id", teamId)
			.eq("user_id", targetUserId);

		if (error) throw new Error(error.message);

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Error removing team member:", error);
		return NextResponse.json({ error: "Failed to remove team member" }, { status: 500 });
	}
}
