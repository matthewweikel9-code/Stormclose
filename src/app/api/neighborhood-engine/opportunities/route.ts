import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";
import { checkFeatureAccess } from "@/lib/subscriptions/access";
import {
	searchPropertiesInArea,
	getPropertyByAddress,
	getPropertyByLocation,
	CoreLogicProperty,
	CoreLogicError,
} from "@/lib/corelogic";
import {
	computeNeighborhoodScore,
	haversineMiles,
	type PropertyCandidate,
} from "@/lib/neighborhood-engine/score";
import { errorResponse, successResponse } from "@/utils/api-response";

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
	const key =
		process.env.GOOGLE_MAPS_API_KEY?.trim() ||
		process.env.GOOGLE_SOLAR_API_KEY?.trim();
	if (!key || !address?.trim()) return null;
	try {
		const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address.trim())}&key=${key}`;
		const res = await fetch(url);
		const data = await res.json();
		if (data.status === "OK" && data.results?.[0]?.geometry?.location) {
			const loc = data.results[0].geometry.location;
			return { lat: loc.lat, lng: loc.lng };
		}
	} catch (e) {
		console.warn("[Neighborhood Engine] Geocode failed:", e);
	}
	return null;
}

/** OpenStreetMap Overpass API fallback when CoreLogic has no coverage */
interface OSMAddressNode {
	type: string;
	id: number;
	lat: number;
	lon: number;
	tags?: {
		"addr:housenumber"?: string;
		"addr:street"?: string;
		"addr:city"?: string;
		"addr:state"?: string;
		"addr:postcode"?: string;
		"addr:full"?: string;
	};
}

interface OSMWayElement {
	type: string;
	id: number;
	center?: { lat: number; lon: number };
	tags?: Record<string, string>;
}

async function searchNearbyAddressesOverpass(
	lat: number,
	lng: number,
	radiusMiles: number = 1
): Promise<{ address: string; lat: number; lng: number; city?: string; state?: string; zip?: string }[]> {
	const radiusM = Math.round(radiusMiles * 1609.34); // miles to meters
	// Query both nodes and ways with addresses; ways use out center for lat/lng
	const query = `[out:json][timeout:15];
(
  node["addr:housenumber"](around:${radiusM},${lat},${lng});
  way["addr:housenumber"](around:${radiusM},${lat},${lng});
);
out body center;`;
	try {
		const res = await fetch("https://overpass-api.de/api/interpreter", {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: `data=${encodeURIComponent(query)}`,
			signal: AbortSignal.timeout(10000),
		});
		if (!res.ok) return [];
		const data = await res.json();
		const elements = (data.elements || []) as (OSMAddressNode & OSMWayElement)[];
		const seen = new Set<string>();
		const results: { address: string; lat: number; lng: number; city?: string; state?: string; zip?: string }[] = [];
		for (const el of elements) {
			let elLat: number;
			let elLng: number;
			if (el.type === "node") {
				elLat = el.lat;
				elLng = el.lon;
			} else if (el.type === "way" && el.center) {
				elLat = el.center.lat;
				elLng = el.center.lon;
			} else continue;
			const t = el.tags || {};
			const num = t["addr:housenumber"] || "";
			const street = t["addr:street"] || "";
			const city = t["addr:city"];
			const state = t["addr:state"];
			const zip = t["addr:postcode"];
			const full = t["addr:full"];
			let address: string;
			if (full && full.trim()) {
				address = full.trim();
			} else if (num && street) {
				address = `${num} ${street}`.trim();
			} else if (num || street) {
				address = (num + " " + street).trim();
			} else continue;
			const key = `${elLat.toFixed(5)},${elLng.toFixed(5)}`;
			if (seen.has(key)) continue;
			seen.add(key);
			results.push({ address, lat: elLat, lng: elLng, city, state, zip });
		}
		if (results.length > 0) {
			console.log(`[Neighborhood Engine] Overpass fallback: ${results.length} addresses near ${lat},${lng}`);
		}
		return results;
	} catch (e) {
		console.warn("[Neighborhood Engine] Overpass fallback failed:", e);
		return [];
	}
}

function propertyToCandidate(prop: CoreLogicProperty): PropertyCandidate {
	return {
		address: prop.address,
		lat: prop.lat,
		lng: prop.lng,
		yearBuilt: prop.yearBuilt,
		squareFootage: prop.squareFootage,
		marketValue: prop.marketValue,
		assessedValue: prop.assessedValue,
		roofType: prop.roofType,
		roofMaterial: prop.roofMaterial,
		owner: prop.owner,
		apn: prop.apn,
	};
}

function generateRecommendedScript(
	opportunityAddress: string,
	anchorAddress: string,
	actionLabel: string,
	estimatedLow?: number,
	estimatedHigh?: number
): string {
	const valueStr =
		estimatedLow && estimatedHigh
			? ` We estimate your roof at $${estimatedLow.toLocaleString()}–$${estimatedHigh.toLocaleString()} in repairs.`
			: "";
	return `Your property at ${opportunityAddress} is in the same area as ${anchorAddress}, where we're already working. We're offering free inspections to neighbors while we're in the area.${valueStr} Want a quick 15-minute assessment?`;
}

