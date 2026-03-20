/**
 * Neighborhood Engine Score Model
 * 100-point weighted formula for ranking nearby opportunities.
 * Deterministic, explainable - no ML.
 */

export interface PropertyCandidate {
	address: string;
	lat: number;
	lng: number;
	yearBuilt?: number;
	squareFootage?: number;
	marketValue?: number;
	assessedValue?: number;
	roofType?: string;
	roofMaterial?: string;
	owner?: string;
	apn?: string;
}

export interface AnchorContext {
	lat: number;
	lng: number;
	address?: string;
	/** Distance in miles from anchor to this property */
	anchorDistanceMiles?: number;
	/** Same street as anchor (address prefix match) */
	sameStreet?: boolean;
	/** Storm severity 0-1 if available */
	stormSeverity?: number;
	/** Days since storm if available */
	daysSinceStorm?: number;
	/** Nearby activity count if available */
	nearbyActivityCount?: number;
}

export interface ScoreBreakdown {
	stormRelevance: number;
	neighborMomentum: number;
	revenuePotential: number;
	claimLikelihood: number;
	conversionProbability: number;
	urgencyTiming: number;
	total: number;
}

export interface ScoreExplanation {
	stormRelevance: string;
	neighborMomentum: string;
	revenuePotential: string;
	claimLikelihood: string;
	conversionProbability: string;
	urgencyTiming: string;
}

export type ActionLabel =
	| "Hit Now"
	| "Hit Today"
	| "Strong Follow-Up"
	| "Save For Later"
	| "Low Priority";

export interface NeighborhoodScoreResult {
	score: number;
	breakdown: ScoreBreakdown;
	explanation: ScoreExplanation;
	actionLabel: ActionLabel;
	estimatedValueLow?: number;
	estimatedValueHigh?: number;
}

