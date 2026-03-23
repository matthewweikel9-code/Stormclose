/**
 * GET/POST /api/webhooks/endpoints
 * Manage webhook endpoints for the team
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveWriteTeamIdForUser, getUserRoleForTeam, hasMinimumRole } from "@/lib/server/tenant";

export async function GET(request: NextRequest) {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const teamId = await resolveWriteTeamIdForUser(supabase, user.id, null);
	if (!teamId) return NextResponse.json({ error: "Create a team first" }, { status: 400 });

	const { data, error } = await (supabase as any)
		.from("webhook_endpoints")
		.select("id, url, events, is_active, created_at")
		.eq("team_id", teamId);

	if (error) return NextResponse.json({ error: error.message }, { status: 500 });
	return NextResponse.json({ endpoints: data ?? [] });
}

export async function POST(request: NextRequest) {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const teamId = await resolveWriteTeamIdForUser(supabase, user.id, null);
	if (!teamId) return NextResponse.json({ error: "Create a team first" }, { status: 400 });

	const role = await getUserRoleForTeam(supabase, user.id, teamId);
	if (!hasMinimumRole(role, "admin")) {
		return NextResponse.json({ error: "Admin required" }, { status: 403 });
	}

	const body = await request.json().catch(() => ({}));
	const { url, events, secret } = body;
	if (!url || !url.startsWith("https://")) {
		return NextResponse.json({ error: "Valid HTTPS url required" }, { status: 400 });
	}

	const { data, error } = await (supabase as any)
		.from("webhook_endpoints")
		.insert({
			team_id: teamId,
			url,
			events: Array.isArray(events) ? events : ["storm_threshold", "lead_rescored", "supplement_ready", "jn_export_success", "jn_export_failure"],
			secret: secret ?? null,
		})
		.select()
		.single();

	if (error) return NextResponse.json({ error: error.message }, { status: 500 });
	return NextResponse.json({ endpoint: data });
}
