import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getHailReports, formatStormReportToHailEvent } from "@/lib/xweather";
import {
  searchPropertiesInArea,
  getPropertyByLocation,
  CoreLogicProperty,
  calculateRoofAge,
  estimateClaimValue,
} from "@/lib/corelogic";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

// Geocode address/location to coordinates using Google
async function geocodeLocation(location: string): Promise<{ lat: number; lng: number } | null> {
  if (!GOOGLE_MAPS_API_KEY) {
    console.error("Google Maps API key not configured");
    return null;
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${GOOGLE_MAPS_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === "OK" && data.results.length > 0) {
      const { lat, lng } = data.results[0].geometry.location;
      return { lat, lng };
    }

    console.error("Geocoding failed:", data.status);
    return null;
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
}

// Search properties by zip code — geocode then spatial search via CoreLogic
async function searchPropertiesByZip(zipCode: string, limit: number = 20): Promise<CoreLogicProperty[]> {
  try {
    const coords = await geocodeLocation(zipCode);
    if (!coords) {
      console.error(`Failed to geocode zip ${zipCode}`);
      return [];
    }

    const properties = await searchPropertiesInArea(coords.lat, coords.lng, 2);
    console.log(`Found ${properties.length} CoreLogic properties for zip ${zipCode}`);
    return properties.slice(0, limit);
  } catch (error) {
    console.error("CoreLogic property search error:", error);
    return [];
  }
}

// Search properties near coordinates via CoreLogic
async function searchPropertiesByLocation(
  latitude: number,
  longitude: number,
  radiusMiles: number = 2
): Promise<CoreLogicProperty[]> {
  try {
    const properties = await searchPropertiesInArea(latitude, longitude, radiusMiles);
    console.log(`Found ${properties.length} CoreLogic properties near ${latitude}, ${longitude}`);
    return properties;
  } catch (error) {
    console.error("CoreLogic spatial search error:", error);
    return [];
  }
}

// Calculate lead score
function calculateLeadScore(params: {
  hailSize?: number;
  daysSinceStorm?: number;
  roofAge?: number;
  propertyValue?: number;
}): number {
  const { hailSize = 1, daysSinceStorm = 14, roofAge = 15, propertyValue = 200000 } = params;

  let score = 50;

  if (hailSize >= 2.5) score += 25;
  else if (hailSize >= 1.75) score += 20;
  else if (hailSize >= 1.0) score += 15;
  else score += 5;

  if (daysSinceStorm <= 3) score += 20;
  else if (daysSinceStorm <= 7) score += 15;
  else if (daysSinceStorm <= 14) score += 10;
  else if (daysSinceStorm <= 30) score += 5;

  if (roofAge >= 20) score += 15;
  else if (roofAge >= 15) score += 12;
  else if (roofAge >= 10) score += 8;
  else if (roofAge >= 5) score += 4;

  if (propertyValue >= 500000) score += 10;
  else if (propertyValue >= 300000) score += 8;
  else if (propertyValue >= 200000) score += 5;

  return Math.min(100, score);
}

// GET: Fetch leads for a specific territory
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const { data: territory, error: territoryError } = await supabaseAdmin
      .from("territories")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (territoryError || !territory) {
      return NextResponse.json({ error: "Territory not found" }, { status: 404 });
    }

    let leadsQuery = supabaseAdmin
      .from("leads")
      .select("*")
      .order("lead_score", { ascending: false })
      .limit(50);

    if (territory.zip_codes && territory.zip_codes.length > 0) {
      leadsQuery = leadsQuery.in("zip", territory.zip_codes);
    }

    const { data: leads } = await leadsQuery;

    const { data: hailEvents } = await supabaseAdmin
      .from("hail_events")
      .select("*")
      .gte("event_date", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0])
      .order("event_date", { ascending: false })
      .limit(20);

    return NextResponse.json({
      success: true,
      territory,
      leads: leads || [],
      hailEvents: hailEvents || [],
      totalLeads: leads?.length || 0,
    });
  } catch (error) {
    console.error("Territory leads fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST: Generate leads for this territory using CoreLogic
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = user.id;
  const { id } = await params;

  try {
    const { data: territory, error: territoryError } = await supabaseAdmin
      .from("territories")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (territoryError || !territory) {
      return NextResponse.json({ error: "Territory not found" }, { status: 404 });
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    let { data: hailEvents } = await supabaseAdmin
      .from("hail_events")
      .select("*")
      .gte("event_date", thirtyDaysAgo)
      .gte("size_inches", 0.75)
      .order("event_date", { ascending: false })
      .limit(50);

    // If no database hail events and territory has coordinates, check Xweather
    if ((!hailEvents || hailEvents.length === 0) && territory.center_lat && territory.center_lng) {
      try {
        console.log(`Checking Xweather for hail near ${territory.center_lat}, ${territory.center_lng}...`);
        const xweatherReports = await getHailReports(
          territory.center_lat,
          territory.center_lng,
          50,
          30
        );

        if (xweatherReports.length > 0) {
          console.log(`Found ${xweatherReports.length} hail reports from Xweather`);
          hailEvents = xweatherReports.map(report => ({
            id: report.id,
            event_date: report.report.dateTimeISO.split('T')[0],
            size_inches: report.report.detail.hailIN || 0,
            latitude: report.loc.lat,
            longitude: report.loc.long,
            location_name: report.place.name,
            state: report.place.state,
            county: report.place.county,
            source: 'xweather'
          })).filter(e => e.size_inches >= 0.75);
        }
      } catch (xweatherError) {
        console.error("Xweather hail check failed:", xweatherError);
      }
    }

    const hasHailEvents = hailEvents && hailEvents.length > 0;

    let leadsGenerated = 0;
    const errors: string[] = [];

    // Helper to process CoreLogic properties into leads
    async function processProperties(
      properties: CoreLogicProperty[],
      maxCount: number
    ) {
      for (const prop of properties.slice(0, maxCount)) {
        try {
          if (!prop.address || prop.address.length < 5) {
            continue;
          }

          // Check for existing lead
          const { data: existingLead } = await supabaseAdmin
            .from("leads")
            .select("id")
            .eq("address", prop.address)
            .eq("city", prop.city)
            .maybeSingle();

          if (existingLead) {
            console.log(`Lead already exists for ${prop.address}`);
            continue;
          }

          const roofAge = calculateRoofAge(prop);
          const claim = estimateClaimValue(prop);

          let leadScore = 50;

          // Roof age bonus (up to +25)
          if (roofAge >= 20) leadScore += 25;
          else if (roofAge >= 15) leadScore += 20;
          else if (roofAge >= 10) leadScore += 12;
          else if (roofAge >= 5) leadScore += 5;

          // Property value bonus (up to +15)
          const propValue = prop.assessedValue || prop.marketValue || 0;
          if (propValue >= 500000) leadScore += 15;
          else if (propValue >= 300000) leadScore += 10;
          else if (propValue >= 200000) leadScore += 5;

          // Hail event bonus (up to +20)
          let hailEventId = null;
          let stormDate = null;
          let hailSize = null;

          if (hasHailEvents && hailEvents && hailEvents.length > 0) {
            const nearestHail = hailEvents[0];
            hailEventId = nearestHail.id;
            stormDate = nearestHail.event_date;
            hailSize = nearestHail.size_inches;

            if (hailSize >= 2.0) leadScore += 20;
            else if (hailSize >= 1.5) leadScore += 15;
            else if (hailSize >= 1.0) leadScore += 10;
            else leadScore += 5;
          }

          leadScore = Math.min(100, leadScore);
          if (leadScore < 40) continue;

          const leadData = {
            user_id: userId,
            address: prop.address,
            city: prop.city,
            state: prop.state,
            zip: prop.zip,
            latitude: prop.lat,
            longitude: prop.lng,
            year_built: prop.yearBuilt || null,
            square_feet: prop.squareFootage || null,
            assessed_value: propValue || null,
            owner_name: prop.owner,
            lead_score: leadScore,
            storm_proximity_score: hasHailEvents ? Math.min(35, (hailSize || 1) * 10) : 10,
            roof_age_score: Math.min(25, roofAge >= 15 ? 25 : roofAge >= 10 ? 15 : 5),
            property_value_score: Math.min(20, propValue >= 300000 ? 20 : 10),
            hail_history_score: hasHailEvents ? 15 : 5,
            status: "new",
            source: "ai_auto_generated",
            territory_id: territory.id,
            hail_event_id: hailEventId,
            storm_date: stormDate,
            hail_size: hailSize,
            notes: hasHailEvents
              ? `CoreLogic property data. ${hailSize}" hail on ${stormDate}. Roof ~${roofAge} years old.`
              : `CoreLogic property data. Roof ~${roofAge} years old. ${prop.squareFootage ? `${prop.squareFootage} sqft.` : ''}`,
          };

          const { error: insertError } = await supabaseAdmin
            .from("leads")
            .insert(leadData);

          if (insertError) {
            errors.push(`Insert error for ${prop.address}: ${insertError.message}`);
          } else {
            leadsGenerated++;
            console.log(`Created lead: ${prop.address}, ${prop.city} - Score: ${leadScore}`);
          }
        } catch (propError: any) {
          errors.push(`Property error: ${propError.message}`);
        }
      }
    }

    // For each zip code, search CoreLogic for properties
    if (territory.zip_codes && territory.zip_codes.length > 0) {
      for (const zipCode of territory.zip_codes.slice(0, 5)) {
        console.log(`Searching CoreLogic for properties in ${zipCode}...`);
        const properties = await searchPropertiesByZip(zipCode, 15);
        console.log(`Found ${properties.length} CoreLogic properties for zip ${zipCode}`);
        await processProperties(properties, 15);
      }
    }

    // If territory uses radius instead of zip codes
    if ((!territory.zip_codes || territory.zip_codes.length === 0) && territory.center_lat && territory.center_lng) {
      const properties = await searchPropertiesByLocation(
        territory.center_lat,
        territory.center_lng,
        territory.radius_miles || 5
      );
      await processProperties(properties, 20);
    }

    // Update territory lead count
    if (leadsGenerated > 0) {
      await supabaseAdmin
        .from("territories")
        .update({
          total_leads: (territory.total_leads || 0) + leadsGenerated,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
    }

    const hailCount = hailEvents?.length || 0;

    return NextResponse.json({
      success: true,
      message: `Generated ${leadsGenerated} leads from CoreLogic for territory "${territory.name}"${hasHailEvents ? ` (${hailCount} hail events found)` : ''}`,
      leadsGenerated,
      hailEventsFound: hailCount,
      errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
    });
  } catch (error: any) {
    console.error("Territory lead generation error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
