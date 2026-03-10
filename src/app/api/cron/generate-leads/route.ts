import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase admin client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CORELOGIC_API_KEY = process.env.CORELOGIC_API_KEY;
const CORELOGIC_API_SECRET = process.env.CORELOGIC_API_SECRET;
const CORELOGIC_BASE_URL = "https://api-prod.corelogic.com";

// Token cache
let accessToken: string | null = null;
let tokenExpiry: number = 0;

// Get CoreLogic OAuth token
async function getCoreLogicToken(): Promise<string | null> {
  if (accessToken && Date.now() < tokenExpiry - 60000) {
    return accessToken;
  }

  try {
    const credentials = Buffer.from(`${CORELOGIC_API_KEY}:${CORELOGIC_API_SECRET}`).toString("base64");
    
    const response = await fetch(`${CORELOGIC_BASE_URL}/oauth/token?grant_type=client_credentials`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Length": "0"
      }
    });

    if (!response.ok) {
      console.error("CoreLogic OAuth error:", await response.text());
      return null;
    }

    const data = await response.json();
    accessToken = data.access_token;
    tokenExpiry = Date.now() + (parseInt(data.expires_in) * 1000);
    return accessToken;
  } catch (error) {
    console.error("CoreLogic OAuth error:", error);
    return null;
  }
}

// Search properties in a geographic area
async function searchPropertiesByLocation(
  latitude: number, 
  longitude: number, 
  radiusMiles: number = 2
): Promise<any[]> {
  const token = await getCoreLogicToken();
  if (!token) return [];

  try {
    // Convert radius to bounding box (approximate)
    const latDelta = radiusMiles / 69; // ~69 miles per degree latitude
    const lngDelta = radiusMiles / (69 * Math.cos(latitude * Math.PI / 180));
    
    const minLat = latitude - latDelta;
    const maxLat = latitude + latDelta;
    const minLng = longitude - lngDelta;
    const maxLng = longitude + lngDelta;

    // Use CoreLogic Property API with geographic bounds
    const url = new URL(`${CORELOGIC_BASE_URL}/property`);
    url.searchParams.append("latitude", latitude.toString());
    url.searchParams.append("longitude", longitude.toString());
    url.searchParams.append("radius", radiusMiles.toString());
    url.searchParams.append("pageSize", "50");

    const response = await fetch(url.toString(), {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/vnd.corelogic.v1+json",
        "Accept": "application/json"
      }
    });

    if (!response.ok) {
      // Try alternative endpoint for area search
      const geoUrl = new URL(`${CORELOGIC_BASE_URL}/property/geo`);
      geoUrl.searchParams.append("minLat", minLat.toString());
      geoUrl.searchParams.append("maxLat", maxLat.toString());
      geoUrl.searchParams.append("minLng", minLng.toString());
      geoUrl.searchParams.append("maxLng", maxLng.toString());
      geoUrl.searchParams.append("pageSize", "50");
      
      const geoResponse = await fetch(geoUrl.toString(), {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/vnd.corelogic.v1+json",
          "Accept": "application/json"
        }
      });
      
      if (!geoResponse.ok) {
        console.error("CoreLogic geo search error:", await geoResponse.text());
        return [];
      }
      
      const geoData = await geoResponse.json();
      return geoData.data || geoData.properties || [];
    }

    const data = await response.json();
    return data.data || data.properties || [];
  } catch (error) {
    console.error("CoreLogic property search error:", error);
    return [];
  }
}

// Get property details including building info
async function getPropertyDetails(propertyId: string): Promise<any> {
  const token = await getCoreLogicToken();
  if (!token) return null;

  try {
    const response = await fetch(`${CORELOGIC_BASE_URL}/property/${encodeURIComponent(propertyId)}/building`, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/vnd.corelogic.v1+json",
        "Accept": "application/json"
      }
    });

    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error("Property details error:", error);
    return null;
  }
}

