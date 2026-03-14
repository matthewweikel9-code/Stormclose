import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleNextRoute, withStatus } from "@/lib/api-middleware";
import { isFeatureEnabled } from "@/lib/featureFlag";
import { createMissionFromStorm } from "@/services/missionService";

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
  return handleNextRoute(
    request,
    async ({ setUserId }) => {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();

      setUserId(user?.id);

      if (!user) {
        return withStatus(401, { error: "Unauthorized" });
      }

      const { searchParams } = new URL(request.url);
      const status = searchParams.get("status");
      const days = parseInt(searchParams.get("days") || "30");
      const limit = parseInt(searchParams.get("limit") || "20");

      try {
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
          return { missions: [], stats: getEmptyStats() };
        }

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

        return {
          success: true,
          missions: (missions || []).map(formatMission),
          stats,
        };
      } catch (error) {
        console.error("[Missions] Error:", error);
        return withStatus(500, { error: "Failed to fetch missions", details: String(error) });
      }
    },
    { route: "/api/missions" }
  );
}

// ─── POST: Create mission ──────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  return handleNextRoute(
    request,
    async ({ setUserId }) => {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();

      setUserId(user?.id);

      if (!user) {
        return withStatus(401, { error: "Unauthorized" });
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

    // mission_v2 path: new storm-driven mission orchestration with idempotency.
    // Falls back to legacy creation when flag is disabled or required fields are absent.
    const missionV2Enabled = await isFeatureEnabled(user.id, "mission_v2");
    const canUseMissionV2 =
      missionV2Enabled &&
      typeof stormEventId === "string" &&
      stormEventId.trim().length > 0 &&
      typeof body?.signature === "string" &&
      body.signature.trim().length > 0;

    if (canUseMissionV2) {
      const result = await createMissionFromStorm(user.id, stormEventId, {
        signature: body.signature,
        limit: typeof body?.limit === "number" ? body.limit : undefined,
        name: typeof name === "string" && name.trim().length > 0 ? name.trim() : undefined,
        description: typeof description === "string" && description.trim().length > 0 ? description : undefined,
        scheduledDate: typeof scheduledDate === "string" && scheduledDate.trim().length > 0 ? scheduledDate : null,
        stormDurationMinutes:
          typeof body?.stormDurationMinutes === "number" ? body.stormDurationMinutes : undefined,
      });

      return {
        success: true,
        mission: { id: result.missionId, name: name || "Storm Mission", status: "planned" },
        stops: result.selectedStops.map((stop, index) => ({
          stopOrder: index + 1,
          address: stop.address,
          city: stop.city,
          state: stop.state,
          zip: stop.zip,
          lat: stop.latitude,
          lng: stop.longitude,
          ownerName: stop.owner_name,
          yearBuilt: stop.year_built,
          squareFeet: stop.square_feet,
          roofAge: stop.roof_age,
          estimatedValue: Number(stop.estimated_value) || 0,
          estimatedClaim: Number(stop.estimated_claim) || 0,
          propertyType: stop.property_type,
          outcome: stop.outcome,
          threatScore: stop.threat_score,
        })),
        featureFlag: "mission_v2",
        created: result.created,
      };
    }

    if (!name || !Number.isFinite(centerLat) || !Number.isFinite(centerLng)) {
      return withStatus(400, { error: "name, centerLat, and centerLng are required" });
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
      return withStatus(500, { error: "Failed to create mission", details: missionError.message });
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
        // Roll back the orphaned mission
        await (supabase.from("canvass_missions") as any)
          .delete()
          .eq("id", mission.id);
        return withStatus(500, {
          error: "Failed to create mission stops — mission rolled back",
          details: stopsError.message,
        });
      }
    }

    // Fetch the created stops back so frontend has IDs + full data
    const { data: createdStops } = await (supabase.from("mission_stops") as any)
      .select("*")
      .eq("mission_id", mission.id)
      .order("stop_order", { ascending: true });

    return {
      success: true,
      mission: formatMission(mission),
      stops: (createdStops || []).map(formatStop),
    };
      } catch (error) {
        console.error("[Missions] Create error:", error);
        return withStatus(500, { error: "Failed to create mission", details: String(error) });
      }
    },
    { route: "/api/missions" }
  );
}

