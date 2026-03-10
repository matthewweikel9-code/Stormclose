import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkFeatureAccess } from "@/lib/subscriptions";

// ATTOM API Configuration
const ATTOM_API_KEY = process.env.ATTOM_API_KEY;
const ATTOM_BASE_URL = "https://api.gateway.attomdata.com";

// Log if credentials are present (not the values themselves)
console.log("[ATTOM] API Key present:", !!ATTOM_API_KEY);

// Helper to make ATTOM API calls
async function attomRequest(endpoint: string, params?: Record<string, string>): Promise<any> {
	if (!ATTOM_API_KEY) {
		throw new Error("ATTOM API key not configured");
	}

	const url = new URL(`${ATTOM_BASE_URL}${endpoint}`);
	if (params) {
		Object.entries(params).forEach(([key, value]) => {
			url.searchParams.append(key, value);
		});
	}

	console.log("[ATTOM] Request:", url.pathname + url.search);

	const response = await fetch(url.toString(), {
		headers: {
			"APIKey": ATTOM_API_KEY,
			"Accept": "application/json"
		}
	});

	if (!response.ok) {
		const error = await response.text();
		console.error("[ATTOM] API error:", response.status, error);
		throw new Error(`ATTOM API error: ${response.status} - ${error}`);
	}

	return response.json();
}

// Search properties within a radius using ATTOM Property Detail API (more complete data)
async function searchPropertiesByRadius(params: {
	lat: number;
	lng: number;
	radius?: number; // in miles (ATTOM default is 5, max is 20)
	pageSize?: number;
	page?: number;
}): Promise<{ properties: any[]; total: number; error?: string }> {
	try {
		const queryParams: Record<string, string> = {
			latitude: params.lat.toString(),
			longitude: params.lng.toString(),
			radius: (params.radius || 3).toString(), // Default 3 miles
			pageSize: (params.pageSize || 50).toString(),
			page: (params.page || 1).toString(),
			orderBy: "distance asc",
			// Include all residential property types useful for roofing
			propertytype: "SFR|CONDO|TOWNHOUSE|MOBILE|DUPLEX|TRIPLEX|QUADPLEX"
		};

		console.log("[ATTOM] Radius search params:", JSON.stringify(queryParams));
		// Use /property/detail instead of /property/snapshot for complete property data
		const data = await attomRequest("/propertyapi/v1.0.0/property/detail", queryParams);
		
		const properties = data?.property || [];
		const total = data?.status?.total || properties.length;
		
		console.log("[ATTOM] Radius search returned:", properties.length, "properties, total:", total);
		return { properties, total };
	} catch (error) {
		console.error("[ATTOM] Radius search error:", error);
		return { 
			properties: [], 
			total: 0, 
			error: error instanceof Error ? error.message : "Unknown error" 
		};
	}
}

// Search properties by zip code
async function searchPropertiesByZip(params: {
	postalCode: string;
	pageSize?: number;
	page?: number;
}): Promise<{ properties: any[]; total: number; error?: string }> {
	try {
		const queryParams: Record<string, string> = {
			postalcode: params.postalCode,
			pageSize: (params.pageSize || 50).toString(),
			page: (params.page || 1).toString(),
			// Include all residential property types useful for roofing
			propertytype: "SFR|CONDO|TOWNHOUSE|MOBILE|DUPLEX|TRIPLEX|QUADPLEX"
		};

		console.log("[ATTOM] Zip search params:", JSON.stringify(queryParams));
		// Use /property/detail for complete property data including sqft, beds, baths
		const data = await attomRequest("/propertyapi/v1.0.0/property/detail", queryParams);
		
		const properties = data?.property || [];
		const total = data?.status?.total || properties.length;
		
		console.log("[ATTOM] Zip search returned:", properties.length, "properties");
		return { properties, total };
	} catch (error) {
		console.error("[ATTOM] Zip search error:", error);
		return { 
			properties: [], 
			total: 0, 
			error: error instanceof Error ? error.message : "Unknown error" 
		};
	}
}

