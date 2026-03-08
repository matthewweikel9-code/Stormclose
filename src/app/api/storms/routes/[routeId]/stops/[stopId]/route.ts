// PATCH /api/storms/routes/[routeId]/stops/[stopId] - Update a route stop
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
	request: NextRequest,
	{ params }: { params: { routeId: string; stopId: string } }
) {
	try {
		const supabase = await createClient() as any;
		
		const { data: { user }, error: authError } = await supabase.auth.getUser();
		if (authError || !user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		
		const { routeId, stopId } = params;
		const body = await request.json();
		
		// Verify route ownership
		const { data: route } = await supabase
			.from("storm_routes")
			.select("id, user_id, completed_stops")
			.eq("id", routeId)
			.eq("user_id", user.id)
			.single();
		
		if (!route) {
			return NextResponse.json({ error: "Route not found" }, { status: 404 });
		}
		
		// Build update object
		const updates: Record<string, any> = {};
		
		if (body.status !== undefined) {
			updates.status = body.status;
			if (body.status === "completed" || body.status === "skipped" || body.status === "not_home") {
				updates.knocked_at = new Date().toISOString();
			}
		}
		if (body.outcome !== undefined) updates.outcome = body.outcome;
		if (body.notes !== undefined) updates.notes = body.notes;
		if (body.callbackDate !== undefined) updates.callback_date = body.callbackDate;
		if (body.callbackTime !== undefined) updates.callback_time = body.callbackTime;
		
		// Update the stop
		const { data: updatedStop, error: stopError } = await supabase
			.from("route_stops")
			.update(updates)
			.eq("id", stopId)
			.eq("route_id", routeId)
			.select()
			.single();
		
		if (stopError) {
			console.error("Error updating stop:", stopError);
			return NextResponse.json(
				{ error: "Failed to update stop" },
				{ status: 500 }
			);
		}
		
		// Update route's completed_stops count
		const { data: completedCount } = await supabase
			.from("route_stops")
			.select("id", { count: "exact" })
			.eq("route_id", routeId)
			.in("status", ["completed", "skipped", "not_home", "callback"]);
		
		const newCompletedStops = completedCount?.length || 0;
		
		await supabase
			.from("storm_routes")
			.update({ 
				completed_stops: newCompletedStops,
				status: newCompletedStops > 0 ? "in_progress" : "planned"
			})
			.eq("id", routeId);
		
		// If updating lead status based on outcome, update the lead too
		if (body.outcome && updatedStop.lead_id) {
			let leadStatus = "contacted";
			if (body.outcome === "inspection_scheduled") leadStatus = "scheduled";
			if (body.outcome === "sold") leadStatus = "sold";
			if (body.outcome === "not_interested") leadStatus = "not_interested";
			
			await supabase
				.from("storm_leads")
				.update({ 
					status: leadStatus,
					updated_at: new Date().toISOString()
				})
				.eq("id", updatedStop.lead_id);
		}
		
		return NextResponse.json({ 
			success: true, 
			stop: updatedStop 
		});
		
	} catch (error) {
		console.error("Error in PATCH /api/storms/routes/[routeId]/stops/[stopId]:", error);
		return NextResponse.json({ error: "Server error" }, { status: 500 });
	}
}
