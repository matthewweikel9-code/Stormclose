import { describe, expect, it } from "vitest";
import { rankNextBestHouse } from "@/lib/nextBestHouse";

describe("next-best house ranking", () => {
	it("prioritizes high-score nearby candidates", () => {
		const result = rankNextBestHouse({
			currentLat: 32.8,
			currentLng: -96.8,
			remainingStops: [
				{
					id: "stop-1",
					address: "401 Main St",
					lat: 32.8004,
					lng: -96.8002,
					opportunityScore: 92,
					stormAgeDays: 2,
					estimatedValueBand: "$20k–$40k",
					attemptCount: 0,
					status: "new",
					stormZoneName: "Zone A",
				},
				{
					id: "stop-2",
					address: "499 Far St",
					lat: 32.95,
					lng: -97.0,
					opportunityScore: 55,
					stormAgeDays: 20,
					estimatedValueBand: "$10k–$20k",
					attemptCount: 2,
					status: "attempted",
					stormZoneName: "Zone B",
				},
			],
			nearbyUnassigned: [],
			currentTime: new Date().toISOString(),
			workingHoursEnd: "18:00",
			avgMinutesPerStop: 12,
			allowMidMissionAdditions: true,
		});

		expect(result.suggestions.length).toBeGreaterThan(0);
		expect(result.suggestions[0].address).toBe("401 Main St");
		expect(result.suggestions[0].candidateScore).toBeGreaterThan(0);
	});

	it("includes unassigned suggestions when enabled", () => {
		const result = rankNextBestHouse({
			currentLat: 32.8,
			currentLng: -96.8,
			remainingStops: [],
			nearbyUnassigned: [
				{
					targetId: "target-1",
					address: "501 Bonus St",
					lat: 32.801,
					lng: -96.799,
					opportunityScore: 88,
					stormZoneName: "Zone Bonus",
					stormAgeDays: 4,
					estimatedValueBand: "$20k–$40k",
				},
			],
			currentTime: new Date().toISOString(),
			workingHoursEnd: "18:00",
			avgMinutesPerStop: 10,
			allowMidMissionAdditions: true,
		});

		expect(result.includesUnassigned).toBe(true);
		expect(result.suggestions[0]?.source).toBe("unassigned");
	});
});
