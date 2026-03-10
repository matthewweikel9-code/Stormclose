import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

// NWS API endpoints
const NWS_ALERTS_API = "https://api.weather.gov/alerts/active";

const supabaseAdmin = createAdminClient(
	process.env.NEXT_PUBLIC_SUPABASE_URL!,
	process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface NWSAlert {
	id: string;
	type: string;
	properties: {
		id: string;
		event: string;
		severity: string;
		headline: string;
		description: string;
		areaDesc: string;
		geocode: {
			SAME?: string[];
			UGC?: string[];
		};
		onset: string;
		expires: string;
		effective: string;
		parameters?: {
			maxHailSize?: string[];
			maxWindGust?: string[];
		};
	};
	geometry?: {
		type: string;
		coordinates: number[][][];
	};
}

interface NWSResponse {
	type: string;
	features: NWSAlert[];
}

// Map NWS event types to our alert types
function mapAlertType(event: string): string | null {
	const eventLower = event.toLowerCase();
	
	if (eventLower.includes("tornado warning")) return "tornado_warning";
	if (eventLower.includes("tornado watch")) return "tornado_watch";
	if (eventLower.includes("severe thunderstorm warning")) return "severe_thunderstorm_warning";
	if (eventLower.includes("severe thunderstorm watch")) return "severe_thunderstorm_watch";
	if (eventLower.includes("flash flood warning")) return "flash_flood_warning";
	if (eventLower.includes("winter storm warning")) return "winter_storm_warning";
	
	// Skip alerts we don't care about
	return null;
}

function mapSeverity(severity: string): string {
	switch (severity.toLowerCase()) {
		case "extreme": return "extreme";
		case "severe": return "severe";
		case "moderate": return "moderate";
		case "minor": return "minor";
		default: return "unknown";
	}
}

// Extract zip codes from SAME codes (county-level FIPS)
function extractZipsFromSAME(sameCodes: string[]): string[] {
	// SAME codes are county FIPS codes, we'll need to map these
	// For now, return empty - we'll rely on polygon matching
	return [];
}

// Convert GeoJSON polygon to PostGIS format
function geometryToWKT(geometry: NWSAlert["geometry"]): string | null {
	if (!geometry || geometry.type !== "Polygon" || !geometry.coordinates) {
		return null;
	}
	
	const ring = geometry.coordinates[0];
	if (!ring || ring.length < 4) return null;
	
	const points = ring.map((coord) => `${coord[0]} ${coord[1]}`).join(", ");
	return `SRID=4326;POLYGON((${points}))`;
}

// Parse hail size from parameters (e.g., "1.75" from "1.75 inches")
function parseHailSize(params?: { maxHailSize?: string[] }): number | null {
	if (!params?.maxHailSize?.[0]) return null;
	const match = params.maxHailSize[0].match(/[\d.]+/);
	return match ? parseFloat(match[0]) : null;
}

// Parse wind speed from parameters
function parseWindSpeed(params?: { maxWindGust?: string[] }): number | null {
	if (!params?.maxWindGust?.[0]) return null;
	const match = params.maxWindGust[0].match(/[\d]+/);
	return match ? parseInt(match[0]) : null;
}

export async function GET(request: NextRequest) {
	// This endpoint can be called manually or by cron
	const authHeader = request.headers.get("authorization");
	const cronSecret = process.env.CRON_SECRET;
	
	// Allow access from cron or authenticated requests
	if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
		// Check if it's an internal request
		const url = new URL(request.url);
		if (!url.searchParams.get("internal")) {
			// For testing, allow without auth
			console.log("Storm monitor accessed without cron auth");
		}
	}

	try {
		console.log("🌩️ Fetching active NWS alerts...");
		
		// Fetch active alerts from NWS
		// Focus on severe weather that causes property damage
		const alertTypes = [
			"Tornado Warning",
			"Tornado Watch", 
			"Severe Thunderstorm Warning",
			"Severe Thunderstorm Watch",
		].join(",");
		
		const response = await fetch(
			`${NWS_ALERTS_API}?event=${encodeURIComponent(alertTypes)}`,
			{
				headers: {
					"User-Agent": "(StormClose, contact@stormclose.com)",
					"Accept": "application/geo+json",
				},
				next: { revalidate: 0 }, // Don't cache
			}
		);

		if (!response.ok) {
			console.error("NWS API error:", response.status, response.statusText);
			return NextResponse.json(
				{ error: "Failed to fetch NWS alerts" },
				{ status: 502 }
			);
		}

		const data: NWSResponse = await response.json();
		console.log(`📡 Received ${data.features?.length || 0} active alerts`);

		const newAlerts: any[] = [];
		const updatedAlerts: any[] = [];
		const usersToNotify: Map<string, Set<string>> = new Map(); // user_id -> Set of alert_ids

		for (const feature of data.features || []) {
			const props = feature.properties;
			const alertType = mapAlertType(props.event);
			
			if (!alertType) {
				continue; // Skip irrelevant alert types
			}

			const nwsEventId = props.id;
			const polygon = geometryToWKT(feature.geometry);
			const hailSize = parseHailSize(props.parameters);
			const windSpeed = parseWindSpeed(props.parameters);
			const affectedAreas = props.areaDesc?.split(";").map((s) => s.trim()) || [];

			// Check if alert already exists
			const { data: existing } = await supabaseAdmin
				.from("storm_alerts")
				.select("id, status")
				.eq("nws_event_id", nwsEventId)
				.single();

			if (existing) {
				// Update existing alert if needed
				const { error: updateError } = await supabaseAdmin
					.from("storm_alerts")
					.update({
						status: "active",
						expires_at: props.expires,
						updated_at: new Date().toISOString(),
					})
					.eq("id", existing.id);
				
				if (!updateError) {
					updatedAlerts.push(existing.id);
				}
				continue;
			}

			// Insert new alert
			const alertData = {
				nws_event_id: nwsEventId,
				alert_type: alertType,
				severity: mapSeverity(props.severity),
				headline: props.headline,
				description: props.description?.substring(0, 2000), // Truncate if too long
				affected_areas: affectedAreas,
				affected_zips: [], // Will be populated by territory matching
				onset_at: props.onset,
				expires_at: props.expires,
				issued_at: props.effective,
				hail_size_inches: hailSize,
				wind_speed_mph: windSpeed,
				status: "active",
			};

			// If we have polygon, add it (requires raw SQL for geometry)
			const { data: inserted, error: insertError } = await supabaseAdmin
				.from("storm_alerts")
				.insert(alertData)
				.select("id")
				.single();

			if (insertError) {
				console.error("Error inserting alert:", insertError);
				continue;
			}

			newAlerts.push({ id: inserted.id, ...alertData });
			console.log(`⚡ New alert: ${alertType} - ${props.headline}`);

			// If we have a polygon, update it with raw SQL
			if (polygon && inserted.id) {
				try {
					await supabaseAdmin.rpc("exec_sql", {
						sql: `UPDATE storm_alerts SET polygon = ST_GeomFromText('${polygon}') WHERE id = '${inserted.id}'`
					});
				} catch (e) {
					// If exec_sql doesn't exist, skip polygon update
					console.log("Could not set polygon (exec_sql not available)");
				}
			}

			// Find users with matching territories
			// For now, we'll do a simple notification approach
			// In production, use the get_users_for_storm_alert function
		}

		// Expire old alerts
		const { data: expiredAlerts, error: expireError } = await supabaseAdmin
			.from("storm_alerts")
			.update({ status: "expired" })
			.lt("expires_at", new Date().toISOString())
			.eq("status", "active")
			.select("id");

		if (expiredAlerts?.length) {
			console.log(`🌤️ Expired ${expiredAlerts.length} old alerts`);
		}

		// Return summary
		return NextResponse.json({
			success: true,
			timestamp: new Date().toISOString(),
			summary: {
				totalFetched: data.features?.length || 0,
				newAlerts: newAlerts.length,
				updatedAlerts: updatedAlerts.length,
				expiredAlerts: expiredAlerts?.length || 0,
			},
			newAlerts: newAlerts.map((a) => ({
				id: a.id,
				type: a.alert_type,
				headline: a.headline,
				severity: a.severity,
				hailSize: a.hail_size_inches,
				windSpeed: a.wind_speed_mph,
			})),
		});
	} catch (error) {
		console.error("Storm monitor error:", error);
		return NextResponse.json(
			{ error: "Failed to process storm alerts", details: String(error) },
			{ status: 500 }
		);
	}
}

