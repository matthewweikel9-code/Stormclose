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

		// Auto-generate leads for the new territory
		let leadsGenerated = 0;
		try {
			// Find recent hail events
			const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
				.toISOString()
				.split("T")[0];

			const { data: hailEvents } = await supabaseAdmin
				.from("hail_events")
				.select("*")
				.gte("event_date", thirtyDaysAgo)
				.gte("size_inches", 0.75)
				.order("event_date", { ascending: false })
				.limit(50);

			if (hailEvents && hailEvents.length > 0 && zip_codes) {
				const processedZips = new Set<string>();
				
				for (const zipCode of zip_codes.slice(0, 5)) {
					if (processedZips.has(zipCode)) continue;
					processedZips.add(zipCode);

					const nearestHail = hailEvents[0];
					const daysSinceStorm = Math.floor(
						(Date.now() - new Date(nearestHail.event_date).getTime()) /
							(1000 * 60 * 60 * 24)
					);

					const baseScore = Math.max(
						50,
						85 - daysSinceStorm * 2 + nearestHail.size_inches * 5
					);

					const leadData = {
						user_id: user.id,
						address: `Storm-affected property in ${zipCode}`,
						city: nearestHail.location_name || name,
						state: nearestHail.state || "TX",
						zip: zipCode,
						latitude: nearestHail.latitude || 0,
						longitude: nearestHail.longitude || 0,
						lead_score: Math.min(Math.round(baseScore), 100),
						storm_proximity_score: Math.min(35, nearestHail.size_inches * 10),
						roof_age_score: 15,
						property_value_score: 10,
						hail_history_score: 10,
						status: "new",
						source: "ai_auto_generated",
						hail_event_id: nearestHail.id,
						storm_date: nearestHail.event_date,
						hail_size: nearestHail.size_inches,
						notes: `Auto-generated for new territory "${name}". ${nearestHail.size_inches}" hail on ${nearestHail.event_date}.`,
					};

					const { error: insertError } = await supabaseAdmin
						.from("leads")
						.insert(leadData);

					if (!insertError) {
						leadsGenerated++;
					}
				}

				// Update territory with lead count
				if (leadsGenerated > 0) {
					await supabaseAdmin
						.from("territories")
						.update({ total_leads: leadsGenerated })
						.eq("id", territory.id);
				}
			}
		} catch (leadError) {
			console.error("Error auto-generating leads:", leadError);
			// Don't fail territory creation if lead generation fails
		}

		return NextResponse.json({
			success: true,
			territory,
			leadsGenerated,
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
