import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getPropertyByAddress,
  getPropertyByLocation,
  calculateRoofAge,
  estimateClaimValue,
  CoreLogicProperty,
  CoreLogicError,
} from "@/lib/corelogic";
import { verifyHailAtLocation } from "@/lib/xweather";

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

  if (!address && (!lat || !lng)) {
    return NextResponse.json({ error: "Address or coordinates required" }, { status: 400 });
  }

  try {
    let property: CoreLogicProperty | null = null;
    let coords = { lat: parseFloat(lat || "0"), lng: parseFloat(lng || "0") };

    // CoreLogic property lookup
    if (address) {
      const parts = address.split(",").map(s => s.trim());
      const address1 = parts[0] || "";
      const address2 = parts.slice(1).join(", ") || "";
      
      property = await getPropertyByAddress(address1, address2);
      
      if (property) {
        coords = { lat: property.lat, lng: property.lng };
      }
    } else if (lat && lng) {
      // Try progressively larger radii to find closest property
      const parsedLat = parseFloat(lat);
      const parsedLng = parseFloat(lng);
      const radii = [0.1, 0.25, 0.5];
      
      for (const radius of radii) {
        const properties = await getPropertyByLocation(parsedLat, parsedLng, radius);
        if (properties.length > 0) {
          property = properties[0];
          break;
        }
      }
    }

    // If no address provided, geocode from coords
    if (!address && lat && lng) {
      await reverseGeocode(parseFloat(lat), parseFloat(lng));
      coords = { lat: parseFloat(lat), lng: parseFloat(lng) };
    } else if (address && !lat) {
      const geocoded = await geocodeAddress(address);
      if (geocoded) {
        coords = geocoded;
      }
    }

    // Get storm exposure data from Xweather
    let stormExposure = null;
    try {
      const hailData = await verifyHailAtLocation(coords.lat, coords.lng, 90);
      if (hailData.hadHail) {
        stormExposure = {
          hailEvents: hailData.reports.length,
          maxHailSize: hailData.maxHailSize || 0,
          windEvents: 0,
          maxWindSpeed: 0,
          lastStormDate: hailData.reports[0]?.report.dateTimeISO.split("T")[0],
          summary: hailData.summary,
        };
      }
    } catch (e) {
      console.log("Xweather storm data not available");
    }

    // Format response — CoreLogic data only
    if (!property) {
      return NextResponse.json({
        error: "Property not found",
        message: "No property found at this location. Try a different address or coordinates.",
        address: address || `${coords.lat}, ${coords.lng}`,
        lat: coords.lat,
        lng: coords.lng,
        source: "none",
      }, { status: 404 });
    }

    const propertyData = formatPropertyResponse(property, stormExposure);

    return NextResponse.json({
      ...propertyData,
      source: "corelogic",
    });
  } catch (error) {
    console.error("Error looking up property:", error);

    // Preserve CoreLogic-specific errors (rate limit, auth, etc.)
    if (error instanceof CoreLogicError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.isRateLimit ? "RATE_LIMIT" : "API_ERROR",
          retryAfter: error.isRateLimit ? 60 : undefined,
        },
        { status: error.status }
      );
    }

    return NextResponse.json({ error: "Failed to lookup property" }, { status: 500 });
  }
}

// Geocode address to coordinates
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
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

// Reverse geocode coordinates to address
async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
      { headers: { "User-Agent": "StormAI/1.0" } }
    );

    if (response.ok) {
      const data = await response.json();
      return data.display_name || null;
    }
  } catch (error) {
    console.error("Reverse geocoding error:", error);
  }
  return null;
}

// Format CoreLogic property to our response format (matches existing frontend interface)
function formatPropertyResponse(property: CoreLogicProperty, stormExposure: any) {
  const roofAge = calculateRoofAge(property);
  const claimEstimate = estimateClaimValue(property);
  const conditionIndex = roofAge < 10 ? 0 : roofAge < 15 ? 1 : roofAge < 20 ? 2 : 3;
  const conditions: ("excellent" | "good" | "fair" | "poor")[] = ["excellent", "good", "fair", "poor"];

  return {
    address: property.address,
    lat: property.lat,
    lng: property.lng,
    owner: {
      name: property.owner,
      mailingAddress: "",
      absenteeOwner: false,
    },
    property: {
      value: property.marketValue || property.assessedValue || 0,
      yearBuilt: property.yearBuilt,
      squareFootage: property.squareFootage,
      lotSize: property.lotSize,
      buildingType: property.propertyType,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      stories: property.stories,
    },
    roof: {
      type: property.roofType,
      material: property.roofMaterial,
      age: roofAge,
      complexity: roofAge > 20 ? "complex" : roofAge > 10 ? "moderate" : "simple",
      condition: conditions[conditionIndex],
      squareFootage: claimEstimate.roofSquares * 100,
      squares: claimEstimate.roofSquares,
      pitch: 6,
    },
    parcel: {
      id: property.apn || property.id,
      fips: "",
    },
    assessment: {
      assessedValue: property.assessedValue,
      marketValue: property.marketValue,
      landValue: 0,
      improvementValue: 0,
      taxAmount: 0,
      taxYear: new Date().getFullYear(),
    },
    sale: property.saleDate ? {
      lastSaleDate: property.saleDate,
      lastSaleAmount: property.salePrice || 0,
      pricePerSqft: property.salePrice && property.squareFootage 
        ? Math.round(property.salePrice / property.squareFootage) 
        : 0,
    } : null,
    claimEstimate: {
      roofReplacement: claimEstimate.roofReplacement,
      siding: claimEstimate.siding,
      gutters: claimEstimate.gutters,
      total: claimEstimate.total,
      roofSquares: claimEstimate.roofSquares,
      confidence: claimEstimate.confidence,
    },
    stormExposure,
    neighborhood: {
      avgHomeValue: property.marketValue || property.assessedValue || 0,
      avgRoofAge: roofAge + 2,
      claimLikelihood: stormExposure ? Math.min(95, 50 + stormExposure.hailEvents * 10) : 40,
    },
  };
}
