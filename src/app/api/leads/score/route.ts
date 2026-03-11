import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const stormId = searchParams.get("stormId");
  const neighborhood = searchParams.get("neighborhood");
  const limit = parseInt(searchParams.get("limit") || "50");
  const minScore = parseInt(searchParams.get("minScore") || "0");

  try {
    // In production, this would:
    // 1. Fetch recent storm data
    // 2. Get properties in affected areas
    // 3. Pull property data for each
    // 4. Run AI scoring algorithm
    // 5. Return ranked leads

    // For now, generate scored leads
    const leads = await generateScoredLeads(limit, minScore, stormId, neighborhood);
    const neighborhoods = await generateNeighborhoodScores();

    // Cache results
    const cacheTable = supabase.from("lead_score_cache") as any;
    await cacheTable.upsert({
      user_id: user.id,
      cache_key: `leads_${stormId || "all"}_${neighborhood || "all"}`,
      leads,
      neighborhoods,
      generated_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour
    });

    return NextResponse.json({
      leads,
      neighborhoods,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error generating lead scores:", error);
    return NextResponse.json({ error: "Failed to generate lead scores" }, { status: 500 });
  }
}

async function generateScoredLeads(
  limit: number,
  minScore: number,
  stormId?: string | null,
  neighborhood?: string | null
): Promise<ScoredLead[]> {
  const leads: ScoredLead[] = [];
  
  const streets = ["Oak", "Maple", "Cedar", "Pine", "Elm", "Main", "Park", "Lake", "Ridge", "Valley", "Hill", "Creek"];
  const types = ["St", "Ave", "Dr", "Blvd", "Ln", "Way", "Ct", "Pl"];
  const cities = ["Dallas", "Plano", "Frisco", "McKinney", "Allen", "Richardson", "Garland", "Irving"];
  const roofTypes = ["Asphalt Shingle", "Metal", "Tile", "Slate", "Wood Shake"];

  for (let i = 0; i < limit; i++) {
    const seed = Date.now() + i;
    
    // Generate factors
    const factors: LeadFactors = {
      hailSize: Math.round((1.0 + Math.random() * 2.5) * 10) / 10, // 1.0 - 3.5"
      windSpeed: Math.round(50 + Math.random() * 50), // 50-100 mph
      roofAge: Math.round(5 + Math.random() * 25), // 5-30 years
      roofType: roofTypes[Math.floor(Math.random() * roofTypes.length)],
      propertyValue: Math.round(150000 + Math.random() * 800000),
      stormProximity: Math.round((0.1 + Math.random() * 10) * 10) / 10, // 0.1-10 miles
      roofSize: Math.round(15 + Math.random() * 40), // 15-55 squares
      neighborhoodValue: Math.round(200000 + Math.random() * 600000),
      insuranceLikelihood: Math.round(50 + Math.random() * 50), // 50-100%
    };

    // Calculate damage score (0-100)
    const damageScore = calculateDamageScore(factors);

    // Calculate opportunity score (0-100)
    const opportunityScore = calculateOpportunityScore(factors);

    // Generate tags
    const tags = generateLeadTags(factors, damageScore);

    // Calculate estimated job value
    const estimatedJobValue = Math.round(factors.roofSize * 400 * (1 + (factors.propertyValue / 1000000)));

    // Calculate claim probability
    const claimProbability = Math.min(100, Math.round(
      (damageScore * 0.5) + (factors.insuranceLikelihood * 0.3) + ((30 - factors.roofAge) * 0.5) + 20
    ));

    if (damageScore >= minScore) {
      leads.push({
        id: `lead-${seed}`,
        address: `${1000 + (seed % 9000)} ${streets[seed % streets.length]} ${types[seed % types.length]}, ${cities[seed % cities.length]} TX`,
        lat: 32.7 + Math.random() * 0.3,
        lng: -96.9 + Math.random() * 0.3,
        damageScore,
        opportunityScore,
        overallRank: 0, // Will be set after sorting
        factors,
        tags,
        estimatedJobValue,
        claimProbability,
      });
    }
  }

  // Sort by combined score and assign ranks
  leads.sort((a, b) => (b.damageScore * 0.6 + b.opportunityScore * 0.4) - (a.damageScore * 0.6 + a.opportunityScore * 0.4));
  leads.forEach((lead, index) => {
    lead.overallRank = index + 1;
  });

  return leads;
}

function calculateDamageScore(factors: LeadFactors): number {
  let score = 0;

  // Hail size impact (0-30 points)
  if (factors.hailSize >= 2.5) score += 30;
  else if (factors.hailSize >= 2.0) score += 25;
  else if (factors.hailSize >= 1.5) score += 20;
  else if (factors.hailSize >= 1.0) score += 15;
  else score += 5;

  // Wind speed impact (0-25 points)
  if (factors.windSpeed >= 80) score += 25;
  else if (factors.windSpeed >= 70) score += 20;
  else if (factors.windSpeed >= 60) score += 15;
  else score += 8;

  // Roof age impact (0-25 points)
  if (factors.roofAge >= 20) score += 25;
  else if (factors.roofAge >= 15) score += 20;
  else if (factors.roofAge >= 10) score += 15;
  else score += 8;

  // Storm proximity impact (0-20 points)
  if (factors.stormProximity <= 1) score += 20;
  else if (factors.stormProximity <= 3) score += 15;
  else if (factors.stormProximity <= 5) score += 10;
  else score += 5;

  return Math.min(100, Math.max(0, score));
}

function calculateOpportunityScore(factors: LeadFactors): number {
  let score = 0;

  // Roof size impact (0-25 points)
  if (factors.roofSize >= 40) score += 25;
  else if (factors.roofSize >= 30) score += 20;
  else if (factors.roofSize >= 20) score += 15;
  else score += 10;

  // Property value impact (0-25 points)
  if (factors.propertyValue >= 500000) score += 25;
  else if (factors.propertyValue >= 350000) score += 20;
  else if (factors.propertyValue >= 250000) score += 15;
  else score += 10;

  // Neighborhood value impact (0-25 points)
  if (factors.neighborhoodValue >= 450000) score += 25;
  else if (factors.neighborhoodValue >= 350000) score += 20;
  else if (factors.neighborhoodValue >= 250000) score += 15;
  else score += 10;

  // Insurance likelihood (0-25 points)
  score += Math.round(factors.insuranceLikelihood * 0.25);

  return Math.min(100, Math.max(0, score));
}

function generateLeadTags(factors: LeadFactors, damageScore: number): string[] {
  const tags: string[] = [];

  if (factors.hailSize >= 2.0) tags.push("🧊 High Hail Risk");
  if (factors.roofAge >= 15) tags.push("🏚️ Old Roof");
  if (factors.insuranceLikelihood >= 80) tags.push("📋 High Insurance Likelihood");
  if (factors.roofSize >= 35) tags.push("📐 Large Roof");
  if (factors.propertyValue >= 400000) tags.push("💰 High Value Property");
  if (factors.stormProximity <= 2) tags.push("⚡ Recent Storm Impact");
  if (damageScore >= 85) tags.push("🎯 Prime Candidate");
  if (damageScore >= 90 && factors.insuranceLikelihood >= 85) tags.push("🔥 Hot Lead");

  return tags;
}

async function generateNeighborhoodScores() {
  const neighborhoods = [
    { name: "Highland Park", lat: 32.8312, lng: -96.7992 },
    { name: "University Park", lat: 32.8507, lng: -96.7888 },
    { name: "Preston Hollow", lat: 32.8712, lng: -96.8122 },
    { name: "Lake Highlands", lat: 32.8888, lng: -96.7234 },
    { name: "Lakewood", lat: 32.8123, lng: -96.7456 },
    { name: "M Streets", lat: 32.8234, lng: -96.7678 },
    { name: "Oak Lawn", lat: 32.8089, lng: -96.8156 },
    { name: "Uptown", lat: 32.8012, lng: -96.8034 },
  ];

  return neighborhoods.map((n, i) => {
    const seed = n.name.length * 17 + i;
    return {
      ...n,
      score: Math.max(50, 100 - i * 5 - (seed % 10)),
      propertyCount: 100 + (seed % 200),
      avgDamageScore: Math.max(50, 95 - i * 5 - (seed % 15)),
      avgRoofAge: 10 + (seed % 15),
      totalOpportunityValue: (1500000 + (seed % 2500000)),
    };
  });
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
    const { lat, lng, radius, stormId } = body;

    // In production, this would trigger a background job to:
    // 1. Fetch all properties within radius
    // 2. Get storm data for the area
    // 3. Score each property
    // 4. Store results in database

    return NextResponse.json({
      status: "scoring_started",
      message: "Lead scoring job started. Results will be available shortly.",
      jobId: `job-${Date.now()}`,
    });
  } catch (error) {
    console.error("Error starting lead scoring:", error);
    return NextResponse.json({ error: "Failed to start lead scoring" }, { status: 500 });
  }
}
