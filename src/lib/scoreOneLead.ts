/**
 * Pure lead-scoring function — no external dependencies.
 *
 * Recomputes `lead_score` from the five stored sub-component columns.
 * Used by the rescore cron endpoint and integration tests.
 */
export function scoreOneLead(params: {
  stormProximityScore: number;
  roofAgeScore: number;
  roofSizeScore: number;
  propertyValueScore: number;
  hailHistoryScore: number;
}): { totalScore: number; tier: "hot" | "warm" | "moderate" | "cold" } {
  const totalScore = Math.min(
    params.stormProximityScore +
      params.roofAgeScore +
      params.roofSizeScore +
      params.propertyValueScore +
      params.hailHistoryScore,
    100
  );

  let tier: "hot" | "warm" | "moderate" | "cold" = "cold";
  if (totalScore >= 80) tier = "hot";
  else if (totalScore >= 60) tier = "warm";
  else if (totalScore >= 40) tier = "moderate";

  return { totalScore, tier };
}
