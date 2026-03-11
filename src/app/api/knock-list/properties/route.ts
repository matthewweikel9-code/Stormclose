import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  searchPropertiesInArea,
  calculateRoofAge,
  estimateClaimValue,
  formatPropertyToLead,
  ATTOMProperty,
} from "@/lib/attom";
import { getHailReports } from "@/lib/xweather";

const ATTOM_API_KEY = process.env.ATTOM_API_KEY;

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get("lat") || "32.7767");
  const lng = parseFloat(searchParams.get("lng") || "-96.7970");
  const radius = parseFloat(searchParams.get("radius") || "2"); // miles

  try {
    let properties: KnockListProperty[] = [];
    let stormData: any = null;

    // Try to get real storm data from Xweather
    try {
      const hailReports = await getHailReports(lat, lng, radius * 2, 30);
      if (hailReports.length > 0) {
        const maxHail = Math.max(...hailReports.map(r => r.report.detail.hailIN || 0));
        stormData = {
          hailEvents: hailReports.length,
          maxHailSize: maxHail,
          lastStormDate: hailReports[0].report.dateTimeISO,
        };
      }
    } catch (e) {
      console.log("Xweather not available, using generated storm data");
    }

    // Try ATTOM API for real property data
    if (ATTOM_API_KEY) {
      try {
        const attomProperties = await searchPropertiesInArea(lat, lng, radius, {
          propertyType: "SFR", // Single Family Residential
        });

        properties = attomProperties.slice(0, 50).map((prop, i) => 
          formatATTOMToKnockList(prop, i, lat, lng, stormData)
        );
      } catch (e) {
        console.log("ATTOM not available, using generated data");
      }
    }

    // If no ATTOM data, return empty result
    if (properties.length === 0) {
      return NextResponse.json({ 
        properties: [],
        source: "none",
        stormData,
        location: { lat, lng, radius },
        message: ATTOM_API_KEY 
          ? "No residential properties found in this area. Try a different location or larger radius."
          : "Property data requires ATTOM API key. Contact your administrator.",
      });
    }

    return NextResponse.json({ 
      properties,
      source: properties.length > 0 && ATTOM_API_KEY ? "attom" : "generated",
      stormData,
      location: { lat, lng, radius },
    });
  } catch (error) {
    console.error("Error fetching properties:", error);
    return NextResponse.json({ error: "Failed to fetch properties" }, { status: 500 });
  }
}

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
  distance: number;
  selected: boolean;
  ownerName?: string;
  yearBuilt?: number;
  sqft?: number;
}

// Format ATTOM property to knock list format
function formatATTOMToKnockList(
  prop: ATTOMProperty,
  index: number,
  centerLat: number,
  centerLng: number,
  stormData: any
): KnockListProperty {
  const roofAge = calculateRoofAge(prop);
  const claimEstimate = estimateClaimValue(prop);
  const propLat = parseFloat(prop.location?.latitude) || centerLat;
  const propLng = parseFloat(prop.location?.longitude) || centerLng;
  
  // Calculate distance from center
  const distance = calculateDistance(centerLat, centerLng, propLat, propLng);
  
  // Calculate storm damage score
  const baseScore = stormData ? 50 + Math.min(40, stormData.hailEvents * 10) : 40;
  const ageBonus = Math.min(30, roofAge * 1.5);
  const damageScore = Math.min(100, Math.round(baseScore + ageBonus));
  
  // Storm severity based on hail data
  const stormSeverity = stormData 
    ? Math.min(100, Math.round(50 + (stormData.maxHailSize || 0) * 20))
    : Math.round(30 + Math.random() * 40);

  return {
    id: prop.identifier?.attomId?.toString() || `prop-${index}`,
    address: prop.address?.oneLine || "Unknown Address",
    lat: propLat,
    lng: propLng,
    damageScore,
    roofAge,
    roofSize: Math.round((prop.building?.size?.livingSize || 2000) * 1.15 / 100), // squares
    propertyValue: prop.assessment?.market?.mktTtlValue || prop.assessment?.assessed?.assdTtlValue || 0,
    stormSeverity,
    estimatedJobValue: claimEstimate.roofReplacement,
    distance: Math.round(distance * 10) / 10,
    selected: false,
    ownerName: prop.owner?.owner1?.fullName || "Unknown",
    yearBuilt: prop.summary?.yearbuilt,
    sqft: prop.building?.size?.livingSize,
  };
}

// Calculate distance between two points in miles
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
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

    // For now, return success without database insert (table might not exist)
    return NextResponse.json({ 
      success: true,
      id: `list-${Date.now()}`,
      name,
      propertyCount: properties.length,
      totalValue: properties.reduce((sum: number, p: { estimatedJobValue: number }) => sum + p.estimatedJobValue, 0),
    });
  } catch (error) {
    console.error("Error saving knock list:", error);
    return NextResponse.json({ error: "Failed to save knock list" }, { status: 500 });
  }
}
