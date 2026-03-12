/**
 * CoreLogic Spatial Tile API Client
 * Provides parcel boundary data with owner & property info
 * 
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

// ─── Geometry Parsing ──────────────────────────────────────────────────────

/**
 * Parse WKT POLYGON string into coordinate arrays for Mapbox
 * Input:  "POLYGON((-96.799 32.779, -96.798 32.778, ...))"
 * Output: { coordinates: [[-96.799, 32.779], [-96.798, 32.778], ...] }
 */
export function parseWKTPolygon(wkt: string): ParsedPolygon | null {
  if (!wkt || !wkt.startsWith("POLYGON")) return null;

  try {
    // Extract coordinates string between innermost parens
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
  
  const allParcels = [...firstPage.parcels];
  const totalAvailable = firstPage.pageInfo.length;
  const totalPages = Math.ceil(Math.min(totalAvailable, maxParcels) / pageSize);

  // Fetch remaining pages in parallel (max 3 at a time)
  if (totalPages > 1) {
    const pageNumbers = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
    
    for (let i = 0; i < pageNumbers.length; i += 3) {
      const batch = pageNumbers.slice(i, i + 3);
      const results = await Promise.all(
        batch.map((page) => searchParcelsByLocation(lat, lng, radiusMiles, pageSize, page))
      );
      results.forEach((r) => allParcels.push(...r.parcels));
    }
  }

  return allParcels.slice(0, maxParcels);
}
