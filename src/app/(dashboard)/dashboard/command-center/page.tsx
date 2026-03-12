"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useGeolocation } from "@/hooks/useGeolocation";
import dynamic from "next/dynamic";
import type { MapMarker, StormPath, MapCircle } from "@/components/ui/MapboxMap";

// Lazy-load map to avoid SSR issues
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
  source: "parcel" | "manual" | "storm";
}

interface RouteResult {
  totalDistance: string;
  totalDuration: string;
  legs: {
    distance: string;
    duration: string;
    startAddress: string;
    endAddress: string;
  }[];
  polyline: string;
  waypointOrder: number[];
}

interface PropertyIntel {
  address: string;
  lat: number;
  lng: number;
  owner?: string | { name?: string; firstName?: string; lastName?: string; mailingAddress?: string; absenteeOwner?: boolean };
  property?: { yearBuilt?: number; squareFootage?: number; value?: number; buildingType?: string; bedrooms?: number; bathrooms?: number };
  roof?: { age?: number; squareFootage?: number; type?: string; material?: string; condition?: string };
  // Flat fields (for backward compat)
  yearBuilt?: number;
  squareFeet?: number;
  roofAge?: number;
  roofSquares?: number;
  estimatedValue?: number;
  claimEstimate?: { roofReplacement: number; gutters: number; siding?: number; total: number; confidence?: string };
  stormExposure?: {
    hailEvents: number;
    maxHailSize: number;
    lastStormDate?: string;
    summary: string;
  };
  source: string;
  [key: string]: any; // allow extra fields from API
}

// ─── Constants ─────────────────────────────────────────────────────────────

const THREAT_COLORS = {
  none: { bg: "bg-emerald-500/20", text: "text-emerald-400", border: "border-emerald-500/40", label: "ALL CLEAR", dot: "bg-emerald-400" },
  low: { bg: "bg-blue-500/20", text: "text-blue-400", border: "border-blue-500/40", label: "MONITORING", dot: "bg-blue-400" },
  moderate: { bg: "bg-yellow-500/20", text: "text-yellow-400", border: "border-yellow-500/40", label: "WATCH", dot: "bg-yellow-400" },
  high: { bg: "bg-orange-500/20", text: "text-orange-400", border: "border-orange-500/40", label: "WARNING", dot: "bg-orange-400" },
  extreme: { bg: "bg-red-500/20", text: "text-red-400", border: "border-red-500/40", label: "CRITICAL", dot: "bg-red-400" },
};

const REFRESH_INTERVAL = 60_000; // 60 seconds

// ─── Main Component ────────────────────────────────────────────────────────

