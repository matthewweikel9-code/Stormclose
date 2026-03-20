/**
 * Storm provider resolver: per-user selection of HailTrace, Hail Recon, or Xweather.
 * Resolves to BYO provider when configured; otherwise uses Xweather (platform cost).
 * NWS and cache remain fallbacks when provider returns empty or errors.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClientLike = { from: (table: string) => any };
import { decryptStormProviderCredentials } from "./security";
import { fetchHailTraceStorms } from "./hailtrace";
import type { StormEvent, StormProviderResult, StormProviderSource } from "./types";
import {
  getStormReports,
  getActiveAlerts,
  getStormCells,
  getHailReports,
  XweatherStormReport,
  XweatherAlert,
  XweatherStormCell,
} from "@/lib/xweather";

export interface ResolveStormProviderParams {
  userId: string;
  lat: number;
  lng: number;
  radius?: number;
  live?: boolean;
  date?: string;
  days?: number;
}

export interface ResolvedStormResult extends StormProviderResult {
  source: StormProviderSource;
}

/**
 * Resolve which storm provider to use for the user and fetch data.
 * Order: HailTrace → Hail Recon → Xweather → NWS fallback
 */
export async function resolveStormProvider(
  supabase: SupabaseClientLike,
  params: ResolveStormProviderParams
): Promise<ResolvedStormResult> {
  const { userId, lat, lng, radius = 100, live, date, days = 30 } = params;

  // 1. Check for BYO storm provider (HailTrace first, then Hail Recon)
  const { data: hailTraceRow } = await (supabase as any)
    .from("storm_provider_integrations")
    .select("encrypted_credentials, settings_json")
    .eq("user_id", userId)
    .eq("provider", "hailtrace")
    .maybeSingle();

  if (hailTraceRow?.encrypted_credentials) {
    try {
      const apiKey = decryptStormProviderCredentials(hailTraceRow.encrypted_credentials);
      const settings = (hailTraceRow.settings_json as { defaultRadius?: number }) || {};
      const result = await fetchHailTraceStorms(apiKey, {
        lat,
        lng,
        radius: settings.defaultRadius ?? radius,
        live,
        date,
        days,
      });
      if (result.storms.length > 0) {
        return { ...result, source: "hailtrace" };
      }
      // HailTrace returned empty → fall through to Xweather
    } catch (err) {
      console.warn("[Storm Resolver] HailTrace failed, falling back:", err);
    }
  }

  const { data: hailReconRow } = await (supabase as any)
    .from("storm_provider_integrations")
    .select("encrypted_credentials, settings_json")
    .eq("user_id", userId)
    .eq("provider", "hailrecon")
    .maybeSingle();

  if (hailReconRow?.encrypted_credentials) {
    try {
      // Hail Recon adapter will be implemented in hailrecon-adapter todo
      const { fetchHailReconStorms } = await import("./hailrecon");
      const apiKey = decryptStormProviderCredentials(hailReconRow.encrypted_credentials);
      const settings = (hailReconRow.settings_json as { defaultRadius?: number }) || {};
      const result = await fetchHailReconStorms(apiKey, {
        lat,
        lng,
        radius: settings.defaultRadius ?? radius,
        live,
        date,
        days,
      });
      if (result.storms.length > 0) {
        return { ...result, source: "hailrecon" };
      }
    } catch (err) {
      console.warn("[Storm Resolver] Hail Recon failed, falling back:", err);
    }
  }

  // 2. Default: Xweather (platform cost)
  return fetchFromXweather(lat, lng, radius, live, date, days);
}

/**
 * Fetch from Xweather and normalize to StormProviderResult.
 * Used when no BYO provider is configured or BYO returned empty.
 */
