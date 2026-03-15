import { getDashboardTodayMockData } from "@/lib/dashboard/mockData";
import { calculateZoneScore } from "@/lib/storms/zoneScoring";
import type { StormZone, StormZoneDetail, TerritoryWatchlist } from "@/types/storms";

function daysAgo(days: number): string {
	return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export function getMockStormZones(): StormZone[] {
	const dashboard = getDashboardTodayMockData();
	return dashboard.topStormZones.map((zone) => {
		const score = calculateZoneScore({
			hailSizeInches: zone.severity === "extreme" ? 2.1 : zone.severity === "severe" ? 1.6 : zone.severity === "moderate" ? 1.1 : 0.6,
			windSpeedMph: zone.severity === "extreme" ? 95 : zone.severity === "severe" ? 75 : zone.severity === "moderate" ? 58 : 40,
			stormAgeDays: zone.stormAgeDays,
			houseCount: zone.houseCount,
			unworkedCount: zone.unworkedHouseCount,
			avgHouseScore: zone.score,
		});

		return {
			id: zone.id,
			stormEventId: `event-${zone.id}`,
			name: zone.name,
			centroidLat: zone.lat,
			centroidLng: zone.lng,
			radiusKm: 8,
			opportunityScore: score,
			houseCount: zone.houseCount,
			unworkedCount: zone.unworkedHouseCount,
			createdAt: daysAgo(zone.stormAgeDays + 1),
			updatedAt: daysAgo(Math.max(zone.stormAgeDays - 1, 0)),
		};
	});
}

export function getMockStormZoneDetail(zoneId: string): StormZoneDetail | null {
	const zones = getMockStormZones();
	const zone = zones.find((entry) => entry.id === zoneId);
	if (!zone) {
		return null;
	}

	const dashboard = getDashboardTodayMockData();
	const houses = dashboard.housesToHitToday
		.filter((house) => house.stormZoneId === zoneId)
		.slice(0, 25);

	const severity =
		zone.opportunityScore >= 80
			? "extreme"
			: zone.opportunityScore >= 60
				? "severe"
				: zone.opportunityScore >= 40
					? "moderate"
					: "minor";

	return {
		zone,
		houses,
		severity,
		generatedAt: new Date().toISOString(),
	};
}

export function getMockWatchlists(userId: string): TerritoryWatchlist[] {
	return [
		{
			id: "watch-1",
			userId,
			name: "North Dallas Coverage",
			boundsWkt: "POLYGON((-96.95 32.86,-96.65 32.86,-96.65 32.98,-96.95 32.98,-96.95 32.86))",
			alertThreshold: 70,
			active: true,
			createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
		},
	];
}
