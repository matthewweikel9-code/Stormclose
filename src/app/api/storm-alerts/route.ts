import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const supabaseAdmin = createAdminClient(
	process.env.NEXT_PUBLIC_SUPABASE_URL!,
	process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET: Fetch active storm alerts
export async function GET(request: NextRequest) {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();

	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const searchParams = request.nextUrl.searchParams;
	const status = searchParams.get("status") || "active";
	const limit = parseInt(searchParams.get("limit") || "20", 10);
	const includeExpired = searchParams.get("includeExpired") === "true";

	try {
		let query = supabaseAdmin
			.from("storm_alerts")
			.select(`
				id,
				nws_event_id,
				alert_type,
				severity,
				headline,
				description,
				affected_areas,
				affected_zips,
				onset_at,
				expires_at,
				issued_at,
				hail_size_inches,
				wind_speed_mph,
				status,
				leads_generated,
				properties_affected,
				created_at
			`)
			.order("issued_at", { ascending: false })
			.limit(limit);

		if (!includeExpired) {
			query = query.eq("status", "active");
		}

		const { data: alerts, error } = await query;

		if (error) {
			console.error("Error fetching alerts:", error);
			return NextResponse.json({ error: "Failed to fetch alerts" }, { status: 500 });
		}

		// Get user's territories to check which alerts affect them
		const { data: territories } = await supabaseAdmin
			.from("territories")
			.select("id, name, zip_codes, type")
			.eq("user_id", user.id)
			.eq("is_active", true);

		// Mark alerts that affect user's territories
		const enrichedAlerts = alerts?.map((alert) => {
			let affectsUser = false;
			let matchingTerritories: string[] = [];

			if (territories && alert.affected_zips) {
				for (const territory of territories) {
					if (territory.type === "zip_codes" && territory.zip_codes) {
						const overlap = territory.zip_codes.some((zip: string) =>
							alert.affected_zips?.includes(zip)
						);
						if (overlap) {
							affectsUser = true;
							matchingTerritories.push(territory.name);
						}
					}
				}
			}

			return {
				...alert,
				affects_user: affectsUser,
				matching_territories: matchingTerritories,
			};
		});

		return NextResponse.json({
			success: true,
			alerts: enrichedAlerts || [],
			userTerritories: territories?.length || 0,
		});
	} catch (error) {
		console.error("Storm alerts error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}
