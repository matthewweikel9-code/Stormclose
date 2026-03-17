import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserRoleForTeam, resolveTeamIdForUser } from "@/lib/server/tenant";

// Activity types
type ActivityType =
	| "door_knock"
	| "phone_call"
	| "email"
	| "text_message"
	| "appointment_set"
	| "appointment_completed"
	| "inspection"
	| "estimate_sent"
	| "contract_signed"
	| "job_completed"
	| "follow_up"
	| "note"
	| "status_change";

// GET: Fetch activities
export async function GET(request: NextRequest) {
	const supabase = await createClient();

	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const searchParams = request.nextUrl.searchParams;
	const leadId = searchParams.get("leadId");
	const activityType = searchParams.get("type");
	const teamId = searchParams.get("teamId");
	const limit = parseInt(searchParams.get("limit") || "20", 10);
	const offset = parseInt(searchParams.get("offset") || "0", 10);

	try {
		if (teamId) {
			const role = await getUserRoleForTeam(supabase, user.id, teamId);
			if (!role) {
				return NextResponse.json({ error: "Forbidden" }, { status: 403 });
			}
		}

		let query = (supabase
			.from("activities")
			.select(
				`
				*,
				leads (
					id,
					address,
					city,
					state
				)
			`,
				{ count: "exact" }
			) as any)
			.order("created_at", { ascending: false })
			.range(offset, offset + limit - 1);

		if (teamId) {
			query = query.eq("team_id", teamId);
		} else {
			query = query.eq("user_id", user.id);
		}

		if (leadId) {
			query = query.eq("lead_id", leadId);
		}

		if (activityType) {
			query = query.eq("activity_type", activityType);
		}

		const { data, error, count } = await query;

		if (error) {
			console.error("Error fetching activities:", error);
			return NextResponse.json({ error: "Failed to fetch activities" }, { status: 500 });
		}

		return NextResponse.json({
			success: true,
			activities: data || [],
			total: count || 0,
			pagination: { limit, offset },
		});
	} catch (error) {
		console.error("Activities fetch error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

// POST: Create a new activity
export async function POST(request: NextRequest) {
	const supabase = await createClient();

	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const body = await request.json();
		const {
			leadId,
			activityType,
			title,
			description,
			outcome,
			scheduledAt,
			completedAt,
			latitude,
			longitude,
			metadata,
			teamId,
		} = body;

		if (!activityType) {
			return NextResponse.json({ error: "Activity type is required" }, { status: 400 });
		}

		const resolvedTeamId = await resolveTeamIdForUser(
			supabase,
			user.id,
			typeof teamId === "string" ? teamId : null
		);

		if (teamId && !resolvedTeamId) {
			return NextResponse.json({ error: "Invalid or unauthorized team ID" }, { status: 403 });
		}

		let effectiveTeamId = resolvedTeamId;
		if (leadId) {
			const { data: lead } = await (supabase.from("leads") as any)
				.select("id, team_id")
				.eq("id", leadId)
				.maybeSingle();

			if (!lead) {
				return NextResponse.json({ error: "Lead not found" }, { status: 404 });
			}

			if (lead.team_id) {
				effectiveTeamId = lead.team_id;
			}
		}

		const activityData = {
			user_id: user.id,
			team_id: effectiveTeamId,
			lead_id: leadId || null,
			activity_type: activityType as ActivityType,
			title,
			description,
			outcome,
			scheduled_at: scheduledAt,
			completed_at: completedAt,
			latitude,
			longitude,
			metadata: metadata || {},
		};

		const { data, error } = await (supabase.from("activities") as any)
			.insert(activityData)
			.select()
			.single();

		if (error) {
			console.error("Error creating activity:", error);
			return NextResponse.json({ error: "Failed to create activity" }, { status: 500 });
		}

		// If this activity updates lead status, update the lead too
		if (leadId && activityType === "status_change" && metadata?.newStatus) {
			await (supabase.from("leads") as any)
				.update({
					status: metadata.newStatus,
					status_changed_at: new Date().toISOString(),
				})
				.eq("id", leadId);
		}

		return NextResponse.json({ success: true, activity: data });
	} catch (error) {
		console.error("Activity creation error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

// PATCH: Update an activity
export async function PATCH(request: NextRequest) {
	const supabase = await createClient();

	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const body = await request.json();
		const { id, ...updates } = body;

		if (!id) {
			return NextResponse.json({ error: "Activity ID is required" }, { status: 400 });
		}

		// Map camelCase to snake_case
		const updateData: Record<string, unknown> = {};
		const fieldMap: Record<string, string> = {
			title: "title",
			description: "description",
			outcome: "outcome",
			scheduledAt: "scheduled_at",
			completedAt: "completed_at",
		};

		for (const [key, value] of Object.entries(updates)) {
			const dbField = fieldMap[key] || key;
			updateData[dbField] = value;
		}

		const { data: existingActivity, error: existingActivityError } = await (supabase.from("activities") as any)
			.select("id")
			.eq("id", id)
			.maybeSingle();

		if (existingActivityError) {
			console.error("Error checking activity access:", existingActivityError);
			return NextResponse.json({ error: "Failed to validate activity access" }, { status: 500 });
		}

		if (!existingActivity) {
			return NextResponse.json({ error: "Activity not found" }, { status: 404 });
		}

		const { data, error } = await (supabase.from("activities") as any)
			.update(updateData)
			.eq("id", id)
			.select()
			.single();

		if (error) {
			console.error("Error updating activity:", error);
			return NextResponse.json({ error: "Failed to update activity" }, { status: 500 });
		}

		return NextResponse.json({ success: true, activity: data });
	} catch (error) {
		console.error("Activity update error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

// DELETE: Delete an activity
export async function DELETE(request: NextRequest) {
	const supabase = await createClient();

	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const searchParams = request.nextUrl.searchParams;
	const id = searchParams.get("id");

	if (!id) {
		return NextResponse.json({ error: "Activity ID is required" }, { status: 400 });
	}

	try {
		const { error } = await supabase.from("activities").delete().eq("id", id).eq("user_id", user.id);

		if (error) {
			console.error("Error deleting activity:", error);
			return NextResponse.json({ error: "Failed to delete activity" }, { status: 500 });
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Activity deletion error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