// Search property by address
async function searchPropertyByAddress(address1: string, address2: string): Promise<any[]> {
	try {
		const queryParams: Record<string, string> = {
			address1: address1,
			address2: address2
		};

		console.log("[ATTOM] Address search:", address1, address2);
		const data = await attomRequest("/propertyapi/v1.0.0/property/detail", queryParams);
		
		return data?.property ? [data.property] : [];
	} catch (error) {
		console.error("[ATTOM] Address search error:", error);
		return [];
	}
}

// Get property details by ATTOM ID
async function getPropertyDetail(attomId: string): Promise<any> {
	try {
		const data = await attomRequest("/propertyapi/v1.0.0/property/detail", {
			attomId: attomId
		});
		return data?.property || null;
	} catch (error) {
		console.error("[ATTOM] Property detail error:", error);
		return null;
	}
}

// Get property with owner information
async function getPropertyDetailWithOwner(attomId: string): Promise<any> {
	try {
		const data = await attomRequest("/propertyapi/v1.0.0/property/detailowner", {
			attomId: attomId
		});
		return data?.property || null;
	} catch (error) {
		console.error("[ATTOM] Property detail with owner error:", error);
		return null;
	}
}

// Format ATTOM property to our standard format
function formatAttomProperty(prop: any) {
	const address = prop.address || {};
	const location = prop.location || {};
	const summary = prop.summary || {};
	const building = prop.building || {};
	const lot = prop.lot || {};
	const identifier = prop.identifier || {};
	const size = building.size || {};
	const rooms = building.rooms || {};
	const construction = building.construction || {};
	
	// ATTOM uses lowercase field names
	const sqft = size.livingsize || size.livingSize || size.universalsize || size.universalSize || null;
	const beds = rooms.beds || null;
	const baths = rooms.bathstotal || rooms.bathsTotal || null;
	const stories = building.summary?.stories || 1;
	const yearBuilt = summary.yearbuilt || summary.yearBuilt || null;
	
	return {
		id: identifier.attomId || identifier.Id || `attom-${Date.now()}`,
		address: {
			full: `${address.line1 || address.oneLine || ""}, ${address.locality || ""}, ${address.countrySubd || ""} ${address.postal1 || ""}`.trim(),
			street: address.line1 || address.oneLine || "",
			city: address.locality || "",
			state: address.countrySubd || "",
			zip: address.postal1 || ""
		},
		owner: {
			name: prop.owner?.owner1?.fullName || prop.owner?.absenteeOwnerStatus || "Unknown",
			mailingAddress: prop.owner?.mailAddress?.oneLine || null
		},
		property: {
			apn: identifier.apn || "",
			fips: identifier.fips || "",
			type: summary.propType || summary.proptype || summary.propSubType || "",
			yearBuilt: yearBuilt,
			sqft: sqft,
			bedrooms: beds,
			bathrooms: baths,
			stories: stories,
			lotSize: lot.lotSize1 || lot.lotsize1 || lot.lotSize2 || lot.lotsize2 || null,
			roofType: construction.roofcover || construction.roofCover || null,
			condition: construction.condition || null
		},
		location: {
			lat: location.latitude || null,
			lng: location.longitude || null,
			distance: location.distance || null
		},
		valuation: {
			assessed: prop.assessment?.assessed?.assdTtlValue || prop.assessment?.assessed?.assdttlvalue || null,
			market: prop.assessment?.market?.mktTtlValue || prop.assessment?.market?.mktttlvalue || null,
			avm: prop.avm?.amount?.value || null
		}
	};
}

// Estimate roof age from year built
function estimateRoofAge(yearBuilt: number | undefined | null): number | null {
	if (!yearBuilt) return null;
	const currentYear = new Date().getFullYear();
	const propertyAge = currentYear - yearBuilt;
	
	// Assume roof replaced every 20-25 years on average
	if (propertyAge <= 25) return propertyAge;
	return propertyAge % 22; // Rough estimate
}

