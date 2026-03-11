import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getHailReports, getStormReports, getActiveAlerts } from "@/lib/xweather";
import { searchPropertiesInArea, calculateRoofAge, estimateClaimValue, ATTOMProperty } from "@/lib/attom";

const ATTOM_API_KEY = process.env.ATTOM_API_KEY;

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const timeframe = searchParams.get("timeframe") || "7d";

  // Get user location from settings or default
  let lat = 35.0;
  let lng = -98.0;

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

  // Calculate days based on timeframe
  const days = timeframe === "24h" ? 1 : timeframe === "7d" ? 7 : 30;

  try {
    // Fetch real storm data from Xweather
    const [hailReports, stormReports, alerts] = await Promise.all([
      getHailReports(lat, lng, 100, days).catch(() => []),
      getStormReports(lat, lng, 100, days).catch(() => []),
      getActiveAlerts(lat, lng).catch(() => []),
    ]);

    // Build storm opportunities from real reports
    const stormMap = new Map<string, any>();

    // Group storm reports by location/city
    [...hailReports, ...stormReports].forEach((report) => {
      const city = report.place?.name || "Unknown";
      const state = report.place?.state || "";
      const key = `${city}-${state}`;

      if (!stormMap.has(key)) {
        const daysAgo = Math.ceil(
          (Date.now() - new Date(report.report.dateTimeISO).getTime()) / (1000 * 60 * 60 * 24)
        );
        stormMap.set(key, {
          id: key,
          name: `${city} ${report.report.cat === "hail" ? "Hail" : "Storm"} Event`,
          date: report.report.dateTimeISO.split("T")[0],
          location: `${city}, ${state}`,
          coordinates: { lat: report.loc.lat, lng: report.loc.long },
          severity: (report.report.detail.hailIN || 0) >= 2 ? "major" :
                    (report.report.detail.hailIN || 0) >= 1 ? "moderate" : "minor",
          hailSize: report.report.detail.hailIN || 0,
          windSpeed: report.report.detail.windSpeedMPH || 0,
          affectedProperties: 0,
          estimatedDamage: 0,
          daysAgo,
          opportunityScore: 0,
          reports: [] as any[],
        });
      }

      const storm = stormMap.get(key)!;
      storm.reports.push(report);
      if ((report.report.detail.hailIN || 0) > storm.hailSize) {
        storm.hailSize = report.report.detail.hailIN;
      }
      if ((report.report.detail.windSpeedMPH || 0) > storm.windSpeed) {
        storm.windSpeed = report.report.detail.windSpeedMPH;
      }
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
      storm.estimatedDamage = Math.round(storm.reports.length * 15000 * (storm.hailSize || 1));
      storm.affectedProperties = storm.reports.length * 50; // Rough estimate

      delete storm.reports; // Don't send raw reports to client
      return storm;
    });

    // Sort by opportunity score
    storms.sort((a: any, b: any) => b.opportunityScore - a.opportunityScore);

    // Get top properties from ATTOM if available
    let topProperties: any[] = [];
    if (ATTOM_API_KEY && storms.length > 0) {
      try {
        // Search near the top storm location
        const topStorm = storms[0];
        const properties = await searchPropertiesInArea(
          topStorm.coordinates.lat,
          topStorm.coordinates.lng,
          5,
          { propertyType: "SFR" }
        );

        topProperties = properties.slice(0, 5).map((prop: ATTOMProperty) => {
          const roofAge = calculateRoofAge(prop);
          const claimEstimate = estimateClaimValue(prop);
          const damageScore = Math.min(100, Math.round(50 + roofAge * 1.5 + (topStorm.hailSize || 0) * 10));

          return {
            id: prop.identifier?.attomId?.toString() || `prop-${Math.random()}`,
            address: prop.address?.line1 || prop.address?.oneLine || "Unknown",
            city: prop.address?.locality || "",
            state: prop.address?.countrySubd || "",
            damageScore,
            opportunityValue: claimEstimate.roofReplacement,
            roofAge,
            roofSquares: Math.round((prop.building?.size?.livingSize || 2000) * 1.15 / 100),
            lastStorm: topStorm.date,
            owner: prop.owner?.owner1?.fullName || "Unknown",
            tags: [
              roofAge >= 15 ? `${roofAge}yr roof` : null,
              topStorm.hailSize >= 1.5 ? `${topStorm.hailSize}" hail` : null,
              damageScore >= 80 ? "High priority" : null,
            ].filter(Boolean),
            priority: damageScore >= 85 ? "hot" : damageScore >= 70 ? "warm" : "cold",
          };
        });
      } catch (e) {
        console.error("ATTOM property fetch error:", e);
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

    // Build forecast from Xweather alerts
    const forecast = alerts.slice(0, 5).map((alert: any) => ({
      date: new Date(alert.timestamps?.beginsISO || Date.now()).toLocaleDateString("en-US", { weekday: "short" }),
      condition: alert.details?.name || "Storm Watch",
      high: 0,
      low: 0,
      stormChance: alert.details?.emergency ? 90 : 60,
      icon: "storm" as const,
    }));

    return NextResponse.json({
      stats,
      storms: storms.slice(0, 10),
      topProperties,
      neighborhoods,
      largeRoofs: [], // Would need commercial property search
      forecast,
      source: "xweather",
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
