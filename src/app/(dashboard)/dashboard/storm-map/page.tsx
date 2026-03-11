"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface StormEvent {
  id: string;
  type: "hail" | "wind" | "tornado" | "severe_thunderstorm";
  severity: "minor" | "moderate" | "severe" | "extreme";
  hailSize?: number; // inches
  windSpeed?: number; // mph
  lat: number;
  lng: number;
  radius: number; // miles
  startTime: string;
  endTime?: string;
  path?: { lat: number; lng: number }[];
  damageScore: number; // 0-100
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

interface WeatherRadar {
  timestamp: string;
  precipitation: { lat: number; lng: number; intensity: number }[];
}

export default function StormMapPage() {
  const [activeLayer, setActiveLayer] = useState<"hail" | "wind" | "damage" | "radar" | "all">("all");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [isLive, setIsLive] = useState(true);
  const [storms, setStorms] = useState<StormEvent[]>([]);
  const [impactedProperties, setImpactedProperties] = useState<PropertyImpact[]>([]);
  const [selectedStorm, setSelectedStorm] = useState<StormEvent | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mapCenter, setMapCenter] = useState({ lat: 39.8283, lng: -98.5795 }); // Center of US
  const [zoom, setZoom] = useState(5);
  const mapRef = useRef<HTMLDivElement>(null);

  // Fetch storm data
  const fetchStormData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/storms?date=${selectedDate}&live=${isLive}`);
      if (response.ok) {
        const data = await response.json();
        setStorms(data.storms || []);
        setImpactedProperties(data.impactedProperties || []);
      } else {
        // Demo data
        setStorms([
          {
            id: "storm-1",
            type: "hail",
            severity: "severe",
            hailSize: 2.5,
            windSpeed: 65,
            lat: 35.2271,
            lng: -101.8313,
            radius: 15,
            startTime: new Date(Date.now() - 3600000).toISOString(),
            damageScore: 85,
            path: [
              { lat: 35.1, lng: -102.0 },
              { lat: 35.2, lng: -101.9 },
              { lat: 35.3, lng: -101.8 },
            ],
          },
          {
            id: "storm-2",
            type: "severe_thunderstorm",
            severity: "moderate",
            hailSize: 1.0,
            windSpeed: 55,
            lat: 32.7767,
            lng: -96.797,
            radius: 20,
            startTime: new Date(Date.now() - 7200000).toISOString(),
            damageScore: 62,
          },
          {
            id: "storm-3",
            type: "tornado",
            severity: "extreme",
            windSpeed: 150,
            lat: 35.4676,
            lng: -97.5164,
            radius: 5,
            startTime: new Date(Date.now() - 1800000).toISOString(),
            damageScore: 98,
            path: [
              { lat: 35.4, lng: -97.6 },
              { lat: 35.45, lng: -97.55 },
              { lat: 35.5, lng: -97.5 },
            ],
          },
        ]);
        setImpactedProperties([
          { address: "123 Oak St, Amarillo TX", lat: 35.22, lng: -101.83, damageProb: 92, hailExposure: 95, windExposure: 78, roofAge: 15, stormScore: 89 },
          { address: "456 Elm Dr, Amarillo TX", lat: 35.23, lng: -101.82, damageProb: 88, hailExposure: 90, windExposure: 72, roofAge: 22, stormScore: 85 },
          { address: "789 Pine Ave, Dallas TX", lat: 32.78, lng: -96.80, damageProb: 65, hailExposure: 58, windExposure: 68, roofAge: 8, stormScore: 58 },
        ]);
      }
    } catch (error) {
      console.error("Error fetching storm data:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, isLive]);

  useEffect(() => {
    fetchStormData();
    // Auto-refresh every 30 seconds if live
    if (isLive) {
      const interval = setInterval(fetchStormData, 30000);
      return () => clearInterval(interval);
    }
  }, [fetchStormData, isLive]);

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
    return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold">Storm Intelligence Map</h1>
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
          </div>
        </div>

        <div className="flex items-center gap-3">
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
            className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Map */}
        <div className="flex-1 relative bg-zinc-950">
          {/* Layer Controls */}
          <div className="absolute top-4 left-4 z-10 bg-zinc-900/95 rounded-xl border border-zinc-700 p-2 flex flex-col gap-1">
            {[
              { id: "all", label: "All Layers", icon: "🗺️" },
              { id: "hail", label: "Hail", icon: "🧊" },
              { id: "wind", label: "Wind", icon: "💨" },
              { id: "damage", label: "Damage Zones", icon: "🔥" },
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

          {/* Storm Legend */}
          <div className="absolute bottom-4 left-4 z-10 bg-zinc-900/95 rounded-xl border border-zinc-700 p-4">
            <h4 className="text-sm font-semibold mb-3">Storm Severity</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-600" />
                <span className="text-zinc-400">Extreme (90-100)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-orange-500" />
                <span className="text-zinc-400">Severe (70-89)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-yellow-500" />
                <span className="text-zinc-400">Moderate (50-69)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-zinc-400">Minor (0-49)</span>
              </div>
            </div>
          </div>

          {/* Map Visualization */}
          <div ref={mapRef} className="w-full h-full flex items-center justify-center relative overflow-hidden">
            {/* Animated Background Grid */}
            <div className="absolute inset-0 opacity-10">
              <div className="w-full h-full" style={{
                backgroundImage: "linear-gradient(rgba(59, 130, 246, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(59, 130, 246, 0.3) 1px, transparent 1px)",
                backgroundSize: "50px 50px"
              }} />
            </div>

            {/* Storm Cells Visualization */}
            {storms.map((storm) => (
              <div
                key={storm.id}
                className={`absolute cursor-pointer transition-all duration-300 ${selectedStorm?.id === storm.id ? "z-20" : "z-10"}`}
                style={{
                  left: `${50 + (storm.lng + 98) * 3}%`,
                  top: `${50 - (storm.lat - 35) * 5}%`,
                }}
                onClick={() => setSelectedStorm(storm)}
              >
                {/* Outer pulse ring */}
                <div
                  className={`absolute rounded-full animate-ping ${getSeverityColor(storm.severity)} opacity-50`}
                  style={{
                    width: storm.radius * 6,
                    height: storm.radius * 6,
                    left: -storm.radius * 3,
                    top: -storm.radius * 3,
                  }}
                />
                {/* Storm cell */}
                <div
                  className={`relative rounded-full ${getSeverityColor(storm.severity)} flex items-center justify-center shadow-lg`}
                  style={{
                    width: storm.radius * 4,
                    height: storm.radius * 4,
                    marginLeft: -storm.radius * 2,
                    marginTop: -storm.radius * 2,
                  }}
                >
                  <span className="text-2xl">{getTypeIcon(storm.type)}</span>
                </div>
                {/* Label */}
                <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 whitespace-nowrap bg-zinc-900 px-2 py-1 rounded text-xs">
                  {storm.hailSize && `${storm.hailSize}" hail`}
                  {storm.windSpeed && ` • ${storm.windSpeed} mph`}
                </div>
              </div>
            ))}

            {/* Property Impact Markers */}
            {activeLayer === "damage" || activeLayer === "all" ? (
              impactedProperties.slice(0, 20).map((prop, i) => (
                <div
                  key={i}
                  className="absolute w-3 h-3 rounded-full bg-red-500/80 border border-red-400 cursor-pointer hover:scale-150 transition-transform"
                  style={{
                    left: `${50 + (prop.lng + 98) * 3}%`,
                    top: `${50 - (prop.lat - 35) * 5}%`,
                  }}
                  title={`${prop.address}\nDamage: ${prop.damageProb}%`}
                />
              ))
            ) : null}

            {loading && (
              <div className="absolute inset-0 bg-zinc-950/80 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm text-zinc-400">Loading storm data...</span>
                </div>
              </div>
            )}
          </div>

          {/* Playback Controls for Historical */}
          {!isLive && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-zinc-900/95 rounded-xl border border-zinc-700 p-3 flex items-center gap-4">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="p-2 rounded-lg bg-blue-600 hover:bg-blue-500 transition-colors"
              >
                {isPlaying ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>
              <div className="w-64 h-2 bg-zinc-700 rounded-full">
                <div className="h-full w-1/3 bg-blue-500 rounded-full" />
              </div>
              <span className="text-sm text-zinc-400">12:00 PM - 6:00 PM</span>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-96 border-l border-zinc-800 bg-zinc-900/50 overflow-y-auto">
          {/* Storm Stats */}
          <div className="p-4 border-b border-zinc-800">
            <h3 className="font-semibold mb-3">Active Storm Events</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-zinc-800 rounded-lg p-3">
                <div className="text-2xl font-bold text-red-500">{storms.filter(s => s.severity === "extreme" || s.severity === "severe").length}</div>
                <div className="text-xs text-zinc-500">Severe Storms</div>
              </div>
              <div className="bg-zinc-800 rounded-lg p-3">
                <div className="text-2xl font-bold text-orange-500">{impactedProperties.length}</div>
                <div className="text-xs text-zinc-500">Properties at Risk</div>
              </div>
              <div className="bg-zinc-800 rounded-lg p-3">
                <div className="text-2xl font-bold text-yellow-500">
                  {storms.reduce((max, s) => Math.max(max, s.hailSize || 0), 0)}"
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
            <h3 className="font-semibold mb-3">Storm Timeline</h3>
            <div className="space-y-3">
              {storms.map((storm) => (
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
                        <div className="font-medium capitalize">{storm.type.replace("_", " ")}</div>
                        <div className="text-xs text-zinc-500">Started {formatTime(storm.startTime)}</div>
                      </div>
                    </div>
                    <div className={`px-2 py-1 rounded text-xs font-medium ${getSeverityColor(storm.severity)} text-white`}>
                      {storm.damageScore}
                    </div>
                  </div>
                  <div className="mt-2 flex gap-3 text-xs text-zinc-400">
                    {storm.hailSize && <span>🧊 {storm.hailSize}" hail</span>}
                    {storm.windSpeed && <span>💨 {storm.windSpeed} mph</span>}
                    <span>📍 {storm.radius} mi radius</span>
                  </div>
                </button>
              ))}
            </div>
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
                <div className="pt-3 border-t border-zinc-700">
                  <button className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg font-medium transition-colors">
                    Generate Knock List for This Storm
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Impacted Properties */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">High-Impact Properties</h3>
              <span className="text-xs text-zinc-500">{impactedProperties.length} total</span>
            </div>
            <div className="space-y-2">
              {impactedProperties.slice(0, 10).map((prop, i) => (
                <div
                  key={i}
                  className="p-3 bg-zinc-800 rounded-lg hover:bg-zinc-750 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">{prop.address}</div>
                    <div className={`text-sm font-bold ${
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
                    {prop.roofAge && <span>🏠 {prop.roofAge}yr roof</span>}
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
