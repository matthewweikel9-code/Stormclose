import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getHailReports, getStormReports, XweatherStormReport } from "@/lib/xweather";
import { getPropertyByLocation, calculateRoofAge, estimateClaimValue, ATTOMProperty } from "@/lib/attom";

const ATTOM_API_KEY = process.env.ATTOM_API_KEY;

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
  nearestStorm?: {
    type: string;
    hailSize: number;
    date: string;
    distance: number;
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
  const lat = parseFloat(searchParams.get("lat") || "32.7767");
  const lng = parseFloat(searchParams.get("lng") || "-96.7970");
  const radius = parseFloat(searchParams.get("radius") || "25"); // miles
  const limit = parseInt(searchParams.get("limit") || "50");
  const minScore = parseInt(searchParams.get("minScore") || "0");

  try {
    console.log("[LeadScore] Starting search at", lat, lng, "radius", radius);
    
    // Step 1: Get real storm data from Xweather
    let stormReports: XweatherStormReport[] = [];
    let maxHailSize = 0;
    let maxWindSpeed = 0;

    try {
      const [hailReports, allReports] = await Promise.all([
        getHailReports(lat, lng, radius, 30).catch(() => []),
        getStormReports(lat, lng, radius, 14).catch(() => []),
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
      
      console.log("[LeadScore] Found", stormReports.length, "unique storm reports");
      
      // Find max hail and wind from real reports
      stormReports.forEach(report => {
        if (report.report.detail.hailIN && report.report.detail.hailIN > maxHailSize) {
          maxHailSize = report.report.detail.hailIN;
        }
        if (report.report.detail.windSpeedMPH && report.report.detail.windSpeedMPH > maxWindSpeed) {
          maxWindSpeed = report.report.detail.windSpeedMPH;
        }
      });
    } catch (e) {
      console.log("[LeadScore] Xweather error:", e);
    }

    // Step 2: Get real properties from ATTOM using multiple search points
    let allProperties: ATTOMProperty[] = [];
    
    if (ATTOM_API_KEY) {
      try {
        // Search at user's location and around storm locations
        const searchPoints: { lat: number; lng: number }[] = [
          { lat, lng }, // User's location
        ];
        
        // Add storm locations as search points
        stormReports.slice(0, 5).forEach(storm => {
          searchPoints.push({ lat: storm.loc.lat, lng: storm.loc.long });
        });
        
        // Search for properties at each point (ATTOM has a small radius limit)
        const propertySearches = searchPoints.map(point =>
          getPropertyByLocation(point.lat, point.lng, "1").catch(() => [])
        );
        
        const propertyResults = await Promise.all(propertySearches);
        
        // Combine and deduplicate by ATTOM ID
        const seen = new Set<number>();
        propertyResults.flat().forEach(prop => {
          if (prop.identifier?.attomId && !seen.has(prop.identifier.attomId)) {
            seen.add(prop.identifier.attomId);
            allProperties.push(prop);
          }
        });
        
        console.log("[LeadScore] Found", allProperties.length, "unique properties from ATTOM");
      } catch (e) {
        console.log("[LeadScore] ATTOM error:", e);
      }
    } else {
      console.log("[LeadScore] No ATTOM API key configured");
    }

    // Step 3: Score the leads
    let leads: ScoredLead[];
    let dataSource = { storms: "none", properties: "none" };
    
    if (allProperties.length > 0) {
      // We have real property data
      dataSource.properties = "attom";
      dataSource.storms = stormReports.length > 0 ? "xweather" : "estimated";
      leads = scoreRealProperties(allProperties, stormReports, lat, lng, limit);
    } else if (stormReports.length > 0) {
      // Storm data but no properties - this shouldn't happen often
      dataSource.storms = "xweather";
      dataSource.properties = "generated";
      leads = generateLeadsFromStorms(stormReports, lat, lng, limit);
    } else {
      // Fallback: demo mode
      dataSource.storms = "demo";
      dataSource.properties = "demo";
      leads = generateDemoLeads(lat, lng, limit);
    }

    // Filter by minimum score
    leads = leads.filter(l => l.damageScore >= minScore);

    // Generate neighborhood scores based on leads
    const neighborhoods = generateNeighborhoodScores(leads, stormReports, lat, lng);

    return NextResponse.json({
      leads,
      neighborhoods,
      stormData: {
        reportsFound: stormReports.length,
        maxHailSize,
        maxWindSpeed,
        searchRadius: radius,
      },
      source: dataSource,
      propertyCount: allProperties.length,
      location: { lat, lng },
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error generating lead scores:", error);
    return NextResponse.json({ error: "Failed to generate lead scores" }, { status: 500 });
  }
}

// Score real ATTOM properties against real Xweather storm data
function scoreRealProperties(
  properties: ATTOMProperty[],
  storms: XweatherStormReport[],
  centerLat: number,
  centerLng: number,
  limit: number
): ScoredLead[] {
  const leads: ScoredLead[] = [];

  properties.slice(0, limit).forEach((prop, index) => {
    const propLat = parseFloat(prop.location?.latitude) || centerLat;
    const propLng = parseFloat(prop.location?.longitude) || centerLng;
    
    // Find nearest storm to this property
    const nearestStorm = findNearestStorm(propLat, propLng, storms);
    const roofAge = calculateRoofAge(prop);
    const claimEstimate = estimateClaimValue(prop);
    
    // Build factors from real data
    const factors: LeadFactors = {
      hailSize: nearestStorm?.hailSize || 0,
      windSpeed: nearestStorm?.windSpeed || 0,
      roofAge,
      roofType: prop.building?.construction?.roofCover || "Asphalt Shingle",
      propertyValue: prop.assessment?.market?.mktTtlValue || prop.assessment?.assessed?.assdTtlValue || 250000,
      stormProximity: nearestStorm?.distance || 999,
      roofSize: Math.round((prop.building?.size?.livingSize || 2000) * 1.15 / 100),
      neighborhoodValue: prop.assessment?.market?.mktTtlValue || 300000,
      insuranceLikelihood: calculateInsuranceLikelihood(prop, nearestStorm),
    };

    const damageScore = calculateDamageScore(factors);
    const opportunityScore = calculateOpportunityScore(factors);
    const tags = generateLeadTags(factors, damageScore);

    leads.push({
      id: prop.identifier?.attomId?.toString() || `lead-${index}`,
      address: prop.address?.oneLine || "Unknown Address",
      lat: propLat,
      lng: propLng,
      damageScore,
      opportunityScore,
      overallRank: 0,
      factors,
      tags,
      estimatedJobValue: claimEstimate.roofReplacement,
      claimProbability: calculateClaimProbability(factors, damageScore),
      ownerName: prop.owner?.owner1?.fullName || "Unknown",
      yearBuilt: prop.summary?.yearbuilt,
      nearestStorm: nearestStorm ? {
        type: nearestStorm.type,
        hailSize: nearestStorm.hailSize,
        date: nearestStorm.date,
        distance: nearestStorm.distance,
      } : undefined,
    });
  });

  // Sort and rank
  leads.sort((a, b) => (b.damageScore * 0.6 + b.opportunityScore * 0.4) - (a.damageScore * 0.6 + a.opportunityScore * 0.4));
  leads.forEach((lead, i) => { lead.overallRank = i + 1; });

  return leads;
}

// Generate leads from storm locations when ATTOM is unavailable
function generateLeadsFromStorms(
  storms: XweatherStormReport[],
  centerLat: number,
  centerLng: number,
  limit: number
): ScoredLead[] {
  const leads: ScoredLead[] = [];
  const streets = ["Oak", "Maple", "Cedar", "Pine", "Elm", "Main", "Park", "Ridge"];
  const types = ["St", "Ave", "Dr", "Blvd", "Ln"];

  // Generate properties near each storm
  storms.slice(0, 10).forEach((storm, stormIndex) => {
    const numProps = Math.min(Math.ceil(limit / Math.min(storms.length, 10)), 10);
    
    for (let i = 0; i < numProps; i++) {
      const seed = Date.now() + stormIndex * 100 + i;
      const offsetLat = (Math.random() - 0.5) * 0.05;
      const offsetLng = (Math.random() - 0.5) * 0.05;
      const propLat = storm.loc.lat + offsetLat;
      const propLng = storm.loc.long + offsetLng;
      
      const distance = calculateDistance(propLat, propLng, storm.loc.lat, storm.loc.long);
      const roofAge = 5 + Math.floor(Math.random() * 25);
      const roofSize = 15 + Math.floor(Math.random() * 40);
      const propertyValue = 150000 + Math.floor(Math.random() * 600000);

      const factors: LeadFactors = {
        hailSize: storm.report.detail.hailIN || 0,
        windSpeed: storm.report.detail.windSpeedMPH || 0,
        roofAge,
        roofType: "Asphalt Shingle",
        propertyValue,
        stormProximity: distance,
        roofSize,
        neighborhoodValue: propertyValue * 0.95,
        insuranceLikelihood: 60 + Math.floor(Math.random() * 35),
      };

      const damageScore = calculateDamageScore(factors);
      const opportunityScore = calculateOpportunityScore(factors);

      leads.push({
        id: `storm-lead-${seed}`,
        address: `${1000 + (seed % 9000)} ${streets[seed % streets.length]} ${types[seed % types.length]}, ${storm.place.name}, ${storm.place.state}`,
        lat: propLat,
        lng: propLng,
        damageScore,
        opportunityScore,
        overallRank: 0,
        factors,
        tags: generateLeadTags(factors, damageScore),
        estimatedJobValue: roofSize * 400 + (damageScore * 50),
        claimProbability: calculateClaimProbability(factors, damageScore),
        nearestStorm: {
          type: storm.report.cat,
          hailSize: storm.report.detail.hailIN || 0,
          date: storm.report.dateTimeISO,
          distance,
        },
      });
    }
  });

  // Sort and rank
  leads.sort((a, b) => (b.damageScore * 0.6 + b.opportunityScore * 0.4) - (a.damageScore * 0.6 + a.opportunityScore * 0.4));
  leads.forEach((lead, i) => { lead.overallRank = i + 1; });

  return leads.slice(0, limit);
}

// Demo mode when no real data available - uses realistic varied data
function generateDemoLeads(lat: number, lng: number, limit: number): ScoredLead[] {
  const leads: ScoredLead[] = [];
  
  // Create varied realistic demo addresses
  const demoProperties = [
    { street: "2847 Oak Ridge Dr", city: "Highland Park", yearBuilt: 1998, sqft: 2800, value: 425000 },
    { street: "1523 Maple Valley Ln", city: "University Park", yearBuilt: 2005, sqft: 3200, value: 520000 },
    { street: "4201 Cedar Creek Blvd", city: "Preston Hollow", yearBuilt: 1992, sqft: 2400, value: 385000 },
    { street: "876 Pine Hill Way", city: "Lake Highlands", yearBuilt: 2010, sqft: 2650, value: 445000 },
    { street: "3159 Elm Grove St", city: "Lakewood", yearBuilt: 1985, sqft: 2100, value: 295000 },
    { street: "5502 Willow Park Ave", city: "East Dallas", yearBuilt: 2001, sqft: 2900, value: 475000 },
    { street: "1089 Birch Lane Ct", city: "Richardson", yearBuilt: 1995, sqft: 2300, value: 355000 },
    { street: "7734 Magnolia Heights Dr", city: "Plano", yearBuilt: 2008, sqft: 3400, value: 585000 },
    { street: "2201 Aspen Ridge Rd", city: "Frisco", yearBuilt: 2015, sqft: 3100, value: 550000 },
    { street: "445 Sycamore Valley Blvd", city: "McKinney", yearBuilt: 2003, sqft: 2750, value: 465000 },
    { street: "6612 Hickory Woods Ln", city: "Allen", yearBuilt: 1999, sqft: 2500, value: 405000 },
    { street: "3378 Walnut Creek Dr", city: "Carrollton", yearBuilt: 1988, sqft: 2200, value: 325000 },
    { street: "9901 Pecan Grove Ave", city: "Irving", yearBuilt: 2007, sqft: 2850, value: 485000 },
    { street: "1847 Redwood Terrace", city: "Garland", yearBuilt: 1994, sqft: 2050, value: 275000 },
    { street: "5523 Cypress Point Way", city: "Mesquite", yearBuilt: 2000, sqft: 2350, value: 315000 },
  ];

  const currentYear = new Date().getFullYear();

  for (let i = 0; i < Math.min(limit, demoProperties.length); i++) {
    const prop = demoProperties[i];
    const roofAge = currentYear - prop.yearBuilt;
    const roofSize = Math.round(prop.sqft * 1.15 / 100); // Convert to roofing squares
    const hailSize = Math.round((1.0 + Math.random() * 1.5) * 10) / 10;

    const factors: LeadFactors = {
      hailSize,
      windSpeed: 55 + Math.floor(Math.random() * 30),
      roofAge,
      roofType: "Asphalt Shingle",
      propertyValue: prop.value,
      stormProximity: 2 + Math.random() * 8,
      roofSize,
      neighborhoodValue: prop.value * 0.95,
      insuranceLikelihood: 65 + Math.floor(Math.random() * 30),
    };

    const damageScore = calculateDamageScore(factors);
    const opportunityScore = calculateOpportunityScore(factors);

    leads.push({
      id: `demo-${i + 1}`,
      address: `${prop.street}, ${prop.city}, TX`,
      lat: lat + (Math.random() - 0.5) * 0.08,
      lng: lng + (Math.random() - 0.5) * 0.08,
      damageScore,
      opportunityScore,
      overallRank: 0,
      factors,
      tags: generateLeadTags(factors, damageScore),
      estimatedJobValue: roofSize * 450, // $450 per square average
      claimProbability: calculateClaimProbability(factors, damageScore),
      yearBuilt: prop.yearBuilt,
    });
  }

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
  };
}

// Calculate distance in miles
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Calculate insurance likelihood based on property and storm
function calculateInsuranceLikelihood(prop: ATTOMProperty, storm: any): number {
  let likelihood = 60;
  
  const value = prop.assessment?.market?.mktTtlValue || 0;
  if (value > 400000) likelihood += 15;
  else if (value > 250000) likelihood += 10;
  
  if (storm && storm.hailSize >= 1.5) likelihood += 15;
  else if (storm && storm.hailSize >= 1.0) likelihood += 10;
  
  const roofAge = calculateRoofAge(prop);
  if (roofAge > 15) likelihood += 10;
  
  return Math.min(100, likelihood);
}

function calculateDamageScore(factors: LeadFactors): number {
  let score = 0;

  // Hail size (0-35 points) - most important factor
  if (factors.hailSize >= 2.5) score += 35;
  else if (factors.hailSize >= 2.0) score += 30;
  else if (factors.hailSize >= 1.5) score += 25;
  else if (factors.hailSize >= 1.0) score += 18;
  else if (factors.hailSize >= 0.5) score += 10;
  else score += 3;

  // Wind speed (0-25 points)
  if (factors.windSpeed >= 80) score += 25;
  else if (factors.windSpeed >= 70) score += 20;
  else if (factors.windSpeed >= 60) score += 15;
  else if (factors.windSpeed >= 50) score += 10;
  else score += 5;

  // Roof age (0-25 points)
  if (factors.roofAge >= 20) score += 25;
  else if (factors.roofAge >= 15) score += 20;
  else if (factors.roofAge >= 10) score += 15;
  else score += 8;

  // Storm proximity (0-15 points)
  if (factors.stormProximity <= 1) score += 15;
  else if (factors.stormProximity <= 3) score += 12;
  else if (factors.stormProximity <= 5) score += 8;
  else if (factors.stormProximity <= 10) score += 5;
  else score += 2;

  return Math.min(100, Math.max(0, score));
}

function calculateOpportunityScore(factors: LeadFactors): number {
  let score = 0;

  // Roof size (0-25)
  if (factors.roofSize >= 40) score += 25;
  else if (factors.roofSize >= 30) score += 20;
  else if (factors.roofSize >= 20) score += 15;
  else score += 10;

  // Property value (0-25)
  if (factors.propertyValue >= 500000) score += 25;
  else if (factors.propertyValue >= 350000) score += 20;
  else if (factors.propertyValue >= 250000) score += 15;
  else score += 10;

  // Neighborhood value (0-25)
  if (factors.neighborhoodValue >= 450000) score += 25;
  else if (factors.neighborhoodValue >= 350000) score += 20;
  else if (factors.neighborhoodValue >= 250000) score += 15;
  else score += 10;

  // Insurance likelihood (0-25)
  score += Math.round(factors.insuranceLikelihood * 0.25);

  return Math.min(100, Math.max(0, score));
}

function calculateClaimProbability(factors: LeadFactors, damageScore: number): number {
  return Math.min(100, Math.round(
    (damageScore * 0.5) + 
    (factors.insuranceLikelihood * 0.3) + 
    (Math.min(20, factors.roofAge) * 0.5) + 
    (factors.hailSize >= 1.5 ? 15 : factors.hailSize >= 1.0 ? 10 : 5)
  ));
}

function generateLeadTags(factors: LeadFactors, damageScore: number): string[] {
  const tags: string[] = [];

  if (factors.hailSize >= 2.0) tags.push("🧊 High Hail Risk");
  else if (factors.hailSize >= 1.0) tags.push("🧊 Hail Damage Likely");
  
  if (factors.roofAge >= 20) tags.push("🏚️ Old Roof");
  else if (factors.roofAge >= 15) tags.push("🏠 Aging Roof");
  
  if (factors.insuranceLikelihood >= 85) tags.push("📋 High Insurance Likelihood");
  if (factors.roofSize >= 35) tags.push("📐 Large Roof");
  if (factors.propertyValue >= 400000) tags.push("💰 High Value Property");
  if (factors.stormProximity <= 2) tags.push("⚡ Direct Storm Impact");
  else if (factors.stormProximity <= 5) tags.push("🌧️ Storm Zone");
  
  if (damageScore >= 85) tags.push("🎯 Prime Candidate");
  if (damageScore >= 90 && factors.insuranceLikelihood >= 80) tags.push("🔥 Hot Lead");

  return tags;
}

function generateNeighborhoodScores(
  leads: ScoredLead[],
  storms: XweatherStormReport[],
  centerLat: number,
  centerLng: number
): NeighborhoodScore[] {
  // Group leads by approximate neighborhood (grid cells)
  const gridSize = 0.02; // ~1.4 miles
  const neighborhoods: Map<string, ScoredLead[]> = new Map();

  leads.forEach(lead => {
    const gridLat = Math.floor(lead.lat / gridSize) * gridSize;
    const gridLng = Math.floor(lead.lng / gridSize) * gridSize;
    const key = `${gridLat.toFixed(3)},${gridLng.toFixed(3)}`;
    
    if (!neighborhoods.has(key)) {
      neighborhoods.set(key, []);
    }
    neighborhoods.get(key)!.push(lead);
  });

  // Generate neighborhood scores
  const result: NeighborhoodScore[] = [];
  let index = 0;

  neighborhoods.forEach((groupLeads, key) => {
    if (groupLeads.length < 2) return; // Skip single-property "neighborhoods"
    
    const [latStr, lngStr] = key.split(",");
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);
    
    const avgDamageScore = Math.round(groupLeads.reduce((sum, l) => sum + l.damageScore, 0) / groupLeads.length);
    const avgRoofAge = Math.round(groupLeads.reduce((sum, l) => sum + l.factors.roofAge, 0) / groupLeads.length);
    const totalValue = groupLeads.reduce((sum, l) => sum + l.estimatedJobValue, 0);
    
    // Count storms in this neighborhood
    const nearbyStorms = storms.filter(s => 
      calculateDistance(lat, lng, s.loc.lat, s.loc.long) < 3
    ).length;

    result.push({
      name: `Area ${index + 1}`,
      lat: lat + gridSize / 2,
      lng: lng + gridSize / 2,
      score: avgDamageScore,
      propertyCount: groupLeads.length,
      avgDamageScore,
      avgRoofAge,
      totalOpportunityValue: totalValue,
      stormEvents: nearbyStorms,
    });
    
    index++;
  });

  return result.sort((a, b) => b.score - a.score).slice(0, 10);
}

// POST endpoint to trigger lead scoring for a specific area
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { lat, lng, radius } = body;

    // Redirect to GET with params
    const url = new URL(request.url);
    url.searchParams.set("lat", lat.toString());
    url.searchParams.set("lng", lng.toString());
    url.searchParams.set("radius", radius?.toString() || "25");

    return NextResponse.json({
      status: "scoring_started",
      message: "Redirecting to lead scoring with location",
      redirectUrl: `/api/leads/score?lat=${lat}&lng=${lng}&radius=${radius || 25}`,
    });
  } catch (error) {
    console.error("Error starting lead scoring:", error);
    return NextResponse.json({ error: "Failed to start lead scoring" }, { status: 500 });
  }
}
