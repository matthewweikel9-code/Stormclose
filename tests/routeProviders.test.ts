import { describe, it, expect } from "vitest";
import { GoogleRouteProvider } from "../src/integrations/googleRouteProvider";
import { LocalTspProvider } from "../src/integrations/localTspProvider";

describe("GoogleRouteProvider", () => {
  it("maps waypoint order returned by Google", async () => {
    const provider = new GoogleRouteProvider("test-key", {
      getJson: async () => ({
        status: "OK",
        routes: [
          {
            waypoint_order: [1, 0],
            legs: [
              { distance: { value: 1000 }, duration: { value: 120 } },
              { distance: { value: 2000 }, duration: { value: 240 } },
              { distance: { value: 1500 }, duration: { value: 180 } },
            ],
          },
        ],
      }),
    } as any);

    const stops = [
      { id: "1", address: "Start", latitude: 35.5, longitude: -97.5 },
      { id: "2", address: "Mid-A", latitude: 35.51, longitude: -97.51 },
      { id: "3", address: "Mid-B", latitude: 35.52, longitude: -97.52 },
      { id: "4", address: "End", latitude: 35.53, longitude: -97.53 },
    ];

    const result = await provider.optimize(stops);

    expect(result.optimizedStops.map((stop) => stop.id)).toEqual(["1", "3", "2", "4"]);
    expect(result.estimatedDistanceMiles).toBeGreaterThan(0);
    expect(result.estimatedDurationMinutes).toBeGreaterThan(0);
  });
});

describe("LocalTspProvider", () => {
  it("returns all stops and deterministic provider metrics", async () => {
    const provider = new LocalTspProvider();
    const stops = [
      { id: "a", address: "A", latitude: 35.5, longitude: -97.5 },
      { id: "b", address: "B", latitude: 35.8, longitude: -97.9 },
      { id: "c", address: "C", latitude: 35.6, longitude: -97.55 },
      { id: "d", address: "D", latitude: 35.7, longitude: -97.7 },
    ];

    const result = await provider.optimize(stops);

    expect(result.optimizedStops).toHaveLength(stops.length);
    expect(new Set(result.optimizedStops.map((stop) => stop.id)).size).toBe(stops.length);
    expect(result.metrics.providerUsed).toBe("local_tsp_2opt");
    expect(result.estimatedDistanceMiles).toBeGreaterThan(0);
  });
});
