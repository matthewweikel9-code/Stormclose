import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/missions
 * List user's canvass missions with stats
 * 
 * Query params:
 *   - status: filter by status (planned|in_progress|completed|cancelled)
 *   - days: how far back (default 30)
 *   - limit: max results (default 20)
 * 
 * POST /api/missions
 * Create a new canvass mission
 * 
 * Body:
 *   - name: mission name
 *   - stormEventId?: linked storm event
 *   - centerLat, centerLng: center point
 *   - radiusMiles?: scan radius
 *   - stops: array of { address, lat, lng, ownerName?, yearBuilt?, ... }
 *   - scheduledDate?: ISO date
 * 
 * PATCH /api/missions
 * Update a mission (status, stops outcomes, etc.)
 * 
 * Body:
 *   - missionId: UUID
 *   - action: "start" | "complete" | "cancel" | "update_stop"
 *   - ... action-specific fields
 */

// ─── GET: List missions ────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const days = parseInt(searchParams.get("days") || "30");
  const limit = parseInt(searchParams.get("limit") || "20");

  try {
    // Fetch missions
    let query = (supabase.from("canvass_missions") as any)
      .select("*")
      .eq("user_id", user.id)
      .gte("created_at", new Date(Date.now() - days * 86400000).toISOString())
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq("status", status);
    }

    const { data: missions, error: missionsError } = await query;

    if (missionsError) {
      console.error("[Missions] DB error:", missionsError);
      return NextResponse.json({ missions: [], stats: getEmptyStats() });
    }

    // Fetch mission stats
    let stats = getEmptyStats();
    try {
      // @ts-expect-error - get_mission_stats not in generated types
      const { data: statsData } = await supabase.rpc("get_mission_stats", {
        p_user_id: user.id,
        p_days_back: days,
      });
      const statsArr = statsData as any;
      if (statsArr && Array.isArray(statsArr) && statsArr.length > 0) {
        const s = statsArr[0];
        stats = {
          totalMissions: Number(s.total_missions) || 0,
          activeMissions: Number(s.active_missions) || 0,
          totalDoorsKnocked: Number(s.total_doors_knocked) || 0,
          totalNotHome: Number(s.total_not_home) || 0,
          totalAppointments: Number(s.total_appointments) || 0,
          totalLeads: Number(s.total_leads) || 0,
          totalEstimatedPipeline: Number(s.total_estimated_pipeline) || 0,
          avgDoorsPerMission: Number(s.avg_doors_per_mission) || 0,
          avgAppointmentsPerMission: Number(s.avg_appointments_per_mission) || 0,
          appointmentRate: Number(s.appointment_rate) || 0,
        };
      }
    } catch {
      // Function may not exist yet
    }

    return NextResponse.json({
      success: true,
      missions: (missions || []).map(formatMission),
      stats,
    });
  } catch (error) {
    console.error("[Missions] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch missions", details: String(error) },
      { status: 500 }
    );
  }
}

