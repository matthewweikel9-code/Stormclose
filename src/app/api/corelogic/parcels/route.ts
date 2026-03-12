import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  searchParcelsByLocation,
  searchParcelsByAddress,
  getAllParcelsInRadius,
  parcelToGeoJSON,
  getParcelCentroid,
  decodePropertyType,
  CoreLogicParcel,
} from "@/lib/corelogic";

/**
 * CoreLogic Parcels API
 * 
 * GET /api/corelogic/parcels
 * 
 * Params:
 *   - lat, lng, radius (miles) — search by location
 *   - address — search by full address string
 *   - pageSize (default 25), page (default 1)
 *   - geojson=true — return GeoJSON FeatureCollection for map rendering
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address");
    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");
    const radius = parseFloat(searchParams.get("radius") || "0.25");
    const pageSize = parseInt(searchParams.get("pageSize") || "25");
    const page = parseInt(searchParams.get("page") || "1");
    const wantGeoJSON = searchParams.get("geojson") === "true";
    const fetchAll = searchParams.get("all") === "true";

    if (!address && (!lat || !lng)) {
      return NextResponse.json(
        { error: "Provide address or lat/lng coordinates" },
        { status: 400 }
      );
    }

    let parcels: CoreLogicParcel[] = [];
    let totalCount = 0;

    if (address) {
      // Search by address
      const result = await searchParcelsByAddress(address, pageSize, page);
      parcels = result.parcels;
      totalCount = result.pageInfo.length;
    } else if (fetchAll && lat && lng) {
      // Fetch all parcels in radius (paginated internally)
      parcels = await getAllParcelsInRadius(
        parseFloat(lat),
        parseFloat(lng),
        radius,
        200 // max 200 parcels
      );
      totalCount = parcels.length;
    } else if (lat && lng) {
      // Single page location search
      const result = await searchParcelsByLocation(
        parseFloat(lat),
        parseFloat(lng),
        radius,
        pageSize,
        page
      );
      parcels = result.parcels;
      totalCount = result.pageInfo.length;
    }

    // Format parcels with enriched data
    const formattedParcels = parcels.map((parcel) => {
      const centroid = getParcelCentroid(parcel);
      return {
        id: parcel.parcelId,
        address: parcel.stdAddr || parcel.addr,
        city: parcel.stdCity || parcel.city,
        state: parcel.stdState || parcel.state,
        zip: parcel.stdZip || parcel.zip,
        county: parcel.countyCode,
        owner: parcel.owner,
        apn: parcel.apn,
        propertyType: decodePropertyType(parcel.typeCode),
        typeCode: parcel.typeCode,
        lat: centroid?.lat || 0,
        lng: centroid?.lng || 0,
        geometry: parcel.geometry,
      };
    });

    // If GeoJSON requested, return FeatureCollection for direct Mapbox consumption
    if (wantGeoJSON) {
      const features = parcels
        .map((p) => parcelToGeoJSON(p))
        .filter((f): f is GeoJSON.Feature => f !== null);

      return NextResponse.json({
        type: "FeatureCollection",
        features,
        metadata: {
          totalParcels: totalCount,
          returnedParcels: features.length,
          source: "corelogic",
        },
      });
    }

    return NextResponse.json({
      parcels: formattedParcels,
      totalCount,
      page,
      pageSize,
      source: "corelogic",
    });
  } catch (error: any) {
    console.error("[CoreLogic Parcels] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch parcel data" },
      { status: 500 }
    );
  }
}
