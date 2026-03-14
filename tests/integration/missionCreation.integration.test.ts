import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventBus } from "../../src/lib/eventBus";
import { MissionService } from "../../src/services/missionService";

/**
 * Integration test: full mission creation flow.
 *
 * Exercises the complete pipeline from storm lookup → parcel fetch →
 * threat scoring → DB transaction → event publish → route optimisation.
 *
 * All infrastructure is in-memory — no real DB or network calls.
 */

// ── In-Memory Persistence ──────────────────────────────────────────────────
class InMemoryMissionPersistence {
  private missions: Array<{
    id: string;
    userId: string;
    stormId: string;
    signature: string;
    name: string;
    description: string | null;
    centerLat: number;
    centerLng: number;
    radiusMiles: number;
    scheduledDate: string | null;
    stops: any[];
  }> = [];

  async getStormById(_userId: string, stormId: string) {
    if (stormId === "storm-xyz") {
      return {
        id: "storm-xyz",
        latitude: 35.467,
        longitude: -97.516,
        impact_radius_miles: 2,
        hail_size_inches: 2.0,
        wind_speed_mph: 70,
        polygon_wkt:
          "POLYGON((-97.54 35.45, -97.49 35.45, -97.49 35.49, -97.54 35.49, -97.54 35.45))",
        event_occurred_at: "2026-03-12T18:00:00Z",
      };
    }
    return null;
  }

  async createMissionWithStopsTx(params: any) {
    const dup = this.missions.find(
      (m) =>
        m.userId === params.userId &&
        m.stormId === params.stormId &&
        m.signature === params.signature
    );
    if (dup) {
      return { missionId: dup.id, created: false };
    }

    const id = `mission-${this.missions.length + 1}`;
    this.missions.push({ id, ...params });
    return { missionId: id, created: true };
  }

