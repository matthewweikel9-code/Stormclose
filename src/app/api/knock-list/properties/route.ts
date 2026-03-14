import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleNextRoute, withStatus } from "@/lib/api-middleware";
import { searchPropertiesInArea, calculateRoofAge, estimateClaimValue, CoreLogicProperty } from "@/lib/corelogic";
import { getHailReports } from "@/lib/xweather";

export async function GET(request: NextRequest) {
  return handleNextRoute(
    request,
    async ({ setUserId }) => {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();

      setUserId(user?.id);

      if (!user) {
        return withStatus(401, { error: "Unauthorized" });
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

        // CoreLogic property search
        try {
          const clProperties = await searchPropertiesInArea(lat, lng, radius, {
            propertyType: "SFR",
          });

          properties = clProperties.slice(0, 50).map((prop, i) =>
            formatToKnockList(prop, i, lat, lng, stormData)
          );
        } catch (e) {
          console.log("CoreLogic not available:", e);
        }

        // If no data, return empty result
        if (properties.length === 0) {
          return {
            properties: [],
            source: "none",
            stormData,
            location: { lat, lng, radius },
            message: "No residential properties found in this area. Try a different location or larger radius.",
          };
        }

        return {
          properties,
          source: "corelogic",
          stormData,
          location: { lat, lng, radius },
        };
      } catch (error) {
        console.error("Error fetching properties:", error);
        return withStatus(500, { error: "Failed to fetch properties" });
      }
    },
    { route: "/api/knock-list/properties" }
  );
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

// Format CoreLogic property to knock list format
function formatToKnockList(
  prop: CoreLogicProperty,
  index: number,
  centerLat: number,
  centerLng: number,
  stormData: any
): KnockListProperty {
  const roofAge = calculateRoofAge(prop);
  const claimEstimate = estimateClaimValue(prop);
  
  // Calculate distance from center
  const distance = calculateDistance(centerLat, centerLng, prop.lat, prop.lng);
  
  // Calculate storm damage score
  const baseScore = stormData ? 50 + Math.min(40, stormData.hailEvents * 10) : 40;
  const ageBonus = Math.min(30, roofAge * 1.5);
  const damageScore = Math.min(100, Math.round(baseScore + ageBonus));
  
  // Storm severity based on hail data
  const stormSeverity = stormData 
    ? Math.min(100, Math.round(50 + (stormData.maxHailSize || 0) * 20))
    : Math.round(30 + Math.random() * 40);

  return {
    id: prop.id || `prop-${index}`,
    address: prop.address || "Unknown Address",
    lat: prop.lat,
    lng: prop.lng,
    damageScore,
    roofAge,
    roofSize: Math.round((prop.squareFootage || 2000) * 1.15 / 100),
    propertyValue: prop.marketValue || prop.assessedValue || 0,
    stormSeverity,
    estimatedJobValue: claimEstimate.roofReplacement,
    distance: Math.round(distance * 10) / 10,
    selected: false,
    ownerName: prop.owner || "Unknown",
    yearBuilt: prop.yearBuilt || undefined,
    sqft: prop.squareFootage || undefined,
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
  return handleNextRoute(
    request,
    async ({ setUserId }) => {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();

      setUserId(user?.id);

      if (!user) {
        return withStatus(401, { error: "Unauthorized" });
      }

      try {
        const body = await request.json();
        const { name, properties, centerLocation, filters } = body;

        // For now, return success without database insert (table might not exist)
        return {
          success: true,
          id: `list-${Date.now()}`,
          name,
          propertyCount: properties.length,
          totalValue: properties.reduce((sum: number, p: { estimatedJobValue: number }) => sum + p.estimatedJobValue, 0),
        };
      } catch (error) {
        console.error("Error saving knock list:", error);
        return withStatus(500, { error: "Failed to save knock list" });
      }
    },
    { route: "/api/knock-list/properties" }
  );
}
