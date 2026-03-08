// GET/POST /api/storms/routes - Manage storm routes
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { 
	createRouteFromLeads, 
	getRouteProgress, 
	getRouteOutcomes 
} from "@/lib/storms/route-optimizer";

// GET - Fetch user's routes
export async function GET(request: NextRequest) {
	try {
		const supabase = await createClient() as any;
		
		const { data: { user }, error: authError } = await supabase.auth.getUser();
		if (authError || !user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		
		const { searchParams } = new URL(request.url);
		const status = searchParams.get("status");
		const includeStops = searchParams.get("includeStops") === "true";
		
		let query = supabase
			.from("storm_routes")
			.select(`
				*,
				storm_events (
					id,
					event_type,
					severity,
					city,
					state,
					event_date
				)
			`)
			.eq("user_id", user.id)
			.order("created_at", { ascending: false });
		
		if (status) {
			query = query.eq("status", status);
		}
		
		const { data: routes, error } = await query;
		
		if (error) {
			console.error("Error fetching routes:", error);
			return NextResponse.json({ error: "Failed to fetch routes" }, { status: 500 });
		}
		
		// Optionally fetch stops for each route
		let routesWithStops = routes || [];
		if (includeStops && routesWithStops.length > 0) {
			const routeIds = routesWithStops.map((r: any) => r.id);
			
			const { data: stops } = await supabase
				.from("route_stops")
				.select(`
					*,
					storm_leads (
						id,
						address,
						owner_name,
						phone,
						lead_score,
						lead_temperature
					)
				`)
				.in("route_id", routeIds)
				.order("stop_order", { ascending: true });
			
			// Group stops by route
			const stopsByRoute: Record<string, any[]> = {};
			(stops || []).forEach((stop: any) => {
				if (!stopsByRoute[stop.route_id]) {
					stopsByRoute[stop.route_id] = [];
				}
				stopsByRoute[stop.route_id].push(stop);
			});
			
			routesWithStops = routesWithStops.map((route: any) => ({
				...route,
				stops: stopsByRoute[route.id] || []
			}));
		}
		
		// Transform to camelCase
		const transformedRoutes = routesWithStops.map((r: any) => ({
			id: r.id,
			userId: r.user_id,
			stormEventId: r.storm_event_id,
			name: r.name,
			status: r.status,
			totalStops: r.total_stops,
			completedStops: r.completed_stops,
			estimatedDurationMinutes: r.estimated_duration_minutes,
			totalDistanceMiles: r.total_distance_miles ? parseFloat(r.total_distance_miles) : null,
			startAddress: r.start_address,
			startLat: r.start_lat ? parseFloat(r.start_lat) : null,
			startLng: r.start_lng ? parseFloat(r.start_lng) : null,
			startedAt: r.started_at,
			completedAt: r.completed_at,
			createdAt: r.created_at,
			stormEvent: r.storm_events,
			stops: r.stops?.map((s: any) => ({
				id: s.id,
				routeId: s.route_id,
				leadId: s.lead_id,
				stopOrder: s.stop_order,
				address: s.address,
				latitude: s.latitude ? parseFloat(s.latitude) : null,
				longitude: s.longitude ? parseFloat(s.longitude) : null,
				status: s.status,
				outcome: s.outcome,
				callbackDate: s.callback_date,
				callbackTime: s.callback_time,
				notes: s.notes,
				knockedAt: s.knocked_at,
				lead: s.storm_leads
			}))
		}));
		
		return NextResponse.json({ routes: transformedRoutes });
		
	} catch (error) {
		console.error("Error in GET /api/storms/routes:", error);
		return NextResponse.json({ error: "Server error" }, { status: 500 });
	}
}

// POST - Create a new route from leads
export async function POST(request: NextRequest) {
	try {
		const supabase = await createClient() as any;
		
		const { data: { user }, error: authError } = await supabase.auth.getUser();
		if (authError || !user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		
		const body = await request.json();
		const { 
			name, 
			leadIds, 
			stormEventId, 
			startLat, 
			startLng,
			startAddress 
		} = body;
		
		if (!name) {
			return NextResponse.json(
				{ error: "Route name is required" },
				{ status: 400 }
			);
		}
		
		if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
			return NextResponse.json(
				{ error: "At least one lead is required" },
				{ status: 400 }
			);
		}
		
		// Fetch the leads
		const { data: leads, error: leadsError } = await supabase
			.from("storm_leads")
			.select("*")
			.in("id", leadIds)
			.eq("user_id", user.id);
		
		if (leadsError || !leads || leads.length === 0) {
			return NextResponse.json(
				{ error: "Could not find leads" },
				{ status: 400 }
			);
		}
		
		// Transform leads to expected format
		const transformedLeads = leads.map((l: any) => ({
			id: l.id,
			userId: l.user_id,
			address: l.address,
			city: l.city,
			state: l.state,
			zip: l.zip,
			latitude: l.latitude ? parseFloat(l.latitude) : undefined,
			longitude: l.longitude ? parseFloat(l.longitude) : undefined,
			leadScore: l.lead_score,
			leadTemperature: l.lead_temperature,
			status: l.status as any,
			createdAt: l.created_at,
			updatedAt: l.updated_at
		}));
		
		// Create optimized route
		const { route, stops } = createRouteFromLeads(
			transformedLeads as any,
			user.id,
			name,
			stormEventId,
			startLat,
			startLng
		);
		
		// Insert route
		const { data: insertedRoute, error: routeError } = await supabase
			.from("storm_routes")
			.insert({
				user_id: user.id,
				storm_event_id: route.stormEventId,
				name: route.name,
				status: route.status,
				total_stops: route.totalStops,
				completed_stops: 0,
				estimated_duration_minutes: route.estimatedDurationMinutes,
				total_distance_miles: route.totalDistanceMiles,
				start_address: startAddress || route.startAddress,
				start_lat: route.startLat,
				start_lng: route.startLng
			})
			.select()
			.single();
		
		if (routeError || !insertedRoute) {
			console.error("Error creating route:", routeError);
			return NextResponse.json(
				{ error: "Failed to create route" },
				{ status: 500 }
			);
		}
		
		// Insert stops
		const stopsToInsert = stops.map(stop => ({
			route_id: insertedRoute.id,
			lead_id: stop.leadId,
			stop_order: stop.stopOrder,
			address: stop.address,
			latitude: stop.latitude,
			longitude: stop.longitude,
			status: "pending"
		}));
		
		const { error: stopsError } = await supabase
			.from("route_stops")
			.insert(stopsToInsert);
		
		if (stopsError) {
			console.error("Error creating stops:", stopsError);
			// Clean up route if stops failed
			await supabase.from("storm_routes").delete().eq("id", insertedRoute.id);
			return NextResponse.json(
				{ error: "Failed to create route stops" },
				{ status: 500 }
			);
		}
		
		return NextResponse.json({
			success: true,
			route: {
				id: insertedRoute.id,
				name: insertedRoute.name,
				totalStops: insertedRoute.total_stops,
				estimatedDurationMinutes: insertedRoute.estimated_duration_minutes,
				totalDistanceMiles: insertedRoute.total_distance_miles
			}
		});
		
	} catch (error) {
		console.error("Error in POST /api/storms/routes:", error);
		return NextResponse.json({ error: "Server error" }, { status: 500 });
	}
}
