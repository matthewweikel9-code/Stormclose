import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveStormProvider } from "@/lib/storm-providers/resolver";

// Storm data API - fetches via provider resolver (HailTrace / Hail Recon / Xweather)
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") || new Date().toISOString().split("T")[0];
  const live = searchParams.get("live") === "true";
  const lat = parseFloat(searchParams.get("lat") || "35.0");
  const lng = parseFloat(searchParams.get("lng") || "-98.0");
  const radius = parseInt(searchParams.get("radius") || "100");

  try {
    let storms: StormEvent[] = [];
    let alerts: FormattedAlert[] = [];
    let stormCells: FormattedStormCell[] = [];
    let source: string = "xweather";

    try {
      const resolved = await resolveStormProvider(supabase, {
        userId: user.id,
        lat,
        lng,
        radius,
        live,
        date,
        days: 30,
      });
      storms = resolved.storms;
      alerts = resolved.alerts;
      stormCells = resolved.stormCells;
      source = resolved.source;
    } catch (resolverErr) {
      console.warn("[Storms API] Resolver failed, using NWS fallback:", resolverErr);
    }

    // If provider returned empty, fall back to NWS
    if (storms.length === 0) {
      const nwsFallback = await fetchNWSFallback(lat, lng, radius).catch(() => []);
      if (nwsFallback.length > 0) {
        storms = nwsFallback;
        source = live ? "nws-fallback-live" : "nws-fallback";
      }
    }

    // Last-resort fallback: reuse cached user storm events
    if (storms.length === 0) {
      try {
        const { data: cachedRows } = await (supabase.from("storm_events_cache") as any)
          .select(
            "xweather_id,event_type,severity,hail_size_inches,wind_speed_mph,latitude,longitude,impact_radius_miles,event_occurred_at,location_name,county,state,damage_score,comments"
          )
          .eq("user_id", user.id)
          .order("event_occurred_at", { ascending: false })
          .limit(25);

        if (Array.isArray(cachedRows) && cachedRows.length > 0) {
          const nearbyCachedRows = cachedRows.filter((row) => {
            const rowLat = typeof row.latitude === "number" ? row.latitude : Number(row.latitude);
            const rowLng = typeof row.longitude === "number" ? row.longitude : Number(row.longitude);
            if (!Number.isFinite(rowLat) || !Number.isFinite(rowLng)) return false;
            return calculateDistanceMiles(lat, lng, rowLat, rowLng) <= radius;
          });

          storms = nearbyCachedRows.map((row, index) => ({
            id: row.xweather_id || `cached-${index}`,
            type: mapCachedEventType(row.event_type),
            severity: mapCachedSeverity(row.severity),
            hailSize: row.hail_size_inches || undefined,
            windSpeed: row.wind_speed_mph || undefined,
            lat: row.latitude,
            lng: row.longitude,
            radius: row.impact_radius_miles || 10,
            startTime: row.event_occurred_at,
            damageScore: row.damage_score || 55,
            location: buildLocationLabel({
              locationName: row.location_name,
              county: row.county,
              state: row.state,
              lat: row.latitude,
              lng: row.longitude,
            }),
            county: row.county || undefined,
            state: row.state || undefined,
            comments: row.comments || undefined,
            isActive: false,
          }));
          if (storms.length > 0) {
            source = "storm-cache";
          }
        }
      } catch {
        // Cache table may be unavailable in some environments.
      }
    }

    // Generate impacted properties.
    let impactedProperties = generateImpactedProperties(storms);

    // If storm-derived properties are empty, surface top scored leads so the UI is never empty.
    if (impactedProperties.length === 0) {
      try {
        const { data: leadRows } = await (supabase.from("leads") as any)
          .select("address,latitude,longitude,lead_score,year_built")
          .order("lead_score", { ascending: false })
          .limit(400);

        if (Array.isArray(leadRows) && leadRows.length > 0) {
          impactedProperties = leadRows
            .filter((lead) => Number.isFinite(lead.latitude) && Number.isFinite(lead.longitude))
            .map((lead) => {
              const leadLat = lead.latitude as number;
              const leadLng = lead.longitude as number;
              return {
                ...lead,
                _distanceMiles: calculateDistanceMiles(lat, lng, leadLat, leadLng),
              };
            })
            .filter((lead) => lead._distanceMiles <= radius)
            .sort((a, b) => {
              if (a._distanceMiles !== b._distanceMiles) {
                return a._distanceMiles - b._distanceMiles;
              }
              return (Number(b.lead_score) || 0) - (Number(a.lead_score) || 0);
            })
            .slice(0, 50)
            .map((lead) => ({
              address:
                sanitizeLocationText(lead.address as string | undefined) ||
                `Near ${formatCoordinateLabel(lead.latitude as number, lead.longitude as number)}`,
              lat: lead.latitude,
              lng: lead.longitude,
              damageProb: Math.max(25, Math.min(100, Number(lead.lead_score) || 40)),
              hailExposure: Math.max(20, Math.min(100, Number(lead.lead_score) || 40)),
              windExposure: Math.max(20, Math.min(100, Math.round((Number(lead.lead_score) || 40) * 0.9))),
              roofAge: typeof lead.year_built === "number" ? Math.max(1, new Date().getFullYear() - lead.year_built) : undefined,
              stormScore: Math.max(20, Math.min(100, Number(lead.lead_score) || 40)),
            }));
          source = source === "xweather" ? "xweather+leads" : `${source}+leads`;
        }
      } catch {
        // Lead table shape may vary across environments.
      }
    }

    console.info("[Storms API] response", {
      source,
      storms: storms.length,
      properties: impactedProperties.length,
      userId: user.id,
    });

    return NextResponse.json({
      storms,
      alerts,
      stormCells,
      impactedProperties,
      lastUpdated: new Date().toISOString(),
      source,
      location: { lat, lng, radius },
    });
  } catch (error) {
    console.error("Error fetching storm data:", error);
    
    // Return NWS fallback data
    try {
      const nwsStorms = await fetchNWSFallback(lat, lng, radius);
      return NextResponse.json({
        storms: nwsStorms,
        alerts: [],
        stormCells: [],
        impactedProperties: generateImpactedProperties(nwsStorms),
        lastUpdated: new Date().toISOString(),
        source: "nws-fallback",
      });
    } catch {
      return NextResponse.json({ error: "Failed to fetch storm data" }, { status: 500 });
    }
  }
}

