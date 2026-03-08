import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkFeatureAccess } from "@/lib/subscriptions";

const CORELOGIC_API_KEY = process.env.CORELOGIC_API_KEY;
const CORELOGIC_API_SECRET = process.env.CORELOGIC_API_SECRET;
const CORELOGIC_BASE_URL = "https://api-prod.corelogic.com";

// Token cache
let accessToken: string | null = null;
let tokenExpiry: number = 0;

// Get OAuth2 access token using Basic Auth
async function getAccessToken(): Promise<string | null> {
	// Return cached token if still valid (with 60s buffer)
	if (accessToken && Date.now() < tokenExpiry - 60000) {
		return accessToken;
	}

	try {
		const credentials = Buffer.from(`${CORELOGIC_API_KEY}:${CORELOGIC_API_SECRET}`).toString("base64");
		
		const response = await fetch(`${CORELOGIC_BASE_URL}/oauth/token?grant_type=client_credentials`, {
			method: "POST",
			headers: {
				"Authorization": `Basic ${credentials}`,
				"Content-Length": "0"
			}
		});

		if (!response.ok) {
			console.error("CoreLogic OAuth error:", await response.text());
			return null;
		}

		const data = await response.json();
		accessToken = data.access_token;
		tokenExpiry = Date.now() + (parseInt(data.expires_in) * 1000);
		console.log("CoreLogic token obtained, expires in:", data.expires_in, "seconds");
		return accessToken;
	} catch (error) {
		console.error("CoreLogic OAuth error:", error);
		return null;
	}
}

// Helper to make CoreLogic API calls
async function corelogicRequest(endpoint: string, params?: Record<string, string>, contentType?: string) {
	const token = await getAccessToken();
	if (!token) {
		throw new Error("Failed to authenticate with CoreLogic");
	}

	const url = new URL(`${CORELOGIC_BASE_URL}${endpoint}`);
	if (params) {
		Object.entries(params).forEach(([key, value]) => {
			url.searchParams.append(key, value);
		});
	}

	const response = await fetch(url.toString(), {
		headers: {
			"Authorization": `Bearer ${token}`,
			"Content-Type": contentType || "application/json",
			"Accept": "application/json"
		}
	});

	if (!response.ok) {
		const error = await response.text();
		console.error("CoreLogic API error:", response.status, error);
		throw new Error(`CoreLogic API error: ${response.status}`);
	}

	return response.json();
}

// Search properties by address using Property API
async function searchPropertyByAddress(address: string, zip?: string): Promise<any> {
	try {
		const params: Record<string, string> = { address };
		if (zip) params.zip5 = zip;
		
		const data = await corelogicRequest("/property", params, "application/vnd.corelogic.v1+json");
		return data.data || [];
	} catch (error) {
		console.error("Property search error:", error);
		return [];
	}
}

// Get property building details
async function getPropertyBuilding(propertyId: string): Promise<any> {
	try {
		const data = await corelogicRequest(`/property/${encodeURIComponent(propertyId)}/building`, undefined, "application/vnd.corelogic.v1+json");
		return data;
	} catch (error) {
		console.error("Property building error:", error);
		return null;
	}
}

// Get property ownership details
async function getPropertyOwnership(propertyId: string): Promise<any> {
	try {
		const data = await corelogicRequest(`/property/${encodeURIComponent(propertyId)}/ownership`, undefined, "application/vnd.corelogic.v1+json");
		return data;
	} catch (error) {
		console.error("Property ownership error:", error);
		return null;
	}
}

// Get property tax assessment
async function getPropertyTaxAssessment(propertyId: string): Promise<any> {
	try {
		const data = await corelogicRequest(`/property/${encodeURIComponent(propertyId)}/tax-assessment`, undefined, "application/vnd.corelogic.v1+json");
		return data;
	} catch (error) {
		console.error("Property tax assessment error:", error);
		return null;
	}
}

