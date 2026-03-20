"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useGeolocation } from "@/hooks/useGeolocation";
import type { MapMarker, StormPath, MapCircle } from "@/components/ui/MapboxMap";
import { StormOpsHeader } from "@/components/storm-ops/StormOpsHeader";
import { KPIStrip } from "@/components/storm-ops/KPIStrip";

// Dynamic import for Mapbox (client-side only)
const MapboxMap = dynamic(() => import("@/components/ui/MapboxMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-storm-z0">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-storm-purple border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-storm-muted">Loading map...</span>
      </div>
    </div>
  ),
});

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

type TimelineSeverity = "minor" | "moderate" | "severe" | "extreme";
type MissionStatus = "planned" | "in_progress" | "completed" | "cancelled";
type MissionOutcome =
  | "pending"
  | "knocked"
  | "not_home"
  | "not_interested"
  | "appointment_set"
  | "inspection_set"
  | "already_filed"
  | "skipped";

interface TimelineEvent {
  id: string;
  type: "hail" | "wind" | "tornado" | "severe_thunderstorm";
  severity: TimelineSeverity;
  hailSize?: number | null;
  windSpeed?: number | null;
  damageScore: number;
  location: string;
  county?: string | null;
  state?: string | null;
  lat: number;
  lng: number;
  occurredAt: string;
  estimatedProperties: number;
  estimatedOpportunity: number;
  propertiesCanvassed: number;
  leadsGenerated: number;
  appointmentsSet: number;
  revenueCapured: number;
  canvassPct: number;
  missionCount: number;
  daysAgo: number;
  source: "cached" | "live";
}

