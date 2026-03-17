import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserRoleForTeam, getUserTeamMemberships, hasMinimumRole } from "@/lib/server/tenant";

type TeamMemberRow = {
	id: string;
	team_id: string;
	user_id: string;
	role: "owner" | "admin" | "manager" | "member";
	created_at: string;
	joined_at?: string | null;
};

function toLegacyRole(role: TeamMemberRow["role"]): "admin" | "manager" | "sales_rep" {
	if (role === "owner" || role === "admin") return "admin";
	if (role === "manager") return "manager";
	return "sales_rep";
}

async function resolvePrimaryTeamId(supabase: any, userId: string): Promise<string | null> {
	const memberships = await getUserTeamMemberships(supabase, userId);
	if (memberships.length > 0) {
		return memberships[0].team_id;
	}

	const { data: ownedTeam } = await (supabase.from("teams") as any)
		.select("id")
		.eq("owner_id", userId)
		.order("created_at", { ascending: true })
		.limit(1)
		.maybeSingle();

	return ownedTeam?.id ?? null;
}

// GET: Fetch team members
export async function GET() {
	try {
		const supabase = await createClient();
		const { data: { user } } = await supabase.auth.getUser();

		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const primaryTeamId = await resolvePrimaryTeamId(supabase, user.id);
		if (!primaryTeamId) {
			return NextResponse.json({ members: [] });
		}

		const actorRole = await getUserRoleForTeam(supabase, user.id, primaryTeamId);
		if (!actorRole) {
			return NextResponse.json({ members: [] });
		}

		const { data: teamMembers, error } = await (supabase.from("team_members") as any)
			.select("id, team_id, user_id, role, created_at, joined_at")
			.eq("team_id", primaryTeamId)
			.order("created_at", { ascending: true });

		if (error) {
			console.error("Error fetching team members:", error);
			return NextResponse.json({ members: [] });
		}

		const userIds = (teamMembers ?? []).map((member: TeamMemberRow) => member.user_id);
		const { data: users } = await (supabase.from("users") as any)
			.select("id, email")
			.in("id", userIds);

		const userEmailById = new Map<string, string>();
		for (const row of users ?? []) {
			if (row.id && row.email) {
				userEmailById.set(row.id, row.email);
			}
		}

		const members = (teamMembers ?? []).map((member: TeamMemberRow) => {
			const email = userEmailById.get(member.user_id) ?? "";
			const fullName = email ? email.split("@")[0] : "";
			return {
				id: member.id,
				email,
				full_name: fullName,
				role: toLegacyRole(member.role),
				status: "active",
				joined_at: member.joined_at || member.created_at,
				last_active: null,
			};
		});

		return NextResponse.json({ members });
	} catch (error) {
		console.error("Error fetching team:", error);
		return NextResponse.json({ members: [] });
	}
}

// POST: Invite a team member
export async function POST(request: NextRequest) {
	try {
		const supabase = await createClient();
		const { data: { user } } = await supabase.auth.getUser();

		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { email, role } = await request.json();

		if (!email) {
			return NextResponse.json({ error: "Email is required" }, { status: 400 });
		}

		const primaryTeamId = await resolvePrimaryTeamId(supabase, user.id);
		if (!primaryTeamId) {
			return NextResponse.json({ error: "Create a team before inviting members" }, { status: 400 });
		}

		const actorRole = await getUserRoleForTeam(supabase, user.id, primaryTeamId);
		if (!hasMinimumRole(actorRole, "admin")) {
			return NextResponse.json({ error: "Only owners/admins can invite members" }, { status: 403 });
		}

		const { data: targetUser } = await (supabase.from("users") as any)
			.select("id")
			.eq("email", email.trim().toLowerCase())
			.maybeSingle();

		if (!targetUser?.id) {
			return NextResponse.json(
				{ error: "User not found. Ask them to create an account first." },
				{ status: 404 }
			);
		}

		const normalizedRole = role === "manager" ? "manager" : "member";
		const { error } = await (supabase.from("team_members") as any).upsert(
			{
				team_id: primaryTeamId,
				user_id: targetUser.id,
				role: normalizedRole,
				joined_at: new Date().toISOString(),
			},
			{ onConflict: "team_id,user_id" }
		);

		if (error) {
			console.error("Error inviting member:", error);
			return NextResponse.json({ error: "Failed to invite team member" }, { status: 500 });
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Error inviting team member:", error);
		return NextResponse.json({ error: "Failed to invite team member" }, { status: 500 });
	}
}

// DELETE: Remove a team member
export async function DELETE(request: NextRequest) {
	try {
		const supabase = await createClient();
		const { data: { user } } = await supabase.auth.getUser();

		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const memberId = request.nextUrl.searchParams.get("id");
		if (!memberId) {
			return NextResponse.json({ error: "Member ID is required" }, { status: 400 });
		}

		const primaryTeamId = await resolvePrimaryTeamId(supabase, user.id);
		if (!primaryTeamId) {
			return NextResponse.json({ error: "No team found" }, { status: 404 });
		}

		const actorRole = await getUserRoleForTeam(supabase, user.id, primaryTeamId);
		if (!hasMinimumRole(actorRole, "admin")) {
			return NextResponse.json({ error: "Only owners/admins can remove members" }, { status: 403 });
		}

		const { data: targetMember } = await (supabase.from("team_members") as any)
			.select("role")
			.eq("id", memberId)
			.eq("team_id", primaryTeamId)
			.maybeSingle();

		if (!targetMember) {
			return NextResponse.json({ error: "Member not found" }, { status: 404 });
		}

		if (targetMember.role === "owner") {
			return NextResponse.json({ error: "Cannot remove team owner" }, { status: 400 });
		}

		const { error } = await (supabase.from("team_members") as any)
			.delete()
			.eq("id", memberId)
			.eq("team_id", primaryTeamId);

		if (error) {
			console.error("Error removing member:", error);
			return NextResponse.json({ error: "Failed to remove team member" }, { status: 500 });
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Error removing team member:", error);
		return NextResponse.json({ error: "Failed to remove team member" }, { status: 500 });
	}
}
