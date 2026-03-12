import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkFeatureAccess } from "@/lib/subscriptions";
import {
	searchPropertiesInArea,
	getPropertyByAddress,
	getPropertyByLocation,
	CoreLogicProperty,
	calculateRoofAge,
	estimateClaimValue,
} from "@/lib/corelogic";

// ─── Formatting ────────────────────────────────────────────────────────────

/**
 * Format a CoreLogicProperty to the standard response shape expected by the frontend
 */
function formatProperty(prop: CoreLogicProperty) {
	const roofAge = calculateRoofAge(prop);
	const claim = estimateClaimValue(prop);

	return {
		id: prop.id,
		address: {
			full: `${prop.address}, ${prop.city}, ${prop.state} ${prop.zip}`.trim(),
			street: prop.address,
			city: prop.city,
			state: prop.state,
			zip: prop.zip,
		},
		owner: {
			name: prop.owner,
			mailingAddress: null,
		},
		sale: {
			price: prop.salePrice,
			date: prop.saleDate,
		},
		property: {
			apn: prop.apn,
			fips: "",
			type: prop.propertyType,
			yearBuilt: prop.yearBuilt || null,
			sqft: prop.squareFootage || null,
			bedrooms: prop.bedrooms || null,
			bathrooms: prop.bathrooms || null,
			stories: prop.stories || 1,
			lotSize: prop.lotSize || null,
			roofType: prop.roofType || null,
			condition: null,
		},
		location: {
			lat: prop.lat || null,
			lng: prop.lng || null,
			distance: null,
		},
		valuation: {
			assessed: prop.assessedValue || null,
			market: prop.marketValue || null,
			avm: null,
		},
		estimatedRoofAge: roofAge,
		estimatedClaim: {
			low: Math.round((prop.squareFootage || 1500) * 5),
			high: Math.round((prop.squareFootage || 1500) * 10),
			average: claim.total,
		},
	};
}

// ─── GET: Single property lookup ───────────────────────────────────────────

export async function GET(request: NextRequest) {
	try {
		const supabase = await createClient();
		const { data: { user } } = await supabase.auth.getUser();

		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const access = await checkFeatureAccess(user.id, "lead_generator");
		if (!access.allowed) {
			return NextResponse.json({
				error: "Feature not available",
				reason: access.reason,
				tier: access.tier,
			}, { status: 403 });
		}

		const searchParams = request.nextUrl.searchParams;
		const address = searchParams.get("address");
		const zip = searchParams.get("zip");
		const propertyId = searchParams.get("propertyId");

		if (address) {
			// Search by address via CoreLogic
			const fullAddress = zip ? `${address}, ${zip}` : address;
			const property = await getPropertyByAddress(fullAddress);

			if (!property) {
				return NextResponse.json({ properties: [], count: 0 });
			}

			return NextResponse.json({
				properties: [formatProperty(property)],
				count: 1,
			});
		}

		if (propertyId) {
			// Lookup by APN / property ID — search by address isn't possible,
			// so return a helpful error
			return NextResponse.json(
				{ error: "Direct ID lookup not supported. Please search by address." },
				{ status: 400 }
			);
		}

		return NextResponse.json(
			{ error: "Provide 'address' (with optional 'zip') to search" },
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

// ─── POST: Spatial / radius property search ────────────────────────────────

export async function POST(request: NextRequest) {
	try {
		const supabase = await createClient();
		const { data: { user } } = await supabase.auth.getUser();

		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const access = await checkFeatureAccess(user.id, "lead_generator");
		console.log("[Properties API] User:", user.id, "Access:", JSON.stringify(access));
		if (!access.allowed) {
			return NextResponse.json({
				error: "Feature not available",
				reason: access.reason,
			}, { status: 403 });
		}

		const body = await request.json();
		console.log("[Properties API] Request body:", JSON.stringify(body));
		let { lat, lng, radius, address, zipCode } = body;

		// If address or zipCode provided, geocode it first
		if ((address || zipCode) && (!lat || !lng)) {
			const searchQuery = address || zipCode;
			const GOOGLE_API_KEY = process.env.GOOGLE_SOLAR_API_KEY || "";
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
					console.log("[Properties API] Geocoded:", searchQuery, "→", lat, lng);
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

		const searchRadius = Math.min(radius || 3, 10); // CoreLogic max practical radius
		console.log("[Properties API] Searching at:", lat, lng, "radius:", searchRadius, "miles");

		// Search via CoreLogic
		const properties = await searchPropertiesInArea(lat, lng, searchRadius);

		console.log("[Properties API] CoreLogic returned:", properties.length, "properties");

		// Format properties
		const formattedProperties = properties.map((prop) => formatProperty(prop));

		// Filter out properties without valid addresses
		const validProperties = formattedProperties.filter((p) =>
			p.address.street && p.address.street.length > 3
		);

		// Calculate zone statistics
		const totalClaimValue = validProperties.reduce(
			(sum, p) => sum + (p.estimatedClaim?.average || 0), 0
		);

		return NextResponse.json({
			properties: validProperties,
			count: validProperties.length,
			totalParcels: properties.length,
			zone: {
				center: { lat, lng },
				radius: searchRadius,
			},
			pagination: {
				page: 1,
				pageSize: validProperties.length,
				totalRecords: properties.length,
			},
			statistics: {
				totalProperties: validProperties.length,
				totalEstimatedClaimValue: totalClaimValue,
				avgClaimValue: Math.round(totalClaimValue / (validProperties.length || 1)),
				opportunity: {
					conservative: Math.round(totalClaimValue * 0.10),
					moderate: Math.round(totalClaimValue * 0.15),
					optimistic: Math.round(totalClaimValue * 0.25),
				},
			},
		});

	} catch (error) {
		console.error("Properties API error:", error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Failed to search properties" },
			{ status: 500 }
		);
	}
}