// Calculate estimated claim value based on property data
function estimateClaimValue(prop: any): { low: number; high: number; average: number } {
	// Get living area from property data
	const sqFt = prop.property?.sqft || 0;
	const stories = prop.property?.stories || 1;
	const assessedValue = prop.valuation?.assessed || prop.valuation?.market || 0;
	
	// If we have sqft, use it for roofing estimate
	// Roof area ≈ sqFt / stories * 1.15 (for pitch factor)
	// Roofing cost: $5-10 per sq ft of roof area (2024 prices)
	let roofArea = 0;
	
	if (sqFt > 0) {
		roofArea = (sqFt / (stories || 1)) * 1.15;
	} else if (assessedValue > 0) {
		// Fallback: estimate sqft from assessed value
		// Average $150-200/sqft for residential properties
		const estimatedSqft = assessedValue / 175;
		roofArea = (estimatedSqft / (stories || 1)) * 1.15;
	} else {
		// Last resort: assume average home (2000 sqft)
		roofArea = 2000 * 1.15;
	}
	
	// Roofing materials + labor: $5-10 per sqft depending on material
	// Including tear-off, underlayment, and installation
	return {
		low: Math.round(roofArea * 5),
		high: Math.round(roofArea * 10),
		average: Math.round(roofArea * 7.5)
	};
}

export async function GET(request: NextRequest) {
	try {
		// Check authentication
		const supabase = await createClient();
		const { data: { user } } = await supabase.auth.getUser();

		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Check feature access
		const access = await checkFeatureAccess(user.id, "lead_generator");
		if (!access.allowed) {
			return NextResponse.json({
				error: "Feature not available",
				reason: access.reason,
				tier: access.tier
			}, { status: 403 });
		}

		const searchParams = request.nextUrl.searchParams;
		const address = searchParams.get("address");
		const zip = searchParams.get("zip");
		const propertyId = searchParams.get("propertyId");
		const attomId = searchParams.get("attomId");

		if (address && zip) {
			// Search by address using ATTOM Property API
			// ATTOM expects address1 (street) and address2 (city, state zip)
			const results = await searchPropertyByAddress(address, zip);
			
			if (!results || results.length === 0) {
				return NextResponse.json({ properties: [], count: 0 });
			}

			// Format results
			const properties = results.map((p: any) => formatAttomProperty(p));

			return NextResponse.json({
				properties,
				count: properties.length
			});
		}

		if (attomId || propertyId) {
			// Get single property details
			const property = await getPropertyDetailWithOwner(attomId || propertyId!);
			
			if (!property) {
				return NextResponse.json({ error: "Property not found" }, { status: 404 });
			}

			const formatted = formatAttomProperty(property);
			
			return NextResponse.json({
				property: {
					...formatted,
					estimatedRoofAge: estimateRoofAge(formatted.property.yearBuilt),
					estimatedClaim: estimateClaimValue(formatted)
				}
			});
		}

		return NextResponse.json(
			{ error: "Provide 'address' with 'zip', or 'attomId'" },
			{ status: 400 }
		);

	} catch (error) {
		console.error("Properties API error:", error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Failed to get property data" },
			{ status: 500 }
		);
	}
}