// Calculate lead score based on all factors
function calculateLeadScore(params: {
  hailSize: number;
  daysSinceStorm: number;
  distanceFromStorm: number;
  roofAge: number;
  propertyValue: number;
  hailHistoryCount: number;
}): { score: number; tier: 'hot' | 'warm' | 'cold'; breakdown: any } {
  const { hailSize, daysSinceStorm, distanceFromStorm, roofAge, propertyValue, hailHistoryCount } = params;
  
  // Storm proximity score (0-35 points)
  let stormScore = 0;
  if (distanceFromStorm < 1 && daysSinceStorm <= 7) stormScore = 35;
  else if (distanceFromStorm < 2 && daysSinceStorm <= 7) stormScore = 30;
  else if (distanceFromStorm < 3 && daysSinceStorm <= 14) stormScore = 25;
  else if (distanceFromStorm < 5 && daysSinceStorm <= 14) stormScore = 20;
  else if (distanceFromStorm < 5 && daysSinceStorm <= 30) stormScore = 15;
  else if (distanceFromStorm < 10 && daysSinceStorm <= 30) stormScore = 10;
  
  // Bonus for large hail (golf ball = 1.75", baseball = 2.75")
  if (hailSize >= 2.5) stormScore = Math.min(stormScore + 10, 35);
  else if (hailSize >= 1.75) stormScore = Math.min(stormScore + 5, 35);
  
  // Roof age score (0-25 points) - older roofs more likely to need replacement
  let roofAgeScore = 0;
  if (roofAge >= 20) roofAgeScore = 25;
  else if (roofAge >= 15) roofAgeScore = 20;
  else if (roofAge >= 12) roofAgeScore = 15;
  else if (roofAge >= 8) roofAgeScore = 10;
  else if (roofAge >= 5) roofAgeScore = 5;
  
  // Property value score (0-20 points) - higher value = bigger job
  let valueScore = 0;
  if (propertyValue >= 500000) valueScore = 20;
  else if (propertyValue >= 350000) valueScore = 16;
  else if (propertyValue >= 250000) valueScore = 12;
  else if (propertyValue >= 150000) valueScore = 8;
  else if (propertyValue >= 100000) valueScore = 5;
  
  // Hail history score (0-20 points) - repeat storm areas
  let historyScore = 0;
  if (hailHistoryCount >= 5) historyScore = 20;
  else if (hailHistoryCount >= 3) historyScore = 15;
  else if (hailHistoryCount >= 2) historyScore = 10;
  else if (hailHistoryCount >= 1) historyScore = 5;
  
  const totalScore = Math.min(stormScore + roofAgeScore + valueScore + historyScore, 100);
  
  let tier: 'hot' | 'warm' | 'cold' = 'cold';
  if (totalScore >= 70) tier = 'hot';
  else if (totalScore >= 45) tier = 'warm';
  
  return {
    score: totalScore,
    tier,
    breakdown: {
      stormProximity: stormScore,
      roofAge: roofAgeScore,
      propertyValue: valueScore,
      hailHistory: historyScore
    }
  };
}