// ─── POST: Create mission ──────────────────────────────────────────────────
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
      description,
      stormEventId,
      centerLat,
      centerLng,
      radiusMiles = 1.0,
      stops = [],
      scheduledDate,
    } = body;

    if (!name || !centerLat || !centerLng) {
      return NextResponse.json(
        { error: "name, centerLat, and centerLng are required" },
        { status: 400 }
      );
    }

    // Calculate estimated pipeline from stops
    const estimatedPipeline = stops.reduce(
      (sum: number, stop: any) => sum + (stop.estimatedClaim || stop.estimated_claim || 0),
      0
    );

    // 1. Create the mission
    const { data: mission, error: missionError } = await (supabase.from("canvass_missions") as any)
      .insert({
        user_id: user.id,
        name,
        description: description || null,
        storm_event_id: stormEventId || null,
        center_lat: centerLat,
        center_lng: centerLng,
        radius_miles: radiusMiles,
        total_stops: stops.length,
        estimated_pipeline: estimatedPipeline,
        scheduled_date: scheduledDate || null,
        status: "planned",
      })
      .select()
      .single();

    if (missionError) {
      console.error("[Missions] Create error:", missionError);
      return NextResponse.json(
        { error: "Failed to create mission", details: missionError.message },
        { status: 500 }
      );
    }

    // 2. Create mission stops
    if (stops.length > 0 && mission) {
      const stopRecords = stops.map((stop: any, index: number) => ({
        mission_id: mission.id,
        user_id: user.id,
        stop_order: index + 1,
        address: stop.address,
        city: stop.city || null,
        state: stop.state || null,
        zip: stop.zip || null,
        latitude: stop.lat || stop.latitude,
        longitude: stop.lng || stop.longitude,
        owner_name: stop.ownerName || stop.owner_name || stop.owner || null,
        year_built: stop.yearBuilt || stop.year_built || null,
        square_feet: stop.squareFeet || stop.square_feet || null,
        roof_age: stop.roofAge || stop.roof_age || null,
        estimated_value: stop.estimatedValue || stop.estimated_value || null,
        estimated_claim: stop.estimatedClaim || stop.estimated_claim || null,
        property_type: stop.propertyType || stop.property_type || null,
        outcome: "pending",
      }));

      const { error: stopsError } = await (supabase.from("mission_stops") as any)
        .insert(stopRecords);

      if (stopsError) {
        console.error("[Missions] Stops insert error:", stopsError);
        // Mission was created, stops failed — don't roll back, just warn
      }
    }

    return NextResponse.json({
      success: true,
      mission: formatMission(mission),
    });
  } catch (error) {
    console.error("[Missions] Create error:", error);
    return NextResponse.json(
      { error: "Failed to create mission", details: String(error) },
      { status: 500 }
    );
  }
}