interface Mission {
  id: string;
  name: string;
  status: MissionStatus;
  totalStops: number;
  stopsCompleted: number;
  stopsKnocked: number;
  stopsNotHome: number;
  appointmentsSet: number;
  leadsCreated: number;
  estimatedPipeline: number;
  scheduledDate: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface MissionStop {
  id: string;
  stopOrder: number;
  address: string;
  lat: number;
  lng: number;
  ownerName: string | null;
  roofAge: number | null;
  estimatedClaim: number;
  outcome: MissionOutcome;
  outcomeNotes: string | null;
  homeownerName: string | null;
  homeownerPhone: string | null;
}

interface ParcelResult {
  id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  owner: string;
  propertyType: string;
  typeCode: string;
  lat: number;
  lng: number;
}

/** Format pipeline/opportunity in dollars: $X, $XK, or $X.XM */
function formatPipeline(value: number): string {
  const n = Number(value) || 0;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

interface RouteInfo {
  totalDistance: string;
  totalDuration: string;
  legs: {
    distance: string;
    duration: string;
    startAddress: string;
    endAddress: string;
  }[];
}

type ApiEnvelope<T> = {
  data: T | null;
  error: string | null;
  meta?: Record<string, unknown>;
};

function unwrapApiData<T>(payload: unknown): T | null {
  if (!payload || typeof payload !== "object") return null;
  if ("data" in payload) {
    return (payload as ApiEnvelope<T>).data ?? null;
  }
  return payload as T;
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

function resolveDisplayLocation(input: {
  location?: string | null;
  county?: string | null;
  state?: string | null;
  lat: number;
  lng: number;
}): string {
  const locationName = sanitizeLocationText(input.location);
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

function getMissionCityLabel(location: string, lat: number): string {
  const clean = sanitizeLocationText(location);
  if (!clean) return `Lat ${lat.toFixed(3)}`;
  return clean.split(",")[0].trim();
}

function resolveStopAddress(stop: MissionStop): string {
  const address = sanitizeLocationText(stop.address);
  if (address) return address;
  return `Near ${formatCoordinateLabel(stop.lat, stop.lng)}`;
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

function isValidCoordinate(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

function stormToTimelineEvent(storm: StormEvent): TimelineEvent {
  const occurredAt = storm.startTime || new Date().toISOString();
  const daysAgo = Math.max(
    0,
    Math.floor((Date.now() - new Date(occurredAt).getTime()) / (1000 * 60 * 60 * 24))
  );
  const estimatedProperties = Math.max(50, Math.round(Math.PI * Math.max(1, storm.radius) * 110));
  const avgClaimValue = storm.type === "tornado" ? 25000 : storm.type === "hail" ? 14000 : 9000;
  const estimatedOpportunity = estimatedProperties * avgClaimValue;

  return {
    id: `storm-${storm.id}`,
    type: storm.type,
    severity: storm.severity,
    hailSize: storm.hailSize ?? null,
    windSpeed: storm.windSpeed ?? null,
    damageScore: storm.damageScore,
    location: resolveDisplayLocation({
      location: storm.location ?? null,
      county: storm.county ?? null,
      state: storm.state ?? null,
      lat: storm.lat,
      lng: storm.lng,
    }),
    county: storm.county ?? null,
    state: storm.state ?? null,
    lat: storm.lat,
    lng: storm.lng,
    occurredAt,
    estimatedProperties,
    estimatedOpportunity,
    propertiesCanvassed: 0,
    leadsGenerated: 0,
    appointmentsSet: 0,
    revenueCapured: 0,
    canvassPct: 0,
    missionCount: 0,
    daysAgo,
    source: "live",
  };
}

export default function StormMapPage() {
  const [activeLayer, setActiveLayer] = useState<"hail" | "wind" | "damage" | "radar" | "all">("all");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [isLive, setIsLive] = useState(false);
  const [storms, setStorms] = useState<StormEvent[]>([]);
  const [alerts, setAlerts] = useState<FormattedAlert[]>([]);
  const [impactedProperties, setImpactedProperties] = useState<PropertyImpact[]>([]);
  const [selectedStorm, setSelectedStorm] = useState<StormEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState<string>("loading");
  const [showRadar, setShowRadar] = useState(true);
  const [timelineDays, setTimelineDays] = useState(30);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [selectedTimelineEvent, setSelectedTimelineEvent] = useState<TimelineEvent | null>(null);
  const [missionLoading, setMissionLoading] = useState(false);
  const [missionError, setMissionError] = useState<string | null>(null);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [activeMission, setActiveMission] = useState<Mission | null>(null);
  const [missionStops, setMissionStops] = useState<MissionStop[]>([]);
  const [missionRouteInfo, setMissionRouteInfo] = useState<RouteInfo | null>(null);

  // JobNimbus export
  const [jobnimbusConnected, setJobnimbusConnected] = useState(false);
  const [exportedStopIds, setExportedStopIds] = useState<Set<string>>(new Set());

  // Nearby houses (Neighborhood Engine) - shown when Knocked/Appt clicked
  interface NearbyOpportunity {
    address: string;
    city: string;
    state: string;
    zip: string;
    coordinates: { lat: number; lng: number };
    opportunityScore: number;
    actionLabel: string;
    recommendedScript: string;
    anchorDistanceMiles: number;
    estimatedValueRange: { low: number; high: number } | null;
  }
  const [nearbyOpportunities, setNearbyOpportunities] = useState<NearbyOpportunity[]>([]);
  const [nearbyAnchorStop, setNearbyAnchorStop] = useState<MissionStop | null>(null);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState<string | null>(null);
  const [nearbySource, setNearbySource] = useState<"corelogic" | "openstreetmap" | null>(null);
  
  // Geolocation hook - auto-fetch on mount
  const { 
    latitude, 
    longitude, 
    loading: geoLoading, 
    error: geoError,
    getLocation,
    hasLocation 
  } = useGeolocation({ autoFetch: true });

  const [focusedMapCenter, setFocusedMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [focusedMapZoom, setFocusedMapZoom] = useState<number | null>(null);

  // Map center defaults to geolocation unless user focuses timeline/mission events
  const mapCenter = focusedMapCenter ?? (
    hasLocation 
      ? { lat: latitude!, lng: longitude! }
      : { lat: 39.8283, lng: -98.5795 }
  );
  const mapZoom = focusedMapZoom ?? (hasLocation ? 8 : 5);

  // Fetch storm data
  const fetchStormData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        date: selectedDate,
        live: isLive.toString(),
        lat: (latitude || 35.0).toString(),
        lng: (longitude || -98.0).toString(),
        radius: "150",
      });

      const response = await fetch(`/api/storms?${params}`);
      if (response.ok) {
        const data = await response.json();
        setStorms(data.storms || []);
        setAlerts(data.alerts || []);
        setImpactedProperties(data.impactedProperties || []);
        setDataSource(data.source || "unknown");
      }
    } catch (error) {
      console.error("Error fetching storm data:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, isLive, latitude, longitude]);

  const [timelineError, setTimelineError] = useState<string | null>(null);

  const fetchTimeline = useCallback(async (lat: number, lng: number, days: number) => {
    setTimelineLoading(true);
    setTimelineError(null);
    try {
      const res = await fetch(`/api/storms/timeline?lat=${lat}&lng=${lng}&days=${days}&radius=150`);
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTimeline([]);
        setTimelineError((payload as { error?: string; details?: string }).error || (payload as { details?: string }).details || `API error ${res.status}`);
        return;
      }
      setTimeline(Array.isArray(payload.timeline) ? payload.timeline : []);
    } catch (error) {
      console.error("Timeline fetch error:", error);
      setTimeline([]);
      setTimelineError(error instanceof Error ? error.message : "Network error");
    } finally {
      setTimelineLoading(false);
    }
  }, []);

  const fetchMissions = useCallback(async () => {
    try {
      const missionLat = latitude || 35.0;
      const missionLng = longitude || -98.0;
      const params = new URLSearchParams({
        limit: "20",
        lat: missionLat.toString(),
        lng: missionLng.toString(),
        radiusMiles: "250",
      });
      const res = await fetch(`/api/missions?${params.toString()}`);
      if (!res.ok) {
        setMissions([]);
        return;
      }
      const payload = await res.json();
      const missionRows = unwrapApiData<Mission[]>(payload);
      const nextMissions = Array.isArray(missionRows) ? missionRows : [];
      setMissions(nextMissions);
      if (nextMissions.length === 0) {
        setActiveMission(null);
        setMissionStops([]);
        setMissionRouteInfo(null);
      }
    } catch (error) {
      console.error("Missions fetch error:", error);
      setMissions([]);
    }
  }, [latitude, longitude]);

  const fetchMissionDetail = useCallback(async (missionId: string) => {
    setMissionLoading(true);
    setMissionError(null);
    try {
      const res = await fetch(`/api/missions/${missionId}`);
      const payload = await res.json().catch(() => null);
      const detail = unwrapApiData<{ mission: Mission; stops: MissionStop[] }>(payload);
      if (!res.ok || !detail?.mission) {
        throw new Error((payload as { error?: string } | null)?.error || "Failed to load mission details");
      }
      setActiveMission(detail.mission);
      setMissionStops(Array.isArray(detail.stops) ? detail.stops : []);
      setMissionRouteInfo(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load mission details";
      console.error("Mission detail error:", error);
      setMissionError(message);
    } finally {
      setMissionLoading(false);
    }
  }, []);

  const fetchJobnimbusData = useCallback(async () => {
    try {
      const statusRes = await fetch("/api/jobnimbus/status");
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setJobnimbusConnected(!!statusData.connected);
      }
    } catch (err) {
      console.error("JobNimbus fetch error:", err);
    }
  }, []);

  const optimizeMissionRoute = useCallback(async (stops: MissionStop[]) => {
    if (stops.length < 2) {
      setMissionRouteInfo(null);
      return;
    }

    try {
      const routeRes = await fetch("/api/route-optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          waypoints: stops.map((s) => `${s.lat},${s.lng}`),
          optimizeWaypoints: true,
        }),
      });
      if (!routeRes.ok) return;

      const routeData = await routeRes.json();
      setMissionRouteInfo(routeData.routeInfo || null);

      if (Array.isArray(routeData.waypointOrder) && routeData.waypointOrder.length > 0 && stops.length > 2) {
        const middleStops = stops.slice(1, -1);
        const reorderedStops = [
          stops[0],
          ...routeData.waypointOrder.map((index: number) => middleStops[index]).filter(Boolean),
          stops[stops.length - 1],
        ].map((stop, index) => ({ ...stop, stopOrder: index + 1 }));
        setMissionStops(reorderedStops);
      }
    } catch (error) {
      console.error("Mission route optimization error:", error);
    }
  }, []);

  const deployToTimelineEvent = useCallback(async (event: TimelineEvent) => {
    setMissionLoading(true);
    setMissionError(null);
    try {
      const parcelRes = await fetch(
        `/api/corelogic/parcels?lat=${event.lat}&lng=${event.lng}&radius=1&pageSize=50&all=true`
      );
      let scannedParcels: ParcelResult[] = [];
      if (parcelRes.ok) {
        const parcelPayload = await parcelRes.json();
        scannedParcels = Array.isArray(parcelPayload.parcels) ? parcelPayload.parcels : [];
      } else {
        const errorBody = await parcelRes.json().catch(() => ({}));
        const isRateLimit = parcelRes.status === 429 || (errorBody as { code?: string }).code === "RATE_LIMIT";
        if (isRateLimit) {
          setMissionError("CoreLogic daily quota reached. Mission created with storm center only.");
        }
      }

      type DraftStop = {
        address: string;
        city: string;
        state: string;
        zip: string;
        lat: number;
        lng: number;
        owner_name: string | null;
        property_type: string;
      };

      const draftStops = new Map<string, DraftStop>();
      const pushDraftStop = (candidate: DraftStop) => {
        if (!isValidCoordinate(candidate.lat, candidate.lng)) return;
        const cleanAddress =
          sanitizeLocationText(candidate.address) ||
          `Near ${formatCoordinateLabel(candidate.lat, candidate.lng)}`;
        const key = `${candidate.lat.toFixed(5)}|${candidate.lng.toFixed(5)}|${cleanAddress.toLowerCase()}`;
        if (draftStops.has(key)) return;
        draftStops.set(key, {
          address: cleanAddress,
          city:
            sanitizeLocationText(candidate.city) ||
            getMissionCityLabel(cleanAddress, candidate.lat),
          state: sanitizeLocationText(candidate.state) || "",
          zip: sanitizeLocationText(candidate.zip) || "",
          lat: candidate.lat,
          lng: candidate.lng,
          owner_name: candidate.owner_name,
          property_type:
            sanitizeLocationText(candidate.property_type) || "Residential",
        });
      };

      const residentialCodes = new Set([
        "SFR",
        "MFR",
        "CON",
        "TH",
        "MOB",
        "RES",
        "R",
        "DUP",
        "TRI",
        "QUAD",
      ]);
      const residentialLabelPattern =
        /(single|multi|residential|condo|town|mobile|duplex|triplex|quad|apartment)/i;

      const parcelStops = scannedParcels
        .map((parcel) => ({
          address: `${parcel.address || ""}, ${parcel.city || ""}, ${parcel.state || ""} ${parcel.zip || ""}`
            .replace(/\s+/g, " ")
            .replace(/,\s*,/g, ",")
            .replace(/,\s*$/g, "")
            .trim(),
          city: parcel.city || "",
          state: parcel.state || "",
          zip: parcel.zip || "",
          lat: Number(parcel.lat),
          lng: Number(parcel.lng),
          owner_name: sanitizeLocationText(parcel.owner),
          property_type: parcel.propertyType || "Residential",
          typeCode: (parcel.typeCode || "").toUpperCase(),
        }))
        .filter((stop) => isValidCoordinate(stop.lat, stop.lng));

      const residentialParcelStops = parcelStops.filter(
        (stop) =>
          residentialCodes.has(stop.typeCode) ||
          residentialLabelPattern.test(stop.property_type)
      );

      const parcelStopsToUse =
        residentialParcelStops.length > 0 ? residentialParcelStops : parcelStops;
      parcelStopsToUse.slice(0, 23).forEach((stop) =>
        pushDraftStop({
          address: stop.address,
          city: stop.city,
          state: stop.state,
          zip: stop.zip,
          lat: stop.lat,
          lng: stop.lng,
          owner_name: stop.owner_name,
          property_type: stop.property_type,
        })
      );

      // Fallback #1: nearby lead API (same geo center) if parcel list is sparse.
      if (draftStops.size < 8) {
        try {
          const nearbyRes = await fetch(
            `/api/leads/nearby?lat=${event.lat}&lng=${event.lng}&radius=1&limit=25`
          );
          if (nearbyRes.ok) {
            const nearbyPayload = await nearbyRes.json();
            const nearbyLeads: Array<Record<string, unknown>> = Array.isArray(nearbyPayload.leads)
              ? nearbyPayload.leads
              : [];
            nearbyLeads.forEach((lead) => {
              pushDraftStop({
                address: String(lead.address || "").trim(),
                city: String(lead.city || ""),
                state: String(lead.state || ""),
                zip: String(lead.zip || ""),
                lat: Number(lead.latitude),
                lng: Number(lead.longitude),
                owner_name:
                  typeof lead.owner_name === "string" ? lead.owner_name : null,
                property_type:
                  typeof lead.property_type === "string"
                    ? lead.property_type
                    : "Residential",
              });
            });
          }
        } catch (nearbyError) {
          console.warn("Nearby lead fallback failed:", nearbyError);
        }
      }

      // Fallback #2: current high-impact properties near selected storm.
      if (draftStops.size < 8) {
        impactedProperties
          .filter((property) => isValidCoordinate(property.lat, property.lng))
          .map((property) => ({
            ...property,
            _distanceMiles: calculateDistanceMiles(
              event.lat,
              event.lng,
              property.lat,
              property.lng
            ),
          }))
          .filter((property) => property._distanceMiles <= 12)
          .sort((a, b) => a._distanceMiles - b._distanceMiles)
          .slice(0, 25)
          .forEach((property) => {
            pushDraftStop({
              address:
                sanitizeLocationText(property.address) ||
                `Near ${formatCoordinateLabel(property.lat, property.lng)}`,
              city: "",
              state: sanitizeLocationText(event.state) || "",
              zip: "",
              lat: property.lat,
              lng: property.lng,
              owner_name: null,
              property_type: "Residential",
            });
          });
      }

      const eventLocation = resolveDisplayLocation({
        location: event.location ?? null,
        county: event.county ?? null,
        state: event.state ?? null,
        lat: event.lat,
        lng: event.lng,
      });

      const stops =
        draftStops.size > 0
          ? Array.from(draftStops.values()).slice(0, 23)
          : [
              {
                address: eventLocation,
                city: getMissionCityLabel(eventLocation, event.lat),
                state: sanitizeLocationText(event.state) || "",
                zip: "",
                lat: event.lat,
                lng: event.lng,
                owner_name: null,
                property_type: "Residential",
              },
            ];

      const missionRes = await fetch("/api/missions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Storm Route: ${eventLocation}${event.hailSize ? ` (${event.hailSize}")` : ""}`,
          description: `Deployed from timeline ${event.daysAgo === 0 ? "today" : `${event.daysAgo}d ago`} for ${event.type}.`,
          stormEventId: event.id,
          centerLat: event.lat,
          centerLng: event.lng,
          radiusMiles: 1.0,
          stops,
          scheduledDate: new Date().toISOString().slice(0, 10),
        }),
      });

      const missionPayload = await missionRes.json().catch(() => null);
      const missionData = unwrapApiData<{ mission: Mission; stops: MissionStop[] }>(missionPayload);
      if (!missionRes.ok || !missionData?.mission) {
        throw new Error((missionPayload as { error?: string } | null)?.error || "Failed to create mission");
      }

      setActiveMission(missionData.mission);
      setMissionStops(Array.isArray(missionData.stops) ? missionData.stops : []);
      setFocusedMapCenter({ lat: event.lat, lng: event.lng });
      setFocusedMapZoom(13);
      await fetchMissions();
      await optimizeMissionRoute(Array.isArray(missionData.stops) ? missionData.stops : []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to deploy mission";
      console.error("Deploy mission error:", error);
      setMissionError(message);
    } finally {
      setMissionLoading(false);
    }
  }, [fetchMissions, impactedProperties, optimizeMissionRoute]);

  const fetchNearbyOpportunities = useCallback(async (stop: MissionStop) => {
    const hasCoords = Number.isFinite(stop.lat) && Number.isFinite(stop.lng) && stop.lat !== 0 && stop.lng !== 0;
    const fullAddress = [stop.address, (stop as { city?: string }).city, (stop as { state?: string }).state, (stop as { zip?: string }).zip]
      .filter(Boolean)
      .join(", ")
      .trim() || stop.address?.trim();
    if (!hasCoords && !fullAddress) return;
    setNearbyLoading(true);
    setNearbyError(null);
    setNearbyAnchorStop(stop);
    try {
      const params = new URLSearchParams({ radius: "1", limit: "20" });
      if (hasCoords) {
        params.set("lat", String(stop.lat));
        params.set("lng", String(stop.lng));
      } else {
        params.set("address", fullAddress);
      }
      const res = await fetch(`/api/neighborhood-engine/opportunities?${params.toString()}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 403) {
          setNearbyError("Upgrade to Pro to see nearby houses");
          setNearbyOpportunities([]);
        } else {
          setNearbyError(json.error || "Failed to load nearby houses");
          setNearbyOpportunities([]);
        }
        return;
      }
      const data = json.data ?? json;
      setNearbyOpportunities(Array.isArray(data.opportunities) ? data.opportunities : []);
      setNearbySource(data.source === "openstreetmap" ? "openstreetmap" : data.source === "corelogic" ? "corelogic" : null);
      const hint = data.hint;
      setNearbyError(
        Array.isArray(data.opportunities) && data.opportunities.length === 0 && hint
          ? hint
          : null
      );
    } catch (e) {
      setNearbyError(e instanceof Error ? e.message : "Failed to load nearby houses");
      setNearbyOpportunities([]);
    } finally {
      setNearbyLoading(false);
    }
  }, []);

  const updateMissionStatus = useCallback(
    async (action: "start" | "complete" | "cancel") => {
      if (!activeMission) return;
      setMissionLoading(true);
      setMissionError(null);
      try {
        const res = await fetch("/api/missions", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            missionId: activeMission.id,
            action,
          }),
        });

        const payload = await res.json().catch(() => null);
        const missionData = unwrapApiData<{ mission: Mission; stops: MissionStop[] }>(payload);
        if (!res.ok || !missionData?.mission) {
          throw new Error((payload as { error?: string } | null)?.error || "Mission update failed");
        }

        setActiveMission(missionData.mission);
        setMissionStops(Array.isArray(missionData.stops) ? missionData.stops : []);
        await fetchMissions();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Mission update failed";
        console.error("Mission status update error:", error);
        setMissionError(message);
      } finally {
        setMissionLoading(false);
      }
    },
    [activeMission, fetchMissions]
  );

  const updateStopOutcome = useCallback(
    async (stopId: string, outcome: MissionOutcome) => {
      if (!activeMission) return;
      setMissionLoading(true);
      setMissionError(null);
      try {
        const res = await fetch("/api/missions", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            missionId: activeMission.id,
            action: "update_stop",
            stopId,
            outcome,
          }),
        });

        const payload = await res.json().catch(() => null);
        const missionData = unwrapApiData<{ mission: Mission; stops: MissionStop[] }>(payload);
        if (!res.ok || !missionData?.mission) {
          throw new Error((payload as { error?: string } | null)?.error || "Stop outcome update failed");
        }

        setActiveMission(missionData.mission);
        const updatedStops = Array.isArray(missionData.stops) ? missionData.stops : [];
        setMissionStops(updatedStops);

        // Fetch nearby houses when Knocked or Appt
        if (outcome === "knocked" || outcome === "appointment_set") {
          const stop = missionStops.find((s) => s.id === stopId);
          if (stop) void fetchNearbyOpportunities(stop);
        }

        // Appointment set: run workflow (estimate, materials, xactimate) then CRM export with packet
        if (outcome === "appointment_set") {
          let workflowOutput: { estimate?: { costRange?: { low: number; high: number }; roofSquares?: number }; materials?: { bomText?: string }; xactimatePacket?: { scope?: string; lineItems?: string } } | undefined;
          try {
            const workflowRes = await fetch("/api/workflows/appointment-set", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ stopId }),
            });
            const workflowData = await workflowRes.json();
            if (workflowRes.ok && workflowData.output) {
              workflowOutput = workflowData.output;
            } else if (!workflowData.alreadyRan) {
              console.warn("Appointment workflow:", workflowData.error);
            }
          } catch (err) {
            console.warn("Appointment workflow error:", err);
          }
          if (jobnimbusConnected) {
            try {
              const exportRes = await fetch("/api/integrations/jobnimbus/export-mission-stop", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ stopId, packet: workflowOutput }),
              });
              const exportData = await exportRes.json();
              if (exportRes.ok && (exportData.success || exportData.alreadyExported)) {
                setExportedStopIds((prev) => new Set(prev).add(stopId));
                const sections = exportData.exportedSections;
                if (sections && (!sections.materials || !sections.xactimate)) {
                  const missing = [];
                  if (!sections.materials) missing.push("Materials");
                  if (!sections.xactimate) missing.push("Xactimate");
                  setMissionError(
                    `Synced to JobNimbus, but ${missing.join(" and ")} could not be included. Try setting the appointment again or re-export.`
                  );
                }
              } else {
                setMissionError(exportData.error || "Failed to sync to JobNimbus");
              }
            } catch (err) {
              setMissionError("Failed to sync to JobNimbus. Check your connection.");
              console.error("JobNimbus export error:", err);
            }
          } else {
            setMissionError("Connect JobNimbus in Settings → Integrations to auto-sync appointments.");
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Stop outcome update failed";
        console.error("Stop outcome update error:", error);
        setMissionError(message);
      } finally {
        setMissionLoading(false);
      }
    },
    [activeMission, jobnimbusConnected, missionStops, fetchNearbyOpportunities]
  );

  const exportMissionRoute = useCallback(() => {
    if (missionStops.length < 2) return;
    const origin = `${missionStops[0].lat},${missionStops[0].lng}`;
    const destination = `${missionStops[missionStops.length - 1].lat},${missionStops[missionStops.length - 1].lng}`;
    const middleStops = missionStops
      .slice(1, -1)
      .map((stop) => `${stop.lat},${stop.lng}`)
      .join("|");

    const params = new URLSearchParams({
      api: "1",
      origin,
      destination,
      travelmode: "driving",
    });
    if (middleStops) params.set("waypoints", middleStops);

    window.open(`https://www.google.com/maps/dir/?${params.toString()}`, "_blank");
  }, [missionStops]);

  // Fetch data on mount and when location/settings change
  useEffect(() => {
    if (!geoLoading) {
      fetchStormData();
      const lat = latitude || 35.0;
      const lng = longitude || -98.0;
      void fetchTimeline(lat, lng, timelineDays);
      void fetchMissions();
    }
  }, [geoLoading, fetchStormData, fetchTimeline, fetchMissions, latitude, longitude, timelineDays]);

  // Auto-refresh every 30 seconds if live
  useEffect(() => {
    if (isLive && !geoLoading) {
      const interval = setInterval(() => {
        fetchStormData();
        const lat = latitude || 35.0;
        const lng = longitude || -98.0;
        void fetchTimeline(lat, lng, timelineDays);
        void fetchMissions();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [isLive, geoLoading, fetchStormData, fetchTimeline, fetchMissions, latitude, longitude, timelineDays]);

  // Convert storms to map markers
  const stormMarkers: MapMarker[] = storms
    .filter(storm => {
      if (activeLayer === "all") return true;
      if (activeLayer === "hail") return storm.type === "hail" || storm.hailSize;
      if (activeLayer === "wind") return storm.type === "wind" || storm.windSpeed;
      return true;
    })
    .map(storm => {
      const locationLabel = resolveDisplayLocation({
        location: storm.location ?? null,
        county: storm.county ?? null,
        state: storm.state ?? null,
        lat: storm.lat,
        lng: storm.lng,
      });

      return {
        id: storm.id,
        lat: storm.lat,
        lng: storm.lng,
        type: storm.type,
        severity: storm.severity,
        popup: `
          <strong>${storm.type.replace("_", " ").toUpperCase()}</strong><br/>
          ${storm.hailSize ? `🧊 ${storm.hailSize}" hail<br/>` : ""}
          ${storm.windSpeed ? `💨 ${storm.windSpeed} mph<br/>` : ""}
          ${locationLabel}<br/>
          <small>Damage Score: ${storm.damageScore}/100</small>
        `,
      };
    });

  // Add property markers
  const propertyMarkers: MapMarker[] = (activeLayer === "damage" || activeLayer === "all")
    ? impactedProperties.slice(0, 30).map((prop, i) => {
        const propertyAddress = sanitizeLocationText(prop.address) || `Near ${formatCoordinateLabel(prop.lat, prop.lng)}`;
        return {
          id: `prop-${i}`,
          lat: prop.lat,
          lng: prop.lng,
          type: "property" as const,
          color: prop.damageProb >= 80 ? "#dc2626" : prop.damageProb >= 60 ? "#f97316" : "#eab308",
          size: 16,
          popup: `
            <strong>${propertyAddress}</strong><br/>
            Damage Probability: ${prop.damageProb}%<br/>
            🧊 Hail: ${prop.hailExposure}% | 💨 Wind: ${prop.windExposure}%<br/>
            ${prop.roofAge ? `Roof Age: ${prop.roofAge} years` : ""}
          `,
        };
      })
    : [];

  // Storm paths
  const stormPaths: StormPath[] = storms
    .filter(s => s.path && s.path.length >= 2)
    .map(storm => ({
      id: storm.id,
      coordinates: storm.path!.map(p => [p.lng, p.lat] as [number, number]),
      color: storm.severity === "extreme" ? "#dc2626" : 
             storm.severity === "severe" ? "#f97316" : 
             "#eab308",
      width: storm.type === "tornado" ? 6 : 4,
    }));

  // Storm impact circles
  const stormCircles: MapCircle[] = storms
    .filter(s => s.severity === "severe" || s.severity === "extreme")
    .map(storm => ({
      id: storm.id,
      center: [storm.lng, storm.lat] as [number, number],
      radiusMiles: storm.radius,
      color: storm.severity === "extreme" ? "#dc2626" : "#f97316",
      opacity: 0.2,
    }));

  const handleMarkerClick = (marker: MapMarker) => {
    const storm = storms.find(s => s.id === marker.id);
    if (storm) {
      setActiveMission(null);
      setSelectedStorm(storm);
      setSelectedTimelineEvent(null);
      setFocusedMapCenter({ lat: storm.lat, lng: storm.lng });
      setFocusedMapZoom(11);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "extreme": return "bg-red-600";
      case "severe": return "bg-orange-500";
      case "moderate": return "bg-yellow-500";
      default: return "bg-blue-500";
    }
  };

  const getMissionStatusBadge = (status: MissionStatus) => {
    switch (status) {
      case "in_progress":
        return "bg-emerald-500/15 text-emerald-400";
      case "planned":
        return "bg-blue-500/15 text-blue-400";
      case "completed":
        return "bg-storm-purple/15 text-storm-glow";
      default:
        return "bg-red-500/15 text-red-400";
    }
  };

  const getOutcomeBadge = (outcome: MissionOutcome) => {
    switch (outcome) {
      case "appointment_set":
      case "inspection_set":
        return "bg-emerald-500/15 text-emerald-400";
      case "knocked":
        return "bg-blue-500/15 text-blue-400";
      case "not_home":
        return "bg-amber-500/15 text-amber-400";
      case "pending":
        return "bg-storm-z2 text-storm-muted";
      default:
        return "bg-red-500/15 text-red-400";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "tornado": return "🌪️";
      case "hail": return "🧊";
      case "wind": return "💨";
      default: return "⛈️";
    }
  };

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString("en-US", { 
      hour: "numeric", 
      minute: "2-digit",
      timeZoneName: "short"
    });
  };

  const timelineForDisplay = useMemo(() => {
    if (timeline.length > 0) return timeline;
    return storms.map((storm) => stormToTimelineEvent(storm));
  }, [timeline, storms]);

  // Don't auto-select first mission - let user choose storm event to deploy or mission to view

  useEffect(() => {
    void fetchJobnimbusData();
  }, [fetchJobnimbusData]);

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <StormOpsHeader
        isLive={isLive}
        setIsLive={setIsLive}
        dataSource={dataSource}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        getLocation={getLocation}
        geoLoading={geoLoading}
        hasLocation={hasLocation}
        showRadar={showRadar}
        setShowRadar={setShowRadar}
        fetchStormData={fetchStormData}
        loading={loading}
      />

      <KPIStrip
        severeStorms={storms.filter((s) => s.severity === "extreme" || s.severity === "severe").length}
        propertiesAtRisk={impactedProperties.length}
        maxHail={storms.reduce((max, s) => Math.max(max, s.hailSize || 0), 0).toFixed(1) + '"'}
        maxWind={storms.reduce((max, s) => Math.max(max, s.windSpeed || 0), 0)}
        activeMissions={missions.filter((m) => m.status === "in_progress" || m.status === "planned").length}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Left Rail */}
        <div className="w-[280px] border-r border-storm-border/50 bg-storm-z0/60 backdrop-blur-sm flex flex-col shrink-0 overflow-hidden">
          <div className="p-3 border-b border-storm-border/30">
            <h3 className="text-2xs font-semibold uppercase tracking-wider text-storm-subtle mb-0.5">Storm Events</h3>
            <p className="text-[10px] text-storm-subtle mb-2">Select to deploy mission route</p>
            <div className="flex items-center gap-1 mb-2">
              {[7, 30, 60, 90].map((days) => (
                <button
                  key={days}
                  onClick={() => setTimelineDays(days)}
                  className={`text-[10px] px-2 py-1 rounded-lg border transition-all ${
                    timelineDays === days
                      ? "bg-storm-purple/20 text-storm-glow border-storm-purple/40 shadow-glow-sm"
                      : "text-storm-muted border-storm-border/50 hover:border-storm-purple/30"
                  }`}
                >
                  {days}d
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                const lat = latitude || 35.0;
                const lng = longitude || -98.0;
                void fetchTimeline(lat, lng, timelineDays);
              }}
              className="text-[10px] px-2 py-1 rounded-lg border border-storm-border/50 hover:border-storm-purple/30 text-storm-muted hover:text-white transition-colors"
            >
              Refresh
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {!timelineLoading && timeline.length === 0 && storms.length > 0 && (
              <div className="mx-2 mt-2 mb-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-[10px] text-amber-300">
                {timelineError ? (
                  <>Timeline error: {timelineError}. Showing live storm reports.</>
                ) : (
                  <>Historical timeline unavailable. Showing live storm reports.</>
                )}
              </div>
            )}
            {timelineLoading ? (
              <div className="py-6 flex justify-center">
                <div className="w-5 h-5 border-2 border-storm-purple border-t-transparent rounded-full animate-spin" />
              </div>
            ) : timelineForDisplay.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-storm-subtle">No storm events</div>
            ) : (
              <div className="space-y-0.5 p-2">
                {timelineForDisplay.slice(0, 25).map((event) => {
                  const isStorm = event.id.startsWith("storm-");
                  const stormId = isStorm ? event.id.replace("storm-", "") : null;
                  const isSelected =
                    isStorm && stormId
                      ? selectedStorm?.id === stormId
                      : selectedTimelineEvent?.id === event.id;
                  return (
                    <button
                      key={event.id}
                      onClick={() => {
                        setActiveMission(null);
                        if (isStorm && stormId) {
                          const storm = storms.find((s) => s.id === stormId);
                          if (storm) {
                            setSelectedStorm(storm);
                            setSelectedTimelineEvent(null);
                            setFocusedMapCenter({ lat: storm.lat, lng: storm.lng });
                            setFocusedMapZoom(11);
                          }
                        } else {
                          setSelectedTimelineEvent(event);
                          setSelectedStorm(null);
                          setFocusedMapCenter({ lat: event.lat, lng: event.lng });
                          setFocusedMapZoom(11);
                        }
                      }}
                      className={`w-full text-left p-2 rounded-xl border transition-all ${
                        isSelected ? "bg-storm-purple/10 border-storm-purple/40 shadow-glow-sm" : "bg-storm-z1/50 border-storm-border/30 hover:border-storm-purple/20"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs truncate text-white">
                          {event.type === "hail" ? "🧊" : event.type === "tornado" ? "🌪️" : event.type === "wind" ? "💨" : "⛈️"}{" "}
                          {event.location}
                          {event.hailSize ? ` (${event.hailSize}")` : ""}
                        </span>
                        <span className="text-[10px] text-storm-subtle shrink-0">{event.daysAgo === 0 ? "Today" : `${event.daysAgo}d`}</span>
                      </div>
                      <div className="text-[10px] text-storm-glow font-medium mt-0.5">{formatPipeline(event.estimatedOpportunity)}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="p-3 border-t border-storm-border/30">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-2xs font-semibold uppercase tracking-wider text-storm-subtle">Mission Routes</h3>
              <button
                onClick={() => void fetchMissions()}
                className="text-[10px] px-2 py-0.5 rounded-lg border border-storm-border/50 hover:border-storm-purple/30 text-storm-muted hover:text-white transition-colors"
              >
                Refresh
              </button>
            </div>
            {missions.length === 0 ? (
              <div className="text-xs text-storm-subtle py-2">No missions</div>
            ) : (
              <div className="space-y-0.5 max-h-32 overflow-y-auto">
                {missions.slice(0, 10).map((mission) => (
                  <button
                    key={mission.id}
                    onClick={() => {
                      setSelectedStorm(null);
                      setSelectedTimelineEvent(null);
                      void fetchMissionDetail(mission.id);
                    }}
                    className={`w-full text-left p-2 rounded-xl border transition-all ${
                      activeMission?.id === mission.id ? "bg-storm-purple/10 border-storm-purple/40 shadow-glow-sm" : "bg-storm-z1/50 border-storm-border/30 hover:border-storm-purple/20"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs truncate text-white">{mission.name}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold ${getMissionStatusBadge(mission.status)}`}>
                        {mission.status.replace("_", " ")}
                      </span>
                    </div>
                    <div className="text-[10px] text-storm-muted">{mission.totalStops} stops · {formatPipeline(mission.estimatedPipeline)}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 relative min-w-0">
          {/* Layer Controls */}
          <div className="absolute top-4 left-4 z-10 glass rounded-xl p-1.5 flex flex-col gap-0.5">
            {[
              { id: "all", label: "All Layers", icon: "🗺️" },
              { id: "hail", label: "Hail", icon: "🧊" },
              { id: "wind", label: "Wind", icon: "💨" },
              { id: "damage", label: "Properties", icon: "🏠" },
              { id: "radar", label: "Radar", icon: "📡" },
            ].map((layer) => (
              <button
                key={layer.id}
                onClick={() => setActiveLayer(layer.id as typeof activeLayer)}
                className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-all ${
                  activeLayer === layer.id
                    ? "bg-storm-purple/20 text-storm-glow shadow-glow-sm"
                    : "hover:bg-storm-z2/60 text-storm-muted hover:text-white"
                }`}
              >
                <span>{layer.icon}</span>
                {layer.label}
              </button>
            ))}
          </div>

          {/* Legend */}
          <div className="absolute bottom-4 left-4 z-10 glass rounded-xl p-3.5">
            <h4 className="text-xs font-semibold text-white mb-2">Storm Severity</h4>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600" />
                <span className="text-storm-muted">Extreme</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                <span className="text-storm-muted">Severe</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                <span className="text-storm-muted">Moderate</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span className="text-storm-muted">Minor</span>
              </div>
            </div>
            {hasLocation && (
              <div className="mt-2.5 pt-2.5 border-t border-storm-border/30 text-2xs text-storm-subtle">
                📍 {latitude?.toFixed(4)}, {longitude?.toFixed(4)}
              </div>
            )}
          </div>

          {/* Mapbox Map */}
          <MapboxMap
            center={mapCenter}
            zoom={mapZoom}
            markers={[...stormMarkers, ...propertyMarkers]}
            paths={stormPaths}
            circles={stormCircles}
            onMarkerClick={handleMarkerClick}
            showUserLocation={true}
            showRadar={showRadar && activeLayer !== "damage"}
            darkMode={true}
          />

          {/* Loading overlay */}
          {loading && (
            <div className="absolute inset-0 bg-storm-z0/70 backdrop-blur-sm flex items-center justify-center z-20">
              <div className="flex flex-col items-center gap-3 glass rounded-2xl p-6 shadow-depth-3">
                <div className="w-8 h-8 border-2 border-storm-purple border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-storm-muted">
                  {geoLoading ? "Getting your location..." : "Loading storm data from Xweather..."}
                </span>
              </div>
            </div>
          )}

          {/* Geo error message */}
          {geoError && (
            <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 glass rounded-xl border border-amber-500/30 px-4 py-3 text-sm shadow-depth-2 flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
              <span className="text-amber-300">⚠️ {geoError}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => getLocation()}
                  className="button-secondary text-xs px-3 py-1.5"
                >
                  Retry
                </button>
                <Link
                  href="/settings/profile"
                  className="button-secondary text-xs px-3 py-1.5"
                >
                  Set default location
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Right Context Panel */}
        <div className="w-[320px] border-l border-storm-border/50 bg-storm-z0/60 backdrop-blur-sm flex flex-col shrink-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            {/* Active Alerts */}
            {alerts.length > 0 && (
              <div className="p-3 border-b border-red-500/20 bg-red-500/5">
                <h3 className="text-2xs font-semibold uppercase tracking-wider text-red-400 mb-2">Active Alerts ({alerts.length})</h3>
                <div className="space-y-1.5">
                  {alerts.slice(0, 3).map((alert) => (
                    <div
                      key={alert.id}
                      className={`p-2.5 rounded-xl border text-sm ${
                        alert.emergency ? "bg-red-500/10 border-red-500/30" : "bg-storm-z1/50 border-storm-border/30"
                      }`}
                    >
                      <div className="font-medium text-white text-xs">{alert.name}</div>
                      <div className="text-2xs text-storm-muted mt-0.5">{alert.location}</div>
                      <div className="text-2xs text-storm-subtle">Expires: {formatTime(alert.expiresAt)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Context: Storm or Timeline Event */}
            {(selectedStorm || selectedTimelineEvent) && !activeMission && (
              <div className="p-3 border-b border-storm-border/30">
                <h3 className="text-2xs font-semibold uppercase tracking-wider text-storm-subtle mb-3">Context</h3>
                {selectedStorm && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{getTypeIcon(selectedStorm.type)}</span>
                      <div>
                        <div className="font-bold text-white capitalize text-sm">{selectedStorm.type.replace("_", " ")}</div>
                        <div className={`text-[10px] ${getSeverityColor(selectedStorm.severity)} px-2 py-0.5 rounded-md inline-block text-white font-bold`}>
                          {selectedStorm.severity.toUpperCase()}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-storm-muted">
                      {resolveDisplayLocation({
                        location: selectedStorm.location ?? null,
                        county: selectedStorm.county ?? null,
                        state: selectedStorm.state ?? null,
                        lat: selectedStorm.lat,
                        lng: selectedStorm.lng,
                      })}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-storm-z1/60 border border-storm-border/20 p-2"><span className="text-2xs text-storm-subtle">Damage</span><div className="text-sm font-bold text-white">{selectedStorm.damageScore}/100</div></div>
                      <div className="rounded-lg bg-storm-z1/60 border border-storm-border/20 p-2"><span className="text-2xs text-storm-subtle">Radius</span><div className="text-sm font-bold text-white">{selectedStorm.radius} mi</div></div>
                      {selectedStorm.hailSize && <div className="rounded-lg bg-storm-z1/60 border border-storm-border/20 p-2"><span className="text-2xs text-storm-subtle">Hail</span><div className="text-sm font-bold text-white">{selectedStorm.hailSize}"</div></div>}
                      {selectedStorm.windSpeed && <div className="rounded-lg bg-storm-z1/60 border border-storm-border/20 p-2"><span className="text-2xs text-storm-subtle">Wind</span><div className="text-sm font-bold text-white">{selectedStorm.windSpeed} mph</div></div>}
                    </div>
                    <div className="space-y-2 pt-2 border-t border-storm-border/20">
                      <button
                        onClick={() => void deployToTimelineEvent(stormToTimelineEvent(selectedStorm))}
                        disabled={missionLoading}
                        className="button-primary w-full text-sm flex items-center justify-center"
                      >
                        {missionLoading ? "Deploying..." : "Deploy Mission Route"}
                      </button>
                      <button
                        onClick={() => {
                          const params = new URLSearchParams();
                          if (selectedStorm.lat) params.set("lat", String(selectedStorm.lat));
                          if (selectedStorm.lng) params.set("lng", String(selectedStorm.lng));
                          window.open(`/dashboard/knock-list?${params.toString()}`, "_self");
                        }}
                        className="button-secondary w-full text-sm flex items-center justify-center"
                      >
                        Generate Knock List
                      </button>
                    </div>
                  </div>
                )}
                {selectedTimelineEvent && !selectedStorm && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">
                        {selectedTimelineEvent.type === "hail" ? "🧊" : selectedTimelineEvent.type === "tornado" ? "🌪️" : selectedTimelineEvent.type === "wind" ? "💨" : "⛈️"}
                      </span>
                      <div>
                        <div className="font-bold text-white text-sm">{selectedTimelineEvent.location}</div>
                        <div className="text-xs text-storm-muted">{formatPipeline(selectedTimelineEvent.estimatedOpportunity)} · {selectedTimelineEvent.estimatedProperties} props</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-lg bg-storm-z1/60 border border-storm-border/20 p-2 text-center"><span className="text-2xs text-storm-subtle">Canvassed</span><div className="text-xs font-bold text-white">{selectedTimelineEvent.propertiesCanvassed}</div></div>
                      <div className="rounded-lg bg-storm-z1/60 border border-storm-border/20 p-2 text-center"><span className="text-2xs text-storm-subtle">Leads</span><div className="text-xs font-bold text-white">{selectedTimelineEvent.leadsGenerated}</div></div>
                      <div className="rounded-lg bg-storm-z1/60 border border-storm-border/20 p-2 text-center"><span className="text-2xs text-storm-subtle">Appts</span><div className="text-xs font-bold text-emerald-400">{selectedTimelineEvent.appointmentsSet}</div></div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); void deployToTimelineEvent(selectedTimelineEvent); }}
                      disabled={missionLoading}
                      className="button-primary w-full text-sm flex items-center justify-center"
                    >
                      {missionLoading ? "Deploying..." : "Deploy Mission Route"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Context: Mission */}
            {activeMission && (
              <div className="p-3 border-b border-storm-border/30">
                <h3 className="text-2xs font-semibold uppercase tracking-wider text-storm-subtle mb-3">Mission</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-white truncate pr-2">{activeMission.name}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${getMissionStatusBadge(activeMission.status)}`}>
                      {activeMission.status.replace("_", " ").toUpperCase()}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-storm-z2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-storm-purple to-storm-glow rounded-full transition-all"
                      style={{ width: `${activeMission.totalStops > 0 ? (activeMission.stopsCompleted / activeMission.totalStops) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-4 gap-1 text-center text-[10px]">
                    <div className="rounded-lg bg-storm-z1/60 border border-storm-border/20 p-1.5"><div className="font-bold text-white">{activeMission.stopsCompleted}/{activeMission.totalStops}</div><div className="text-storm-subtle">Stops</div></div>
                    <div className="rounded-lg bg-storm-z1/60 border border-storm-border/20 p-1.5"><div className="font-bold text-white">{activeMission.stopsKnocked}</div><div className="text-storm-subtle">Knocked</div></div>
                    <div className="rounded-lg bg-storm-z1/60 border border-storm-border/20 p-1.5"><div className="font-bold text-emerald-400">{activeMission.appointmentsSet}</div><div className="text-storm-subtle">Appts</div></div>
                    <div className="rounded-lg bg-storm-z1/60 border border-storm-border/20 p-1.5"><div className="font-bold text-storm-glow">{formatPipeline(activeMission.estimatedPipeline)}</div><div className="text-storm-subtle">Pipeline</div></div>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <button
                      onClick={() => void updateMissionStatus("start")}
                      disabled={missionLoading || activeMission.status === "in_progress" || activeMission.status === "completed"}
                      className="text-[10px] rounded-lg py-1 bg-blue-500/15 text-blue-300 border border-blue-500/20 hover:bg-blue-500/25 disabled:opacity-40 transition-colors"
                    >Start</button>
                    <button
                      onClick={() => void updateMissionStatus("complete")}
                      disabled={missionLoading || activeMission.status === "completed" || activeMission.status === "cancelled"}
                      className="text-[10px] rounded-lg py-1 bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/25 disabled:opacity-40 transition-colors"
                    >Complete</button>
                    <button
                      onClick={() => void updateMissionStatus("cancel")}
                      disabled={missionLoading || activeMission.status === "cancelled" || activeMission.status === "completed"}
                      className="text-[10px] rounded-lg py-1 bg-red-500/15 text-red-300 border border-red-500/20 hover:bg-red-500/25 disabled:opacity-40 transition-colors"
                    >Cancel</button>
                  </div>
                  {missionError && (
                    <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-300">{missionError}</div>
                  )}
                  {missionRouteInfo && (
                    <div className="glass-subtle rounded-lg p-2 text-xs">
                      <div className="flex justify-between text-storm-muted">{missionRouteInfo.totalDistance} · {missionRouteInfo.totalDuration}</div>
                    </div>
                  )}
                  {missionStops.length > 0 ? (
                    <div className="space-y-1 max-h-[200px] overflow-y-auto">
                      {missionStops.map((stop) => (
                        <div key={stop.id} className="p-2 rounded-xl border border-storm-border/20 bg-storm-z1/50">
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="text-xs truncate text-white">#{stop.stopOrder} {resolveStopAddress(stop)}</span>
                            <span className="flex items-center gap-1">
                              {stop.outcome === "appointment_set" && exportedStopIds.has(stop.id) && (
                                <span className="text-[9px] text-emerald-400">✓ JN</span>
                              )}
                              <span className={`text-[9px] px-1 py-0.5 rounded-md font-bold ${getOutcomeBadge(stop.outcome)}`}>{stop.outcome.replace("_", " ").toUpperCase()}</span>
                            </span>
                          </div>
                          {stop.outcome === "pending" && (
                            <div className="grid grid-cols-2 gap-1 mt-1">
                              <button onClick={() => void updateStopOutcome(stop.id, "knocked")} disabled={missionLoading} className="text-[9px] bg-blue-500/10 text-blue-300 border border-blue-500/20 rounded-md py-0.5 hover:bg-blue-500/20 disabled:opacity-40 transition-colors">Knocked</button>
                              <button onClick={() => void updateStopOutcome(stop.id, "not_home")} disabled={missionLoading} className="text-[9px] bg-amber-500/10 text-amber-300 border border-amber-500/20 rounded-md py-0.5 hover:bg-amber-500/20 disabled:opacity-40 transition-colors">Not Home</button>
                              <button onClick={() => void updateStopOutcome(stop.id, "appointment_set")} disabled={missionLoading} className="text-[9px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 rounded-md py-0.5 hover:bg-emerald-500/20 disabled:opacity-40 transition-colors">Appt</button>
                              <button onClick={() => void updateStopOutcome(stop.id, "not_interested")} disabled={missionLoading} className="text-[9px] bg-red-500/10 text-red-300 border border-red-500/20 rounded-md py-0.5 hover:bg-red-500/20 disabled:opacity-40 transition-colors">No</button>
                            </div>
                          )}
                          <button
                            onClick={() => void fetchNearbyOpportunities(stop)}
                            disabled={nearbyLoading}
                            className="mt-1 w-full text-[8px] text-storm-glow hover:text-storm-purple disabled:opacity-40 transition-colors"
                          >
                            Find nearby
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-storm-subtle py-2">No stops loaded.</div>
                  )}
                  {missionStops.length >= 2 && (
                    <button onClick={exportMissionRoute} className="button-secondary w-full text-xs flex items-center justify-center">
                      Export Route to Google Maps
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Nearby Houses - shown when Knocked/Appt clicked */}
            {activeMission && nearbyAnchorStop && (
              <div className="p-3 border-b border-storm-border/30">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="text-2xs font-semibold uppercase tracking-wider text-storm-subtle">Nearby Houses</h3>
                  {nearbySource === "openstreetmap" && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-storm-z2 text-storm-muted border border-storm-border/30">
                      OSM data
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-storm-muted mb-2 truncate">From {resolveStopAddress(nearbyAnchorStop)}</p>
                {nearbyError && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-200 mb-2">
                    {nearbyError}
                    {nearbyError.includes("Upgrade") && (
                      <Link href="/settings/billing?upgrade=pro" className="block mt-1 text-storm-glow hover:underline">
                        Upgrade to Pro →
                      </Link>
                    )}
                  </div>
                )}
                {nearbyLoading && (
                  <div className="flex items-center gap-2 py-4 text-storm-muted text-xs">
                    <span className="h-3 w-3 border-2 border-storm-purple border-t-transparent rounded-full animate-spin" />
                    Loading nearby houses...
                  </div>
                )}
                {!nearbyLoading && !nearbyError && nearbyOpportunities.length === 0 && (
                  <p className="text-xs text-storm-subtle py-2">No nearby opportunities found.</p>
                )}
                {!nearbyLoading && !nearbyError && nearbyOpportunities.length > 0 && (
                  <div className="space-y-1 max-h-[220px] overflow-y-auto">
                    {nearbyOpportunities.map((opp, i) => {
                      const fullAddr = [opp.address, opp.city, opp.state, opp.zip].filter(Boolean).join(", ") || opp.address;
                      const actionColor =
                        opp.actionLabel === "Hit Now"
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                          : opp.actionLabel === "Hit Today"
                            ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                            : "bg-blue-500/20 text-blue-400 border-blue-500/40";
                      const showScoreEstimate = nearbySource !== "openstreetmap";
                      return (
                        <div key={i} className="p-2 rounded-xl border border-storm-border/20 bg-storm-z1/50">
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <span className="text-[10px] truncate text-white">{opp.address}</span>
                            {showScoreEstimate && (
                              <span className={`text-[8px] px-1 py-0.5 rounded font-bold shrink-0 ${actionColor}`}>
                                {opp.actionLabel}
                              </span>
                            )}
                          </div>
                          {showScoreEstimate && (
                            <div className="flex items-center justify-between text-[9px] text-storm-subtle">
                              <span>Score {opp.opportunityScore}</span>
                              {opp.estimatedValueRange && (
                                <span>
                                  ${opp.estimatedValueRange.low.toLocaleString()}–${opp.estimatedValueRange.high.toLocaleString()}
                                </span>
                              )}
                            </div>
                          )}
                          {nearbySource === "openstreetmap" && (
                            <div className="text-[9px] text-storm-muted mb-1">Address only · no property data</div>
                          )}
                          <button
                            onClick={async () => {
                              if (!activeMission) {
                                setNearbyError("Select a mission first to add stops.");
                                return;
                              }
                              try {
                                const res = await fetch("/api/missions", {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    missionId: activeMission.id,
                                    action: "add_stop",
                                    address: opp.address,
                                    city: opp.city || undefined,
                                    state: opp.state || undefined,
                                    zip: opp.zip || undefined,
                                    lat: opp.coordinates?.lat,
                                    lng: opp.coordinates?.lng,
                                  }),
                                });
                                const payload = await res.json().catch(() => null);
                                const missionData = payload?.data ?? payload;
                                if (!res.ok || !missionData?.mission) {
                                  throw new Error((payload as { error?: string })?.error || "Failed to add stop");
                                }
                                setActiveMission(missionData.mission);
                                setMissionStops(Array.isArray(missionData.stops) ? missionData.stops : []);
                                await fetchMissions();
                                setNearbyError(null);
                              } catch (e) {
                                setNearbyError(e instanceof Error ? e.message : "Failed to add to route");
                              }
                            }}
                            className="mt-1 w-full text-[9px] rounded-md py-0.5 bg-storm-purple/15 text-storm-glow border border-storm-purple/30 hover:bg-storm-purple/25 transition-colors"
                          >
                            Add to Route
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Context: Storm Reports (when no storm/timeline selected) - show storm list for quick selection */}
            {!selectedStorm && !selectedTimelineEvent && !activeMission && storms.length > 0 && (
              <div className="p-3 border-b border-storm-border/30">
                <h3 className="text-2xs font-semibold uppercase tracking-wider text-storm-subtle mb-2">Storm Reports</h3>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {storms.slice(0, 8).map((storm) => (
                    <button
                      key={storm.id}
                      onClick={() => {
                        setActiveMission(null);
                        setSelectedStorm(storm);
                      }}
                      className="w-full text-left p-2 rounded-xl border border-storm-border/20 bg-storm-z1/50 hover:border-storm-purple/20 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-white">{getTypeIcon(storm.type)} {storm.type.replace("_", " ")}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${getSeverityColor(storm.severity)} text-white font-bold`}>{storm.damageScore}</span>
                      </div>
                      <div className="text-[10px] text-storm-subtle truncate">{resolveDisplayLocation({ location: storm.location ?? null, county: storm.county ?? null, state: storm.state ?? null, lat: storm.lat, lng: storm.lng })}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
