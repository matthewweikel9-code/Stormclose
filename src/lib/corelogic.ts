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

// Response cache — reduce API calls on rate-limited tiers
const responseCache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min cache for parcel queries
const MAX_CACHE_SIZE = 50;
const CORELOGIC_MAX_RADIUS_MILES = 1;
const CORELOGIC_MIN_RADIUS_MILES = 0.05;

// Rate limit tracking
let rateLimitHitAt: number | null = null;
const RATE_LIMIT_COOLDOWN_MS = 60 * 1000; // Wait 60s after hitting rate limit

function clampSearchRadiusMiles(radiusMiles: number, fallback: number = 0.5): number {
  if (!Number.isFinite(radiusMiles)) return fallback;
  const safeRadius = Math.min(
    CORELOGIC_MAX_RADIUS_MILES,
    Math.max(CORELOGIC_MIN_RADIUS_MILES, radiusMiles)
  );
  if (safeRadius !== radiusMiles) {
    console.warn(
      `[CoreLogic] Radius clamped from ${radiusMiles} to ${safeRadius} miles (API max ${CORELOGIC_MAX_RADIUS_MILES})`
    );
  }
  return safeRadius;
}

/**
 * Custom error class for CoreLogic API errors — preserves HTTP status
 */
export class CoreLogicError extends Error {
  status: number;
  isRateLimit: boolean;
  isQuotaExhausted: boolean;

  constructor(status: number, message: string) {
    super(message);
    this.name = "CoreLogicError";
    this.status = status;
    this.isRateLimit = status === 429;
    this.isQuotaExhausted = status === 429 && message.toLowerCase().includes("quota");
  }
}

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
    body: "", // Required — some proxies reject POST without body/Content-Length
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
 * Make an authenticated request to the CoreLogic API.
 * Includes: response caching, rate-limit awareness, retry on 429, proper error propagation.
 */
