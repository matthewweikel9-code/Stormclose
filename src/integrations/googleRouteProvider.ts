import type { IRouteProvider, OptimizedRouteResult, RouteStopInput } from "@/services/routeService";

interface DirectionsLeg {
  distance?: { value?: number };
  duration?: { value?: number };
}

interface DirectionsRoute {
  waypoint_order?: number[];
  legs?: DirectionsLeg[];
}

interface DirectionsResponse {
  status?: string;
  routes?: DirectionsRoute[];
  error_message?: string;
}

interface HttpClient {
  getJson(url: string): Promise<DirectionsResponse>;
}

class FetchHttpClient implements HttpClient {
  async getJson(url: string): Promise<DirectionsResponse> {
    const response = await fetch(url, { method: "GET" });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Google Directions request failed: ${response.status} ${text}`);
    }
    return response.json();
  }
}

function encodeStop(stop: RouteStopInput): string {
  return `${stop.latitude},${stop.longitude}`;
}

export class GoogleRouteProvider implements IRouteProvider {
  readonly name = "google_route_provider";
  readonly maxStops = 25;
  readonly isNetworked = true;

  constructor(
    private readonly apiKey: string = process.env.GOOGLE_DIRECTIONS_API_KEY || "",
    private readonly httpClient: HttpClient = new FetchHttpClient()
  ) {}

  async optimize(stops: RouteStopInput[]): Promise<OptimizedRouteResult> {
    const startedAt = Date.now();

    if (!this.apiKey) {
      throw new Error("GOOGLE_DIRECTIONS_API_KEY is required");
    }

    const filtered = (stops || []).filter(
      (stop) =>
        Number.isFinite(stop.latitude) &&
        Number.isFinite(stop.longitude) &&
        typeof stop.address === "string" &&
        stop.address.length > 0
    );

    if (filtered.length <= 1) {
      return {
        optimizedStops: filtered,
        metrics: {
          providerUsed: this.name,
          latencyMs: Date.now() - startedAt,
          fallbackTriggered: false,
        },
      };
    }

    if (filtered.length > this.maxStops) {
      throw new Error(`Google provider supports at most ${this.maxStops} stops`);
    }

    const origin = encodeStop(filtered[0]);
    const destination = encodeStop(filtered[filtered.length - 1]);
    const interior = filtered.slice(1, -1);

    const params = new URLSearchParams({
      origin,
      destination,
      key: this.apiKey,
    });

    if (interior.length > 0) {
      params.set("waypoints", `optimize:true|${interior.map(encodeStop).join("|")}`);
    }

    const url = `https://maps.googleapis.com/maps/api/directions/json?${params.toString()}`;
    const data = await this.httpClient.getJson(url);

    if (!data || data.status !== "OK" || !Array.isArray(data.routes) || data.routes.length === 0) {
      throw new Error(data?.error_message || `Google Directions error: ${data?.status || "UNKNOWN"}`);
    }

    const route = data.routes[0];
    const order = route.waypoint_order || interior.map((_, index) => index);
    const optimizedInterior = order.map((index) => interior[index]).filter(Boolean);
    const optimizedStops = [filtered[0], ...optimizedInterior, filtered[filtered.length - 1]];

    const legs = route.legs || [];
    const totalMeters = legs.reduce((sum, leg) => sum + (leg.distance?.value || 0), 0);
    const totalSeconds = legs.reduce((sum, leg) => sum + (leg.duration?.value || 0), 0);

    return {
      optimizedStops,
      estimatedDistanceMiles: Math.round((totalMeters / 1609.344) * 100) / 100,
      estimatedDurationMinutes: Math.round(totalSeconds / 60),
      metrics: {
        providerUsed: this.name,
        latencyMs: Date.now() - startedAt,
        fallbackTriggered: false,
      },
    };
  }
}

export const googleRouteProvider = new GoogleRouteProvider();
