"use client";

import { useState, useEffect, useCallback } from "react";
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
  
  // Geolocation hook - auto-fetch on mount
  const { 
    latitude, 
    longitude, 
    loading: geoLoading, 
    error: geoError,
    getLocation,
    hasLocation 
  } = useGeolocation({ autoFetch: true });

  // Map center based on geolocation or default to center of US
  const mapCenter = hasLocation 
    ? { lat: latitude!, lng: longitude! }
    : { lat: 39.8283, lng: -98.5795 };

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

  // Fetch data on mount and when location/settings change
  useEffect(() => {
    if (!geoLoading) {
      fetchStormData();
    }
  }, [fetchStormData, geoLoading]);

  // Auto-refresh every 30 seconds if live
  useEffect(() => {
    if (isLive && !geoLoading) {
      const interval = setInterval(fetchStormData, 30000);
      return () => clearInterval(interval);
    }
  }, [isLive, fetchStormData, geoLoading]);

  // Convert storms to map markers
  const stormMarkers: MapMarker[] = storms
    .filter(storm => {
      if (activeLayer === "all") return true;
      if (activeLayer === "hail") return storm.type === "hail" || storm.hailSize;
      if (activeLayer === "wind") return storm.type === "wind" || storm.windSpeed;
      return true;
    })
    .map(storm => ({
      id: storm.id,
      lat: storm.lat,
      lng: storm.lng,
      type: storm.type,
      severity: storm.severity,
      popup: `
        <strong>${storm.type.replace("_", " ").toUpperCase()}</strong><br/>
        ${storm.hailSize ? `🧊 ${storm.hailSize}" hail<br/>` : ""}
        ${storm.windSpeed ? `💨 ${storm.windSpeed} mph<br/>` : ""}
        ${storm.location || ""}<br/>
        <small>Damage Score: ${storm.damageScore}/100</small>
      `,
    }));

  // Add property markers
  const propertyMarkers: MapMarker[] = (activeLayer === "damage" || activeLayer === "all")
    ? impactedProperties.slice(0, 30).map((prop, i) => ({
        id: `prop-${i}`,
        lat: prop.lat,
        lng: prop.lng,
        type: "property" as const,
        color: prop.damageProb >= 80 ? "#dc2626" : prop.damageProb >= 60 ? "#f97316" : "#eab308",
        size: 16,
        popup: `
          <strong>${prop.address}</strong><br/>
          Damage Probability: ${prop.damageProb}%<br/>
          🧊 Hail: ${prop.hailExposure}% | 💨 Wind: ${prop.windExposure}%<br/>
          ${prop.roofAge ? `Roof Age: ${prop.roofAge} years` : ""}
        `,
      }))
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
            zoom={hasLocation ? 8 : 5}
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
                            {storm.location || formatTime(storm.startTime)}
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
                {selectedStorm.location && (
                  <div className="text-sm text-zinc-400">
                    📍 {selectedStorm.location}
                    {selectedStorm.county && `, ${selectedStorm.county} County`}
                  </div>
                )}
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
                <div className="pt-3 border-t border-zinc-700">
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
                    <div className="text-sm font-medium truncate pr-2">{prop.address}</div>
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