async function fetchFromXweather(
  lat: number,
  lng: number,
  radius: number,
  live?: boolean,
  date?: string,
  days?: number
): Promise<ResolvedStormResult> {
  const dateStr = date || new Date().toISOString().split("T")[0];

  if (live) {
    const [alerts, cells, reports] = await Promise.all([
      getActiveAlerts(lat, lng).catch(() => []),
      getStormCells(lat, lng, radius).catch(() => []),
      getStormReports(lat, lng, radius, 1).catch(() => []),
    ]);
    const storms: StormEvent[] = formatXweatherReportsToStormEvents(reports);
    cells.forEach((cell, i) => {
      storms.push(formatXweatherCellToStormEvent(cell, i));
    });
    return {
      storms,
      alerts: formatXweatherAlerts(alerts),
      stormCells: formatXweatherCells(cells),
      source: "xweather",
    };
  }

  const daysAgo = Math.ceil((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
  const historicalReports = await getHailReports(
    lat,
    lng,
    radius,
    Math.max(daysAgo + 1, days ?? 30)
  ).catch(() => []);
  const storms = formatXweatherReportsToStormEvents(historicalReports).filter((s) =>
    s.startTime.startsWith(dateStr)
  );
  return {
    storms,
    alerts: [],
    stormCells: [],
    source: "xweather",
  };
}

function buildLocationLabel(input: {
  locationName?: string | null;
  county?: string | null;
  state?: string | null;
  lat: number;
  lng: number;
}): string {
  const parts: string[] = [];
  if (input.locationName) parts.push(input.locationName);
  if (input.county && input.state) parts.push(`${input.county.replace(/\s*county$/i, "").trim()} County, ${input.state}`);
  else if (input.state) parts.push(input.state);
  if (parts.length > 0) return parts.join(", ");
  return `${input.lat.toFixed(3)}, ${input.lng.toFixed(3)}`;
}

function formatXweatherReportsToStormEvents(reports: XweatherStormReport[]): StormEvent[] {
  return reports.map((r, i) => {
    const type = mapReportType(r.report.cat);
    const severity = calcReportSeverity(r);
    return {
      id: r.id || `report-${i}`,
      type,
      severity,
      hailSize: r.report.detail.hailIN,
      windSpeed: r.report.detail.windSpeedMPH,
      lat: r.loc.lat,
      lng: r.loc.long,
      radius: type === "tornado" ? 5 : type === "hail" ? 15 : 20,
      startTime: r.report.dateTimeISO,
      damageScore: calcReportDamageScore(r),
      location: buildLocationLabel({
        locationName: r.place.name,
        county: r.place.county,
        state: r.place.state,
        lat: r.loc.lat,
        lng: r.loc.long,
      }),
      county: r.place.county,
      state: r.place.state,
      comments: r.report.comments,
    };
  });
}

function formatXweatherCellToStormEvent(cell: XweatherStormCell, i: number): StormEvent {
  const severity = cell.traits.tornadic ? "extreme" : cell.traits.severe ? "severe" : cell.traits.hail ? "moderate" : "minor";
  return {
    id: cell.id || `cell-${i}`,
    type: (cell.traits.tornadic ? "tornado" : cell.traits.hail ? "hail" : "severe_thunderstorm") as StormEvent["type"],
    severity: severity as StormEvent["severity"],
    hailSize: cell.hail?.maxSizeIN,
    windSpeed: cell.track?.speedMPH,
    lat: cell.loc.lat,
    lng: cell.loc.long,
    radius: 10,
    startTime: cell.ob.dateTimeISO,
    damageScore: Math.min(100, 40 + (cell.traits.tornadic ? 40 : cell.traits.severe ? 25 : 15) + (cell.hail?.maxSizeIN || 0) * 10),
    path: cell.track?.points?.map((p) => ({ lat: p.lat, lng: p.long })),
    location: buildLocationLabel({
      locationName: cell.place.name,
      county: cell.place.county,
      state: cell.place.state,
      lat: cell.loc.lat,
      lng: cell.loc.long,
    }),
    county: cell.place.county,
    state: cell.place.state,
    isActive: true,
  };
}

function formatXweatherAlerts(alerts: XweatherAlert[]) {
  return alerts.map((a) => ({
    id: a.id,
    type: a.details.type,
    name: a.details.name,
    severity: a.details.cat,
    color: a.details.color,
    body: a.details.body,
    issuedAt: a.timestamps.issuedISO,
    expiresAt: a.timestamps.expiresISO,
    location: buildLocationLabel({
      locationName: a.place.name,
      county: a.includes?.counties?.[0] || null,
      state: a.place.state,
      lat: a.loc.lat,
      lng: a.loc.long,
    }),
    emergency: a.details.emergency,
  }));
}

function formatXweatherCells(cells: XweatherStormCell[]) {
  return cells.map((c) => ({
    id: c.id,
    lat: c.loc.lat,
    lng: c.loc.long,
    hailProb: c.hail?.prob || 0,
    hailProbSevere: c.hail?.probSevere || 0,
    maxHailSize: c.hail?.maxSizeIN || 0,
    tornadoProb: c.tornado?.prob || 0,
    isRotating: c.traits?.rotating || false,
    isSevere: c.traits?.severe || false,
    speedMph: c.track?.speedMPH || 0,
    direction: c.track?.directionDEG || 0,
    location: buildLocationLabel({
      locationName: c.place.name,
      county: c.place.county,
      state: c.place.state,
      lat: c.loc.lat,
      lng: c.loc.long,
    }),
  }));
}

function mapReportType(cat: string): "hail" | "wind" | "tornado" | "severe_thunderstorm" {
  switch (cat?.toLowerCase()) {
    case "hail":
      return "hail";
    case "tornado":
      return "tornado";
    case "wind":
      return "wind";
    default:
      return "severe_thunderstorm";
  }
}

function calcReportSeverity(r: XweatherStormReport): "minor" | "moderate" | "severe" | "extreme" {
  const hail = r.report.detail.hailIN || 0;
  const wind = r.report.detail.windSpeedMPH || 0;
  if (r.report.cat === "tornado" || hail >= 2.0 || wind >= 80) return "extreme";
  if (hail >= 1.0 || wind >= 60) return "severe";
  if (hail >= 0.5 || wind >= 40) return "moderate";
  return "minor";
}

function calcReportDamageScore(r: XweatherStormReport): number {
  let score = 50;
  const hail = r.report.detail.hailIN || 0;
  const wind = r.report.detail.windSpeedMPH || 0;
  if (r.report.cat === "tornado") score += 30;
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
