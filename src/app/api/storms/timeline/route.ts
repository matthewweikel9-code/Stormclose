import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getHailReports, getStormReports } from "@/lib/xweather";

/**
 * GET /api/storms/timeline
 * 
 * Returns storm event timeline for the user's territory.
 * Combines cached events from DB with fresh XWeather data.
 * 
 * Query params:
 *   - lat, lng: center point (required)
 *   - days: how far back (default 30)
 *   - radius: radius in miles (default 50)
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
  const radius = parseInt(searchParams.get("radius") || "50");

  if (!lat || !lng) {
    return NextResponse.json({ error: "lat and lng required" }, { status: 400 });
  }

  try {
    // 1. Fetch existing cached events from DB
    let cachedEvents: StormTimelineEvent[] = [];
    try {
      // @ts-expect-error - storm_events_cache not in generated types yet
      const { data: dbEvents, error: rpcError } = await supabase.rpc("get_storm_timeline", {
        p_user_id: user.id,
        p_days_back: days,
        p_limit: 100,
      });
      if (rpcError) {
        console.warn("[Storm Timeline] RPC get_storm_timeline error:", rpcError.message);
      }
      if (dbEvents && Array.isArray(dbEvents)) {
        cachedEvents = dbEvents;
      }
    } catch (rpcErr) {
      console.warn("[Storm Timeline] get_storm_timeline failed:", rpcErr);
    }

    // 2. Fetch fresh reports from XWeather to fill gaps
    const [hailReports, stormReports] = await Promise.all([
      getHailReports(lat, lng, radius, days).catch((e) => {
        console.warn("[Storm Timeline] getHailReports failed:", e instanceof Error ? e.message : e);
        return [];
      }),
      getStormReports(lat, lng, radius, Math.min(days, 7)).catch((e) => {
        console.warn("[Storm Timeline] getStormReports failed:", e instanceof Error ? e.message : e);
        return [];
      }),
    ]);

    // 3. Build set of already-cached xweather IDs
    const cachedIds = new Set(
      cachedEvents
        .filter((e) => e.event_id)
        .map((e) => String(e.event_id))
    );

    // 4. Merge XWeather reports that aren't cached yet
    const newEvents: NewStormEvent[] = [];

    for (const report of hailReports) {
      if (cachedIds.has(report.id)) continue;

      const hailSize = report.report.detail.hailIN || 0;
      const severity = hailSize >= 2.5 ? "extreme" : hailSize >= 1.75 ? "severe" : hailSize >= 1.0 ? "moderate" : "minor";
      const damageScore = Math.min(100, Math.round(hailSize * 35));

      // Estimate affected properties based on hail size
      const impactRadiusMiles = hailSize >= 2 ? 8 : hailSize >= 1 ? 5 : 3;
      const estimatedProperties = Math.round(impactRadiusMiles * impactRadiusMiles * Math.PI * 120); // ~120 homes/sq mi in suburbs
      const avgClaimValue = 12000 + hailSize * 3000;
      const estimatedOpportunity = estimatedProperties * avgClaimValue;

      newEvents.push({
        xweather_id: report.id,
        event_type: "hail",
        severity,
        hail_size_inches: hailSize,
        wind_speed_mph: null,
        damage_score: damageScore,
        latitude: report.loc.lat,
        longitude: report.loc.long,
        location_name: buildTimelineLocation({
          locationName: report.place.name,
          county: report.place.county,
          state: report.place.state,
          lat: report.loc.lat,
          lng: report.loc.long,
        }),
        county: report.place.county || null,
        state: report.place.state || null,
        impact_radius_miles: impactRadiusMiles,
        estimated_properties: estimatedProperties,
        estimated_opportunity: estimatedOpportunity,
        event_occurred_at: report.report.dateTimeISO,
        comments: report.report.comments || null,
        user_id: user.id,
      });
    }

    for (const report of stormReports) {
      if (cachedIds.has(report.id)) continue;
      if (hailReports.some((h) => h.id === report.id)) continue; // Skip duplicates

      const windSpeed = report.report.detail.windSpeedMPH || 0;
      const isWind = report.report.cat === "wind" || windSpeed > 0;
      const isTornado = report.report.cat === "tornado";
      const eventType = isTornado ? "tornado" : isWind ? "wind" : "severe_thunderstorm";
      const severity = isTornado ? "extreme" : windSpeed >= 75 ? "severe" : windSpeed >= 58 ? "moderate" : "minor";
      const damageScore = isTornado ? 95 : Math.min(100, Math.round(windSpeed * 1.2));

      const estimatedProperties = isTornado ? 500 : windSpeed >= 75 ? 2000 : 800;
      const avgClaimValue = isTornado ? 25000 : 8000;
      const estimatedOpportunity = estimatedProperties * avgClaimValue;

      newEvents.push({
        xweather_id: report.id,
        event_type: eventType,
        severity,
        hail_size_inches: report.report.detail.hailIN || null,
        wind_speed_mph: windSpeed || null,
        damage_score: damageScore,
        latitude: report.loc.lat,
        longitude: report.loc.long,
        location_name: buildTimelineLocation({
          locationName: report.place.name,
          county: report.place.county,
          state: report.place.state,
          lat: report.loc.lat,
          lng: report.loc.long,
        }),
        county: report.place.county || null,
        state: report.place.state || null,
        impact_radius_miles: isTornado ? 2 : 5,
        estimated_properties: estimatedProperties,
        estimated_opportunity: estimatedOpportunity,
        event_occurred_at: report.report.dateTimeISO,
        comments: report.report.comments || null,
        user_id: user.id,
      });
    }

    // 5. Cache new events in DB (best-effort, don't fail if table doesn't exist)
    if (newEvents.length > 0) {
      try {
        await (supabase.from("storm_events_cache") as any).upsert(
          newEvents.map((e) => ({
            ...e,
            first_detected_at: new Date().toISOString(),
          })),
          { onConflict: "user_id,xweather_id" }
        );
      } catch {
        // Table may not exist yet — silently skip
      }
    }

    // 6. Combine cached + new into a unified timeline
    const timeline: TimelineEntry[] = [
      ...cachedEvents.map((e) => ({
        id: String(e.event_id),
        type: e.event_type || "hail",
        severity: e.severity || "minor",
        hailSize: Number(e.hail_size) || null,
        windSpeed: e.wind_speed || null,
        damageScore: e.damage_score || 0,
        location: buildTimelineLocation({
          locationName: e.location_name,
          county: e.county,
          state: e.state,
          lat: e.latitude,
          lng: e.longitude,
        }),
        county: e.county || null,
        state: e.state || null,
        lat: e.latitude,
        lng: e.longitude,
        occurredAt: e.event_occurred_at,
        estimatedProperties: e.estimated_properties || 0,
        estimatedOpportunity: Number(e.estimated_opportunity) || 0,
        propertiesCanvassed: e.properties_canvassed || 0,
        leadsGenerated: e.leads_generated || 0,
        appointmentsSet: e.appointments_set || 0,
        revenueCapured: Number(e.revenue_captured) || 0,
        canvassPct: Number(e.canvass_pct) || 0,
        missionCount: Number(e.mission_count) || 0,
        daysAgo: e.days_ago || 0,
        source: "cached" as const,
      })),
      ...newEvents.map((e) => ({
        id: e.xweather_id,
        type: e.event_type,
        severity: e.severity,
        hailSize: e.hail_size_inches,
        windSpeed: e.wind_speed_mph,
        damageScore: e.damage_score,
        location: buildTimelineLocation({
          locationName: e.location_name,
          county: e.county,
          state: e.state,
          lat: e.latitude,
          lng: e.longitude,
        }),
        county: e.county,
        state: e.state,
        lat: e.latitude,
        lng: e.longitude,
        occurredAt: e.event_occurred_at,
        estimatedProperties: e.estimated_properties,
        estimatedOpportunity: e.estimated_opportunity,
        propertiesCanvassed: 0,
        leadsGenerated: 0,
        appointmentsSet: 0,
        revenueCapured: 0,
        canvassPct: 0,
        missionCount: 0,
        daysAgo: Math.floor((Date.now() - new Date(e.event_occurred_at).getTime()) / (1000 * 60 * 60 * 24)),
        source: "live" as const,
      })),
    ];

    // Deduplicate by xweather_id and sort by date
    const seen = new Set<string>();
    const deduped = timeline.filter((entry) => {
      if (seen.has(entry.id)) return false;
      seen.add(entry.id);
      return true;
    });
    deduped.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
    const localized = deduped.filter(
      (entry) => calculateDistanceMiles(lat, lng, entry.lat, entry.lng) <= radius
    );

    // 7. Calculate summary stats
    const totalOpportunity = localized.reduce((sum, e) => sum + (e.estimatedOpportunity || 0), 0);
    const totalCaptured = localized.reduce((sum, e) => sum + (e.revenueCapured || 0), 0);
    const totalProperties = localized.reduce((sum, e) => sum + (e.estimatedProperties || 0), 0);
    const totalCanvassed = localized.reduce((sum, e) => sum + (e.propertiesCanvassed || 0), 0);

    return NextResponse.json({
      success: true,
      timeline: localized.slice(0, 100),
      summary: {
        totalEvents: localized.length,
        totalOpportunity,
        totalCaptured,
        captureRate: totalOpportunity > 0 ? Math.round((totalCaptured / totalOpportunity) * 100) : 0,
        totalProperties,
        totalCanvassed,
        canvassRate: totalProperties > 0 ? Math.round((totalCanvassed / totalProperties) * 100) : 0,
        byType: {
          hail: localized.filter((e) => e.type === "hail").length,
          wind: localized.filter((e) => e.type === "wind").length,
          tornado: localized.filter((e) => e.type === "tornado").length,
          severe: localized.filter((e) => e.type === "severe_thunderstorm").length,
        },
        bySeverity: {
          extreme: localized.filter((e) => e.severity === "extreme").length,
          severe: localized.filter((e) => e.severity === "severe").length,
          moderate: localized.filter((e) => e.severity === "moderate").length,
          minor: localized.filter((e) => e.severity === "minor").length,
        },
      },
      location: { lat, lng, radius },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Storm Timeline] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch storm timeline", details: String(error) },
      { status: 500 }
    );
  }
}

// ─── Types ─────────────────────────────────────────────────────────────────

interface StormTimelineEvent {
  event_id: string;
  event_type: string;
  severity: string;
  hail_size: number | null;
  wind_speed: number | null;
  damage_score: number;
  location_name: string;
  county: string | null;
  state: string | null;
  latitude: number;
  longitude: number;
  event_occurred_at: string;
  estimated_properties: number;
  estimated_opportunity: number;
  properties_canvassed: number;
  leads_generated: number;
  appointments_set: number;
  revenue_captured: number;
  canvass_pct: number;
  mission_count: number;
  days_ago: number;
}

interface NewStormEvent {
  xweather_id: string;
  event_type: string;
  severity: string;
  hail_size_inches: number | null;
  wind_speed_mph: number | null;
  damage_score: number;
  latitude: number;
  longitude: number;
  location_name: string;
  county: string | null;
  state: string | null;
  impact_radius_miles: number;
  estimated_properties: number;
  estimated_opportunity: number;
  event_occurred_at: string;
  comments: string | null;
  user_id: string;
}

interface TimelineEntry {
  id: string;
  type: string;
  severity: string;
  hailSize: number | null;
  windSpeed: number | null;
  damageScore: number;
  location: string;
  county: string | null;
  state: string | null;
  lat: number;
  lng: number;
  occurredAt: string;
  estimatedProperties: number;
  estimatedOpportunity: number;
  propertiesCanvassed: number;
  leadsGenerated: number;
  appointmentsSet: number;
  revenueCapured: number;
  canvassPct: number;
  missionCount: number;
  daysAgo: number;
  source: "cached" | "live";
}

const UNKNOWN_LOCATION_TOKENS = new Set([
  "",
  "unknown",
  "unknown location",
  "n/a",
  "na",
  "null",
  "undefined",
]);

function sanitizeLocationText(value?: string | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (UNKNOWN_LOCATION_TOKENS.has(trimmed.toLowerCase())) return null;
  return trimmed;
}

function formatCoordinateLabel(lat: number, lng: number): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "Location unavailable";
  return `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
}

function normalizeCountyLabel(county: string): string {
  return county.replace(/\s*county$/i, "").trim();
}

function buildTimelineLocation(input: {
  locationName?: string | null;
  county?: string | null;
  state?: string | null;
  lat: number;
  lng: number;
}): string {
  const locationName = sanitizeLocationText(input.locationName);
  const county = sanitizeLocationText(input.county);
  const state = sanitizeLocationText(input.state);

  if (locationName) {
    if (state && !locationName.toLowerCase().includes(state.toLowerCase())) {
      return `${locationName}, ${state}`;
    }
    return locationName;
  }

  if (county && state) {
    return `${normalizeCountyLabel(county)} County, ${state}`;
  }
  if (county) {
    return `${normalizeCountyLabel(county)} County`;
  }
  if (state) {
    return state;
  }

  return formatCoordinateLabel(input.lat, input.lng);
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function calculateDistanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const earthRadiusMiles = 3958.8;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMiles * c;
}
