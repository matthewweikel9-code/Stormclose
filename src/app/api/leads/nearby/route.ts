import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  searchPropertiesInArea,
  CoreLogicProperty,
  calculateRoofAge,
  estimateClaimValue,
} from "@/lib/corelogic";

// GET: Fetch leads near a location using CoreLogic API
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
  const requestedRadiusMiles = parseFloat(searchParams.get("radius") || "5");
  const radiusMiles = Number.isFinite(requestedRadiusMiles)
    ? Math.min(1, Math.max(0.05, requestedRadiusMiles))
    : 1;
  const limit = parseInt(searchParams.get("limit") || "25", 10);
  const minScore = parseInt(searchParams.get("minScore") || "0", 10);

  if (!lat || !lng) {
    return NextResponse.json(
      { error: "Latitude and longitude are required" },
      { status: 400 }
    );
  }

  try {
    if (requestedRadiusMiles !== radiusMiles) {
      console.warn(
        "[Nearby Leads] Radius clamped for CoreLogic API:",
        requestedRadiusMiles,
        "->",
        radiusMiles
      );
    }
    console.log("[Nearby Leads] Searching at:", lat, lng, "radius:", radiusMiles, "miles");

    // Fetch properties from CoreLogic
    const properties = await searchPropertiesInArea(lat, lng, radiusMiles);

    console.log("[Nearby Leads] Found", properties.length, "properties from CoreLogic");

    // Format properties as leads
    let leads = properties.map((prop) => formatPropertyToLead(prop, lat, lng));

    // Filter by minimum score
    if (minScore > 0) {
      leads = leads.filter((lead) => lead.lead_score >= minScore);
    }

    // Sort by distance and limit
    leads = leads
      .filter((lead) => lead.distance_miles !== null)
      .sort((a, b) => (a.distance_miles || 999) - (b.distance_miles || 999))
      .slice(0, limit);

    return NextResponse.json({
      success: true,
      leads: leads,
      center: { lat, lng },
      radius_miles: radiusMiles,
      requested_radius_miles: requestedRadiusMiles,
      total: leads.length,
    });
  } catch (error) {
    console.error("Nearby leads fetch error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// ─── Lead formatting ───────────────────────────────────────────────────────

function formatPropertyToLead(prop: CoreLogicProperty, centerLat: number, centerLng: number) {
  const roofAge = calculateRoofAge(prop);
  const claim = estimateClaimValue(prop);

  // Calculate distance from center
  const distance =
    prop.lat && prop.lng
      ? calculateDistance(centerLat, centerLng, prop.lat, prop.lng)
      : null;

  // Score based on roof age — older roofs = higher score
  let leadScore = 50;
  if (roofAge >= 20) leadScore = 95;
  else if (roofAge >= 15) leadScore = 85;
  else if (roofAge >= 10) leadScore = 70;
  else if (roofAge >= 5) leadScore = 55;
  else leadScore = 40;

  return {
    id: prop.id,
    address: `${prop.address}, ${prop.city}, ${prop.state} ${prop.zip}`.trim(),
    street: prop.address,
    city: prop.city,
    state: prop.state,
    zip: prop.zip,
    owner_name: prop.owner,
    mailing_address: null,
    latitude: prop.lat,
    longitude: prop.lng,
    distance_miles: distance ? Math.round(distance * 10) / 10 : null,
    property_type: prop.propertyType || "Residential",
    year_built: prop.yearBuilt || null,
    sqft: prop.squareFootage || null,
    bedrooms: prop.bedrooms || null,
    bathrooms: prop.bathrooms || null,
    lot_size: prop.lotSize || null,
    roof_type: prop.roofType || null,
    estimated_roof_age: roofAge,
    lead_score: leadScore,
    score: leadScore,
    estimated_profit: claim.total,
    source: "CoreLogic-Nearby",
  };
}

// ─── Distance helpers ──────────────────────────────────────────────────────

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
