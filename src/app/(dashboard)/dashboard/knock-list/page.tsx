"use client";

import { useState, useCallback, useEffect } from "react";
import { useGeolocation } from "@/hooks/useGeolocation";

interface KnockListProperty {
  id: string;
  address: string;
  lat: number;
  lng: number;
  damageScore: number;
  roofAge: number;
  roofSize: number;
  propertyValue: number;
  stormSeverity: number;
  estimatedJobValue: number;
  distance?: number;
  selected: boolean;
}

interface KnockListFilters {
  minDamageScore: number;
  minRoofAge: number;
  minRoofSize: number;
  minPropertyValue: number;
  maxPropertyValue: number;
  maxDistance: number;
  stormSeverity: "all" | "severe" | "moderate" | "minor";
}

export default function KnockListPage() {
  const [properties, setProperties] = useState<KnockListProperty[]>([]);
  const [knockList, setKnockList] = useState<KnockListProperty[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<"build" | "list" | "map">("build");
  const [filters, setFilters] = useState<KnockListFilters>({
    minDamageScore: 60,
    minRoofAge: 10,
    minRoofSize: 15,
    minPropertyValue: 150000,
    maxPropertyValue: 1000000,
    maxDistance: 10,
    stormSeverity: "all",
  });
  const [centerLocation, setCenterLocation] = useState<{ lat: number; lng: number; address: string }>({
    lat: 32.7767,
    lng: -96.7970,
    address: "Dallas, TX",
  });
  const [listName, setListName] = useState("Storm Knock List - " + new Date().toLocaleDateString());

  // Geolocation hook - auto-fetch on mount
  const { 
    latitude, 
    longitude, 
    loading: geoLoading, 
    error: geoError,
    getLocation,
    hasLocation 
  } = useGeolocation({ autoFetch: true });

  // Update center location when geolocation completes
  useEffect(() => {
    if (hasLocation && latitude && longitude) {
      setCenterLocation({
        lat: latitude,
        lng: longitude,
        address: "Your Location",
      });
    }
  }, [hasLocation, latitude, longitude]);

  const fetchProperties = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/knock-list/properties?lat=${centerLocation.lat}&lng=${centerLocation.lng}&radius=${filters.maxDistance}`);
      if (response.ok) {
        const data = await response.json();
        setProperties(data.properties || []);
      } else {
        // Demo data
        const demoProperties: KnockListProperty[] = Array.from({ length: 100 }, (_, i) => ({
          id: `prop-${i + 1}`,
          address: `${1000 + i * 50} ${["Oak", "Maple", "Cedar", "Pine", "Elm", "Main", "Park"][i % 7]} ${["St", "Ave", "Dr", "Blvd"][i % 4]}, ${["Dallas", "Plano", "Frisco"][i % 3]} TX`,
          lat: centerLocation.lat + (Math.random() - 0.5) * 0.1,
          lng: centerLocation.lng + (Math.random() - 0.5) * 0.1,
          damageScore: Math.round(40 + Math.random() * 60),
          roofAge: Math.round(5 + Math.random() * 25),
          roofSize: Math.round(15 + Math.random() * 40),
          propertyValue: Math.round(150000 + Math.random() * 850000),
          stormSeverity: Math.round(30 + Math.random() * 70),
          estimatedJobValue: Math.round(8000 + Math.random() * 20000),
          distance: Math.round(Math.random() * filters.maxDistance * 10) / 10,
          selected: false,
        }));
        setProperties(demoProperties);
      }
    } catch (error) {
      console.error("Error fetching properties:", error);
    } finally {
      setLoading(false);
    }
  }, [centerLocation, filters.maxDistance]);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  const generateKnockList = async () => {
    setGenerating(true);
    
    // Filter properties based on criteria
    const filtered = properties.filter(p => 
      p.damageScore >= filters.minDamageScore &&
      p.roofAge >= filters.minRoofAge &&
      p.roofSize >= filters.minRoofSize &&
      p.propertyValue >= filters.minPropertyValue &&
      p.propertyValue <= filters.maxPropertyValue &&
      (p.distance || 0) <= filters.maxDistance &&
      (filters.stormSeverity === "all" ||
        (filters.stormSeverity === "severe" && p.stormSeverity >= 70) ||
        (filters.stormSeverity === "moderate" && p.stormSeverity >= 50 && p.stormSeverity < 70) ||
        (filters.stormSeverity === "minor" && p.stormSeverity < 50))
    );

    // Sort by damage score and limit to 50
    const sorted = filtered
      .sort((a, b) => b.damageScore - a.damageScore)
      .slice(0, 50)
      .map(p => ({ ...p, selected: true }));

    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate AI processing
    
    setKnockList(sorted);
    setGenerating(false);
    setActiveTab("list");
  };

  const togglePropertySelection = (id: string) => {
    setKnockList(prev => prev.map(p => 
      p.id === id ? { ...p, selected: !p.selected } : p
    ));
  };

  const addToKnockList = (property: KnockListProperty) => {
    if (!knockList.find(p => p.id === property.id)) {
      setKnockList(prev => [...prev, { ...property, selected: true }]);
    }
  };

  const removeFromKnockList = (id: string) => {
    setKnockList(prev => prev.filter(p => p.id !== id));
  };

  const exportList = async (format: "csv" | "pdf" | "print") => {
    const selectedProperties = knockList.filter(p => p.selected);
    
    if (format === "csv") {
      const headers = ["Address", "Damage Score", "Roof Age", "Roof Size", "Property Value", "Est. Job Value", "Distance"];
      const rows = selectedProperties.map(p => [
        p.address,
        p.damageScore,
        p.roofAge,
        p.roofSize,
        p.propertyValue,
        p.estimatedJobValue,
        p.distance || "N/A"
      ]);
      
      const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${listName.replace(/\s+/g, "_")}.csv`;
      a.click();
    } else if (format === "print") {
      window.print();
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
  };

  const filteredCount = properties.filter(p => 
    p.damageScore >= filters.minDamageScore &&
    p.roofAge >= filters.minRoofAge &&
    p.roofSize >= filters.minRoofSize &&
    p.propertyValue >= filters.minPropertyValue &&
    p.propertyValue <= filters.maxPropertyValue
  ).length;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Knock List Generator</h1>
          <p className="text-zinc-400 text-sm mt-1">Build optimized door-to-door sales lists</p>
        </div>
        <div className="flex gap-2">
          {knockList.length > 0 && (
            <>
              <button
                onClick={() => exportList("csv")}
                className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export CSV
              </button>
              <button
                onClick={() => exportList("print")}
                className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-zinc-800 p-1 rounded-lg w-fit">
        {[
          { id: "build", label: "Build List", icon: "🔧" },
          { id: "list", label: `Knock List (${knockList.length})`, icon: "📋" },
          { id: "map", label: "Map View", icon: "🗺️" },
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
          {/* Filters Panel */}
          <div className="bg-zinc-800 rounded-xl p-4">
            <h3 className="font-semibold mb-4">Smart Lead Filters</h3>
            
            {/* Location */}
            <div className="mb-4">
              <label className="text-sm text-zinc-400 block mb-2">Center Location</label>
              <input
                type="text"
                value={centerLocation.address}
                onChange={(e) => setCenterLocation(prev => ({ ...prev, address: e.target.value }))}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm"
                placeholder="Enter address or city"
              />
              <button
                onClick={() => {
                  navigator.geolocation.getCurrentPosition((pos) => {
                    setCenterLocation({
                      lat: pos.coords.latitude,
                      lng: pos.coords.longitude,
                      address: "Current Location",
                    });
                  });
                }}
                className="mt-2 text-xs text-blue-500 hover:text-blue-400"
              >
                📍 Use Current Location
              </button>
            </div>

            {/* Filters */}
            <div className="space-y-4">
              <div>
                <label className="text-sm text-zinc-400 flex justify-between mb-2">
                  <span>Min Damage Score</span>
                  <span className="text-white">{filters.minDamageScore}</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={filters.minDamageScore}
                  onChange={(e) => setFilters(prev => ({ ...prev, minDamageScore: parseInt(e.target.value) }))}
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-sm text-zinc-400 flex justify-between mb-2">
                  <span>Min Roof Age</span>
                  <span className="text-white">{filters.minRoofAge} years</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="30"
                  value={filters.minRoofAge}
                  onChange={(e) => setFilters(prev => ({ ...prev, minRoofAge: parseInt(e.target.value) }))}
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-sm text-zinc-400 flex justify-between mb-2">
                  <span>Min Roof Size</span>
                  <span className="text-white">{filters.minRoofSize} sq</span>
                </label>
                <input
                  type="range"
                  min="10"
                  max="60"
                  value={filters.minRoofSize}
                  onChange={(e) => setFilters(prev => ({ ...prev, minRoofSize: parseInt(e.target.value) }))}
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-sm text-zinc-400 flex justify-between mb-2">
                  <span>Distance Radius</span>
                  <span className="text-white">{filters.maxDistance} mi</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="25"
                  value={filters.maxDistance}
                  onChange={(e) => setFilters(prev => ({ ...prev, maxDistance: parseInt(e.target.value) }))}
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-sm text-zinc-400 block mb-2">Property Value Range</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={filters.minPropertyValue}
                    onChange={(e) => setFilters(prev => ({ ...prev, minPropertyValue: parseInt(e.target.value) }))}
                    className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1.5 text-sm"
                    placeholder="Min"
                  />
                  <span className="text-zinc-500 self-center">to</span>
                  <input
                    type="number"
                    value={filters.maxPropertyValue}
                    onChange={(e) => setFilters(prev => ({ ...prev, maxPropertyValue: parseInt(e.target.value) }))}
                    className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1.5 text-sm"
                    placeholder="Max"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm text-zinc-400 block mb-2">Storm Intensity</label>
                <select
                  value={filters.stormSeverity}
                  onChange={(e) => setFilters(prev => ({ ...prev, stormSeverity: e.target.value as typeof filters.stormSeverity }))}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="all">All Severities</option>
                  <option value="severe">Severe (70+)</option>
                  <option value="moderate">Moderate (50-69)</option>
                  <option value="minor">Minor (&lt;50)</option>
                </select>
              </div>
            </div>

            {/* Generate Button */}
            <div className="mt-6 pt-4 border-t border-zinc-700">
              <div className="text-sm text-zinc-400 mb-3">
                <span className="text-white font-medium">{filteredCount}</span> properties match your filters
              </div>
              <button
                onClick={generateKnockList}
                disabled={generating || filteredCount === 0}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
              >
                {generating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Generating AI List...
                  </>
                ) : (
                  <>
                    ✨ Generate Best 50 Leads
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Preview */}
          <div className="col-span-2">
            <div className="bg-zinc-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Available Properties</h3>
                <span className="text-sm text-zinc-400">{properties.length} total</span>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-zinc-400">Loading properties...</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {properties.slice(0, 20).map((property) => (
                    <div
                      key={property.id}
                      className={`p-3 rounded-lg border transition-colors ${
                        property.damageScore >= filters.minDamageScore &&
                        property.roofAge >= filters.minRoofAge
                          ? "bg-zinc-900 border-zinc-700 hover:border-zinc-600"
                          : "bg-zinc-900/50 border-zinc-800 opacity-50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-sm">{property.address}</div>
                          <div className="flex gap-3 mt-1 text-xs text-zinc-500">
                            <span>Score: {property.damageScore}</span>
                            <span>Roof: {property.roofAge}yr</span>
                            <span>{property.roofSize} sq</span>
                            <span>{property.distance}mi</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-xs text-zinc-500">Est. Value</div>
                            <div className="font-medium text-green-500">{formatCurrency(property.estimatedJobValue)}</div>
                          </div>
                          <button
                            onClick={() => addToKnockList(property)}
                            className="px-2 py-1 bg-blue-600 hover:bg-blue-500 rounded text-xs"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* List Tab */}
      {activeTab === "list" && (
        <div className="space-y-4">
          {/* List Header */}
          <div className="bg-zinc-800 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <input
                  type="text"
                  value={listName}
                  onChange={(e) => setListName(e.target.value)}
                  className="text-lg font-semibold bg-transparent border-none outline-none"
                />
                <div className="text-sm text-zinc-400 mt-1">
                  {knockList.filter(p => p.selected).length} of {knockList.length} properties selected
                </div>
              </div>
              <div className="flex gap-4">
                <div className="text-right">
                  <div className="text-xs text-zinc-500">Total Est. Value</div>
                  <div className="text-xl font-bold text-green-500">
                    {formatCurrency(knockList.filter(p => p.selected).reduce((sum, p) => sum + p.estimatedJobValue, 0))}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-zinc-500">Avg Damage Score</div>
                  <div className="text-xl font-bold">
                    {Math.round(knockList.reduce((sum, p) => sum + p.damageScore, 0) / knockList.length || 0)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Knock List */}
          {knockList.length === 0 ? (
            <div className="bg-zinc-800 rounded-xl p-12 text-center">
              <div className="text-4xl mb-4">📋</div>
              <h3 className="text-lg font-semibold mb-2">No Knock List Yet</h3>
              <p className="text-zinc-400 text-sm mb-4">Generate a list using the Build tab or add properties manually.</p>
              <button
                onClick={() => setActiveTab("build")}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors"
              >
                Build Knock List
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {knockList.map((property, index) => (
                <div
                  key={property.id}
                  className={`p-4 rounded-xl border transition-colors ${
                    property.selected
                      ? "bg-zinc-800 border-zinc-700"
                      : "bg-zinc-900/50 border-zinc-800 opacity-60"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {/* Checkbox */}
                    <button
                      onClick={() => togglePropertySelection(property.id)}
                      className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                        property.selected
                          ? "bg-blue-600 border-blue-600"
                          : "border-zinc-600"
                      }`}
                    >
                      {property.selected && (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>

                    {/* Rank */}
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${
                      index < 3 ? "bg-yellow-500/20 text-yellow-500" :
                      index < 10 ? "bg-blue-500/20 text-blue-500" :
                      "bg-zinc-700 text-zinc-400"
                    }`}>
                      {index + 1}
                    </div>

                    {/* Property Info */}
                    <div className="flex-1">
                      <div className="font-medium">{property.address}</div>
                      <div className="flex gap-4 mt-1 text-sm text-zinc-500">
                        <span className={`font-medium ${
                          property.damageScore >= 80 ? "text-green-500" :
                          property.damageScore >= 60 ? "text-yellow-500" :
                          "text-zinc-400"
                        }`}>
                          Score: {property.damageScore}
                        </span>
                        <span>Roof: {property.roofAge}yr • {property.roofSize}sq</span>
                        <span>Value: {formatCurrency(property.propertyValue)}</span>
                        <span>{property.distance}mi away</span>
                      </div>
                    </div>

                    {/* Est Value */}
                    <div className="text-right">
                      <div className="text-xs text-zinc-500">Est. Job</div>
                      <div className="font-bold text-green-500">{formatCurrency(property.estimatedJobValue)}</div>
                    </div>

                    {/* Actions */}
                    <button
                      onClick={() => removeFromKnockList(property.id)}
                      className="p-2 text-zinc-500 hover:text-red-500 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Map Tab */}
      {activeTab === "map" && (
        <div className="bg-zinc-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Knock List Map</h3>
            <div className="flex gap-2">
              <button className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm flex items-center gap-2">
                <span>🗺️</span> Open in Google Maps
              </button>
              <button className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm flex items-center gap-2">
                <span>🍎</span> Open in Apple Maps
              </button>
            </div>
          </div>
          <div className="h-[500px] bg-zinc-900 rounded-lg flex items-center justify-center relative overflow-hidden">
            {/* Simple grid visualization */}
            <div className="absolute inset-0 opacity-10">
              <div className="w-full h-full" style={{
                backgroundImage: "linear-gradient(rgba(59, 130, 246, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(59, 130, 246, 0.3) 1px, transparent 1px)",
                backgroundSize: "40px 40px"
              }} />
            </div>
            
            {/* Property markers */}
            {knockList.slice(0, 20).map((property, i) => (
              <div
                key={property.id}
                className={`absolute w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold cursor-pointer transition-transform hover:scale-125 ${
                  i < 3 ? "bg-yellow-500 text-black" :
                  i < 10 ? "bg-blue-500" :
                  "bg-zinc-600"
                }`}
                style={{
                  left: `${20 + ((property.lng + 97) * 500) % 60}%`,
                  top: `${20 + ((property.lat - 32) * 500) % 60}%`,
                }}
                title={property.address}
              >
                {i + 1}
              </div>
            ))}

            {/* Legend */}
            <div className="absolute bottom-4 right-4 bg-zinc-800/95 p-3 rounded-lg text-sm">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-yellow-500" />
                  <span className="text-zinc-400">Top 3</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-blue-500" />
                  <span className="text-zinc-400">Top 10</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-zinc-600" />
                  <span className="text-zinc-400">Others</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
