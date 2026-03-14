import { describe, it, expect, vi, beforeEach } from "vitest";
import { RouteService, type IRouteProvider, type RouteStopInput } from "../src/services/routeService";

const sampleStops: RouteStopInput[] = [
  { id: "1", address: "A", latitude: 35.5, longitude: -97.5 },
  { id: "2", address: "B", latitude: 35.51, longitude: -97.51 },
  { id: "3", address: "C", latitude: 35.52, longitude: -97.52 },
];

function createProvider(name: string, impl?: Partial<IRouteProvider>): IRouteProvider {
  return {
    name,
    maxStops: 25,
    isNetworked: true,
    optimize: vi.fn().mockResolvedValue({
      optimizedStops: sampleStops,
      metrics: {
        providerUsed: name,
        latencyMs: 5,
        fallbackTriggered: false,
      },
    }),
    ...impl,
  };
}

describe("RouteService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GOOGLE_DIRECTIONS_API_KEY = "test-key";
  });

  it("uses primary provider when available", async () => {
    const primary = createProvider("google_primary");
    const fallback = createProvider("local_fallback", { isNetworked: false });
    const service = new RouteService(primary, fallback);

    const result = await service.optimizeRoute(sampleStops);

    expect(primary.optimize).toHaveBeenCalledTimes(1);
    expect(fallback.optimize).not.toHaveBeenCalled();
    expect(result.metrics.providerUsed).toBe("google_primary");
    expect(result.metrics.fallbackTriggered).toBe(false);
  });

  it("falls back when google provider throws", async () => {
    const primary = createProvider("google_primary", {
      optimize: vi.fn().mockRejectedValue(new Error("429 Too Many Requests")),
    });
    const fallback = createProvider("local_fallback", { isNetworked: false });
    const service = new RouteService(primary, fallback);

    const result = await service.optimizeRoute(sampleStops);

    expect(primary.optimize).toHaveBeenCalledTimes(1);
    expect(fallback.optimize).toHaveBeenCalledTimes(1);
    expect(result.metrics.providerUsed).toBe("local_fallback");
    expect(result.metrics.fallbackTriggered).toBe(true);
    expect(result.metrics.originalProviderFailed).toBe("google_primary");
    expect(result.metrics.error).toContain("429");
  });

  it("falls back when key is missing", async () => {
    delete process.env.GOOGLE_DIRECTIONS_API_KEY;
    const primary = createProvider("google_primary");
    const fallback = createProvider("local_fallback", { isNetworked: false });
    const service = new RouteService(primary, fallback);

    const result = await service.optimizeRoute(sampleStops);

    expect(primary.optimize).not.toHaveBeenCalled();
    expect(fallback.optimize).toHaveBeenCalledTimes(1);
    expect(result.metrics.fallbackTriggered).toBe(true);
    expect(result.metrics.originalProviderFailed).toBe("google_api_key_missing");
  });

  it("uses local when stop count exceeds primary maxStops", async () => {
    const primary = createProvider("google_primary", { maxStops: 2 });
    const fallback = createProvider("local_fallback", { isNetworked: false });
    const service = new RouteService(primary, fallback);

    const result = await service.optimizeRoute(sampleStops);

    expect(primary.optimize).not.toHaveBeenCalled();
    expect(fallback.optimize).toHaveBeenCalledTimes(1);
    expect(result.metrics.originalProviderFailed).toBe("primary_max_stops_exceeded");
  });
});
