import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET: Fetch leads for a specific territory
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

    // Fetch leads that match the territory's zip codes
    let query = supabaseAdmin
      .from("leads")
      .select("*")
      .order("lead_score", { ascending: false })
      .limit(50);

    // Filter by zip codes if territory has them
    if (territory.zip_codes && territory.zip_codes.length > 0) {
      query = query.in("zip", territory.zip_codes);
    }

    const { data: leads, error: leadsError } = await query;

    if (leadsError) {
      console.error("Error fetching territory leads:", leadsError);
      return NextResponse.json(
        { error: "Failed to fetch leads" },
        { status: 500 }
      );
    }

    // Also fetch recent hail events in this territory
    let hailQuery = supabaseAdmin
      .from("hail_events")
      .select("*")
      .gte(
        "event_date",
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
      )
      .order("event_date", { ascending: false })
      .limit(20);

    // Filter hail events by territory zip codes
    // Note: hail_events may not have zip field, so we'll match by state
    if (territory.zip_codes && territory.zip_codes.length > 0) {
      // Get first zip prefix for state approximation
      const statePrefix = territory.zip_codes[0]?.substring(0, 3);
      // We'll return all hail events for now - UI can filter further
    }

    const { data: hailEvents } = await hailQuery;

    return NextResponse.json({
      success: true,
      territory,
      leads: leads || [],
      hailEvents: hailEvents || [],
      totalLeads: leads?.length || 0,
    });
  } catch (error) {
    console.error("Territory leads fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST: Generate leads for this territory based on recent hail events
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

    // Find recent hail events that might affect this territory
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const { data: hailEvents, error: hailError } = await supabaseAdmin
      .from("hail_events")
      .select("*")
      .gte("event_date", thirtyDaysAgo)
      .gte("size_inches", 0.75) // Quarter-sized hail or larger
      .order("event_date", { ascending: false })
      .limit(100);

    if (hailError) {
      console.error("Error fetching hail events:", hailError);
      return NextResponse.json(
        { error: "Failed to fetch hail data" },
        { status: 500 }
      );
    }

    if (!hailEvents || hailEvents.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No recent hail events found to generate leads from",
        leadsGenerated: 0,
      });
    }

    // For zip code territories, check if hail events are in those zips
    // For now, we'll create sample leads based on the territory
    let leadsGenerated = 0;
    const processedZips = new Set<string>();

    // Generate leads for each zip code in the territory
    if (territory.zip_codes && territory.zip_codes.length > 0) {
      for (const zipCode of territory.zip_codes.slice(0, 5)) {
        // Limit to 5 zips per request
        if (processedZips.has(zipCode)) continue;
        processedZips.add(zipCode);

        // Find if there are hail events affecting this area
        // For now, we'll use the first hail event as reference
        const nearestHail = hailEvents[0];
        if (!nearestHail) continue;

        // Check if lead already exists for this zip
        const { data: existingLeads } = await supabaseAdmin
          .from("leads")
          .select("id")
          .eq("zip", zipCode)
          .eq("source", "ai_auto_generated")
          .limit(3);

        if (existingLeads && existingLeads.length >= 3) {
          // Already have enough AI leads for this zip
          continue;
        }

        // Calculate a score based on hail event
        const daysSinceStorm = Math.floor(
          (Date.now() - new Date(nearestHail.event_date).getTime()) /
            (1000 * 60 * 60 * 24)
        );

        const baseScore = Math.max(
          50,
          85 - daysSinceStorm * 2 + nearestHail.size_inches * 5
        );

        // Create a placeholder lead for this territory
        const leadData = {
          user_id: user.id,
          address: `Property in ${zipCode} area`,
          city: nearestHail.location_name || territory.name,
          state: nearestHail.state || "TX",
          zip: zipCode,
          latitude: nearestHail.latitude || 0,
          longitude: nearestHail.longitude || 0,
          lead_score: Math.min(Math.round(baseScore), 100),
          storm_proximity_score: Math.min(35, nearestHail.size_inches * 10),
          roof_age_score: 15,
          property_value_score: 10,
          hail_history_score: 10,
          status: "new",
          source: "ai_auto_generated",
          hail_event_id: nearestHail.id,
          storm_date: nearestHail.event_date,
          hail_size: nearestHail.size_inches,
          notes: `AI-generated for territory "${territory.name}". ${nearestHail.size_inches}" hail on ${nearestHail.event_date}.`,
        };

        const { error: insertError } = await supabaseAdmin
          .from("leads")
          .insert(leadData);

        if (!insertError) {
          leadsGenerated++;
        }
      }
    }

    // Update territory with new lead count
    await supabaseAdmin
      .from("territories")
      .update({
        total_leads: (territory.total_leads || 0) + leadsGenerated,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    return NextResponse.json({
      success: true,
      message: `Generated ${leadsGenerated} leads for territory "${territory.name}"`,
      leadsGenerated,
      hailEventsFound: hailEvents.length,
    });
  } catch (error) {
    console.error("Territory lead generation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
