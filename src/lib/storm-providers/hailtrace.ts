/**
 * HailTrace External API adapter
 * Maps HailTrace responses to normalized StormEvent format.
 * API: https://fa7c838b-developers.hailtrace.com/api/external/
 * Contact developers@hailtrace.com for API keys.
 *
 * Note: HailTrace's primary API is for hail history PDF reports. Raw hail event
 * data may be limited; this adapter orders reports and extracts what's available.
 * Live cells/alerts are not provided—use NWS fallback for those.
 */

import type { StormEvent, StormProviderResult } from "./types";

const HAILTRACE_BASE =
  process.env.HAILTRACE_API_BASE_URL || "https://fa7c838b-developers.hailtrace.com/api/external";

interface HailTraceReportOrder {
  street_address?: string;
  latitude?: string;
  longitude?: string;
  min_convective_date: string;
  max_convective_date: string;
  contractor_variant?: boolean;
  profile?: Record<string, unknown>;
}

interface HailTraceReportResponse {
  _id?: string;
  report_id?: string;
  street_address?: string;
  min_convective_date?: string;
  max_convective_date?: string;
  status?: string;
  latitude?: number;
  longitude?: number;
  hail_events?: Array<{
    date?: string;
    latitude?: number;
    longitude?: number;
    hail_size_inches?: number;
    location_name?: string;
    county?: string;
    state?: string;
  }>;
  location?: { geometry?: { coordinates?: [number, number] } };
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
  if (input.county && input.state) parts.push(`${input.county} County, ${input.state}`);
  else if (input.state) parts.push(input.state);
  if (parts.length > 0) return parts.join(", ");
  return `${input.lat.toFixed(3)}, ${input.lng.toFixed(3)}`;
}

function mapHailEventToStormEvent(
  evt: { date?: string; latitude?: number; longitude?: number; hail_size_inches?: number; location_name?: string; county?: string; state?: string },
  index: number
): StormEvent {
  const lat = evt.latitude ?? 0;
  const lng = evt.longitude ?? 0;
  const hailSize = evt.hail_size_inches ?? 0;
  let severity: StormEvent["severity"] = "minor";
  if (hailSize >= 2.0) severity = "extreme";
  else if (hailSize >= 1.0) severity = "severe";
  else if (hailSize >= 0.5) severity = "moderate";
  const damageScore = Math.min(100, Math.round(50 + hailSize * 20));
  return {
    id: `hailtrace-${evt.date || "unknown"}-${index}`,
    type: "hail",
    severity,
    hailSize: hailSize || undefined,
    lat,
    lng,
    radius: 10,
    startTime: evt.date ? `${evt.date}T12:00:00Z` : new Date().toISOString(),
    damageScore,
    location: buildLocationLabel({
      locationName: evt.location_name,
      county: evt.county,
      state: evt.state,
      lat,
      lng,
    }),
    county: evt.county,
    state: evt.state,
    isActive: false,
  };
}

/**
 * Fetch storm data from HailTrace using the user's API key.
 * HailTrace focuses on hail history reports; live cells/alerts not available.
 */
export async function fetchHailTraceStorms(
  apiKey: string,
  params: {
    lat: number;
    lng: number;
    radius: number;
    live?: boolean;
    date?: string;
    days?: number;
  }
): Promise<StormProviderResult> {
  const days = params.days ?? 30;
  const maxDate = new Date();
  const minDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const minStr = minDate.toISOString().split("T")[0];
  const maxStr = maxDate.toISOString().split("T")[0];

  try {
    // Order hail history report
    const orderBody: HailTraceReportOrder = {
      latitude: String(params.lat),
      longitude: String(params.lng),
      min_convective_date: minStr,
      max_convective_date: maxStr,
      contractor_variant: false,
    };

    const orderRes = await fetch(`${HAILTRACE_BASE}/hail-history-report`, {
      method: "POST",
      headers: {
        Authorization: apiKey.startsWith("Bearer ") ? apiKey : `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderBody),
    });

    if (!orderRes.ok) {
      console.warn("[HailTrace] Order failed:", orderRes.status, await orderRes.text());
      return { storms: [], alerts: [], stormCells: [], source: "hailtrace" };
    }

    const orderData = await orderRes.json();
    const reportId = orderData?.result?.report_id;
    if (!reportId) {
      return { storms: [], alerts: [], stormCells: [], source: "hailtrace" };
    }

    // Poll for report completion (with timeout)
    let report: HailTraceReportResponse | null = null;
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const getRes = await fetch(`${HAILTRACE_BASE}/hail-history-report/${reportId}`, {
        headers: { Authorization: apiKey.startsWith("Bearer ") ? apiKey : `Bearer ${apiKey}` },
      });
      if (!getRes.ok) break;
      report = await getRes.json();
      if (report?.status === "COMPLETE") break;
    }

    if (!report || report.status !== "COMPLETE") {
      return { storms: [], alerts: [], stormCells: [], source: "hailtrace" };
    }

    // Map hail_events if present; otherwise create single event from report location
    const storms: StormEvent[] = [];
    if (Array.isArray(report.hail_events) && report.hail_events.length > 0) {
      report.hail_events.forEach((evt, i) => storms.push(mapHailEventToStormEvent(evt, i)));
    } else if (report.latitude != null && report.longitude != null) {
      // No structured hail events—create one from report centroid
      storms.push(
        mapHailEventToStormEvent(
          {
            date: report.min_convective_date || maxStr,
            latitude: report.latitude,
            longitude: report.longitude,
            hail_size_inches: 0.75,
            location_name: report.street_address,
          },
          0
        )
      );
    }

    return {
      storms,
      alerts: [],
      stormCells: [],
      source: "hailtrace",
    };
  } catch (err) {
    console.warn("[HailTrace] Adapter error:", err);
    return { storms: [], alerts: [], stormCells: [], source: "hailtrace" };
  }
}
