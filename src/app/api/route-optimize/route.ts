import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkFeatureAccess } from "@/lib/subscriptions";

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_SOLAR_API_KEY || "AIzaSyB4EuYOLXgQ0sd9AYlx0bJ709VcNLi9HyI";

export async function POST(request: NextRequest) {
	try {
		// Check authentication
		const supabase = await createClient();
		const { data: { user } } = await supabase.auth.getUser();

		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Check feature access - using lead_generator feature key
		const access = await checkFeatureAccess(user.id, "lead_generator");
		if (!access.allowed) {
			return NextResponse.json({
				error: "Feature not available",
				reason: access.reason,
				tier: access.tier
			}, { status: 403 });
		}

		const body = await request.json();
		const { startingPoint, waypoints, optimizeWaypoints = true } = body;

		if (!waypoints || waypoints.length < 2) {
			return NextResponse.json(
				{ error: "Provide at least 2 waypoints" },
				{ status: 400 }
			);
		}

		// Use first waypoint as origin if no starting point provided
		const origin = startingPoint || waypoints[0];
		const destination = waypoints[waypoints.length - 1];
		
		// Middle waypoints (exclude first and last if they're origin/destination)
		const middleWaypoints = startingPoint 
			? waypoints 
			: waypoints.slice(1, -1);

		// Build Google Directions API URL
		const params = new URLSearchParams({
			origin,
			destination,
			mode: "driving",
			key: GOOGLE_MAPS_API_KEY
		});

		if (middleWaypoints.length > 0) {
			// Add waypoints with optimize flag
			const waypointsParam = optimizeWaypoints 
				? `optimize:true|${middleWaypoints.join("|")}`
				: middleWaypoints.join("|");
			params.append("waypoints", waypointsParam);
		}

		const response = await fetch(
			`https://maps.googleapis.com/maps/api/directions/json?${params.toString()}`
		);

		const data = await response.json();

		if (data.status !== "OK") {
			console.error("Google Directions API error:", data.status, data.error_message);
			return NextResponse.json(
				{ error: `Route calculation failed: ${data.status}` },
				{ status: 400 }
			);
		}

		const route = data.routes[0];
		const legs = route.legs;

		// Calculate totals
		let totalDistanceMeters = 0;
		let totalDurationSeconds = 0;

		const legDetails = legs.map((leg: any) => {
			totalDistanceMeters += leg.distance.value;
			totalDurationSeconds += leg.duration.value;

			return {
				distance: leg.distance.text,
				duration: leg.duration.text,
				startAddress: leg.start_address,
				endAddress: leg.end_address
			};
		});

		// Format totals
		const totalDistanceMiles = (totalDistanceMeters / 1609.34).toFixed(1);
		const totalHours = Math.floor(totalDurationSeconds / 3600);
		const totalMinutes = Math.round((totalDurationSeconds % 3600) / 60);
		const totalDurationText = totalHours > 0 
			? `${totalHours} hr ${totalMinutes} min`
			: `${totalMinutes} min`;

		return NextResponse.json({
			success: true,
			waypointOrder: route.waypoint_order || null,
			routeInfo: {
				totalDistance: `${totalDistanceMiles} mi`,
				totalDuration: totalDurationText,
				legs: legDetails
			},
			bounds: route.bounds,
			polyline: route.overview_polyline?.points
		});

	} catch (error) {
		console.error("Route optimization error:", error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Failed to optimize route" },
			{ status: 500 }
		);
	}
}
