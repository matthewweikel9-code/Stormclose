"use client";

import { useState, useEffect, useCallback } from "react";
import { useGeolocation } from "@/hooks";

interface ScoredLead {
  id: string;
  address: string;
  lat: number;
  lng: number;
  damageScore: number;
  opportunityScore: number;
  overallRank: number;
  factors: {
    hailSize: number;
    windSpeed: number;
    roofAge: number;
    roofType: string;
    propertyValue: number;
    stormProximity: number;
    roofSize: number;
    neighborhoodValue: number;
    insuranceLikelihood: number;
  };
  tags: string[];
  estimatedJobValue: number;
  claimProbability: number;
}

interface NeighborhoodScore {
  name: string;
  lat: number;
  lng: number;
  score: number;
  propertyCount: number;
  avgDamageScore: number;
  avgRoofAge: number;
  totalOpportunityValue: number;
}

export default function AILeadScoringPage() {
  const [leads, setLeads] = useState<ScoredLead[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<NeighborhoodScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<"leads" | "neighborhoods" | "tags">("leads");
  const [sortBy, setSortBy] = useState<"overallRank" | "damageScore" | "opportunityScore" | "estimatedJobValue">("overallRank");
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [stormData, setStormData] = useState<{ reportsFound: number; maxHailSize: number; maxWindSpeed: number } | null>(null);
  const [dataSource, setDataSource] = useState<{ storms: string; properties: string }>({ storms: "loading", properties: "loading" });

  // Get user's location
  const { latitude, longitude, loading: geoLoading, error: geoError, getLocation } = useGeolocation({ autoFetch: true });
  const [apiError, setApiError] = useState<string | null>(null);

  const fetchScoredLeads = useCallback(async (lat?: number, lng?: number) => {
    setLoading(true);
    setApiError(null);
    try {
      const params = new URLSearchParams();
      if (lat && lng) {
        params.set("lat", lat.toString());
        params.set("lng", lng.toString());
      }
      params.set("radius", "25");
      
      const response = await fetch(`/api/leads/score?${params.toString()}`);
      const data = await response.json();
      
      if (response.ok) {
        setLeads(data.leads || []);
        setNeighborhoods(data.neighborhoods || []);
        setStormData(data.stormData || null);
        setDataSource(data.source ? { storms: data.source, properties: data.source } : { storms: "live", properties: "live" });
        
        // Show any API errors
        if (data.errors?.property) {
          setApiError(data.errors.property);
        }
      } else {
        // API returned an error
        setApiError(data.message || data.error || "Failed to load lead data");
        setLeads([]);
        setNeighborhoods([]);
      }
    } catch (error: any) {
      console.error("Error fetching scored leads:", error);
      setApiError(error.message || "Network error - please try again");
      setLeads([]);
      setNeighborhoods([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch when location is available
  useEffect(() => {
    if (latitude && longitude) {
      fetchScoredLeads(latitude, longitude);
    } else if (!geoLoading && !latitude) {
      // No location available, show error
      setApiError("Please enable location services to find properties in your area");
      setLoading(false);
    }
  }, [latitude, longitude, geoLoading, fetchScoredLeads]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-500";
    if (score >= 75) return "text-yellow-500";
    if (score >= 60) return "text-orange-500";
    return "text-red-500";
  };

  const getScoreBg = (score: number) => {
    if (score >= 90) return "bg-green-500/20 border-green-500";
    if (score >= 75) return "bg-yellow-500/20 border-yellow-500";
    if (score >= 60) return "bg-orange-500/20 border-orange-500";
    return "bg-red-500/20 border-red-500";
  };

  const allTags = Array.from(new Set(leads.flatMap(l => l.tags)));
  const filteredLeads = filterTag 
    ? leads.filter(l => l.tags.includes(filterTag))
    : leads;

  const sortedLeads = [...filteredLeads].sort((a, b) => {
    if (sortBy === "overallRank") return a.overallRank - b.overallRank;
    if (sortBy === "estimatedJobValue") return b.estimatedJobValue - a.estimatedJobValue;
    return b[sortBy] - a[sortBy];
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">AI Lead Scoring</h1>
          <p className="text-zinc-400 text-sm mt-1">
            Real-time property data from CoreLogic + Xweather storm reports
            {latitude && longitude && (
              <span className="ml-2 text-green-400">
                📍 {latitude.toFixed(4)}, {longitude.toFixed(4)}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Live Data Indicator */}
          {leads.length > 0 && (
            <span className="px-2 py-1 rounded bg-green-500/20 text-green-400 text-xs">
              🔴 Live Data • {leads.length} properties
            </span>
          )}
          <button
            onClick={() => fetchScoredLeads(latitude ?? undefined, longitude ?? undefined)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Storm Data Summary */}
      {stormData && stormData.reportsFound > 0 && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="text-2xl">⛈️</div>
            <div>
              <div className="font-semibold text-blue-400">Active Storm Data Found</div>
              <div className="text-sm text-zinc-400">
                {stormData.reportsFound} storm reports within 25 miles • 
                Max Hail: {stormData.maxHailSize.toFixed(1)}" • 
                Max Wind: {stormData.maxWindSpeed} mph
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-zinc-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="text-zinc-400 text-sm">Top Leads</div>
            <span className="text-green-500 text-xs">Score 90+</span>
          </div>
          <div className="text-3xl font-bold mt-2">{leads.filter(l => l.damageScore >= 90).length}</div>
        </div>
        <div className="bg-zinc-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="text-zinc-400 text-sm">Total Opportunity</div>
            <span className="text-blue-500 text-xs">Est. Revenue</span>
          </div>
          <div className="text-3xl font-bold mt-2">{formatCurrency(leads.reduce((sum, l) => sum + l.estimatedJobValue, 0))}</div>
        </div>
        <div className="bg-zinc-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="text-zinc-400 text-sm">Avg Claim Prob</div>
            <span className="text-orange-500 text-xs">Insurance</span>
          </div>
          <div className="text-3xl font-bold mt-2">{Math.round(leads.reduce((sum, l) => sum + l.claimProbability, 0) / leads.length || 0)}%</div>
        </div>
        <div className="bg-zinc-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="text-zinc-400 text-sm">Hot Neighborhoods</div>
            <span className="text-red-500 text-xs">Score 80+</span>
          </div>
          <div className="text-3xl font-bold mt-2">{neighborhoods.filter(n => n.score >= 80).length}</div>
        </div>
      </div>

      {/* View Tabs */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex bg-zinc-800 rounded-lg p-1">
          {[
            { id: "leads", label: "Top Leads" },
            { id: "neighborhoods", label: "Neighborhoods" },
            { id: "tags", label: "Lead Tags" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveView(tab.id as typeof activeView)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeView === tab.id
                  ? "bg-blue-600 text-white"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeView === "leads" && (
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm"
          >
            <option value="overallRank">Sort by Rank</option>
            <option value="damageScore">Sort by Damage Score</option>
            <option value="opportunityScore">Sort by Opportunity</option>
            <option value="estimatedJobValue">Sort by Job Value</option>
          </select>
        )}

        {activeView === "tags" && filterTag && (
          <button
            onClick={() => setFilterTag(null)}
            className="px-3 py-1.5 bg-zinc-700 rounded-lg text-sm flex items-center gap-2"
          >
            {filterTag}
            <span className="text-zinc-400">×</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-zinc-400">
              {geoLoading ? "Getting your location..." : "Loading real property data from CoreLogic..."}
            </span>
          </div>
        </div>
      ) : apiError && leads.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-4 max-w-md text-center">
            <div className="text-4xl">⚠️</div>
            <h3 className="text-xl font-semibold">Unable to Load Properties</h3>
            <p className="text-zinc-400">{apiError}</p>
            <button
              onClick={() => {
                getLocation();
                if (latitude && longitude) {
                  fetchScoredLeads(latitude, longitude);
                }
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium"
            >
              Try Again
            </button>
          </div>
        </div>
      ) : leads.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-4 max-w-md text-center">
            <div className="text-4xl">🏠</div>
            <h3 className="text-xl font-semibold">No Properties Found</h3>
            <p className="text-zinc-400">
              No properties were found in your area. This could mean there are no recent storms nearby, 
              or CoreLogic doesn&apos;t have coverage in this location.
            </p>
            <button
              onClick={() => fetchScoredLeads(latitude ?? undefined, longitude ?? undefined)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium"
            >
              Search Again
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Top Leads View */}
          {activeView === "leads" && (
            <div className="space-y-3">
              {sortedLeads.map((lead, index) => (
                <div
                  key={lead.id}
                  className="bg-zinc-800 rounded-xl p-4 hover:bg-zinc-750 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    {/* Rank Badge */}
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg ${
                      lead.overallRank <= 3 ? "bg-yellow-500/20 text-yellow-500" :
                      lead.overallRank <= 10 ? "bg-blue-500/20 text-blue-500" :
                      "bg-zinc-700 text-zinc-400"
                    }`}>
                      #{lead.overallRank}
                    </div>

                    {/* Main Content */}
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold">{lead.address}</h3>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {lead.tags.map((tag, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 bg-zinc-700 rounded text-xs cursor-pointer hover:bg-zinc-600"
                                onClick={() => setFilterTag(tag)}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Scores */}
                        <div className="flex gap-3">
                          <div className={`px-3 py-2 rounded-lg border ${getScoreBg(lead.damageScore)}`}>
                            <div className="text-xs text-zinc-400">Damage</div>
                            <div className={`text-xl font-bold ${getScoreColor(lead.damageScore)}`}>{lead.damageScore}</div>
                          </div>
                          <div className={`px-3 py-2 rounded-lg border ${getScoreBg(lead.opportunityScore)}`}>
                            <div className="text-xs text-zinc-400">Opportunity</div>
                            <div className={`text-xl font-bold ${getScoreColor(lead.opportunityScore)}`}>{lead.opportunityScore}</div>
                          </div>
                        </div>
                      </div>

                      {/* Factors */}
                      <div className="grid grid-cols-6 gap-4 mt-4 text-sm">
                        <div>
                          <span className="text-zinc-500">Hail</span>
                          <div className="font-medium">{lead.factors.hailSize.toFixed(1)}"</div>
                        </div>
                        <div>
                          <span className="text-zinc-500">Wind</span>
                          <div className="font-medium">{lead.factors.windSpeed} mph</div>
                        </div>
                        <div>
                          <span className="text-zinc-500">Roof Age</span>
                          <div className="font-medium">{lead.factors.roofAge} yrs</div>
                        </div>
                        <div>
                          <span className="text-zinc-500">Roof Size</span>
                          <div className="font-medium">{lead.factors.roofSize} sq</div>
                        </div>
                        <div>
                          <span className="text-zinc-500">Claim Prob</span>
                          <div className="font-medium text-green-500">{lead.claimProbability}%</div>
                        </div>
                        <div>
                          <span className="text-zinc-500">Est. Value</span>
                          <div className="font-bold text-blue-500">{formatCurrency(lead.estimatedJobValue)}</div>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2">
                      <button onClick={() => {
                        const routeList = JSON.parse(localStorage.getItem("routeList") || "[]");
                        routeList.push({ address: lead.address, lat: lead.lat, lng: lead.lng, damageScore: lead.damageScore });
                        localStorage.setItem("routeList", JSON.stringify(routeList));
                        alert(`Added ${lead.address} to route list!`);
                      }} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors">
                        Add to List
                      </button>
                      <button onClick={() => {
                        window.open(`/dashboard/property-lookup?address=${encodeURIComponent(lead.address)}`, "_self");
                      }} className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm font-medium transition-colors">
                        View Details
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Neighborhoods View */}
          {activeView === "neighborhoods" && (
            <div className="grid grid-cols-2 gap-4">
              {neighborhoods.map((hood, index) => (
                <div
                  key={hood.name}
                  className="bg-zinc-800 rounded-xl p-4 hover:bg-zinc-750 transition-colors"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xl font-bold ${
                          index === 0 ? "text-yellow-500" : index === 1 ? "text-zinc-300" : index === 2 ? "text-orange-400" : "text-zinc-500"
                        }`}>
                          #{index + 1}
                        </span>
                        <h3 className="font-semibold text-lg">{hood.name}</h3>
                      </div>
                      <div className="text-sm text-zinc-500 mt-1">{hood.propertyCount} properties</div>
                    </div>
                    <div className={`px-4 py-2 rounded-xl border ${getScoreBg(hood.score)}`}>
                      <div className={`text-2xl font-bold ${getScoreColor(hood.score)}`}>{hood.score}</div>
                      <div className="text-xs text-zinc-400 text-center">Score</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="bg-zinc-900 rounded-lg p-3">
                      <div className="text-zinc-500 text-xs">Avg Damage Score</div>
                      <div className="font-bold text-lg mt-1">{hood.avgDamageScore}</div>
                    </div>
                    <div className="bg-zinc-900 rounded-lg p-3">
                      <div className="text-zinc-500 text-xs">Avg Roof Age</div>
                      <div className="font-bold text-lg mt-1">{hood.avgRoofAge} yrs</div>
                    </div>
                    <div className="bg-zinc-900 rounded-lg p-3">
                      <div className="text-zinc-500 text-xs">Total Opportunity</div>
                      <div className="font-bold text-lg mt-1 text-green-500">{formatCurrency(hood.totalOpportunityValue)}</div>
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button onClick={() => window.open("/dashboard/knock-list", "_self")} className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors">
                      Generate Knock List
                    </button>
                    <button onClick={() => window.open("/dashboard/storm-map", "_self")} className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm font-medium transition-colors">
                      View Map
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tags View */}
          {activeView === "tags" && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-3">
                {allTags.map((tag) => {
                  const count = leads.filter(l => l.tags.includes(tag)).length;
                  const avgScore = Math.round(
                    leads.filter(l => l.tags.includes(tag)).reduce((sum, l) => sum + l.damageScore, 0) / count
                  );
                  return (
                    <button
                      key={tag}
                      onClick={() => setFilterTag(filterTag === tag ? null : tag)}
                      className={`p-4 rounded-xl border transition-colors ${
                        filterTag === tag
                          ? "bg-blue-600/20 border-blue-500"
                          : "bg-zinc-800 border-zinc-700 hover:border-zinc-600"
                      }`}
                    >
                      <div className="text-lg mb-1">{tag}</div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-zinc-400">{count} leads</span>
                        <span className={getScoreColor(avgScore)}>Avg: {avgScore}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {filterTag && (
                <div className="mt-6">
                  <h3 className="font-semibold mb-3">Leads with "{filterTag}"</h3>
                  <div className="space-y-2">
                    {filteredLeads.map((lead) => (
                      <div key={lead.id} className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg">
                        <div>
                          <div className="font-medium">{lead.address}</div>
                          <div className="text-xs text-zinc-500">Rank #{lead.overallRank}</div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className={`font-bold ${getScoreColor(lead.damageScore)}`}>{lead.damageScore}</div>
                          <button onClick={() => {
                            const routeList = JSON.parse(localStorage.getItem("routeList") || "[]");
                            routeList.push({ address: lead.address, lat: lead.lat, lng: lead.lng });
                            localStorage.setItem("routeList", JSON.stringify(routeList));
                            alert(`Added ${lead.address} to route list!`);
                          }} className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-sm">
                            Add
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
