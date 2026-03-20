/**
 * Estimate engine: derives roof metrics from Google Solar measurements
 * and produces cost/material estimates. Used by JobNimbus exports and roof-measurement API.
 */

export interface RoofMeasurements {
	totalAreaSqFt: number;
	totalSquares: number;
	groundAreaSqFt: number;
	avgPitchDegrees: number;
	facetCount: number;
	segments: Array<{
		areaSqFt: number;
		pitchDegrees: number;
		azimuthDegrees: number;
	}>;
}

export interface RoofMetrics {
	total_area: number;
	squares: number;
	facets: number;
	ridge_length: number;
	valley_length: number;
	eaves_length: number;
	rakes_length: number;
	waste: number;
	total_squares: number;
	pitchFactor: number;
}

export interface EstimateResult {
	costRange: { low: number; high: number };
	materials: {
		shingleBundles: number;
		underlaymentRolls: number;
		ridgeCapBundles: number;
		dripEdgeFeet: number;
	};
}

function getPitchFactor(avgPitchDegrees: number): number {
	if (avgPitchDegrees < 15) return 1.0;
	if (avgPitchDegrees < 25) return 1.08;
	if (avgPitchDegrees < 35) return 1.15;
	return 1.25;
}

/**
 * Derive roof metrics from Solar API measurements.
 * Uses facet-based waste and pitch factor for material estimates.
 */
export function deriveRoofMetrics(measurements: RoofMeasurements): RoofMetrics {
	const area = measurements.totalAreaSqFt;
	const facets = measurements.facetCount;
	const squares = area / 100;
	const pitchFactor = getPitchFactor(measurements.avgPitchDegrees);

	// Waste by facets: more complex roofs = more cuts = more waste
	let waste: number;
	if (facets <= 4) waste = 0.08;
	else if (facets <= 8) waste = 0.12;
	else waste = 0.18;

	const ridge = squares * 4 + facets * 5;
	const valley = facets * 8 * pitchFactor;
	const eaves = squares * 10;
	const rakes = eaves * 0.5;

	return {
		total_area: area,
		squares,
		facets,
		ridge_length: Math.round(ridge),
		valley_length: Math.round(valley),
		eaves_length: Math.round(eaves),
		rakes_length: Math.round(rakes),
		waste,
		total_squares: Math.round((squares * (1 + waste)) * 10) / 10,
		pitchFactor,
	};
}

/**
 * Estimate from AI damage report when roof measurements are not available.
 * Uses estimatedAffectedSquares from damage analysis; full_replacement uses full scope.
 */
export function estimateFromDamageReport(damageReport: {
	estimatedAffectedSquares: number;
	repairScope: "spot_repair" | "section_repair" | "full_replacement";
}): EstimateResult {
	const { estimatedAffectedSquares, repairScope } = damageReport;
	// For full replacement, assume we're replacing the affected area (or add buffer)
	const squares = Math.max(0.5, estimatedAffectedSquares);
	const scopeMultiplier =
		repairScope === "full_replacement" ? 1.2 : repairScope === "section_repair" ? 1.1 : 1.0;
	const effectiveSquares = Math.round(squares * scopeMultiplier * 10) / 10;
	const areaSqFt = effectiveSquares * 100;
	const measurements: RoofMeasurements = {
		totalAreaSqFt: areaSqFt,
		totalSquares: effectiveSquares,
		groundAreaSqFt: areaSqFt,
		avgPitchDegrees: 25,
		facetCount: 4,
		segments: [{ areaSqFt: areaSqFt / 4, pitchDegrees: 25, azimuthDegrees: 0 }],
	};
	return calculateEstimate(measurements);
}

/**
 * Calculate cost estimate and material quantities from roof measurements.
 * Uses industry-standard pricing ($350–450/sq installed) with pitch factor.
 */
export function calculateEstimate(measurements: RoofMeasurements): EstimateResult {
	const metrics = deriveRoofMetrics(measurements);

	// Cost range: typical installed price per square with pitch factor
	const baseLow = 350;
	const baseHigh = 450;
	const costLow = Math.round(
		metrics.total_squares * baseLow * metrics.pitchFactor * 0.85
	);
	const costHigh = Math.round(
		metrics.total_squares * baseHigh * metrics.pitchFactor * 1.15
	);

	// Materials: ~3 bundles per square, underlayment, ridge cap, drip edge
	const bundlesPerSquare = 3;
	const shingleBundles = Math.ceil(
		metrics.total_squares * bundlesPerSquare
	);
	const underlaymentRolls = Math.ceil(metrics.total_squares / 4);
	const ridgeCapBundles = Math.ceil(metrics.ridge_length / 10);
	const dripEdgeFeet = Math.round(
		metrics.eaves_length + metrics.rakes_length
	);

	return {
		costRange: { low: costLow, high: costHigh },
		materials: {
			shingleBundles,
			underlaymentRolls,
			ridgeCapBundles,
			dripEdgeFeet,
		},
	};
}
