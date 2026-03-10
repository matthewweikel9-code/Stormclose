import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase admin client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ATTOM API Configuration
const ATTOM_API_KEY = process.env.ATTOM_API_KEY;
const ATTOM_BASE_URL = "https://api.gateway.attomdata.com";

// Helper function to make ATTOM API requests
async function attomRequest(endpoint: string, params?: Record<string, string>): Promise<any> {
  const url = new URL(`${ATTOM_BASE_URL}${endpoint}`);
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }
  
  const response = await fetch(url.toString(), {
    headers: {
      "Accept": "application/json",
      "APIKey": ATTOM_API_KEY || ""
    }
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`ATTOM API error (${response.status}):`, errorText);
    throw new Error(`ATTOM API error: ${response.status}`);
  }
  
  return response.json();
}

// Search properties in a geographic area using ATTOM Property Detail API
async function searchPropertiesByLocation(
  latitude: number, 
  longitude: number, 
  radiusMiles: number = 2
): Promise<any[]> {
  try {
    // ATTOM supports up to 20 mile radius
    const radius = Math.min(radiusMiles, 20);
    
    // Use detailowner endpoint for complete property data including owner info
    const data = await attomRequest("/propertyapi/v1.0.0/property/detailowner", {
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      radius: radius.toString(),
      pagesize: "50",
      // Include all residential property types useful for roofing
      propertytype: "SFR|CONDO|TOWNHOUSE|MOBILE|DUPLEX|TRIPLEX|QUADPLEX"
    });
    
    const properties = data.property || [];
    console.log(`Found ${properties.length} ATTOM properties near ${latitude}, ${longitude}`);
    
    // Transform to common format - use lowercase field names from ATTOM
    return properties.map((prop: any) => {
      const owner = prop.owner || {};
      const ownerName = owner.owner1?.fullname || owner.owner1?.fullName || 
                        owner.owner1?.lastname || owner.owner1?.lastName || 
                        "Unknown";
      
      return {
        address: {
          street: prop.address?.line1 || prop.address?.oneLine || "",
          city: prop.address?.locality || "",
          state: prop.address?.countrySubd || "",
          zip: prop.address?.postal1 || ""
        },
        owner: ownerName,
        ownerMailingAddress: owner.mailingaddressoneline || owner.mailingAddressOneLine || null,
        yearBuilt: prop.summary?.yearbuilt || prop.summary?.yearBuilt || prop.building?.construction?.constructionYear,
        assessedValue: prop.assessment?.assessed?.assdTtlValue || prop.assessment?.market?.mktTtlValue,
        squareFeet: prop.building?.size?.livingsize || prop.building?.size?.livingSize || prop.building?.size?.universalsize || prop.building?.size?.universalSize,
        latitude: prop.location?.latitude || latitude,
        longitude: prop.location?.longitude || longitude,
        propertyType: prop.summary?.proptype || prop.summary?.propType || "R",
        salePrice: prop.sale?.amount?.saleamt || prop.sale?.amount?.saleAmt || null,
        saleDate: prop.sale?.saleTransDate || prop.sale?.salesearchdate || null
      };
    }).filter((p: any) => p.address.street); // Only include properties with addresses
  } catch (error) {
    console.error("ATTOM property search error:", error);
    return [];
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
        // Skip if no properties found - we need real property data
        continue;
      }

      // Process each property from ATTOM (limit to top 10 per event for speed)
      for (const prop of properties.slice(0, 10)) {
        try {
          // Extract property data (already transformed in searchPropertiesByLocation)
          const address = prop.address?.street;
          const city = prop.address?.city;
          const state = prop.address?.state || event.state;
          const zip = prop.address?.zip;
          const lat = prop.latitude || event.latitude;
          const lng = prop.longitude || event.longitude;
          const yearBuilt = prop.yearBuilt;
          const assessedValue = prop.assessedValue;
          const squareFeet = prop.squareFeet;

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

          // Only create leads with score >= 50 (warm or hot)
          if (scoreResult.score < 50) continue;

          // Check if lead already exists (by address + city)
          const { data: existingLead } = await supabaseAdmin
            .from("leads")
            .select("id")
            .eq("address", address)
            .eq("city", city)
            .maybeSingle();

          if (existingLead) continue; // Skip duplicates

          // Get first active user to assign the lead (using 'users' table)
          const { data: firstUser } = await supabaseAdmin
            .from("users")
            .select("id")
            .limit(1)
            .single();

          if (!firstUser) {
            errors.push("No users found to assign leads");
            continue;
          }

          const leadData = {
            user_id: firstUser.id,
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
            notes: `AI-generated: ${event.size_inches}" hail on ${event.event_date}, ${distanceFromStorm.toFixed(1)} mi away. Roof ~${roofAge}yrs old.`,
          };

          const { error: insertError } = await supabaseAdmin
            .from("leads")
            .insert(leadData);

          if (insertError) {
            errors.push(`Insert error for ${address}: ${insertError.message}`);
          } else {
            leadsGenerated++;
            console.log(`Created lead: ${address}, ${city} - Score: ${scoreResult.score}`);
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
