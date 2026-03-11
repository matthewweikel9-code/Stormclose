/**
 * ATTOM Property Data API Client
 * Real property data including owner info, roof details, and property characteristics
 * 
 * API Docs: https://api.developer.attomdata.com/docs
 */

const ATTOM_API_KEY = process.env.ATTOM_API_KEY;
const ATTOM_BASE_URL = "https://api.gateway.attomdata.com";

export interface ATTOMProperty {
  identifier: {
    Id: number;
    fips: string;
    apn: string;
    attomId: number;
  };
  lot: {
    lotSize1: number; // sq ft
    lotSize2: number; // acres
  };
  address: {
    country: string;
    countrySubd: string;
    line1: string;
    line2: string;
    locality: string;
    matchCode: string;
    oneLine: string;
    postal1: string;
    postal2: string;
    postal3: string;
  };
  location: {
    accuracy: string;
    latitude: string;
    longitude: string;
    distance: number;
    geoid: string;
  };
  summary: {
    propclass: string;
    propsubtype: string;
    proptype: string;
    yearbuilt: number;
    propLandUse: string;
    propIndicator: string;
    legal1: string;
  };
  building?: {
    size?: {
      bldgSize: number;
      grossSize: number;
      grossSizeAdjusted: number;
      livingSize: number;
      universalSize: number;
    };
    rooms?: {
      bathsFull: number;
      bathsTotal: number;
      beds: number;
      roomsTotal: number;
    };
    construction?: {
      condition: string;
      constructionType: string;
      frameType: string;
      foundationType: string;
      roofCover: string;
      roofShape: string;
    };
  };
  utilities?: {
    coolingType: string;
    heatingType: string;
  };
  vintage?: {
    lastModified: string;
    pubDate: string;
  };
  owner?: {
    owner1?: {
      fullName: string;
      lastName: string;
      firstName: string;
    };
    owner2?: {
      fullName: string;
    };
    owner3?: {
      fullName: string;
    };
    owner4?: {
      fullName: string;
    };
    mailingAddressOneLine: string;
    absenteeInd: string;
  };
  assessment?: {
    assessed: {
      assdImprValue: number;
      assdLandValue: number;
      assdTtlValue: number;
    };
    market: {
      mktImprValue: number;
      mktLandValue: number;
      mktTtlValue: number;
    };
    tax: {
      taxAmt: number;
      taxYear: number;
    };
  };
  sale?: {
    saleSearchDate: string;
    saleTransDate: string;
    amount: {
      saleAmt: number;
      saleCode: string;
    };
    calculation: {
      pricePerBed: number;
      pricePerSizeUnit: number;
    };
  };
}

export interface ATTOMSearchResult {
  status: {
    version: string;
    code: number;
    msg: string;
    total: number;
    page: number;
    pagesize: number;
  };
  property: ATTOMProperty[];
}

