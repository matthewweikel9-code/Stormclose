import { createClient } from "@supabase/supabase-js";

// Initialize Supabase admin client
const supabaseAdmin = createClient(
	process.env.NEXT_PUBLIC_SUPABASE_URL!,
	process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface HailEvent {
	id: string;
	event_date: string;
	size_inches: number;
	distance_miles: number;
	days_ago: number;
}

interface LeadScoreInput {
	latitude: number;
	longitude: number;
	yearBuilt?: number;
	roofSquares?: number;
	assessedValue?: number;
	squareFeet?: number;
}

interface LeadScoreResult {
	totalScore: number;
	stormProximityScore: number;
	roofAgeScore: number;
	roofSizeScore: number;
	propertyValueScore: number;
	hailHistoryScore: number;
	tier: "hot" | "warm" | "moderate" | "cold";
	nearestHailEvent: HailEvent | null;
	hailHistoryCount: number;
}

// Calculate storm proximity score (0-30 points)
function calculateStormProximityScore(nearestHail: HailEvent | null): number {
	if (!nearestHail) return 0;

	const { distance_miles: distance, days_ago: daysAgo, size_inches: size } = nearestHail;
	let score = 0;

	// Distance and recency scoring
	if (distance < 1 && daysAgo <= 7) score = 30;
	else if (distance < 1 && daysAgo <= 30) score = 25;
	else if (distance < 3 && daysAgo <= 7) score = 22;
	else if (distance < 3 && daysAgo <= 30) score = 18;
	else if (distance < 5 && daysAgo <= 7) score = 15;
	else if (distance < 5 && daysAgo <= 30) score = 12;
	else if (distance < 10 && daysAgo <= 30) score = 8;
	else if (distance < 10 && daysAgo <= 60) score = 5;

	// Bonus for large hail (golf ball or bigger)
	if (size >= 1.5) score = Math.min(score + 5, 35);

	return Math.min(score, 30); // Cap at 30
}

// Calculate roof age score (0-25 points)
function calculateRoofAgeScore(yearBuilt?: number): number {
	if (!yearBuilt) return 10; // Default middle score if unknown

	const currentYear = new Date().getFullYear();
	const roofAge = currentYear - yearBuilt;

	if (roofAge >= 20) return 25;
	if (roofAge >= 15) return 20;
	if (roofAge >= 10) return 15;
	if (roofAge >= 5) return 8;
	return 3;
}

// Calculate roof size score (0-15 points)
function calculateRoofSizeScore(roofSquares?: number, squareFeet?: number): number {
	// If we have roof squares directly, use them
	let squares = roofSquares;

	// Otherwise estimate from square footage (rough: sqft / 100 * 1.15 pitch factor)
	if (!squares && squareFeet) {
		squares = (squareFeet / 100) * 1.15;
	}

	if (!squares) return 8; // Default middle score if unknown

	if (squares >= 40) return 15;
	if (squares >= 30) return 12;
	if (squares >= 20) return 9;
	if (squares >= 15) return 6;
	return 3;
}

// Calculate property value score (0-15 points)
function calculatePropertyValueScore(assessedValue?: number): number {
	if (!assessedValue) return 8; // Default middle score if unknown

	if (assessedValue >= 500000) return 15;
	if (assessedValue >= 300000) return 12;
	if (assessedValue >= 200000) return 9;
	if (assessedValue >= 100000) return 6;
	return 3;
}

// Calculate hail history score (0-15 points)
function calculateHailHistoryScore(hailCount: number): number {
	if (hailCount >= 5) return 15;
	if (hailCount >= 3) return 10;
	if (hailCount >= 1) return 5;
	return 0;
}

// Get score tier
function getScoreTier(score: number): "hot" | "warm" | "moderate" | "cold" {
	if (score >= 80) return "hot";
	if (score >= 60) return "warm";
	if (score >= 40) return "moderate";
	return "cold";
}

// Main scoring function
export async function calculateLeadScore(input: LeadScoreInput): Promise<LeadScoreResult> {
	const { latitude, longitude, yearBuilt, roofSquares, assessedValue, squareFeet } = input;

	// Find nearest hail event (last 60 days, within 15 miles)
	let nearestHail: HailEvent | null = null;
	try {
		const { data } = await supabaseAdmin.rpc("find_nearby_hail_events", {
			p_latitude: latitude,
			p_longitude: longitude,
			p_radius_miles: 15,
			p_days_back: 60,
		});

		if (data && data.length > 0) {
			// Get the most relevant event (closest and most recent)
			nearestHail = data.sort((a: HailEvent, b: HailEvent) => {
				// Prioritize by recency first, then by distance
				const aScore = a.days_ago + a.distance_miles * 2;
				const bScore = b.days_ago + b.distance_miles * 2;
				return aScore - bScore;
			})[0];
		}
	} catch (error) {
		console.error("Error fetching nearby hail events:", error);
	}

	// Count historical hail events (5 years, 5 miles)
	let hailHistoryCount = 0;
	try {
		const { data } = await supabaseAdmin.rpc("count_hail_history", {
			p_latitude: latitude,
			p_longitude: longitude,
			p_radius_miles: 5,
			p_years_back: 5,
		});

		hailHistoryCount = data || 0;
	} catch (error) {
		console.error("Error counting hail history:", error);
	}

	// Calculate individual scores
	const stormProximityScore = calculateStormProximityScore(nearestHail);
	const roofAgeScore = calculateRoofAgeScore(yearBuilt);
	const roofSizeScore = calculateRoofSizeScore(roofSquares, squareFeet);
	const propertyValueScore = calculatePropertyValueScore(assessedValue);
	const hailHistoryScore = calculateHailHistoryScore(hailHistoryCount);

	// Total score (capped at 100)
	const totalScore = Math.min(
		stormProximityScore + roofAgeScore + roofSizeScore + propertyValueScore + hailHistoryScore,
		100
	);

	return {
		totalScore,
		stormProximityScore,
		roofAgeScore,
		roofSizeScore,
		propertyValueScore,
		hailHistoryScore,
		tier: getScoreTier(totalScore),
		nearestHailEvent: nearestHail,
		hailHistoryCount,
	};
}

// Calculate scores for multiple leads at once (more efficient)
export async function calculateBatchLeadScores(
	leads: Array<LeadScoreInput & { id: string }>
): Promise<Map<string, LeadScoreResult>> {
	const results = new Map<string, LeadScoreResult>();

	// Process in parallel but with a limit to avoid overwhelming the DB
	const batchSize = 10;
	for (let i = 0; i < leads.length; i += batchSize) {
		const batch = leads.slice(i, i + batchSize);
		const promises = batch.map(async (lead) => {
			const score = await calculateLeadScore({
				latitude: lead.latitude,
				longitude: lead.longitude,
				yearBuilt: lead.yearBuilt,
				roofSquares: lead.roofSquares,
				assessedValue: lead.assessedValue,
				squareFeet: lead.squareFeet,
			});
			return { id: lead.id, score };
		});

		const batchResults = await Promise.all(promises);
		batchResults.forEach(({ id, score }) => {
			results.set(id, score);
		});
	}

	return results;
}
