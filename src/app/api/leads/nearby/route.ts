import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ATTOM API Configuration
const ATTOM_API_KEY = process.env.ATTOM_API_KEY;
const ATTOM_BASE_URL = "https://api.gateway.attomdata.com";

// Helper to make ATTOM API calls
async function attomRequest(endpoint: string, params?: Record<string, string>): Promise<any> {
  if (!ATTOM_API_KEY) {
    throw new Error("ATTOM API key not configured");
  }

  const url = new URL(`${ATTOM_BASE_URL}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }

  console.log("[ATTOM Nearby] Request:", url.pathname + url.search);

  const response = await fetch(url.toString(), {
    headers: {
      "APIKey": ATTOM_API_KEY,
      "Accept": "application/json"
    }
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("[ATTOM Nearby] API error:", response.status, error);
    throw new Error(`ATTOM API error: ${response.status} - ${error}`);
  }

  return response.json();
}

// Format ATTOM property to lead format
function formatPropertyToLead(prop: any, centerLat: number, centerLng: number) {
  const address = prop.address || {};
  const location = prop.location || {};
  const summary = prop.summary || {};
  const building = prop.building || {};
  const lot = prop.lot || {};
  const identifier = prop.identifier || {};
  const size = building.size || {};
  const rooms = building.rooms || {};
  const construction = building.construction || {};
  
  const sqft = size.livingsize || size.livingSize || size.universalsize || size.universalSize || null;
  const yearBuilt = summary.yearbuilt || summary.yearBuilt || null;
  
  // Parse owner info
  const owner = prop.owner || {};
  const ownerName = owner.owner1?.fullname || owner.owner1?.fullName || 
                   owner.owner1?.lastname || owner.owner1?.lastName || 
                   owner.absenteeOwnerStatus || "Unknown";
  const mailingAddress = owner.mailingaddressoneline || owner.mailingAddressOneLine || 
                        owner.mailAddress?.oneLine || null;
  
  const propLat = location.latitude || null;
  const propLng = location.longitude || null;
  
  // Calculate distance
  const distance = propLat && propLng 
    ? calculateDistance(centerLat, centerLng, propLat, propLng) 
    : null;
  
  // Calculate lead score based on roof age
  const currentYear = new Date().getFullYear();
  const propertyAge = yearBuilt ? currentYear - yearBuilt : null;
  let estimatedRoofAge = propertyAge ? (propertyAge > 25 ? propertyAge % 22 : propertyAge) : null;
  
  // Score based on roof age - older roofs = higher score
  let leadScore = 50; // Base score
  if (estimatedRoofAge !== null) {
    if (estimatedRoofAge >= 20) leadScore = 95;
    else if (estimatedRoofAge >= 15) leadScore = 85;
    else if (estimatedRoofAge >= 10) leadScore = 70;
    else if (estimatedRoofAge >= 5) leadScore = 55;
    else leadScore = 40;
  }
  
  // Estimate claim value
  const stories = building.summary?.stories || 1;
  let roofArea = sqft ? (sqft / stories) * 1.15 : 2000 * 1.15;
  const estimatedProfit = Math.round(roofArea * 7.5);
  
  return {
    id: identifier.attomId || identifier.Id || `attom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    address: `${address.line1 || address.oneLine || ""}, ${address.locality || ""}, ${address.countrySubd || ""} ${address.postal1 || ""}`.trim(),
    street: address.line1 || address.oneLine || "",
    city: address.locality || "",
    state: address.countrySubd || "",
    zip: address.postal1 || "",
    owner_name: ownerName,
    mailing_address: mailingAddress,
    latitude: propLat,
    longitude: propLng,
    distance_miles: distance ? Math.round(distance * 10) / 10 : null,
    property_type: summary.propType || summary.proptype || "Residential",
    year_built: yearBuilt,
    sqft: sqft,
    bedrooms: rooms.beds || null,
    bathrooms: rooms.bathstotal || rooms.bathsTotal || null,
    lot_size: lot.lotSize1 || lot.lotsize1 || null,
    roof_type: construction.roofcover || construction.roofCover || null,
    estimated_roof_age: estimatedRoofAge,
    lead_score: leadScore,
    score: leadScore,
    estimated_profit: estimatedProfit,
    source: "ATTOM-Nearby"
  };
}

// GET: Fetch leads near a location using ATTOM API
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
  const radiusMiles = parseFloat(searchParams.get("radius") || "5");
  const limit = parseInt(searchParams.get("limit") || "25", 10);
  const minScore = parseInt(searchParams.get("minScore") || "0", 10);

  if (!lat || !lng) {
    return NextResponse.json(
      { error: "Latitude and longitude are required" },
      { status: 400 }
    );
  }

  try {
    // ATTOM API has max radius of 20 miles
    const attomRadius = Math.min(radiusMiles, 20);
    
    const queryParams: Record<string, string> = {
      latitude: lat.toString(),
      longitude: lng.toString(),
      radius: attomRadius.toString(),
      pageSize: Math.min(limit * 2, 100).toString(), // Get extra for filtering
      page: "1",
      orderBy: "distance asc",
      // Include all residential property types useful for roofing
      propertytype: "SFR|CONDO|TOWNHOUSE|MOBILE|DUPLEX|TRIPLEX|QUADPLEX"
    };

    console.log("[ATTOM Nearby] Searching with params:", JSON.stringify(queryParams));
    
    const data = await attomRequest("/propertyapi/v1.0.0/property/detailowner", queryParams);
    
    const properties = data?.property || [];
    console.log("[ATTOM Nearby] Found", properties.length, "properties");

    // Filter to residential properties only (propIndicator: 10=SFR, 11=Condo, 22=Duplex/Multi)
    const residentialIndicators = [10, 11, 22];
    const residentialProperties = properties.filter((prop: any) => {
      const indicator = prop.summary?.propIndicator || prop.summary?.propindicator;
      const propType = (prop.summary?.propType || prop.summary?.proptype || "").toLowerCase();
      const address = prop.address?.line1 || prop.address?.oneLine || "";
      
      // Must have an actual street address
      if (!address || address.length < 5) return false;
      
      // Filter by property indicator if available
      if (indicator !== undefined && indicator !== null) {
        return residentialIndicators.includes(Number(indicator));
      }
      
      // Fallback: filter by property type string
      return propType.includes("sfr") || propType.includes("single") || 
             propType.includes("condo") || propType.includes("town") || 
             propType.includes("residential") || propType.includes("duplex");
    });

    console.log("[ATTOM Nearby] After residential filter:", residentialProperties.length, "properties");

    // Format properties as leads
    let leads = residentialProperties.map((prop: any) => formatPropertyToLead(prop, lat, lng));
    
    // Filter by minimum score
    if (minScore > 0) {
      leads = leads.filter((lead: any) => lead.lead_score >= minScore);
    }
    
    // Sort by distance and limit
    leads = leads
      .filter((lead: any) => lead.distance_miles !== null)
      .sort((a: any, b: any) => (a.distance_miles || 999) - (b.distance_miles || 999))
      .slice(0, limit);

    return NextResponse.json({
      success: true,
      leads: leads,
      center: { lat, lng },
      radius_miles: radiusMiles,
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