async function attomRequest<T>(
  endpoint: string,
  params?: Record<string, string>
): Promise<T> {
  if (!ATTOM_API_KEY) {
    throw new Error("ATTOM API key not configured");
  }

  const url = new URL(`${ATTOM_BASE_URL}${endpoint}`);
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }

  console.log("[ATTOM] Request:", endpoint);

  const response = await fetch(url.toString(), {
    headers: {
      "Accept": "application/json",
      "APIKey": ATTOM_API_KEY,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("[ATTOM] API error:", response.status, error);
    throw new Error(`ATTOM API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Get property details by address
 */
export async function getPropertyByAddress(
  address1: string,
  address2: string
): Promise<ATTOMProperty | null> {
  try {
    const result = await attomRequest<ATTOMSearchResult>(
      "/propertyapi/v1.0.0/property/detail",
      {
        address1,
        address2,
      }
    );

    return result.property?.[0] || null;
  } catch (error) {
    console.error("[ATTOM] getPropertyByAddress error:", error);
    return null;
  }
}

/**
 * Get property details by coordinates (lat/lng)
 */
export async function getPropertyByLocation(
  lat: number,
  lng: number,
  radius: string = "0.1" // miles
): Promise<ATTOMProperty[]> {
  try {
    const result = await attomRequest<ATTOMSearchResult>(
      "/propertyapi/v1.0.0/property/snapshot",
      {
        latitude: lat.toString(),
        longitude: lng.toString(),
        radius,
        orderby: "distance",
      }
    );

    return result.property || [];
  } catch (error) {
    console.error("[ATTOM] getPropertyByLocation error:", error);
    return [];
  }
}

/**
 * Search properties within a geographic area
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
): Promise<ATTOMProperty[]> {
  try {
    const params: Record<string, string> = {
      latitude: lat.toString(),
      longitude: lng.toString(),
      radius: radiusMiles.toString(),
      orderby: "distance",
      pagesize: "50",
    };

    if (filters?.minYearBuilt) {
      params.minyearbuilt = filters.minYearBuilt.toString();
    }
    if (filters?.maxYearBuilt) {
      params.maxyearbuilt = filters.maxYearBuilt.toString();
    }
    if (filters?.propertyType) {
      params.propertytype = filters.propertyType;
    }

    const result = await attomRequest<ATTOMSearchResult>(
      "/propertyapi/v1.0.0/property/snapshot",
      params
    );

    return result.property || [];
  } catch (error) {
    console.error("[ATTOM] searchPropertiesInArea error:", error);
    return [];
  }
}

/**
 * Get properties with older roofs (good for storm damage leads)
 * Properties built before a certain year are more likely to need roof replacement
 */
export async function getOlderRoofProperties(
  lat: number,
  lng: number,
  radiusMiles: number = 2,
  maxYearBuilt: number = 2010 // Properties older than this
): Promise<ATTOMProperty[]> {
  return searchPropertiesInArea(lat, lng, radiusMiles, {
    maxYearBuilt,
    propertyType: "SFR", // Single Family Residential
  });
}

/**
 * Calculate estimated roof age from property data
 */
export function calculateRoofAge(property: ATTOMProperty): number {
  const yearBuilt = property.summary?.yearbuilt;
  if (!yearBuilt) return 20; // Default assumption
  
  const currentYear = new Date().getFullYear();
  const buildingAge = currentYear - yearBuilt;
  
  // Roofs are typically replaced every 20-25 years
  // If building is older, assume roof has been replaced at least once
  if (buildingAge > 25) {
    return buildingAge % 25; // Estimate based on replacement cycle
  }
  
  return buildingAge;
}

/**
 * Estimate potential claim value based on property characteristics
 */
export function estimateClaimValue(property: ATTOMProperty): {
  roofReplacement: number;
  siding: number;
  gutters: number;
  total: number;
  confidence: "low" | "medium" | "high";
} {
  const sqft = property.building?.size?.livingSize || 
               property.building?.size?.bldgSize || 
               1500; // Default
  
  // Industry averages for storm damage claims
  const roofCostPerSqft = 8.50; // Average cost per sq ft for roof replacement
  const sidingEstimate = sqft * 0.4 * 6; // 40% of home exterior, $6/sqft
  const guttersEstimate = Math.sqrt(sqft) * 4 * 12; // Perimeter estimate, $12/linear ft
  
  const roofReplacement = Math.round(sqft * roofCostPerSqft);
  const siding = Math.round(sidingEstimate);
  const gutters = Math.round(guttersEstimate);
  
  // Confidence based on data quality
  let confidence: "low" | "medium" | "high" = "medium";
  if (property.building?.size?.livingSize && property.building?.construction?.roofCover) {
    confidence = "high";
  } else if (!property.building?.size) {
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
 * Format ATTOM property to our standard PropertyLead format
 */
export function formatPropertyToLead(property: ATTOMProperty, stormScore: number = 0) {
  const roofAge = calculateRoofAge(property);
  const claimEstimate = estimateClaimValue(property);
  
  return {
    id: property.identifier?.attomId?.toString() || `attom-${Date.now()}`,
    address: property.address?.oneLine || property.address?.line1 || "Unknown",
    city: property.address?.locality || "",
    state: property.address?.countrySubd || "",
    zip: property.address?.postal1 || "",
    lat: parseFloat(property.location?.latitude) || 0,
    lng: parseFloat(property.location?.longitude) || 0,
    
    // Owner info
    ownerName: property.owner?.owner1?.fullName || "Unknown Owner",
    ownerFirstName: property.owner?.owner1?.firstName || "",
    ownerLastName: property.owner?.owner1?.lastName || "",
    
    // Property details
    yearBuilt: property.summary?.yearbuilt || null,
    sqft: property.building?.size?.livingSize || property.building?.size?.bldgSize || null,
    bedrooms: property.building?.rooms?.beds || null,
    bathrooms: property.building?.rooms?.bathsTotal || null,
    propertyType: property.summary?.proptype || "Residential",
    roofType: property.building?.construction?.roofCover || "Unknown",
    
    // Calculated fields
    roofAge,
    estimatedClaimValue: claimEstimate.total,
    stormScore,
    
    // Source
    source: "attom" as const,
    attomId: property.identifier?.attomId,
  };
}
