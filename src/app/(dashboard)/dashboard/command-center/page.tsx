"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useGeolocation } from "@/hooks/useGeolocation";
import dynamic from "next/dynamic";
import type { MapMarker, StormPath, MapCircle } from "@/components/ui/MapboxMap";

// Lazy-load map
const MapboxMap = dynamic(() => import("@/components/ui/MapboxMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-storm-bg flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-storm-purple border-t-transparent rounded-full animate-spin" />
        <span className="text-storm-muted text-sm">Loading map…</span>
      </div>
    </div>
  ),
});

// ─── Types ─────────────────────────────────────────────────────────────────

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

interface DayForecast {
  date: string;
  dayOfWeek: string;
  highF: number;
  lowF: number;
  conditions: string;
  precipChance: number;
  windSpeedMph: number;
  windGustMph: number;
  severeRisk: "none" | "low" | "moderate" | "high" | "extreme";
  hailRisk: boolean;
  tornadoRisk: boolean;
  windRisk: boolean;
  summary: string;
}

interface Parcel {
  id: number;
  address: string;
  city: string;
  state: string;
  zip: string;
  owner: string;
  apn: string;
  propertyType: string;
  typeCode: string;
  lat: number;
  lng: number;
  geometry: string;
}

interface RouteStop {
  id: string;
  address: string;
  lat: number;
  lng: number;
  city?: string;
  state?: string;
  zip?: string;
  owner?: string;
  yearBuilt?: number;
  squareFeet?: number;
  roofAge?: number;
  estimatedValue?: number;
  estimatedClaim?: number;
  propertyType?: string;
  source: "parcel" | "manual" | "storm";
}

interface RouteResult {
  totalDistance: string;
  totalDuration: string;
  legs: { distance: string; duration: string; startAddress: string; endAddress: string }[];
  polyline: string;
  waypointOrder: number[];
}

interface PropertyIntel {
  address: string;
  lat: number;
  lng: number;
  owner?: string | { name?: string; firstName?: string; lastName?: string; mailingAddress?: string; absenteeOwner?: boolean };
  property?: { yearBuilt?: number; squareFootage?: number; value?: number; buildingType?: string };
  roof?: { age?: number; squareFootage?: number; type?: string; material?: string; condition?: string };
  yearBuilt?: number;
  squareFeet?: number;
  roofAge?: number;
  roofSquares?: number;
  estimatedValue?: number;
  claimEstimate?: { roofReplacement: number; gutters: number; siding?: number; total: number; confidence?: string };
  stormExposure?: { hailEvents: number; maxHailSize: number; lastStormDate?: string; summary: string };
  source: string;
  [key: string]: any;
}

interface TimelineEvent {
  id: string;
  type: string;
  severity: string;
  hailSize: number | null;
  windSpeed: number | null;
  damageScore: number;
  location: string;
  county: string | null;
  state: string | null;
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

interface RevenueAnalysis {
  revenue: {
    totalStormOpportunity: number;
    totalCaptured: number;
    captureRate: number;
    unclaimed: number;
    pipelineValue: number;
    closedValue: number;
    dealsPerWeek: number;
    revenuePerWeek: number;
  };
  storms: {
    totalEvents: number;
    totalEstProperties: number;
    totalCanvassed: number;
    canvassRate: number;
  };
  missions: {
    totalMissions: number;
    activeMissions: number;
    totalDoorsKnocked: number;
    totalAppointments: number;
    appointmentRate: number;
  };
}

interface StormBriefing {
  briefing: string;
  recommendation: { action: "deploy" | "hold" | "monitor"; confidence: "high" | "medium" | "low" };
  context: {
    existingLeadsInArea: number;
    activeLeads: number;
    avgRoofAge: number;
    estimatedProperties: number;
    estimatedOpportunity: number;
  };
}

interface Mission {
  id: string;
  name: string;
  status: string;
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
  outcome: string;
  outcomeNotes: string | null;
  homeownerName: string | null;
  homeownerPhone: string | null;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const THREAT_COLORS = {
  none: { bg: "bg-emerald-500/20", text: "text-emerald-400", border: "border-emerald-500/40", label: "ALL CLEAR", dot: "bg-emerald-400" },
  low: { bg: "bg-blue-500/20", text: "text-blue-400", border: "border-blue-500/40", label: "MONITORING", dot: "bg-blue-400" },
  moderate: { bg: "bg-yellow-500/20", text: "text-yellow-400", border: "border-yellow-500/40", label: "WATCH", dot: "bg-yellow-400" },
  high: { bg: "bg-orange-500/20", text: "text-orange-400", border: "border-orange-500/40", label: "WARNING", dot: "bg-orange-400" },
  extreme: { bg: "bg-red-500/20", text: "text-red-400", border: "border-red-500/40", label: "CRITICAL", dot: "bg-red-400" },
};

const REFRESH_INTERVAL = 60_000;

// ─── Main Component ────────────────────────────────────────────────────────

export default function StormCommandCenterV2() {
  // Geolocation
  const { latitude, longitude, loading: geoLoading, getLocation } = useGeolocation({ autoFetch: true });
  const userLat = latitude || 35.0;
  const userLng = longitude || -98.0;

  // ─── Core Data State ────────────────────────────────────────────────────
  const [storms, setStorms] = useState<StormEvent[]>([]);
  const [alerts, setAlerts] = useState<FormattedAlert[]>([]);
  const [stormCells, setStormCells] = useState<FormattedStormCell[]>([]);
  const [forecast, setForecast] = useState<DayForecast[]>([]);
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [routeStops, setRouteStops] = useState<RouteStop[]>([]);
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [propertyIntel, setPropertyIntel] = useState<PropertyIntel | null>(null);

  // ─── v2 Data State ──────────────────────────────────────────────────────
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [revenueData, setRevenueData] = useState<RevenueAnalysis | null>(null);
  const [stormBriefing, setStormBriefing] = useState<StormBriefing | null>(null);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [activeMission, setActiveMission] = useState<Mission | null>(null);
  const [missionStops, setMissionStops] = useState<MissionStop[]>([]);

  // ─── UI State ───────────────────────────────────────────────────────────
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [bottomDockOpen, setBottomDockOpen] = useState(true);
  const [leftTab, setLeftTab] = useState<"live" | "timeline" | "briefing">("live");
  const [rightTab, setRightTab] = useState<"intel" | "mission" | "deploy">("intel");
  const [loading, setLoading] = useState(true);
  const [stormLoading, setStormLoading] = useState(false);
  const [parcelLoading, setParcelLoading] = useState(false);
  const [propertyLoading, setPropertyLoading] = useState(false);
  const [routeLoading, setRouteLoading] = useState(false);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [missionLoading, setMissionLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [showRadar, setShowRadar] = useState(true);
  const [searchAddress, setSearchAddress] = useState("");
  const [mapCenter, setMapCenter] = useState({ lat: userLat, lng: userLng });
  const [mapZoom, setMapZoom] = useState(7);
  const [selectedCell, setSelectedCell] = useState<FormattedStormCell | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<FormattedAlert | null>(null);
  const [selectedTimelineEvent, setSelectedTimelineEvent] = useState<TimelineEvent | null>(null);
  const [parcelSearchRadius, setParcelSearchRadius] = useState(0.25);
  const [activeQuickAction, setActiveQuickAction] = useState<string | null>(null);
  const [alertTicker, setAlertTicker] = useState(0);
  const [timelineDays, setTimelineDays] = useState(30);

  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ─── Data Fetching ───────────────────────────────────────────────────────

  const fetchStormData = useCallback(async (lat: number, lng: number) => {
    setStormLoading(true);
    try {
      const res = await fetch(`/api/storms?live=true&lat=${lat}&lng=${lng}&radius=150`);
      if (!res.ok) throw new Error("Storm API failed");
      const data = await res.json();
      setStorms(data.storms || []);
      setAlerts(data.alerts || []);
      setStormCells(data.stormCells || []);
      setLastRefresh(new Date());
    } catch (e) {
      console.error("Storm fetch error:", e);
    } finally {
      setStormLoading(false);
    }
  }, []);

  const fetchForecast = useCallback(async (lat: number, lng: number) => {
    try {
      const res = await fetch(`/api/weather/forecast?lat=${lat}&lng=${lng}`);
      if (!res.ok) return;
      const data = await res.json();
      setForecast(data.forecast || []);
    } catch (e) {
      console.error("Forecast fetch error:", e);
    }
  }, []);

  const fetchTimeline = useCallback(async (lat: number, lng: number, days: number = 30) => {
    setTimelineLoading(true);
    try {
      const res = await fetch(`/api/storms/timeline?lat=${lat}&lng=${lng}&days=${days}&radius=50`);
      if (!res.ok) return;
      const data = await res.json();
      setTimeline(data.timeline || []);
    } catch (e) {
      console.error("Timeline fetch error:", e);
    } finally {
      setTimelineLoading(false);
    }
  }, []);

  const fetchRevenueAnalysis = useCallback(async (lat: number, lng: number) => {
    try {
      const res = await fetch(`/api/storms/revenue-analysis?lat=${lat}&lng=${lng}&days=30`);
      if (!res.ok) return;
      const data = await res.json();
      setRevenueData(data);
    } catch (e) {
      console.error("Revenue analysis error:", e);
    }
  }, []);

  const fetchMissions = useCallback(async () => {
    try {
      const res = await fetch("/api/missions?days=30&limit=20");
      if (!res.ok) return;
      const data = await res.json();
      setMissions(data.missions || []);
    } catch (e) {
      console.error("Missions fetch error:", e);
    }
  }, []);

  const fetchParcels = useCallback(async (lat: number, lng: number, radius: number = 0.25) => {
    setParcelLoading(true);
    setParcels([]);
    try {
      const res = await fetch(`/api/corelogic/parcels?lat=${lat}&lng=${lng}&radius=${radius}&pageSize=50&all=true`);
      if (!res.ok) throw new Error("Parcel API failed");
      const data = await res.json();
      setParcels(data.parcels || []);
    } catch (e) {
      console.error("Parcel fetch error:", e);
      setParcels([]);
    } finally {
      setParcelLoading(false);
    }
  }, []);

  const fetchPropertyIntel = useCallback(async (address?: string, lat?: number, lng?: number) => {
    setPropertyLoading(true);
    setRightPanelOpen(true);
    setRightTab("intel");
    setPropertyIntel(null);
    try {
      const params = address ? `address=${encodeURIComponent(address)}` : `lat=${lat}&lng=${lng}`;
      const res = await fetch(`/api/property/lookup?${params}`);
      const data = await res.json();
      if (!res.ok) {
        setPropertyIntel({
          address: address || `${lat?.toFixed(4)}, ${lng?.toFixed(4)}`,
          lat: lat || 0, lng: lng || 0,
          source: "none", _notFound: true,
          _message: data.message || "No property found at this location.",
        } as any);
        return;
      }
      setPropertyIntel(data);
    } catch (e) {
      console.error("Property intel error:", e);
      setPropertyIntel(null);
    } finally {
      setPropertyLoading(false);
    }
  }, []);

  const fetchStormBriefing = useCallback(async (event: TimelineEvent) => {
    setBriefingLoading(true);
    setStormBriefing(null);
    try {
      const res = await fetch("/api/ai/storm-briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: event.lat,
          lng: event.lng,
          hailSize: event.hailSize,
          windSpeed: event.windSpeed,
          eventType: event.type,
          location: event.location,
          county: event.county,
          state: event.state,
          damageScore: event.damageScore,
          estimatedProperties: event.estimatedProperties,
          estimatedOpportunity: event.estimatedOpportunity,
          occurredAt: event.occurredAt,
        }),
      });
      if (!res.ok) throw new Error("Briefing API failed");
      const data = await res.json();
      setStormBriefing(data);
    } catch (e) {
      console.error("Storm briefing error:", e);
    } finally {
      setBriefingLoading(false);
    }
  }, []);