// ─── PATCH: Update mission ─────────────────────────────────────────────────
export async function PATCH(request: NextRequest) {
  return handleNextRoute(
    request,
    async ({ setUserId }) => {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();

      setUserId(user?.id);

      if (!user) {
        return withStatus(401, { error: "Unauthorized" });
      }

      try {
    const body = await request.json();
    const { missionId, action } = body;

    if (!missionId || !action) {
      return withStatus(400, { error: "missionId and action are required" });
    }

    // Verify ownership
    const { data: mission } = await (supabase.from("canvass_missions") as any)
      .select("id, user_id, status")
      .eq("id", missionId)
      .eq("user_id", user.id)
      .single();

    if (!mission) {
      return withStatus(404, { error: "Mission not found" });
    }

    switch (action) {
      case "start": {
        if (mission.status !== "planned") {
          return withStatus(409, { error: `Cannot start mission in '${mission.status}' state` });
        }
        const { error: startErr } = await (supabase.from("canvass_missions") as any)
          .update({ status: "in_progress", started_at: new Date().toISOString() })
          .eq("id", missionId)
          .eq("status", "planned"); // optimistic lock
        if (startErr) {
          return withStatus(500, { error: "Failed to start mission", details: startErr.message });
        }
        break;
      }

      case "complete": {
        if (mission.status !== "in_progress") {
          return withStatus(409, { error: `Cannot complete mission in '${mission.status}' state` });
        }
        const { error: completeErr } = await (supabase.from("canvass_missions") as any)
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("id", missionId)
          .eq("status", "in_progress"); // optimistic lock
        if (completeErr) {
          return withStatus(500, { error: "Failed to complete mission", details: completeErr.message });
        }

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
        if (mission.status === "completed" || mission.status === "cancelled") {
          return withStatus(409, { error: `Cannot cancel mission in '${mission.status}' state` });
        }
        const { error: cancelErr } = await (supabase.from("canvass_missions") as any)
          .update({ status: "cancelled" })
          .eq("id", missionId)
          .not("status", "in", '("completed","cancelled")'); // optimistic lock
        if (cancelErr) {
          return withStatus(500, { error: "Failed to cancel mission", details: cancelErr.message });
        }
        break;
      }

      case "update_stop": {
        const { stopId, outcome, notes, homeownerName, homeownerPhone, homeownerEmail, appointmentDate } = body;

        if (!stopId || !outcome) {
          return withStatus(400, { error: "stopId and outcome required for update_stop" });
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

        const { error: stopUpdateErr } = await (supabase.from("mission_stops") as any)
          .update(updateData)
          .eq("id", stopId)
          .eq("user_id", user.id);

        if (stopUpdateErr) {
          return withStatus(500, { error: "Failed to update stop", details: stopUpdateErr.message });
        }

        // If appointment set, auto-create a lead (race-safe)
        if (outcome === "appointment_set" || outcome === "inspection_set") {
          // Atomically claim the stop for lead creation (only if lead_id IS NULL)
          // This prevents duplicate leads from concurrent requests
          const { data: claimedStop, error: claimErr } = await (supabase.from("mission_stops") as any)
            .update({ lead_id: '00000000-0000-0000-0000-000000000000' }) // sentinel
            .eq("id", stopId)
            .is("lead_id", null)
            .select("*")
            .maybeSingle();

          if (claimedStop && !claimErr) {
            const { data: newLead, error: leadErr } = await (supabase
              .from("leads") as any)
              .insert({
                user_id: user.id,
                address: claimedStop.address,
                city: claimedStop.city,
                state: claimedStop.state,
                zip: claimedStop.zip,
                latitude: claimedStop.latitude,
                longitude: claimedStop.longitude,
                year_built: claimedStop.year_built,
                square_feet: claimedStop.square_feet,
                roof_age: claimedStop.roof_age,
                estimated_claim: claimedStop.estimated_claim,
                status: outcome === "inspection_set" ? "inspected" : "appointment_set",
                source: "canvass_mission",
                notes: `Mission stop. ${notes || ""}`.trim(),
              })
              .select("id")
              .single();

            if (newLead && !leadErr) {
              // Link real lead to stop (replace sentinel)
              await (supabase.from("mission_stops") as any)
                .update({ lead_id: (newLead as any).id })
                .eq("id", stopId);
            } else {
              // Lead creation failed — clear sentinel so it can be retried
              await (supabase.from("mission_stops") as any)
                .update({ lead_id: null })
                .eq("id", stopId);
              console.error("[Missions] Lead creation failed:", leadErr);
            }
          }
          // If claimedStop is null, another request already claimed it — skip (idempotent)
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
        return withStatus(400, { error: `Unknown action: ${action}` });
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

    return {
      success: true,
      mission: formatMission(updated),
      stops: (stops || []).map(formatStop),
    };
      } catch (error) {
        console.error("[Missions] Update error:", error);
        return withStatus(500, { error: "Failed to update mission", details: String(error) });
      }
    },
    { route: "/api/missions" }
  );
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
