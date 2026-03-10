import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET: Fetch leads near a location
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const lat = parseFloat(searchParams.get("lat") || "0");
  const lng = parseFloat(searchParams.get("lng") || "0");
  const radiusMiles = parseFloat(searchParams.get("radius") || "10");
  const limit = parseInt(searchParams.get("limit") || "25", 10);
  const minScore = parseInt(searchParams.get("minScore") || "0", 10);

  if (!lat || !lng) {
    return NextResponse.json(
      { error: "Latitude and longitude are required" },
      { status: 400 }
    );
  }

  try {
    // Calculate bounding box for initial filter (rough approximation)
    // 1 degree latitude ≈ 69 miles
    // 1 degree longitude ≈ 69 miles * cos(latitude)
    const latDelta = radiusMiles / 69;
    const lngDelta = radiusMiles / (69 * Math.cos((lat * Math.PI) / 180));

    // Query leads within bounding box
    let query = supabaseAdmin
      .from("leads")
      .select("*")
      .gte("latitude", lat - latDelta)
      .lte("latitude", lat + latDelta)
      .gte("longitude", lng - lngDelta)
      .lte("longitude", lng + lngDelta)
      .gte("lead_score", minScore)
      .order("lead_score", { ascending: false })
      .limit(limit * 2); // Get extra to account for filtering

    const { data: leads, error } = await query;

    if (error) {
      console.error("Error fetching nearby leads:", error);
      return NextResponse.json(
        { error: "Failed to fetch nearby leads" },
        { status: 500 }
      );
    }

    // Calculate exact distance and filter
    const leadsWithDistance = (leads || [])
      .map((lead) => {
        const distance = calculateDistance(lat, lng, lead.latitude, lead.longitude);
        return { ...lead, distance_miles: Math.round(distance * 10) / 10 };
      })
      .filter((lead) => lead.distance_miles <= radiusMiles)
      .sort((a, b) => a.distance_miles - b.distance_miles)
      .slice(0, limit);

    return NextResponse.json({
      success: true,
      leads: leadsWithDistance,
      center: { lat, lng },
      radius_miles: radiusMiles,
      total: leadsWithDistance.length,
    });
  } catch (error) {
    console.error("Nearby leads fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Haversine formula for distance calculation
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3958.8; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}
