import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkFeatureAccess } from "@/lib/subscriptions/access";
import { resolveStormProvider } from "@/lib/storm-providers/resolver";
import { searchPropertiesInArea, calculateRoofAge, estimateClaimValue, CoreLogicProperty } from "@/lib/corelogic";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await checkFeatureAccess(user.id, "lead_generator");
  if (!access.allowed) {
    return NextResponse.json(
      { error: access.reason ?? "Lead Generator requires a higher subscription tier." },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const timeframe = searchParams.get("timeframe") || "7d";

  // Get user location from query params, user settings, or defaults
  let lat = parseFloat(searchParams.get("lat") || "0");
  let lng = parseFloat(searchParams.get("lng") || "0");

  if (lat === 0 && lng === 0) {
    // Try user settings
    try {
      const { data: settings } = await supabase
        .from("user_settings")
        .select("default_latitude, default_longitude")
        .eq("user_id", user.id)
        .single() as { data: { default_latitude: number; default_longitude: number } | null };

      if (settings?.default_latitude && settings?.default_longitude) {
        lat = settings.default_latitude;
        lng = settings.default_longitude;
      }
    } catch (e) {
      // Use defaults
    }

    // Fallback defaults
    if (lat === 0 && lng === 0) {
      lat = 35.0;
      lng = -98.0;
    }
  }

  // Calculate days based on timeframe
  const days = timeframe === "24h" ? 1 : timeframe === "7d" ? 7 : 30;

  try {
    // Fetch storm data via provider resolver (HailTrace / Hail Recon / Xweather)
    let resolvedStorms: { id: string; type: string; severity: string; hailSize?: number; windSpeed?: number; lat: number; lng: number; startTime: string; location?: string; county?: string; state?: string }[] = [];
    let resolvedAlerts: { id: string; name?: string; issuedAt?: string; emergency?: boolean }[] = [];
    try {
      const resolved = await resolveStormProvider(supabase, {
        userId: user.id,
        lat,
        lng,
        radius: 100,
        live: false,
        days,
      });
      resolvedStorms = resolved.storms;
      resolvedAlerts = resolved.alerts as any;
    } catch (e) {
      console.warn("Storm resolver failed for opportunities:", e);
    }

    // Build storm opportunities from resolved storm events
    const stormMap = new Map<string, any>();
    resolvedStorms.forEach((event) => {
      const city = event.location?.split(",")[0] || event.county || "Unknown";
      const state = event.state || "";
      const key = `${city}-${state}`;

      if (!stormMap.has(key)) {
        const daysAgo = Math.ceil(
          (Date.now() - new Date(event.startTime).getTime()) / (1000 * 60 * 60 * 24)
        );
        stormMap.set(key, {
          id: key,
          name: `${city} ${event.type === "hail" ? "Hail" : "Storm"} Event`,
          date: event.startTime.split("T")[0],
          location: `${city}, ${state}`,
          coordinates: { lat: event.lat, lng: event.lng },
          severity: (event.hailSize || 0) >= 2 ? "major" : (event.hailSize || 0) >= 1 ? "moderate" : "minor",
          hailSize: event.hailSize || 0,
          windSpeed: event.windSpeed || 0,
          affectedProperties: 0,
          estimatedDamage: 0,
          daysAgo,
          opportunityScore: 0,
          reportCount: 0,
        });
      }

      const storm = stormMap.get(key)!;
      storm.reportCount = (storm.reportCount || 0) + 1;
      if ((event.hailSize || 0) > storm.hailSize) storm.hailSize = event.hailSize;
      if ((event.windSpeed || 0) > storm.windSpeed) storm.windSpeed = event.windSpeed;
    });

    // Calculate opportunity scores and estimated damage
    const storms = Array.from(stormMap.values()).map((storm) => {
      // Score based on severity and recency
      let score = 0;
      if (storm.hailSize >= 2.5) score += 40;
      else if (storm.hailSize >= 2.0) score += 35;
      else if (storm.hailSize >= 1.5) score += 25;
      else if (storm.hailSize >= 1.0) score += 15;

      if (storm.windSpeed >= 70) score += 25;
      else if (storm.windSpeed >= 60) score += 20;
      else if (storm.windSpeed >= 50) score += 15;

      // Recency bonus
      if (storm.daysAgo <= 3) score += 30;
      else if (storm.daysAgo <= 7) score += 20;
      else if (storm.daysAgo <= 14) score += 10;

      storm.opportunityScore = Math.min(100, score);
      const reportCount = storm.reportCount || 1;
      storm.estimatedDamage = Math.round(reportCount * 15000 * (storm.hailSize || 1));
      storm.affectedProperties = reportCount * 50; // Rough estimate

      delete storm.reportCount;
      return storm;
    });

    // Sort by opportunity score
    storms.sort((a: any, b: any) => b.opportunityScore - a.opportunityScore);

    // Get top properties from CoreLogic if available
    let topProperties: any[] = [];
    if (storms.length > 0) {
      try {
        // Search near the top storm location
        const topStorm = storms[0];
        const properties = await searchPropertiesInArea(
          topStorm.coordinates.lat,
          topStorm.coordinates.lng,
          5,
          { propertyType: "SFR" }
        );

        topProperties = properties.slice(0, 5).map((prop: CoreLogicProperty) => {
          const roofAge = calculateRoofAge(prop);
          const claimEstimate = estimateClaimValue(prop);
          const damageScore = Math.min(100, Math.round(50 + roofAge * 1.5 + (topStorm.hailSize || 0) * 10));

          return {
            id: prop.id || `prop-${Math.random()}`,
            address: prop.address || "Unknown",
            city: prop.city || "",
            state: prop.state || "",
            damageScore,
            opportunityValue: claimEstimate.roofReplacement,
            roofAge,
            roofSquares: Math.round((prop.squareFootage || 2000) * 1.15 / 100),
            lastStorm: topStorm.date,
            owner: prop.owner || "Unknown",
            tags: [
              roofAge >= 15 ? `${roofAge}yr roof` : null,
              topStorm.hailSize >= 1.5 ? `${topStorm.hailSize}" hail` : null,
              damageScore >= 80 ? "High priority" : null,
            ].filter(Boolean),
            priority: damageScore >= 85 ? "hot" : damageScore >= 70 ? "warm" : "cold",
          };
        });
      } catch (e) {
        console.error("CoreLogic property fetch error:", e);
      }
    }

    // Build stats
    const totalOpportunityValue = storms.reduce((sum: number, s: any) => sum + s.estimatedDamage, 0);
    const stats = {
      totalOpportunityValue,
      activeStorms: storms.filter((s: any) => s.daysAgo <= 7).length,
      hotLeads: topProperties.filter((p: any) => p.priority === "hot").length,
      scheduledKnocks: 0, // Would come from database
      weeklyChange: 0,
    };

    // Build neighborhoods from storm data
    const neighborhoods = storms.slice(0, 4).map((storm: any, i: number) => ({
      id: (i + 1).toString(),
      name: storm.location.split(",")[0],
      city: storm.location.split(",")[0],
      totalHomes: storm.affectedProperties,
      affectedHomes: Math.round(storm.affectedProperties * 0.7),
      averageDamage: Math.round(storm.estimatedDamage / Math.max(storm.affectedProperties, 1)),
      averageRoofAge: 12 + i * 2,
      opportunityValue: storm.estimatedDamage,
      saturation: 0,
      competitorActivity: "low",
    }));

    // Build forecast from resolved alerts
    const forecast = resolvedAlerts.slice(0, 5).map((alert: any) => ({
      date: new Date(alert.issuedAt || Date.now()).toLocaleDateString("en-US", { weekday: "short" }),
      condition: alert.name || "Storm Watch",
      high: 0,
      low: 0,
      stormChance: alert.emergency ? 90 : 60,
      icon: "storm" as const,
    }));

    return NextResponse.json({
      stats,
      storms: storms.slice(0, 10),
      topProperties,
      neighborhoods,
      largeRoofs: [], // Would need commercial property search
      forecast,
      source: "storm-provider",
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Opportunities API error:", error);
    return NextResponse.json({
      stats: { totalOpportunityValue: 0, activeStorms: 0, hotLeads: 0, scheduledKnocks: 0, weeklyChange: 0 },
      storms: [],
      topProperties: [],
      neighborhoods: [],
      largeRoofs: [],
      forecast: [],
      error: "Failed to fetch opportunity data",
    });
  }
}
