import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/corelogic", () => ({
	searchPropertiesInArea: vi.fn(),
	CoreLogicError: class extends Error {
		status: number;

		constructor(status: number, message: string) {
			super(message);
			this.status = status;
		}
	},
}));

vi.mock("@/services/parcelCacheService", () => ({
	ParcelCacheService: {
		getParcelsInPolygon: vi.fn(),
		upsertParcel: vi.fn(),
	},
}));

import { searchPropertiesInArea } from "@/lib/corelogic";
import { ParcelCacheService } from "@/services/parcelCacheService";
import { searchPropertiesInAreaCached } from "@/integrations/corelogicCachedClient";

const mockedSearch = vi.mocked(searchPropertiesInArea);
const mockedCacheGet = vi.mocked(ParcelCacheService.getParcelsInPolygon);
const mockedCacheUpsert = vi.mocked(ParcelCacheService.upsertParcel);

describe("corelogicCachedClient", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		delete process.env.CORELOGIC_USE_FALLBACK;
	});

	it("returns cached source when cache is healthy", async () => {
		mockedCacheGet.mockResolvedValue(
			Array.from({ length: 12 }, (_, index) => ({
				parcel_id: `cached-${index}`,
				address: `Cached ${index}`,
				lat: 35.4,
				lng: -97.5,
				roof_age: 10,
				property_value: 200000,
				last_seen: new Date().toISOString(),
			})) as unknown as never
		);

		const result = await searchPropertiesInAreaCached(35.4, -97.5, 1, { propertyType: "SFR" });

		expect(result.source).toBe("corelogic_cached");
		expect(result.properties.length).toBe(12);
		expect(mockedSearch).not.toHaveBeenCalled();
	});

	it("refreshes from corelogic and upserts when cache is stale", async () => {
		mockedCacheGet.mockResolvedValue([
			{
				parcel_id: "old-1",
				address: "Old 1",
				lat: 35.4,
				lng: -97.5,
				roof_age: 10,
				property_value: 200000,
				last_seen: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
			},
		] as unknown as never);

		mockedSearch.mockResolvedValue([
			{
				id: "fresh-1",
				address: "Fresh 1",
				city: "City",
				state: "OK",
				zip: "73000",
				lat: 35.45,
				lng: -97.55,
				owner: "Owner",
				apn: "APN-1",
				propertyType: "Single Family Residential",
				typeCode: "SFR",
				yearBuilt: 2000,
				squareFootage: 2000,
				lotSize: 0,
				bedrooms: 3,
				bathrooms: 2,
				stories: 1,
				roofType: "Asphalt",
				roofMaterial: "Asphalt",
				roofAge: 12,
				assessedValue: 190000,
				marketValue: 220000,
				saleDate: null,
				salePrice: null,
				geometry: "",
			},
		]);

		const result = await searchPropertiesInAreaCached(35.4, -97.5, 1, { propertyType: "SFR" });

		expect(result.source).toBe("corelogic");
		expect(result.properties.length).toBe(1);
		expect(mockedSearch).toHaveBeenCalledTimes(1);
		expect(mockedCacheUpsert).toHaveBeenCalledTimes(1);
	});

	it("returns fallback when forced fallback enabled and cache empty", async () => {
		process.env.CORELOGIC_USE_FALLBACK = "true";
		mockedCacheGet.mockResolvedValue([] as unknown as never);

		const result = await searchPropertiesInAreaCached(35.4, -97.5, 1);

		expect(result.source).toBe("fallback");
		expect(result.properties.length).toBe(10);
		expect(mockedSearch).not.toHaveBeenCalled();
	});
});
