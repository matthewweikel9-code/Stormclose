/**
 * CoreLogic Property Data API Client
 * Primary property data provider for StormClose
 * 
 * Provides: parcel boundaries, owner info, property search, and lead formatting
 * Auth: OAuth2 Client Credentials (Bearer token)
 * Base: https://api-prod.corelogic.com
 */

const CORELOGIC_CONSUMER_KEY = process.env.CORELOGIC_CONSUMER_KEY;
const CORELOGIC_CONSUMER_SECRET = process.env.CORELOGIC_CONSUMER_SECRET;
const CORELOGIC_BASE_URL = "https://api-prod.corelogic.com";
const TOKEN_URL = `${CORELOGIC_BASE_URL}/oauth/token?grant_type=client_credentials`;

// Token cache (in-memory, lasts ~1 hour per token)
let cachedToken: { token: string; expiresAt: number } | null = null;

// ─── Types ─────────────────────────────────────────────────────────────────

export interface CoreLogicParcel {
  parcelId: number;
  addr: string;
  stdAddr: string;
  city: string;
  state: string;
  stateCode: string;
  zip: string;
  stdCity: string;
  stdState: string;
  stdZip: string;
  stdPlus: string;
  countyCode: string;
  apn: string;
  owner: string;
  typeCode: string;
  geometry: string; // WKT POLYGON string
  // Additional fields that may be returned
  yearBuilt?: number;
  sqFt?: number;
  lotSizeSqFt?: number;
  assessedValue?: number;
  marketValue?: number;
  bedrooms?: number;
  bathrooms?: number;
  stories?: number;
  roofType?: string;
  roofMaterial?: string;
  constructionType?: string;
  saleDate?: string;
  salePrice?: number;
  [key: string]: any; // Allow additional fields from API
}

/**
 * Normalized property interface used throughout the app.
 * Maps CoreLogic parcel data to a consistent shape for all consumers.
 */
export interface CoreLogicProperty {
  id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
  owner: string;
  apn: string;
  propertyType: string;
  typeCode: string;
  yearBuilt: number;
  squareFootage: number;
  lotSize: number;
  bedrooms: number;
  bathrooms: number;
  stories: number;
  roofType: string;
  roofMaterial: string;
  roofAge: number;
  assessedValue: number;
  marketValue: number;
  saleDate: string | null;
  salePrice: number | null;
  geometry: string;
}

export interface CoreLogicPageInfo {
  actualPageSize: number;
  length: number;
  page: number;
  pageSize: number;
}

export interface CoreLogicParcelsResponse {
  pageInfo: CoreLogicPageInfo;
  parcels: CoreLogicParcel[];
}

export interface ParsedPolygon {
  coordinates: [number, number][]; // [lng, lat] pairs (GeoJSON order)
}

// ─── Auth ──────────────────────────────────────────────────────────────────

/**
 * Get a valid bearer token, using cached value if still valid
 */
async function getToken(): Promise<string> {
  if (!CORELOGIC_CONSUMER_KEY || !CORELOGIC_CONSUMER_SECRET) {
    throw new Error("CoreLogic API credentials not configured");
  }

  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }

  const credentials = Buffer.from(
    `${CORELOGIC_CONSUMER_KEY}:${CORELOGIC_CONSUMER_SECRET}`
  ).toString("base64");

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("[CoreLogic] Token error:", response.status, error);
    throw new Error(`CoreLogic OAuth failed: ${response.status}`);
  }

  const data = await response.json();
  
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + parseInt(data.expires_in) * 1000,
  };

  console.log("[CoreLogic] Token acquired, expires in", data.expires_in, "seconds");
  return cachedToken.token;
}

/**
 * Make an authenticated request to the CoreLogic API
 */