// Spatial search - get parcels within a radius using Spatial Tile API
async function spatialSearch(params: {
	lat: number;
	lon: number;
	within?: number; // in meters
	pageNumber?: number;
	pageSize?: number;
}): Promise<any> {
	try {
		const queryParams: Record<string, string> = {
			lat: params.lat.toString(),
			lon: params.lon.toString(),
			within: (params.within || 1000).toString(), // Default 1000 meters (~0.6 miles)
			pageNumber: (params.pageNumber || 1).toString(),
			pageSize: (params.pageSize || 50).toString()
		};

		const data = await corelogicRequest("/spatial-tile/parcels", queryParams);
		return data;
	} catch (error) {
		console.error("Spatial search error:", error);
		return { parcels: [], pageInfo: { length: 0 } };
	}
}

// Process parcel data from Spatial Tile API into our format
function formatParcel(parcel: any) {
	return {
		id: parcel.parcelId?.toString() || parcel.apn,
		address: {
			full: `${parcel.stdAddr || parcel.addr || ""}, ${parcel.stdCity || parcel.city || ""}, ${parcel.stdState || parcel.state || ""} ${parcel.stdZip || parcel.zip || ""}`.trim(),
			street: parcel.stdAddr || parcel.addr || "",
			city: parcel.stdCity || parcel.city || "",
			state: parcel.stdState || parcel.state || "",
			zip: parcel.stdZip || parcel.zip || ""
		},
		owner: {
			name: parcel.owner || "Unknown",
			mailingAddress: null
		},
		property: {
			apn: parcel.apn || "",
			fips: `${parcel.stateCode || ""}${parcel.countyCode || ""}`,
			type: parcel.typeCode || "",
			geometry: parcel.geometry || null
		},
		location: {
			// Extract centroid from geometry if available
			lat: null as number | null,
			lng: null as number | null
		}
	};
}

// Parse polygon geometry to get centroid
function getCentroidFromPolygon(geometryStr: string): { lat: number; lng: number } | null {
	try {
		// Parse POLYGON((...)) format
		const match = geometryStr.match(/POLYGON\(\(([^)]+)\)\)/i);
		if (!match) return null;
		
		const coordPairs = match[1].split(",").map(pair => {
			const [lng, lat] = pair.trim().split(/\s+/).map(Number);
			return { lat, lng };
		});
		
		if (coordPairs.length === 0) return null;
		
		// Calculate centroid
		const sumLat = coordPairs.reduce((sum, p) => sum + p.lat, 0);
		const sumLng = coordPairs.reduce((sum, p) => sum + p.lng, 0);
		
		return {
			lat: sumLat / coordPairs.length,
			lng: sumLng / coordPairs.length
		};
	} catch {
		return null;
	}
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

