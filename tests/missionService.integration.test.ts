import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventBus } from "../src/lib/eventBus";
import { MissionService } from "../src/services/missionService";

type InMemoryMission = {
  id: string;
  userId: string;
  stormId: string;
  signature: string;
  stops: any[];
};

class InMemoryMissionPersistence {
  private missions: InMemoryMission[] = [];

  async getStormById() {
    return {
      id: "storm-123",
      latitude: 35.5,
      longitude: -97.5,
      impact_radius_miles: 1,
      hail_size_inches: 2.0,
      wind_speed_mph: 70,
      polygon_wkt: "POLYGON((-97.51 35.49, -97.49 35.49, -97.49 35.51, -97.51 35.51, -97.51 35.49))",
      event_occurred_at: "2026-03-10T00:00:00Z",
    };
  }

  async createMissionWithStopsTx(params: any) {
    const existing = this.missions.find(
      (mission) =>
        mission.userId === params.userId &&
        mission.stormId === params.stormId &&
        mission.signature === params.signature
    );

    if (existing) {
      return { missionId: existing.id, created: false };
    }

    const id = `mission-${this.missions.length + 1}`;
    this.missions.push({
      id,
      userId: params.userId,
      stormId: params.stormId,
      signature: params.signature,
      stops: params.stops,
    });

    return { missionId: id, created: true };
  }

  count() {
    return this.missions.length;
  }

  firstStops() {
    return this.missions[0]?.stops ?? [];
  }
}

describe("MissionService.createMissionFromStorm (integration-style)", () => {
  let persistence: InMemoryMissionPersistence;
  let bus: EventBus;

  beforeEach(() => {
    persistence = new InMemoryMissionPersistence();
    bus = new EventBus();
  });

  it("uses polygon parcel set, limits top scored stops, and is idempotent by signature", async () => {
    const parcelService = {
      getParcelsInPolygon: vi.fn().mockResolvedValue([
        {
          parcel_id: "a",
          address: "100 A St",
          lat: 35.5001,
          lng: -97.5001,
          roof_age: 20,
          property_value: 350000,
          property_type: "residential",
        },
        {
          parcel_id: "b",
          address: "200 B St",
          lat: 35.5005,
          lng: -97.5005,
          roof_age: 8,
          property_value: 250000,
          property_type: "residential",
        },
        {
          parcel_id: "c",
          address: "300 C Plaza",
          lat: 35.5002,
          lng: -97.5002,
          roof_age: 12,
          property_value: 900000,
          property_type: "commercial",
        },
      ]),
    };

    const routeSvc = {
      optimizeRoute: vi.fn().mockResolvedValue({ optimizedStops: [] }),
    };

    const events: any[] = [];
    bus.subscribe("mission_created", (payload) => events.push(payload));

    const service = new MissionService(
      persistence as any,
      parcelService as any,
      routeSvc as any,
      bus
    );

    const first = await service.createMissionFromStorm("user-9", "storm-123", {
      signature: "same-signature",
      limit: 2,
    });

    const second = await service.createMissionFromStorm("user-9", "storm-123", {
      signature: "same-signature",
      limit: 2,
    });

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(first.missionId).toBe(second.missionId);
    expect(persistence.count()).toBe(1);

    const selectedStops = persistence.firstStops();
    expect(selectedStops).toHaveLength(2);
    expect(selectedStops.every((stop: any) => !String(stop.property_type).includes("commercial"))).toBe(true);
    expect(selectedStops[0].threat_score).toBeGreaterThanOrEqual(selectedStops[1].threat_score);

    expect(routeSvc.optimizeRoute).toHaveBeenCalledTimes(2);
    expect(events).toHaveLength(2);
  });
});