async function corelogicRequest(
  endpoint: string,
  params: Record<string, string>
): Promise<any> {
  const token = await getToken();
  
  const url = new URL(`${CORELOGIC_BASE_URL}${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });

  console.log("[CoreLogic] Request:", endpoint, JSON.stringify(params));

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("[CoreLogic] API error:", response.status, error);
    throw new Error(`CoreLogic API error: ${response.status} - ${error}`);
  }

  return response.json();
}

// ─── Parcel Search ─────────────────────────────────────────────────────────

/**
 * Search parcels by lat/lng within a radius
 */
export async function searchParcelsByLocation(
  lat: number,
  lng: number,
  radiusMiles: number = 0.5,
  pageSize: number = 25,
  page: number = 1
): Promise<CoreLogicParcelsResponse> {
  return corelogicRequest("/spatial-tile/parcels", {
    lat: lat.toString(),
    lon: lng.toString(),
    within: radiusMiles.toString(),
    unit: "mile",
    pageNumber: page.toString(),
    pageSize: pageSize.toString(),
  });
}

/**
 * Search parcels by full address (e.g. "308 S Akard St, Dallas, TX 75201")
 */
export async function searchParcelsByAddress(
  fullAddress: string,
  pageSize: number = 10,
  page: number = 1
): Promise<CoreLogicParcelsResponse> {
  return corelogicRequest("/spatial-tile/parcels", {
    address: fullAddress,
    pageNumber: page.toString(),
    pageSize: pageSize.toString(),
  });
}

// ─── Property Lookup ───────────────────────────────────────────────────────

/**
 * Normalize a CoreLogic parcel into our standard property format.
 * Normalizes a CoreLogic parcel into our standard property format.
 */
function parcelToProperty(parcel: CoreLogicParcel, lat?: number, lng?: number): CoreLogicProperty {
  const centroid = getParcelCentroid(parcel);
  const currentYear = new Date().getFullYear();
  const yearBuilt = parcel.yearBuilt || 0;
  const roofAge = yearBuilt > 0 ? Math.min(currentYear - yearBuilt, 50) : 15; // Default 15 if unknown

  return {
    id: parcel.apn || parcel.parcelId?.toString() || `cl-${Date.now()}`,
    address: parcel.stdAddr || parcel.addr || "Unknown Address",
    city: parcel.stdCity || parcel.city || "",
    state: parcel.stdState || parcel.stateCode || parcel.state || "",
    zip: parcel.stdZip || parcel.zip || "",
    lat: centroid?.lat || lat || 0,
    lng: centroid?.lng || lng || 0,
    owner: parcel.owner || "Unknown Owner",
    apn: parcel.apn || "",
    propertyType: decodePropertyType(parcel.typeCode),
    typeCode: parcel.typeCode || "",
    yearBuilt,
    squareFootage: parcel.sqFt || 0,
    lotSize: parcel.lotSizeSqFt || 0,
    bedrooms: parcel.bedrooms || 0,
    bathrooms: parcel.bathrooms || 0,
    stories: parcel.stories || 1,
    roofType: parcel.roofType || "Unknown",
    roofMaterial: parcel.roofMaterial || "Asphalt Shingle",
    roofAge,
    assessedValue: parcel.assessedValue || 0,
    marketValue: parcel.marketValue || 0,
    saleDate: parcel.saleDate || null,
    salePrice: parcel.salePrice || null,
    geometry: parcel.geometry || "",
  };
}

/**
 * Get a single property by address — equivalent to old getPropertyByAddress
 */
export async function getPropertyByAddress(
  address1: string,
  address2?: string
): Promise<CoreLogicProperty | null> {
  try {
    const fullAddress = address2 ? `${address1}, ${address2}` : address1;
    const result = await searchParcelsByAddress(fullAddress, 1);
    
    if (!result.parcels || result.parcels.length === 0) {
      console.log("[CoreLogic] No property found for address:", fullAddress);
      return null;
    }

    return parcelToProperty(result.parcels[0]);
  } catch (error) {
    console.error("[CoreLogic] getPropertyByAddress error:", error);
    return null;
  }
}

/**
 * Get properties by coordinates — equivalent to old getPropertyByLocation
 * Returns the closest property to the given coordinates.
 * First tries residential filter; falls back to all types if none found.
 */
export async function getPropertyByLocation(
  lat: number,
  lng: number,
  radiusMiles: number | string = 0.5
): Promise<CoreLogicProperty[]> {
  try {
    const radius = typeof radiusMiles === "string" ? parseFloat(radiusMiles) : radiusMiles;
    const result = await searchParcelsByLocation(lat, lng, radius, 50);
    
    if (!result.parcels || result.parcels.length === 0) {
      console.log("[CoreLogic] No properties found near:", lat, lng);
      return [];
    }

    // Try residential first
    const residentialTypes = new Set(["SFR", "MFR", "CON", "TH", "MOB"]);
    const residentialParcels = result.parcels.filter(p => {
      if (!p.typeCode) return true; // Include if type unknown
      return residentialTypes.has(p.typeCode);
    });

    console.log(`[CoreLogic] Filtered ${result.parcels.length} → ${residentialParcels.length} residential properties`);

    // Fall back to all parcels if no residential found
    const parcelsToReturn = residentialParcels.length > 0 ? residentialParcels : result.parcels;

    return parcelsToReturn.map(p => parcelToProperty(p, lat, lng));
  } catch (error) {
    console.error("[CoreLogic] getPropertyByLocation error:", error);
    return [];
  }
}

/**
 * Search properties within an area — equivalent to old searchPropertiesInArea
 */
export async function searchPropertiesInArea(
  lat: number,
  lng: number,
  radiusMiles: number = 1,
  filters?: {
    minYearBuilt?: number;
    maxYearBuilt?: number;
    propertyType?: string;
  }
): Promise<CoreLogicProperty[]> {
  try {
    const pageSize = 50;
    const result = await searchParcelsByLocation(lat, lng, radiusMiles, pageSize);

    if (!result.parcels || result.parcels.length === 0) {
      return [];
    }

    // Filter to residential types
    const residentialTypes = new Set(["SFR", "MFR", "CON", "TH", "MOB"]);
    let filtered = result.parcels.filter(p => {
      // Type filter
      if (filters?.propertyType) {
        return p.typeCode === filters.propertyType || 
               decodePropertyType(p.typeCode).toLowerCase().includes(filters.propertyType.toLowerCase());
      }
      if (!p.typeCode) return true;
      return residentialTypes.has(p.typeCode);
    });

    // Year built filters (if data available)
    if (filters?.minYearBuilt) {
      filtered = filtered.filter(p => !p.yearBuilt || p.yearBuilt >= filters.minYearBuilt!);
    }
    if (filters?.maxYearBuilt) {
      filtered = filtered.filter(p => !p.yearBuilt || p.yearBuilt <= filters.maxYearBuilt!);
    }

    // Must have a valid address
    filtered = filtered.filter(p => {
      const addr = p.stdAddr || p.addr;
      return addr && addr.trim().length > 0;
    });

    console.log(`[CoreLogic] Area search: ${result.parcels.length} → ${filtered.length} filtered properties`);

    return filtered.map(p => parcelToProperty(p, lat, lng));
  } catch (error) {
    console.error("[CoreLogic] searchPropertiesInArea error:", error);
    return [];
  }
}

/**
 * Get properties with older roofs (good for storm damage leads)
 */
export async function getOlderRoofProperties(
  lat: number,
  lng: number,
  radiusMiles: number = 2,
  maxYearBuilt: number = 2010
): Promise<CoreLogicProperty[]> {
  return searchPropertiesInArea(lat, lng, radiusMiles, {
    maxYearBuilt,
    propertyType: "SFR",
  });
}

// ─── Scoring & Estimation ──────────────────────────────────────────────────

/**
 * Calculate estimated roof age from property data
 */
export function calculateRoofAge(property: CoreLogicProperty): number {
  if (!property.yearBuilt || property.yearBuilt === 0) return 15; // Default assumption
  
  const currentYear = new Date().getFullYear();
  const buildingAge = currentYear - property.yearBuilt;
  
  // Roofs are typically replaced every 20-25 years
  if (buildingAge > 25) {
    return buildingAge % 25;
  }
  
  return buildingAge;
}

/**
 * Estimate potential claim value based on property characteristics
 */
export function estimateClaimValue(property: CoreLogicProperty): {
  roofReplacement: number;
  siding: number;
  gutters: number;
  total: number;
  confidence: "low" | "medium" | "high";
} {
  const sqft = property.squareFootage || 1500;
  
  // Industry averages for storm damage claims
  const roofCostPerSqft = 8.50;
  const sidingEstimate = sqft * 0.4 * 6;
  const guttersEstimate = Math.sqrt(sqft) * 4 * 12;
  
  const roofReplacement = Math.round(sqft * roofCostPerSqft);
  const siding = Math.round(sidingEstimate);
  const gutters = Math.round(guttersEstimate);
  
  // Confidence based on data quality
  let confidence: "low" | "medium" | "high" = "medium";
  if (property.squareFootage > 0 && property.roofType !== "Unknown") {
    confidence = "high";
  } else if (property.squareFootage === 0) {
    confidence = "low";
  }
  
  return {
    roofReplacement,
    siding,
    gutters,
    total: roofReplacement + siding + gutters,
    confidence,
  };
}

/**
 * Format CoreLogic property to our standard PropertyLead format
 */
export function formatPropertyToLead(property: CoreLogicProperty, stormScore: number = 0) {
  const roofAge = calculateRoofAge(property);
  const claimEstimate = estimateClaimValue(property);
  
  return {
    id: property.id,
    address: property.address,
    city: property.city,
    state: property.state,
    zip: property.zip,
    lat: property.lat,
    lng: property.lng,
    
    // Owner info
    ownerName: property.owner,
    
    // Property details
    yearBuilt: property.yearBuilt || null,
    sqft: property.squareFootage || null,
    bedrooms: property.bedrooms || null,
    bathrooms: property.bathrooms || null,
    propertyType: property.propertyType,
    roofType: property.roofType,
    
    // Calculated fields
    roofAge,
    estimatedClaimValue: claimEstimate.total,
    stormScore,
    
    // Source
    source: "corelogic" as const,
    parcelId: property.id,
  };
}

// ─── Geometry Parsing ──────────────────────────────────────────────────────

/**
 * Parse WKT POLYGON string into coordinate arrays for Mapbox
 * Input:  "POLYGON((-96.799 32.779, -96.798 32.778, ...))"
 * Output: { coordinates: [[-96.799, 32.779], [-96.798, 32.778], ...] }
 */
export function parseWKTPolygon(wkt: string): ParsedPolygon | null {
  if (!wkt || !wkt.startsWith("POLYGON")) return null;

  try {
    const match = wkt.match(/\(\((.+?)\)\)/);
    if (!match) return null;

    const coordStr = match[1];
    const coordinates: [number, number][] = coordStr.split(",").map((pair) => {
      const [lng, lat] = pair.trim().split(/\s+/).map(Number);
      return [lng, lat] as [number, number];
    });

    return { coordinates };
  } catch (e) {
    console.error("[CoreLogic] Failed to parse WKT:", e);
    return null;
  }
}

/**
 * Convert CoreLogic parcel to GeoJSON Feature (for Mapbox rendering)
 */
export function parcelToGeoJSON(parcel: CoreLogicParcel): GeoJSON.Feature | null {
  const polygon = parseWKTPolygon(parcel.geometry);
  if (!polygon) return null;

  return {
    type: "Feature",
    properties: {
      parcelId: parcel.parcelId,
      address: parcel.stdAddr || parcel.addr,
      city: parcel.stdCity || parcel.city,
      state: parcel.stdState || parcel.state,
      zip: parcel.stdZip || parcel.zip,
      owner: parcel.owner,
      apn: parcel.apn,
      typeCode: parcel.typeCode,
    },
    geometry: {
      type: "Polygon",
      coordinates: [polygon.coordinates],
    },
  };
}

/**
 * Calculate centroid of a parcel polygon (for marker placement)
 */
export function getParcelCentroid(parcel: CoreLogicParcel): { lat: number; lng: number } | null {
  const polygon = parseWKTPolygon(parcel.geometry);
  if (!polygon || polygon.coordinates.length === 0) return null;

  const coords = polygon.coordinates;
  const sumLng = coords.reduce((sum, c) => sum + c[0], 0);
  const sumLat = coords.reduce((sum, c) => sum + c[1], 0);

  return {
    lng: sumLng / coords.length,
    lat: sumLat / coords.length,
  };
}

// ─── Property Type Decode ──────────────────────────────────────────────────

const PROPERTY_TYPE_MAP: Record<string, string> = {
  SFR: "Single Family",
  MFR: "Multi-Family",
  COM: "Commercial",
  IND: "Industrial",
  AGR: "Agricultural",
  VAC: "Vacant Land",
  CEN: "Centrally Assessed",
  GOV: "Government",
  REL: "Religious",
  EDU: "Educational",
  MED: "Medical",
  REC: "Recreational",
  MIS: "Miscellaneous",
  MOB: "Mobile Home",
  CON: "Condo",
  TH: "Townhouse",
};

export function decodePropertyType(typeCode: string): string {
  return PROPERTY_TYPE_MAP[typeCode] || typeCode || "Unknown";
}

// ─── Batch Helper ──────────────────────────────────────────────────────────

/**
 * Fetch all parcels within a radius (handles pagination)
 * Caps at maxParcels to avoid excessive API calls
 */
export async function getAllParcelsInRadius(
  lat: number,
  lng: number,
  radiusMiles: number = 0.25,
  maxParcels: number = 100
): Promise<CoreLogicParcel[]> {
  const pageSize = Math.min(50, maxParcels);
  const firstPage = await searchParcelsByLocation(lat, lng, radiusMiles, pageSize, 1);
  
  if (!firstPage.parcels || firstPage.parcels.length === 0) {
    console.log("[CoreLogic] No parcels found in radius", radiusMiles, "miles from", lat, lng);
    return [];
  }

  const allParcels = [...firstPage.parcels];
  const totalAvailable = firstPage.pageInfo?.length || allParcels.length;
  const totalPages = Math.ceil(Math.min(totalAvailable, maxParcels) / pageSize);

  // Fetch remaining pages in parallel (max 3 at a time)
  if (totalPages > 1) {
    const pageNumbers = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
    
    for (let i = 0; i < pageNumbers.length; i += 3) {
      const batch = pageNumbers.slice(i, i + 3);
      try {
        const results = await Promise.all(
          batch.map((page) => searchParcelsByLocation(lat, lng, radiusMiles, pageSize, page))
        );
        results.forEach((r) => {
          if (r.parcels) allParcels.push(...r.parcels);
        });
      } catch (error) {
        console.error("[CoreLogic] Error fetching page batch:", error);
        break; // Stop pagination on error, return what we have
      }
    }
  }

  return allParcels.slice(0, maxParcels);
}
