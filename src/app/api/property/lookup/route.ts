import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getPropertyByAddress,
  getPropertyByLocation,
  calculateRoofAge,
  estimateClaimValue,
  ATTOMProperty,
} from "@/lib/attom";
import { verifyHailAtLocation } from "@/lib/xweather";

const ATTOM_API_KEY = process.env.ATTOM_API_KEY;

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
    let attomProperty: ATTOMProperty | null = null;
    let coords = { lat: parseFloat(lat || "0"), lng: parseFloat(lng || "0") };

    // Try ATTOM API first
    if (ATTOM_API_KEY) {
      if (address) {
        // Parse address into components
        const parts = address.split(",").map(s => s.trim());
        const address1 = parts[0] || "";
        const address2 = parts.slice(1).join(", ") || "";
        
        attomProperty = await getPropertyByAddress(address1, address2);
        
        if (attomProperty?.location) {
          coords = {
            lat: parseFloat(attomProperty.location.latitude),
            lng: parseFloat(attomProperty.location.longitude),
          };
        }
      } else if (lat && lng) {
        const properties = await getPropertyByLocation(parseFloat(lat), parseFloat(lng));
        attomProperty = properties[0] || null;
      }
    }

    // If no address provided, geocode from coords
    if (!address && lat && lng) {
      const geocoded = await reverseGeocode(parseFloat(lat), parseFloat(lng));
      if (geocoded) {
        coords = { lat: parseFloat(lat), lng: parseFloat(lng) };
      }
    } else if (address && !lat) {
      // Geocode address
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
          windEvents: 0, // Would need separate wind query
          maxWindSpeed: 0,
          lastStormDate: hailData.reports[0]?.report.dateTimeISO.split("T")[0],
          summary: hailData.summary,
        };
      }
    } catch (e) {
      console.log("Xweather storm data not available");
    }

    // Format response - ATTOM data only
    if (!attomProperty) {
      return NextResponse.json({
        error: "Property not found",
        message: ATTOM_API_KEY
          ? "No property found at this location. Try a different address or coordinates."
          : "Property data requires ATTOM API key. Contact your administrator.",
        address: address || `${coords.lat}, ${coords.lng}`,
        lat: coords.lat,
        lng: coords.lng,
        source: "none",
      }, { status: 404 });
    }

    const propertyData = formatATTOMProperty(attomProperty, stormExposure);

    return NextResponse.json({
      ...propertyData,
      source: "attom",
    });
  } catch (error) {
    console.error("Error looking up property:", error);
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

// Format ATTOM property to our response format
function formatATTOMProperty(property: ATTOMProperty, stormExposure: any) {
  const roofAge = calculateRoofAge(property);
  const claimEstimate = estimateClaimValue(property);
  const yearBuilt = property.summary?.yearbuilt || 2000;
  const conditionIndex = roofAge < 10 ? 0 : roofAge < 15 ? 1 : roofAge < 20 ? 2 : 3;
  const conditions: ("excellent" | "good" | "fair" | "poor")[] = ["excellent", "good", "fair", "poor"];

  return {
    address: property.address?.oneLine || "Unknown Address",
    lat: parseFloat(property.location?.latitude) || 0,
    lng: parseFloat(property.location?.longitude) || 0,
    owner: {
      name: property.owner?.owner1?.fullName || "Unknown Owner",
      firstName: property.owner?.owner1?.firstName || "",
      lastName: property.owner?.owner1?.lastName || "",
      mailingAddress: property.owner?.mailingAddressOneLine || "",
      absenteeOwner: property.owner?.absenteeInd === "Y",
    },
    property: {
      value: property.assessment?.market?.mktTtlValue || property.assessment?.assessed?.assdTtlValue || 0,
      yearBuilt,
      squareFootage: property.building?.size?.livingSize || property.building?.size?.bldgSize || 0,
      lotSize: property.lot?.lotSize1 || 0,
      buildingType: property.summary?.proptype || "Residential",
      bedrooms: property.building?.rooms?.beds || 0,
      bathrooms: property.building?.rooms?.bathsTotal || 0,
      stories: 1,
    },
    roof: {
      type: property.building?.construction?.roofShape || "Unknown",
      material: property.building?.construction?.roofCover || "Asphalt Shingle",
      age: roofAge,
      complexity: roofAge > 20 ? "complex" : roofAge > 10 ? "moderate" : "simple",
      condition: conditions[conditionIndex],
      squareFootage: Math.round((property.building?.size?.livingSize || 2000) * 1.15),
      pitch: 6,
    },
    parcel: {
      id: property.identifier?.apn || property.identifier?.attomId?.toString() || "Unknown",
      attomId: property.identifier?.attomId,
      fips: property.identifier?.fips,
    },
    assessment: {
      assessedValue: property.assessment?.assessed?.assdTtlValue || 0,
      marketValue: property.assessment?.market?.mktTtlValue || 0,
      landValue: property.assessment?.assessed?.assdLandValue || 0,
      improvementValue: property.assessment?.assessed?.assdImprValue || 0,
      taxAmount: property.assessment?.tax?.taxAmt || 0,
      taxYear: property.assessment?.tax?.taxYear || new Date().getFullYear(),
    },
    sale: property.sale ? {
      lastSaleDate: property.sale.saleTransDate,
      lastSaleAmount: property.sale.amount?.saleAmt || 0,
      pricePerSqft: property.sale.calculation?.pricePerSizeUnit || 0,
    } : null,
    claimEstimate: {
      roofReplacement: claimEstimate.roofReplacement,
      siding: claimEstimate.siding,
      gutters: claimEstimate.gutters,
      total: claimEstimate.total,
      confidence: claimEstimate.confidence,
    },
    stormExposure,
    neighborhood: {
      avgHomeValue: property.assessment?.market?.mktTtlValue || 0,
      avgRoofAge: roofAge + 2,
      claimLikelihood: stormExposure ? Math.min(95, 50 + stormExposure.hailEvents * 10) : 40,
    },
  };
}

// end of file
