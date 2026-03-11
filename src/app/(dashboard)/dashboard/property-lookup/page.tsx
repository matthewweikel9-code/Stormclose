"use client";

import { useState, useCallback, useEffect } from "react";
import { useGeolocation } from "@/hooks/useGeolocation";

interface PropertyData {
  address: string;
  lat: number;
  lng: number;
  owner: {
    name: string;
    mailingAddress?: string;
  };
  property: {
    value: number;
    yearBuilt: number;
    squareFootage: number;
    lotSize: number;
    buildingType: string;
    bedrooms?: number;
    bathrooms?: number;
  };
  roof: {
    type: string;
    material: string;
    age: number;
    complexity: "simple" | "moderate" | "complex";
    condition: "excellent" | "good" | "fair" | "poor";
    squareFootage: number;
    pitch?: number;
  };
  parcel: {
    id: string;
    boundaries: { lat: number; lng: number }[];
    dimensions: { width: number; length: number };
  };
  history: {
    lastSale?: { date: string; price: number };
    mortgageEstimate?: number;
    permits: { date: string; type: string; value?: number }[];
  };
  neighborhood: {
    avgHomeValue: number;
    avgRoofAge: number;
    claimLikelihood: number;
  };
  stormExposure?: {
    hailEvents: number;
    maxHailSize: number;
    windEvents: number;
    maxWindSpeed: number;
    lastStormDate?: string;
  };
}

