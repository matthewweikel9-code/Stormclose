import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkFeatureAccess } from "@/lib/subscriptions";

export const runtime = "nodejs";
export const maxDuration = 30;

interface RoofSegment {
	pitchDegrees: number;
	azimuthDegrees: number;
	stats: {
		areaMeters2: number;
		sunshineQuantiles: number[];
	};
	center: {
		latitude: number;
		longitude: number;
	};
	planeHeightAtCenterMeters: number;
}

interface SolarApiResponse {
	name: string;
	center: {
		latitude: number;
		longitude: number;
	};
	regionCode: string;
	solarPotential: {
		maxArrayPanelsCount: number;
		maxArrayAreaMeters2: number;
		maxSunshineHoursPerYear: number;
		roofSegmentStats: Array<{
			pitchDegrees: number;
			azimuthDegrees: number;
			stats: {
				areaMeters2: number;
				sunshineQuantiles: number[];
			};
		}>;
		wholeRoofStats: {
			areaMeters2: number;
			sunshineQuantiles: number[];
			groundAreaMeters2: number;
		};
		buildingStats: {
			areaMeters2: number;
			sunshineQuantiles: number[];
			groundAreaMeters2: number;
		};
	};
	imageryDate: {
		year: number;
		month: number;
		day: number;
	};
	imageryProcessedDate: {
		year: number;
		month: number;
		day: number;
	};
}

interface MeasurementRequest {
	address: string;
}

// Convert square meters to roofing squares (100 sq ft = 1 square)
function metersToSquares(meters2: number): number {
	const sqFt = meters2 * 10.7639;
	return sqFt / 100;
}

function metersToSqFt(meters2: number): number {
	return meters2 * 10.7639;
}

// Calculate pitch ratio from degrees (e.g., 18.43° = 4/12 pitch)
function degreesToPitchRatio(degrees: number): string {
	const rise = Math.tan((degrees * Math.PI) / 180) * 12;
	return `${Math.round(rise)}/12`;
}

// Get price multiplier based on pitch
function getPitchMultiplier(degrees: number): number {
	if (degrees < 15) return 1.0; // Walkable
	if (degrees < 25) return 1.1; // Moderate
	if (degrees < 35) return 1.25; // Steep
	return 1.4; // Very steep
}

export async function POST(request: Request) {
	try {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Check feature access
		const access = await checkFeatureAccess(user.id, "roof_measurement");
		if (!access.allowed) {
			return NextResponse.json(
				{ error: access.reason, tier: access.tier },
				{ status: 403 }
			);
		}

		const body = (await request.json()) as MeasurementRequest;
		const { address } = body;

		if (!address) {
			return NextResponse.json(
				{ error: "Address is required" },
				{ status: 400 }
			);
		}

		const apiKey = process.env.GOOGLE_SOLAR_API_KEY;
		if (!apiKey) {
			return NextResponse.json(
				{ error: "Google Solar API key not configured" },
				{ status: 500 }
			);
		}

		// Step 1: Geocode the address to get lat/lng
		const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
		const geocodeRes = await fetch(geocodeUrl);
		const geocodeData = await geocodeRes.json();

		if (geocodeData.status !== "OK" || !geocodeData.results?.[0]) {
			return NextResponse.json(
				{ error: "Could not find address. Please check and try again." },
				{ status: 400 }
			);
		}

		const location = geocodeData.results[0].geometry.location;
		const formattedAddress = geocodeData.results[0].formatted_address;

		// Step 2: Call Google Solar API for building insights
		const solarUrl = `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${location.lat}&location.longitude=${location.lng}&requiredQuality=HIGH&key=${apiKey}`;
		
		const solarRes = await fetch(solarUrl);
		
		if (!solarRes.ok) {
			const errorText = await solarRes.text();
			console.error("Solar API error:", errorText);
			
			// Try with MEDIUM quality if HIGH fails
			const solarUrlMedium = `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${location.lat}&location.longitude=${location.lng}&requiredQuality=MEDIUM&key=${apiKey}`;
			const solarResMedium = await fetch(solarUrlMedium);
			
			if (!solarResMedium.ok) {
				return NextResponse.json(
					{ error: "Roof data not available for this address. This may be a new construction or rural area." },
					{ status: 404 }
				);
			}
			
			const solarData = await solarResMedium.json() as SolarApiResponse;
			return processAndReturnData(solarData, formattedAddress, location);
		}

		const solarData = await solarRes.json() as SolarApiResponse;
		return processAndReturnData(solarData, formattedAddress, location);

	} catch (error) {
		console.error("Roof measurement error:", error);
		return NextResponse.json(
			{ error: "Failed to get roof measurements" },
			{ status: 500 }
		);
	}
}