async function corelogicRequest(
  endpoint: string,
  params: Record<string, string>
): Promise<any> {
  // ── Check rate limit cooldown ──
  if (rateLimitHitAt && Date.now() - rateLimitHitAt < RATE_LIMIT_COOLDOWN_MS) {
    const waitSec = Math.ceil((RATE_LIMIT_COOLDOWN_MS - (Date.now() - rateLimitHitAt)) / 1000);
    throw new CoreLogicError(
      429,
      `CoreLogic API daily quota exceeded. Requests will resume in ~${waitSec}s or at quota reset.`
    );
  }

  // ── Check response cache ──
  const cacheKey = `${endpoint}?${JSON.stringify(params)}`;
  const cached = responseCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    console.log("[CoreLogic] Cache hit:", endpoint);
    return cached.data;
  }

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
    const errorText = await response.text();
    console.error("[CoreLogic] API error:", response.status, errorText);

    // Rate limit — set cooldown so we don't spam the API
    if (response.status === 429) {
      rateLimitHitAt = Date.now();
      throw new CoreLogicError(
        429,
        `CoreLogic API quota exceeded (100 requests/day on DEMO tier). Try again later. Details: ${errorText}`
      );
    }

    // Token expired / invalid — clear cache and let caller retry
    if (response.status === 401) {
      cachedToken = null;
      throw new CoreLogicError(401, `CoreLogic authentication failed. Token may have expired.`);
    }

    throw new CoreLogicError(response.status, `CoreLogic API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  // ── Cache successful responses ──
  if (responseCache.size >= MAX_CACHE_SIZE) {
    // Evict oldest entries
    const firstKey = responseCache.keys().next().value;
    if (firstKey) responseCache.delete(firstKey);
  }
  responseCache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS });

  return data;
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
  const safeRadiusMiles = clampSearchRadiusMiles(radiusMiles, 0.5);
  return corelogicRequest("/spatial-tile/parcels", {
    lat: lat.toString(),
    lon: lng.toString(),
    within: safeRadiusMiles.toString(),
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
    // Rethrow rate-limit / auth errors so route handlers can surface them
    if (error instanceof CoreLogicError) throw error;
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
    // Rethrow rate-limit / auth errors so route handlers can surface them
    if (error instanceof CoreLogicError) throw error;
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
    // Rethrow rate-limit / auth errors so route handlers can surface them
    if (error instanceof CoreLogicError) throw error;
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
 * Estimate potential claim value based on property characteristics.
 * Uses building sqft, stories, roof material, market value, and roof age
 * to produce a realistic per-property estimate instead of a flat rate.
 */
export function estimateClaimValue(property: CoreLogicProperty): {
  roofReplacement: number;
  siding: number;
  gutters: number;
  total: number;
  roofSquares: number;
  confidence: "low" | "medium" | "high";
} {
  // ── 1. Determine building footprint (sqft on the ground) ──────────
  let buildingSqft = property.squareFootage || 0;
  const stories = property.stories || 1;
  const hasRealSqft = buildingSqft > 0;

  // If we have market/assessed value but no sqft, estimate sqft from value
  // Avg US home ~$150/sqft; this gives a rough footprint estimate
  if (!hasRealSqft) {
    const value = property.marketValue || property.assessedValue || 0;
    if (value > 0) {
      buildingSqft = Math.round(value / 150);
    } else {
      // True unknown — use regional average (~1800 sqft)
      buildingSqft = 1800;
    }
  }

  // Footprint = total sqft ÷ stories (roof only covers one floor)
  const footprint = Math.round(buildingSqft / stories);

  // ── 2. Calculate roof area from footprint + pitch multiplier ──────
  // Standard pitch factors: low(3-4)=1.03, medium(5-7)=1.12, steep(8-12)=1.25
  const roofType = (property.roofType || "").toLowerCase();
  const pitchMultiplier =
    roofType.includes("flat") || roofType.includes("low") ? 1.03 :
    roofType.includes("steep") || roofType.includes("high") || roofType.includes("mansard") ? 1.25 :
    1.12; // Standard medium pitch

  // Waste/overhang factor (~15%)
  const wasteFactor = 1.15;
  const roofAreaSqft = Math.round(footprint * pitchMultiplier * wasteFactor);
  const roofSquares = Math.round(roofAreaSqft / 100); // 1 square = 100 sqft

  // ── 3. Material-specific cost per square ──────────────────────────
  const material = (property.roofMaterial || "Asphalt Shingle").toLowerCase();
  let costPerSquare: number;
  if (material.includes("tile") || material.includes("clay")) {
    costPerSquare = 550;
  } else if (material.includes("metal") || material.includes("standing seam")) {
    costPerSquare = 600;
  } else if (material.includes("slate")) {
    costPerSquare = 750;
  } else if (material.includes("wood") || material.includes("shake") || material.includes("cedar")) {
    costPerSquare = 500;
  } else {
    // Asphalt/architectural shingles (most common)
    costPerSquare = 450;
  }

  // Age adjustment — older roofs may need more tear-off/decking work
  const roofAge = property.roofAge || 15;
  const ageMultiplier = roofAge >= 25 ? 1.15 : roofAge >= 20 ? 1.10 : roofAge >= 15 ? 1.05 : 1.0;

  const roofReplacement = Math.round(roofSquares * costPerSquare * ageMultiplier);

  // ── 4. Supplemental line items ────────────────────────────────────
  // Gutters: linear feet ≈ perimeter. Approx perimeter from footprint assuming ~1.5:1 ratio
  const side = Math.sqrt(footprint);
  const perimeterFt = Math.round(side * 4.2); // Rectangle approximation
  const gutters = Math.round(perimeterFt * 12); // ~$12/lf installed

  // Siding: typically 30-40% of wall area gets damaged in hail
  // Wall area ≈ perimeter × wall height × 0.35 (hail-exposed portion)
  const wallHeight = stories * 9; // 9ft per story
  const sidingArea = Math.round(perimeterFt * wallHeight * 0.35);
  const siding = Math.round(sidingArea * 6); // ~$6/sqft siding repair

  // ── 5. Confidence scoring ─────────────────────────────────────────
  let confidence: "low" | "medium" | "high" = "low";
  let dataPoints = 0;
  if (hasRealSqft) dataPoints += 2;
  if (property.yearBuilt > 0) dataPoints += 1;
  if (property.roofType !== "Unknown" && property.roofType) dataPoints += 1;
  if (property.roofMaterial && property.roofMaterial !== "Asphalt Shingle") dataPoints += 1; // non-default
  if (property.marketValue > 0 || property.assessedValue > 0) dataPoints += 1;
  if (property.stories > 0) dataPoints += 1;

  if (dataPoints >= 4) confidence = "high";
  else if (dataPoints >= 2) confidence = "medium";

  return {
    roofReplacement,
    siding,
    gutters,
    roofSquares,
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
  if (!wkt || (typeof wkt !== "string")) return null;

  try {
    const normalized = wkt.trim();
    let coordStr = "";

    // Example:
    // POLYGON((lng lat, lng lat, ...))
    // MULTIPOLYGON(((lng lat, lng lat, ...)),((...)))
    if (normalized.startsWith("MULTIPOLYGON")) {
      const multiMatch = normalized.match(/^MULTIPOLYGON\s*\(\(\((.+?)\)\)\)/i);
      if (!multiMatch) return null;
      coordStr = multiMatch[1];
    } else if (normalized.startsWith("POLYGON")) {
      const polygonMatch = normalized.match(/^POLYGON\s*\(\((.+?)\)\)/i);
      if (!polygonMatch) return null;
      coordStr = polygonMatch[1];
    } else {
      return null;
    }

    const coordinates: [number, number][] = coordStr
      .split(",")
      .map((pair) => pair.replace(/[()]/g, " ").trim())
      .map((pair) => {
        const [lngRaw, latRaw] = pair.split(/\s+/);
        const lng = Number(lngRaw);
        const lat = Number(latRaw);
        return [lng, lat] as [number, number];
      })
      .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat));

    if (coordinates.length < 3) return null;

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
