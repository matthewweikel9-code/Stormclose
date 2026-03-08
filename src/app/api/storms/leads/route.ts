// GET/POST /api/storms/leads - Manage storm leads
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { 
	generateLeadsFromStorm, 
	getLeadStats, 
	estimatePotentialRevenue 
} from "@/lib/storms/lead-generator";

// GET - Fetch user's leads
export async function GET(request: NextRequest) {
	try {
		const supabase = await createClient() as any;
		
		const { data: { user }, error: authError } = await supabase.auth.getUser();
		if (authError || !user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		
		const { searchParams } = new URL(request.url);
		const stormId = searchParams.get("stormId");
		const status = searchParams.get("status");
		const temperature = searchParams.get("temperature");
		const limit = parseInt(searchParams.get("limit") || "100");
		const offset = parseInt(searchParams.get("offset") || "0");
		
		let query = supabase
			.from("storm_leads")
			.select(`
				*,
				storm_events (
					id,
					event_type,
					severity,
					hail_size_inches,
					wind_speed_mph,
					city,
					state,
					event_date
				)
			`, { count: "exact" })
			.eq("user_id", user.id)
			.order("lead_score", { ascending: false })
			.range(offset, offset + limit - 1);
		
		if (stormId) {
			query = query.eq("storm_event_id", stormId);
		}
		if (status) {
			query = query.eq("status", status);
		}
		if (temperature) {
			query = query.eq("lead_temperature", temperature);
		}
		
		const { data: leads, error, count } = await query;
		
		if (error) {
			console.error("Error fetching leads:", error);
			return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 });
		}
		
		// Transform to camelCase
		const transformedLeads = (leads || []).map((l: any) => ({
			id: l.id,
			userId: l.user_id,
			stormEventId: l.storm_event_id,
			address: l.address,
			city: l.city,
			state: l.state,
			zip: l.zip,
			latitude: l.latitude ? parseFloat(l.latitude) : null,
			longitude: l.longitude ? parseFloat(l.longitude) : null,
			propertyValue: l.property_value,
			yearBuilt: l.year_built,
			roofAgeYears: l.roof_age_years,
			roofType: l.roof_type,
			squareFootage: l.square_footage,
			ownerName: l.owner_name,
			phone: l.phone,
			email: l.email,
			damageProbability: l.damage_probability,
			leadScore: l.lead_score,
			leadTemperature: l.lead_temperature,
			status: l.status,
			notes: l.notes,
			createdAt: l.created_at,
			updatedAt: l.updated_at,
			stormEvent: l.storm_events
		}));
		
		// Calculate stats
		const stats = getLeadStats(transformedLeads);
		const revenue = estimatePotentialRevenue(transformedLeads);
		
		return NextResponse.json({
			leads: transformedLeads,
			total: count || 0,
			stats,
			potentialRevenue: revenue
		});
		
	} catch (error) {
		console.error("Error in GET /api/storms/leads:", error);
		return NextResponse.json({ error: "Server error" }, { status: 500 });
	}
}

// POST - Create new leads (manual or generated)
export async function POST(request: NextRequest) {
	try {
		const supabase = await createClient() as any;
		
		const { data: { user }, error: authError } = await supabase.auth.getUser();
		if (authError || !user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		
		const body = await request.json();
		const { leads, stormEventId } = body;
		
		if (!leads || !Array.isArray(leads)) {
			return NextResponse.json(
				{ error: "leads array is required" },
				{ status: 400 }
			);
		}
		
		// Prepare leads for insertion
		const leadsToInsert = leads.map(lead => ({
			user_id: user.id,
			storm_event_id: stormEventId || lead.stormEventId,
			address: lead.address,
			city: lead.city,
			state: lead.state,
			zip: lead.zip,
			latitude: lead.latitude,
			longitude: lead.longitude,
			property_value: lead.propertyValue,
			year_built: lead.yearBuilt,
			roof_age_years: lead.roofAgeYears,
			roof_type: lead.roofType,
			square_footage: lead.squareFootage,
			owner_name: lead.ownerName,
			phone: lead.phone,
			email: lead.email,
			damage_probability: lead.damageProbability || 50,
			lead_score: lead.leadScore || 50,
			lead_temperature: lead.leadTemperature || "warm",
			status: "new",
			notes: lead.notes
		}));
		
		const { data: inserted, error } = await supabase
			.from("storm_leads")
			.insert(leadsToInsert)
			.select();
		
		if (error) {
			console.error("Error inserting leads:", error);
			return NextResponse.json(
				{ error: "Failed to create leads" },
				{ status: 500 }
			);
		}
		
		return NextResponse.json({
			success: true,
			count: inserted?.length || 0,
			leads: inserted
		});
		
	} catch (error) {
		console.error("Error in POST /api/storms/leads:", error);
		return NextResponse.json({ error: "Server error" }, { status: 500 });
	}
}