export async function GET(request: NextRequest) {
	try {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			return errorResponse("Unauthorized", 401);
		}

		const access = await checkFeatureAccess(user.id, "lead_generator");
		if (!access.allowed) {
			return errorResponse(access.reason ?? "Upgrade required", 403);
		}

		const { searchParams } = new URL(request.url);
		const address = searchParams.get("address");
		const lat = searchParams.get("lat");
		const lng = searchParams.get("lng");
		const radius = parseFloat(searchParams.get("radius") || "0.5");
		const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);

		let anchorLat: number;
		let anchorLng: number;
		let anchorAddress: string;

		if (address) {
			// Try CoreLogic first; split "street, city, state zip" for better match
			const parts = address.split(",").map((s) => s.trim());
			const address1 = parts[0] || address;
			const address2 = parts.slice(1).join(", ");
			let anchorProp = await getPropertyByAddress(address1, address2 || undefined);
			if (!anchorProp) {
				// Fallback: geocode address to lat/lng and search by location
				const coords = await geocodeAddress(address);
				if (coords) {
					anchorLat = coords.lat;
					anchorLng = coords.lng;
					anchorAddress = address;
				} else {
					return errorResponse("Anchor property not found for address", 404);
				}
			} else {
				anchorLat = anchorProp.lat;
				anchorLng = anchorProp.lng;
				anchorAddress = anchorProp.address;
			}
		} else if (lat && lng) {
			anchorLat = parseFloat(lat);
			anchorLng = parseFloat(lng);
			anchorAddress = `${anchorLat.toFixed(4)}, ${anchorLng.toFixed(4)}`;
		} else {
			return errorResponse("Provide address or lat/lng for anchor property", 400);
		}

		const hasCoreLogic =
			!!process.env.CORELOGIC_CONSUMER_KEY?.trim() &&
			!!process.env.CORELOGIC_CONSUMER_SECRET?.trim();

		let properties: Awaited<ReturnType<typeof searchPropertiesInArea>> = [];
		if (hasCoreLogic) {
			properties = await searchPropertiesInArea(anchorLat, anchorLng, radius);
			// Retry with larger radius (up to 1 mi) when CoreLogic returns empty
			if (properties.length === 0 && radius < 1) {
				properties = await searchPropertiesInArea(anchorLat, anchorLng, 1);
			}
			// Fallback: getPropertyByLocation includes all parcel types when residential filter yields nothing
			if (properties.length === 0) {
				properties = await getPropertyByLocation(anchorLat, anchorLng, 1);
			}
		}
		// Overpass (OpenStreetMap) fallback when CoreLogic has no parcels
		let source: "corelogic" | "openstreetmap" = "corelogic";
		if (properties.length === 0) {
			const osmAddresses = await searchNearbyAddressesOverpass(anchorLat, anchorLng, 1);
			if (osmAddresses.length > 0) {
				properties = osmAddresses.map((a) => ({
					address: a.address,
					city: a.city ?? "",
					state: a.state ?? "",
					zip: a.zip ?? "",
					lat: a.lat,
					lng: a.lng,
					owner: "",
					apn: "",
					propertyType: "Single Family",
					typeCode: "SFR",
					yearBuilt: 0,
					squareFootage: 0,
					lotSize: 0,
					bedrooms: 0,
					bathrooms: 0,
					stories: 1,
					roofType: "Unknown",
					roofMaterial: "Asphalt Shingle",
					roofAge: 15,
					assessedValue: 0,
					marketValue: 0,
					saleDate: null,
					salePrice: null,
					geometry: "",
					id: `osm-${a.lat}-${a.lng}`,
				}));
				source = "openstreetmap";
			}
		}
		if (properties.length === 0) {
			return successResponse({
				anchor: { address: anchorAddress, lat: anchorLat, lng: anchorLng },
				opportunities: [],
				totalFound: 0,
				source: "none",
				hint: !hasCoreLogic
					? "CoreLogic API keys not configured. Add CORELOGIC_CONSUMER_KEY and CORELOGIC_CONSUMER_SECRET to .env.local."
					: "No property data found for this area. CoreLogic and OpenStreetMap both returned no addresses.",
			});
		}

		const anchor = { lat: anchorLat, lng: anchorLng, address: anchorAddress };
		const scored = properties.map((prop) => {
			const candidate = propertyToCandidate(prop);
			const result = computeNeighborhoodScore(candidate, anchor);
			const recommendedScript = generateRecommendedScript(
				prop.address,
				anchorAddress,
				result.actionLabel,
				result.estimatedValueLow,
				result.estimatedValueHigh
			);
			return {
				address: prop.address,
				city: prop.city,
				state: prop.state,
				zip: prop.zip,
				coordinates: { lat: prop.lat, lng: prop.lng },
				opportunityScore: result.score,
				scoreBreakdown: result.breakdown,
				explanation: result.explanation,
				estimatedValueRange:
					result.estimatedValueLow && result.estimatedValueHigh
						? { low: result.estimatedValueLow, high: result.estimatedValueHigh }
						: null,
				anchorDistanceMiles: Math.round(
					haversineMiles(anchorLat, anchorLng, prop.lat, prop.lng) * 10
				) / 10,
				actionLabel: result.actionLabel,
				recommendedScript,
			};
		});

		// Sort by score descending, take top N
		scored.sort((a, b) => b.opportunityScore - a.opportunityScore);
		const opportunities = scored.slice(0, limit);

		return successResponse({
			anchor: { address: anchorAddress, lat: anchorLat, lng: anchorLng },
			opportunities,
			totalFound: properties.length,
			source,
		});
	} catch (error) {
		if (error instanceof CoreLogicError) {
			return errorResponse(error.message, error.status);
		}
		console.error("[Neighborhood Engine] Error:", error);
		return errorResponse(
			error instanceof Error ? error.message : "Failed to fetch opportunities",
			500
		);
	}
}
