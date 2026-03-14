import { createHash } from "node:crypto";
import { CoreLogicError, CoreLogicProperty, searchPropertiesInArea } from "@/lib/corelogic";
import { ParcelCacheService } from "@/services/parcelCacheService";

type CorelogicSource = "corelogic" | "corelogic_cached" | "fallback";

export type CachedCoreLogicResult = {
	properties: CoreLogicProperty[];
	source: CorelogicSource;
};

type SearchOptions = {
	minYearBuilt?: number;
	maxYearBuilt?: number;
	propertyType?: string;
};

const CACHE_MIN_COUNT_THRESHOLD = 10;
const CACHE_STALE_HOURS = 24;

export async function searchPropertiesInAreaCached(
	lat: number,
	lng: number,
	radiusMiles: number,
	filters?: SearchOptions
): Promise<CachedCoreLogicResult> {
	const polygonWKT = circleToPolygonWKT(lat, lng, radiusMiles);

	let cachedRows: any[] = [];
	try {
		cachedRows = (await ParcelCacheService.getParcelsInPolygon(polygonWKT)) ?? [];
	} catch {
		cachedRows = [];
	}

	const cachedProperties = cachedRows.map(toCoreLogicPropertyFromCache).filter(Boolean) as CoreLogicProperty[];
	const stale = isCacheStale(cachedRows);
	const shouldRefresh = cachedProperties.length < CACHE_MIN_COUNT_THRESHOLD || stale;

	if (process.env.CORELOGIC_USE_FALLBACK === "true") {
		return {
			properties: cachedProperties.length > 0 ? cachedProperties.slice(0, 50) : getFallbackProperties(lat, lng, 10),
			source: cachedProperties.length > 0 ? "corelogic_cached" : "fallback",
		};
	}

	if (!shouldRefresh && cachedProperties.length > 0) {
		return {
			properties: cachedProperties.slice(0, 50),
			source: "corelogic_cached",
		};
	}

	try {
		const freshProperties = await searchPropertiesInArea(lat, lng, radiusMiles, filters);

		if (freshProperties.length > 0) {
			await Promise.allSettled(
				freshProperties.slice(0, 150).map((property) =>
					ParcelCacheService.upsertParcel({
						parcel_id: property.apn || property.id,
						address: property.address,
						lat: property.lat,
						lng: property.lng,
						geomWKT: property.geometry || null,
						roof_age: property.roofAge || null,
						property_value: property.marketValue || property.assessedValue || null,
						corelogic_hash: hashProperty(property),
					})
				)
			);

			return {
				properties: freshProperties,
				source: "corelogic",
			};
		}

		if (cachedProperties.length > 0) {
			return {
				properties: cachedProperties.slice(0, 50),
				source: "corelogic_cached",
			};
		}

		return {
			properties: getFallbackProperties(lat, lng, 10),
			source: "fallback",
		};
	} catch (error) {
		if (error instanceof CoreLogicError && error.status === 429 && cachedProperties.length > 0) {
			return {
				properties: cachedProperties.slice(0, 50),
				source: "corelogic_cached",
			};
		}

		if (cachedProperties.length > 0) {
			return {
				properties: cachedProperties.slice(0, 50),
				source: "corelogic_cached",
			};
		}

		return {
			properties: getFallbackProperties(lat, lng, 10),
			source: "fallback",
		};
	}
}

function hashProperty(property: CoreLogicProperty): string {
	const input = [
		property.id,
		property.apn,
		property.address,
		property.lat,
		property.lng,
		property.marketValue,
		property.assessedValue,
		property.roofAge,
	].join("|");

	return createHash("sha1").update(input).digest("hex");
}

function isCacheStale(rows: any[]): boolean {
	if (!rows.length) return true;
	const mostRecentMs = rows.reduce((acc, row) => {
		const time = row?.last_seen ? new Date(row.last_seen).getTime() : 0;
		return Math.max(acc, Number.isFinite(time) ? time : 0);
	}, 0);

	if (!mostRecentMs) return true;
	const staleMs = CACHE_STALE_HOURS * 60 * 60 * 1000;
	return Date.now() - mostRecentMs > staleMs;
}

function toCoreLogicPropertyFromCache(row: any): CoreLogicProperty | null {
	if (!row) return null;
	const roofAge = typeof row.roof_age === "number" && row.roof_age > 0 ? row.roof_age : 15;
	const currentYear = new Date().getFullYear();

	return {
		id: row.parcel_id || row.id,
		address: row.address || "Unknown Address",
		city: "",
		state: "",
		zip: "",
		lat: Number(row.lat) || 0,
		lng: Number(row.lng) || 0,
		owner: "Unknown",
		apn: row.parcel_id || row.id,
		propertyType: "Single Family Residential",
		typeCode: "SFR",
		yearBuilt: Math.max(currentYear - roofAge, 1900),
		squareFootage: 2000,
		lotSize: 0,
		bedrooms: 0,
		bathrooms: 0,
		stories: 1,
		roofType: "Asphalt Shingle",
		roofMaterial: "Asphalt Shingle",
		roofAge,
		assessedValue: Number(row.property_value) || 0,
		marketValue: Number(row.property_value) || 0,
		saleDate: null,
		salePrice: null,
		geometry: "",
	};
}

function getFallbackProperties(lat: number, lng: number, count: number): CoreLogicProperty[] {
	const currentYear = new Date().getFullYear();

	return Array.from({ length: count }, (_, index) => {
		const offsetLat = lat + ((index % 5) - 2) * 0.0021;
		const offsetLng = lng + (Math.floor(index / 5) - 1) * 0.0021;
		const roofAge = 8 + (index % 18);
		const value = 180000 + index * 22000;

		return {
			id: `fallback-${index + 1}`,
			address: `${100 + index} Fallback Ave`,
			city: "",
			state: "",
			zip: "",
			lat: offsetLat,
			lng: offsetLng,
			owner: "Unknown",
			apn: `FB-${index + 1}`,
			propertyType: "Single Family Residential",
			typeCode: "SFR",
			yearBuilt: currentYear - roofAge,
			squareFootage: 1500 + index * 120,
			lotSize: 0,
			bedrooms: 3,
			bathrooms: 2,
			stories: 1,
			roofType: "Asphalt Shingle",
			roofMaterial: "Asphalt Shingle",
			roofAge,
			assessedValue: value,
			marketValue: value,
			saleDate: null,
			salePrice: null,
			geometry: "",
		};
	});
}

function circleToPolygonWKT(lat: number, lng: number, radiusMiles: number, points = 24): string {
	const coords: string[] = [];
	const latRad = (lat * Math.PI) / 180;
	const latMiles = 69;
	const lngMiles = 69 * Math.cos(latRad);

	for (let i = 0; i <= points; i++) {
		const angle = (2 * Math.PI * i) / points;
		const dLat = (radiusMiles * Math.sin(angle)) / latMiles;
		const dLng = (radiusMiles * Math.cos(angle)) / Math.max(lngMiles, 0.000001);
		coords.push(`${lng + dLng} ${lat + dLat}`);
	}

	return `POLYGON((${coords.join(", ")}))`;
}