// Calculate estimated claim value based on property type
function estimateClaimValue(parcel: any, buildingData?: any): { low: number; high: number; average: number } {
	// Get living area from building data if available
	const sqFt = buildingData?.livingArea || buildingData?.totalBuildingArea || 2000;
	const stories = buildingData?.stories || 1;
	
	// Rough roofing estimate: $4-8 per sq ft of roof area
	// Roof area ≈ sqFt / stories * 1.15 (for pitch)
	const roofArea = (sqFt / (stories || 1)) * 1.15;
	
	return {
		low: Math.round(roofArea * 4),
		high: Math.round(roofArea * 8),
		average: Math.round(roofArea * 6)
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

		if (address) {
			// Search by address using Property API
			const results = await searchPropertyByAddress(address, zip || undefined);
			
			if (!results || results.length === 0) {
				return NextResponse.json({ properties: [], count: 0 });
			}

			// Format results
			const properties = results.map((p: any) => ({
				id: p.corelogicPropertyId || p.compositePropertyId,
				address: {
					full: `${p.streetAddress}, ${p.city}, ${p.state} ${p.zipcode}`,
					street: p.streetAddress,
					city: p.city,
					state: p.state,
					zip: p.zipcode
				},
				location: {
					lat: p.latitude,
					lng: p.longitude
				},
				property: {
					apn: p.apn,
					fips: p.fipsCode
				},
				links: p.links || []
			}));

			return NextResponse.json({
				properties,
				count: properties.length
			});
		}

		if (propertyId) {
			// Get single property details
			const [building, ownership, taxAssessment] = await Promise.all([
				getPropertyBuilding(propertyId),
				getPropertyOwnership(propertyId),
				getPropertyTaxAssessment(propertyId)
			]);

			return NextResponse.json({
				property: {
					id: propertyId,
					building,
					ownership,
					taxAssessment,
					estimatedRoofAge: estimateRoofAge(building?.yearBuilt),
					estimatedClaim: estimateClaimValue({}, building)
				}
			});
		}

		return NextResponse.json(
			{ error: "Provide 'address' or 'propertyId'" },
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
		if (!access.allowed) {
			return NextResponse.json({
				error: "Feature not available",
				reason: access.reason
			}, { status: 403 });
		}

		const body = await request.json();
		let { lat, lng, radius, pageNumber, pageSize, address, zipCode } = body;

		// If address or zipCode provided, geocode it first
		if ((address || zipCode) && (!lat || !lng)) {
			const searchQuery = address || zipCode;
			const GOOGLE_API_KEY = process.env.GOOGLE_SOLAR_API_KEY || "AIzaSyB4EuYOLXgQ0sd9AYlx0bJ709VcNLi9HyI";
			
			try {
				const geocodeResponse = await fetch(
					`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(searchQuery)}&key=${GOOGLE_API_KEY}`
				);
				const geocodeData = await geocodeResponse.json();
				
				if (geocodeData.status === "OK" && geocodeData.results?.length > 0) {
					const location = geocodeData.results[0].geometry.location;
					lat = location.lat;
					lng = location.lng;
					console.log("Geocoded address:", searchQuery, "to:", lat, lng);
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

		// Convert radius from miles to meters (1 mile = 1609.34 meters)
		const radiusMeters = (radius || 0.5) * 1609.34;

		// Spatial search for parcels using Spatial Tile API
		const spatialData = await spatialSearch({
			lat,
			lon: lng,
			within: radiusMeters,
			pageNumber: pageNumber || 1,
			pageSize: pageSize || 50
		});

		const parcels = spatialData.parcels || [];
		const pageInfo = spatialData.pageInfo || {};

		// Format parcels and calculate centroids
		const formattedProperties = parcels.map((parcel: any) => {
			const formatted = formatParcel(parcel);
			
			// Get centroid from geometry
			if (parcel.geometry) {
				const centroid = getCentroidFromPolygon(parcel.geometry);
				if (centroid) {
					formatted.location.lat = centroid.lat;
					formatted.location.lng = centroid.lng;
				}
			}
			
			// Add estimated claim value
			const estimatedClaim = estimateClaimValue(parcel);
			
			return {
				...formatted,
				estimatedRoofAge: null, // Would need building data for this
				estimatedClaim
			};
		});

		// Filter out properties without valid addresses (common areas, roads, etc.)
		const validProperties = formattedProperties.filter((p: any) => 
			p.address.street && 
			!p.address.street.startsWith("NA ") &&
			p.owner.name &&
			p.owner.name !== ""
		);

		// Calculate zone statistics
		const totalClaimValue = validProperties.reduce(
			(sum: number, p: any) => sum + (p.estimatedClaim?.average || 0), 0
		);

		return NextResponse.json({
			properties: validProperties,
			count: validProperties.length,
			totalParcels: pageInfo.length || parcels.length,
			zone: {
				center: { lat, lng },
				radius: radius || 0.5
			},
			pagination: {
				page: pageInfo.page || 1,
				pageSize: pageInfo.pageSize || 50,
				totalRecords: pageInfo.length || 0
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
		console.error("Spatial properties error:", error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Failed to search properties" },
			{ status: 500 }
		);
	}
}
