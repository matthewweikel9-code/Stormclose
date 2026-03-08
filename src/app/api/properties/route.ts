import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkFeatureAccess } from "@/lib/subscriptions";

const CORELOGIC_API_KEY = process.env.CORELOGIC_API_KEY;
const CORELOGIC_BASE_URL = "https://api.corelogic.com";

// Helper to make CoreLogic API calls
async function corelogicRequest(endpoint: string, params?: Record<string, string>) {
	const url = new URL(`${CORELOGIC_BASE_URL}${endpoint}`);
	if (params) {
		Object.entries(params).forEach(([key, value]) => {
			url.searchParams.append(key, value);
		});
	}

	const response = await fetch(url.toString(), {
		headers: {
			"Authorization": `Bearer ${CORELOGIC_API_KEY}`,
			"Content-Type": "application/json",
			"Accept": "application/json"
		}
	});

	if (!response.ok) {
		const error = await response.text();
		console.error("CoreLogic API error:", error);
		throw new Error(`CoreLogic API error: ${response.status}`);
	}

	return response.json();
}

// Search properties by address
async function searchPropertyByAddress(address: string): Promise<any> {
	try {
		const data = await corelogicRequest("/property/v2/search", {
			address: address
		});
		return data;
	} catch (error) {
		console.error("Property search error:", error);
		return null;
	}
}

// Get property details by ID
async function getPropertyDetails(propertyId: string): Promise<any> {
	try {
		const data = await corelogicRequest(`/property/v2/${propertyId}`);
		return data;
	} catch (error) {
		console.error("Property details error:", error);
		return null;
	}
}

// Get property AVM (Automated Valuation)
async function getPropertyAVM(propertyId: string): Promise<any> {
	try {
		const data = await corelogicRequest(`/property/v2/${propertyId}/avm`);
		return data;
	} catch (error) {
		console.error("Property AVM error:", error);
		return null;
	}
}

// Spatial search - get properties within a polygon or radius
async function spatialSearch(params: {
	lat: number;
	lng: number;
	radius?: number; // in miles
	polygon?: number[][]; // [[lng, lat], ...]
}): Promise<any[]> {
	try {
		let endpoint = "/spatial/v1/properties";
		const queryParams: Record<string, string> = {};

		if (params.polygon) {
			// Polygon search
			queryParams.polygon = JSON.stringify(params.polygon);
		} else if (params.radius) {
			// Radius search
			queryParams.lat = params.lat.toString();
			queryParams.lng = params.lng.toString();
			queryParams.radius = params.radius.toString();
		} else {
			// Default 1 mile radius
			queryParams.lat = params.lat.toString();
			queryParams.lng = params.lng.toString();
			queryParams.radius = "1";
		}

		const data = await corelogicRequest(endpoint, queryParams);
		return data.properties || [];
	} catch (error) {
		console.error("Spatial search error:", error);
		return [];
	}
}

// Process property data into our format
function formatProperty(prop: any) {
	return {
		id: prop.propertyId || prop.id,
		address: {
			full: prop.address?.full || prop.streetAddress,
			street: prop.address?.street || prop.streetAddress,
			city: prop.address?.city,
			state: prop.address?.state,
			zip: prop.address?.zip
		},
		owner: {
			name: prop.owner?.name || prop.ownerName,
			mailingAddress: prop.owner?.mailingAddress
		},
		property: {
			type: prop.propertyType || prop.landUse,
			yearBuilt: prop.yearBuilt,
			squareFeet: prop.squareFeet || prop.livingArea,
			lotSize: prop.lotSize,
			bedrooms: prop.bedrooms,
			bathrooms: prop.bathrooms,
			stories: prop.stories,
			roofType: prop.roof?.type || prop.roofType,
			roofYear: prop.roof?.year || null // Estimated roof age
		},
		value: {
			estimated: prop.avm?.value || prop.estimatedValue,
			assessed: prop.assessedValue,
			taxAmount: prop.taxAmount,
			lastSalePrice: prop.lastSale?.price,
			lastSaleDate: prop.lastSale?.date
		},
		location: {
			lat: prop.location?.lat || prop.latitude,
			lng: prop.location?.lng || prop.longitude
		}
	};
}

