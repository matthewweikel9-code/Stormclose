import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/storms/revenue-analysis
 * 
 * Calculates total storm opportunity value for the user's visible territory.
 * Combines live storm data with lead pipeline data to show:
 * - Total active opportunity across all recent storms
 * - Unclaimed vs claimed properties
 * - Revenue velocity (how fast they're capturing storm revenue)
 * 
 * Query params:
 *   - lat, lng: center point
 *   - days: lookback period (default 30)
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get("lat") || "0");
  const lng = parseFloat(searchParams.get("lng") || "0");
  const days = parseInt(searchParams.get("days") || "30");

  if (!lat || !lng) {
    return NextResponse.json({ error: "lat and lng required" }, { status: 400 });
  }

  try {
    // 1. Fetch cached storm events for revenue calculations
    let stormEvents: any[] = [];
    try {
      const { data } = await (supabase.from("storm_events_cache") as any)
        .select("*")
        .eq("user_id", user.id)
        .gte("event_occurred_at", new Date(Date.now() - days * 86400000).toISOString())
        .order("event_occurred_at", { ascending: false });
      stormEvents = data || [];
    } catch {
      // Table may not exist
    }

    // 2. Fetch pipeline leads data
    const { data: leads } = await (supabase
      .from("leads") as any)
      .select("id, status, estimated_claim, actual_claim, lead_score, source, created_at, latitude, longitude")
      .eq("user_id", user.id);

    const allLeads: any[] = leads || [];

    // Filter leads created in the lookback period
    const recentLeads = allLeads.filter(
      (l) => new Date(l.created_at).getTime() > Date.now() - days * 86400000
    );

    // 3. Calculate revenue metrics from storms
    const totalStormOpportunity = stormEvents.reduce(
      (sum: number, e: any) => sum + (Number(e.estimated_opportunity) || 0), 0
    );
    const totalCaptured = stormEvents.reduce(
      (sum: number, e: any) => sum + (Number(e.revenue_captured) || 0), 0
    );
    const totalEstProperties = stormEvents.reduce(
      (sum: number, e: any) => sum + (e.estimated_properties || 0), 0
    );
    const totalCanvassed = stormEvents.reduce(
      (sum: number, e: any) => sum + (e.properties_canvassed || 0), 0
    );

    // 4. Pipeline breakdown
    const pipeline = {
      new: allLeads.filter((l) => l.status === "new"),
      contacted: allLeads.filter((l) => l.status === "contacted"),
      appointmentSet: allLeads.filter((l) => l.status === "appointment_set"),
      inspected: allLeads.filter((l) => l.status === "inspected"),
      signed: allLeads.filter((l) => l.status === "signed"),
      closed: allLeads.filter((l) => l.status === "closed"),
      lost: allLeads.filter((l) => l.status === "lost"),
    };

    const activePipeline = [...pipeline.new, ...pipeline.contacted, ...pipeline.appointmentSet, ...pipeline.inspected, ...pipeline.signed];
    const pipelineValue = activePipeline.reduce((sum, l) => sum + (Number(l.estimated_claim) || 0), 0);
    const closedValue = pipeline.closed.reduce((sum, l) => sum + (Number(l.actual_claim) || Number(l.estimated_claim) || 0), 0);

    // 5. Calculate velocity — deals per week
    const weeksBack = Math.max(1, days / 7);
    const closedInPeriod = pipeline.closed.filter(
      (l) => new Date(l.created_at).getTime() > Date.now() - days * 86400000
    );
    const dealsPerWeek = Math.round((closedInPeriod.length / weeksBack) * 10) / 10;
    const revenuePerWeek = Math.round(closedValue / weeksBack);

    // 6. Storm-sourced leads
    const stormLeads = allLeads.filter((l) => l.source === "canvass_mission" || l.source === "storm_scan");
    const stormLeadRevenue = stormLeads
      .filter((l) => l.status === "closed")
      .reduce((sum, l) => sum + (Number(l.actual_claim) || Number(l.estimated_claim) || 0), 0);

    // 7. Mission stats
    let missionStats = {
      totalMissions: 0,
      activeMissions: 0,
      totalDoorsKnocked: 0,
      totalAppointments: 0,
      appointmentRate: 0,
    };
    try {
      const { data: missions } = await (supabase.from("canvass_missions") as any)
        .select("status, stops_knocked, appointments_set")
        .eq("user_id", user.id)
        .gte("created_at", new Date(Date.now() - days * 86400000).toISOString());

      if (missions && Array.isArray(missions)) {
        const totalKnocked = missions.reduce((s: number, m: any) => s + (m.stops_knocked || 0), 0);
        const totalAppts = missions.reduce((s: number, m: any) => s + (m.appointments_set || 0), 0);
        missionStats = {
          totalMissions: missions.length,
          activeMissions: missions.filter((m: any) => m.status === "in_progress").length,
          totalDoorsKnocked: totalKnocked,
          totalAppointments: totalAppts,
          appointmentRate: totalKnocked > 0 ? Math.round((totalAppts / totalKnocked) * 100) : 0,
        };
      }
    } catch {
      // Table may not exist
    }

    // 8. Opportunity by storm type
    const opportunityByType: Record<string, { count: number; value: number }> = {};
    for (const event of stormEvents) {
      const type = event.event_type || "unknown";
      if (!opportunityByType[type]) {
        opportunityByType[type] = { count: 0, value: 0 };
      }
      opportunityByType[type].count += 1;
      opportunityByType[type].value += Number(event.estimated_opportunity) || 0;
    }

    return NextResponse.json({
      success: true,
      revenue: {
        totalStormOpportunity,
        totalCaptured,
        captureRate: totalStormOpportunity > 0
          ? Math.round((totalCaptured / totalStormOpportunity) * 100)
          : 0,
        unclaimed: totalStormOpportunity - totalCaptured,
        pipelineValue,
        closedValue,
        dealsPerWeek,
        revenuePerWeek,
      },
      storms: {
        totalEvents: stormEvents.length,
        totalEstProperties,
        totalCanvassed,
        canvassRate: totalEstProperties > 0
          ? Math.round((totalCanvassed / totalEstProperties) * 100)
          : 0,
        opportunityByType,
      },
      leads: {
        total: allLeads.length,
        recentNew: recentLeads.length,
        active: activePipeline.length,
        stormSourced: stormLeads.length,
        stormSourcedRevenue: stormLeadRevenue,
      },
      missions: missionStats,
      pipeline: {
        new: pipeline.new.length,
        contacted: pipeline.contacted.length,
        appointmentSet: pipeline.appointmentSet.length,
        inspected: pipeline.inspected.length,
        signed: pipeline.signed.length,
        closed: pipeline.closed.length,
        lost: pipeline.lost.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Storm Revenue Analysis] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate revenue analysis", details: String(error) },
      { status: 500 }
    );
  }
}