  const optimizeRoute = useCallback(async () => {
    if (routeStops.length < 2) return;
    setRouteLoading(true);
    try {
      const res = await fetch("/api/route-optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          waypoints: routeStops.map((s) => `${s.lat},${s.lng}`),
          optimizeWaypoints: true,
        }),
      });
      if (!res.ok) throw new Error("Route API failed");
      const data = await res.json();
      setRouteResult(data.routeInfo || data);
    } catch (e) {
      console.error("Route optimize error:", e);
    } finally {
      setRouteLoading(false);
    }
  }, [routeStops]);

  const deployToStorm = useCallback(async (event: TimelineEvent) => {
    setMissionLoading(true);
    setRightPanelOpen(true);
    setRightTab("mission");
    try {
      // 1. Scan parcels near storm
      const parcelRes = await fetch(
        `/api/corelogic/parcels?lat=${event.lat}&lng=${event.lng}&radius=1&pageSize=50&all=true`
      );
      const parcelData = parcelRes.ok ? await parcelRes.json() : { parcels: [] };
      const scannedParcels: Parcel[] = parcelData.parcels || [];

      // Filter to residential only + must have valid coordinates
      const residential = scannedParcels.filter(
        (p) => ["SFR", "MFR", "CON", "TH", "MOB"].includes(p.typeCode) &&
               p.lat !== 0 && p.lng !== 0 && p.lat && p.lng
      );

      if (residential.length === 0) {
        console.warn("[Deploy] No valid residential parcels found near storm");
        setParcels(scannedParcels);
        setMapCenter({ lat: event.lat, lng: event.lng });
        setMapZoom(14);
        setMissionLoading(false);
        return;
      }

      // 2. Build route stops — cap at 23 (Google Directions allows 25 waypoints incl origin+dest)
      const stops: RouteStop[] = residential.slice(0, 23).map((p) => ({
        id: `parcel-${p.id}`,
        address: `${p.address}, ${p.city}, ${p.state} ${p.zip}`,
        lat: p.lat,
        lng: p.lng,
        city: p.city,
        state: p.state,
        zip: p.zip,
        owner: p.owner,
        propertyType: p.propertyType,
        source: "storm" as const,
      }));

      setRouteStops(stops);
      setParcels(scannedParcels);

      // 3. Create mission in DB
      let missionCreated = false;
      try {
        const missionRes = await fetch("/api/missions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: `Storm Deploy: ${event.location} ${event.type === "hail" ? `(${event.hailSize}")` : ""}`,
            description: `Auto-deployed to ${event.type} event at ${event.location}. ${event.estimatedProperties} est. properties.`,
            centerLat: event.lat,
            centerLng: event.lng,
            radiusMiles: 1.0,
            stops: stops.map((s) => ({
              address: s.address,
              lat: s.lat,
              lng: s.lng,
              city: s.city,
              state: s.state,
              zip: s.zip,
              owner_name: s.owner,
              property_type: s.propertyType,
            })),
            scheduledDate: new Date().toISOString().split("T")[0],
          }),
        });

        if (missionRes.ok) {
          const missionData = await missionRes.json();
          setActiveMission(missionData.mission);
          setMissionStops(missionData.stops || []);
          missionCreated = true;
          fetchMissions();
        } else {
          const errData = await missionRes.json().catch(() => ({}));
          console.error("[Deploy] Mission creation failed:", missionRes.status, errData);
        }
      } catch (missionErr) {
        console.error("[Deploy] Mission creation error:", missionErr);
      }

      // 4. Auto-optimize route if we have 2+ stops (runs even if mission creation failed)
      if (stops.length >= 2) {
        setRouteLoading(true);
        try {
          const routeRes = await fetch("/api/route-optimize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              waypoints: stops.map((s) => `${s.lat},${s.lng}`),
              optimizeWaypoints: true,
            }),
          });
          if (routeRes.ok) {
            const routeData = await routeRes.json();
            setRouteResult(routeData.routeInfo || routeData);

            // Reorder stops according to optimized waypoint order
            if (routeData.waypointOrder && routeData.waypointOrder.length > 0) {
              const middleStops = stops.slice(1, -1);
              const reordered = [
                stops[0],
                ...routeData.waypointOrder.map((i: number) => middleStops[i]),
                stops[stops.length - 1],
              ].filter(Boolean);
              setRouteStops(reordered);
            }
          } else {
            console.error("[Deploy] Route optimization failed:", routeRes.status);
          }
        } catch (routeErr) {
          console.error("[Deploy] Auto-route optimize error:", routeErr);
        } finally {
          setRouteLoading(false);
        }
      }

      // 5. If mission was created but we didn't get stops, switch to deploy tab as fallback
      if (!missionCreated) {
        setRightTab("deploy");
      }

      // 6. Center map on storm
      setMapCenter({ lat: event.lat, lng: event.lng });
      setMapZoom(14);
    } catch (e) {
      console.error("Deploy error:", e);
    } finally {
      setMissionLoading(false);
    }
  }, [fetchMissions]);

  const updateStopOutcome = useCallback(async (missionId: string, stopId: string, outcome: string, notes?: string) => {
    try {
      const res = await fetch("/api/missions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          missionId,
          action: "update_stop",
          stopId,
          outcome,
          notes,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setActiveMission(data.mission);
        setMissionStops(data.stops || []);
      }
    } catch (e) {
      console.error("Stop update error:", e);
    }
  }, []);

  // ─── Initial Load ────────────────────────────────────────────────────────

  useEffect(() => {
    if (userLat && userLng) {
      setMapCenter({ lat: userLat, lng: userLng });
      Promise.all([
        fetchStormData(userLat, userLng),
        fetchForecast(userLat, userLng),
        fetchTimeline(userLat, userLng, timelineDays),
        fetchRevenueAnalysis(userLat, userLng),
        fetchMissions(),
      ]).finally(() => setLoading(false));
    }
  }, [userLat, userLng, fetchStormData, fetchForecast, fetchTimeline, fetchRevenueAnalysis, fetchMissions, timelineDays]);

  // Auto-refresh
  useEffect(() => {
    refreshTimerRef.current = setInterval(() => {
      fetchStormData(mapCenter.lat, mapCenter.lng);
    }, REFRESH_INTERVAL);
    return () => { if (refreshTimerRef.current) clearInterval(refreshTimerRef.current); };
  }, [mapCenter, fetchStormData]);

  // Alert ticker
  useEffect(() => {
    if (alerts.length <= 1) return;
    const t = setInterval(() => setAlertTicker((prev) => (prev + 1) % alerts.length), 5000);
    return () => clearInterval(t);
  }, [alerts.length]);

  // ─── Computed Values ─────────────────────────────────────────────────────

  const threatLevel = useMemo((): keyof typeof THREAT_COLORS => {
    if (alerts.some((a) => a.emergency)) return "extreme";
    if (stormCells.some((c) => c.isSevere || c.tornadoProb > 30)) return "extreme";
    if (stormCells.some((c) => c.hailProbSevere > 50)) return "high";
    if (alerts.length > 0 || stormCells.length > 0) return "moderate";
    if (storms.some((s) => s.isActive)) return "low";
    return "none";
  }, [alerts, stormCells, storms]);

  const threat = THREAT_COLORS[threatLevel];

  const totalOpportunity = useMemo(() => {
    return revenueData?.revenue.totalStormOpportunity || 0;
  }, [revenueData]);

  // Build map markers
  const mapMarkers: MapMarker[] = useMemo(() => {
    const markers: MapMarker[] = [];

    storms.forEach((s) => {
      markers.push({
        id: `storm-${s.id}`, lat: s.lat, lng: s.lng, type: s.type, severity: s.severity,
        popup: `<b>${s.type.toUpperCase()}</b><br/>${s.location || "Unknown"}<br/>Damage: ${s.damageScore}/100${s.hailSize ? `<br/>Hail: ${s.hailSize}"` : ""}${s.windSpeed ? `<br/>Wind: ${s.windSpeed}mph` : ""}`,
      });
    });

    stormCells.forEach((c) => {
      markers.push({
        id: `cell-${c.id}`, lat: c.lat, lng: c.lng,
        type: c.tornadoProb > 20 ? "tornado" : c.isSevere ? "severe_thunderstorm" : "hail",
        severity: c.isSevere ? "severe" : c.hailProbSevere > 30 ? "moderate" : "minor",
        popup: `<b>Storm Cell</b><br/>${c.location}<br/>Hail: ${c.maxHailSize}" (${c.hailProb}%)<br/>Tornado: ${c.tornadoProb}%`,
      });
    });

    parcels.forEach((p) => {
      if (p.lat && p.lng) {
        markers.push({
          id: `parcel-${p.id}`, lat: p.lat, lng: p.lng, type: "property",
          popup: `<b>${p.address}</b><br/>${p.city}, ${p.state} ${p.zip}<br/>Owner: ${p.owner}`,
          size: 14,
        });
      }
    });

    routeStops.forEach((s, i) => {
      markers.push({
        id: `route-${s.id}`, lat: s.lat, lng: s.lng, type: "location",
        popup: `<b>Stop ${i + 1}</b><br/>${s.address}`, color: "#6D5CFF", size: 24,
      });
    });

    // Timeline events (when viewing timeline)
    if (leftTab === "timeline" && selectedTimelineEvent) {
      markers.push({
        id: `timeline-${selectedTimelineEvent.id}`,
        lat: selectedTimelineEvent.lat,
        lng: selectedTimelineEvent.lng,
        type: selectedTimelineEvent.type as any,
        severity: selectedTimelineEvent.severity as any,
        popup: `<b>${selectedTimelineEvent.type.toUpperCase()}</b><br/>${selectedTimelineEvent.location}<br/>$${selectedTimelineEvent.estimatedOpportunity.toLocaleString()} opportunity`,
        size: 30,
      });
    }

    return markers;
  }, [storms, stormCells, parcels, routeStops, leftTab, selectedTimelineEvent]);

  const mapPaths: StormPath[] = useMemo(() => {
    return storms
      .filter((s) => s.path && s.path.length >= 2)
      .map((s) => ({
        id: `track-${s.id}`,
        coordinates: s.path!.map((p) => [p.lng, p.lat] as [number, number]),
        color: s.severity === "extreme" ? "#dc2626" : s.severity === "severe" ? "#f97316" : "#eab308",
        width: 3,
      }));
  }, [storms]);

  const mapCircles: MapCircle[] = useMemo(() => {
    const circles: MapCircle[] = stormCells
      .filter((c) => c.isSevere)
      .map((c) => ({
        id: `impact-${c.id}`,
        center: [c.lng, c.lat] as [number, number],
        radiusMiles: c.maxHailSize > 1 ? 8 : 5,
        color: c.tornadoProb > 20 ? "#dc2626" : "#f97316",
        opacity: 0.15,
      }));

    // Add selected timeline event circle
    if (selectedTimelineEvent) {
      circles.push({
        id: `timeline-impact-${selectedTimelineEvent.id}`,
        center: [selectedTimelineEvent.lng, selectedTimelineEvent.lat] as [number, number],
        radiusMiles: selectedTimelineEvent.hailSize && selectedTimelineEvent.hailSize > 1 ? 8 : 5,
        color: "#6D5CFF",
        opacity: 0.12,
      });
    }

    return circles;
  }, [stormCells, selectedTimelineEvent]);

  // ─── Event Handlers ──────────────────────────────────────────────────────

  const handleMapClick = useCallback((lat: number, lng: number) => {
    if (activeQuickAction === "scan") {
      setMapCenter({ lat, lng });
      setMapZoom(15);
      fetchParcels(lat, lng, parcelSearchRadius);
      setActiveQuickAction(null);
      setRightPanelOpen(true);
      setRightTab("intel");
    } else if (activeQuickAction === "intel") {
      fetchPropertyIntel(undefined, lat, lng);
      setActiveQuickAction(null);
    } else if (activeQuickAction === "route-add") {
      setRouteStops((prev) => [
        ...prev,
        { id: `manual-${Date.now()}`, address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`, lat, lng, source: "manual" },
      ]);
    }
  }, [activeQuickAction, fetchParcels, fetchPropertyIntel, parcelSearchRadius]);

  const handleMarkerClick = useCallback((marker: MapMarker) => {
    if (marker.id.startsWith("parcel-")) {
      const parcelId = parseInt(marker.id.replace("parcel-", ""));
      const parcel = parcels.find((p) => p.id === parcelId);
      if (parcel) fetchPropertyIntel(`${parcel.address}, ${parcel.city}, ${parcel.state} ${parcel.zip}`);
    } else if (marker.id.startsWith("cell-")) {
      const cell = stormCells.find((c) => c.id === marker.id.replace("cell-", ""));
      if (cell) { setSelectedCell(cell); setLeftPanelOpen(true); setLeftTab("live"); }
    } else if (marker.id.startsWith("storm-")) {
      const storm = storms.find((s) => s.id === marker.id.replace("storm-", ""));
      if (storm) {
        fetchParcels(storm.lat, storm.lng, 1);
        fetchPropertyIntel(undefined, storm.lat, storm.lng);
        setMapCenter({ lat: storm.lat, lng: storm.lng });
        setMapZoom(14);
      }
    }
  }, [parcels, stormCells, storms, fetchPropertyIntel, fetchParcels]);

  const handleAddressSearch = useCallback(async () => {
    if (!searchAddress.trim()) return;
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchAddress)}.json?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}&limit=1`
      );
      const data = await res.json();
      if (data.features?.[0]) {
        const [lng, lat] = data.features[0].center;
        setMapCenter({ lat, lng });
        setMapZoom(15);
        fetchParcels(lat, lng, parcelSearchRadius);
        fetchPropertyIntel(searchAddress);
      }
    } catch (e) {
      console.error("Geocode error:", e);
    }
  }, [searchAddress, fetchParcels, fetchPropertyIntel, parcelSearchRadius]);

  const addParcelToRoute = useCallback((parcel: Parcel) => {
    setRouteStops((prev) => {
      if (prev.some((s) => s.id === `parcel-${parcel.id}`)) return prev;
      return [...prev, {
        id: `parcel-${parcel.id}`,
        address: `${parcel.address}, ${parcel.city}, ${parcel.state}`,
        lat: parcel.lat, lng: parcel.lng,
        city: parcel.city, state: parcel.state, zip: parcel.zip,
        owner: parcel.owner, propertyType: parcel.propertyType,
        source: "parcel" as const,
      }];
    });
    setRightPanelOpen(true);
  }, []);

  const removeRouteStop = useCallback((id: string) => {
    setRouteStops((prev) => prev.filter((s) => s.id !== id));
    setRouteResult(null);
  }, []);

  const exportRouteToGoogleMaps = useCallback(() => {
    if (routeStops.length < 2) return;
    const origin = `${routeStops[0].lat},${routeStops[0].lng}`;
    const dest = `${routeStops[routeStops.length - 1].lat},${routeStops[routeStops.length - 1].lng}`;
    const waypoints = routeStops.slice(1, -1).map((s) => `${s.lat},${s.lng}`).join("|");
    window.open(`https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}${waypoints ? `&waypoints=${waypoints}` : ""}&travelmode=driving`, "_blank");
  }, [routeStops]);

  // ─── Loading Screen ──────────────────────────────────────────────────────

  if (loading && geoLoading) {
    return (
      <div className="h-screen bg-storm-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-storm-purple border-t-transparent rounded-full animate-spin" />
          <span className="text-storm-muted text-sm">Initializing Storm Operations…</span>
        </div>
      </div>
    );
  }

  // ─── RENDER ──────────────────────────────────────────────────────────────

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-storm-bg overflow-hidden relative">

      {/* ═══════════════════════════════════════════════════════════════════
          STORM REVENUE RADAR — Top Status Bar
          ═══════════════════════════════════════════════════════════════════ */}
      <div className={`flex-none h-12 ${threat.bg} border-b ${threat.border} flex items-center px-4 gap-3 z-30`}>
        {/* Threat badge */}
        <div className="flex items-center gap-2 flex-none">
          <div className={`w-2.5 h-2.5 rounded-full ${threat.dot} ${threatLevel !== "none" ? "animate-pulse" : ""}`} />
          <span className={`text-xs font-black tracking-[0.15em] ${threat.text}`}>{threat.label}</span>
        </div>

        <div className="w-px h-6 bg-white/10" />

        {/* Live stats */}
        <div className="flex items-center gap-4 text-xs text-storm-muted">
          <span><span className="text-white font-semibold">{stormCells.length}</span> Cells</span>
          <span><span className="text-white font-semibold">{alerts.length}</span> Alerts</span>
          <span><span className="text-white font-semibold">{storms.length}</span> Reports</span>
        </div>

        {/* Revenue opportunity badge */}
        {totalOpportunity > 0 && (
          <>
            <div className="w-px h-6 bg-white/10" />
            <div className="flex items-center gap-2 bg-storm-purple/15 border border-storm-purple/30 rounded-lg px-3 py-1">
              <span className="text-[10px] text-storm-muted uppercase tracking-wider">Active Opportunity</span>
              <span className="text-sm font-bold text-storm-purple">
                ${totalOpportunity >= 1000000 ? `${(totalOpportunity / 1000000).toFixed(1)}M` : `${(totalOpportunity / 1000).toFixed(0)}K`}
              </span>
            </div>
          </>
        )}

        {/* Alert ticker */}
        {alerts.length > 0 && (
          <>
            <div className="w-px h-6 bg-white/10" />
            <div className="flex-1 overflow-hidden">
              <div className="text-xs truncate" style={{ color: alerts[alertTicker % alerts.length]?.color || "#fff" }}>
                ⚠ {alerts[alertTicker % alerts.length]?.name} — {alerts[alertTicker % alerts.length]?.location}
              </div>
            </div>
          </>
        )}

        {/* Timeline stats */}
        {timeline.length > 0 && !alerts.length && (
          <>
            <div className="w-px h-6 bg-white/10" />
            <div className="flex-1 text-xs text-storm-muted">
              <span className="text-white font-semibold">{timeline.length}</span> storm events in last {timelineDays} days
              {revenueData && (
                <> · <span className="text-emerald-400 font-semibold">{revenueData.storms.canvassRate}%</span> canvassed</>
              )}
            </div>
          </>
        )}

        {/* Right: time + refresh */}
        <div className="ml-auto flex items-center gap-3 text-xs text-storm-muted flex-none">
          <span>Updated {lastRefresh.toLocaleTimeString()}</span>
          <button
            onClick={() => fetchStormData(mapCenter.lat, mapCenter.lng)}
            className={`p-1 rounded hover:bg-white/10 transition-colors ${stormLoading ? "animate-spin" : ""}`}
            title="Refresh"
          >↻</button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          MAIN AREA: Left Panel + Map + Right Panel
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex relative overflow-hidden">

        {/* ─── LEFT PANEL ─── */}
        <div className={`absolute left-0 top-0 bottom-0 z-20 transition-all duration-300 ${leftPanelOpen ? "w-80" : "w-0"}`}>
          {leftPanelOpen && (
            <div className="w-80 h-full bg-storm-z0/95 backdrop-blur-xl border-r border-storm-border flex flex-col">
              {/* Tab bar */}
              <div className="flex-none border-b border-storm-border flex items-center">
                <TabButton label="Live Intel" active={leftTab === "live"} onClick={() => setLeftTab("live")} icon="🌩️" />
                <TabButton label="Timeline" active={leftTab === "timeline"} onClick={() => setLeftTab("timeline")} icon="📅"
                  badge={timeline.length > 0 ? timeline.length : undefined} />
                <TabButton label="AI Brief" active={leftTab === "briefing"} onClick={() => setLeftTab("briefing")} icon="🤖" />
                <button onClick={() => setLeftPanelOpen(false)} className="ml-auto mr-2 text-storm-muted hover:text-white text-xs p-1">✕</button>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto">

                {/* ═══ TAB: LIVE INTEL ═══ */}
                {leftTab === "live" && (
                  <>
                    {/* Active Storm Cells */}
                    {stormCells.length > 0 && (
                      <div className="p-3 border-b border-storm-border">
                        <h3 className="text-xs font-semibold text-storm-muted uppercase tracking-wider mb-2">
                          Active Storm Cells ({stormCells.length})
                        </h3>
                        <div className="space-y-2">
                          {stormCells.map((cell) => (
                            <button
                              key={cell.id}
                              onClick={() => { setSelectedCell(cell); setMapCenter({ lat: cell.lat, lng: cell.lng }); setMapZoom(10); }}
                              className={`w-full text-left p-2 rounded-lg border transition-colors ${
                                selectedCell?.id === cell.id
                                  ? "bg-storm-purple/20 border-storm-purple/40"
                                  : "bg-storm-z1 border-storm-border hover:border-storm-purple/30"
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-white font-medium truncate">
                                  {cell.isRotating ? "🌀" : cell.isSevere ? "⛈️" : "🌧️"} {cell.location}
                                </span>
                                {cell.isSevere && (
                                  <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-bold">SEVERE</span>
                                )}
                              </div>
                              <div className="grid grid-cols-3 gap-1 text-[10px] text-storm-muted">
                                <span>Hail: {cell.maxHailSize}&quot;</span>
                                <span>Tornado: {cell.tornadoProb}%</span>
                                <span>{cell.speedMph}mph</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Alerts */}
                    {alerts.length > 0 && (
                      <div className="p-3 border-b border-storm-border">
                        <h3 className="text-xs font-semibold text-storm-muted uppercase tracking-wider mb-2">
                          Active Alerts ({alerts.length})
                        </h3>
                        <div className="space-y-2">
                          {alerts.map((alert) => (
                            <button
                              key={alert.id}
                              onClick={() => setSelectedAlert(selectedAlert?.id === alert.id ? null : alert)}
                              className="w-full text-left p-2 rounded-lg bg-storm-z1 border border-storm-border hover:border-storm-purple/30 transition-colors"
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <div className="w-2 h-2 rounded-full flex-none" style={{ backgroundColor: alert.color }} />
                                <span className="text-xs text-white font-medium truncate">{alert.name}</span>
                                {alert.emergency && (
                                  <span className="text-[10px] bg-red-500/30 text-red-400 px-1 py-0.5 rounded font-bold">EMERGENCY</span>
                                )}
                              </div>
                              <div className="text-[10px] text-storm-muted truncate">{alert.location}</div>
                              {selectedAlert?.id === alert.id && (
                                <div className="mt-2 text-[11px] text-storm-muted/80 leading-relaxed max-h-24 overflow-y-auto">
                                  {alert.body.substring(0, 300)}…
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Storm Reports */}
                    {storms.length > 0 && (
                      <div className="p-3 border-b border-storm-border">
                        <h3 className="text-xs font-semibold text-storm-muted uppercase tracking-wider mb-2">
                          Storm Reports ({storms.length})
                        </h3>
                        <div className="space-y-1.5">
                          {storms.slice(0, 15).map((storm) => (
                            <div key={storm.id} className="p-2 rounded-lg bg-storm-z1 border border-storm-border hover:border-storm-purple/30 transition-colors">
                              <button
                                onClick={() => { setMapCenter({ lat: storm.lat, lng: storm.lng }); setMapZoom(13); }}
                                className="w-full text-left"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-white">
                                    {storm.type === "tornado" ? "🌪️" : storm.type === "hail" ? "🧊" : storm.type === "wind" ? "💨" : "⛈️"}{" "}
                                    {storm.location || "Unknown"}
                                  </span>
                                  <span className={`text-[10px] font-bold ${
                                    storm.severity === "extreme" ? "text-red-400" :
                                    storm.severity === "severe" ? "text-orange-400" :
                                    storm.severity === "moderate" ? "text-yellow-400" : "text-blue-400"
                                  }`}>{storm.damageScore}</span>
                                </div>
                                <div className="text-[10px] text-storm-muted mt-0.5">
                                  {storm.hailSize ? `${storm.hailSize}" hail` : ""}{storm.hailSize && storm.windSpeed ? " · " : ""}{storm.windSpeed ? `${storm.windSpeed}mph wind` : ""}
                                </div>
                              </button>
                              <div className="flex gap-1.5 mt-1.5">
                                <button
                                  onClick={() => { fetchParcels(storm.lat, storm.lng, 1); setMapCenter({ lat: storm.lat, lng: storm.lng }); setMapZoom(14); setRightPanelOpen(true); }}
                                  className="flex-1 text-[10px] bg-storm-purple/15 text-storm-purple border border-storm-purple/25 rounded py-1 hover:bg-storm-purple/25 transition-colors"
                                >🔍 Scan</button>
                                <button
                                  onClick={() => {
                                    setRouteStops((prev) => {
                                      if (prev.some((s) => s.id === `storm-${storm.id}`)) return prev;
                                      return [...prev, { id: `storm-${storm.id}`, address: storm.location || `${storm.lat.toFixed(4)}, ${storm.lng.toFixed(4)}`, lat: storm.lat, lng: storm.lng, source: "storm" as const }];
                                    });
                                    setRightPanelOpen(true);
                                  }}
                                  className="flex-1 text-[10px] bg-storm-z2 text-white border border-storm-border rounded py-1 hover:border-storm-purple/30 transition-colors"
                                >📌 Route</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Selected Cell Detail */}
                    {selectedCell && (
                      <div className="p-3 border-b border-storm-border">
                        <h3 className="text-xs font-semibold text-storm-muted uppercase tracking-wider mb-2">Cell Detail</h3>
                        <div className="bg-storm-z1 rounded-lg p-3 border border-storm-border">
                          <div className="text-sm text-white font-semibold mb-2">{selectedCell.location}</div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div><span className="text-storm-muted">Max Hail</span><div className="text-white font-medium">{selectedCell.maxHailSize}&quot;</div></div>
                            <div><span className="text-storm-muted">Hail Prob</span><div className="text-white font-medium">{selectedCell.hailProb}%</div></div>
                            <div><span className="text-storm-muted">Severe Hail</span><div className="text-white font-medium">{selectedCell.hailProbSevere}%</div></div>
                            <div><span className="text-storm-muted">Tornado</span><div className="text-white font-medium">{selectedCell.tornadoProb}%</div></div>
                            <div><span className="text-storm-muted">Speed</span><div className="text-white font-medium">{selectedCell.speedMph} mph</div></div>
                            <div><span className="text-storm-muted">Direction</span><div className="text-white font-medium">{selectedCell.direction}°</div></div>
                          </div>
                          <div className="flex gap-2 mt-3">
                            <button onClick={() => { fetchParcels(selectedCell.lat, selectedCell.lng, 2); setMapCenter({ lat: selectedCell.lat, lng: selectedCell.lng }); setMapZoom(13); setRightPanelOpen(true); }}
                              className="flex-1 text-xs bg-storm-purple/20 text-storm-purple border border-storm-purple/30 rounded-lg py-1.5 hover:bg-storm-purple/30 transition-colors">
                              🔍 Scan Properties
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Empty */}
                    {stormCells.length === 0 && alerts.length === 0 && storms.length === 0 && (
                      <div className="p-6 text-center">
                        <div className="text-2xl mb-2">☀️</div>
                        <div className="text-sm text-storm-muted">No active weather events</div>
                        <div className="text-xs text-storm-muted/60 mt-1">Auto-refreshes every 60 seconds</div>
                      </div>
                    )}
                  </>
                )}

                {/* ═══ TAB: STORM TIMELINE ═══ */}
                {leftTab === "timeline" && (
                  <div className="p-3">
                    {/* Time filter */}
                    <div className="flex items-center gap-2 mb-3">
                      {[7, 30, 60, 90].map((d) => (
                        <button
                          key={d}
                          onClick={() => { setTimelineDays(d); fetchTimeline(mapCenter.lat, mapCenter.lng, d); }}
                          className={`text-[10px] px-2.5 py-1 rounded-lg border transition-colors ${
                            timelineDays === d
                              ? "bg-storm-purple/20 text-storm-purple border-storm-purple/30"
                              : "text-storm-muted border-storm-border hover:border-storm-purple/20"
                          }`}
                        >{d}d</button>
                      ))}
                    </div>

                    {timelineLoading ? (
                      <div className="p-6 flex items-center justify-center">
                        <div className="w-6 h-6 border-2 border-storm-purple border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : timeline.length === 0 ? (
                      <div className="p-6 text-center">
                        <div className="text-2xl mb-2">📭</div>
                        <div className="text-sm text-storm-muted">No storm events in this period</div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {timeline.map((event) => {
                          const isSelected = selectedTimelineEvent?.id === event.id;
                          const statusColor = event.canvassPct === 0
                            ? "border-l-red-500"
                            : event.canvassPct < 50
                            ? "border-l-yellow-500"
                            : event.canvassPct < 100
                            ? "border-l-blue-500"
                            : "border-l-emerald-500";

                          return (
                            <button
                              key={event.id}
                              onClick={() => {
                                setSelectedTimelineEvent(isSelected ? null : event);
                                if (!isSelected) {
                                  setMapCenter({ lat: event.lat, lng: event.lng });
                                  setMapZoom(11);
                                }
                              }}
                              className={`w-full text-left p-2.5 rounded-lg border-l-4 border border-storm-border transition-all ${statusColor} ${
                                isSelected ? "bg-storm-purple/10 border-storm-purple/40" : "bg-storm-z1 hover:bg-storm-z2"
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-white font-medium">
                                  {event.type === "hail" ? "🧊" : event.type === "tornado" ? "🌪️" : event.type === "wind" ? "💨" : "⛈️"}{" "}
                                  {event.location}{event.hailSize ? ` (${event.hailSize}")` : ""}
                                </span>
                                <span className="text-[10px] text-storm-muted">{event.daysAgo === 0 ? "Today" : `${event.daysAgo}d ago`}</span>
                              </div>

                              {/* Revenue opportunity */}
                              <div className="flex items-center gap-3 text-[10px] mt-1">
                                <span className="text-storm-purple font-semibold">
                                  ${event.estimatedOpportunity >= 1000000 ? `${(event.estimatedOpportunity / 1000000).toFixed(1)}M` : `${(event.estimatedOpportunity / 1000).toFixed(0)}K`}
                                </span>
                                <span className="text-storm-muted">
                                  {event.estimatedProperties.toLocaleString()} properties
                                </span>
                                {event.canvassPct > 0 && (
                                  <span className={`font-bold ${event.canvassPct >= 75 ? "text-emerald-400" : event.canvassPct >= 25 ? "text-yellow-400" : "text-red-400"}`}>
                                    {event.canvassPct}% worked
                                  </span>
                                )}
                              </div>

                              {/* Expanded detail */}
                              {isSelected && (
                                <div className="mt-2 pt-2 border-t border-storm-border space-y-2">
                                  <div className="grid grid-cols-3 gap-2 text-[10px]">
                                    <div><span className="text-storm-muted">Canvassed</span><div className="text-white font-medium">{event.propertiesCanvassed}</div></div>
                                    <div><span className="text-storm-muted">Leads</span><div className="text-white font-medium">{event.leadsGenerated}</div></div>
                                    <div><span className="text-storm-muted">Appts</span><div className="text-white font-medium">{event.appointmentsSet}</div></div>
                                  </div>
                                  <div className="flex gap-1.5">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); deployToStorm(event); }}
                                      className="flex-1 text-[10px] bg-storm-purple text-white rounded py-1.5 hover:bg-storm-purple/90 transition-colors font-semibold"
                                    >🚀 Deploy</button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); fetchStormBriefing(event); setLeftTab("briefing"); }}
                                      className="flex-1 text-[10px] bg-storm-z2 text-white border border-storm-border rounded py-1.5 hover:border-storm-purple/30 transition-colors"
                                    >🤖 AI Brief</button>
                                  </div>
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* ═══ TAB: AI BRIEFING ═══ */}
                {leftTab === "briefing" && (
                  <div className="p-3">
                    {briefingLoading ? (
                      <div className="p-8 text-center">
                        <div className="w-8 h-8 border-2 border-storm-purple border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                        <div className="text-sm text-storm-muted">Generating AI storm briefing…</div>
                        <div className="text-[10px] text-storm-muted/60 mt-1">Analyzing storm data, properties, and pipeline</div>
                      </div>
                    ) : stormBriefing ? (
                      <>
                        {/* Deployment badge */}
                        <div className={`mb-3 p-2.5 rounded-lg border ${
                          stormBriefing.recommendation.action === "deploy"
                            ? "bg-emerald-500/10 border-emerald-500/30"
                            : stormBriefing.recommendation.action === "hold"
                            ? "bg-yellow-500/10 border-yellow-500/30"
                            : "bg-blue-500/10 border-blue-500/30"
                        }`}>
                          <div className="flex items-center justify-between">
                            <span className={`text-xs font-black tracking-wider ${
                              stormBriefing.recommendation.action === "deploy" ? "text-emerald-400" :
                              stormBriefing.recommendation.action === "hold" ? "text-yellow-400" : "text-blue-400"
                            }`}>
                              {stormBriefing.recommendation.action === "deploy" ? "🚀 DEPLOY" : stormBriefing.recommendation.action === "hold" ? "⏸️ HOLD" : "👁️ MONITOR"}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                              stormBriefing.recommendation.confidence === "high" ? "bg-emerald-500/20 text-emerald-400" :
                              stormBriefing.recommendation.confidence === "medium" ? "bg-yellow-500/20 text-yellow-400" :
                              "bg-red-500/20 text-red-400"
                            }`}>
                              {stormBriefing.recommendation.confidence.toUpperCase()} CONFIDENCE
                            </span>
                          </div>
                        </div>

                        {/* Context stats */}
                        <div className="grid grid-cols-3 gap-2 mb-3">
                          <div className="bg-storm-z1 rounded-lg p-2 border border-storm-border text-center">
                            <div className="text-[10px] text-storm-muted">Properties</div>
                            <div className="text-sm text-white font-bold">{stormBriefing.context.estimatedProperties.toLocaleString()}</div>
                          </div>
                          <div className="bg-storm-z1 rounded-lg p-2 border border-storm-border text-center">
                            <div className="text-[10px] text-storm-muted">Opportunity</div>
                            <div className="text-sm text-storm-purple font-bold">
                              ${stormBriefing.context.estimatedOpportunity >= 1000000
                                ? `${(stormBriefing.context.estimatedOpportunity / 1000000).toFixed(1)}M`
                                : `${(stormBriefing.context.estimatedOpportunity / 1000).toFixed(0)}K`}
                            </div>
                          </div>
                          <div className="bg-storm-z1 rounded-lg p-2 border border-storm-border text-center">
                            <div className="text-[10px] text-storm-muted">Existing Leads</div>
                            <div className="text-sm text-white font-bold">{stormBriefing.context.existingLeadsInArea}</div>
                          </div>
                        </div>

                        {/* AI Briefing text */}
                        <div className="bg-storm-z1 rounded-lg p-3 border border-storm-border">
                          <div className="text-[11px] text-white/90 leading-relaxed whitespace-pre-line">
                            {stormBriefing.briefing}
                          </div>
                        </div>

                        {/* Deploy button */}
                        {stormBriefing.recommendation.action === "deploy" && selectedTimelineEvent && (
                          <button
                            onClick={() => deployToStorm(selectedTimelineEvent)}
                            className="w-full mt-3 text-sm bg-storm-purple text-white rounded-lg py-2.5 hover:bg-storm-purple/90 transition-colors font-bold"
                          >
                            🚀 Launch Canvass Mission
                          </button>
                        )}
                      </>
                    ) : (
                      <div className="p-8 text-center">
                        <div className="text-3xl mb-3">🤖</div>
                        <div className="text-sm text-white font-semibold mb-1">AI Storm Briefing</div>
                        <div className="text-xs text-storm-muted mb-4">Select a storm from the Timeline tab and click &quot;AI Brief&quot; to get a tactical deployment analysis.</div>
                        {timeline.length > 0 && (
                          <button
                            onClick={() => { fetchStormBriefing(timeline[0]); setSelectedTimelineEvent(timeline[0]); }}
                            className="text-xs bg-storm-purple/20 text-storm-purple border border-storm-purple/30 rounded-lg px-4 py-2 hover:bg-storm-purple/30 transition-colors"
                          >
                            Analyze Most Recent Storm
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ─── RIGHT PANEL ─── */}
        <div className={`absolute right-0 top-0 bottom-0 z-20 transition-all duration-300 ${rightPanelOpen ? "w-80" : "w-0"}`}>
          {rightPanelOpen && (
            <div className="w-80 h-full bg-storm-z0/95 backdrop-blur-xl border-l border-storm-border flex flex-col">
              {/* Tab bar */}
              <div className="flex-none border-b border-storm-border flex items-center">
                <TabButton label="Intel" active={rightTab === "intel"} onClick={() => setRightTab("intel")} icon="🏠" />
                <TabButton label="Mission" active={rightTab === "mission"} onClick={() => setRightTab("mission")} icon="🎯"
                  badge={activeMission ? activeMission.stopsCompleted : undefined} />
                <TabButton label="Deploy" active={rightTab === "deploy"} onClick={() => setRightTab("deploy")} icon="🚀"
                  badge={routeStops.length > 0 ? routeStops.length : undefined} />
                <button onClick={() => setRightPanelOpen(false)} className="ml-auto mr-2 text-storm-muted hover:text-white text-xs p-1">✕</button>
              </div>

              <div className="flex-1 overflow-y-auto">

                {/* ═══ RIGHT TAB: INTEL ═══ */}
                {rightTab === "intel" && (
                  <>
                    {/* Property Intel */}
                    {propertyLoading && (
                      <div className="p-6 flex items-center justify-center">
                        <div className="w-6 h-6 border-2 border-storm-purple border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}

                    {propertyIntel && !propertyLoading && (propertyIntel as any)._notFound && (
                      <div className="p-3 border-b border-storm-border">
                        <h3 className="text-xs font-semibold text-storm-muted uppercase tracking-wider mb-2">Property Intelligence</h3>
                        <div className="bg-storm-z1 rounded-lg p-4 border border-storm-border text-center">
                          <div className="text-2xl mb-2">🏚️</div>
                          <div className="text-sm text-white font-semibold mb-1">No Property Found</div>
                          <div className="text-xs text-storm-muted">{(propertyIntel as any)._message}</div>
                        </div>
                      </div>
                    )}

                    {propertyIntel && !propertyLoading && !(propertyIntel as any)._notFound && (
                      <div className="p-3 border-b border-storm-border">
                        <h3 className="text-xs font-semibold text-storm-muted uppercase tracking-wider mb-2">Property Intelligence</h3>
                        <div className="bg-storm-z1 rounded-lg p-3 border border-storm-border space-y-3">
                          {(() => {
                            const ownerName = typeof propertyIntel.owner === "string" ? propertyIntel.owner : propertyIntel.owner?.name || [propertyIntel.owner?.firstName, propertyIntel.owner?.lastName].filter(Boolean).join(" ") || null;
                            const yearBuilt = propertyIntel.yearBuilt || propertyIntel.property?.yearBuilt;
                            const sqFt = propertyIntel.squareFeet || propertyIntel.property?.squareFootage;
                            const roofAge = propertyIntel.roofAge ?? propertyIntel.roof?.age;
                            const roofSqFt = propertyIntel.roofSquares || (propertyIntel.roof?.squareFootage ? Math.round(propertyIntel.roof.squareFootage / 100) : null);
                            return (
                              <>
                                <div>
                                  <div className="text-sm text-white font-semibold">{propertyIntel.address}</div>
                                  {ownerName && <div className="text-xs text-storm-muted mt-0.5">Owner: {ownerName}</div>}
                                  {typeof propertyIntel.owner === "object" && propertyIntel.owner?.absenteeOwner && (
                                    <div className="text-[10px] text-orange-400 mt-0.5">⚡ Absentee Owner</div>
                                  )}
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  {yearBuilt ? <div><span className="text-storm-muted">Year Built</span><div className="text-white">{yearBuilt}</div></div> : null}
                                  {sqFt ? <div><span className="text-storm-muted">Sq Ft</span><div className="text-white">{sqFt.toLocaleString()}</div></div> : null}
                                  {roofAge != null ? <div><span className="text-storm-muted">Roof Age</span><div className={`font-medium ${roofAge >= 15 ? "text-red-400" : roofAge >= 10 ? "text-yellow-400" : "text-emerald-400"}`}>{roofAge} years</div></div> : null}
                                  {roofSqFt ? <div><span className="text-storm-muted">Roof Squares</span><div className="text-white">{roofSqFt}</div></div> : null}
                                </div>
                              </>
                            );
                          })()}

                          {propertyIntel.claimEstimate && (
                            <div className="bg-storm-purple/10 rounded-lg p-2 border border-storm-purple/20">
                              <div className="text-[10px] text-storm-muted uppercase tracking-wider mb-1">Claim Estimate</div>
                              <div className="text-lg text-storm-purple font-bold">${(propertyIntel.claimEstimate.total || 0).toLocaleString()}</div>
                              <div className="text-[10px] text-storm-muted mt-0.5">
                                Roof: ${(propertyIntel.claimEstimate.roofReplacement || 0).toLocaleString()}
                                {propertyIntel.claimEstimate.gutters ? ` · Gutters: $${propertyIntel.claimEstimate.gutters.toLocaleString()}` : ""}
                              </div>
                            </div>
                          )}

                          {propertyIntel.stormExposure && (
                            <div className="bg-orange-500/10 rounded-lg p-2 border border-orange-500/20">
                              <div className="text-[10px] text-storm-muted uppercase tracking-wider mb-1">Storm Exposure</div>
                              <div className="text-xs text-orange-400">{propertyIntel.stormExposure.summary}</div>
                            </div>
                          )}

                          <button
                            onClick={() => { setRouteStops((prev) => [...prev, { id: `intel-${Date.now()}`, address: propertyIntel.address, lat: propertyIntel.lat, lng: propertyIntel.lng, source: "manual" as const }]); }}
                            className="w-full text-xs bg-storm-z2 text-white border border-storm-border rounded-lg py-1.5 hover:border-storm-purple/30 transition-colors"
                          >+ Add to Route</button>
                        </div>
                      </div>
                    )}

                    {/* Parcels */}
                    {parcelLoading && (
                      <div className="p-6 flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-storm-purple border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs text-storm-muted">Scanning parcels…</span>
                      </div>
                    )}
                    {parcels.length > 0 && !parcelLoading && (
                      <div className="p-3 border-b border-storm-border">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-xs font-semibold text-storm-muted uppercase tracking-wider">Parcels ({parcels.length})</h3>
                          <button
                            onClick={() => {
                              const residential = parcels.filter((p) => ["SFR", "MFR", "CON", "TH", "MOB"].includes(p.typeCode));
                              residential.slice(0, 20).forEach(addParcelToRoute);
                            }}
                            className="text-[10px] text-storm-purple hover:text-storm-purple/80 transition-colors"
                          >+ Add all residential</button>
                        </div>
                        <div className="space-y-1.5 max-h-64 overflow-y-auto">
                          {parcels.slice(0, 50).map((parcel) => (
                            <div key={parcel.id} className="p-2 rounded-lg bg-storm-z1 border border-storm-border hover:border-storm-purple/30 transition-colors group">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <button
                                    onClick={() => { fetchPropertyIntel(`${parcel.address}, ${parcel.city}, ${parcel.state} ${parcel.zip}`); setMapCenter({ lat: parcel.lat, lng: parcel.lng }); setMapZoom(18); }}
                                    className="text-xs text-white hover:text-storm-purple transition-colors text-left truncate block w-full"
                                  >{parcel.address}</button>
                                  <div className="text-[10px] text-storm-muted truncate">{parcel.owner}</div>
                                  <div className="text-[10px] text-storm-muted/60">{parcel.propertyType}</div>
                                </div>
                                <button onClick={() => addParcelToRoute(parcel)} className="text-[10px] text-storm-muted hover:text-storm-purple opacity-0 group-hover:opacity-100 transition-all flex-none mt-0.5" title="Add to route">+ Route</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* ═══ RIGHT TAB: ACTIVE MISSION ═══ */}
                {rightTab === "mission" && (
                  <div className="p-3">
                    {activeMission ? (
                      <>
                        {/* Mission header */}
                        <div className="bg-storm-z1 rounded-lg p-3 border border-storm-border mb-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-sm text-white font-semibold">{activeMission.name}</div>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                              activeMission.status === "in_progress" ? "bg-emerald-500/20 text-emerald-400" :
                              activeMission.status === "planned" ? "bg-blue-500/20 text-blue-400" :
                              activeMission.status === "completed" ? "bg-storm-purple/20 text-storm-purple" :
                              "bg-red-500/20 text-red-400"
                            }`}>{activeMission.status.toUpperCase()}</span>
                          </div>

                          {/* Progress bar */}
                          <div className="w-full h-2 bg-storm-z2 rounded-full overflow-hidden mb-2">
                            <div
                              className="h-full bg-storm-purple rounded-full transition-all duration-500"
                              style={{ width: `${activeMission.totalStops > 0 ? (activeMission.stopsCompleted / activeMission.totalStops) * 100 : 0}%` }}
                            />
                          </div>

                          {/* Mission stats */}
                          <div className="grid grid-cols-4 gap-1 text-center">
                            <div><div className="text-xs text-white font-bold">{activeMission.stopsCompleted}/{activeMission.totalStops}</div><div className="text-[9px] text-storm-muted">Stops</div></div>
                            <div><div className="text-xs text-white font-bold">{activeMission.stopsKnocked}</div><div className="text-[9px] text-storm-muted">Knocked</div></div>
                            <div><div className="text-xs text-emerald-400 font-bold">{activeMission.appointmentsSet}</div><div className="text-[9px] text-storm-muted">Appts</div></div>
                            <div><div className="text-xs text-storm-purple font-bold">${(activeMission.estimatedPipeline / 1000).toFixed(0)}K</div><div className="text-[9px] text-storm-muted">Pipeline</div></div>
                          </div>
                        </div>

                        {/* Mission stops */}
                        {missionStops.length > 0 && (
                          <div className="space-y-1.5">
                            {missionStops.map((stop) => (
                              <div key={stop.id} className={`p-2 rounded-lg border transition-colors ${
                                stop.outcome === "pending" ? "bg-storm-z1 border-storm-border" :
                                stop.outcome === "appointment_set" || stop.outcome === "inspection_set" ? "bg-emerald-500/10 border-emerald-500/30" :
                                stop.outcome === "not_home" ? "bg-yellow-500/10 border-yellow-500/30" :
                                "bg-storm-z1 border-storm-border/60"
                              }`}>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs text-white truncate flex-1">#{stop.stopOrder} {stop.address}</span>
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                                    stop.outcome === "pending" ? "text-storm-muted" :
                                    stop.outcome === "appointment_set" ? "bg-emerald-500/20 text-emerald-400" :
                                    stop.outcome === "knocked" ? "bg-blue-500/20 text-blue-400" :
                                    stop.outcome === "not_home" ? "bg-yellow-500/20 text-yellow-400" :
                                    "bg-red-500/20 text-red-400"
                                  }`}>{stop.outcome.replace("_", " ").toUpperCase()}</span>
                                </div>
                                {stop.outcome === "pending" && activeMission && (
                                  <div className="flex gap-1 mt-1.5">
                                    <button onClick={() => updateStopOutcome(activeMission.id, stop.id, "knocked")} className="flex-1 text-[9px] bg-blue-500/15 text-blue-400 border border-blue-500/25 rounded py-1 hover:bg-blue-500/25">Knocked</button>
                                    <button onClick={() => updateStopOutcome(activeMission.id, stop.id, "not_home")} className="flex-1 text-[9px] bg-yellow-500/15 text-yellow-400 border border-yellow-500/25 rounded py-1 hover:bg-yellow-500/25">Not Home</button>
                                    <button onClick={() => updateStopOutcome(activeMission.id, stop.id, "appointment_set")} className="flex-1 text-[9px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 rounded py-1 hover:bg-emerald-500/25">Appt ✓</button>
                                    <button onClick={() => updateStopOutcome(activeMission.id, stop.id, "not_interested")} className="flex-1 text-[9px] bg-red-500/15 text-red-400 border border-red-500/25 rounded py-1 hover:bg-red-500/25">No</button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Export */}
                        {routeStops.length >= 2 && (
                          <button onClick={exportRouteToGoogleMaps} className="w-full mt-3 text-xs bg-storm-z2 text-white border border-storm-border rounded-lg py-2 hover:border-storm-purple/30 transition-colors">
                            📱 Export to Google Maps
                          </button>
                        )}
                      </>
                    ) : missions.length > 0 ? (
                      <>
                        <h3 className="text-xs font-semibold text-storm-muted uppercase tracking-wider mb-2">Recent Missions</h3>
                        <div className="space-y-2">
                          {missions.slice(0, 10).map((m) => (
                            <button
                              key={m.id}
                              onClick={() => setActiveMission(m)}
                              className="w-full text-left p-2.5 rounded-lg bg-storm-z1 border border-storm-border hover:border-storm-purple/30 transition-colors"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-white font-medium truncate">{m.name}</span>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                                  m.status === "completed" ? "bg-emerald-500/20 text-emerald-400" :
                                  m.status === "in_progress" ? "bg-blue-500/20 text-blue-400" :
                                  "bg-storm-z2 text-storm-muted"
                                }`}>{m.status}</span>
                              </div>
                              <div className="flex items-center gap-3 text-[10px] text-storm-muted">
                                <span>{m.totalStops} stops</span>
                                <span>{m.appointmentsSet} appts</span>
                                <span>${(m.estimatedPipeline / 1000).toFixed(0)}K</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="p-8 text-center">
                        <div className="text-3xl mb-3">🎯</div>
                        <div className="text-sm text-white font-semibold mb-1">No Missions Yet</div>
                        <div className="text-xs text-storm-muted">Deploy to a storm from the Timeline tab to create your first canvass mission.</div>
                      </div>
                    )}
                  </div>
                )}

                {/* ═══ RIGHT TAB: DEPLOY / ROUTE BUILDER ═══ */}
                {rightTab === "deploy" && (
                  <div className="p-3">
                    <h3 className="text-xs font-semibold text-storm-muted uppercase tracking-wider mb-2">
                      Route Builder ({routeStops.length} stops)
                    </h3>

                    {missionLoading && (
                      <div className="p-6 flex flex-col items-center gap-2">
                        <div className="w-6 h-6 border-2 border-storm-purple border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs text-storm-muted">Scanning properties & building route…</span>
                      </div>
                    )}

                    {!missionLoading && routeStops.length === 0 ? (
                      <div className="text-xs text-storm-muted/60 text-center py-4">
                        Click parcels, use quick actions, or deploy to a storm to add stops
                      </div>
                    ) : !missionLoading && (
                      <div className="space-y-1.5 mb-3">
                        {routeStops.map((stop, i) => (
                          <div key={stop.id} className="flex items-center gap-2 p-1.5 rounded-lg bg-storm-z1 border border-storm-border">
                            <span className="w-5 h-5 rounded-full bg-storm-purple/20 text-storm-purple flex items-center justify-center text-[10px] font-bold flex-none">{i + 1}</span>
                            <span className="text-xs text-white truncate flex-1">{stop.address}</span>
                            <button onClick={() => removeRouteStop(stop.id)} className="text-storm-muted hover:text-red-400 text-[10px] flex-none">✕</button>
                          </div>
                        ))}
                      </div>
                    )}

                    {routeStops.length >= 2 && (
                      <div className="space-y-2">
                        <button
                          onClick={optimizeRoute}
                          disabled={routeLoading}
                          className="w-full text-xs bg-storm-purple text-white rounded-lg py-2 hover:bg-storm-purple/90 transition-colors disabled:opacity-50 font-medium"
                        >{routeLoading ? "Optimizing…" : "🛣️ Optimize Route"}</button>

                        {routeResult && (
                          <div className="bg-storm-z1 rounded-lg p-2 border border-storm-border">
                            <div className="flex justify-between text-xs text-white mb-1">
                              <span>{routeResult.totalDistance}</span>
                              <span>{routeResult.totalDuration}</span>
                            </div>
                            <div className="space-y-0.5">
                              {routeResult.legs.map((leg, i) => (
                                <div key={i} className="text-[10px] text-storm-muted">{leg.distance} · {leg.duration}</div>
                              ))}
                            </div>
                          </div>
                        )}

                        <button onClick={exportRouteToGoogleMaps} className="w-full text-xs bg-storm-z2 text-white border border-storm-border rounded-lg py-1.5 hover:border-storm-purple/30 transition-colors">
                          📱 Export to Google Maps
                        </button>

                        <button onClick={() => { setRouteStops([]); setRouteResult(null); }} className="w-full text-xs text-storm-muted hover:text-red-400 py-1 transition-colors">
                          Clear Route
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            MAP (Full Bleed)
            ═══════════════════════════════════════════════════════════════════ */}
        <div className="flex-1 relative">
          <MapboxMap
            center={mapCenter}
            zoom={mapZoom}
            markers={mapMarkers}
            paths={mapPaths}
            circles={mapCircles}
            onMarkerClick={handleMarkerClick}
            onMapClick={handleMapClick}
            showRadar={showRadar}
            showUserLocation={true}
            darkMode={true}
          />

          {/* Search Bar */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 w-full max-w-md px-4">
            <div className="flex items-center bg-storm-z0/90 backdrop-blur-xl rounded-xl border border-storm-border shadow-2xl overflow-hidden">
              <input
                type="text"
                value={searchAddress}
                onChange={(e) => setSearchAddress(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddressSearch()}
                placeholder="Search address, city, or zip…"
                className="flex-1 bg-transparent text-white text-sm px-4 py-2.5 placeholder:text-storm-muted/60 focus:outline-none"
              />
              <button onClick={handleAddressSearch} className="px-3 py-2.5 text-storm-purple hover:bg-storm-purple/10 transition-colors">🔍</button>
            </div>
          </div>

          {/* Panel toggles */}
          {!leftPanelOpen && (
            <button onClick={() => setLeftPanelOpen(true)}
              className="absolute top-3 left-3 z-10 bg-storm-z0/90 backdrop-blur-xl border border-storm-border rounded-lg px-3 py-2 text-xs text-white hover:border-storm-purple/30 transition-colors shadow-lg">
              🌩️ Intel {(stormCells.length + alerts.length > 0) && (
                <span className="ml-1 bg-red-500/30 text-red-400 px-1.5 py-0.5 rounded-full text-[10px] font-bold">{stormCells.length + alerts.length}</span>
              )}
            </button>
          )}
          {!rightPanelOpen && (
            <button onClick={() => setRightPanelOpen(true)}
              className="absolute top-3 right-3 z-10 bg-storm-z0/90 backdrop-blur-xl border border-storm-border rounded-lg px-3 py-2 text-xs text-white hover:border-storm-purple/30 transition-colors shadow-lg">
              🏠 Intel & Missions {routeStops.length > 0 && (
                <span className="ml-1 bg-storm-purple/30 text-storm-purple px-1.5 py-0.5 rounded-full text-[10px] font-bold">{routeStops.length}</span>
              )}
            </button>
          )}

          {/* Quick Actions */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-storm-z0/90 backdrop-blur-xl rounded-xl border border-storm-border shadow-2xl p-1.5">
            <QuickActionButton icon="📡" label="Radar" active={showRadar} onClick={() => setShowRadar(!showRadar)} />
            <div className="w-px h-6 bg-storm-border" />
            <QuickActionButton icon="🔍" label="Scan Zone" active={activeQuickAction === "scan"} onClick={() => setActiveQuickAction(activeQuickAction === "scan" ? null : "scan")} />
            <QuickActionButton icon="🏠" label="Property Intel" active={activeQuickAction === "intel"} onClick={() => setActiveQuickAction(activeQuickAction === "intel" ? null : "intel")} />
            <QuickActionButton icon="📌" label="Add Stop" active={activeQuickAction === "route-add"} onClick={() => { setActiveQuickAction(activeQuickAction === "route-add" ? null : "route-add"); setRightPanelOpen(true); setRightTab("deploy"); }} />
            <div className="w-px h-6 bg-storm-border" />
            <QuickActionButton icon="🔄" label="Refresh" onClick={() => fetchStormData(mapCenter.lat, mapCenter.lng)} />
            <QuickActionButton icon="📍" label="My Location" onClick={() => { getLocation(); if (latitude && longitude) { setMapCenter({ lat: latitude, lng: longitude }); setMapZoom(10); } }} />
          </div>

          {/* Active action indicator */}
          {activeQuickAction && (
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-10 bg-storm-purple/90 text-white text-xs px-4 py-2 rounded-lg shadow-lg animate-pulse">
              {activeQuickAction === "scan" && "Click map to scan parcels in that area"}
              {activeQuickAction === "intel" && "Click map to get property intel"}
              {activeQuickAction === "route-add" && "Click map to add route stop"}
              <button onClick={() => setActiveQuickAction(null)} className="ml-2 opacity-70 hover:opacity-100">✕</button>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          BOTTOM DOCK: Forecast + Mission Stats
          ═══════════════════════════════════════════════════════════════════ */}
      <div className={`flex-none border-t border-storm-border transition-all duration-300 ${bottomDockOpen ? "h-28" : "h-8"}`}>
        <button onClick={() => setBottomDockOpen(!bottomDockOpen)}
          className="w-full h-8 flex items-center justify-center gap-2 bg-storm-z0 hover:bg-storm-z1 transition-colors text-xs text-storm-muted">
          <span>{bottomDockOpen ? "▼" : "▲"}</span>
          <span>7-Day Forecast & Mission Stats</span>
          {forecast.some((d) => d.severeRisk !== "none") && <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />}
        </button>

        {bottomDockOpen && (
          <div className="h-20 bg-storm-z0 flex items-center px-4 gap-3 overflow-x-auto">
            {/* Forecast strip */}
            {forecast.length === 0 ? (
              <div className="text-xs text-storm-muted/60">Loading forecast…</div>
            ) : (
              forecast.map((day, i) => {
                const riskColors: Record<string, string> = { none: "border-storm-border", low: "border-blue-500/40", moderate: "border-yellow-500/40", high: "border-orange-500/40", extreme: "border-red-500/40" };
                return (
                  <div key={i} className={`flex-none w-24 p-2 rounded-lg bg-storm-z1 border ${riskColors[day.severeRisk]} text-center`}>
                    <div className="text-[10px] text-storm-muted font-medium">{day.dayOfWeek}</div>
                    <div className="flex items-center justify-center gap-1 text-xs">
                      <span className="text-white font-medium">{day.highF}°</span>
                      <span className="text-storm-muted">{day.lowF}°</span>
                    </div>
                    <div className="flex items-center justify-center gap-1 text-[10px] mt-0.5">
                      {day.hailRisk && <span title="Hail risk">🧊</span>}
                      {day.tornadoRisk && <span title="Tornado risk">🌪️</span>}
                      {day.windRisk && <span title="Wind risk">💨</span>}
                      {day.severeRisk === "none" && day.precipChance < 30 && <span className="text-emerald-400">✓ Canvas</span>}
                      {day.severeRisk !== "none" && (
                        <span className={`font-bold ${
                          day.severeRisk === "extreme" ? "text-red-400" : day.severeRisk === "high" ? "text-orange-400" : day.severeRisk === "moderate" ? "text-yellow-400" : "text-blue-400"
                        }`}>{day.severeRisk.toUpperCase()}</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {/* Separator */}
            <div className="w-px h-12 bg-storm-border flex-none" />

            {/* Mission stats (if available) */}
            {revenueData && (
              <div className="flex items-center gap-3 flex-none">
                <StatChip label="Missions" value={String(revenueData.missions.totalMissions)} />
                <StatChip label="Doors" value={String(revenueData.missions.totalDoorsKnocked)} />
                <StatChip label="Appts" value={String(revenueData.missions.totalAppointments)} color="text-emerald-400" />
                <StatChip label="Appt Rate" value={`${revenueData.missions.appointmentRate}%`} color="text-storm-purple" />
              </div>
            )}

            {/* Scan radius */}
            <div className="flex-none ml-auto pl-3 flex items-center gap-2 border-l border-storm-border">
              <span className="text-[10px] text-storm-muted whitespace-nowrap">Scan:</span>
              <select
                value={parcelSearchRadius}
                onChange={(e) => setParcelSearchRadius(parseFloat(e.target.value))}
                className="bg-storm-z1 text-white text-xs rounded border border-storm-border px-2 py-1 focus:outline-none focus:border-storm-purple/40"
              >
                <option value="0.1">0.1 mi</option>
                <option value="0.25">0.25 mi</option>
                <option value="0.5">0.5 mi</option>
                <option value="1">1 mi</option>
                <option value="2">2 mi</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

function TabButton({ label, active, onClick, icon, badge }: {
  label: string; active: boolean; onClick: () => void; icon: string; badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2.5 text-xs transition-colors border-b-2 ${
        active ? "border-storm-purple text-white" : "border-transparent text-storm-muted hover:text-white"
      }`}
    >
      <span>{icon}</span>
      <span>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="bg-storm-purple/30 text-storm-purple text-[9px] px-1.5 py-0.5 rounded-full font-bold">{badge}</span>
      )}
    </button>
  );
}

function QuickActionButton({ icon, label, active, onClick }: {
  icon: string; label: string; active?: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
        active ? "bg-storm-purple/20 text-storm-purple border border-storm-purple/30" : "text-white hover:bg-white/10 border border-transparent"
      }`}
      title={label}
    >
      <span>{icon}</span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function StatChip({ label, value, color = "text-white" }: { label: string; value: string; color?: string }) {
  return (
    <div className="text-center">
      <div className={`text-sm font-bold ${color}`}>{value}</div>
      <div className="text-[9px] text-storm-muted">{label}</div>
    </div>
  );
}
