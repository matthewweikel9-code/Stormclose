/**
 * GET /api/audit
 * Fetch audit log (Phase 5 - owners/admins)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserRoleForTeam, resolveWriteTeamIdForUser, hasMinimumRole } from "@/lib/server/tenant";

export async function GET(request: NextRequest) {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const teamId = await resolveWriteTeamIdForUser(supabase, user.id, null);
	if (!teamId) return NextResponse.json({ error: "Create a team first" }, { status: 400 });

	const role = await getUserRoleForTeam(supabase, user.id, teamId);
	if (!hasMinimumRole(role, "admin")) {
		return NextResponse.json({ error: "Admin access required to view audit log" }, { status: 403 });
	}

	const { searchParams } = new URL(request.url);
	const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 200);

	const { data, error } = await (supabase as any)
		.from("audit_log")
		.select("id, action, resource_type, resource_id, metadata, created_at, user_id")
		.eq("team_id", teamId)
		.order("created_at", { ascending: false })
		.limit(limit);

	if (error) return NextResponse.json({ error: error.message }, { status: 500 });
	return NextResponse.json({ logs: data ?? [] });
}
