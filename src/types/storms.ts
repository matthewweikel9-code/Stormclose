import type { HouseToHit, StormSeverity } from "@/types/dashboard";

export interface StormZone {
	id: string;
	stormEventId: string;
	name: string;
	centroidLat: number;
	centroidLng: number;
	radiusKm: number;
	opportunityScore: number;
	houseCount: number;
	unworkedCount: number;
	createdAt: string;
	updatedAt: string;
}

export interface StormZoneFilters {
	minScore?: number;
	maxScore?: number;
	minUnworked?: number;
	limit?: number;
	q?: string;
}

export interface StormZoneListResponse {
	zones: StormZone[];
	total: number;
	filtersApplied: Record<string, unknown>;
}

export interface StormZoneDetail {
	zone: StormZone;
	houses: HouseToHit[];
	severity: StormSeverity;
	generatedAt: string;
}

export interface TerritoryWatchlist {
	id: string;
	userId: string;
	name: string;
	boundsWkt: string;
	alertThreshold: number;
	active: boolean;
	createdAt: string;
}

export interface CreateWatchlistInput {
	name: string;
	boundsWkt: string;
	alertThreshold?: number;
	active?: boolean;
}

export interface UpdateWatchlistInput {
	name?: string;
	boundsWkt?: string;
	alertThreshold?: number;
	active?: boolean;
}

export interface WatchlistAlert {
	id: string;
	watchlistId: string;
	stormZoneId: string;
	triggeredAt: string;
	acknowledged: boolean;
}

export interface ZoneScoreInput {
	hailSizeInches: number;
	windSpeedMph: number;
	stormAgeDays: number;
	houseCount: number;
	unworkedCount: number;
	avgHouseScore: number;
}