export default function StormOperationsCenter() {
  // Geolocation
  const { latitude, longitude, loading: geoLoading, getLocation } = useGeolocation({ autoFetch: true });
  const userLat = latitude || 35.0;
  const userLng = longitude || -98.0;

  // Data state
  const [storms, setStorms] = useState<StormEvent[]>([]);
  const [alerts, setAlerts] = useState<FormattedAlert[]>([]);
  const [stormCells, setStormCells] = useState<FormattedStormCell[]>([]);
  const [forecast, setForecast] = useState<DayForecast[]>([]);
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [routeStops, setRouteStops] = useState<RouteStop[]>([]);
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [propertyIntel, setPropertyIntel] = useState<PropertyIntel | null>(null);
  
  // UI state
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [bottomDockOpen, setBottomDockOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [stormLoading, setStormLoading] = useState(false);
  const [parcelLoading, setParcelLoading] = useState(false);
  const [propertyLoading, setPropertyLoading] = useState(false);
  const [routeLoading, setRouteLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [showRadar, setShowRadar] = useState(true);
  const [searchAddress, setSearchAddress] = useState("");
  const [mapCenter, setMapCenter] = useState({ lat: userLat, lng: userLng });
  const [mapZoom, setMapZoom] = useState(7);
  const [selectedCell, setSelectedCell] = useState<FormattedStormCell | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<FormattedAlert | null>(null);
  const [parcelSearchRadius, setParcelSearchRadius] = useState(0.25);
  const [activeQuickAction, setActiveQuickAction] = useState<string | null>(null);
  const [alertTicker, setAlertTicker] = useState(0);

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

  const fetchParcels = useCallback(async (lat: number, lng: number, radius: number = 0.25) => {
    setParcelLoading(true);
    try {
      const res = await fetch(
        `/api/corelogic/parcels?lat=${lat}&lng=${lng}&radius=${radius}&pageSize=50&all=true`
      );
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
    try {
      const params = address
        ? `address=${encodeURIComponent(address)}`
        : `lat=${lat}&lng=${lng}`;
      const res = await fetch(`/api/property/lookup?${params}`);
      if (!res.ok) {
        setPropertyIntel(null);
        return;
      }
      const data = await res.json();
      setPropertyIntel(data);
    } catch (e) {
      console.error("Property intel error:", e);
      setPropertyIntel(null);
    } finally {
      setPropertyLoading(false);
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
      setRouteResult(data);
    } catch (e) {
      console.error("Route optimize error:", e);
    } finally {
      setRouteLoading(false);
    }
  }, [routeStops]);

  // ─── Initial Load ────────────────────────────────────────────────────────

  useEffect(() => {
    if (userLat && userLng) {
      setMapCenter({ lat: userLat, lng: userLng });
      Promise.all([
        fetchStormData(userLat, userLng),
        fetchForecast(userLat, userLng),
      ]).finally(() => setLoading(false));
    }
  }, [userLat, userLng, fetchStormData, fetchForecast]);

  // Auto-refresh storm data
  useEffect(() => {
    refreshTimerRef.current = setInterval(() => {
      fetchStormData(mapCenter.lat, mapCenter.lng);
    }, REFRESH_INTERVAL);
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [mapCenter, fetchStormData]);

  // Alert ticker rotation
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

  // Build map markers from all data sources
  const mapMarkers: MapMarker[] = useMemo(() => {
    const markers: MapMarker[] = [];

    // Storm events
    storms.forEach((s) => {
      markers.push({
        id: `storm-${s.id}`,
        lat: s.lat,
        lng: s.lng,
        type: s.type,
        severity: s.severity,
        popup: `<b>${s.type.toUpperCase()}</b><br/>${s.location || "Unknown"}<br/>Damage: ${s.damageScore}/100${s.hailSize ? `<br/>Hail: ${s.hailSize}"` : ""}${s.windSpeed ? `<br/>Wind: ${s.windSpeed}mph` : ""}`,
      });
    });

    // Storm cells
    stormCells.forEach((c) => {
      markers.push({
        id: `cell-${c.id}`,
        lat: c.lat,
        lng: c.lng,
        type: c.tornadoProb > 20 ? "tornado" : c.isSevere ? "severe_thunderstorm" : "hail",
        severity: c.isSevere ? "severe" : c.hailProbSevere > 30 ? "moderate" : "minor",
        popup: `<b>Storm Cell</b><br/>${c.location}<br/>Hail: ${c.maxHailSize}" (${c.hailProb}%)<br/>Tornado: ${c.tornadoProb}%<br/>Speed: ${c.speedMph}mph`,
      });
    });

    // Parcels (on map when loaded)
    parcels.forEach((p) => {
      if (p.lat && p.lng) {
        markers.push({
          id: `parcel-${p.id}`,
          lat: p.lat,
          lng: p.lng,
          type: "property",
          popup: `<b>${p.address}</b><br/>${p.city}, ${p.state} ${p.zip}<br/>Owner: ${p.owner}<br/>Type: ${p.propertyType}`,
          size: 14,
        });
      }
    });

    // Route stops
    routeStops.forEach((s, i) => {
      markers.push({
        id: `route-${s.id}`,
        lat: s.lat,
        lng: s.lng,
        type: "location",
        popup: `<b>Stop ${i + 1}</b><br/>${s.address}`,
        color: "#6D5CFF",
        size: 24,
      });
    });

    return markers;
  }, [storms, stormCells, parcels, routeStops]);

  // Build storm paths
  const mapPaths: StormPath[] = useMemo(() => {
    const paths: StormPath[] = [];

    storms.forEach((s) => {
      if (s.path && s.path.length >= 2) {
        paths.push({
          id: `track-${s.id}`,
          coordinates: s.path.map((p) => [p.lng, p.lat] as [number, number]),
          color: s.severity === "extreme" ? "#dc2626" : s.severity === "severe" ? "#f97316" : "#eab308",
          width: 3,
        });
      }
    });

    return paths;
  }, [storms]);

  // Build impact circles for active storms
  const mapCircles: MapCircle[] = useMemo(() => {
    return stormCells
      .filter((c) => c.isSevere)
      .map((c) => ({
        id: `impact-${c.id}`,
        center: [c.lng, c.lat] as [number, number],
        radiusMiles: c.maxHailSize > 1 ? 8 : 5,
        color: c.tornadoProb > 20 ? "#dc2626" : c.isSevere ? "#f97316" : "#eab308",
        opacity: 0.15,
      }));
  }, [stormCells]);

  // ─── Event Handlers ──────────────────────────────────────────────────────

  const handleMapClick = useCallback((lat: number, lng: number) => {
    if (activeQuickAction === "scan") {
      // Scan parcels at clicked location
      setMapCenter({ lat, lng });
      setMapZoom(15);
      fetchParcels(lat, lng, parcelSearchRadius);
      setActiveQuickAction(null);
      setRightPanelOpen(true);
    } else if (activeQuickAction === "intel") {
      // Property intel at clicked location
      fetchPropertyIntel(undefined, lat, lng);
      setActiveQuickAction(null);
    } else if (activeQuickAction === "route-add") {
      // Add point to route
      setRouteStops((prev) => [
        ...prev,
        {
          id: `manual-${Date.now()}`,
          address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
          lat,
          lng,
          source: "manual",
        },
      ]);
    }
  }, [activeQuickAction, fetchParcels, fetchPropertyIntel, parcelSearchRadius]);

  const handleMarkerClick = useCallback((marker: MapMarker) => {
    if (marker.id.startsWith("parcel-")) {
      const parcelId = parseInt(marker.id.replace("parcel-", ""));
      const parcel = parcels.find((p) => p.id === parcelId);
      if (parcel) {
        fetchPropertyIntel(
          `${parcel.address}, ${parcel.city}, ${parcel.state} ${parcel.zip}`
        );
      }
    } else if (marker.id.startsWith("cell-")) {
      const cellId = marker.id.replace("cell-", "");
      const cell = stormCells.find((c) => c.id === cellId);
      if (cell) {
        setSelectedCell(cell);
        setLeftPanelOpen(true);
      }
    }
  }, [parcels, stormCells, fetchPropertyIntel]);

  const handleAddressSearch = useCallback(async () => {
    if (!searchAddress.trim()) return;
    // Geocode via Mapbox
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchAddress)}.json?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}&limit=1`
      );
      const data = await res.json();
      if (data.features?.[0]) {
        const [lng, lat] = data.features[0].center;
        setMapCenter({ lat, lng });
        setMapZoom(15);
        // Fetch parcels and property intel in parallel
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
      return [
        ...prev,
        {
          id: `parcel-${parcel.id}`,
          address: `${parcel.address}, ${parcel.city}, ${parcel.state}`,
          lat: parcel.lat,
          lng: parcel.lng,
          source: "parcel" as const,
        },
      ];
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
    const waypoints = routeStops
      .slice(1, -1)
      .map((s) => `${s.lat},${s.lng}`)
      .join("|");
    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}${waypoints ? `&waypoints=${waypoints}` : ""}&travelmode=driving`;
    window.open(url, "_blank");
  }, [routeStops]);

  // ─── Render ──────────────────────────────────────────────────────────────

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

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-storm-bg overflow-hidden relative">
      
      {/* ─── THREAT LEVEL STATUS BAR ─── */}
      <div className={`flex-none h-10 ${threat.bg} border-b ${threat.border} flex items-center px-4 gap-4 z-30`}>
        {/* Threat badge */}
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${threat.dot} ${threatLevel !== "none" ? "animate-pulse" : ""}`} />
          <span className={`text-xs font-bold tracking-widest ${threat.text}`}>{threat.label}</span>
        </div>

        {/* Separator */}
        <div className="w-px h-5 bg-white/10" />

        {/* Stats strip */}
        <div className="flex items-center gap-4 text-xs text-storm-muted">
          <span>
            <span className="text-white font-medium">{stormCells.length}</span> Active Cells
          </span>
          <span>
            <span className="text-white font-medium">{alerts.length}</span> Alerts
          </span>
          <span>
            <span className="text-white font-medium">{storms.length}</span> Reports
          </span>
          {parcels.length > 0 && (
            <span>
              <span className="text-white font-medium">{parcels.length}</span> Parcels
            </span>
          )}
        </div>

        {/* Alert ticker */}
        {alerts.length > 0 && (
          <>
            <div className="w-px h-5 bg-white/10" />
            <div className="flex-1 overflow-hidden">
              <div className="text-xs truncate" style={{ color: alerts[alertTicker % alerts.length]?.color || "#fff" }}>
                ⚠ {alerts[alertTicker % alerts.length]?.name} — {alerts[alertTicker % alerts.length]?.location}
              </div>
            </div>
          </>
        )}

        {/* Right side — time + refresh */}
        <div className="ml-auto flex items-center gap-3 text-xs text-storm-muted">
          <span>Updated {lastRefresh.toLocaleTimeString()}</span>
          <button
            onClick={() => fetchStormData(mapCenter.lat, mapCenter.lng)}
            className={`p-1 rounded hover:bg-white/10 transition-colors ${stormLoading ? "animate-spin" : ""}`}
            title="Refresh"
          >
            ↻
          </button>
        </div>
      </div>

      {/* ─── MAIN AREA: Panels + Map ─── */}
      <div className="flex-1 flex relative overflow-hidden">

        {/* ─── LEFT PANEL: Storm Intelligence ─── */}
        <div
          className={`absolute left-0 top-0 bottom-0 z-20 transition-all duration-300 ${
            leftPanelOpen ? "w-80" : "w-0"
          }`}
        >
          {leftPanelOpen && (
            <div className="w-80 h-full bg-storm-z0/95 backdrop-blur-xl border-r border-storm-border flex flex-col">
              {/* Panel header */}
              <div className="flex-none p-3 border-b border-storm-border flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  🌩️ Storm Intel
                </h2>
                <button
                  onClick={() => setLeftPanelOpen(false)}
                  className="text-storm-muted hover:text-white text-xs p-1"
                >
                  ✕
                </button>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto">

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
                          onClick={() => {
                            setSelectedCell(cell);
                            setMapCenter({ lat: cell.lat, lng: cell.lng });
                            setMapZoom(10);
                          }}
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
                              <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-bold">
                                SEVERE
                              </span>
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

                {/* Active Alerts */}
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
                            <div
                              className="w-2 h-2 rounded-full flex-none"
                              style={{ backgroundColor: alert.color }}
                            />
                            <span className="text-xs text-white font-medium truncate">{alert.name}</span>
                            {alert.emergency && (
                              <span className="text-[10px] bg-red-500/30 text-red-400 px-1 py-0.5 rounded font-bold">
                                EMERGENCY
                              </span>
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

                {/* Recent Storm Reports */}
                {storms.length > 0 && (
                  <div className="p-3 border-b border-storm-border">
                    <h3 className="text-xs font-semibold text-storm-muted uppercase tracking-wider mb-2">
                      Storm Reports ({storms.length})
                    </h3>
                    <div className="space-y-1.5">
                      {storms.slice(0, 15).map((storm) => (
                        <button
                          key={storm.id}
                          onClick={() => {
                            setMapCenter({ lat: storm.lat, lng: storm.lng });
                            setMapZoom(11);
                          }}
                          className="w-full text-left p-2 rounded-lg bg-storm-z1 border border-storm-border hover:border-storm-purple/30 transition-colors"
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
                            }`}>
                              {storm.damageScore}
                            </span>
                          </div>
                          <div className="text-[10px] text-storm-muted mt-0.5">
                            {storm.hailSize ? `${storm.hailSize}" hail` : ""}
                            {storm.hailSize && storm.windSpeed ? " · " : ""}
                            {storm.windSpeed ? `${storm.windSpeed}mph wind` : ""}
                            {" · "}
                            {new Date(storm.startTime).toLocaleDateString()}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Selected Cell Detail */}
                {selectedCell && (
                  <div className="p-3 border-b border-storm-border">
                    <h3 className="text-xs font-semibold text-storm-muted uppercase tracking-wider mb-2">
                      Cell Detail
                    </h3>
                    <div className="bg-storm-z1 rounded-lg p-3 border border-storm-border">
                      <div className="text-sm text-white font-semibold mb-2">{selectedCell.location}</div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-storm-muted">Max Hail</span>
                          <div className="text-white font-medium">{selectedCell.maxHailSize}&quot;</div>
                        </div>
                        <div>
                          <span className="text-storm-muted">Hail Prob</span>
                          <div className="text-white font-medium">{selectedCell.hailProb}%</div>
                        </div>
                        <div>
                          <span className="text-storm-muted">Severe Hail</span>
                          <div className="text-white font-medium">{selectedCell.hailProbSevere}%</div>
                        </div>
                        <div>
                          <span className="text-storm-muted">Tornado</span>
                          <div className="text-white font-medium">{selectedCell.tornadoProb}%</div>
                        </div>
                        <div>
                          <span className="text-storm-muted">Speed</span>
                          <div className="text-white font-medium">{selectedCell.speedMph} mph</div>
                        </div>
                        <div>
                          <span className="text-storm-muted">Direction</span>
                          <div className="text-white font-medium">{selectedCell.direction}°</div>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          fetchParcels(selectedCell.lat, selectedCell.lng, 2);
                          setMapCenter({ lat: selectedCell.lat, lng: selectedCell.lng });
                          setMapZoom(13);
                          setRightPanelOpen(true);
                        }}
                        className="mt-3 w-full text-xs bg-storm-purple/20 text-storm-purple border border-storm-purple/30 rounded-lg py-1.5 hover:bg-storm-purple/30 transition-colors"
                      >
                        🔍 Scan Impact Zone
                      </button>
                    </div>
                  </div>
                )}

                {/* Empty state */}
                {stormCells.length === 0 && alerts.length === 0 && storms.length === 0 && (
                  <div className="p-6 text-center">
                    <div className="text-2xl mb-2">☀️</div>
                    <div className="text-sm text-storm-muted">No active weather events</div>
                    <div className="text-xs text-storm-muted/60 mt-1">Auto-refreshes every 60 seconds</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ─── RIGHT PANEL: Property Intel + Route Builder ─── */}
        <div
          className={`absolute right-0 top-0 bottom-0 z-20 transition-all duration-300 ${
            rightPanelOpen ? "w-80" : "w-0"
          }`}
        >
          {rightPanelOpen && (
            <div className="w-80 h-full bg-storm-z0/95 backdrop-blur-xl border-l border-storm-border flex flex-col">
              {/* Panel header */}
              <div className="flex-none p-3 border-b border-storm-border flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  🏠 Intel & Routes
                </h2>
                <button
                  onClick={() => setRightPanelOpen(false)}
                  className="text-storm-muted hover:text-white text-xs p-1"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {/* Property Intel */}
                {propertyLoading && (
                  <div className="p-6 flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-storm-purple border-t-transparent rounded-full animate-spin" />
                  </div>
                )}

                {propertyIntel && !propertyLoading && (
                  <div className="p-3 border-b border-storm-border">
                    <h3 className="text-xs font-semibold text-storm-muted uppercase tracking-wider mb-2">
                      Property Intelligence
                    </h3>
                    <div className="bg-storm-z1 rounded-lg p-3 border border-storm-border space-y-3">
                      {(() => {
                        // Safely extract values from potentially nested API response
                        const ownerName = typeof propertyIntel.owner === 'string'
                          ? propertyIntel.owner
                          : propertyIntel.owner?.name || [propertyIntel.owner?.firstName, propertyIntel.owner?.lastName].filter(Boolean).join(' ') || null;
                        const yearBuilt = propertyIntel.yearBuilt || propertyIntel.property?.yearBuilt;
                        const sqFt = propertyIntel.squareFeet || propertyIntel.property?.squareFootage;
                        const roofAge = propertyIntel.roofAge ?? propertyIntel.roof?.age;
                        const roofSqFt = propertyIntel.roofSquares || (propertyIntel.roof?.squareFootage ? Math.round(propertyIntel.roof.squareFootage / 100) : null);

                        return (
                          <>
                            <div>
                              <div className="text-sm text-white font-semibold">{propertyIntel.address}</div>
                              {ownerName && (
                                <div className="text-xs text-storm-muted mt-0.5">Owner: {ownerName}</div>
                              )}
                              {typeof propertyIntel.owner === 'object' && propertyIntel.owner?.absenteeOwner && (
                                <div className="text-[10px] text-orange-400 mt-0.5">⚡ Absentee Owner</div>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs">
                              {yearBuilt ? (
                                <div>
                                  <span className="text-storm-muted">Year Built</span>
                                  <div className="text-white">{yearBuilt}</div>
                                </div>
                              ) : null}
                              {sqFt ? (
                                <div>
                                  <span className="text-storm-muted">Sq Ft</span>
                                  <div className="text-white">{sqFt.toLocaleString()}</div>
                                </div>
                              ) : null}
                              {roofAge != null ? (
                                <div>
                                  <span className="text-storm-muted">Roof Age</span>
                                  <div className={`font-medium ${
                                    roofAge >= 15 ? "text-red-400" :
                                    roofAge >= 10 ? "text-yellow-400" : "text-emerald-400"
                                  }`}>
                                    {roofAge} years
                                  </div>
                                </div>
                              ) : null}
                              {roofSqFt ? (
                                <div>
                                  <span className="text-storm-muted">Roof Squares</span>
                                  <div className="text-white">{roofSqFt}</div>
                                </div>
                              ) : null}
                            </div>
                          </>
                        );
                      })()}

                      {propertyIntel.claimEstimate && (
                        <div className="bg-storm-purple/10 rounded-lg p-2 border border-storm-purple/20">
                          <div className="text-[10px] text-storm-muted uppercase tracking-wider mb-1">Claim Estimate</div>
                          <div className="text-lg text-storm-purple font-bold">
                            ${(propertyIntel.claimEstimate.total || 0).toLocaleString()}
                          </div>
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
                        onClick={() => {
                          setRouteStops((prev) => [
                            ...prev,
                            {
                              id: `intel-${Date.now()}`,
                              address: propertyIntel.address,
                              lat: propertyIntel.lat,
                              lng: propertyIntel.lng,
                              source: "manual" as const,
                            },
                          ]);
                        }}
                        className="w-full text-xs bg-storm-z2 text-white border border-storm-border rounded-lg py-1.5 hover:border-storm-purple/30 transition-colors"
                      >
                        + Add to Route
                      </button>
                    </div>
                  </div>
                )}

                {/* Parcel loading state */}
                {parcelLoading && (
                  <div className="p-6 flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-storm-purple border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs text-storm-muted">Scanning parcels…</span>
                  </div>
                )}

                {/* Parcels list */}
                {parcels.length > 0 && !parcelLoading && (
                  <div className="p-3 border-b border-storm-border">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-semibold text-storm-muted uppercase tracking-wider">
                        Parcels ({parcels.length})
                      </h3>
                      <button
                        onClick={() => {
                          // Add all residential parcels to route
                          const residential = parcels.filter(
                            (p) => p.typeCode === "SFR" || p.typeCode === "MFR" || p.typeCode === "CON" || p.typeCode === "TH" || p.typeCode === "MOB"
                          );
                          residential.slice(0, 20).forEach(addParcelToRoute);
                        }}
                        className="text-[10px] text-storm-purple hover:text-storm-purple/80 transition-colors"
                      >
                        + Add all residential
                      </button>
                    </div>
                    <div className="space-y-1.5 max-h-64 overflow-y-auto">
                      {parcels.slice(0, 50).map((parcel) => (
                        <div
                          key={parcel.id}
                          className="p-2 rounded-lg bg-storm-z1 border border-storm-border hover:border-storm-purple/30 transition-colors group"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <button
                                onClick={() => {
                                  fetchPropertyIntel(
                                    `${parcel.address}, ${parcel.city}, ${parcel.state} ${parcel.zip}`
                                  );
                                  setMapCenter({ lat: parcel.lat, lng: parcel.lng });
                                  setMapZoom(18);
                                }}
                                className="text-xs text-white hover:text-storm-purple transition-colors text-left truncate block w-full"
                              >
                                {parcel.address}
                              </button>
                              <div className="text-[10px] text-storm-muted truncate">{parcel.owner}</div>
                              <div className="text-[10px] text-storm-muted/60">{parcel.propertyType}</div>
                            </div>
                            <button
                              onClick={() => addParcelToRoute(parcel)}
                              className="text-[10px] text-storm-muted hover:text-storm-purple opacity-0 group-hover:opacity-100 transition-all flex-none mt-0.5"
                              title="Add to route"
                            >
                              + Route
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Route Builder */}
                <div className="p-3">
                  <h3 className="text-xs font-semibold text-storm-muted uppercase tracking-wider mb-2">
                    Route Builder ({routeStops.length} stops)
                  </h3>

                  {routeStops.length === 0 ? (
                    <div className="text-xs text-storm-muted/60 text-center py-4">
                      Click parcels or use quick actions to add stops
                    </div>
                  ) : (
                    <div className="space-y-1.5 mb-3">
                      {routeStops.map((stop, i) => (
                        <div key={stop.id} className="flex items-center gap-2 p-1.5 rounded-lg bg-storm-z1 border border-storm-border">
                          <span className="w-5 h-5 rounded-full bg-storm-purple/20 text-storm-purple flex items-center justify-center text-[10px] font-bold flex-none">
                            {i + 1}
                          </span>
                          <span className="text-xs text-white truncate flex-1">{stop.address}</span>
                          <button
                            onClick={() => removeRouteStop(stop.id)}
                            className="text-storm-muted hover:text-red-400 text-[10px] flex-none"
                          >
                            ✕
                          </button>
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
                      >
                        {routeLoading ? "Optimizing…" : "🛣️ Optimize Route"}
                      </button>

                      {routeResult && (
                        <div className="bg-storm-z1 rounded-lg p-2 border border-storm-border">
                          <div className="flex justify-between text-xs text-white mb-1">
                            <span>{routeResult.totalDistance}</span>
                            <span>{routeResult.totalDuration}</span>
                          </div>
                          <div className="space-y-0.5">
                            {routeResult.legs.map((leg, i) => (
                              <div key={i} className="text-[10px] text-storm-muted">
                                {leg.distance} · {leg.duration}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <button
                        onClick={exportRouteToGoogleMaps}
                        className="w-full text-xs bg-storm-z2 text-white border border-storm-border rounded-lg py-1.5 hover:border-storm-purple/30 transition-colors"
                      >
                        📱 Export to Google Maps
                      </button>

                      <button
                        onClick={() => {
                          setRouteStops([]);
                          setRouteResult(null);
                        }}
                        className="w-full text-xs text-storm-muted hover:text-red-400 py-1 transition-colors"
                      >
                        Clear Route
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ─── MAP (Full Bleed) ─── */}
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

          {/* ─── Search Bar (floating on map) ─── */}
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
              <button
                onClick={handleAddressSearch}
                className="px-3 py-2.5 text-storm-purple hover:bg-storm-purple/10 transition-colors"
              >
                🔍
              </button>
            </div>
          </div>

          {/* ─── Panel Toggle Buttons ─── */}
          {!leftPanelOpen && (
            <button
              onClick={() => setLeftPanelOpen(true)}
              className="absolute top-3 left-3 z-10 bg-storm-z0/90 backdrop-blur-xl border border-storm-border rounded-lg px-3 py-2 text-xs text-white hover:border-storm-purple/30 transition-colors shadow-lg"
            >
              🌩️ Intel {stormCells.length + alerts.length > 0 && (
                <span className="ml-1 bg-red-500/30 text-red-400 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
                  {stormCells.length + alerts.length}
                </span>
              )}
            </button>
          )}
          {!rightPanelOpen && (
            <button
              onClick={() => setRightPanelOpen(true)}
              className="absolute top-3 right-3 z-10 bg-storm-z0/90 backdrop-blur-xl border border-storm-border rounded-lg px-3 py-2 text-xs text-white hover:border-storm-purple/30 transition-colors shadow-lg"
            >
              🏠 Intel & Routes {routeStops.length > 0 && (
                <span className="ml-1 bg-storm-purple/30 text-storm-purple px-1.5 py-0.5 rounded-full text-[10px] font-bold">
                  {routeStops.length}
                </span>
              )}
            </button>
          )}

          {/* ─── Quick Actions Floating Bar ─── */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-storm-z0/90 backdrop-blur-xl rounded-xl border border-storm-border shadow-2xl p-1.5">
            <QuickActionButton
              icon="📡"
              label="Radar"
              active={showRadar}
              onClick={() => setShowRadar(!showRadar)}
            />
            <div className="w-px h-6 bg-storm-border" />
            <QuickActionButton
              icon="🔍"
              label="Scan Zone"
              active={activeQuickAction === "scan"}
              onClick={() => {
                setActiveQuickAction(activeQuickAction === "scan" ? null : "scan");
              }}
            />
            <QuickActionButton
              icon="🏠"
              label="Property Intel"
              active={activeQuickAction === "intel"}
              onClick={() => {
                setActiveQuickAction(activeQuickAction === "intel" ? null : "intel");
              }}
            />
            <QuickActionButton
              icon="📌"
              label="Add Stop"
              active={activeQuickAction === "route-add"}
              onClick={() => {
                setActiveQuickAction(activeQuickAction === "route-add" ? null : "route-add");
                setRightPanelOpen(true);
              }}
            />
            <div className="w-px h-6 bg-storm-border" />
            <QuickActionButton
              icon="🔄"
              label="Refresh"
              onClick={() => fetchStormData(mapCenter.lat, mapCenter.lng)}
            />
            <QuickActionButton
              icon="📍"
              label="My Location"
              onClick={() => {
                getLocation();
                if (latitude && longitude) {
                  setMapCenter({ lat: latitude, lng: longitude });
                  setMapZoom(10);
                }
              }}
            />
          </div>

          {/* Active action indicator */}
          {activeQuickAction && (
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-10 bg-storm-purple/90 text-white text-xs px-4 py-2 rounded-lg shadow-lg animate-pulse">
              {activeQuickAction === "scan" && "Click map to scan parcels in that area"}
              {activeQuickAction === "intel" && "Click map to get property intel"}
              {activeQuickAction === "route-add" && "Click map to add route stop"}
              <button
                onClick={() => setActiveQuickAction(null)}
                className="ml-2 opacity-70 hover:opacity-100"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ─── BOTTOM DOCK: Forecast + Advisory ─── */}
      <div className={`flex-none border-t border-storm-border transition-all duration-300 ${bottomDockOpen ? "h-24" : "h-8"}`}>
        {/* Dock toggle */}
        <button
          onClick={() => setBottomDockOpen(!bottomDockOpen)}
          className="w-full h-8 flex items-center justify-center gap-2 bg-storm-z0 hover:bg-storm-z1 transition-colors text-xs text-storm-muted"
        >
          <span>{bottomDockOpen ? "▼" : "▲"}</span>
          <span>7-Day Forecast</span>
          {forecast.some((d) => d.severeRisk !== "none") && (
            <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
          )}
        </button>

        {/* Forecast strip */}
        {bottomDockOpen && (
          <div className="h-16 bg-storm-z0 flex items-center px-4 gap-2 overflow-x-auto">
            {forecast.length === 0 ? (
              <div className="text-xs text-storm-muted/60">Loading forecast…</div>
            ) : (
              forecast.map((day, i) => {
                const riskColors = {
                  none: "border-storm-border",
                  low: "border-blue-500/40",
                  moderate: "border-yellow-500/40",
                  high: "border-orange-500/40",
                  extreme: "border-red-500/40",
                };
                return (
                  <div
                    key={i}
                    className={`flex-none w-28 p-2 rounded-lg bg-storm-z1 border ${riskColors[day.severeRisk]} text-center`}
                  >
                    <div className="text-[10px] text-storm-muted font-medium">{day.dayOfWeek}</div>
                    <div className="flex items-center justify-center gap-1 text-xs">
                      <span className="text-white font-medium">{day.highF}°</span>
                      <span className="text-storm-muted">{day.lowF}°</span>
                    </div>
                    <div className="flex items-center justify-center gap-1 text-[10px] mt-0.5">
                      {day.hailRisk && <span title="Hail risk">🧊</span>}
                      {day.tornadoRisk && <span title="Tornado risk">🌪️</span>}
                      {day.windRisk && <span title="Wind risk">💨</span>}
                      {day.severeRisk === "none" && day.precipChance < 30 && (
                        <span className="text-emerald-400">✓ Canvas</span>
                      )}
                      {day.severeRisk !== "none" && (
                        <span className={`font-bold ${
                          day.severeRisk === "extreme" ? "text-red-400" :
                          day.severeRisk === "high" ? "text-orange-400" :
                          day.severeRisk === "moderate" ? "text-yellow-400" : "text-blue-400"
                        }`}>
                          {day.severeRisk.toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {/* Parcel scan radius control */}
            <div className="flex-none ml-auto pl-4 flex items-center gap-2 border-l border-storm-border">
              <span className="text-[10px] text-storm-muted whitespace-nowrap">Scan radius:</span>
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

function QuickActionButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: string;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
        active
          ? "bg-storm-purple/20 text-storm-purple border border-storm-purple/30"
          : "text-white hover:bg-white/10 border border-transparent"
      }`}
      title={label}
    >
      <span>{icon}</span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
