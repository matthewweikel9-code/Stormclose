import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const supabaseAdmin = createAdminClient(
	process.env.NEXT_PUBLIC_SUPABASE_URL!,
	process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET: Fetch user's territories
export async function GET(request: NextRequest) {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();

	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const { data: territories, error } = await supabaseAdmin
			.from("territories")
			.select(`
				id,
				name,
				type,
				zip_codes,
				center_lat,
				center_lng,
				radius_miles,
				is_active,
				alert_enabled,
				email_alerts,
				push_alerts,
				sms_alerts,
				total_leads,
				active_storms,
				last_storm_at,
				created_at,
				updated_at
			`)
			.eq("user_id", user.id)
			.order("created_at", { ascending: false });

		if (error) {
			console.error("Error fetching territories:", error);
			return NextResponse.json({ error: "Failed to fetch territories" }, { status: 500 });
		}

		return NextResponse.json({
			success: true,
			territories: territories || [],
		});
	} catch (error) {
		console.error("Territories fetch error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

// POST: Create a new territory
export async function POST(request: NextRequest) {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();

	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const body = await request.json();
		const {
			name,
			type = "zip_codes",
			zip_codes,
			center_lat,
			center_lng,
			radius_miles,
			alert_enabled = true,
			email_alerts = true,
			push_alerts = true,
		} = body;

		if (!name) {
			return NextResponse.json({ error: "Name is required" }, { status: 400 });
		}

		if (type === "zip_codes" && (!zip_codes || zip_codes.length === 0)) {
			return NextResponse.json({ error: "At least one zip code is required" }, { status: 400 });
		}

		if (type === "radius" && (!center_lat || !center_lng || !radius_miles)) {
			return NextResponse.json(
				{ error: "Center coordinates and radius are required for radius type" },
				{ status: 400 }
			);
		}

		const territoryData = {
			user_id: user.id,
			name,
			type,
			zip_codes: type === "zip_codes" ? zip_codes : null,
			center_lat: type === "radius" ? center_lat : null,
			center_lng: type === "radius" ? center_lng : null,
			radius_miles: type === "radius" ? radius_miles : null,
			is_active: true,
			alert_enabled,
			email_alerts,
			push_alerts,
		};

		const { data: territory, error } = await supabaseAdmin
			.from("territories")
			.insert(territoryData)
			.select()
			.single();

		if (error) {
			console.error("Error creating territory:", error);
			return NextResponse.json({ error: "Failed to create territory" }, { status: 500 });
		}

		// Note: Lead generation happens via the /api/cron/generate-leads endpoint
		// which uses CoreLogic to get real property data. We don't auto-generate
		// placeholder leads here to avoid polluting the database with fake addresses.

		return NextResponse.json({
			success: true,
			territory,
			message: "Territory created! Leads will be auto-generated when storms hit this area.",
		});
	} catch (error) {
		console.error("Territory creation error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

// PUT: Update a territory
export async function PUT(request: NextRequest) {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();

	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const body = await request.json();
		const { id, ...updates } = body;

		if (!id) {
			return NextResponse.json({ error: "Territory ID is required" }, { status: 400 });
		}

		// Verify ownership
		const { data: existing } = await supabaseAdmin
			.from("territories")
			.select("user_id")
			.eq("id", id)
			.single();

		if (!existing || existing.user_id !== user.id) {
			return NextResponse.json({ error: "Territory not found" }, { status: 404 });
		}

		const { data: territory, error } = await supabaseAdmin
			.from("territories")
			.update({
				...updates,
				updated_at: new Date().toISOString(),
			})
			.eq("id", id)
			.select()
			.single();

		if (error) {
			console.error("Error updating territory:", error);
			return NextResponse.json({ error: "Failed to update territory" }, { status: 500 });
		}

		return NextResponse.json({
			success: true,
			territory,
		});
	} catch (error) {
		console.error("Territory update error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

// DELETE: Delete a territory
export async function DELETE(request: NextRequest) {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();

	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const searchParams = request.nextUrl.searchParams;
	const id = searchParams.get("id");

	if (!id) {
		return NextResponse.json({ error: "Territory ID is required" }, { status: 400 });
	}

	try {
		// Verify ownership
		const { data: existing } = await supabaseAdmin
			.from("territories")
			.select("user_id")
			.eq("id", id)
			.single();

		if (!existing || existing.user_id !== user.id) {
			return NextResponse.json({ error: "Territory not found" }, { status: 404 });
		}

		const { error } = await supabaseAdmin
			.from("territories")
			.delete()
			.eq("id", id);

		if (error) {
			console.error("Error deleting territory:", error);
			return NextResponse.json({ error: "Failed to delete territory" }, { status: 500 });
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Territory delete error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
