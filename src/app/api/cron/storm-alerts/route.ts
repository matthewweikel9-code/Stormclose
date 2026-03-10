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

// This cron job runs every 5 minutes to check for new storm alerts
// Configure in vercel.json: "schedule": "*/5 * * * *"
export async function GET(request: NextRequest) {
	// Verify cron secret
	const authHeader = request.headers.get("authorization");
	const cronSecret = process.env.CRON_SECRET;
	
	if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	console.log("⏰ Running storm alert cron job...");

	try {
		// Fetch severe weather alerts
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
				next: { revalidate: 0 },
			}
		);

		if (!response.ok) {
			throw new Error(`NWS API error: ${response.status}`);
		}

		const data = await response.json();
		const alerts = data.features || [];
		
		let newAlertsCount = 0;
		let notificationsSent = 0;

		for (const alert of alerts) {
			const props = alert.properties;
			const nwsEventId = props.id;

			// Check if we already have this alert
			const { data: existing } = await supabaseAdmin
				.from("storm_alerts")
				.select("id")
				.eq("nws_event_id", nwsEventId)
				.single();

			if (existing) {
				continue; // Already processed
			}

			// Map alert type
			const alertType = mapAlertType(props.event);
			if (!alertType) continue;

			// Parse hail size and wind speed
			const hailSize = parseValue(props.parameters?.maxHailSize?.[0]);
			const windSpeed = parseValue(props.parameters?.maxWindGust?.[0]);

			// Insert new alert
			const { data: newAlert, error: insertError } = await supabaseAdmin
				.from("storm_alerts")
				.insert({
					nws_event_id: nwsEventId,
					alert_type: alertType,
					severity: mapSeverity(props.severity),
					headline: props.headline,
					description: props.description?.substring(0, 2000),
					affected_areas: props.areaDesc?.split(";").map((s: string) => s.trim()) || [],
					onset_at: props.onset,
					expires_at: props.expires,
					issued_at: props.effective,
					hail_size_inches: hailSize,
					wind_speed_mph: windSpeed,
					status: "active",
				})
				.select("id")
				.single();

			if (insertError) {
				console.error("Failed to insert alert:", insertError);
				continue;
			}

			newAlertsCount++;
			console.log(`⚡ New alert: ${alertType} - ${props.headline}`);

			// Find users with matching territories and send notifications
			// For now, we'll just record the alert and users can poll for updates
			// In production, you'd trigger push notifications here
			
			// Get all users with territories that might be affected
			// This is a simplified version - production would use PostGIS
			const { data: territories } = await supabaseAdmin
				.from("territories")
				.select("user_id, id, name, zip_codes")
				.eq("is_active", true)
				.eq("alert_enabled", true);

			if (territories) {
				for (const territory of territories) {
					// Record notification for each affected user
					// Use upsert to handle duplicates
					await supabaseAdmin.from("alert_notifications").upsert({
						user_id: territory.user_id,
						alert_id: newAlert.id,
						territory_id: territory.id,
						channel: "in_app",
						status: "sent",
						sent_at: new Date().toISOString(),
					}, { onConflict: "user_id,alert_id,channel", ignoreDuplicates: true });
					
					notificationsSent++;
				}
			}
		}

		// Expire old alerts
		const { data: expiredAlerts } = await supabaseAdmin
			.from("storm_alerts")
			.update({ status: "expired" })
			.lt("expires_at", new Date().toISOString())
			.eq("status", "active")
			.select("id");

		const result = {
			success: true,
			timestamp: new Date().toISOString(),
			alertsProcessed: alerts.length,
			newAlerts: newAlertsCount,
			notificationsSent,
			alertsExpired: expiredAlerts?.length || 0,
		};

		console.log("✅ Storm cron complete:", result);
		return NextResponse.json(result);
	} catch (error) {
		console.error("Storm cron error:", error);
		return NextResponse.json(
			{ error: "Cron job failed", details: String(error) },
			{ status: 500 }
		);
	}
}

function mapAlertType(event: string): string | null {
	const eventLower = event.toLowerCase();
	if (eventLower.includes("tornado warning")) return "tornado_warning";
	if (eventLower.includes("tornado watch")) return "tornado_watch";
	if (eventLower.includes("severe thunderstorm warning")) return "severe_thunderstorm_warning";
	if (eventLower.includes("severe thunderstorm watch")) return "severe_thunderstorm_watch";
	return null;
}

function mapSeverity(severity: string): string {
	switch (severity?.toLowerCase()) {
		case "extreme": return "extreme";
		case "severe": return "severe";
		case "moderate": return "moderate";
		case "minor": return "minor";
		default: return "unknown";
	}
}

function parseValue(str?: string): number | null {
	if (!str) return null;
	const match = str.match(/[\d.]+/);
	return match ? parseFloat(match[0]) : null;
}