// Estimate roof age from year built
function estimateRoofAge(yearBuilt: number | undefined): number | null {
	if (!yearBuilt) return null;
	const currentYear = new Date().getFullYear();
	const propertyAge = currentYear - yearBuilt;
	
	// Assume roof replaced every 20 years on average
	if (propertyAge <= 20) return propertyAge;
	return propertyAge % 20; // Rough estimate
}

// Calculate estimated claim value
function estimateClaimValue(property: any): { low: number; high: number; average: number } {
	const sqFt = property.property?.squareFeet || 2000;
	const stories = property.property?.stories || 1;
	
	// Rough roofing estimate: $4-8 per sq ft of roof area
	// Roof area ≈ sqFt / stories * 1.15 (for pitch)
	const roofArea = (sqFt / stories) * 1.15;
	
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
		const access = await checkFeatureAccess(user.id, "storm_command");
		if (!access.allowed) {
			return NextResponse.json({
				error: "Feature not available",
				reason: access.reason,
				tier: access.tier
			}, { status: 403 });
		}

		const searchParams = request.nextUrl.searchParams;
		const address = searchParams.get("address");
		const propertyId = searchParams.get("propertyId");

		if (address) {
			// Search by address
			const results = await searchPropertyByAddress(address);
			if (!results || results.length === 0) {
				return NextResponse.json({ properties: [], count: 0 });
			}

			const properties = results.map((p: any) => {
				const formatted = formatProperty(p);
				return {
					...formatted,
					estimatedRoofAge: estimateRoofAge(formatted.property.yearBuilt),
					estimatedClaim: estimateClaimValue(formatted)
				};
			});

			return NextResponse.json({
				properties,
				count: properties.length
			});
		}

		if (propertyId) {
			// Get single property details
			const [details, avm] = await Promise.all([
				getPropertyDetails(propertyId),
				getPropertyAVM(propertyId)
			]);

			if (!details) {
				return NextResponse.json({ error: "Property not found" }, { status: 404 });
			}

			const property = formatProperty({ ...details, avm });
			return NextResponse.json({
				property: {
					...property,
					estimatedRoofAge: estimateRoofAge(property.property.yearBuilt),
					estimatedClaim: estimateClaimValue(property)
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

// POST endpoint for spatial/bulk property search
export async function POST(request: NextRequest) {
	try {
		const supabase = await createClient();
		const { data: { user } } = await supabase.auth.getUser();

		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Check feature access
		const access = await checkFeatureAccess(user.id, "storm_command");
		if (!access.allowed) {
			return NextResponse.json({
				error: "Feature not available",
				reason: access.reason
			}, { status: 403 });
		}

		const body = await request.json();
		const { lat, lng, radius, polygon } = body;

		if (!lat || !lng) {
			return NextResponse.json(
				{ error: "Provide 'lat' and 'lng' coordinates" },
				{ status: 400 }
			);
		}

		// Spatial search for properties
		const properties = await spatialSearch({
			lat,
			lng,
			radius: radius || 1,
			polygon
		});

		// Format and enrich properties
		const formattedProperties = properties.map((p: any) => {
			const formatted = formatProperty(p);
			return {
				...formatted,
				estimatedRoofAge: estimateRoofAge(formatted.property.yearBuilt),
				estimatedClaim: estimateClaimValue(formatted)
			};
		});

		// Calculate zone statistics
		const totalValue = formattedProperties.reduce(
			(sum, p) => sum + (p.value?.estimated || 0), 0
		);
		const avgRoofAge = formattedProperties.reduce(
			(sum, p) => sum + (p.estimatedRoofAge || 15), 0
		) / (formattedProperties.length || 1);
		const totalClaimValue = formattedProperties.reduce(
			(sum, p) => sum + (p.estimatedClaim?.average || 0), 0
		);

		return NextResponse.json({
			properties: formattedProperties,
			count: formattedProperties.length,
			zone: {
				center: { lat, lng },
				radius: radius || 1
			},
			statistics: {
				totalProperties: formattedProperties.length,
				totalPropertyValue: totalValue,
				avgPropertyValue: Math.round(totalValue / (formattedProperties.length || 1)),
				avgRoofAge: Math.round(avgRoofAge),
				totalEstimatedClaimValue: totalClaimValue,
				avgClaimValue: Math.round(totalClaimValue / (formattedProperties.length || 1)),
				opportunity: {
					conservative: Math.round(totalClaimValue * 0.1), // 10% close rate
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
