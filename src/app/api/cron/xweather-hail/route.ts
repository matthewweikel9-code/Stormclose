import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getHailReports, formatStormReportToHailEvent } from "@/lib/xweather";

/**
 * Xweather Hail Event Cron Job
 * 
 * This job runs periodically to:
 * 1. Fetch recent hail reports from Xweather
 * 2. Store them in the hail_events table
 * 3. Optionally trigger lead generation for affected territories
 * 
 * Configure in vercel.json with schedule: "0 * /6 * * *" (every 6 hours)
 */

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Default locations to monitor for hail (major Texas metro areas)
const MONITOR_LOCATIONS = [
  { name: "Dallas", lat: 32.7767, lng: -96.7970 },
  { name: "Fort Worth", lat: 32.7555, lng: -97.3308 },
  { name: "Houston", lat: 29.7604, lng: -95.3698 },
  { name: "San Antonio", lat: 29.4241, lng: -98.4936 },
  { name: "Austin", lat: 30.2672, lng: -97.7431 },
  { name: "Oklahoma City", lat: 35.4676, lng: -97.5164 },
  { name: "Denver", lat: 39.7392, lng: -104.9903 },
];

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  
  // Allow internal calls or cron authentication
  const url = new URL(request.url);
  const isInternal = url.searchParams.get("internal") === "true";
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && !isInternal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("🧊 Running Xweather hail event sync...");

  try {
    // Get all active territories to determine which areas to monitor
    const { data: territories } = await supabaseAdmin
      .from("territories")
      .select("id, user_id, center_lat, center_lng, zip_codes, name")
      .eq("is_active", true);

    // Build list of locations to monitor
    const locationsToMonitor = [...MONITOR_LOCATIONS];
    
    // Add territory center points
    if (territories) {
      for (const t of territories) {
        if (t.center_lat && t.center_lng) {
          locationsToMonitor.push({
            name: t.name,
            lat: t.center_lat,
            lng: t.center_lng
          });
        }
      }
    }

    // Dedupe by rounding to 1 decimal place
    const uniqueLocations = new Map<string, typeof locationsToMonitor[0]>();
    for (const loc of locationsToMonitor) {
      const key = `${loc.lat.toFixed(1)},${loc.lng.toFixed(1)}`;
      if (!uniqueLocations.has(key)) {
        uniqueLocations.set(key, loc);
      }
    }

    let totalReports = 0;
    let newEvents = 0;
    let errors: string[] = [];

    // Fetch hail reports for each location
    for (const [key, location] of uniqueLocations) {
      try {
        console.log(`Checking hail reports near ${location.name}...`);
        
        // Get hail reports from last 7 days within 75 miles
        const reports = await getHailReports(location.lat, location.lng, 75, 7);
        
        for (const report of reports) {
          totalReports++;
          
          // Convert to our hail_events format
          const eventData = formatStormReportToHailEvent(report);
          
          // Check if we already have this event (by xweather_id or location+date)
          const { data: existing } = await supabaseAdmin
            .from("hail_events")
            .select("id")
            .or(`xweather_id.eq.${report.id},and(latitude.eq.${report.loc.lat},longitude.eq.${report.loc.long},event_date.eq.${eventData.event_date})`)
            .single();

          if (existing) {
            continue; // Skip duplicate
          }

          // Insert new hail event
          const { error: insertError } = await supabaseAdmin
            .from("hail_events")
            .insert({
              ...eventData,
              created_at: new Date().toISOString()
            });

          if (insertError) {
            console.error("Failed to insert hail event:", insertError);
            errors.push(`Insert error: ${insertError.message}`);
            continue;
          }

          newEvents++;
          console.log(`⚡ New hail event: ${eventData.size_inches}" in ${eventData.location_name}, ${eventData.state}`);

          // If hail is significant (1"+), find territories that cover this area
          // and notify users
          if ((eventData.size_inches || 0) >= 1.0 && territories) {
            const affectedTerritories = territories.filter(t => {
              if (!t.center_lat || !t.center_lng) return false;
              
              // Simple distance check (roughly 50 miles)
              const latDiff = Math.abs(t.center_lat - report.loc.lat);
              const lngDiff = Math.abs(t.center_lng - report.loc.long);
              return latDiff < 0.75 && lngDiff < 1.0;
            });

            for (const territory of affectedTerritories) {
              // Create notification for the territory owner
              try {
                await supabaseAdmin.from("notifications").insert({
                  user_id: territory.user_id,
                  type: "hail_detected",
                  title: `Hail Alert: ${eventData.size_inches}" in ${eventData.location_name}`,
                  message: `${eventData.size_inches}" hail reported near your ${territory.name} territory. New leads may be available.`,
                  data: {
                    territory_id: territory.id,
                    hail_size: eventData.size_inches,
                    location: eventData.location_name,
                    event_date: eventData.event_date
                  },
                  read: false,
                  created_at: new Date().toISOString()
                });
              } catch {
                // Ignore if notifications table doesn't exist
              }
            }
          }
        }
      } catch (locError) {
        console.error(`Error fetching hail for ${location.name}:`, locError);
        errors.push(`${location.name}: ${String(locError)}`);
      }
    }

    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      locationsChecked: uniqueLocations.size,
      totalReports,
      newEvents,
      errors: errors.length > 0 ? errors : undefined
    };

    console.log("✅ Xweather hail sync complete:", result);
    return NextResponse.json(result);

  } catch (error) {
    console.error("Xweather hail sync error:", error);
    return NextResponse.json(
      { error: "Hail sync failed", details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST: Manually trigger hail check for specific location
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // Check if user is authenticated
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const body = await request.json();
    const { lat, lng, zip, radius = 50, days = 14 } = body;

    if (!lat || !lng) {
      return NextResponse.json(
        { error: "lat and lng are required" },
        { status: 400 }
      );
    }

    console.log(`Manual hail check: ${lat}, ${lng} - ${radius}mi, ${days} days`);

    const reports = await getHailReports(
      parseFloat(lat), 
      parseFloat(lng), 
      parseInt(radius),
      parseInt(days)
    );

    // Convert reports to hail_events format
    const events = reports.map(formatStormReportToHailEvent);

    // Group by size for summary
    const summary = {
      total: events.length,
      bySize: {
        small: events.filter(e => (e.size_inches || 0) < 1.0).length,
        moderate: events.filter(e => (e.size_inches || 0) >= 1.0 && (e.size_inches || 0) < 1.5).length,
        large: events.filter(e => (e.size_inches || 0) >= 1.5 && (e.size_inches || 0) < 2.0).length,
        significant: events.filter(e => (e.size_inches || 0) >= 2.0).length
      },
      maxSize: events.length > 0 ? Math.max(...events.map(e => e.size_inches || 0)) : 0,
      mostRecent: events[0]?.event_date || null
    };

    return NextResponse.json({
      success: true,
      location: { lat, lng },
      radiusMiles: radius,
      daysBack: days,
      summary,
      events: events.slice(0, 50), // Limit response size
      source: "xweather"
    });

  } catch (error) {
    console.error("Manual hail check error:", error);
    return NextResponse.json(
      { error: "Failed to check hail data", details: String(error) },
      { status: 500 }
    );
  }
}
