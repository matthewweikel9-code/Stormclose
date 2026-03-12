import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getHailReports, getStormReports } from "@/lib/xweather";
import { getPropertyByAddress, calculateRoofAge, estimateClaimValue } from "@/lib/corelogic";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "property";
  const address = searchParams.get("address");
  const lat = parseFloat(searchParams.get("lat") || "0");
  const lng = parseFloat(searchParams.get("lng") || "0");

  try {
    switch (type) {
      case "property":
        return NextResponse.json(await generatePropertyReport(address, lat, lng));
      case "storm":
        return NextResponse.json(await generateStormReport(lat, lng));
      case "measurement":
        return NextResponse.json(await generateMeasurementReport(address));
      case "route":
        return NextResponse.json(await generateRouteReport(supabase, user.id));
      default:
        return NextResponse.json({ error: "Invalid report type" }, { status: 400 });
    }
  } catch (error) {
    console.error("Report generation error:", error);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}

async function generatePropertyReport(address: string | null, lat: number, lng: number) {
  if (!address) {
    return {
      address: "No property selected",
      owner: "N/A",
      propertyValue: 0,
      yearBuilt: 0,
      roofAge: 0,
      roofType: "N/A",
      roofSquares: 0,
      lotSize: 0,
      stormHistory: [],
      damageScore: 0,
      message: "Search for a property first, then generate a report.",
    };
  }

  // Look up property from CoreLogic
  const parts = address.split(",").map((s) => s.trim());
  const address1 = parts[0] || "";
  const address2 = parts.slice(1).join(", ") || "";

  const property = await getPropertyByAddress(address1, address2);

  if (!property) {
    return {
      address,
      owner: "Unknown",
      propertyValue: 0,
      yearBuilt: 0,
      roofAge: 0,
      roofType: "Unknown",
      roofSquares: 0,
      lotSize: 0,
      stormHistory: [],
      damageScore: 0,
      message: "Property not found in database.",
    };
  }

  const roofAge = calculateRoofAge(property);
  const claimEstimate = estimateClaimValue(property);
  const propLat = property.lat || lat;
  const propLng = property.lng || lng;

  // Get storm history for the property location
  let stormHistory: any[] = [];
  try {
    const hailReports = await getHailReports(propLat, propLng, 5, 365);
    stormHistory = hailReports.slice(0, 5).map((r) => ({
      date: r.report.dateTimeISO.split("T")[0],
      type: r.report.cat === "hail" ? "Hail" : "Wind",
      severity: (r.report.detail.hailIN || 0) >= 2 ? "Major" :
                (r.report.detail.hailIN || 0) >= 1 ? "Moderate" : "Minor",
    }));
  } catch (e) {
    // Storm data not available
  }

  const damageScore = Math.min(100, Math.round(
    30 + (roofAge > 15 ? 25 : roofAge > 10 ? 15 : 5) +
    (stormHistory.length > 0 ? 20 : 0) +
    (stormHistory.some((s: any) => s.severity === "Major") ? 15 : 0)
  ));

  return {
    address: property.address || address,
    owner: property.owner || "Unknown",
    propertyValue: property.marketValue || property.assessedValue || 0,
    yearBuilt: property.yearBuilt || 0,
    roofAge,
    roofType: property.roofType || "Unknown",
    roofSquares: Math.round((property.squareFootage || 2000) * 1.15 / 100),
    lotSize: property.lotSize || 0,
    stormHistory,
    damageScore,
    estimatedClaimValue: claimEstimate.total,
    lastInspection: null,
  };
}

async function generateStormReport(lat: number, lng: number) {
  if (!lat && !lng) {
    return {
      stormDate: "N/A",
      stormType: "No location provided",
      maxHailSize: 0,
      maxWindSpeed: 0,
      affectedProperties: 0,
      damageEstimate: 0,
      impactRadius: 0,
      coordinates: { lat: 0, lng: 0 },
      message: "Enable location services to generate storm reports.",
    };
  }

  try {
    const [hailReports, stormReports] = await Promise.all([
      getHailReports(lat, lng, 50, 30).catch(() => []),
      getStormReports(lat, lng, 50, 30).catch(() => []),
    ]);

    const allReports = [...hailReports, ...stormReports];

    if (allReports.length === 0) {
      return {
        stormDate: "N/A",
        stormType: "No recent storms found",
        maxHailSize: 0,
        maxWindSpeed: 0,
        affectedProperties: 0,
        damageEstimate: 0,
        impactRadius: 0,
        coordinates: { lat, lng },
        message: "No storm reports found in your area for the past 30 days.",
      };
    }

    const maxHailSize = Math.max(...allReports.map((r) => r.report.detail.hailIN || 0));
    const maxWindSpeed = Math.max(...allReports.map((r) => r.report.detail.windSpeedMPH || 0));
    const mostRecent = allReports.sort((a, b) =>
      new Date(b.report.dateTimeISO).getTime() - new Date(a.report.dateTimeISO).getTime()
    )[0];

    return {
      stormDate: mostRecent.report.dateTimeISO.split("T")[0],
      stormType: maxHailSize >= 1.5 ? "Severe Hail Storm" : maxWindSpeed >= 60 ? "High Wind Event" : "Storm Event",
      maxHailSize,
      maxWindSpeed,
      affectedProperties: allReports.length * 50,
      damageEstimate: Math.round(allReports.length * 15000 * Math.max(maxHailSize, 1)),
      impactRadius: 25,
      coordinates: { lat: mostRecent.loc.lat, lng: mostRecent.loc.long },
      reportCount: allReports.length,
    };
  } catch (error) {
    return {
      stormDate: "N/A",
      stormType: "Error fetching storm data",
      maxHailSize: 0,
      maxWindSpeed: 0,
      affectedProperties: 0,
      damageEstimate: 0,
      impactRadius: 0,
      coordinates: { lat, lng },
    };
  }
}

async function generateMeasurementReport(address: string | null) {
  return {
    address: address || "No property selected",
    totalSquares: 0,
    roofPitch: "N/A",
    segments: [],
    materials: [],
    wasteFactor: 0,
    measurementDate: "N/A",
    message: "Use the Roof Measurement tool to create measurements, then generate a report.",
  };
}

async function generateRouteReport(supabase: any, userId: string) {
  // Try to get saved routes from database
  try {
    const { data: routes } = await supabase
      .from("routes")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (routes && routes.length > 0) {
      const route = routes[0];
      return {
        routeName: route.name || "Saved Route",
        totalStops: route.stops?.length || 0,
        totalDistance: route.total_distance || 0,
        estimatedTime: route.estimated_time || 0,
        stops: (route.stops || []).map((s: any) => ({
          address: s.address || "Unknown",
          priority: s.priority || "Medium",
          notes: s.notes || "",
        })),
        optimized: route.optimized || false,
      };
    }
  } catch (e) {
    // Routes table may not exist
  }

  return {
    routeName: "No route created",
    totalStops: 0,
    totalDistance: 0,
    estimatedTime: 0,
    stops: [],
    optimized: false,
    message: "Create a route in Smart Route Planner first, then generate a report.",
  };
}
