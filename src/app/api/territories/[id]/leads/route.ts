import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getHailReports, formatStormReportToHailEvent } from "@/lib/xweather";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ATTOM API Configuration
const ATTOM_API_KEY = process.env.ATTOM_API_KEY;
const ATTOM_BASE_URL = "https://api.gateway.attomdata.com";
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

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

// Search properties by zip code using ATTOM - geocode then spatial search
async function searchPropertiesByZip(zipCode: string, limit: number = 20): Promise<any[]> {
  try {
    // First geocode the zip code to get coordinates
    const coords = await geocodeLocation(zipCode);
    if (!coords) {
      console.error(`Failed to geocode zip ${zipCode}`);
      return [];
    }
    
    // Use ATTOM detailowner endpoint for complete property data including owner
    const data = await attomRequest("/propertyapi/v1.0.0/property/detailowner", {
      latitude: coords.lat.toString(),
      longitude: coords.lng.toString(),
      radius: "2", // 2 mile radius
      pagesize: limit.toString(),
      // Include all residential property types useful for roofing
      propertytype: "SFR|CONDO|TOWNHOUSE|MOBILE|DUPLEX|TRIPLEX|QUADPLEX"
    });
    
    const properties = data.property || [];
    console.log(`Found ${properties.length} ATTOM properties for zip ${zipCode}`);
    return properties;
  } catch (error) {
    console.error("ATTOM property search error:", error);
    return [];
  }
}

