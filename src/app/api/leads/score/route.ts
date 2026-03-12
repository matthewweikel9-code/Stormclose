import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getHailReports, getStormReports, XweatherStormReport } from "@/lib/xweather";
import { getPropertyByLocation, calculateRoofAge, estimateClaimValue, CoreLogicProperty } from "@/lib/corelogic";

interface LeadFactors {
  hailSize: number;
  windSpeed: number;
  roofAge: number;
  roofType: string;
  propertyValue: number;
  stormProximity: number;
  roofSize: number;
  neighborhoodValue: number;
  insuranceLikelihood: number;
}

interface ScoredLead {
  id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
  damageScore: number;
  opportunityScore: number;
  overallRank: number;
  factors: LeadFactors;
  tags: string[];
  estimatedJobValue: number;
  claimProbability: number;
  ownerName?: string;
  yearBuilt?: number;
  squareFeet?: number;
  bedrooms?: number;
  bathrooms?: number;
  lotSize?: number;
  nearestStorm?: {
    type: string;
    hailSize: number;
    windSpeed: number;
    date: string;
    distance: number;
    location: string;
  };
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
  stormEvents: number;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get("lat") || "0");
  const lng = parseFloat(searchParams.get("lng") || "0");
  const radius = parseFloat(searchParams.get("radius") || "25");
  const limit = parseInt(searchParams.get("limit") || "50");
  const minScore = parseInt(searchParams.get("minScore") || "0");

  // Require valid coordinates
  if (lat === 0 && lng === 0) {
    return NextResponse.json({ 
      error: "Location required",
      message: "Please enable location services to find properties in your area",
      leads: [],
      neighborhoods: [],
    });
  }

  console.log("[LeadScore] Starting LIVE data search at", lat, lng, "radius", radius);

  try {
    // Step 1: Get REAL storm data from Xweather
    let stormReports: XweatherStormReport[] = [];
    let maxHailSize = 0;
    let maxWindSpeed = 0;
    let stormError: string | null = null;

    try {
      const [hailReports, allReports] = await Promise.all([
        getHailReports(lat, lng, radius, 30).catch((e) => { console.log("[LeadScore] Hail error:", e); return []; }),
        getStormReports(lat, lng, radius, 14).catch((e) => { console.log("[LeadScore] Storm error:", e); return []; }),
      ]);
      
      stormReports = [...hailReports, ...allReports];
      
      // Deduplicate storms by location
      const uniqueStorms: XweatherStormReport[] = [];
      const seen = new Set<string>();
      stormReports.forEach(report => {
        const key = `${report.loc.lat.toFixed(3)},${report.loc.long.toFixed(3)}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueStorms.push(report);
        }
      });
      stormReports = uniqueStorms;
      
      console.log("[LeadScore] Found", stormReports.length, "unique storm reports from Xweather");
      
      stormReports.forEach(report => {
        if (report.report.detail.hailIN && report.report.detail.hailIN > maxHailSize) {
          maxHailSize = report.report.detail.hailIN;
        }
        if (report.report.detail.windSpeedMPH && report.report.detail.windSpeedMPH > maxWindSpeed) {
          maxWindSpeed = report.report.detail.windSpeedMPH;
        }
      });
    } catch (e: any) {
      stormError = e.message || "Failed to fetch storm data";
      console.error("[LeadScore] Xweather error:", e);
    }

    // Step 2: Get REAL properties from CoreLogic
    let allProperties: CoreLogicProperty[] = [];
    let propertyError: string | null = null;
    
    try {
      // Build search points: user location + storm locations
      const searchPoints: { lat: number; lng: number }[] = [{ lat, lng }];
      
      // Add storm locations as additional search points for better coverage
      stormReports.slice(0, 5).forEach(storm => {
        searchPoints.push({ lat: storm.loc.lat, lng: storm.loc.long });
      });
      
      console.log("[LeadScore] Searching", searchPoints.length, "locations for properties");
      
      // Search each point with CoreLogic
      const propertySearches = searchPoints.map(point =>
        getPropertyByLocation(point.lat, point.lng, "0.5").catch((e: any) => {
          console.log("[LeadScore] CoreLogic search error at", point.lat, point.lng, ":", e.message);
          return [];
        })
      );
      
      const propertyResults = await Promise.all(propertySearches);
      
      // Combine and deduplicate by ID
      const seenIds = new Set<string>();
      propertyResults.flat().forEach(prop => {
        if (prop.id && 
            prop.address && 
            !seenIds.has(prop.id)) {
          seenIds.add(prop.id);
          allProperties.push(prop);
        }
      });
      
      console.log("[LeadScore] Found", allProperties.length, "unique properties from CoreLogic");
      
      if (allProperties.length === 0) {
        propertyError = "No properties found in this area";
      }
    } catch (e: any) {
      propertyError = e.message || "Failed to fetch property data";
      console.error("[LeadScore] CoreLogic error:", e);
    }

    // Step 3: Score ONLY real properties - NO fallback/demo data
    let leads: ScoredLead[] = [];
    
    if (allProperties.length > 0) {
      leads = scoreRealProperties(allProperties, stormReports, lat, lng, limit);
      leads = leads.filter(l => l.damageScore >= minScore);
    }

    // Generate neighborhood scores from real data only
    const neighborhoods = leads.length > 0 
      ? generateNeighborhoodScores(leads, stormReports) 
      : [];

    return NextResponse.json({
      leads,
      neighborhoods,
      stormData: {
        reportsFound: stormReports.length,
        maxHailSize,
        maxWindSpeed,
        searchRadius: radius,
      },
      propertyCount: allProperties.length,
      location: { lat, lng },
      errors: {
        storm: stormError,
        property: propertyError,
      },
      source: "live",
      generated_at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[LeadScore] Fatal error:", error);
    return NextResponse.json({ 
      error: "Failed to generate lead scores",
      message: error.message,
      leads: [],
      neighborhoods: [],
    }, { status: 500 });
  }
}

// Score REAL CoreLogic properties with REAL Xweather storm data
function scoreRealProperties(
  properties: CoreLogicProperty[],
  storms: XweatherStormReport[],
  centerLat: number,
  centerLng: number,
  limit: number
): ScoredLead[] {
  const leads: ScoredLead[] = [];

  properties.slice(0, limit).forEach((prop) => {
    const propLat = prop.lat || centerLat;
    const propLng = prop.lng || centerLng;
    
    // Skip properties without valid address
    if (!prop.address || prop.address.trim() === "") {
      return;
    }
    
    // Find nearest storm to this property
    const nearestStorm = findNearestStorm(propLat, propLng, storms);
    const roofAge = calculateRoofAge(prop);
    const claimEstimate = estimateClaimValue(prop);
    
    // Calculate roof size from building data (in roofing squares)
    const livingSize = prop.squareFootage || 0;
    const roofSize = Math.round(livingSize * 1.15 / 100); // 15% pitch factor, convert to squares
    
    // Get property value from assessment
    const propertyValue = prop.marketValue || prop.assessedValue || 0;

    const factors: LeadFactors = {
      hailSize: nearestStorm?.hailSize || 0,
      windSpeed: nearestStorm?.windSpeed || 0,
      roofAge,
      roofType: prop.roofType || "Unknown",
      propertyValue,
      stormProximity: nearestStorm?.distance || 999,
      roofSize: roofSize || 0,
      neighborhoodValue: propertyValue,
      insuranceLikelihood: calculateInsuranceLikelihood(prop, nearestStorm),
    };

    const damageScore = calculateDamageScore(factors);
    const opportunityScore = calculateOpportunityScore(factors);
    const tags = generateLeadTags(factors, damageScore);

    leads.push({
      id: prop.id || `prop-${leads.length}`,
      address: prop.address,
      city: prop.city || "",
      state: prop.state || "",
      zip: prop.zip || "",
      lat: propLat,
      lng: propLng,
      damageScore,
      opportunityScore,
      overallRank: 0,
      factors,
      tags,
      estimatedJobValue: claimEstimate.roofReplacement,
      claimProbability: calculateClaimProbability(factors, damageScore),
      ownerName: prop.owner,
      yearBuilt: prop.yearBuilt || undefined,
      squareFeet: livingSize || undefined,
      bedrooms: prop.bedrooms || undefined,
      bathrooms: prop.bathrooms || undefined,
      lotSize: prop.lotSize || undefined,
      nearestStorm: nearestStorm ? {
        type: nearestStorm.type,
        hailSize: nearestStorm.hailSize,
        windSpeed: nearestStorm.windSpeed,
        date: nearestStorm.date,
        distance: nearestStorm.distance,
        location: nearestStorm.location,
      } : undefined,
    });
  });

  // Sort by combined score and rank
  leads.sort((a, b) => (b.damageScore * 0.6 + b.opportunityScore * 0.4) - (a.damageScore * 0.6 + a.opportunityScore * 0.4));
  leads.forEach((lead, i) => { lead.overallRank = i + 1; });

  return leads;
}

// Find nearest storm to a property
function findNearestStorm(lat: number, lng: number, storms: XweatherStormReport[]): {
  type: string;
  hailSize: number;
  windSpeed: number;
  date: string;
  distance: number;
  location: string;
} | null {
  if (storms.length === 0) return null;

  let nearest = storms[0];
  let minDistance = calculateDistance(lat, lng, nearest.loc.lat, nearest.loc.long);

  storms.forEach(storm => {
    const dist = calculateDistance(lat, lng, storm.loc.lat, storm.loc.long);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = storm;
    }
  });

  return {
    type: nearest.report.cat,
    hailSize: nearest.report.detail.hailIN || 0,
    windSpeed: nearest.report.detail.windSpeedMPH || 0,
    date: nearest.report.dateTimeISO,
    distance: Math.round(minDistance * 10) / 10,
    location: `${nearest.place.name}, ${nearest.place.state}`,
  };
}

// Calculate distance in miles (Haversine formula)
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + 
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Calculate insurance claim likelihood based on real property data
function calculateInsuranceLikelihood(prop: CoreLogicProperty, storm: any): number {
  let likelihood = 50;
  
  const value = prop.marketValue || prop.assessedValue || 0;
  if (value > 500000) likelihood += 20;
  else if (value > 300000) likelihood += 15;
  else if (value > 200000) likelihood += 10;
  
  if (storm?.hailSize >= 2.0) likelihood += 20;
  else if (storm?.hailSize >= 1.5) likelihood += 15;
  else if (storm?.hailSize >= 1.0) likelihood += 10;
  
  const roofAge = calculateRoofAge(prop);
  if (roofAge > 20) likelihood += 15;
  else if (roofAge > 15) likelihood += 10;
  else if (roofAge > 10) likelihood += 5;
  
  return Math.min(100, likelihood);
}

function calculateDamageScore(factors: LeadFactors): number {
  let score = 0;

  if (factors.hailSize >= 2.5) score += 35;
  else if (factors.hailSize >= 2.0) score += 30;
  else if (factors.hailSize >= 1.5) score += 25;
  else if (factors.hailSize >= 1.0) score += 18;
  else if (factors.hailSize >= 0.75) score += 12;
  else if (factors.hailSize > 0) score += 5;

  if (factors.windSpeed >= 80) score += 25;
  else if (factors.windSpeed >= 70) score += 20;
  else if (factors.windSpeed >= 60) score += 15;
  else if (factors.windSpeed >= 50) score += 10;
  else if (factors.windSpeed > 0) score += 5;

  if (factors.roofAge >= 25) score += 25;
  else if (factors.roofAge >= 20) score += 22;
  else if (factors.roofAge >= 15) score += 18;
  else if (factors.roofAge >= 10) score += 12;
  else if (factors.roofAge > 0) score += 5;

  if (factors.stormProximity <= 1) score += 15;
  else if (factors.stormProximity <= 3) score += 12;
  else if (factors.stormProximity <= 5) score += 8;
  else if (factors.stormProximity <= 10) score += 5;
  else if (factors.stormProximity < 999) score += 2;

  return Math.min(100, Math.max(0, score));
}

function calculateOpportunityScore(factors: LeadFactors): number {
  let score = 0;

  if (factors.roofSize >= 40) score += 30;
  else if (factors.roofSize >= 30) score += 25;
  else if (factors.roofSize >= 25) score += 20;
  else if (factors.roofSize >= 20) score += 15;
  else if (factors.roofSize > 0) score += 10;

  if (factors.propertyValue >= 600000) score += 30;
  else if (factors.propertyValue >= 400000) score += 25;
  else if (factors.propertyValue >= 300000) score += 20;
  else if (factors.propertyValue >= 200000) score += 15;
  else if (factors.propertyValue > 0) score += 10;

  score += Math.round(factors.insuranceLikelihood * 0.4);

  return Math.min(100, Math.max(0, score));
}

function calculateClaimProbability(factors: LeadFactors, damageScore: number): number {
  return Math.min(100, Math.round(
    (damageScore * 0.4) + 
    (factors.insuranceLikelihood * 0.4) + 
    (factors.hailSize >= 1.5 ? 15 : factors.hailSize >= 1.0 ? 10 : 5) +
    (factors.roofAge > 15 ? 5 : 0)
  ));
}

function generateLeadTags(factors: LeadFactors, damageScore: number): string[] {
  const tags: string[] = [];

  if (factors.hailSize >= 2.0) tags.push("🧊 Large Hail (2\"+)");
  else if (factors.hailSize >= 1.5) tags.push("🧊 Significant Hail");
  else if (factors.hailSize >= 1.0) tags.push("🧊 Hail Damage Likely");
  
  if (factors.windSpeed >= 70) tags.push("💨 High Wind Damage");
  else if (factors.windSpeed >= 60) tags.push("💨 Wind Damage Likely");
  
  if (factors.roofAge >= 20) tags.push("🏚️ Aging Roof (20+ yrs)");
  else if (factors.roofAge >= 15) tags.push("🏠 Older Roof (15+ yrs)");
  
  if (factors.insuranceLikelihood >= 85) tags.push("📋 High Insurance Likelihood");
  if (factors.roofSize >= 35) tags.push("📐 Large Roof");
  if (factors.propertyValue >= 500000) tags.push("💰 High Value Property");
  if (factors.stormProximity <= 2) tags.push("⚡ Direct Storm Path");
  else if (factors.stormProximity <= 5) tags.push("🌧️ Storm Zone");
  
  if (damageScore >= 85) tags.push("🎯 Prime Candidate");
  if (damageScore >= 90 && factors.insuranceLikelihood >= 80) tags.push("🔥 Hot Lead");

  return tags;
}

function generateNeighborhoodScores(
  leads: ScoredLead[],
  storms: XweatherStormReport[]
): NeighborhoodScore[] {
  const cityGroups: Map<string, ScoredLead[]> = new Map();

  leads.forEach(lead => {
    const city = lead.city || "Unknown";
    if (!cityGroups.has(city)) {
      cityGroups.set(city, []);
    }
    cityGroups.get(city)!.push(lead);
  });

  const neighborhoods: NeighborhoodScore[] = [];

  cityGroups.forEach((cityLeads, cityName) => {
    if (cityLeads.length < 1) return;
    
    const avgLat = cityLeads.reduce((sum, l) => sum + l.lat, 0) / cityLeads.length;
    const avgLng = cityLeads.reduce((sum, l) => sum + l.lng, 0) / cityLeads.length;
    const avgDamageScore = Math.round(cityLeads.reduce((sum, l) => sum + l.damageScore, 0) / cityLeads.length);
    const avgRoofAge = Math.round(cityLeads.reduce((sum, l) => sum + l.factors.roofAge, 0) / cityLeads.length);
    const totalValue = cityLeads.reduce((sum, l) => sum + l.estimatedJobValue, 0);
    
    const nearbyStorms = storms.filter(s => 
      calculateDistance(avgLat, avgLng, s.loc.lat, s.loc.long) < 10
    ).length;

    neighborhoods.push({
      name: cityName,
      lat: avgLat,
      lng: avgLng,
      score: avgDamageScore,
      propertyCount: cityLeads.length,
      avgDamageScore,
      avgRoofAge,
      totalOpportunityValue: totalValue,
      stormEvents: nearbyStorms,
    });
  });

  return neighborhoods.sort((a, b) => b.score - a.score).slice(0, 10);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { lat, lng, radius } = body;

    if (!lat || !lng) {
      return NextResponse.json({ 
        error: "Location required",
        message: "Please provide lat and lng coordinates",
      }, { status: 400 });
    }

    const url = new URL(request.url);
    url.searchParams.set("lat", lat.toString());
    url.searchParams.set("lng", lng.toString());
    if (radius) url.searchParams.set("radius", radius.toString());

    return NextResponse.redirect(url.toString());
  } catch (error: any) {
    return NextResponse.json({ 
      error: "Invalid request",
      message: error.message,
    }, { status: 400 });
  }
}
