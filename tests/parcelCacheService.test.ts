import { describe, it, expect, vi, beforeEach } from "vitest";
import { ParcelCacheService } from "../src/services/parcelCacheService";

// Mock the supabase server client
vi.mock("../src/lib/supabase/server", () => {
  const rpcMock = vi.fn();
  const fromMock = vi.fn();
  
  return {
    createClient: vi.fn(() => ({
      rpc: rpcMock,
      from: fromMock
    }))
  };
});

import { createClient } from "../src/lib/supabase/server";

describe("ParcelCacheService", () => {
  let supabaseMock: any;

  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMock = {
      rpc: vi.fn(),
      from: vi.fn()
    };
    (createClient as any).mockResolvedValue(supabaseMock);
  });

  it("should get parcels in a polygon", async () => {
    const mockData = [{ id: "1", parcel_id: "P123" }];
    supabaseMock.rpc.mockResolvedValue({ data: mockData, error: null });

    const wkt = "POLYGON((0 0, 0 1, 1 1, 1 0, 0 0))";
    const result = await ParcelCacheService.getParcelsInPolygon(wkt);

    expect(supabaseMock.rpc).toHaveBeenCalledWith("get_parcels_in_polygon", { p_polygon_wkt: wkt });
    expect(result).toEqual(mockData);
  });

  it("should upsert a parcel successfully", async () => {
    const mockParcel = {
      parcel_id: "P123",
      address: "123 Main St",
      lat: 40.7128,
      lng: -74.0060,
    };
    
    supabaseMock.rpc.mockResolvedValue({ data: [mockParcel], error: null });

    const result = await ParcelCacheService.upsertParcel(mockParcel);

    expect(supabaseMock.rpc).toHaveBeenCalledWith("upsert_parcel_cache", {
      p_parcel_id: "P123",
      p_address: "123 Main St",
      p_lat: 40.7128,
      p_lng: -74.0060,
      p_geom_wkt: undefined,
      p_roof_age: undefined,
      p_property_value: undefined,
      p_corelogic_hash: undefined
    });
    expect(result).toEqual(mockParcel);
  });

  it("should perform bulk refresh", async () => {
    const selectMock = vi.fn().mockResolvedValue({ data: "success", error: null });
    const inMock = vi.fn().mockReturnValue({ select: selectMock });
    const updateMock = vi.fn().mockReturnValue({ in: inMock });
    
    supabaseMock.from.mockReturnValue({
      update: updateMock
    });

    const parcelIds = ["P123", "P456"];
    await ParcelCacheService.bulkRefresh(parcelIds);

    expect(supabaseMock.from).toHaveBeenCalledWith("parcel_cache");
    expect(updateMock).toHaveBeenCalledWith({ last_seen: new Date(0).toISOString() });
    expect(inMock).toHaveBeenCalledWith("parcel_id", parcelIds);
    expect(selectMock).toHaveBeenCalled();
  });
});