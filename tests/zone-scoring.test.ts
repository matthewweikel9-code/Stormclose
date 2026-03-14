import { describe, expect, it } from "vitest";
import { calculateZoneScore } from "@/lib/storms/zoneScoring";

describe("zone scoring", () => {
	it("scores high-intensity recent dense zones higher", () => {
		const high = calculateZoneScore({
			hailSizeInches: 2.2,
			windSpeedMph: 90,
			stormAgeDays: 1,
			houseCount: 420,
			unworkedCount: 350,
			avgHouseScore: 86,
		});
		const low = calculateZoneScore({
			hailSizeInches: 0.6,
			windSpeedMph: 40,
			stormAgeDays: 30,
			houseCount: 60,
			unworkedCount: 8,
			avgHouseScore: 42,
		});

		expect(high).toBeGreaterThan(low);
		expect(high).toBeGreaterThanOrEqual(0);
		expect(high).toBeLessThanOrEqual(100);
	});

	it("returns bounded score for edge values", () => {
		const score = calculateZoneScore({
			hailSizeInches: 10,
			windSpeedMph: 300,
			stormAgeDays: -5,
			houseCount: 5000,
			unworkedCount: 9999,
			avgHouseScore: 999,
		});

		expect(score).toBeGreaterThanOrEqual(0);
		expect(score).toBeLessThanOrEqual(100);
	});
});
