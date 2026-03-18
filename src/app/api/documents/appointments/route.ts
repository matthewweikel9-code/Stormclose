import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/documents/appointments
 * Returns mission stops with appointment_set or inspection_set for the current user.
 * These are roofs from Storm Ops that the user has set appointments on.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: stops, error } = await (supabase as any)
      .from("mission_stops")
      .select("id, mission_id, address, city, state, zip, latitude, longitude, homeowner_name, owner_name, lead_id, outcome, completed_at, updated_at")
      .eq("user_id", user.id)
      .in("outcome", ["appointment_set", "inspection_set"])
      .order("updated_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Appointments fetch error:", error);
      return NextResponse.json({ error: "Failed to fetch appointments" }, { status: 500 });
    }

    const missionIds = [...new Set((stops || []).map((s: any) => s.mission_id).filter(Boolean))];
    const missionNames: Record<string, string> = {};
    if (missionIds.length > 0) {
      const { data: missions } = await (supabase as any)
        .from("canvass_missions")
        .select("id, name")
        .in("id", missionIds);
      (missions || []).forEach((m: any) => { missionNames[m.id] = m.name ?? "Mission"; });
    }

    const leadIds = (stops || []).map((s: any) => s.lead_id).filter(Boolean);
    const exportedLeadIds = new Set<string>();
    if (leadIds.length > 0) {
      const { data: exports } = await (supabase as any)
        .from("lead_exports")
        .select("lead_id")
        .in("lead_id", leadIds)
        .eq("destination", "jobnimbus");
      (exports || []).forEach((e: any) => exportedLeadIds.add(e.lead_id));
    }

    const appointments = (stops || []).map((s: any) => ({
      id: s.id,
      mission_id: s.mission_id,
      mission_name: missionNames[s.mission_id] ?? "Mission",
      address: s.address || "Unknown",
      city: s.city ?? "",
      state: s.state ?? "",
      zip: s.zip ?? "",
      latitude: s.latitude,
      longitude: s.longitude,
      homeowner_name: s.homeowner_name ?? s.owner_name ?? null,
      lead_id: s.lead_id,
      outcome: s.outcome,
      completed_at: s.completed_at,
      updated_at: s.updated_at,
      exported_to_jobnimbus: s.lead_id ? exportedLeadIds.has(s.lead_id) : false,
    }));

    return NextResponse.json({ appointments });
  } catch (err) {
    console.error("Appointments API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