// ─── PATCH: Update mission ─────────────────────────────────────────────────
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { missionId, action } = body;

    if (!missionId || !action) {
      return NextResponse.json(
        { error: "missionId and action are required" },
        { status: 400 }
      );
    }

    // Verify ownership
    const { data: mission } = await (supabase.from("canvass_missions") as any)
      .select("id, user_id, status")
      .eq("id", missionId)
      .eq("user_id", user.id)
      .single();

    if (!mission) {
      return NextResponse.json({ error: "Mission not found" }, { status: 404 });
    }

    switch (action) {
      case "start": {
        await (supabase.from("canvass_missions") as any)
          .update({ status: "in_progress", started_at: new Date().toISOString() })
          .eq("id", missionId);
        break;
      }

      case "complete": {
        await (supabase.from("canvass_missions") as any)
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("id", missionId);

        // Update stats from stops
        try {
          // @ts-expect-error - update_mission_stats not in generated types
          await supabase.rpc("update_mission_stats", { p_mission_id: missionId });
        } catch {
          // Function may not exist
        }
        break;
      }

      case "cancel": {
        await (supabase.from("canvass_missions") as any)
          .update({ status: "cancelled" })
          .eq("id", missionId);
        break;
      }

      case "update_stop": {
        const { stopId, outcome, notes, homeownerName, homeownerPhone, homeownerEmail, appointmentDate } = body;

        if (!stopId || !outcome) {
          return NextResponse.json(
            { error: "stopId and outcome required for update_stop" },
            { status: 400 }
          );
        }

        const updateData: Record<string, any> = {
          outcome,
          completed_at: outcome !== "pending" ? new Date().toISOString() : null,
        };
        if (notes) updateData.outcome_notes = notes;
        if (homeownerName) updateData.homeowner_name = homeownerName;
        if (homeownerPhone) updateData.homeowner_phone = homeownerPhone;
        if (homeownerEmail) updateData.homeowner_email = homeownerEmail;
        if (appointmentDate) updateData.appointment_date = appointmentDate;

        await (supabase.from("mission_stops") as any)
          .update(updateData)
          .eq("id", stopId)
          .eq("user_id", user.id);

        // If appointment set, auto-create a lead
        if (outcome === "appointment_set" || outcome === "inspection_set") {
          const { data: stop } = await (supabase.from("mission_stops") as any)
            .select("*")
            .eq("id", stopId)
            .single();

          if (stop && !stop.lead_id) {
            const { data: newLead } = await (supabase
              .from("leads") as any)
              .insert({
                user_id: user.id,
                address: stop.address,
                city: stop.city,
                state: stop.state,
                zip: stop.zip,
                latitude: stop.latitude,
                longitude: stop.longitude,
                year_built: stop.year_built,
                square_feet: stop.square_feet,
                roof_age: stop.roof_age,
                estimated_claim: stop.estimated_claim,
                status: outcome === "inspection_set" ? "inspected" : "appointment_set",
                source: "canvass_mission",
                notes: `Mission stop. ${notes || ""}`.trim(),
              })
              .select("id")
              .single();

            if (newLead as any) {
              // Link lead to stop
              await (supabase.from("mission_stops") as any)
                .update({ lead_id: (newLead as any).id })
                .eq("id", stopId);
            }
          }
        }

        // Update mission stats
        try {
          // @ts-expect-error - update_mission_stats not in generated types
          await supabase.rpc("update_mission_stats", { p_mission_id: missionId });
        } catch {
          // Function may not exist
        }
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    // Fetch updated mission with stops
    const { data: updated } = await (supabase.from("canvass_missions") as any)
      .select("*")
      .eq("id", missionId)
      .single();

    const { data: stops } = await (supabase.from("mission_stops") as any)
      .select("*")
      .eq("mission_id", missionId)
      .order("stop_order", { ascending: true });

    return NextResponse.json({
      success: true,
      mission: formatMission(updated),
      stops: (stops || []).map(formatStop),
    });
  } catch (error) {
    console.error("[Missions] Update error:", error);
    return NextResponse.json(
      { error: "Failed to update mission", details: String(error) },
      { status: 500 }
    );
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatMission(m: any) {
  if (!m) return null;
  return {
    id: m.id,
    name: m.name,
    description: m.description,
    stormEventId: m.storm_event_id,
    centerLat: m.center_lat,
    centerLng: m.center_lng,
    radiusMiles: m.radius_miles,
    totalStops: m.total_stops || 0,
    stopsCompleted: m.stops_completed || 0,
    stopsKnocked: m.stops_knocked || 0,
    stopsNotHome: m.stops_not_home || 0,
    stopsNotInterested: m.stops_not_interested || 0,
    appointmentsSet: m.appointments_set || 0,
    inspectionsScheduled: m.inspections_scheduled || 0,
    leadsCreated: m.leads_created || 0,
    estimatedPipeline: Number(m.estimated_pipeline) || 0,
    actualPipeline: Number(m.actual_pipeline) || 0,
    optimizedRoute: m.optimized_route,
    estimatedDuration: m.estimated_duration_minutes,
    estimatedDistance: m.estimated_distance_miles,
    status: m.status,
    scheduledDate: m.scheduled_date,
    startedAt: m.started_at,
    completedAt: m.completed_at,
    createdAt: m.created_at,
  };
}

function formatStop(s: any) {
  if (!s) return null;
  return {
    id: s.id,
    stopOrder: s.stop_order,
    address: s.address,
    city: s.city,
    state: s.state,
    zip: s.zip,
    lat: s.latitude,
    lng: s.longitude,
    ownerName: s.owner_name,
    yearBuilt: s.year_built,
    squareFeet: s.square_feet,
    roofAge: s.roof_age,
    estimatedValue: Number(s.estimated_value) || 0,
    estimatedClaim: Number(s.estimated_claim) || 0,
    propertyType: s.property_type,
    outcome: s.outcome,
    outcomeNotes: s.outcome_notes,
    homeownerName: s.homeowner_name,
    homeownerPhone: s.homeowner_phone,
    homeownerEmail: s.homeowner_email,
    appointmentDate: s.appointment_date,
    leadId: s.lead_id,
    arrivedAt: s.arrived_at,
    completedAt: s.completed_at,
  };
}

function getEmptyStats() {
  return {
    totalMissions: 0,
    activeMissions: 0,
    totalDoorsKnocked: 0,
    totalNotHome: 0,
    totalAppointments: 0,
    totalLeads: 0,
    totalEstimatedPipeline: 0,
    avgDoorsPerMission: 0,
    avgAppointmentsPerMission: 0,
    appointmentRate: 0,
  };
}