// POST endpoint for spatial/radius property search
export async function POST(request: NextRequest) {
	try {
		const supabase = await createClient();
		const { data: { user } } = await supabase.auth.getUser();

		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Check feature access
		const access = await checkFeatureAccess(user.id, "lead_generator");
		console.log("[Properties API] User:", user.id, "Access:", JSON.stringify(access));
		if (!access.allowed) {
			return NextResponse.json({
				error: "Feature not available",
				reason: access.reason
			}, { status: 403 });
		}

		const body = await request.json();
		console.log("[Properties API] Request body:", JSON.stringify(body));
		let { lat, lng, radius, pageNumber, pageSize, address, zipCode } = body;

		// If address or zipCode provided, geocode it first
		if ((address || zipCode) && (!lat || !lng)) {
			const searchQuery = address || zipCode;
			const GOOGLE_API_KEY = process.env.GOOGLE_SOLAR_API_KEY || "AIzaSyB4EuYOLXgQ0sd9AYlx0bJ709VcNLi9HyI";
			console.log("[Properties API] Geocoding:", searchQuery);
			
			try {
				const geocodeResponse = await fetch(
					`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(searchQuery)}&key=${GOOGLE_API_KEY}`
				);
				const geocodeData = await geocodeResponse.json();
				console.log("[Properties API] Geocode result:", geocodeData.status);
				
				if (geocodeData.status === "OK" && geocodeData.results?.length > 0) {
					const location = geocodeData.results[0].geometry.location;
					lat = location.lat;
					lng = location.lng;
					console.log("[Properties API] Geocoded address:", searchQuery, "to:", lat, lng);
				} else {
					console.error("Geocode failed:", geocodeData.status, geocodeData.error_message);
					return NextResponse.json(
						{ error: `Could not find location for: ${searchQuery}` },
						{ status: 400 }
					);
				}
			} catch (geoError) {
				console.error("Geocoding error:", geoError);
				return NextResponse.json(
					{ error: "Failed to geocode address" },
					{ status: 500 }
				);
			}
		}

		if (!lat || !lng) {
			return NextResponse.json(
				{ error: "Provide 'address', 'zipCode', or 'lat' and 'lng' coordinates" },
				{ status: 400 }
			);
		}

		console.log("[Properties API] Searching at coordinates:", lat, lng, "radius:", radius || 3, "miles");

		// Use ATTOM radius search - supports up to 20 miles!
		const searchResult = await searchPropertiesByRadius({
			lat,
			lng,
			radius: Math.min(radius || 3, 20), // ATTOM max is 20 miles
			pageSize: pageSize || 50,
			page: pageNumber || 1
		});

		console.log("[Properties API] ATTOM search returned:", searchResult.properties.length, "properties");

		// Check if there was an API error
		if (searchResult.error) {
			console.error("[Properties API] ATTOM API error:", searchResult.error);
			return NextResponse.json(
				{ error: `Property search failed: ${searchResult.error}` },
				{ status: 500 }
			);
		}

		// Format properties
		const formattedProperties = searchResult.properties.map((prop: any) => {
			const formatted = formatAttomProperty(prop);
			const estimatedClaim = estimateClaimValue(formatted);
			const roofAge = estimateRoofAge(formatted.property.yearBuilt);
			
			return {
				...formatted,
				estimatedRoofAge: roofAge,
				estimatedClaim
			};
		});

		// Filter out properties without valid addresses (but keep those without owner info)
		const validProperties = formattedProperties.filter((p: any) => 
			p.address.street && 
			p.address.street.length > 3
		);

		// Calculate zone statistics
		const totalClaimValue = validProperties.reduce(
			(sum: number, p: any) => sum + (p.estimatedClaim?.average || 0), 0
		);

		return NextResponse.json({
			properties: validProperties,
			count: validProperties.length,
			totalParcels: searchResult.total,
			zone: {
				center: { lat, lng },
				radius: radius || 3
			},
			pagination: {
				page: pageNumber || 1,
				pageSize: pageSize || 50,
				totalRecords: searchResult.total
			},
			statistics: {
				totalProperties: validProperties.length,
				totalEstimatedClaimValue: totalClaimValue,
				avgClaimValue: Math.round(totalClaimValue / (validProperties.length || 1)),
				opportunity: {
					conservative: Math.round(totalClaimValue * 0.10), // 10% close rate
					moderate: Math.round(totalClaimValue * 0.15),    // 15% close rate
					optimistic: Math.round(totalClaimValue * 0.25)   // 25% close rate
				}
			}
		});

	} catch (error) {
		console.error("Properties API error:", error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Failed to search properties" },
			{ status: 500 }
		);
	}
}