// POST: Manually trigger alert processing for a specific area
export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { lat, lng, radius_miles = 50 } = body;

		if (!lat || !lng) {
			return NextResponse.json(
				{ error: "lat and lng are required" },
				{ status: 400 }
			);
		}

		// Fetch alerts for specific point
		const response = await fetch(
			`https://api.weather.gov/alerts/active?point=${lat},${lng}`,
			{
				headers: {
					"User-Agent": "(StormClose, contact@stormclose.com)",
					"Accept": "application/geo+json",
				},
			}
		);

		if (!response.ok) {
			return NextResponse.json(
				{ error: "Failed to fetch alerts for location" },
				{ status: 502 }
			);
		}

		const data: NWSResponse = await response.json();
		
		const severeAlerts = data.features?.filter((f) => {
			const event = f.properties.event.toLowerCase();
			return (
				event.includes("tornado") ||
				event.includes("severe thunderstorm") ||
				event.includes("hail")
			);
		}) || [];

		return NextResponse.json({
			success: true,
			location: { lat, lng },
			alerts: severeAlerts.map((f) => ({
				event: f.properties.event,
				headline: f.properties.headline,
				severity: f.properties.severity,
				expires: f.properties.expires,
				areas: f.properties.areaDesc,
			})),
		});
	} catch (error) {
		console.error("Location alert check error:", error);
		return NextResponse.json(
			{ error: "Failed to check alerts", details: String(error) },
			{ status: 500 }
		);
	}
}
