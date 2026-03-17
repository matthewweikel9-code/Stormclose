"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { useGeolocation } from "@/hooks/useGeolocation";
import type { MapMarker, StormPath, MapCircle } from "@/components/ui/MapboxMap";

// Dynamic import for Mapbox (client-side only)
const MapboxMap = dynamic(() => import("@/components/ui/MapboxMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-zinc-900">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-zinc-400">Loading map...</span>
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
  const [isLive, setIsLive] = useState(true);
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

  const fetchTimeline = useCallback(async (lat: number, lng: number, days: number) => {
    setTimelineLoading(true);
    try {
      const res = await fetch(`/api/storms/timeline?lat=${lat}&lng=${lng}&days=${days}&radius=50`);
      if (!res.ok) {
        setTimeline([]);
        return;
      }
      const payload = await res.json();
      setTimeline(Array.isArray(payload.timeline) ? payload.timeline : []);
    } catch (error) {
      console.error("Timeline fetch error:", error);
      setTimeline([]);
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
        setMissionStops(Array.isArray(missionData.stops) ? missionData.stops : []);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Stop outcome update failed";
        console.error("Stop outcome update error:", error);
        setMissionError(message);
      } finally {
        setMissionLoading(false);
      }
    },
    [activeMission]
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
      setSelectedStorm(storm);
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
        return "bg-emerald-500/20 text-emerald-400";
      case "planned":
        return "bg-blue-500/20 text-blue-400";
      case "completed":
        return "bg-purple-500/20 text-purple-300";
      default:
        return "bg-red-500/20 text-red-400";
    }
  };

  const getOutcomeBadge = (outcome: MissionOutcome) => {
    switch (outcome) {
      case "appointment_set":
      case "inspection_set":
        return "bg-emerald-500/20 text-emerald-400";
      case "knocked":
        return "bg-blue-500/20 text-blue-400";
      case "not_home":
        return "bg-yellow-500/20 text-yellow-400";
      case "pending":
        return "bg-zinc-700 text-zinc-300";
      default:
        return "bg-red-500/20 text-red-400";
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

  useEffect(() => {
    if (activeMission || missions.length === 0) return;
    void fetchMissionDetail(missions[0].id);
  }, [activeMission, missions, fetchMissionDetail]);

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold">🗺️ Storm Intelligence Map</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsLive(!isLive)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2 transition-colors ${
                isLive ? "bg-red-600 text-white" : "bg-zinc-700 text-zinc-300"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isLive ? "bg-white animate-pulse" : "bg-zinc-500"}`} />
              {isLive ? "LIVE" : "Historical"}
            </button>
            {dataSource && dataSource !== "loading" && (
              <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded">
                Source: {dataSource}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Geolocation button */}
          <button
            onClick={getLocation}
            disabled={geoLoading}
            className={`p-2 rounded-lg transition-colors ${
              hasLocation ? "bg-green-600/20 text-green-400" : "bg-zinc-800 hover:bg-zinc-700"
            }`}
            title={hasLocation ? "Location active" : "Use my location"}
          >
            {geoLoading ? (
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
          </button>
          
          {/* Radar toggle */}
          <button
            onClick={() => setShowRadar(!showRadar)}
            className={`p-2 rounded-lg transition-colors ${
              showRadar ? "bg-blue-600 text-white" : "bg-zinc-800 hover:bg-zinc-700"
            }`}
            title="Toggle radar"
          >
            📡
          </button>

          {!isLive && (
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm"
            />
          )}
          <button
            onClick={fetchStormData}
            disabled={loading}
            className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors disabled:opacity-50"
          >
            <svg className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Map */}
        <div className="flex-1 relative">
          {/* Layer Controls */}
          <div className="absolute top-4 left-4 z-10 bg-zinc-900/95 rounded-xl border border-zinc-700 p-2 flex flex-col gap-1">
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
                className={`px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${
                  activeLayer === layer.id
                    ? "bg-blue-600 text-white"
                    : "hover:bg-zinc-800 text-zinc-400"
                }`}
              >
                <span>{layer.icon}</span>
                {layer.label}
              </button>
            ))}
          </div>

          {/* Legend */}
          <div className="absolute bottom-4 left-4 z-10 bg-zinc-900/95 rounded-xl border border-zinc-700 p-4">
            <h4 className="text-sm font-semibold mb-3">Storm Severity</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-600" />
                <span className="text-zinc-400">Extreme</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-orange-500" />
                <span className="text-zinc-400">Severe</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-yellow-500" />
                <span className="text-zinc-400">Moderate</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-zinc-400">Minor</span>
              </div>
            </div>
            {hasLocation && (
              <div className="mt-3 pt-3 border-t border-zinc-700 text-xs text-zinc-500">
                📍 Your location: {latitude?.toFixed(4)}, {longitude?.toFixed(4)}
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
            <div className="absolute inset-0 bg-zinc-950/60 flex items-center justify-center z-20">
              <div className="flex flex-col items-center gap-3 bg-zinc-900 p-6 rounded-xl">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-zinc-400">
                  {geoLoading ? "Getting your location..." : "Loading storm data from Xweather..."}
                </span>
              </div>
            </div>
          )}

          {/* Geo error message */}
          {geoError && (
            <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 bg-yellow-600/90 text-white px-4 py-2 rounded-lg text-sm">
              ⚠️ {geoError}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-96 border-l border-zinc-800 bg-zinc-900/50 overflow-y-auto">
          {/* Active Alerts */}
          {alerts.length > 0 && (
            <div className="p-4 border-b border-zinc-800 bg-red-900/20">
              <h3 className="font-semibold mb-3 text-red-400">⚠️ Active Alerts ({alerts.length})</h3>
              <div className="space-y-2">
                {alerts.slice(0, 3).map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-3 rounded-lg border ${
                      alert.emergency ? "bg-red-900/40 border-red-700" : "bg-zinc-800 border-zinc-700"
                    }`}
                  >
                    <div className="font-medium text-sm">{alert.name}</div>
                    <div className="text-xs text-zinc-400 mt-1">{alert.location}</div>
                    <div className="text-xs text-zinc-500 mt-1">
                      Expires: {formatTime(alert.expiresAt)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Storm Stats */}
          <div className="p-4 border-b border-zinc-800">
            <h3 className="font-semibold mb-3">Storm Activity</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-zinc-800 rounded-lg p-3">
                <div className="text-2xl font-bold text-red-500">
                  {storms.filter(s => s.severity === "extreme" || s.severity === "severe").length}
                </div>
                <div className="text-xs text-zinc-500">Severe Storms</div>
              </div>
              <div className="bg-zinc-800 rounded-lg p-3">
                <div className="text-2xl font-bold text-orange-500">{impactedProperties.length}</div>
                <div className="text-xs text-zinc-500">Properties at Risk</div>
              </div>
              <div className="bg-zinc-800 rounded-lg p-3">
                <div className="text-2xl font-bold text-yellow-500">
                  {storms.reduce((max, s) => Math.max(max, s.hailSize || 0), 0).toFixed(1)}"
                </div>
                <div className="text-xs text-zinc-500">Max Hail Size</div>
              </div>
              <div className="bg-zinc-800 rounded-lg p-3">
                <div className="text-2xl font-bold text-blue-500">
                  {storms.reduce((max, s) => Math.max(max, s.windSpeed || 0), 0)} mph
                </div>
                <div className="text-xs text-zinc-500">Max Wind Speed</div>
              </div>
            </div>
          </div>

          {/* Storm Timeline */}
          <div className="p-4 border-b border-zinc-800">
            <h3 className="font-semibold mb-3">Storm Reports ({storms.length})</h3>
            {storms.length === 0 ? (
              <div className="text-center py-6 text-zinc-500">
                <div className="text-3xl mb-2">✨</div>
                <div className="text-sm">No storms in this area</div>
                <div className="text-xs mt-1">Try expanding the search radius</div>
              </div>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {storms.slice(0, 15).map((storm) => (
                  <button
                    key={storm.id}
                    onClick={() => setSelectedStorm(storm)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedStorm?.id === storm.id
                        ? "bg-blue-600/20 border-blue-500"
                        : "bg-zinc-800 border-zinc-700 hover:border-zinc-600"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{getTypeIcon(storm.type)}</span>
                        <div>
                          <div className="font-medium capitalize text-sm">
                            {storm.type.replace("_", " ")}
                          </div>
                          <div className="text-xs text-zinc-500">
                            {resolveDisplayLocation({
                              location: storm.location ?? null,
                              county: storm.county ?? null,
                              state: storm.state ?? null,
                              lat: storm.lat,
                              lng: storm.lng,
                            })}
                          </div>
                        </div>
                      </div>
                      <div className={`px-2 py-1 rounded text-xs font-medium ${getSeverityColor(storm.severity)} text-white`}>
                        {storm.damageScore}
                      </div>
                    </div>
                    <div className="mt-2 flex gap-3 text-xs text-zinc-400">
                      {storm.hailSize && <span>🧊 {storm.hailSize}" hail</span>}
                      {storm.windSpeed && <span>💨 {storm.windSpeed} mph</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Mission Timeline */}
          <div className="p-4 border-b border-zinc-800">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <h3 className="font-semibold">Mission Timeline ({timelineForDisplay.length})</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Select a storm event and deploy route missions.</p>
              </div>
              <button
                onClick={() => {
                  const lat = latitude || 35.0;
                  const lng = longitude || -98.0;
                  void fetchTimeline(lat, lng, timelineDays);
                }}
                className="text-xs px-2 py-1 rounded border border-zinc-700 hover:border-zinc-500 text-zinc-300 transition-colors"
              >
                Refresh
              </button>
            </div>

            <div className="flex items-center gap-1 mb-3">
              {[7, 30, 60, 90].map((days) => (
                <button
                  key={days}
                  onClick={() => setTimelineDays(days)}
                  className={`text-[10px] px-2.5 py-1 rounded-lg border transition-colors ${
                    timelineDays === days
                      ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                      : "text-zinc-400 border-zinc-700 hover:border-zinc-500"
                  }`}
                >
                  {days}d
                </button>
              ))}
            </div>

            {!timelineLoading && timeline.length === 0 && storms.length > 0 && (
              <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-[10px] text-amber-300">
                Historical timeline is unavailable right now. Showing live storm reports so you can still deploy routes.
              </div>
            )}

            {timelineLoading ? (
              <div className="py-6 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : timelineForDisplay.length === 0 ? (
              <div className="text-center py-6 text-zinc-500">
                <div className="text-3xl mb-2">📭</div>
                <div className="text-sm">No storm events in this range</div>
              </div>
            ) : (
              <div className="space-y-2 max-h-[320px] overflow-y-auto">
                {timelineForDisplay.slice(0, 20).map((event) => {
                  const isSelected = selectedTimelineEvent?.id === event.id;
                  const statusColor =
                    event.canvassPct === 0
                      ? "border-l-red-500"
                      : event.canvassPct < 50
                        ? "border-l-yellow-500"
                        : event.canvassPct < 100
                          ? "border-l-blue-500"
                          : "border-l-emerald-500";

                  return (
                    <div
                      key={event.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setSelectedTimelineEvent(isSelected ? null : event);
                        if (!isSelected) {
                          setFocusedMapCenter({ lat: event.lat, lng: event.lng });
                          setFocusedMapZoom(11);
                        }
                      }}
                      onKeyDown={(keyboardEvent) => {
                        if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
                          keyboardEvent.preventDefault();
                          setSelectedTimelineEvent(isSelected ? null : event);
                          if (!isSelected) {
                            setFocusedMapCenter({ lat: event.lat, lng: event.lng });
                            setFocusedMapZoom(11);
                          }
                        }
                      }}
                      className={`w-full text-left p-2.5 rounded-lg border-l-4 border border-zinc-700 transition-all cursor-pointer ${statusColor} ${
                        isSelected ? "bg-purple-500/10 border-purple-500/40" : "bg-zinc-800 hover:bg-zinc-750"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-white font-medium">
                          {event.type === "hail" ? "🧊" : event.type === "tornado" ? "🌪️" : event.type === "wind" ? "💨" : "⛈️"}{" "}
                          {resolveDisplayLocation({
                            location: event.location ?? null,
                            county: event.county ?? null,
                            state: event.state ?? null,
                            lat: event.lat,
                            lng: event.lng,
                          })}
                          {event.hailSize ? ` (${event.hailSize}")` : ""}
                        </span>
                        <span className="text-[10px] text-zinc-500">{event.daysAgo === 0 ? "Today" : `${event.daysAgo}d ago`}</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-[10px]">
                        <span className="text-purple-300 font-semibold">
                          {formatPipeline(event.estimatedOpportunity)}
                        </span>
                        <span className="text-zinc-400">{event.estimatedProperties.toLocaleString()} properties</span>
                        <span className={`${event.canvassPct >= 75 ? "text-emerald-400" : event.canvassPct >= 25 ? "text-yellow-400" : "text-red-400"} font-semibold`}>
                          {event.canvassPct}% worked
                        </span>
                        {event.missionCount > 0 && (
                          <span className="text-blue-300 font-semibold">{event.missionCount} missions</span>
                        )}
                      </div>

                      {isSelected && (
                        <div className="mt-2 pt-2 border-t border-zinc-700 space-y-2">
                          <div className="grid grid-cols-3 gap-2 text-[10px]">
                            <div>
                              <span className="text-zinc-500">Canvassed</span>
                              <div className="text-white font-medium">{event.propertiesCanvassed}</div>
                            </div>
                            <div>
                              <span className="text-zinc-500">Leads</span>
                              <div className="text-white font-medium">{event.leadsGenerated}</div>
                            </div>
                            <div>
                              <span className="text-zinc-500">Appts</span>
                              <div className="text-white font-medium">{event.appointmentsSet}</div>
                            </div>
                          </div>

                          <button
                            onClick={(clickEvent) => {
                              clickEvent.stopPropagation();
                              void deployToTimelineEvent(event);
                            }}
                            disabled={missionLoading}
                            className="w-full text-[10px] bg-purple-600 text-white rounded py-1.5 hover:bg-purple-500 transition-colors font-semibold disabled:opacity-60"
                          >
                            {missionLoading ? "Deploying route..." : "Deploy Mission Route"}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Selected Storm Details */}
          {selectedStorm && (
            <div className="p-4 border-b border-zinc-800">
              <h3 className="font-semibold mb-3">Storm Details</h3>
              <div className="bg-zinc-800 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{getTypeIcon(selectedStorm.type)}</span>
                  <div>
                    <div className="font-bold capitalize">{selectedStorm.type.replace("_", " ")}</div>
                    <div className={`text-xs ${getSeverityColor(selectedStorm.severity)} px-2 py-0.5 rounded inline-block text-white`}>
                      {selectedStorm.severity.toUpperCase()}
                    </div>
                  </div>
                </div>
                <div className="text-sm text-zinc-400">
                  📍 {resolveDisplayLocation({
                    location: selectedStorm.location ?? null,
                    county: selectedStorm.county ?? null,
                    state: selectedStorm.state ?? null,
                    lat: selectedStorm.lat,
                    lng: selectedStorm.lng,
                  })}
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-zinc-500">Damage Score</div>
                    <div className="font-bold text-xl">{selectedStorm.damageScore}/100</div>
                  </div>
                  <div>
                    <div className="text-zinc-500">Impact Radius</div>
                    <div className="font-bold text-xl">{selectedStorm.radius} mi</div>
                  </div>
                  {selectedStorm.hailSize && (
                    <div>
                      <div className="text-zinc-500">Hail Size</div>
                      <div className="font-bold text-xl">{selectedStorm.hailSize}"</div>
                    </div>
                  )}
                  {selectedStorm.windSpeed && (
                    <div>
                      <div className="text-zinc-500">Wind Speed</div>
                      <div className="font-bold text-xl">{selectedStorm.windSpeed} mph</div>
                    </div>
                  )}
                </div>
                {selectedStorm.comments && (
                  <div className="text-xs text-zinc-400 p-2 bg-zinc-700/50 rounded">
                    {selectedStorm.comments}
                  </div>
                )}
                <div className="pt-3 border-t border-zinc-700 space-y-2">
                  <button
                    onClick={() => {
                      if (!selectedStorm) return;
                      void deployToTimelineEvent(stormToTimelineEvent(selectedStorm));
                    }}
                    disabled={missionLoading}
                    className="w-full bg-purple-600 hover:bg-purple-500 text-white py-2 rounded-lg font-medium transition-colors disabled:opacity-60"
                  >
                    {missionLoading ? "Deploying route..." : "Deploy Mission Route"}
                  </button>
                  <button onClick={() => {
                    if (selectedStorm) {
                      const params = new URLSearchParams();
                      if (selectedStorm.lat) params.set("lat", String(selectedStorm.lat));
                      if (selectedStorm.lng) params.set("lng", String(selectedStorm.lng));
                      window.open(`/dashboard/knock-list?${params.toString()}`, "_self");
                    }
                  }} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg font-medium transition-colors">
                    Generate Knock List for This Storm
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Mission Routes */}
          <div className="p-4 border-b border-zinc-800">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Mission Routes</h3>
              <button
                onClick={() => void fetchMissions()}
                className="text-xs px-2 py-1 rounded border border-zinc-700 hover:border-zinc-500 text-zinc-300 transition-colors"
              >
                Refresh
              </button>
            </div>

            {missionError && (
              <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-300">
                {missionError}
              </div>
            )}

            {missions.length > 0 && (
              <div className="mb-3 rounded-lg border border-zinc-700 bg-zinc-900/40 p-2">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Recent Missions</div>
                <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                  {missions.slice(0, 10).map((mission) => (
                    <button
                      key={mission.id}
                      onClick={() => void fetchMissionDetail(mission.id)}
                      className={`w-full text-left p-2 rounded-lg border transition-colors ${
                        activeMission?.id === mission.id
                          ? "bg-purple-500/10 border-purple-500/40"
                          : "bg-zinc-800 border-zinc-700 hover:border-purple-500/40"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-white font-medium truncate pr-2">{mission.name}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${getMissionStatusBadge(mission.status)}`}>
                          {mission.status.replace("_", " ")}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-zinc-400">
                        <span>{mission.totalStops} stops</span>
                        <span>{mission.appointmentsSet} appts</span>
                        <span>{formatPipeline(mission.estimatedPipeline)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeMission ? (
              <div className="space-y-3">
                <div className="bg-zinc-800 rounded-lg p-3 border border-zinc-700">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm text-white font-semibold truncate pr-2">{activeMission.name}</div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${getMissionStatusBadge(activeMission.status)}`}>
                      {activeMission.status.replace("_", " ").toUpperCase()}
                    </span>
                  </div>

                  <div className="w-full h-2 bg-zinc-700 rounded-full overflow-hidden mb-2">
                    <div
                      className="h-full bg-purple-500 rounded-full transition-all duration-500"
                      style={{
                        width: `${activeMission.totalStops > 0 ? (activeMission.stopsCompleted / activeMission.totalStops) * 100 : 0}%`,
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-4 gap-1 text-center text-[10px]">
                    <div>
                      <div className="text-white font-bold">
                        {activeMission.stopsCompleted}/{activeMission.totalStops}
                      </div>
                      <div className="text-zinc-500">Stops</div>
                    </div>
                    <div>
                      <div className="text-white font-bold">{activeMission.stopsKnocked}</div>
                      <div className="text-zinc-500">Knocked</div>
                    </div>
                    <div>
                      <div className="text-emerald-400 font-bold">{activeMission.appointmentsSet}</div>
                      <div className="text-zinc-500">Appts</div>
                    </div>
                    <div>
                      <div className="text-purple-300 font-bold">{formatPipeline(activeMission.estimatedPipeline)}</div>
                      <div className="text-zinc-500">Pipeline</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-1 mt-2">
                    <button
                      onClick={() => void updateMissionStatus("start")}
                      disabled={missionLoading || activeMission.status === "in_progress" || activeMission.status === "completed"}
                      className="text-[10px] rounded py-1 bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30 disabled:opacity-50"
                    >
                      Start
                    </button>
                    <button
                      onClick={() => void updateMissionStatus("complete")}
                      disabled={missionLoading || activeMission.status === "completed" || activeMission.status === "cancelled"}
                      className="text-[10px] rounded py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 disabled:opacity-50"
                    >
                      Complete
                    </button>
                    <button
                      onClick={() => void updateMissionStatus("cancel")}
                      disabled={missionLoading || activeMission.status === "cancelled" || activeMission.status === "completed"}
                      className="text-[10px] rounded py-1 bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>

                {missionRouteInfo && (
                  <div className="bg-zinc-800 rounded-lg p-2 border border-zinc-700">
                    <div className="flex justify-between text-xs text-white mb-1">
                      <span>{missionRouteInfo.totalDistance}</span>
                      <span>{missionRouteInfo.totalDuration}</span>
                    </div>
                    <div className="space-y-0.5 max-h-20 overflow-y-auto">
                      {missionRouteInfo.legs.map((leg, index) => (
                        <div key={`${leg.distance}-${index}`} className="text-[10px] text-zinc-400">
                          {leg.distance} · {leg.duration}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {missionStops.length > 0 ? (
                  <div className="space-y-1.5 max-h-[260px] overflow-y-auto">
                    {missionStops.map((stop) => (
                      <div key={stop.id} className="p-2 rounded-lg border border-zinc-700 bg-zinc-800">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs text-white truncate">
                            #{stop.stopOrder} {resolveStopAddress(stop)}
                          </span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${getOutcomeBadge(stop.outcome)}`}>
                            {stop.outcome.replace("_", " ").toUpperCase()}
                          </span>
                        </div>
                        {stop.outcome === "pending" && (
                          <div className="grid grid-cols-2 gap-1 mt-1">
                            <button
                              onClick={() => void updateStopOutcome(stop.id, "knocked")}
                              disabled={missionLoading}
                              className="text-[9px] bg-blue-500/15 text-blue-300 border border-blue-500/30 rounded py-1 hover:bg-blue-500/25 disabled:opacity-50"
                            >
                              Knocked
                            </button>
                            <button
                              onClick={() => void updateStopOutcome(stop.id, "not_home")}
                              disabled={missionLoading}
                              className="text-[9px] bg-yellow-500/15 text-yellow-300 border border-yellow-500/30 rounded py-1 hover:bg-yellow-500/25 disabled:opacity-50"
                            >
                              Not Home
                            </button>
                            <button
                              onClick={() => void updateStopOutcome(stop.id, "appointment_set")}
                              disabled={missionLoading}
                              className="text-[9px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded py-1 hover:bg-emerald-500/25 disabled:opacity-50"
                            >
                              Appt
                            </button>
                            <button
                              onClick={() => void updateStopOutcome(stop.id, "not_interested")}
                              disabled={missionLoading}
                              className="text-[9px] bg-red-500/15 text-red-300 border border-red-500/30 rounded py-1 hover:bg-red-500/25 disabled:opacity-50"
                            >
                              No
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-zinc-500 text-center py-3">No stops loaded for this mission yet.</div>
                )}

                {missionStops.length >= 2 && (
                  <button
                    onClick={exportMissionRoute}
                    className="w-full text-xs bg-zinc-700 text-white border border-zinc-600 rounded-lg py-2 hover:border-purple-400/60 transition-colors"
                  >
                    Export Route to Google Maps
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center py-6 text-zinc-500">
                <div className="text-3xl mb-2">🎯</div>
                <div className="text-sm text-white font-semibold mb-1">No mission routes yet</div>
                <div className="text-xs">Use Mission Timeline or Storm Details to deploy your first route.</div>
              </div>
            )}
          </div>

          {/* High-Impact Properties */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">High-Impact Properties</h3>
              <span className="text-xs text-zinc-500">{impactedProperties.length} total</span>
            </div>
            <div className="space-y-2 max-h-[250px] overflow-y-auto">
              {impactedProperties.slice(0, 10).map((prop, i) => (
                <div
                  key={i}
                  className="p-3 bg-zinc-800 rounded-lg hover:bg-zinc-750 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium truncate pr-2">
                      {sanitizeLocationText(prop.address) || `Near ${formatCoordinateLabel(prop.lat, prop.lng)}`}
                    </div>
                    <div className={`text-sm font-bold whitespace-nowrap ${
                      prop.damageProb >= 80 ? "text-red-500" :
                      prop.damageProb >= 60 ? "text-orange-500" :
                      "text-yellow-500"
                    }`}>
                      {prop.damageProb}%
                    </div>
                  </div>
                  <div className="flex gap-3 mt-1 text-xs text-zinc-500">
                    <span>🧊 {prop.hailExposure}%</span>
                    <span>💨 {prop.windExposure}%</span>
                    {prop.roofAge && <span>🏠 {prop.roofAge}yr</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
