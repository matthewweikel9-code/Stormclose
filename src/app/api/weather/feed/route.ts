import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { 
  getStormFeed, 
  getActiveAlerts, 
  getHailReports,
  getStormCells,
  XweatherAlert,
  XweatherStormReport,
  XweatherStormCell
} from "@/lib/xweather";

/**
 * GET: Fetch live storm data from Xweather for user's territories
 * 
 * Query params:
 * - lat, lng: Center point (optional, uses first territory if not provided)
 * - zip: Zip code to query (alternative to lat/lng)
 * 
 * Returns combined alerts, hail reports, and storm cells
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const zip = searchParams.get("zip");

  try {
    // If no coordinates provided, get from user's first territory
    let centerLat = lat ? parseFloat(lat) : null;
    let centerLng = lng ? parseFloat(lng) : null;

    if (!centerLat || !centerLng) {
      // Get user's territories to find a center point
      const { data: territories } = await supabase
        .from("territories")
        .select("center_lat, center_lng, zip_codes")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .limit(1)
        .single();

      const territory = territories as { center_lat?: number; center_lng?: number } | null;
      if (territory?.center_lat && territory?.center_lng) {
        centerLat = territory.center_lat;
        centerLng = territory.center_lng;
      } else {
        // Default to Dallas, TX if no territory
        centerLat = 32.7767;
        centerLng = -96.7970;
      }
    }

    console.log(`[Weather Feed] Fetching for ${centerLat}, ${centerLng}`);

    // Fetch comprehensive storm data from Xweather
    const stormFeed = await getStormFeed(centerLat!, centerLng!);

    // Transform Xweather alerts to match our existing format
    const transformedAlerts = stormFeed.alerts.map((alert: XweatherAlert) => ({
      id: alert.id,
      alert_type: mapXweatherAlertType(alert.details.type),
      severity: alert.details.emergency ? "extreme" : mapSeverity(alert.details.type),
      headline: alert.details.name,
      description: alert.details.body,
      affected_areas: [alert.place.name, alert.place.state].filter(Boolean),
      onset_at: alert.timestamps.beginsISO,
      expires_at: alert.timestamps.expiresISO,
      issued_at: alert.timestamps.issuedISO,
      affects_user: true, // They're fetching for their area
      source: "xweather"
    }));

    // Transform hail reports to match expected format
    const transformedHailReports = stormFeed.recentHail.map((report: XweatherStormReport) => ({
      id: report.id,
      type: "hail_report",
      location: `${report.place.name}, ${report.place.state}`,
      lat: report.loc.lat,
      lng: report.loc.long,
      hail_size_inches: report.report.detail.hailIN,
      timestamp: report.report.dateTimeISO,
      comments: report.report.comments,
      source: "xweather"
    }));

    // Transform storm cells
    const transformedStormCells = stormFeed.stormCells.map((cell: XweatherStormCell) => ({
      id: cell.id,
      type: "storm_cell",
      location: `${cell.place.name}, ${cell.place.state}`,
      lat: cell.loc.lat,
      lng: cell.loc.long,
      hail_probability: cell.hail.prob,
      hail_size_max: cell.hail.maxSizeIN,
      tornado_probability: cell.tornado.prob,
      is_severe: cell.traits.severe,
      is_rotating: cell.traits.rotating,
      speed_mph: cell.track.speedMPH,
      direction: cell.track.directionDEG,
      timestamp: cell.ob.dateTimeISO,
      source: "xweather"
    }));

    // Combine all alerts - Xweather alerts + hail reports treated as alerts
    const combinedAlerts = [
      ...transformedAlerts,
      // Include severe hail (>1") as alert-style items
      ...transformedHailReports
        .filter((r: { hail_size_inches?: number }) => (r.hail_size_inches || 0) >= 1.0)
        .map((r: { id: string; hail_size_inches?: number; location: string; timestamp: string }) => ({
          id: r.id,
          alert_type: "hail_report",
          severity: (r.hail_size_inches || 0) >= 2.0 ? "severe" : "moderate",
          headline: `${r.hail_size_inches}" Hail Reported`,
          description: `Hail measuring ${r.hail_size_inches} inches reported in ${r.location}`,
          hail_size_inches: r.hail_size_inches,
          onset_at: r.timestamp,
          expires_at: r.timestamp, // Reports don't expire, but we need a value
          issued_at: r.timestamp,
          affects_user: true,
          source: "xweather"
        }))
    ].sort((a, b) => new Date(b.onset_at || '').getTime() - new Date(a.onset_at || '').getTime());

    return NextResponse.json({
      success: true,
      source: "xweather",
      location: { lat: centerLat, lng: centerLng },
      alerts: combinedAlerts,
      hailReports: transformedHailReports,
      stormCells: transformedStormCells,
      summary: stormFeed.summary,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("[Weather Feed] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch weather data", details: String(error) },
      { status: 500 }
    );
  }
}

// Map Xweather alert types to our internal types
function mapXweatherAlertType(type: string): string {
  const typeLower = type.toLowerCase();
  
  if (typeLower.includes("tornado warning")) return "tornado_warning";
  if (typeLower.includes("tornado watch")) return "tornado_watch";
  if (typeLower.includes("severe thunderstorm warning")) return "severe_thunderstorm_warning";
  if (typeLower.includes("severe thunderstorm watch")) return "severe_thunderstorm_watch";
  if (typeLower.includes("flash flood")) return "flash_flood_warning";
  if (typeLower.includes("winter storm")) return "winter_storm_warning";
  if (typeLower.includes("hail")) return "hail_warning";
  
  return "severe_weather";
}

// Map severity from alert type
function mapSeverity(type: string): string {
  const typeLower = type.toLowerCase();
  
  if (typeLower.includes("warning")) return "severe";
  if (typeLower.includes("watch")) return "moderate";
  
  return "minor";
}