// Main function: Find hot leads from recent hail events
async function generateLeadsFromHailEvents(): Promise<{
  leadsGenerated: number;
  eventsProcessed: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let leadsGenerated = 0;
  let eventsProcessed = 0;

  try {
    // Get recent hail events (last 14 days, size >= 1 inch)
    const { data: recentHailEvents, error: hailError } = await supabaseAdmin
      .from("hail_events")
      .select("*")
      .gte("event_date", new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .gte("size_inches", 1.0)
      .order("event_date", { ascending: false })
      .limit(50);

    if (hailError) {
      errors.push(`Hail events query error: ${hailError.message}`);
      return { leadsGenerated: 0, eventsProcessed: 0, errors };
    }

    if (!recentHailEvents || recentHailEvents.length === 0) {
      return { leadsGenerated: 0, eventsProcessed: 0, errors: ["No recent hail events found"] };
    }

    console.log(`Processing ${recentHailEvents.length} recent hail events`);

    // Group events by approximate location to avoid duplicate searches
    const processedLocations = new Set<string>();
    
    for (const event of recentHailEvents) {
      const locationKey = `${event.latitude.toFixed(2)},${event.longitude.toFixed(2)}`;
      
      if (processedLocations.has(locationKey)) {
        continue; // Skip duplicate locations
      }
      processedLocations.add(locationKey);
      eventsProcessed++;

      const daysSinceStorm = Math.floor(
        (Date.now() - new Date(event.event_date).getTime()) / (1000 * 60 * 60 * 24)
      );

      // Get hail history for this area (5 year lookback)
      const { count: hailHistoryCount } = await supabaseAdmin
        .from("hail_events")
        .select("*", { count: "exact", head: true })
        .gte("event_date", new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .gte("latitude", event.latitude - 0.05)
        .lte("latitude", event.latitude + 0.05)
        .gte("longitude", event.longitude - 0.05)
        .lte("longitude", event.longitude + 0.05);

      // Search for properties near this hail event
      const properties = await searchPropertiesByLocation(event.latitude, event.longitude, 3);
      
      if (properties.length === 0) {
        // If CoreLogic doesn't return data, create synthetic leads from the hail event location
        // This ensures salespeople always have leads to work
        const syntheticLead = {
          address: `Near ${event.location_name || 'Storm Location'}`,
          city: event.location_name || "Storm Area",
          state: event.state,
          zip: null,
          latitude: event.latitude,
          longitude: event.longitude,
          year_built: null,
          assessed_value: null,
          lead_score: calculateLeadScore({
            hailSize: event.size_inches,
            daysSinceStorm,
            distanceFromStorm: 0,
            roofAge: 15, // Assume average
            propertyValue: 250000, // Assume average
            hailHistoryCount: hailHistoryCount || 0
          }).score,
          status: "new",
          source: "hail_event_auto",
          hail_event_id: event.id,
          storm_date: event.event_date,
          hail_size: event.size_inches,
          notes: `Auto-generated from ${event.size_inches}" hail event on ${event.event_date}. Search this area for damaged roofs.`,
          is_area_lead: true, // Flag as area-based lead
        };
        
        // Insert the area lead for all active users (or a default system user)
        const { data: activeUsers } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .limit(10);
        
        if (activeUsers && activeUsers.length > 0) {
          for (const user of activeUsers) {
            // Check if this lead already exists for this user
            const { data: existing } = await supabaseAdmin
              .from("leads")
              .select("id")
              .eq("user_id", user.id)
              .eq("hail_event_id", event.id)
              .single();
            
            if (!existing) {
              const { error: insertError } = await supabaseAdmin
                .from("leads")
                .insert({ ...syntheticLead, user_id: user.id });
              
              if (!insertError) {
                leadsGenerated++;
              }
            }
          }
        }
        continue;
      }

      // Process each property from CoreLogic
      for (const prop of properties.slice(0, 20)) { // Limit to 20 per event
        try {
          // Extract property data
          const address = prop.address?.street || prop.streetAddress || prop.addr;
          const city = prop.address?.city || prop.city;
          const state = prop.address?.state || prop.state || event.state;
          const zip = prop.address?.zip || prop.zip;
          const lat = prop.location?.latitude || prop.latitude || event.latitude;
          const lng = prop.location?.longitude || prop.longitude || event.longitude;
          const yearBuilt = prop.building?.yearBuilt || prop.yearBuilt;
          const assessedValue = prop.assessment?.totalValue || prop.assessedValue || prop.marketValue;
          const squareFeet = prop.building?.squareFeet || prop.squareFeet;

          if (!address) continue;

          // Calculate distance from storm
          const distanceFromStorm = Math.sqrt(
            Math.pow((lat - event.latitude) * 69, 2) + 
            Math.pow((lng - event.longitude) * 69 * Math.cos(lat * Math.PI / 180), 2)
          );

          // Calculate roof age
          const currentYear = new Date().getFullYear();
          const roofAge = yearBuilt ? currentYear - yearBuilt : 15; // Default 15 years if unknown

          // Calculate lead score
          const scoreResult = calculateLeadScore({
            hailSize: event.size_inches,
            daysSinceStorm,
            distanceFromStorm,
            roofAge,
            propertyValue: assessedValue || 200000,
            hailHistoryCount: hailHistoryCount || 0
          });

          // Only create leads with score >= 45 (warm or hot)
          if (scoreResult.score < 45) continue;

          // Get all active users to assign leads
          const { data: activeUsers } = await supabaseAdmin
            .from("profiles")
            .select("id")
            .limit(10);

          if (!activeUsers || activeUsers.length === 0) continue;

          // Check if lead already exists (by address)
          const { data: existingLead } = await supabaseAdmin
            .from("leads")
            .select("id")
            .eq("address", address)
            .eq("city", city)
            .single();

          if (existingLead) continue; // Skip duplicates

          // Create lead for each active user
          for (const user of activeUsers) {
            const leadData = {
              user_id: user.id,
              address,
              city,
              state,
              zip,
              latitude: lat,
              longitude: lng,
              year_built: yearBuilt,
              square_feet: squareFeet,
              assessed_value: assessedValue,
              lead_score: scoreResult.score,
              storm_proximity_score: scoreResult.breakdown.stormProximity,
              roof_age_score: scoreResult.breakdown.roofAge,
              property_value_score: scoreResult.breakdown.propertyValue,
              hail_history_score: scoreResult.breakdown.hailHistory,
              status: "new",
              source: "ai_auto_generated",
              hail_event_id: event.id,
              storm_date: event.event_date,
              hail_size: event.size_inches,
              notes: `AI-generated: ${event.size_inches}" hail on ${event.event_date}, ${distanceFromStorm.toFixed(1)} miles away. Roof age: ~${roofAge} years.`,
            };

            const { error: insertError } = await supabaseAdmin
              .from("leads")
              .insert(leadData);

            if (insertError) {
              errors.push(`Insert error for ${address}: ${insertError.message}`);
            } else {
              leadsGenerated++;
            }
          }
        } catch (propError: any) {
          errors.push(`Property processing error: ${propError.message}`);
        }
      }
    }

    return { leadsGenerated, eventsProcessed, errors };
  } catch (error: any) {
    errors.push(`General error: ${error.message}`);
    return { leadsGenerated: 0, eventsProcessed: 0, errors };
  }
}

// Cron endpoint - runs daily at 7 AM UTC (2 AM EST)
export async function GET(request: NextRequest) {
  // Verify cron secret for security
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // Allow in development or if no secret set
    if (process.env.NODE_ENV === "production" && cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  console.log("Starting AI lead generation...");
  const startTime = Date.now();

  try {
    const result = await generateLeadsFromHailEvents();
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`Lead generation complete: ${result.leadsGenerated} leads from ${result.eventsProcessed} events in ${duration}s`);
    
    return NextResponse.json({
      success: true,
      message: `Generated ${result.leadsGenerated} leads from ${result.eventsProcessed} hail events`,
      leadsGenerated: result.leadsGenerated,
      eventsProcessed: result.eventsProcessed,
      duration: `${duration}s`,
      errors: result.errors.length > 0 ? result.errors.slice(0, 10) : undefined
    });
  } catch (error: any) {
    console.error("Lead generation error:", error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

// POST endpoint for manual trigger
export async function POST(request: NextRequest) {
  return GET(request);
}
