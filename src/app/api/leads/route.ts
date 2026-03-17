import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calculateLeadScore } from "@/lib/lead-scoring";
import { getUserRoleForTeam, resolveWriteTeamIdForUser } from "@/lib/server/tenant";

// GET: Fetch leads for the current user
export async function GET(request: NextRequest) {
	const supabase = await createClient();

	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const searchParams = request.nextUrl.searchParams;
	const status = searchParams.get("status");
	const tier = searchParams.get("tier");
	const minScore = searchParams.get("minScore");
	const teamId = searchParams.get("teamId");
	const limit = parseInt(searchParams.get("limit") || "50", 10);
	const offset = parseInt(searchParams.get("offset") || "0", 10);
	const clampedLimit = Math.max(1, Math.min(limit, 200));

	try {
		if (teamId) {
			const role = await getUserRoleForTeam(supabase, user.id, teamId);
			if (!role) {
				return NextResponse.json({ error: "Forbidden" }, { status: 403 });
			}
		}

		// Use session-scoped client + RLS for tenant-safe reads.
		let query = (supabase.from("leads") as any)
			.select("*", { count: "exact" })
			.order("lead_score", { ascending: false })
			.order("created_at", { ascending: false })
			.range(offset, offset + clampedLimit - 1);

		if (status) {
			query = query.eq("status", status);
		}

		// Filter by lead score tier
		if (tier === "hot") {
			query = query.gte("lead_score", 70);
		} else if (tier === "warm") {
			query = query.gte("lead_score", 40).lt("lead_score", 70);
		} else if (tier === "cold") {
			query = query.lt("lead_score", 40);
		}

		if (minScore) {
			query = query.gte("lead_score", parseInt(minScore, 10));
		}

		if (teamId) {
			query = query.eq("team_id", teamId);
		}

		const { data, error, count } = await query;

		if (error) {
			console.error("Error fetching leads:", error);
			return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 });
		}

		return NextResponse.json({
			success: true,
			leads: data || [],
			total: count || 0,
			pagination: { limit: clampedLimit, offset },
		});
	} catch (error) {
		console.error("Leads fetch error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

// POST: Create a new lead
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
			address,
			city,
			state,
			zip,
			latitude,
			longitude,
			yearBuilt,
			squareFeet,
			assessedValue,
			roofSquares,
			estimatedClaim,
			source = "manual",
			teamId,
		} = body;

		if (!address || !latitude || !longitude) {
			return NextResponse.json(
				{ error: "Address, latitude, and longitude are required" },
				{ status: 400 }
			);
		}

		// Calculate lead score
		const scoreResult = await calculateLeadScore({
			latitude,
			longitude,
			yearBuilt,
			roofSquares,
			assessedValue,
			squareFeet,
		});

		let resolvedTeamId: string | null = null;
		try {
			resolvedTeamId = await resolveWriteTeamIdForUser(
				supabase,
				user.id,
				typeof teamId === "string" ? teamId : null
			);
		} catch (teamError) {
			return NextResponse.json(
				{
					error:
						teamError instanceof Error
							? teamError.message
							: "teamId is required for users with multiple teams",
				},
				{ status: 400 }
			);
		}

		if (teamId && !resolvedTeamId) {
			return NextResponse.json({ error: "Invalid or unauthorized team ID" }, { status: 403 });
		}

		const leadData = {
			user_id: user.id,
			team_id: resolvedTeamId,
			address,
			city,
			state,
			zip,
			latitude,
			longitude,
			year_built: yearBuilt,
			square_feet: squareFeet,
			assessed_value: assessedValue,
			roof_squares: roofSquares,
			estimated_claim: estimatedClaim,
			source,
			lead_score: scoreResult.totalScore,
			storm_proximity_score: scoreResult.stormProximityScore,
			roof_age_score: scoreResult.roofAgeScore,
			roof_size_score: scoreResult.roofSizeScore,
			property_value_score: scoreResult.propertyValueScore,
			hail_history_score: scoreResult.hailHistoryScore,
			status: "new",
		};

		const { data, error } = await (supabase.from("leads") as any).insert(leadData).select().single();

		if (error) {
			console.error("Error creating lead:", error);
			return NextResponse.json({ error: "Failed to create lead" }, { status: 500 });
		}

		return NextResponse.json({
			success: true,
			lead: data,
			score: scoreResult,
		});
	} catch (error) {
		console.error("Lead creation error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

// PATCH: Update a lead
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
			return NextResponse.json({ error: "Lead ID is required" }, { status: 400 });
		}

		// Map camelCase to snake_case
		const updateData: Record<string, unknown> = {};
		const fieldMap: Record<string, string> = {
			status: "status",
			assignedTo: "assigned_to",
			notes: "notes",
			estimatedClaim: "estimated_claim",
			actualClaim: "actual_claim",
			roofSquares: "roof_squares",
		};

		for (const [key, value] of Object.entries(updates)) {
			const dbField = fieldMap[key] || key;
			updateData[dbField] = value;
		}

		// If status changed, update status_changed_at
		if (updateData.status) {
			updateData.status_changed_at = new Date().toISOString();
		}

		const { data: existingLead, error: existingLeadError } = await (supabase.from("leads") as any)
			.select("id")
			.eq("id", id)
			.maybeSingle();

		if (existingLeadError) {
			console.error("Error checking lead access:", existingLeadError);
			return NextResponse.json({ error: "Failed to validate lead access" }, { status: 500 });
		}

		if (!existingLead) {
			return NextResponse.json({ error: "Lead not found" }, { status: 404 });
		}

		const { data, error } = await (supabase.from("leads") as any)
			.update(updateData)
			.eq("id", id)
			.select()
			.single();

		if (error) {
			console.error("Error updating lead:", error);
			return NextResponse.json({ error: "Failed to update lead" }, { status: 500 });
		}

		return NextResponse.json({ success: true, lead: data });
	} catch (error) {
		console.error("Lead update error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

// DELETE: Delete a lead
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
		return NextResponse.json({ error: "Lead ID is required" }, { status: 400 });
	}

	try {
		const { error } = await (supabase.from("leads") as any).delete().eq("id", id);

		if (error) {
			console.error("Error deleting lead:", error);
			return NextResponse.json({ error: "Failed to delete lead" }, { status: 500 });
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Lead deletion error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
