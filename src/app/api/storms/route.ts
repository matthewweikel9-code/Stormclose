import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Storm data API - fetches live and historical storm data
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") || new Date().toISOString().split("T")[0];
  const live = searchParams.get("live") === "true";
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const radius = searchParams.get("radius") || "100"; // miles

  try {
    // Fetch from weather API (OpenWeather/NOAA/NWS)
    const weatherApiKey = process.env.OPENWEATHER_API_KEY;
    
    let storms: StormEvent[] = [];
    let impactedProperties: PropertyImpact[] = [];

    if (live && weatherApiKey) {
      // Fetch live severe weather alerts from NWS
      const nwsResponse = await fetch(
        "https://api.weather.gov/alerts/active?event=Severe%20Thunderstorm%20Warning,Tornado%20Warning,Hail",
        { headers: { "User-Agent": "StormAI/1.0" } }
      );

      if (nwsResponse.ok) {
        const nwsData = await nwsResponse.json();
        storms = parseNWSAlerts(nwsData.features || []);
      }
    }

    // Fetch historical storms from database
    if (!live) {
      const { data: historicalStorms } = await supabase
        .from("storm_events")
        .select("*")
        .gte("start_time", `${date}T00:00:00`)
        .lte("start_time", `${date}T23:59:59`)
        .order("start_time", { ascending: false });

      if (historicalStorms) {
        storms = historicalStorms.map(s => ({
          id: s.id,
          type: s.type,
          severity: s.severity,
          hailSize: s.hail_size,
          windSpeed: s.wind_speed,
          lat: s.lat,
          lng: s.lng,
          radius: s.radius,
          startTime: s.start_time,
          endTime: s.end_time,
          damageScore: s.damage_score,
          path: s.path,
        }));
      }
    }

    // Get properties impacted by active storms
    if (storms.length > 0) {
      // In a real app, this would query a property database within storm radius
      // For now, we generate sample impacted properties
      impactedProperties = generateImpactedProperties(storms);
    }

    // Cache storm data
    if (storms.length > 0) {
      await supabase.from("storm_cache").upsert({
        cache_key: `storms_${date}_${live}`,
        data: { storms, impactedProperties },
        expires_at: new Date(Date.now() + (live ? 300000 : 3600000)).toISOString(), // 5 min live, 1 hr historical
      });
    }

    return NextResponse.json({
      storms,
      impactedProperties,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching storm data:", error);
    return NextResponse.json({ error: "Failed to fetch storm data" }, { status: 500 });
  }
}

interface StormEvent {
  id: string;
  type: "hail" | "wind" | "tornado" | "severe_thunderstorm";
  severity: "minor" | "moderate" | "severe" | "extreme";
  hailSize?: number;
  windSpeed?: number;
  lat: number;
  lng: number;
  radius: number;
  startTime: string;
  endTime?: string;
  damageScore: number;
  path?: { lat: number; lng: number }[];
}

interface PropertyImpact {
  address: string;
  lat: number;
  lng: number;
  damageProb: number;
  hailExposure: number;
  windExposure: number;
  roofAge?: number;
  stormScore: number;
}

function parseNWSAlerts(features: any[]): StormEvent[] {
  return features.map((f, i) => {
    const props = f.properties;
    const geometry = f.geometry;
    
    // Determine storm type from event name
    let type: StormEvent["type"] = "severe_thunderstorm";
    if (props.event?.toLowerCase().includes("tornado")) type = "tornado";
    else if (props.event?.toLowerCase().includes("hail") || props.headline?.toLowerCase().includes("hail")) type = "hail";
    else if (props.event?.toLowerCase().includes("wind")) type = "wind";

    // Parse severity
    let severity: StormEvent["severity"] = "moderate";
    if (props.severity === "Extreme") severity = "extreme";
    else if (props.severity === "Severe") severity = "severe";
    else if (props.severity === "Minor") severity = "minor";

    // Extract hail size and wind speed from description
    const hailMatch = props.description?.match(/(\d+\.?\d*)\s*inch\s*hail/i);
    const windMatch = props.description?.match(/(\d+)\s*mph/i);

    // Get center point from geometry
    let lat = 35.0, lng = -98.0;
    if (geometry?.coordinates) {
      if (geometry.type === "Point") {
        [lng, lat] = geometry.coordinates;
      } else if (geometry.type === "Polygon" && geometry.coordinates[0]) {
        const coords = geometry.coordinates[0];
        lat = coords.reduce((sum: number, c: number[]) => sum + c[1], 0) / coords.length;
        lng = coords.reduce((sum: number, c: number[]) => sum + c[0], 0) / coords.length;
      }
    }

    return {
      id: props.id || `nws-${i}`,
      type,
      severity,
      hailSize: hailMatch ? parseFloat(hailMatch[1]) : undefined,
      windSpeed: windMatch ? parseInt(windMatch[1]) : undefined,
      lat,
      lng,
      radius: 15, // Default radius
      startTime: props.onset || props.effective,
      endTime: props.expires,
      damageScore: calculateDamageScore(type, severity, hailMatch?.[1], windMatch?.[1]),
    };
  });
}

function calculateDamageScore(
  type: string,
  severity: string,
  hailSize?: string,
  windSpeed?: string
): number {
  let score = 50;

  // Base severity score
  if (severity === "extreme") score = 90;
  else if (severity === "severe") score = 75;
  else if (severity === "moderate") score = 55;
  else score = 35;

  // Adjust for storm type
  if (type === "tornado") score = Math.min(100, score + 20);
  else if (type === "hail") score = Math.min(100, score + 10);

  // Adjust for hail size
  if (hailSize) {
    const size = parseFloat(hailSize);
    if (size >= 2.0) score = Math.min(100, score + 15);
    else if (size >= 1.0) score = Math.min(100, score + 8);
  }

  // Adjust for wind speed
  if (windSpeed) {
    const speed = parseInt(windSpeed);
    if (speed >= 80) score = Math.min(100, score + 15);
    else if (speed >= 60) score = Math.min(100, score + 8);
  }

  return Math.round(score);
}

function generateImpactedProperties(storms: StormEvent[]): PropertyImpact[] {
  const properties: PropertyImpact[] = [];

  storms.forEach(storm => {
    // Generate sample properties within storm radius
    const numProps = Math.floor(Math.random() * 15) + 5;
    for (let i = 0; i < numProps; i++) {
      const offsetLat = (Math.random() - 0.5) * (storm.radius / 69); // ~69 miles per degree lat
      const offsetLng = (Math.random() - 0.5) * (storm.radius / 54); // ~54 miles per degree lng at ~35° lat

      const hailExposure = storm.hailSize ? Math.min(100, 50 + storm.hailSize * 20) : 30;
      const windExposure = storm.windSpeed ? Math.min(100, storm.windSpeed * 1.2) : 40;
      const roofAge = Math.floor(Math.random() * 25) + 5;
      
      // Calculate damage probability
      const baseDamage = (hailExposure + windExposure) / 2;
      const roofAgeBonus = Math.min(20, roofAge * 0.8);
      const damageProb = Math.min(100, Math.round(baseDamage + roofAgeBonus));

      properties.push({
        address: generateAddress(storm.lat + offsetLat, storm.lng + offsetLng),
        lat: storm.lat + offsetLat,
        lng: storm.lng + offsetLng,
        damageProb,
        hailExposure: Math.round(hailExposure),
        windExposure: Math.round(windExposure),
        roofAge,
        stormScore: Math.round((damageProb + storm.damageScore) / 2),
      });
    }
  });

  // Sort by damage probability
  return properties.sort((a, b) => b.damageProb - a.damageProb);
}

function generateAddress(lat: number, lng: number): string {
  const streets = ["Oak", "Maple", "Cedar", "Pine", "Elm", "Main", "Park", "Lake", "Ridge", "Valley"];
  const types = ["St", "Ave", "Dr", "Blvd", "Ln", "Way", "Ct"];
  const cities = ["Amarillo TX", "Dallas TX", "Oklahoma City OK", "Tulsa OK", "Wichita KS", "Denver CO"];
  
  const num = Math.floor(Math.random() * 9000) + 100;
  const street = streets[Math.floor(Math.random() * streets.length)];
  const type = types[Math.floor(Math.random() * types.length)];
  const city = cities[Math.floor(Math.random() * cities.length)];

  return `${num} ${street} ${type}, ${city}`;
}