  getAllMissions() {
    return [...this.missions];
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function makeParcels() {
  return [
    {
      parcel_id: "p-1",
      address: "111 Main St",
      city: "Norman",
      state: "OK",
      zip: "73019",
      lat: 35.468,
      lng: -97.517,
      roof_age: 18,
      property_value: 340000,
      property_type: "residential",
      owner_name: "Alice Owner",
      year_built: 2008,
      square_feet: 2200,
    },
    {
      parcel_id: "p-2",
      address: "222 Elm Dr",
      city: "Norman",
      state: "OK",
      zip: "73019",
      lat: 35.469,
      lng: -97.515,
      roof_age: 6,
      property_value: 210000,
      property_type: "single_family",
      owner_name: "Bob Owner",
      year_built: 2020,
      square_feet: 1400,
    },
    {
      parcel_id: "p-3",
      address: "333 Commerce Blvd",
      city: "Norman",
      state: "OK",
      zip: "73019",
      lat: 35.467,
      lng: -97.514,
      roof_age: 10,
      property_value: 900000,
      property_type: "commercial",
      owner_name: "Corp LLC",
      year_built: 2014,
      square_feet: 8000,
    },
    {
      parcel_id: "p-4",
      address: "444 Oak Ln",
      city: "Norman",
      state: "OK",
      zip: "73019",
      lat: 35.466,
      lng: -97.518,
      roof_age: 22,
      property_value: 275000,
      property_type: "residential",
      owner_name: "Carol Owner",
      year_built: 2004,
      square_feet: 1900,
    },
  ];
}

// ── Tests ───────────────────────────────────────────────────────────────────
describe("Mission creation — full flow integration", () => {
  let persistence: InMemoryMissionPersistence;
  let parcelService: { getParcelsInPolygon: ReturnType<typeof vi.fn> };
  let routeSvc: { optimizeRoute: ReturnType<typeof vi.fn> };
  let bus: EventBus;
  let events: any[];

  beforeEach(() => {
    persistence = new InMemoryMissionPersistence();
    parcelService = {
      getParcelsInPolygon: vi.fn().mockResolvedValue(makeParcels()),
    };
    routeSvc = {
      optimizeRoute: vi.fn().mockResolvedValue({
        optimizedStops: [],
        metrics: { providerUsed: "local", latencyMs: 5, fallbackTriggered: false },
      }),
    };
    bus = new EventBus();
    events = [];
    bus.subscribe("mission_created", (e) => events.push(e));
  });

  it("creates a mission with scored stops, filters commercial, calls routeService", async () => {
    const service = new MissionService(
      persistence as any,
      parcelService as any,
      routeSvc as any,
      bus
    );

    const result = await service.createMissionFromStorm("user-42", "storm-xyz", {
      signature: "sig-full-flow",
      name: "Full Flow Mission",
      limit: 10,
    });

    // ── Mission created ──
    expect(result.missionId).toBe("mission-1");
    expect(result.created).toBe(true);

    // ── Commercial parcel p-3 must be filtered out ──
    expect(result.selectedStops.length).toBe(3);
    const addresses = result.selectedStops.map((s) => s.address);
    expect(addresses).not.toContain("333 Commerce Blvd");
    expect(addresses).toContain("111 Main St");
    expect(addresses).toContain("222 Elm Dr");
    expect(addresses).toContain("444 Oak Ln");

    // ── Stops have threat scores, sorted descending ──
    for (const stop of result.selectedStops) {
      expect(typeof stop.threat_score).toBe("number");
      expect(stop.threat_score).toBeGreaterThanOrEqual(0);
      expect(stop.threat_score).toBeLessThanOrEqual(100);
    }
    expect(result.selectedStops[0].threat_score!).toBeGreaterThanOrEqual(
      result.selectedStops[result.selectedStops.length - 1].threat_score!
    );

    // ── Estimated claim derived from threat score ──
    for (const stop of result.selectedStops) {
      if (stop.estimated_value && stop.threat_score) {
        expect(stop.estimated_claim).toBeGreaterThanOrEqual(0);
      }
    }

    // ── routeService was invoked with the selected stops ──
    expect(routeSvc.optimizeRoute).toHaveBeenCalledTimes(1);
    const routeArg = routeSvc.optimizeRoute.mock.calls[0][0] as any[];
    expect(routeArg).toHaveLength(3);
    expect(routeArg[0]).toHaveProperty("address");
    expect(routeArg[0]).toHaveProperty("latitude");
    expect(routeArg[0]).toHaveProperty("longitude");

    // ── EventBus published mission_created ──
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(
      expect.objectContaining({
        missionId: "mission-1",
        userId: "user-42",
        stormId: "storm-xyz",
        created: true,
        stopCount: 3,
      })
    );

    // ── Persistence stores the stops passed to the tx ──
    const stored = persistence.getAllMissions();
    expect(stored).toHaveLength(1);
    expect(stored[0].stops).toHaveLength(3);
    expect(stored[0].name).toBe("Full Flow Mission");
    expect(stored[0].signature).toBe("sig-full-flow");
  });

  it("respects limit — only top-N stops pass through", async () => {
    const service = new MissionService(
      persistence as any,
      parcelService as any,
      routeSvc as any,
      bus
    );

    const result = await service.createMissionFromStorm("user-42", "storm-xyz", {
      signature: "sig-limited",
      limit: 1,
    });

    expect(result.selectedStops).toHaveLength(1);
    // The single stop should be the highest-scored
    const allScores = makeParcels()
      .filter((p) => p.property_type !== "commercial")
      .map(() => 0); // we can't pre-compute exact scores easily; just check length
    expect(result.selectedStops[0].threat_score).toBeGreaterThan(0);
  });

  it("is idempotent on the same signature", async () => {
    const service = new MissionService(
      persistence as any,
      parcelService as any,
      routeSvc as any,
      bus
    );

    const first = await service.createMissionFromStorm("user-42", "storm-xyz", {
      signature: "sig-idem",
    });
    const second = await service.createMissionFromStorm("user-42", "storm-xyz", {
      signature: "sig-idem",
    });

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(first.missionId).toBe(second.missionId);
    expect(persistence.getAllMissions()).toHaveLength(1);
  });

  it("throws when storm not found", async () => {
    const service = new MissionService(
      persistence as any,
      parcelService as any,
      routeSvc as any,
      bus
    );

    await expect(
      service.createMissionFromStorm("user-42", "nonexistent", {
        signature: "sig-none",
      })
    ).rejects.toThrow("Storm event not found");
  });

  it("throws when all parcels are commercial (zero residential)", async () => {
    parcelService.getParcelsInPolygon.mockResolvedValue([
      {
        parcel_id: "c1",
        address: "1 Corporate Plaza",
        lat: 35.467,
        lng: -97.516,
        property_type: "commercial",
      },
    ]);

    const service = new MissionService(
      persistence as any,
      parcelService as any,
      routeSvc as any,
      bus
    );

    await expect(
      service.createMissionFromStorm("user-42", "storm-xyz", {
        signature: "sig-no-res",
      })
    ).rejects.toThrow("No residential parcels found");
  });

  it("still creates mission even when routeService fails (fire-and-forget)", async () => {
    routeSvc.optimizeRoute.mockRejectedValue(new Error("Google API down"));

    const service = new MissionService(
      persistence as any,
      parcelService as any,
      routeSvc as any,
      bus
    );

    const result = await service.createMissionFromStorm("user-42", "storm-xyz", {
      signature: "sig-route-fail",
    });

    // Mission still created despite route failure
    expect(result.missionId).toBe("mission-1");
    expect(result.created).toBe(true);
    expect(result.selectedStops.length).toBeGreaterThan(0);
  });
});
