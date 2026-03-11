import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const parcelId = searchParams.get("parcelId");

  if (!address && !lat && !parcelId) {
    return NextResponse.json({ error: "Address, coordinates, or parcel ID required" }, { status: 400 });
  }

  try {
    // In production, this would call property data APIs like:
    // - ATTOM Data
    // - CoreLogic
    // - Black Knight
    // - LightBox
    // - Regrid
    // - County assessor APIs

    // Check cache first
    const cacheKey = address || parcelId || `${lat},${lng}`;
    const { data: cached } = await supabase
      .from("property_cache")
      .select("*")
      .eq("cache_key", cacheKey)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (cached) {
      return NextResponse.json(cached.data);
    }

    // Geocode address if needed
    let coords = { lat: parseFloat(lat || "0"), lng: parseFloat(lng || "0") };
    if (address && !lat) {
      const geocodeResult = await geocodeAddress(address);
      if (geocodeResult) {
        coords = geocodeResult;
      }
    }

    // Fetch property data from multiple sources
    const propertyData = await fetchPropertyData(address || "", coords);

    // Cache the result
    await supabase.from("property_cache").upsert({
      cache_key: cacheKey,
      data: propertyData,
      expires_at: new Date(Date.now() + 86400000).toISOString(), // 24 hours
    });

    // Log the lookup
    await supabase.from("property_lookups").insert({
      user_id: user.id,
      address: propertyData.address,
      lat: coords.lat,
      lng: coords.lng,
    });

    return NextResponse.json(propertyData);
  } catch (error) {
    console.error("Error looking up property:", error);
    return NextResponse.json({ error: "Failed to lookup property" }, { status: 500 });
  }
}

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    // Use OpenStreetMap Nominatim (free) or Google Maps Geocoding API
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`,
      { headers: { "User-Agent": "StormAI/1.0" } }
    );

    if (response.ok) {
      const data = await response.json();
      if (data.length > 0) {
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      }
    }
  } catch (error) {
    console.error("Geocoding error:", error);
  }
  return null;
}

async function fetchPropertyData(address: string, coords: { lat: number; lng: number }) {
  // In production, aggregate data from multiple property data APIs
  // For now, return structured demo data

  // Parse address components
  const addressParts = address.split(",").map(s => s.trim());
  const streetAddress = addressParts[0] || "Unknown";
  const cityState = addressParts.slice(1).join(", ") || "Unknown";

  // Generate consistent demo data based on address hash
  const hash = address.split("").reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0);
  const seed = Math.abs(hash);

  const yearBuilt = 1980 + (seed % 44); // 1980-2024
  const roofAge = 2024 - yearBuilt > 25 ? (seed % 15) + 5 : 2024 - yearBuilt;
  const propertyValue = 150000 + (seed % 850000);
  const squareFootage = 1200 + (seed % 3800);
  const lotSize = squareFootage * 2 + (seed % 5000);

  const roofTypes = ["Gable", "Hip", "Flat", "Mansard", "Gambrel"];
  const roofMaterials = ["Asphalt Shingle", "Metal", "Tile", "Slate", "Wood Shake"];
  const buildingTypes = ["Single Family", "Multi-Family", "Townhouse", "Condo"];
  const complexities: ("simple" | "moderate" | "complex")[] = ["simple", "moderate", "complex"];
  const conditions: ("excellent" | "good" | "fair" | "poor")[] = ["excellent", "good", "fair", "poor"];

  // Calculate condition based on roof age
  const conditionIndex = roofAge < 10 ? 0 : roofAge < 15 ? 1 : roofAge < 20 ? 2 : 3;

  // Generate owner name
  const firstNames = ["John", "Jane", "Robert", "Mary", "David", "Sarah", "Michael", "Lisa"];
  const lastNames = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis"];
  const ownerName = `${firstNames[seed % firstNames.length]} ${lastNames[(seed >> 4) % lastNames.length]}`;

  return {
    address: address || `${streetAddress}, ${cityState}`,
    lat: coords.lat || 32.7767 + (seed % 100) / 1000,
    lng: coords.lng || -96.7970 + (seed % 100) / 1000,
    owner: {
      name: ownerName,
      mailingAddress: address,
    },
    property: {
      value: propertyValue,
      yearBuilt,
      squareFootage,
      lotSize,
      buildingType: buildingTypes[seed % buildingTypes.length],
      bedrooms: 2 + (seed % 5),
      bathrooms: 1 + (seed % 4),
    },
    roof: {
      type: roofTypes[seed % roofTypes.length],
      material: roofMaterials[(seed >> 2) % roofMaterials.length],
      age: roofAge,
      complexity: complexities[(seed >> 3) % complexities.length],
      condition: conditions[conditionIndex],
      squareFootage: Math.round(squareFootage * (1.1 + (seed % 30) / 100)),
      pitch: 4 + (seed % 9),
    },
    parcel: {
      id: `PAR-${(seed % 100000).toString().padStart(6, "0")}`,
      boundaries: [
        { lat: coords.lat + 0.0003, lng: coords.lng - 0.0003 },
        { lat: coords.lat + 0.0003, lng: coords.lng + 0.0003 },
        { lat: coords.lat - 0.0003, lng: coords.lng + 0.0003 },
        { lat: coords.lat - 0.0003, lng: coords.lng - 0.0003 },
      ],
      dimensions: {
        width: 50 + (seed % 50),
        length: 80 + (seed % 70),
      },
    },
    history: {
      lastSale: {
        date: `${2015 + (seed % 9)}-${String(1 + (seed % 12)).padStart(2, "0")}-${String(1 + (seed % 28)).padStart(2, "0")}`,
        price: Math.round(propertyValue * (0.7 + (seed % 20) / 100)),
      },
      mortgageEstimate: Math.round(propertyValue * (0.5 + (seed % 30) / 100)),
      permits: generatePermits(seed),
    },
    neighborhood: {
      avgHomeValue: Math.round(propertyValue * (0.9 + (seed % 20) / 100)),
      avgRoofAge: 10 + (seed % 15),
      claimLikelihood: 40 + (seed % 50),
    },
    stormExposure: {
      hailEvents: 1 + (seed % 5),
      maxHailSize: 0.75 + (seed % 200) / 100,
      windEvents: 2 + (seed % 6),
      maxWindSpeed: 45 + (seed % 40),
      lastStormDate: new Date(Date.now() - (seed % 365) * 86400000).toISOString().split("T")[0],
    },
  };
}

function generatePermits(seed: number): { date: string; type: string; value?: number }[] {
  const permitTypes = [
    { type: "Roof Replacement", value: 8000 + (seed % 12000) },
    { type: "HVAC Replacement", value: 5000 + (seed % 8000) },
    { type: "Electrical Update", value: 2000 + (seed % 5000) },
    { type: "Plumbing Repair", value: 1500 + (seed % 3000) },
    { type: "Deck Addition", value: 5000 + (seed % 15000) },
    { type: "Window Replacement", value: 3000 + (seed % 7000) },
  ];

  const numPermits = seed % 4;
  const permits: { date: string; type: string; value?: number }[] = [];

  for (let i = 0; i < numPermits; i++) {
    const permit = permitTypes[(seed + i) % permitTypes.length];
    const year = 2018 + (seed % 6);
    permits.push({
      date: `${year}-${String(1 + ((seed + i) % 12)).padStart(2, "0")}-${String(1 + ((seed + i * 7) % 28)).padStart(2, "0")}`,
      type: permit.type,
      value: permit.value,
    });
  }

  return permits;
}