export default function PropertyLookupPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProperty, setSelectedProperty] = useState<PropertyData | null>(null);
  const [recentSearches, setRecentSearches] = useState<PropertyData[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "roof" | "history" | "neighborhood">("overview");
  const [dataSource, setDataSource] = useState<string>("");

  // Geolocation hook
  const { 
    latitude, 
    longitude, 
    loading: geoLoading, 
    error: geoError,
    getLocation,
    hasLocation 
  } = useGeolocation();

  // Search by current location
  const searchByLocation = useCallback(async () => {
    if (!hasLocation) {
      getLocation();
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch(`/api/property/lookup?lat=${latitude}&lng=${longitude}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedProperty(data);
        setDataSource(data.source || "unknown");
        setRecentSearches(prev => [data, ...prev.filter(p => p.address !== data.address)].slice(0, 10));
      }
    } catch (error) {
      console.error("Error searching by location:", error);
    } finally {
      setLoading(false);
    }
  }, [hasLocation, latitude, longitude, getLocation]);

  // Trigger location search when geolocation completes
  useEffect(() => {
    if (hasLocation && geoLoading === false && !selectedProperty) {
      // Don't auto-search, just enable the button
    }
  }, [hasLocation, geoLoading, selectedProperty]);

  const searchProperty = useCallback(async (query: string) => {
    if (!query.trim()) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/property/lookup?address=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedProperty(data);
        setDataSource(data.source || "unknown");
        setRecentSearches(prev => [data, ...prev.filter(p => p.address !== data.address)].slice(0, 10));
      } else {
        console.error("Property lookup failed:", response.statusText);
        setSelectedProperty(null);
      }
    } catch (error) {
      console.error("Error searching property:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
  };

  const getRoofConditionColor = (condition: string) => {
    switch (condition) {
      case "excellent": return "text-green-500 bg-green-500/20";
      case "good": return "text-blue-500 bg-blue-500/20";
      case "fair": return "text-yellow-500 bg-yellow-500/20";
      case "poor": return "text-red-500 bg-red-500/20";
      default: return "text-zinc-500 bg-zinc-500/20";
    }
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex">
      {/* Left Panel - Search & Recent */}
      <div className="w-80 border-r border-zinc-800 bg-zinc-900/50 flex flex-col">
        {/* Search */}
        <div className="p-4 border-b border-zinc-800">
          <h1 className="text-lg font-bold mb-3">Property Lookup</h1>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchProperty(searchQuery)}
              placeholder="Enter address..."
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 pr-10 text-sm placeholder-zinc-500 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={() => searchProperty(searchQuery)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-zinc-700 transition-colors"
            >
              <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="p-4 border-b border-zinc-800">
          <h3 className="text-sm font-medium text-zinc-400 mb-2">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-2">
            <button 
              onClick={searchByLocation}
              disabled={geoLoading}
              className={`p-2 rounded-lg text-xs transition-colors flex items-center gap-2 ${
                hasLocation ? "bg-green-600/20 text-green-400 hover:bg-green-600/30" : "bg-zinc-800 hover:bg-zinc-700"
              }`}
            >
              {geoLoading ? (
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <span>📍</span>
              )}
              {hasLocation ? "Search Here" : "My Location"}
            </button>
            <button className="p-2 bg-zinc-800 rounded-lg text-xs hover:bg-zinc-700 transition-colors flex items-center gap-2">
              <span>🗺️</span> Click on Map
            </button>
          </div>
          {geoError && (
            <div className="mt-2 text-xs text-yellow-500">{geoError}</div>
          )}
          {hasLocation && (
            <div className="mt-2 text-xs text-zinc-500">
              📍 {latitude?.toFixed(4)}, {longitude?.toFixed(4)}
            </div>
          )}
        </div>

        {/* Recent Searches */}
        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="text-sm font-medium text-zinc-400 mb-3">Recent Searches</h3>
          <div className="space-y-2">
            {recentSearches.length === 0 ? (
              <div className="text-center text-zinc-500 text-sm py-8">
                No recent searches
              </div>
            ) : (
              recentSearches.map((property, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedProperty(property)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedProperty?.address === property.address
                      ? "bg-blue-600/20 border-blue-500"
                      : "bg-zinc-800 border-zinc-700 hover:border-zinc-600"
                  }`}
                >
                  <div className="text-sm font-medium truncate">{property.address}</div>
                  <div className="flex gap-2 mt-1 text-xs text-zinc-500">
                    <span>{formatCurrency(property.property.value)}</span>
                    <span>•</span>
                    <span>{property.property.squareFootage} sqft</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedProperty ? (
          <>
            {/* Property Header */}
            <div className="p-4 border-b border-zinc-800 bg-zinc-900/50">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold">{selectedProperty.address}</h2>
                  <div className="flex items-center gap-4 mt-1 text-sm text-zinc-400">
                    <span>Owner: {selectedProperty.owner.name}</span>
                    <span>•</span>
                    <span>Parcel: {selectedProperty.parcel.id}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors">
                    Add to Knock List
                  </button>
                  <button className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm font-medium transition-colors">
                    Export Report
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 mt-4">
                {[
                  { id: "overview", label: "Overview" },
                  { id: "roof", label: "Roof Intelligence" },
                  { id: "history", label: "Property History" },
                  { id: "neighborhood", label: "Neighborhood" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? "bg-blue-600 text-white"
                        : "text-zinc-400 hover:bg-zinc-800"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {activeTab === "overview" && (
                <div className="grid grid-cols-3 gap-4">
                  {/* Property Value Card */}
                  <div className="bg-zinc-800 rounded-xl p-4">
                    <h3 className="text-sm font-medium text-zinc-400 mb-3">Property Value</h3>
                    <div className="text-3xl font-bold text-green-500">{formatCurrency(selectedProperty.property.value)}</div>
                    <div className="mt-2 text-sm text-zinc-500">
                      {selectedProperty.history.lastSale && (
                        <span>Last sold: {formatCurrency(selectedProperty.history.lastSale.price)} ({selectedProperty.history.lastSale.date.split("-")[0]})</span>
                      )}
                    </div>
                  </div>

                  {/* Property Details Card */}
                  <div className="bg-zinc-800 rounded-xl p-4">
                    <h3 className="text-sm font-medium text-zinc-400 mb-3">Property Details</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Year Built</span>
                        <span>{selectedProperty.property.yearBuilt}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Square Footage</span>
                        <span>{selectedProperty.property.squareFootage.toLocaleString()} sqft</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Lot Size</span>
                        <span>{selectedProperty.property.lotSize.toLocaleString()} sqft</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Building Type</span>
                        <span>{selectedProperty.property.buildingType}</span>
                      </div>
                      {selectedProperty.property.bedrooms && (
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Bed/Bath</span>
                          <span>{selectedProperty.property.bedrooms}bd / {selectedProperty.property.bathrooms}ba</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Storm Exposure Card */}
                  <div className="bg-zinc-800 rounded-xl p-4">
                    <h3 className="text-sm font-medium text-zinc-400 mb-3">Storm Exposure</h3>
                    {selectedProperty.stormExposure ? (
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Hail Events</span>
                          <span className="text-orange-500 font-medium">{selectedProperty.stormExposure.hailEvents}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Max Hail Size</span>
                          <span>{selectedProperty.stormExposure.maxHailSize}"</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Wind Events</span>
                          <span className="text-blue-500 font-medium">{selectedProperty.stormExposure.windEvents}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Max Wind Speed</span>
                          <span>{selectedProperty.stormExposure.maxWindSpeed} mph</span>
                        </div>
                        {selectedProperty.stormExposure.lastStormDate && (
                          <div className="flex justify-between">
                            <span className="text-zinc-500">Last Storm</span>
                            <span>{new Date(selectedProperty.stormExposure.lastStormDate).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-zinc-500 text-sm">No storm data available</div>
                    )}
                  </div>

                  {/* Owner Info Card */}
                  <div className="bg-zinc-800 rounded-xl p-4 col-span-2">
                    <h3 className="text-sm font-medium text-zinc-400 mb-3">Owner Information</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-zinc-500 mb-1">Owner Name</div>
                        <div className="font-medium text-lg">{selectedProperty.owner.name}</div>
                      </div>
                      <div>
                        <div className="text-zinc-500 mb-1">Mailing Address</div>
                        <div>{selectedProperty.owner.mailingAddress || "Same as property"}</div>
                      </div>
                      <div>
                        <div className="text-zinc-500 mb-1">Est. Mortgage</div>
                        <div>{selectedProperty.history.mortgageEstimate ? formatCurrency(selectedProperty.history.mortgageEstimate) : "N/A"}</div>
                      </div>
                      <div>
                        <div className="text-zinc-500 mb-1">Equity Estimate</div>
                        <div className="text-green-500 font-medium">
                          {selectedProperty.history.mortgageEstimate 
                            ? formatCurrency(selectedProperty.property.value - selectedProperty.history.mortgageEstimate)
                            : "N/A"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Parcel Info */}
                  <div className="bg-zinc-800 rounded-xl p-4">
                    <h3 className="text-sm font-medium text-zinc-400 mb-3">Parcel</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Parcel ID</span>
                        <span className="font-mono text-xs">{selectedProperty.parcel.id}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Dimensions</span>
                        <span>{selectedProperty.parcel.dimensions.width}' × {selectedProperty.parcel.dimensions.length}'</span>
                      </div>
                    </div>
                    <div className="mt-3 h-24 bg-zinc-900 rounded-lg flex items-center justify-center text-zinc-500 text-xs">
                      Parcel Map Preview
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "roof" && (
                <div className="grid grid-cols-2 gap-4">
                  {/* Roof Overview */}
                  <div className="bg-zinc-800 rounded-xl p-4">
                    <h3 className="text-sm font-medium text-zinc-400 mb-3">Roof Overview</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-zinc-900 rounded-lg p-3">
                        <div className="text-zinc-500 text-xs mb-1">Roof Type</div>
                        <div className="font-medium">{selectedProperty.roof.type}</div>
                      </div>
                      <div className="bg-zinc-900 rounded-lg p-3">
                        <div className="text-zinc-500 text-xs mb-1">Material</div>
                        <div className="font-medium">{selectedProperty.roof.material}</div>
                      </div>
                      <div className="bg-zinc-900 rounded-lg p-3">
                        <div className="text-zinc-500 text-xs mb-1">Age</div>
                        <div className="font-medium">{selectedProperty.roof.age} years</div>
                      </div>
                      <div className="bg-zinc-900 rounded-lg p-3">
                        <div className="text-zinc-500 text-xs mb-1">Pitch</div>
                        <div className="font-medium">{selectedProperty.roof.pitch || "N/A"}/12</div>
                      </div>
                    </div>
                  </div>

                  {/* Roof Condition */}
                  <div className="bg-zinc-800 rounded-xl p-4">
                    <h3 className="text-sm font-medium text-zinc-400 mb-3">Roof Condition Assessment</h3>
                    <div className="flex items-center gap-4 mb-4">
                      <div className={`px-4 py-2 rounded-lg font-bold capitalize ${getRoofConditionColor(selectedProperty.roof.condition)}`}>
                        {selectedProperty.roof.condition}
                      </div>
                      <div className="flex-1">
                        <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${
                              selectedProperty.roof.condition === "excellent" ? "w-full bg-green-500" :
                              selectedProperty.roof.condition === "good" ? "w-3/4 bg-blue-500" :
                              selectedProperty.roof.condition === "fair" ? "w-1/2 bg-yellow-500" :
                              "w-1/4 bg-red-500"
                            }`}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Complexity</span>
                        <span className="capitalize">{selectedProperty.roof.complexity}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Roof Square Footage</span>
                        <span>{selectedProperty.roof.squareFootage.toLocaleString()} sqft</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Estimated Squares</span>
                        <span className="font-medium text-blue-500">{Math.ceil(selectedProperty.roof.squareFootage / 100)} squares</span>
                      </div>
                    </div>
                  </div>

                  {/* Roof Age Analysis */}
                  <div className="bg-zinc-800 rounded-xl p-4 col-span-2">
                    <h3 className="text-sm font-medium text-zinc-400 mb-3">Roof Age Analysis</h3>
                    <div className="flex items-center gap-6">
                      <div className="flex-shrink-0">
                        <div className="w-32 h-32 rounded-full border-8 border-zinc-700 flex items-center justify-center relative">
                          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="8" className="text-zinc-700" />
                            <circle 
                              cx="50" cy="50" r="40" fill="none" strokeWidth="8" strokeLinecap="round"
                              className={`${
                                selectedProperty.roof.age <= 10 ? "text-green-500" :
                                selectedProperty.roof.age <= 15 ? "text-yellow-500" :
                                selectedProperty.roof.age <= 20 ? "text-orange-500" :
                                "text-red-500"
                              }`}
                              strokeDasharray={`${(selectedProperty.roof.age / 25) * 251.2} 251.2`}
                            />
                          </svg>
                          <div className="text-center">
                            <div className="text-2xl font-bold">{selectedProperty.roof.age}</div>
                            <div className="text-xs text-zinc-500">years</div>
                          </div>
                        </div>
                      </div>
                      <div className="flex-1 space-y-3">
                        <div className="p-3 bg-zinc-900 rounded-lg">
                          <div className="text-xs text-zinc-500 mb-1">Expected Lifespan</div>
                          <div className="flex items-center justify-between">
                            <span>Asphalt Shingle: 20-25 years</span>
                            <span className={`font-medium ${
                              25 - selectedProperty.roof.age > 10 ? "text-green-500" :
                              25 - selectedProperty.roof.age > 5 ? "text-yellow-500" :
                              "text-red-500"
                            }`}>
                              {Math.max(0, 25 - selectedProperty.roof.age)} years remaining
                            </span>
                          </div>
                        </div>
                        <div className="p-3 bg-zinc-900 rounded-lg">
                          <div className="text-xs text-zinc-500 mb-1">Replacement Recommendation</div>
                          <div className={`font-medium ${
                            selectedProperty.roof.age >= 20 ? "text-red-500" :
                            selectedProperty.roof.age >= 15 ? "text-orange-500" :
                            "text-green-500"
                          }`}>
                            {selectedProperty.roof.age >= 20 ? "🚨 Recommend immediate replacement" :
                             selectedProperty.roof.age >= 15 ? "⚠️ Consider replacement within 2-3 years" :
                             "✅ Roof is within expected lifespan"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "history" && (
                <div className="space-y-4">
                  {/* Sale History */}
                  <div className="bg-zinc-800 rounded-xl p-4">
                    <h3 className="text-sm font-medium text-zinc-400 mb-3">Sale History</h3>
                    {selectedProperty.history.lastSale ? (
                      <div className="flex items-center justify-between p-3 bg-zinc-900 rounded-lg">
                        <div>
                          <div className="text-zinc-500 text-xs">Last Sale</div>
                          <div className="font-medium">{new Date(selectedProperty.history.lastSale.date).toLocaleDateString()}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-zinc-500 text-xs">Sale Price</div>
                          <div className="font-bold text-lg text-green-500">{formatCurrency(selectedProperty.history.lastSale.price)}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-zinc-500 text-xs">Appreciation</div>
                          <div className="font-medium text-blue-500">
                            +{Math.round(((selectedProperty.property.value - selectedProperty.history.lastSale.price) / selectedProperty.history.lastSale.price) * 100)}%
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-zinc-500 text-sm">No sale history available</div>
                    )}
                  </div>

                  {/* Permit History */}
                  <div className="bg-zinc-800 rounded-xl p-4">
                    <h3 className="text-sm font-medium text-zinc-400 mb-3">Permit History</h3>
                    {selectedProperty.history.permits.length > 0 ? (
                      <div className="space-y-2">
                        {selectedProperty.history.permits.map((permit, i) => (
                          <div key={i} className="flex items-center justify-between p-3 bg-zinc-900 rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center">
                                <span>🔧</span>
                              </div>
                              <div>
                                <div className="font-medium">{permit.type}</div>
                                <div className="text-xs text-zinc-500">{new Date(permit.date).toLocaleDateString()}</div>
                              </div>
                            </div>
                            {permit.value && (
                              <div className="text-right">
                                <div className="text-zinc-500 text-xs">Value</div>
                                <div className="font-medium">{formatCurrency(permit.value)}</div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-zinc-500 text-sm">No permits found</div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === "neighborhood" && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-zinc-800 rounded-xl p-4">
                    <h3 className="text-sm font-medium text-zinc-400 mb-2">Avg Home Value</h3>
                    <div className="text-2xl font-bold text-green-500">{formatCurrency(selectedProperty.neighborhood.avgHomeValue)}</div>
                    <div className="text-xs text-zinc-500 mt-1">
                      This property: {selectedProperty.property.value > selectedProperty.neighborhood.avgHomeValue ? "Above" : "Below"} average
                    </div>
                  </div>
                  <div className="bg-zinc-800 rounded-xl p-4">
                    <h3 className="text-sm font-medium text-zinc-400 mb-2">Avg Roof Age</h3>
                    <div className="text-2xl font-bold text-orange-500">{selectedProperty.neighborhood.avgRoofAge} years</div>
                    <div className="text-xs text-zinc-500 mt-1">
                      Older roofs = more opportunity
                    </div>
                  </div>
                  <div className="bg-zinc-800 rounded-xl p-4">
                    <h3 className="text-sm font-medium text-zinc-400 mb-2">Claim Likelihood</h3>
                    <div className="text-2xl font-bold text-blue-500">{selectedProperty.neighborhood.claimLikelihood}%</div>
                    <div className="text-xs text-zinc-500 mt-1">
                      Based on historical data
                    </div>
                  </div>
                  <div className="bg-zinc-800 rounded-xl p-4 col-span-3">
                    <h3 className="text-sm font-medium text-zinc-400 mb-3">Neighborhood Opportunity Score</h3>
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="h-4 bg-zinc-700 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500"
                            style={{ width: `${selectedProperty.neighborhood.claimLikelihood}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-lg font-bold">{selectedProperty.neighborhood.claimLikelihood}/100</div>
                    </div>
                    <p className="text-sm text-zinc-400 mt-3">
                      This neighborhood has a {selectedProperty.neighborhood.claimLikelihood >= 70 ? "high" : selectedProperty.neighborhood.claimLikelihood >= 50 ? "moderate" : "low"} opportunity score based on average roof age, home values, and historical insurance claim rates.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Empty State */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md">
              <div className="w-20 h-20 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">Property Intelligence</h3>
              <p className="text-zinc-500 text-sm mb-4">
                Search for any property to view owner information, roof data, storm exposure, and neighborhood insights.
              </p>
            </div>
          </div>
        )}
      </div>

      {loading && (
        <div className="fixed inset-0 bg-zinc-950/80 flex items-center justify-center z-50">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-zinc-400">Looking up property...</span>
          </div>
        </div>
      )}
    </div>
  );
}
