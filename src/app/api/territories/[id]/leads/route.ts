import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const supabaseAdmin = createAdminClient(
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

// Search properties by zip code using CoreLogic
async function searchPropertiesByZip(zipCode: string, limit: number = 20): Promise<any[]> {
  const token = await getCoreLogicToken();
  if (!token) {
    console.error("Failed to get CoreLogic token");
    return [];
  }

  try {
    // Use Property API to search by zip
    const url = new URL(`${CORELOGIC_BASE_URL}/property`);
    url.searchParams.append("zip5", zipCode);
    url.searchParams.append("pageSize", limit.toString());
    url.searchParams.append("pageNumber", "1");

    const response = await fetch(url.toString(), {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/vnd.corelogic.v1+json",
        "Accept": "application/json"
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("CoreLogic property search error:", response.status, errorText);
      return [];
    }

    const data = await response.json();
    const properties = data.data || data.properties || [];
    
    console.log(`Found ${properties.length} properties in zip ${zipCode}`);
    return properties;
  } catch (error) {
    console.error("CoreLogic property search error:", error);
    return [];
  }
}

// Search properties near coordinates using Spatial API
async function searchPropertiesByLocation(
  latitude: number, 
  longitude: number, 
  radiusMiles: number = 1
): Promise<any[]> {
  const token = await getCoreLogicToken();
  if (!token) return [];

  try {
    const radiusMeters = Math.min(Math.round(radiusMiles * 1609.34), 1600);
    
    const url = new URL(`${CORELOGIC_BASE_URL}/spatial-tile/parcels`);
    url.searchParams.append("lat", latitude.toString());
    url.searchParams.append("lon", longitude.toString());
    url.searchParams.append("within", radiusMeters.toString());
    url.searchParams.append("pageSize", "50");
    url.searchParams.append("pageNumber", "1");

    const response = await fetch(url.toString(), {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json"
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("CoreLogic spatial search error:", response.status, errorText);
      return [];
    }

    const data = await response.json();
    return data.parcels || data.data || [];
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

    // Find recent hail events
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    
    const { data: hailEvents } = await supabaseAdmin
      .from("hail_events")
      .select("*")
      .gte("event_date", thirtyDaysAgo)
      .gte("size_inches", 0.75)
      .order("event_date", { ascending: false })
      .limit(50);

    if (!hailEvents || hailEvents.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No recent hail events found. Leads are generated when storms hit your territory.",
        leadsGenerated: 0,
      });
    }

    let leadsGenerated = 0;
    const errors: string[] = [];

    // For each zip code in the territory, search CoreLogic for properties
    if (territory.zip_codes && territory.zip_codes.length > 0) {
      for (const zipCode of territory.zip_codes.slice(0, 3)) { // Limit to 3 zips per request
        console.log(`Searching CoreLogic for properties in ${zipCode}...`);
        
        // Get properties from CoreLogic
        const properties = await searchPropertiesByZip(zipCode, 10);
        
        if (properties.length === 0) {
          // Fallback: try spatial search if we have hail event coordinates
          const nearestHail = hailEvents.find((h: any) => h.latitude && h.longitude);
          if (nearestHail) {
            const spatialProperties = await searchPropertiesByLocation(
              nearestHail.latitude, 
              nearestHail.longitude, 
              2
            );
            properties.push(...spatialProperties.slice(0, 10));
          }
        }

        console.log(`Found ${properties.length} CoreLogic properties for zip ${zipCode}`);

        // Process each property
        for (const prop of properties.slice(0, 10)) {
          try {
            // Extract property data from CoreLogic response
            const address = prop.address?.street || prop.stdAddr || prop.addr || "";
            const city = prop.address?.city || prop.stdCity || prop.city || "";
            const state = prop.address?.state || prop.stdState || prop.state || "TX";
            const zip = prop.address?.zip || prop.stdZip || prop.zip || zipCode;
            const lat = prop.location?.latitude || prop.latitude || prop.lat || 0;
            const lng = prop.location?.longitude || prop.longitude || prop.lon || 0;
            const yearBuilt = prop.building?.yearBuilt || prop.yearBuilt;
            const assessedValue = prop.assessment?.totalValue || prop.assessedValue || prop.marketValue;
            const squareFeet = prop.building?.squareFeet || prop.squareFeet || prop.sqft;
            const ownerName = prop.owner?.name || prop.owner || "";

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

            // Find nearest hail event
            const nearestHail = hailEvents[0];
            const currentYear = new Date().getFullYear();
            const roofAge = yearBuilt ? currentYear - yearBuilt : 15;
            const daysSinceStorm = Math.floor(
              (Date.now() - new Date(nearestHail.event_date).getTime()) / (1000 * 60 * 60 * 24)
            );

            // Calculate lead score
            const leadScore = calculateLeadScore({
              hailSize: nearestHail.size_inches,
              daysSinceStorm,
              roofAge,
              propertyValue: assessedValue || 200000,
            });

            // Only create leads with good scores
            if (leadScore < 50) continue;

            // Create the lead with REAL CoreLogic data
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
              storm_proximity_score: Math.min(35, nearestHail.size_inches * 10),
              roof_age_score: Math.min(25, roofAge >= 15 ? 25 : roofAge >= 10 ? 15 : 5),
              property_value_score: Math.min(20, assessedValue >= 300000 ? 20 : 10),
              hail_history_score: 10,
              status: "new",
              source: "ai_auto_generated",
              territory_id: territory.id,
              hail_event_id: nearestHail.id,
              storm_date: nearestHail.event_date,
              hail_size: nearestHail.size_inches,
              notes: `CoreLogic property data. ${nearestHail.size_inches}" hail on ${nearestHail.event_date}. Roof ~${roofAge} years old.`,
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

    return NextResponse.json({
      success: true,
      message: `Generated ${leadsGenerated} leads from CoreLogic for territory "${territory.name}"`,
      leadsGenerated,
      hailEventsFound: hailEvents.length,
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
