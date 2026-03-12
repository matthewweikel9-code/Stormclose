import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getStormReports,
  getActiveAlerts,
  getStormCells,
  getHailReports,
  XweatherStormReport,
  XweatherAlert,
  XweatherStormCell,
} from "@/lib/xweather";

// Storm data API - fetches live and historical storm data from Xweather
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

    if (live) {
      // Fetch LIVE data from Xweather
      const [xweatherAlerts, xweatherCells, recentReports] = await Promise.all([
        getActiveAlerts(lat, lng).catch(() => []),
        getStormCells(lat, lng, radius).catch(() => []),
        getStormReports(lat, lng, radius, 1).catch(() => []), // Last 24 hours
      ]);

      // Format alerts
      alerts = formatXweatherAlerts(xweatherAlerts);

      // Format active storm cells
      stormCells = formatStormCells(xweatherCells);

      // Convert reports to storm events
      storms = formatStormReports(recentReports);

      // Add storm cells as events too
      xweatherCells.forEach((cell, i) => {
        storms.push({
          id: cell.id || `cell-${i}`,
          type: cell.traits.tornadic ? "tornado" : cell.traits.hail ? "hail" : "severe_thunderstorm",
          severity: getSeverityFromCell(cell),
          hailSize: cell.hail?.maxSizeIN || undefined,
          windSpeed: cell.track?.speedMPH || undefined,
          lat: cell.loc.lat,
          lng: cell.loc.long,
          radius: 10,
          startTime: cell.ob.dateTimeISO,
          damageScore: calculateCellDamageScore(cell),
          path: cell.track?.points?.map(p => ({ lat: p.lat, lng: p.long })) || undefined,
          isActive: true,
        });
      });

    } else {
      // Fetch HISTORICAL data from Xweather
      const daysAgo = Math.ceil((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
      
      const historicalReports = await getHailReports(lat, lng, radius, Math.max(daysAgo + 1, 30)).catch(() => []);
      
      // Filter to selected date
      storms = formatStormReports(historicalReports).filter(storm => {
        return storm.startTime.startsWith(date);
      });
    }

    // Generate impacted properties (in production, use CoreLogic API)
    const impactedProperties = generateImpactedProperties(storms);

    return NextResponse.json({
      storms,
      alerts,
      stormCells,
      impactedProperties,
      lastUpdated: new Date().toISOString(),
      source: "xweather",
      location: { lat, lng, radius },
    });
  } catch (error) {
    console.error("Error fetching storm data:", error);
    
    // Return NWS fallback data
    try {
      const nwsStorms = await fetchNWSFallback();
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

// Format Xweather alerts
function formatXweatherAlerts(alerts: XweatherAlert[]): FormattedAlert[] {
  return alerts.map(alert => ({
    id: alert.id,
    type: alert.details.type,
    name: alert.details.name,
    severity: alert.details.cat,
    color: alert.details.color,
    body: alert.details.body,
    issuedAt: alert.timestamps.issuedISO,
    expiresAt: alert.timestamps.expiresISO,
    location: `${alert.place.name}, ${alert.place.state}`,
    emergency: alert.details.emergency,
  }));
}

// Format storm cells
function formatStormCells(cells: XweatherStormCell[]): FormattedStormCell[] {
  return cells.map(cell => ({
    id: cell.id,
    lat: cell.loc.lat,
    lng: cell.loc.long,
    hailProb: cell.hail?.prob || 0,
    hailProbSevere: cell.hail?.probSevere || 0,
    maxHailSize: cell.hail?.maxSizeIN || 0,
    tornadoProb: cell.tornado?.prob || 0,
    isRotating: cell.traits?.rotating || false,
    isSevere: cell.traits?.severe || false,
    speedMph: cell.track?.speedMPH || 0,
    direction: cell.track?.directionDEG || 0,
    location: `${cell.place.name}, ${cell.place.state}`,
  }));
}

// Convert Xweather storm reports to our format
function formatStormReports(reports: XweatherStormReport[]): StormEvent[] {
  return reports.map((report, i) => {
    const type = mapReportType(report.report.cat);
    const severity = calculateReportSeverity(report);
    
    return {
      id: report.id || `report-${i}`,
      type,
      severity,
      hailSize: report.report.detail.hailIN || undefined,
      windSpeed: report.report.detail.windSpeedMPH || undefined,
      lat: report.loc.lat,
      lng: report.loc.long,
      radius: type === "tornado" ? 5 : type === "hail" ? 15 : 20,
      startTime: report.report.dateTimeISO,
      damageScore: calculateReportDamageScore(report),
      location: `${report.place.name}, ${report.place.state}`,
      county: report.place.county,
      state: report.place.state,
      comments: report.report.comments,
    };
  });
}

function mapReportType(cat: string): StormEvent["type"] {
  switch (cat?.toLowerCase()) {
    case "hail": return "hail";
    case "tornado": return "tornado";
    case "wind": return "wind";
    default: return "severe_thunderstorm";
  }
}

function calculateReportSeverity(report: XweatherStormReport): StormEvent["severity"] {
  const hail = report.report.detail.hailIN || 0;
  const wind = report.report.detail.windSpeedMPH || 0;
  
  if (report.report.cat === "tornado" || hail >= 2.0 || wind >= 80) return "extreme";
  if (hail >= 1.0 || wind >= 60) return "severe";
  if (hail >= 0.5 || wind >= 40) return "moderate";
  return "minor";
}

function calculateReportDamageScore(report: XweatherStormReport): number {
  let score = 50;
  
  const hail = report.report.detail.hailIN || 0;
  const wind = report.report.detail.windSpeedMPH || 0;
  
  if (report.report.cat === "tornado") score += 30;
  
  if (hail >= 2.5) score += 35;
  else if (hail >= 2.0) score += 25;
  else if (hail >= 1.5) score += 18;
  else if (hail >= 1.0) score += 12;
  else if (hail >= 0.5) score += 5;
  
  if (wind >= 100) score += 25;
  else if (wind >= 80) score += 18;
  else if (wind >= 60) score += 10;
  else if (wind >= 40) score += 5;
  
  return Math.min(100, Math.round(score));
}

function getSeverityFromCell(cell: XweatherStormCell): StormEvent["severity"] {
  if (cell.traits.tornadic) return "extreme";
  if (cell.traits.severe && (cell.hail?.maxSizeIN || 0) >= 1.5) return "extreme";
  if (cell.traits.severe) return "severe";
  if (cell.traits.hail) return "moderate";
  return "minor";
}

function calculateCellDamageScore(cell: XweatherStormCell): number {
  let score = 40;
  
  if (cell.traits.tornadic) score += 40;
  else if (cell.traits.severe) score += 25;
  else if (cell.traits.hail) score += 15;
  
  const maxHail = cell.hail?.maxSizeIN || 0;
  if (maxHail >= 2.0) score += 20;
  else if (maxHail >= 1.0) score += 12;
  else if (maxHail >= 0.5) score += 5;
  
  if (cell.tornado?.prob && cell.tornado.prob > 50) score += 15;
  
  return Math.min(100, Math.round(score));
}

// Fallback to NWS if Xweather fails
async function fetchNWSFallback(): Promise<StormEvent[]> {
  const response = await fetch(
    "https://api.weather.gov/alerts/active?event=Severe%20Thunderstorm%20Warning,Tornado%20Warning",
    { headers: { "User-Agent": "StormAI/1.0" } }
  );
  
  if (!response.ok) return [];
  
  const data = await response.json();
  return parseNWSAlerts(data.features || []);
}

function parseNWSAlerts(features: any[]): StormEvent[] {
  return features.slice(0, 25).map((f, i) => {
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

  return `${num} ${street} ${type}, ${location || "Unknown"}`;
}