export function haversineMiles(
	lat1: number,
	lng1: number,
	lat2: number,
	lng2: number
): number {
	const R = 3959; // Earth radius in miles
	const dLat = ((lat2 - lat1) * Math.PI) / 180;
	const dLng = ((lng2 - lng1) * Math.PI) / 180;
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos((lat1 * Math.PI) / 180) *
			Math.cos((lat2 * Math.PI) / 180) *
			Math.sin(dLng / 2) *
			Math.sin(dLng / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return R * c;
}

function getActionLabel(score: number): ActionLabel {
	if (score >= 85) return "Hit Now";
	if (score >= 70) return "Hit Today";
	if (score >= 55) return "Strong Follow-Up";
	if (score >= 40) return "Save For Later";
	return "Low Priority";
}

/**
 * Estimate roof value from property data (simplified).
 * Uses sqft, market value, roof age as proxies.
 */
function estimateRoofValue(prop: PropertyCandidate): { low: number; high: number } {
	const sqft = prop.squareFootage || 1500;
	const marketVal = prop.marketValue || prop.assessedValue || 250000;
	const roofSqft = sqft * 1.1; // rough roof area
	const squares = roofSqft / 100;
	// $400-600 per square typical range
	const low = Math.round(squares * 400);
	const high = Math.round(squares * 600);
	return { low, high };
}

/**
 * Compute Neighborhood Opportunity Score for a property.
 * Uses deterministic weighted formula. MVP uses available data; missing inputs get defaults.
 */
export function computeNeighborhoodScore(
	property: PropertyCandidate,
	anchor: { lat: number; lng: number; address?: string },
	context?: Partial<AnchorContext>
): NeighborhoodScoreResult {
	const anchorLat = anchor.lat;
	const anchorLng = anchor.lng;
	const distanceMiles =
		context?.anchorDistanceMiles ??
		haversineMiles(anchorLat, anchorLng, property.lat, property.lng);

	// Same street: check if address starts with same street number pattern or street name
	const anchorStreet = (anchor.address || "").split(",")[0]?.trim().toLowerCase() || "";
	const propStreet = (property.address || "").split(",")[0]?.trim().toLowerCase() || "";
	const sameStreet =
		context?.sameStreet ??
		(anchorStreet.length > 5 && propStreet.length > 5 && anchorStreet === propStreet);

	// 1. Storm Relevance (25 pts) - MVP: assume same area = same storm
	const stormSeverity = context?.stormSeverity ?? 0.7;
	const daysSinceStorm = context?.daysSinceStorm ?? 14;
	const stormRecency = daysSinceStorm <= 30 ? 1 : daysSinceStorm <= 90 ? 0.6 : 0.3;
	const stormRelevance = Math.min(25, 15 * stormSeverity + 5 * stormRecency + 5);

	// 2. Neighbor Momentum (20 pts) - distance + same street
	const distScore = distanceMiles <= 0.1 ? 6 : distanceMiles <= 0.25 ? 4 : distanceMiles <= 0.5 ? 2 : 0;
	const sameStreetBonus = sameStreet ? 8 : 0;
	const activityBonus = Math.min(6, (context?.nearbyActivityCount ?? 0) * 2);
	const neighborMomentum = Math.min(20, distScore + sameStreetBonus + activityBonus);

	// 3. Revenue Potential (20 pts) - roof size / value proxy
	const { low, high } = estimateRoofValue(property);
	const revenueScore = high >= 25000 ? 10 : high >= 18000 ? 8 : high >= 12000 ? 6 : 4;
	const valueScore = (property.marketValue || property.assessedValue || 0) >= 300000 ? 10 : 6;
	const revenuePotential = Math.min(20, revenueScore + valueScore);

	// 4. Claim Likelihood (15 pts) - roof age, storm overlap
	const currentYear = new Date().getFullYear();
	const yearBuilt = property.yearBuilt || currentYear - 20;
	const roofAge = currentYear - yearBuilt;
	const ageScore = roofAge >= 15 ? 6 : roofAge >= 10 ? 4 : 2;
	const stormScore = stormSeverity * 6;
	const claimLikelihood = Math.min(15, ageScore + stormScore + 3);

	// 5. Conversion Probability (10 pts) - route efficiency (closer = better)
	const routeScore = distanceMiles <= 0.2 ? 4 : distanceMiles <= 0.5 ? 3 : 2;
	const conversionProbability = Math.min(10, routeScore + 3 + 3);

	// 6. Urgency (10 pts)
	const urgencyScore = daysSinceStorm <= 14 ? 4 : daysSinceStorm <= 30 ? 3 : 2;
	const urgencyTiming = Math.min(10, urgencyScore + 3 + 3);

	const total = Math.round(
		stormRelevance + neighborMomentum + revenuePotential + claimLikelihood + conversionProbability + urgencyTiming
	);
	const clampedTotal = Math.min(100, Math.max(0, total));

	const breakdown: ScoreBreakdown = {
		stormRelevance: Math.round(stormRelevance * 10) / 10,
		neighborMomentum: Math.round(neighborMomentum * 10) / 10,
		revenuePotential: Math.round(revenuePotential * 10) / 10,
		claimLikelihood: Math.round(claimLikelihood * 10) / 10,
		conversionProbability: Math.round(conversionProbability * 10) / 10,
		urgencyTiming: Math.round(urgencyTiming * 10) / 10,
		total: clampedTotal,
	};

	const explanation: ScoreExplanation = {
		stormRelevance: stormSeverity >= 0.5
			? "Same storm area as anchor property"
			: "Limited storm overlap data",
		neighborMomentum: sameStreet
			? "Same street as anchor"
			: distanceMiles <= 0.25
			? `${(distanceMiles * 5280).toFixed(0)} ft from anchor`
			: `${distanceMiles.toFixed(2)} mi from anchor`,
		revenuePotential: `Est. roof value $${low.toLocaleString()}–$${high.toLocaleString()}`,
		claimLikelihood: roofAge >= 15
			? `Older roof (${roofAge}+ yrs) + storm overlap`
			: "Moderate claim likelihood",
		conversionProbability: distanceMiles <= 0.25
			? "Efficient route from anchor"
			: "Within hot zone radius",
		urgencyTiming: daysSinceStorm <= 30
			? "Recent storm – act soon"
			: "Standard follow-up window",
	};

	return {
		score: clampedTotal,
		breakdown,
		explanation,
		actionLabel: getActionLabel(clampedTotal),
		estimatedValueLow: low,
		estimatedValueHigh: high,
	};
}
