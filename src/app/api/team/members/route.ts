import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserRoleForTeam, getUserTeamMemberships, hasMinimumRole, resolvePrimaryTeamId } from "@/lib/server/tenant";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "StormClose <noreply@stormclose.com>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://stormclose.com";

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
			return NextResponse.json({ members: [], hasTeam: false });
		}

		const actorRole = await getUserRoleForTeam(supabase, user.id, primaryTeamId);
		if (!actorRole) {
			return NextResponse.json({ members: [], hasTeam: true });
		}

		const { data: teamMembers, error } = await (supabase.from("team_members") as any)
			.select("id, team_id, user_id, role, created_at, joined_at")
			.eq("team_id", primaryTeamId)
			.order("created_at", { ascending: true });

		if (error) {
			console.error("Error fetching team members:", error);
			return NextResponse.json({ members: [], hasTeam: true });
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

		return NextResponse.json({ members, hasTeam: true });
	} catch (error) {
		console.error("Error fetching team:", error);
		return NextResponse.json({ members: [], hasTeam: false });
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
			return NextResponse.json({ error: "Create a company before inviting employees" }, { status: 400 });
		}

		const actorRole = await getUserRoleForTeam(supabase, user.id, primaryTeamId);
		if (!hasMinimumRole(actorRole, "admin")) {
			return NextResponse.json({ error: "Only owners/admins can invite members" }, { status: 403 });
		}

		// Use admin client to bypass RLS when looking up user by email
		const admin = createAdminClient();
		let targetUserId: string | null = null;

		const { data: profileUser } = await (admin.from("users") as any)
			.select("id")
			.eq("email", email.trim().toLowerCase())
			.maybeSingle();
		if (profileUser?.id) {
			targetUserId = profileUser.id;
		}

		// Fallback: look up in auth.users if not in public.users (e.g. new signups)
		if (!targetUserId) {
			const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 });
			const authUser = users?.find((u) => u.email?.toLowerCase() === email.trim().toLowerCase());
			if (authUser?.id) targetUserId = authUser.id;
		}

		if (!targetUserId) {
			return NextResponse.json(
				{ error: "No account found for this email. They need to sign up first, then you can invite them again." },
				{ status: 404 }
			);
		}

		const normalizedRole = role === "manager" ? "manager" : "member";
		const { error } = await (supabase.from("team_members") as any).upsert(
			{
				team_id: primaryTeamId,
				user_id: targetUserId,
				role: normalizedRole,
				joined_at: new Date().toISOString(),
			},
			{ onConflict: "team_id,user_id" }
		);

		if (error) {
			console.error("Error inviting member:", error);
			const message = process.env.NODE_ENV === "development" ? (error as Error).message : "Failed to invite employee";
			return NextResponse.json({ error: message }, { status: 500 });
		}

		// Send invite email
		if (RESEND_API_KEY) {
			const { data: team } = await (admin.from("teams") as any)
				.select("name")
				.eq("id", primaryTeamId)
				.maybeSingle();
			const inviterName = user.user_metadata?.full_name || user.email?.split("@")[0] || "A team admin";
			const teamName = team?.name || "StormClose";
			const roleLabel = normalizedRole === "manager" ? "Manager" : "Employee";

			const resend = new Resend(RESEND_API_KEY);
			const { error: emailError } = await resend.emails.send({
				from: FROM_EMAIL,
				to: email.trim().toLowerCase(),
				subject: `You've been invited to ${teamName} on StormClose`,
				html: `
					<h2>Company Invitation</h2>
					<p><strong>${inviterName}</strong> has invited you to join <strong>${teamName}</strong> as a ${roleLabel} on StormClose.</p>
					<p>You'll have access to the same features your company pays for. Log in to get started:</p>
					<p><a href="${APP_URL}/dashboard/team" style="display:inline-block;background:#7c3aed;color:white;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:600;">Go to Company Dashboard</a></p>
					<p style="color:#64748b;font-size:14px;">If you don't have an account yet, <a href="${APP_URL}/signup">sign up here</a> first, then click the link above.</p>
					<p style="color:#64748b;font-size:12px;margin-top:24px;">— StormClose</p>
				`,
			});
			if (emailError) {
				console.error("[Team Invite] Resend error:", emailError);
			}
		} else {
			console.warn("[Team Invite] RESEND_API_KEY not configured - no email sent");
		}

		return NextResponse.json({ success: true });
	} catch (err) {
		console.error("Error inviting team member:", err);
		const message = process.env.NODE_ENV === "development" && err instanceof Error ? err.message : "Failed to invite team member";
		return NextResponse.json({ error: message }, { status: 500 });
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