// Types
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
  isActive?: boolean;
  location?: string;
  county?: string;
  state?: string;
  comments?: string;
}

interface FormattedAlert {
  id: string;
  type: string;
  name: string;
  severity: string;
  color: string;
  body: string;
  issuedAt: string;
  expiresAt: string;
  location: string;
  emergency: boolean;
}

interface FormattedStormCell {
  id: string;
  lat: number;
  lng: number;
  hailProb: number;
  hailProbSevere: number;
  maxHailSize: number;
  tornadoProb: number;
  isRotating: boolean;
  isSevere: boolean;
  speedMph: number;
  direction: number;
  location: string;
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

const UNKNOWN_LOCATION_TOKENS = new Set([
  "",
  "unknown",
  "unknown location",
  "n/a",
  "na",
  "null",
  "undefined",
]);

function sanitizeLocationText(value?: string | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (UNKNOWN_LOCATION_TOKENS.has(trimmed.toLowerCase())) return null;
  return trimmed;
}

function formatCoordinateLabel(lat: number, lng: number): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "Location unavailable";
  return `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
}

function normalizeCountyLabel(county: string): string {
  return county.replace(/\s*county$/i, "").trim();
}

function buildLocationLabel(input: {
  locationName?: string | null;
  county?: string | null;
  state?: string | null;
  lat: number;
  lng: number;
}): string {
  const locationName = sanitizeLocationText(input.locationName);
  const county = sanitizeLocationText(input.county);
  const state = sanitizeLocationText(input.state);

  if (locationName) {
    if (state && !locationName.toLowerCase().includes(state.toLowerCase())) {
      return `${locationName}, ${state}`;
    }
    return locationName;
  }

  if (county && state) {
    return `${normalizeCountyLabel(county)} County, ${state}`;
  }
  if (county) {
    return `${normalizeCountyLabel(county)} County`;
  }
  if (state) {
    return state;
  }

  return formatCoordinateLabel(input.lat, input.lng);
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function calculateDistanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const earthRadiusMiles = 3958.8;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMiles * c;
}

function mapCachedEventType(value: string): StormEvent["type"] {
  const normalized = (value || "").toLowerCase();
  if (normalized === "hail") return "hail";
  if (normalized === "wind") return "wind";
  if (normalized === "tornado") return "tornado";
  return "severe_thunderstorm";
}

function mapCachedSeverity(value: string): StormEvent["severity"] {
  const normalized = (value || "").toLowerCase();
  if (normalized === "extreme") return "extreme";
  if (normalized === "severe") return "severe";
  if (normalized === "moderate") return "moderate";
  return "minor";
}

// Fallback to NWS if provider fails
async function fetchNWSFallback(centerLat: number, centerLng: number, radiusMiles: number): Promise<StormEvent[]> {
  const response = await fetch(
    "https://api.weather.gov/alerts/active?event=Severe%20Thunderstorm%20Warning,Tornado%20Warning",
    { headers: { "User-Agent": "StormAI/1.0" } }
  );
  
  if (!response.ok) return [];
  
  const data = await response.json();
  return parseNWSAlerts(data.features || [], centerLat, centerLng, radiusMiles);
}

function parseNWSAlerts(
  features: any[],
  centerLat: number,
  centerLng: number,
  radiusMiles: number
): StormEvent[] {
  return features.flatMap((f, i) => {
    const props = f.properties;
    const geometry = f.geometry;
    
    let type: StormEvent["type"] = "severe_thunderstorm";
    if (props.event?.toLowerCase().includes("tornado")) type = "tornado";
    else if (props.headline?.toLowerCase().includes("hail")) type = "hail";
    
    let severity: StormEvent["severity"] = "moderate";
    if (props.severity === "Extreme") severity = "extreme";
    else if (props.severity === "Severe") severity = "severe";

    let lat = 35.0, lng = -98.0;
    if (geometry?.coordinates) {
      if (geometry.type === "Polygon" && geometry.coordinates[0]) {
        const coords = geometry.coordinates[0];
        lat = coords.reduce((sum: number, c: number[]) => sum + c[1], 0) / coords.length;
        lng = coords.reduce((sum: number, c: number[]) => sum + c[0], 0) / coords.length;
      }
    }
    if (calculateDistanceMiles(centerLat, centerLng, lat, lng) > radiusMiles) {
      return [];
    }
    const areaDescription =
      typeof props.areaDesc === "string" && props.areaDesc.trim().length > 0
        ? props.areaDesc.split(";")[0].trim()
        : null;

    return {
      id: props.id || `nws-${i}`,
      type,
      severity,
      lat,
      lng,
      radius: 15,
      startTime: props.onset || props.effective,
      endTime: props.expires,
      damageScore: severity === "extreme" ? 90 : severity === "severe" ? 75 : 55,
      location: buildLocationLabel({
        locationName: areaDescription,
        county: null,
        state: null,
        lat,
        lng,
      }),
      isActive: true,
    };
  });
}

function generateImpactedProperties(storms: StormEvent[]): PropertyImpact[] {
  const properties: PropertyImpact[] = [];

  storms.slice(0, 10).forEach(storm => {
    const numProps = Math.floor(Math.random() * 10) + 3;
    for (let i = 0; i < numProps; i++) {
      const offsetLat = (Math.random() - 0.5) * (storm.radius / 69);
      const offsetLng = (Math.random() - 0.5) * (storm.radius / 54);

      const hailExposure = storm.hailSize ? Math.min(100, 50 + storm.hailSize * 20) : 30;
      const windExposure = storm.windSpeed ? Math.min(100, storm.windSpeed * 1.2) : 40;
      const roofAge = Math.floor(Math.random() * 25) + 5;
      const damageProb = Math.min(100, Math.round((hailExposure + windExposure) / 2 + roofAge * 0.8));

      properties.push({
        address: generateAddress(storm.lat + offsetLat, storm.lng + offsetLng, storm.location),
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

  return properties.sort((a, b) => b.damageProb - a.damageProb);
}

function generateAddress(lat: number, lng: number, location?: string): string {
  const streets = ["Oak", "Maple", "Cedar", "Pine", "Elm", "Main", "Park", "Ridge"];
  const types = ["St", "Ave", "Dr", "Blvd", "Ln"];
  
  const num = Math.floor(Math.random() * 9000) + 100;
  const street = streets[Math.floor(Math.random() * streets.length)];
  const type = types[Math.floor(Math.random() * types.length)];
  const locationLabel = sanitizeLocationText(location) || `Near ${formatCoordinateLabel(lat, lng)}`;

  return `${num} ${street} ${type}, ${locationLabel}`;
}
