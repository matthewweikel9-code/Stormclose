/**
 * Shared Google Solar API helper for fetching roof data.
 * Used by roof-measurement API and JobNimbus export to enrich lead notes.
 */

interface SolarApiResponse {
	solarPotential?: {
		wholeRoofStats?: {
			areaMeters2: number;
			groundAreaMeters2?: number;
		};
		roofSegmentStats?: Array<{
			pitchDegrees: number;
			azimuthDegrees: number;
			stats: { areaMeters2: number };
		}>;
	};
	imageryDate?: { year: number; month: number; day: number };
}

export interface RoofDataSummary {
	totalAreaSqFt: number;
	totalSquares: number;
	avgPitchDegrees: number;
	facetCount: number;
	costRange: { low: number; high: number };
	imageryDate: string;
}

function metersToSqFt(meters2: number): number {
	return meters2 * 10.7639;
}

function metersToSquares(meters2: number): number {
	return metersToSqFt(meters2) / 100;
}

function getPitchMultiplier(degrees: number): number {
	if (degrees < 15) return 1.0;
	if (degrees < 25) return 1.1;
	if (degrees < 35) return 1.25;
	return 1.4;
}

/**
 * Fetch roof data from Google Solar API.
 * Returns a summary suitable for CRM notes, or null if unavailable.
 * Does not throw - returns null on any error to avoid blocking export.
 */
export async function fetchRoofDataForNotes(
	address: string,
	lat: number,
	lng: number
): Promise<RoofDataSummary | null> {
	const apiKey = process.env.GOOGLE_SOLAR_API_KEY?.trim();
	if (!apiKey) {
		console.warn("[Solar API] GOOGLE_SOLAR_API_KEY not set - roof data will be omitted from exports");
		return null;
	}

	console.log("[Solar API] Fetching roof data for", address || "(geocode)", "lat=" + lat, "lng=" + lng);

	// Validate coordinates
	if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
		// Try geocoding if we have address but no coords
		if (!address?.trim()) return null;
		try {
			const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
			const geocodeRes = await fetch(geocodeUrl, { signal: AbortSignal.timeout(5000) });
			const geocodeData = await geocodeRes.json();
			if (geocodeData.status !== "OK" || !geocodeData.results?.[0]) return null;
			const loc = geocodeData.results[0].geometry.location;
			lat = loc.lat;
			lng = loc.lng;
		} catch {
			return null;
		}
	}

	try {
		const solarUrl = `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${lat}&location.longitude=${lng}&requiredQuality=HIGH&key=${apiKey}`;
		const solarRes = await fetch(solarUrl, { signal: AbortSignal.timeout(8000) });

		if (!solarRes.ok) {
			console.warn("[Solar API] HIGH quality failed:", solarRes.status, await solarRes.text().then((t) => t.slice(0, 200)));
			// Try MEDIUM quality fallback
			const solarUrlMedium = `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${lat}&location.longitude=${lng}&requiredQuality=MEDIUM&key=${apiKey}`;
			const solarResMedium = await fetch(solarUrlMedium, { signal: AbortSignal.timeout(8000) });
			if (!solarResMedium.ok) {
				console.warn("[Solar API] MEDIUM quality also failed:", solarResMedium.status);
				return null;
			}
			const roof = processSolarResponse(await solarResMedium.json() as SolarApiResponse);
			if (roof) console.log("[Solar API] Roof data fetched (MEDIUM):", roof.totalSquares, "squares");
			return roof;
		}

		const roof = processSolarResponse(await solarRes.json() as SolarApiResponse);
		if (roof) console.log("[Solar API] Roof data fetched:", roof.totalSquares, "squares");
		return roof;
	} catch (err) {
		console.warn("[Solar API] Roof fetch failed for export notes:", err);
		return null;
	}
}

function processSolarResponse(solarData: SolarApiResponse): RoofDataSummary | null {
	const roofStats = solarData.solarPotential?.wholeRoofStats;
	const segments = solarData.solarPotential?.roofSegmentStats || [];

	if (!roofStats?.areaMeters2) return null;

	const totalAreaSqFt = metersToSqFt(roofStats.areaMeters2);
	const totalSquares = metersToSquares(roofStats.areaMeters2);
	const avgPitch =
		segments.length > 0
			? segments.reduce((sum, s) => sum + s.pitchDegrees, 0) / segments.length
			: 0;
	const pitchMultiplier = getPitchMultiplier(avgPitch);
	const basePricePerSquare = 350;
	const estimatedCostLow = Math.round(totalSquares * basePricePerSquare * pitchMultiplier * 0.8);
	const estimatedCostHigh = Math.round(totalSquares * basePricePerSquare * pitchMultiplier * 1.2);

	const imageryDate = solarData.imageryDate
		? `${solarData.imageryDate.month}/${solarData.imageryDate.day}/${solarData.imageryDate.year}`
		: "Unknown";

	return {
		totalAreaSqFt: Math.round(totalAreaSqFt),
		totalSquares: Math.round(totalSquares * 10) / 10,
		avgPitchDegrees: Math.round(avgPitch * 10) / 10,
		facetCount: segments.length,
		costRange: { low: estimatedCostLow, high: estimatedCostHigh },
		imageryDate,
	};
}

/**
 * Format roof data as a string for JobNimbus notes.
 */
export function formatRoofDataForNotes(roof: RoofDataSummary): string {
	const lines = [
		"",
		"--- Roof Data (Google Solar API) ---",
		`Total: ${roof.totalSquares} squares (${roof.totalAreaSqFt.toLocaleString()} sq ft)`,
		`Avg pitch: ${roof.avgPitchDegrees}°`,
		`Facets: ${roof.facetCount}`,
		`Est. cost: $${roof.costRange.low.toLocaleString()} - $${roof.costRange.high.toLocaleString()}`,
		`Imagery: ${roof.imageryDate}`,
	];
	return lines.join("\n");
}
