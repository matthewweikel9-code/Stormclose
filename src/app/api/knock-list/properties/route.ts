import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get("lat") || "32.7767");
  const lng = parseFloat(searchParams.get("lng") || "-96.7970");
  const radius = parseFloat(searchParams.get("radius") || "10"); // miles

  try {
    // In production, this would query a property database
    // using PostGIS for geospatial queries
    const properties = generatePropertiesInRadius(lat, lng, radius, 100);

    return NextResponse.json({ properties });
  } catch (error) {
    console.error("Error fetching properties:", error);
    return NextResponse.json({ error: "Failed to fetch properties" }, { status: 500 });
  }
}

function generatePropertiesInRadius(
  centerLat: number,
  centerLng: number,
  radius: number,
  count: number
) {
  const properties = [];
  const streets = ["Oak", "Maple", "Cedar", "Pine", "Elm", "Main", "Park", "Lake", "Ridge", "Valley"];
  const types = ["St", "Ave", "Dr", "Blvd", "Ln", "Way"];
  const cities = ["Dallas", "Plano", "Frisco", "McKinney", "Allen", "Richardson"];

  for (let i = 0; i < count; i++) {
    // Generate random position within radius
    const angle = Math.random() * 2 * Math.PI;
    const distance = Math.sqrt(Math.random()) * radius; // sqrt for uniform distribution
    
    // Approximate degrees per mile
    const latOffset = (distance * Math.cos(angle)) / 69;
    const lngOffset = (distance * Math.sin(angle)) / 54; // ~54 miles per degree at ~35° lat

    const seed = Date.now() + i;
    const damageScore = Math.round(40 + Math.random() * 60);
    const roofAge = Math.round(5 + Math.random() * 25);
    const roofSize = Math.round(15 + Math.random() * 40);

    properties.push({
      id: `prop-${seed}`,
      address: `${1000 + (seed % 9000)} ${streets[seed % streets.length]} ${types[seed % types.length]}, ${cities[seed % cities.length]} TX`,
      lat: centerLat + latOffset,
      lng: centerLng + lngOffset,
      damageScore,
      roofAge,
      roofSize,
      propertyValue: Math.round(150000 + Math.random() * 850000),
      stormSeverity: Math.round(30 + Math.random() * 70),
      estimatedJobValue: Math.round(roofSize * 400 + damageScore * 50),
      distance: Math.round(distance * 10) / 10,
      selected: false,
    });
  }

  // Sort by damage score
  return properties.sort((a, b) => b.damageScore - a.damageScore);
}

// POST - Save a knock list
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, properties, centerLocation, filters } = body;

    const { data, error } = await supabase
      .from("knock_lists")
      .insert({
        user_id: user.id,
        name,
        properties,
        center_lat: centerLocation?.lat,
        center_lng: centerLocation?.lng,
        filters,
        property_count: properties.length,
        total_estimated_value: properties.reduce((sum: number, p: { estimatedJobValue: number }) => sum + p.estimatedJobValue, 0),
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ knockList: data });
  } catch (error) {
    console.error("Error saving knock list:", error);
    return NextResponse.json({ error: "Failed to save knock list" }, { status: 500 });
  }
}
