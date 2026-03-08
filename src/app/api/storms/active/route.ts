// GET /api/storms/active - Fetch active storms
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { 
	fetchTodaysStorms, 
	fetchActiveAlerts, 
	noaaReportToStormEvent 
} from "@/lib/storms/weather-client";

export async function GET(request: NextRequest) {
	try {
		const supabase = await createClient() as any;
		
		// Check auth
		const { data: { user }, error: authError } = await supabase.auth.getUser();
		if (authError || !user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		
		const { searchParams } = new URL(request.url);
		const state = searchParams.get("state");
		const refresh = searchParams.get("refresh") === "true";
		
		// Get cached storms from database (last 7 days)
		const sevenDaysAgo = new Date();
		sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
		
		const { data: cachedStormsData, error: dbError } = await supabase
			.from("storm_events")
			.select("*")
			.gte("event_date", sevenDaysAgo.toISOString().split("T")[0])
			.order("event_date", { ascending: false });
		
		if (dbError) {
			console.error("Error fetching cached storms:", dbError);
		}
		
		// Filter by state if provided
		let cachedStorms = cachedStormsData || [];
		if (state) {
			cachedStorms = cachedStorms.filter((s: { state: string }) => s.state === state);
		}
		
		// If refresh requested or no cached data, fetch from NOAA
		let freshStorms: any[] = [];
		if (refresh || cachedStorms.length === 0) {
			const noaaReports = await fetchTodaysStorms();
			
			// Convert to storm events and upsert to database
			for (const report of noaaReports) {
				const eventType = (report as any).type || "hail";
				const stormEvent = noaaReportToStormEvent(report, eventType);
				
				const { data: upserted, error: upsertError } = await supabase
					.from("storm_events")
					.upsert(
						{
							external_id: stormEvent.externalId,
							event_type: stormEvent.eventType,
							severity: stormEvent.severity,
							hail_size_inches: stormEvent.hailSizeInches,
							wind_speed_mph: stormEvent.windSpeedMph,
							city: stormEvent.city,
							state: stormEvent.state,
							county: stormEvent.county,
							latitude: stormEvent.latitude,
							longitude: stormEvent.longitude,
							radius_miles: stormEvent.radiusMiles,
							event_date: stormEvent.eventDate,
							event_time: stormEvent.eventTime,
							source: stormEvent.source,
							raw_data: stormEvent.rawData
						},
						{ onConflict: "external_id" }
					)
					.select()
					.single();
				
				if (upserted) {
					freshStorms.push(upserted);
				}
			}
		}
		
		// Fetch active weather alerts
		const alerts = await fetchActiveAlerts(state || undefined);
		
		// Combine cached and fresh storms
		const allStorms = freshStorms.length > 0 ? freshStorms : (cachedStorms || []);
		
		// Transform to camelCase for frontend
		const storms = allStorms.map((s: any) => ({
			id: s.id,
			externalId: s.external_id,
			eventType: s.event_type,
			severity: s.severity,
			hailSizeInches: s.hail_size_inches,
			windSpeedMph: s.wind_speed_mph,
			city: s.city,
			state: s.state,
			county: s.county,
			latitude: parseFloat(s.latitude),
			longitude: parseFloat(s.longitude),
			radiusMiles: parseFloat(s.radius_miles),
			eventDate: s.event_date,
			eventTime: s.event_time,
			source: s.source,
			createdAt: s.created_at
		}));
		
		return NextResponse.json({
			storms,
			alerts,
			lastUpdated: new Date().toISOString()
		});
		
	} catch (error) {
		console.error("Error in /api/storms/active:", error);
		return NextResponse.json(
			{ error: "Failed to fetch storms" },
			{ status: 500 }
		);
	}
}
