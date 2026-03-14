import weights from '../config/threatWeights.json';

export interface ThreatScoreParams {
  hailSize?: number;              // in mm
  windSpeed?: number;             // in mph
  stormDurationMinutes?: number;  // in minutes
  proximityScore?: number;        // 0.0 to 1.0 (1 is direct hit)
  parcelValueNormalized?: number; // 0.0 to 1.0
  roofAgeYears?: number;          // in years
}

/**
 * Calculates a deterministic threat score from 0 to 100 based on storm parameters and property specs.
 */
export function calculateThreatScore(params: ThreatScoreParams): number {
  const {
    hailSize = 0,
    windSpeed = 0,
    stormDurationMinutes = 0,
    proximityScore = 0.5,
    parcelValueNormalized = 0.5,
    roofAgeYears = 10,
  } = params;

  // Normalization limits (transforming open-ended inputs into 0.0 - 1.0 bounds)
  // Hail: Cap around 50.8mm (2 inches) where extreme damage is almost certain
  const normHail = Math.min(Math.max(hailSize / 50.8, 0), 1);
  
  // Wind: Start scaling around 40mph (minor damage starting point), max at 120mph
  const normWind = Math.min(Math.max((windSpeed - 40) / 80, 0), 1);
  
  // Duration: Normalize up to 60 minutes
  const normDuration = Math.min(Math.max(stormDurationMinutes / 60, 0), 1);
  
  const normProximity = Math.min(Math.max(proximityScore, 0), 1);
  const normValue = Math.min(Math.max(parcelValueNormalized, 0), 1);
  
  // Roof Age: Max out theoretical vulnerability at 20 years
  const normAge = Math.min(Math.max(roofAgeYears / 20, 0), 1);

  const rawScore = 
    (normHail * weights.hailSize) +
    (normWind * weights.windSpeed) +
    (normDuration * weights.stormDurationMinutes) +
    (normProximity * weights.proximityScore) +
    (normValue * weights.parcelValueNormalized) +
    (normAge * weights.roofAgeYears);

  // Ensure total sum stays firmly in integer 0-100 range due to any float math weirdness
  return Math.max(0, Math.min(100, Math.round(rawScore * 100)));
}
