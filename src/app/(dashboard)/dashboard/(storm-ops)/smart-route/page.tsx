"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";

interface RouteStop {
  id: string;
  address: string;
  lat: number;
  lng: number;
  damageScore?: number;
  estimatedJobValue?: number;
  stopNumber: number;
  status: "pending" | "visited" | "skipped";
  notes?: string;
}

interface RouteData {
  id: string;
  name: string;
  stops: RouteStop[];
  totalDistance: number; // miles
  totalDuration: number; // minutes
  mode: "driving" | "walking";
  createdAt: string;
}

interface WeatherCondition {
  temp: number;
  conditions: string;
  windSpeed: number;
  icon: string;
  canKnock: boolean;
}

export default function SmartRoutePlannerPage() {
  const searchParams = useSearchParams();
  const [stops, setStops] = useState<RouteStop[]>([]);
  const [route, setRoute] = useState<RouteData | null>(null);
  const [loading, setLoading] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [mode, setMode] = useState<"driving" | "walking">("driving");
  const [activeTab, setActiveTab] = useState<"build" | "route" | "navigate">("build");
  const [weather, setWeather] = useState<WeatherCondition | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [addressInput, setAddressInput] = useState("");
  const draggedItem = useRef<number | null>(null);

  // Pre-fill address from query (e.g. from Neighborhood Engine "Push to Storm Ops")
  useEffect(() => {
    const addr = searchParams.get("address");
    if (addr && typeof addr === "string") {
      setAddressInput(decodeURIComponent(addr));
    }
  }, [searchParams]);

  // Fetch weather
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const res = await fetch("/api/weather");
        if (res.ok) {
          const data = await res.json();
          setWeather({
            temp: data.weather?.temperature || 72,
            conditions: data.weather?.conditions || "Clear",
            windSpeed: data.weather?.wind_speed || 8,
            icon: data.weather?.conditions_icon || "☀️",
            canKnock: data.routing_recommendations?.can_canvas ?? true,
          });
        }
      } catch (error) {
        console.error("Error fetching weather:", error);
      }
    };
    fetchWeather();
  }, []);

  // Get current location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setCurrentLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      });
    }
  }, []);

  // Load from knock list
  const loadFromKnockList = useCallback(async () => {
    setLoading(true);
    try {
      const lat = currentLocation?.lat ?? 32.7767;
      const lng = currentLocation?.lng ?? -96.7970;
      const res = await fetch(`/api/knock-list/properties?lat=${lat}&lng=${lng}&radius=10`);
      if (res.ok) {
        const data = await res.json();
        const newStops: RouteStop[] = (data.properties || []).slice(0, 15).map((p: any, i: number) => ({
          id: p.id,
          address: p.address,
          lat: p.lat,
          lng: p.lng,
          damageScore: p.damageScore,
          estimatedJobValue: p.estimatedJobValue,
          stopNumber: i + 1,
          status: "pending" as const,
        }));
        setStops(newStops);
      }
    } catch (error) {
      console.error("Error loading knock list:", error);
    } finally {
      setLoading(false);
    }
  }, [currentLocation]);

  // Add address to route
  const addAddress = async () => {
    if (!addressInput.trim()) return;
    
    try {
      // Geocode the address using Mapbox
      const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      let lat = currentLocation?.lat ?? 32.7767;
      let lng = currentLocation?.lng ?? -96.7970;

      if (mapboxToken) {
        const geocodeRes = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(addressInput)}.json?access_token=${mapboxToken}&country=us&types=address&limit=1`
        );
        const geocodeData = await geocodeRes.json();
        if (geocodeData.features && geocodeData.features.length > 0) {
          [lng, lat] = geocodeData.features[0].center;
        }
      }

      const newStop: RouteStop = {
        id: `stop-${Date.now()}`,
        address: addressInput,
        lat,
        lng,
        stopNumber: stops.length + 1,
        status: "pending",
      };
      setStops([...stops, newStop]);
      setAddressInput("");
    } catch (error) {
      console.error("Error geocoding address:", error);
      // Still add the stop with approximate coords if geocoding fails
      const newStop: RouteStop = {
        id: `stop-${Date.now()}`,
        address: addressInput,
        lat: currentLocation?.lat ?? 32.7767,
        lng: currentLocation?.lng ?? -96.7970,
        stopNumber: stops.length + 1,
        status: "pending",
      };
      setStops([...stops, newStop]);
      setAddressInput("");
    }
  };

  // Optimize route
  const optimizeRoute = async () => {
    if (stops.length < 2) return;
    
    setOptimizing(true);
    try {
      // Build waypoints from stop addresses
      const waypoints = stops.map(s => s.address);
      const startingPoint = currentLocation
        ? `${currentLocation.lat},${currentLocation.lng}`
        : undefined;

      const res = await fetch("/api/route-optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startingPoint,
          waypoints,
          optimizeWaypoints: true,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        
        // Parse distance and duration from API response
        const parsedDistance = parseFloat(data.routeInfo?.totalDistance) || stops.length * 0.5;
        const parsedDuration = parseInt(data.routeInfo?.totalDuration) || stops.length * 5;

        // Reorder stops based on optimized waypoint order
        if (data.waypointOrder && data.waypointOrder.length > 0) {
          const reordered = data.waypointOrder.map((originalIndex: number, newIndex: number) => ({
            ...stops[originalIndex],
            stopNumber: newIndex + 1,
          }));
          setStops(reordered);
          
          setRoute({
            id: `route-${Date.now()}`,
            name: `Route ${new Date().toLocaleDateString()}`,
            stops: reordered,
            totalDistance: parsedDistance,
            totalDuration: parsedDuration,
            mode,
            createdAt: new Date().toISOString(),
          });
        } else {
          // API returned results but no reordering needed
          setRoute({
            id: `route-${Date.now()}`,
            name: `Route ${new Date().toLocaleDateString()}`,
            stops,
            totalDistance: parsedDistance,
            totalDuration: parsedDuration,
            mode,
            createdAt: new Date().toISOString(),
          });
        }
      } else {
        // Fallback to client-side nearest-neighbor if API fails
        console.warn("Route optimize API failed, using client-side sort");
        const optimized = [...stops];
        if (currentLocation) {
          optimized.sort((a, b) => {
            const distA = Math.sqrt(Math.pow(a.lat - currentLocation.lat, 2) + Math.pow(a.lng - currentLocation.lng, 2));
            const distB = Math.sqrt(Math.pow(b.lat - currentLocation.lat, 2) + Math.pow(b.lng - currentLocation.lng, 2));
            return distA - distB;
          });
        }
        optimized.forEach((stop, i) => { stop.stopNumber = i + 1; });
        setStops(optimized);

        const totalDistance = stops.length * 0.3 + Math.random() * 2;
        const totalDuration = mode === "driving" 
          ? stops.length * 3 + Math.random() * 10 
          : stops.length * 8 + Math.random() * 20;

        setRoute({
          id: `route-${Date.now()}`,
          name: `Route ${new Date().toLocaleDateString()}`,
          stops: optimized,
          totalDistance: Math.round(totalDistance * 10) / 10,
          totalDuration: Math.round(totalDuration),
          mode,
          createdAt: new Date().toISOString(),
        });
      }
      
      setActiveTab("route");
    } catch (error) {
      console.error("Error optimizing route:", error);
    } finally {
      setOptimizing(false);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (index: number) => {
    draggedItem.current = index;
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedItem.current === null || draggedItem.current === index) return;
    
    const newStops = [...stops];
    const item = newStops[draggedItem.current];
    newStops.splice(draggedItem.current, 1);
    newStops.splice(index, 0, item);
    
    // Renumber
    newStops.forEach((stop, i) => {
      stop.stopNumber = i + 1;
    });
    
    setStops(newStops);
    draggedItem.current = index;
  };

  const handleDragEnd = () => {
    draggedItem.current = null;
  };

  // Remove stop
  const removeStop = (id: string) => {
    const newStops = stops.filter(s => s.id !== id);
    newStops.forEach((stop, i) => {
      stop.stopNumber = i + 1;
    });
    setStops(newStops);
  };

  // Mark stop as visited
  const markVisited = (id: string, status: RouteStop["status"]) => {
    setStops(stops.map(s => s.id === id ? { ...s, status } : s));
  };

  // Export route
  const exportRoute = (platform: "google" | "apple" | "print") => {
    if (platform === "print") {
      window.print();
      return;
    }
    
    const addresses = stops.map(s => encodeURIComponent(s.address)).join("/");
    const origin = currentLocation 
      ? `${currentLocation.lat},${currentLocation.lng}`
      : encodeURIComponent(stops[0]?.address || "");
    
    if (platform === "google") {
      const url = `https://www.google.com/maps/dir/${origin}/${addresses}`;
      window.open(url, "_blank");
    } else if (platform === "apple") {
      const url = `http://maps.apple.com/?daddr=${addresses}&dirflg=d`;
      window.open(url, "_blank");
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
  };

  const completedStops = stops.filter(s => s.status === "visited").length;
  const totalValue = stops.reduce((sum, s) => sum + (s.estimatedJobValue || 0), 0);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Smart Route Planner</h1>
          <p className="text-zinc-400 text-sm mt-1">Optimize your canvassing route for maximum efficiency</p>
        </div>
        
        {/* Weather Badge */}
        {weather && (
          <div className={`px-4 py-2 rounded-xl flex items-center gap-3 ${
            weather.canKnock ? "bg-green-500/20 border border-green-500/50" : "bg-orange-500/20 border border-orange-500/50"
          }`}>
            <span className="text-2xl">{weather.icon}</span>
            <div>
              <div className="font-medium">{weather.temp}°F • {weather.conditions}</div>
              <div className="text-xs text-zinc-400">
                {weather.canKnock ? "✓ Good conditions for knocking" : "⚠️ Consider weather delays"}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-zinc-800 p-1 rounded-lg w-fit">
        {[
          { id: "build", label: "Build Route", icon: "🔧" },
          { id: "route", label: "View Route", icon: "🗺️" },
          { id: "navigate", label: "Navigate", icon: "🧭" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === tab.id
                ? "bg-blue-600 text-white"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Build Tab */}
      {activeTab === "build" && (
        <div className="grid grid-cols-3 gap-6">
          {/* Add Stops */}
          <div className="bg-zinc-800 rounded-xl p-4">
            <h3 className="font-semibold mb-4">Add Stops</h3>
            
            {/* Quick Actions */}
            <div className="space-y-3 mb-4">
              <button
                onClick={loadFromKnockList}
                disabled={loading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>📋 Load from Knock List</>
                )}
              </button>
              <button
                className="w-full py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm transition-colors"
                onClick={() => {
                  if (currentLocation) {
                    setStops([{
                      id: "current",
                      address: "Current Location",
                      lat: currentLocation.lat,
                      lng: currentLocation.lng,
                      stopNumber: 1,
                      status: "pending",
                    }, ...stops.map((s, i) => ({ ...s, stopNumber: i + 2 }))]);
                  }
                }}
              >
                📍 Start from Current Location
              </button>
            </div>

            {/* Manual Add */}
            <div className="mb-4">
              <label className="text-sm text-zinc-400 block mb-2">Add Address</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={addressInput}
                  onChange={(e) => setAddressInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addAddress()}
                  placeholder="Enter address..."
                  className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm"
                />
                <button
                  onClick={addAddress}
                  className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg transition-colors"
                >
                  +
                </button>
              </div>
            </div>

            {/* Mode Selection */}
            <div className="mb-4">
              <label className="text-sm text-zinc-400 block mb-2">Travel Mode</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setMode("driving")}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                    mode === "driving" ? "bg-blue-600" : "bg-zinc-700 hover:bg-zinc-600"
                  }`}
                >
                  🚗 Driving
                </button>
                <button
                  onClick={() => setMode("walking")}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                    mode === "walking" ? "bg-blue-600" : "bg-zinc-700 hover:bg-zinc-600"
                  }`}
                >
                  🚶 Walking
                </button>
              </div>
            </div>

            {/* Optimize Button */}
            <button
              onClick={optimizeRoute}
              disabled={stops.length < 2 || optimizing}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:from-zinc-700 disabled:to-zinc-700 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {optimizing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Optimizing...
                </>
              ) : (
                <>✨ Optimize Route</>
              )}
            </button>
          </div>

          {/* Stops List */}
          <div className="col-span-2 bg-zinc-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Route Stops ({stops.length})</h3>
              {stops.length > 0 && (
                <button
                  onClick={() => setStops([])}
                  className="text-sm text-red-500 hover:text-red-400"
                >
                  Clear All
                </button>
              )}
            </div>

            {stops.length === 0 ? (
              <div className="text-center py-12 text-zinc-500">
                <div className="text-4xl mb-3">📍</div>
                <p>No stops added yet</p>
                <p className="text-sm mt-1">Load from knock list or add addresses manually</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {stops.map((stop, index) => (
                  <div
                    key={stop.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className="p-3 bg-zinc-900 rounded-lg border border-zinc-700 hover:border-zinc-600 cursor-move transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {/* Drag Handle & Number */}
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-zinc-500" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z"/>
                        </svg>
                        <span className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold">
                          {stop.stopNumber}
                        </span>
                      </div>

                      {/* Address */}
                      <div className="flex-1">
                        <div className="font-medium text-sm">{stop.address}</div>
                        {stop.damageScore && (
                          <div className="flex gap-3 mt-1 text-xs text-zinc-500">
                            <span>Score: {stop.damageScore}</span>
                            {stop.estimatedJobValue && (
                              <span className="text-green-500">{formatCurrency(stop.estimatedJobValue)}</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Remove */}
                      <button
                        onClick={() => removeStop(stop.id)}
                        className="p-1 text-zinc-500 hover:text-red-500 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Route Tab */}
      {activeTab === "route" && route && (
        <div className="grid grid-cols-3 gap-6">
          {/* Route Info */}
          <div className="bg-zinc-800 rounded-xl p-4">
            <h3 className="font-semibold mb-4">Route Summary</h3>
            
            <div className="space-y-4">
              <div className="bg-zinc-900 rounded-lg p-4">
                <div className="text-zinc-500 text-sm">Total Distance</div>
                <div className="text-2xl font-bold">{route.totalDistance} mi</div>
              </div>
              <div className="bg-zinc-900 rounded-lg p-4">
                <div className="text-zinc-500 text-sm">Estimated Time</div>
                <div className="text-2xl font-bold">{route.totalDuration} min</div>
              </div>
              <div className="bg-zinc-900 rounded-lg p-4">
                <div className="text-zinc-500 text-sm">Total Stops</div>
                <div className="text-2xl font-bold">{stops.length}</div>
              </div>
              <div className="bg-zinc-900 rounded-lg p-4">
                <div className="text-zinc-500 text-sm">Potential Value</div>
                <div className="text-2xl font-bold text-green-500">{formatCurrency(totalValue)}</div>
              </div>
            </div>

            {/* Export Options */}
            <div className="mt-6 space-y-2">
              <button
                onClick={() => exportRoute("google")}
                className="w-full py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                🗺️ Open in Google Maps
              </button>
              <button
                onClick={() => exportRoute("apple")}
                className="w-full py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                🍎 Open in Apple Maps
              </button>
              <button
                onClick={() => exportRoute("print")}
                className="w-full py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                🖨️ Print Route Sheet
              </button>
            </div>
          </div>

          {/* Route Map */}
          <div className="col-span-2 bg-zinc-800 rounded-xl p-4">
            <h3 className="font-semibold mb-4">Route Map</h3>
            <div className="h-[500px] bg-zinc-900 rounded-lg relative overflow-hidden">
              {/* Grid */}
              <div className="absolute inset-0 opacity-10">
                <div className="w-full h-full" style={{
                  backgroundImage: "linear-gradient(rgba(59, 130, 246, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(59, 130, 246, 0.3) 1px, transparent 1px)",
                  backgroundSize: "40px 40px"
                }} />
              </div>

              {/* Route line */}
              <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: "none" }}>
                <polyline
                  points={stops.map((s, i) => {
                    const x = 50 + (i % 5) * 120;
                    const y = 80 + Math.floor(i / 5) * 100;
                    return `${x},${y}`;
                  }).join(" ")}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="3"
                  strokeDasharray="8,4"
                />
              </svg>

              {/* Stop markers */}
              {stops.map((stop, i) => {
                const x = 50 + (i % 5) * 120;
                const y = 80 + Math.floor(i / 5) * 100;
                return (
                  <div
                    key={stop.id}
                    className="absolute flex flex-col items-center"
                    style={{ left: x - 15, top: y - 15 }}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-lg ${
                      stop.status === "visited" ? "bg-green-500" :
                      stop.status === "skipped" ? "bg-zinc-600" :
                      "bg-blue-500"
                    }`}>
                      {stop.stopNumber}
                    </div>
                    <div className="mt-1 px-2 py-0.5 bg-zinc-800 rounded text-xs max-w-[100px] truncate">
                      {stop.address.split(",")[0]}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Navigate Tab */}
      {activeTab === "navigate" && (
        <div className="space-y-4">
          {/* Progress */}
          <div className="bg-zinc-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Today&apos;s Progress</h3>
              <span className="text-sm text-zinc-400">
                {completedStops} of {stops.length} stops completed
              </span>
            </div>
            <div className="h-3 bg-zinc-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-500"
                style={{ width: `${(completedStops / stops.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Stop Cards */}
          <div className="space-y-3">
            {stops.map((stop) => (
              <div
                key={stop.id}
                className={`p-4 rounded-xl border transition-colors ${
                  stop.status === "visited" 
                    ? "bg-green-500/10 border-green-500/50"
                    : stop.status === "skipped"
                    ? "bg-zinc-800/50 border-zinc-700 opacity-60"
                    : "bg-zinc-800 border-zinc-700"
                }`}
              >
                <div className="flex items-center gap-4">
                  {/* Stop Number */}
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg ${
                    stop.status === "visited" ? "bg-green-500" :
                    stop.status === "skipped" ? "bg-zinc-600" :
                    "bg-blue-500"
                  }`}>
                    {stop.status === "visited" ? "✓" : stop.stopNumber}
                  </div>

                  {/* Address & Info */}
                  <div className="flex-1">
                    <div className="font-medium">{stop.address}</div>
                    <div className="flex gap-4 mt-1 text-sm text-zinc-500">
                      {stop.damageScore && <span>Score: {stop.damageScore}</span>}
                      {stop.estimatedJobValue && (
                        <span className="text-green-500">{formatCurrency(stop.estimatedJobValue)}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {stop.status === "pending" && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(stop.address)}`;
                          window.open(url, "_blank");
                        }}
                        className="px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors"
                      >
                        Navigate
                      </button>
                      <button
                        onClick={() => markVisited(stop.id, "visited")}
                        className="px-3 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-medium transition-colors"
                      >
                        Mark Done
                      </button>
                      <button
                        onClick={() => markVisited(stop.id, "skipped")}
                        className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm font-medium transition-colors"
                      >
                        Skip
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Route State */}
      {activeTab !== "build" && !route && (
        <div className="bg-zinc-800 rounded-xl p-12 text-center">
          <div className="text-4xl mb-4">🗺️</div>
          <h3 className="text-lg font-semibold mb-2">No Route Created</h3>
          <p className="text-zinc-400 text-sm mb-4">Build and optimize a route first to view it here.</p>
          <button
            onClick={() => setActiveTab("build")}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors"
          >
            Build Route
          </button>
        </div>
      )}
    </div>
  );
}
