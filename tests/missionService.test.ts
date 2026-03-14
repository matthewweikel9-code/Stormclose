import { describe, it, expect, vi } from "vitest";
import { EventBus } from "../src/lib/eventBus";
import { MissionService } from "../src/services/missionService";

function deferred<T = unknown>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("MissionService.createMissionFromStorm (unit)", () => {
  it("filters residential parcels, scores, limits, creates mission, emits event", async () => {
    const persistence = {
      getStormById: vi.fn().mockResolvedValue({
        id: "storm-1",
        latitude: 35.5,
        longitude: -97.5,
        impact_radius_miles: 1,
        hail_size_inches: 1.5,
        wind_speed_mph: 65,
        event_occurred_at: "2026-03-10T00:00:00Z",
      }),
      createMissionWithStopsTx: vi.fn().mockResolvedValue({ missionId: "mission-1", created: true }),
    };

    const parcelService = {
      getParcelsInPolygon: vi.fn().mockResolvedValue([
        {
          parcel_id: "p1",
          address: "123 Oak St",
          lat: 35.5001,
          lng: -97.5001,
          roof_age: 12,
          property_value: 300000,
          property_type: "residential",
        },
        {
          parcel_id: "p2",
          address: "500 Commerce Blvd",
          lat: 35.49,
          lng: -97.49,
          roof_age: 5,
          property_value: 550000,
          property_type: "commercial",
        },
        {
          parcel_id: "p3",
          address: "456 Pine St",
          lat: 35.501,
          lng: -97.501,
          roof_age: 18,
          property_value: 260000,
          property_type: "single_family",
        },
      ]),
    };

    const optimizeDef = deferred<{ optimizedStops: unknown[] }>();
    const routeSvc = {
      optimizeRoute: vi.fn().mockReturnValue(optimizeDef.promise),
    };

    const bus = new EventBus();
    const events: any[] = [];
    bus.subscribe("mission_created", (payload) => {
      events.push(payload);
    });

    const service = new MissionService(
      persistence as any,
      parcelService as any,
      routeSvc as any,
      bus
    );

    const result = await service.createMissionFromStorm("user-1", "storm-1", {
      signature: "sig-abc",
      limit: 1,
      name: "Top Damage Mission",
    });

    expect(result.missionId).toBe("mission-1");
    expect(result.created).toBe(true);
    expect(result.selectedStops).toHaveLength(1);
    expect(result.selectedStops[0].address).toBeDefined();

    expect(persistence.createMissionWithStopsTx).toHaveBeenCalledTimes(1);
    const txArg = (persistence.createMissionWithStopsTx as any).mock.calls[0][0];
    expect(txArg.signature).toBe("sig-abc");
    expect(txArg.stops).toHaveLength(1);
    expect(txArg.stops[0].property_type?.toLowerCase()).not.toContain("commercial");

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(
      expect.objectContaining({
        missionId: "mission-1",
        userId: "user-1",
        stormId: "storm-1",
      })
    );

    expect(routeSvc.optimizeRoute).toHaveBeenCalledTimes(1);
    optimizeDef.resolve({ optimizedStops: [] });
  });

  it("throws if storm cannot be found", async () => {
    const service = new MissionService(
      {
        getStormById: vi.fn().mockResolvedValue(null),
        createMissionWithStopsTx: vi.fn(),
      } as any,
      { getParcelsInPolygon: vi.fn() } as any,
      { optimizeRoute: vi.fn() } as any,
      new EventBus()
    );

    await expect(
      service.createMissionFromStorm("user-1", "missing-storm", {
        signature: "sig-1",
      })
    ).rejects.toThrow("Storm event not found");
  });
});