function processAndReturnData(solarData: SolarApiResponse, formattedAddress: string, location: { lat: number; lng: number }) {
	const roofStats = solarData.solarPotential?.wholeRoofStats;
	const segments = solarData.solarPotential?.roofSegmentStats || [];

	if (!roofStats) {
		return NextResponse.json(
			{ error: "No roof data available for this building" },
			{ status: 404 }
		);
	}

	// Calculate total roof area
	const totalAreaSqFt = metersToSqFt(roofStats.areaMeters2);
	const totalSquares = metersToSquares(roofStats.areaMeters2);
	const groundAreaSqFt = metersToSqFt(roofStats.groundAreaMeters2 || roofStats.areaMeters2);

	// Process segments
	const roofSegments = segments.map((seg, index) => {
		const areaSqFt = metersToSqFt(seg.stats.areaMeters2);
		const pitchRatio = degreesToPitchRatio(seg.pitchDegrees);
		const pitchMultiplier = getPitchMultiplier(seg.pitchDegrees);

		return {
			id: index + 1,
			areaSqFt: Math.round(areaSqFt),
			pitchDegrees: Math.round(seg.pitchDegrees * 10) / 10,
			pitchRatio,
			azimuthDegrees: Math.round(seg.azimuthDegrees),
			direction: getDirection(seg.azimuthDegrees),
			pitchMultiplier,
		};
	});

	// Calculate average pitch
	const avgPitch = segments.length > 0
		? segments.reduce((sum, seg) => sum + seg.pitchDegrees, 0) / segments.length
		: 0;

	// Estimate materials (rough calculation)
	const wasteFactor = 1.15; // 15% waste
	const bundlesPerSquare = 3;
	const estimatedBundles = Math.ceil(totalSquares * wasteFactor * bundlesPerSquare);
	
	// Pricing estimates (based on typical ranges)
	const basePricePerSquare = 350; // Average installed price
	const pitchMultiplier = getPitchMultiplier(avgPitch);
	const estimatedCostLow = Math.round(totalSquares * basePricePerSquare * pitchMultiplier * 0.8);
	const estimatedCostHigh = Math.round(totalSquares * basePricePerSquare * pitchMultiplier * 1.2);

	// Imagery date
	const imageryDate = solarData.imageryDate
		? `${solarData.imageryDate.month}/${solarData.imageryDate.day}/${solarData.imageryDate.year}`
		: "Unknown";

	return NextResponse.json({
		success: true,
		address: formattedAddress,
		coordinates: location,
		measurements: {
			totalAreaSqFt: Math.round(totalAreaSqFt),
			totalSquares: Math.round(totalSquares * 10) / 10,
			groundAreaSqFt: Math.round(groundAreaSqFt),
			facetCount: segments.length,
			avgPitchDegrees: Math.round(avgPitch * 10) / 10,
			avgPitchRatio: degreesToPitchRatio(avgPitch),
		},
		segments: roofSegments,
		estimates: {
			shingleBundles: estimatedBundles,
			underlaymentRolls: Math.ceil(totalSquares / 4),
			ridgeCapBundles: Math.ceil(segments.length / 2),
			dripEdgeFeet: Math.round(Math.sqrt(groundAreaSqFt) * 4),
			costRange: {
				low: estimatedCostLow,
				high: estimatedCostHigh,
			},
		},
		imageryDate,
		dataQuality: "HIGH",
	});
}

function getDirection(azimuth: number): string {
	if (azimuth >= 337.5 || azimuth < 22.5) return "North";
	if (azimuth >= 22.5 && azimuth < 67.5) return "Northeast";
	if (azimuth >= 67.5 && azimuth < 112.5) return "East";
	if (azimuth >= 112.5 && azimuth < 157.5) return "Southeast";
	if (azimuth >= 157.5 && azimuth < 202.5) return "South";
	if (azimuth >= 202.5 && azimuth < 247.5) return "Southwest";
	if (azimuth >= 247.5 && azimuth < 292.5) return "West";
	return "Northwest";
}