// Search properties near coordinates using ATTOM Detail API
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
    return properties;
  } catch (error) {
    console.error("ATTOM spatial search error:", error);
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
  
  // Hail size bonus (up to +25)
  if (hailSize >= 2.5) score += 25;
  else if (hailSize >= 1.75) score += 20;
  else if (hailSize >= 1.0) score += 15;
  else score += 5;
  
  // Recency bonus (up to +20)
  if (daysSinceStorm <= 3) score += 20;
  else if (daysSinceStorm <= 7) score += 15;
  else if (daysSinceStorm <= 14) score += 10;
  else if (daysSinceStorm <= 30) score += 5;
  
  // Roof age bonus (up to +15)
  if (roofAge >= 20) score += 15;
  else if (roofAge >= 15) score += 12;
  else if (roofAge >= 10) score += 8;
  else if (roofAge >= 5) score += 4;
  
  // Property value bonus (up to +10)
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

    // Fetch existing leads for this territory's zips
    let leadsQuery = supabaseAdmin
      .from("leads")
      .select("*")
      .order("lead_score", { ascending: false })
      .limit(50);

    if (territory.zip_codes && territory.zip_codes.length > 0) {
      leadsQuery = leadsQuery.in("zip", territory.zip_codes);
    }

    const { data: leads } = await leadsQuery;

    // Fetch recent hail events
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

// POST: Generate leads for this territory using ATTOM
export async function POST(
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
    // Get the territory
    const { data: territory, error: territoryError } = await supabaseAdmin
      .from("territories")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (territoryError || !territory) {
      return NextResponse.json({ error: "Territory not found" }, { status: 404 });
    }

    // Check for recent hail events from database (optional - adds bonus scoring)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    
    let { data: hailEvents } = await supabaseAdmin
      .from("hail_events")
      .select("*")
      .gte("event_date", thirtyDaysAgo)
      .gte("size_inches", 0.75)
      .order("event_date", { ascending: false })
      .limit(50);

    // If no database hail events and territory has coordinates, check Xweather for real-time data
    if ((!hailEvents || hailEvents.length === 0) && territory.center_lat && territory.center_lng) {
      try {
        console.log(`Checking Xweather for hail near ${territory.center_lat}, ${territory.center_lng}...`);
        const xweatherReports = await getHailReports(
          territory.center_lat, 
          territory.center_lng, 
          50, // 50 mile radius
          30  // Last 30 days
        );
        
        if (xweatherReports.length > 0) {
          console.log(`Found ${xweatherReports.length} hail reports from Xweather`);
          // Convert Xweather reports to hail_events format
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
        // Continue without Xweather data
      }
    }

    // Hail events are now OPTIONAL - we still generate leads without them
    const hasHailEvents = hailEvents && hailEvents.length > 0;

    let leadsGenerated = 0;
    const errors: string[] = [];

    // For each zip code in the territory, search ATTOM for properties
    if (territory.zip_codes && territory.zip_codes.length > 0) {
      for (const zipCode of territory.zip_codes.slice(0, 5)) { // Process up to 5 zips
        console.log(`Searching ATTOM for properties in ${zipCode}...`);
        
        // Get properties from ATTOM
        const properties = await searchPropertiesByZip(zipCode, 15);
        
        console.log(`Found ${properties.length} ATTOM properties for zip ${zipCode}`);

        // Process each property
        for (const prop of properties.slice(0, 15)) {
          try {
            // Extract property data from ATTOM response
            const address = prop.address?.line1 || prop.address?.oneLine || "";
            const city = prop.address?.locality || "";
            const state = prop.address?.countrySubd || "TX";
            const zip = prop.address?.postal1 || zipCode;
            const lat = prop.location?.latitude || 0;
            const lng = prop.location?.longitude || 0;
            const yearBuilt = prop.summary?.yearbuilt || prop.summary?.yearBuilt || prop.building?.construction?.constructionYear;
            const assessedValue = prop.assessment?.assessed?.assdTtlValue || prop.assessment?.market?.mktTtlValue;
            const squareFeet = prop.building?.size?.livingsize || prop.building?.size?.livingSize || prop.building?.size?.universalsize || prop.building?.size?.universalSize;
            
            // Parse owner info - ATTOM uses lowercase field names
            const owner = prop.owner || {};
            const ownerName = owner.owner1?.fullname || owner.owner1?.fullName || 
                              owner.owner1?.lastname || owner.owner1?.lastName || 
                              "";
            const ownerMailingAddress = owner.mailingaddressoneline || owner.mailingAddressOneLine || null;
            
            // Parse sale info
            const salePrice = prop.sale?.amount?.saleamt || prop.sale?.amount?.saleAmt || null;
            const saleDate = prop.sale?.saleTransDate || prop.sale?.salesearchdate || null;

            if (!address) {
              console.log("Skipping property without address");
              continue;
            }

            // Check for existing lead
            const { data: existingLead } = await supabaseAdmin
              .from("leads")
              .select("id")
              .eq("address", address)
              .eq("city", city)
              .maybeSingle();

            if (existingLead) {
              console.log(`Lead already exists for ${address}`);
              continue;
            }

            // Calculate roof age and lead score
            const currentYear = new Date().getFullYear();
            const roofAge = yearBuilt ? currentYear - yearBuilt : 15;
            
            // Base score from property characteristics
            let leadScore = 50;
            
            // Roof age bonus (up to +25)
            if (roofAge >= 20) leadScore += 25;
            else if (roofAge >= 15) leadScore += 20;
            else if (roofAge >= 10) leadScore += 12;
            else if (roofAge >= 5) leadScore += 5;
            
            // Property value bonus (up to +15)
            if (assessedValue >= 500000) leadScore += 15;
            else if (assessedValue >= 300000) leadScore += 10;
            else if (assessedValue >= 200000) leadScore += 5;
            
            // Hail event bonus (up to +20) - if we have hail data
            let hailEventId = null;
            let stormDate = null;
            let hailSize = null;
            
            if (hasHailEvents && hailEvents && hailEvents.length > 0) {
              const nearestHail = hailEvents[0];
              hailEventId = nearestHail.id;
              stormDate = nearestHail.event_date;
              hailSize = nearestHail.size_inches;
              
              // Bonus for having hail event
              if (hailSize >= 2.0) leadScore += 20;
              else if (hailSize >= 1.5) leadScore += 15;
              else if (hailSize >= 1.0) leadScore += 10;
              else leadScore += 5;
            }
            
            leadScore = Math.min(100, leadScore);

            // Only create leads with decent scores (lowered threshold)
            if (leadScore < 40) continue;

            // Create the lead with REAL ATTOM data
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
              owner_name: ownerName,
              lead_score: leadScore,
              storm_proximity_score: hasHailEvents ? Math.min(35, (hailSize || 1) * 10) : 10,
              roof_age_score: Math.min(25, roofAge >= 15 ? 25 : roofAge >= 10 ? 15 : 5),
              property_value_score: Math.min(20, assessedValue >= 300000 ? 20 : 10),
              hail_history_score: hasHailEvents ? 15 : 5,
              status: "new",
              source: "ai_auto_generated",
              territory_id: territory.id,
              hail_event_id: hailEventId,
              storm_date: stormDate,
              hail_size: hailSize,
              notes: hasHailEvents 
                ? `ATTOM property data. ${hailSize}" hail on ${stormDate}. Roof ~${roofAge} years old.`
                : `ATTOM property data. Roof ~${roofAge} years old. ${squareFeet ? `${squareFeet} sqft.` : ''}`,
            };

            const { error: insertError } = await supabaseAdmin
              .from("leads")
              .insert(leadData);

            if (insertError) {
              errors.push(`Insert error for ${address}: ${insertError.message}`);
            } else {
              leadsGenerated++;
              console.log(`Created lead: ${address}, ${city} - Score: ${leadScore}`);
            }
          } catch (propError: any) {
            errors.push(`Property error: ${propError.message}`);
          }
        }
      }
    }

    // If territory uses radius instead of zip codes
    if ((!territory.zip_codes || territory.zip_codes.length === 0) && territory.center_lat && territory.center_lng) {
      const properties = await searchPropertiesByLocation(
        territory.center_lat,
        territory.center_lng,
        territory.radius_miles || 5
      );
      
      for (const prop of properties.slice(0, 20)) {
        try {
          const address = prop.address?.line1 || prop.address?.oneLine || "";
          const city = prop.address?.locality || "";
          const state = prop.address?.countrySubd || "TX";
          const zip = prop.address?.postal1 || "";
          const lat = prop.location?.latitude || 0;
          const lng = prop.location?.longitude || 0;
          const yearBuilt = prop.summary?.yearbuilt || prop.summary?.yearBuilt;
          const assessedValue = prop.assessment?.assessed?.assdTtlValue || prop.assessment?.market?.mktTtlValue;
          const squareFeet = prop.building?.size?.livingsize || prop.building?.size?.livingSize;
          
          const owner = prop.owner || {};
          const ownerName = owner.owner1?.fullname || owner.owner1?.fullName || "";

          if (!address) continue;

          const { data: existingLead } = await supabaseAdmin
            .from("leads")
            .select("id")
            .eq("address", address)
            .eq("city", city)
            .maybeSingle();

          if (existingLead) continue;

          const currentYear = new Date().getFullYear();
          const roofAge = yearBuilt ? currentYear - yearBuilt : 15;
          
          let leadScore = 50;
          if (roofAge >= 20) leadScore += 25;
          else if (roofAge >= 15) leadScore += 20;
          else if (roofAge >= 10) leadScore += 12;
          
          if (assessedValue >= 300000) leadScore += 10;
          
          leadScore = Math.min(100, leadScore);
          if (leadScore < 40) continue;

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
            owner_name: ownerName,
            lead_score: leadScore,
            storm_proximity_score: 10,
            roof_age_score: Math.min(25, roofAge >= 15 ? 25 : roofAge >= 10 ? 15 : 5),
            property_value_score: Math.min(20, assessedValue >= 300000 ? 20 : 10),
            hail_history_score: 5,
            status: "new",
            source: "ai_auto_generated",
            territory_id: territory.id,
            notes: `ATTOM property data. Roof ~${roofAge} years old. ${squareFeet ? `${squareFeet} sqft.` : ''}`,
          };

          const { error: insertError } = await supabaseAdmin
            .from("leads")
            .insert(leadData);

          if (!insertError) {
            leadsGenerated++;
            console.log(`Created lead: ${address}, ${city} - Score: ${leadScore}`);
          }
        } catch (propError: any) {
          errors.push(`Property error: ${propError.message}`);
        }
      }
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
      message: `Generated ${leadsGenerated} leads from ATTOM for territory "${territory.name}"${hasHailEvents ? ` (${hailCount} hail events found)` : ''}`,
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
