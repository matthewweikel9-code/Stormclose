import weights from "@/config/zoneScoreWeights.json";
import type { ZoneScoreInput } from "@/types/storms";

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

export function calculateZoneScore(input: ZoneScoreInput): number {
	const intensity = clamp((input.hailSizeInches / 2.5) * 0.7 + (input.windSpeedMph / 120) * 0.3, 0, 1);
	const recency = clamp(1 - input.stormAgeDays / 45, 0, 1);
	const density = clamp(input.houseCount / 500, 0, 1);
	const unworkedRatio = input.houseCount > 0 ? clamp(input.unworkedCount / input.houseCount, 0, 1) : 0;
	const avgHouseScore = clamp(input.avgHouseScore / 100, 0, 1);

	const weighted =
		intensity * weights.stormIntensity +
		recency * weights.recency +
		density * weights.density +
		unworkedRatio * weights.unworkedRatio +
		avgHouseScore * weights.avgHouseScore;

	return Math.round(clamp(weighted, 0, 1) * 100);
}
