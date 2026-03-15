import { eventBus } from "@/lib/eventBus";
import { metrics as metricsEmitter } from "@/lib/metrics";
import { googleRouteProvider } from "@/integrations/googleRouteProvider";
import { localTspProvider } from "@/integrations/localTspProvider";

export interface RouteStopInput {
  id?: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface RouteMetrics {
  providerUsed: string;
  latencyMs: number;
  fallbackTriggered: boolean;
  originalProviderFailed?: string;
  error?: string;
}

export interface OptimizedRouteResult {
  optimizedStops: RouteStopInput[];
  estimatedDistanceMiles?: number;
  estimatedDurationMinutes?: number;
  metrics: RouteMetrics;
}

export interface IRouteProvider {
  readonly name: string;
  readonly maxStops: number;
  readonly isNetworked: boolean;
  optimize(stops: RouteStopInput[]): Promise<OptimizedRouteResult>;
}

type OptimizeOptions = {
  preferredProvider?: "google" | "local";
};

export class RouteService {
  constructor(
    private readonly primaryProvider: IRouteProvider,
    private readonly fallbackProvider: IRouteProvider
  ) {}

  async optimize(stops: RouteStopInput[], options: OptimizeOptions = {}): Promise<OptimizedRouteResult> {
    const safeStops = (stops || []).filter(
      (stop) =>
        Number.isFinite(stop.latitude) &&
        Number.isFinite(stop.longitude) &&
        typeof stop.address === "string" &&
        stop.address.length > 0
    );

    if (safeStops.length <= 1) {
      // No optimization needed for 0 or 1 stop — return as-is without invoking any provider.
      const result: OptimizedRouteResult = {
        optimizedStops: safeStops,
        metrics: {
          providerUsed: "passthrough",
          latencyMs: 0,
          fallbackTriggered: false,
        },
      };
      this.emitMetrics(result.metrics);
      return result;
    }

    const preferredProvider = options.preferredProvider;
    if (preferredProvider === "local") {
      const localResult = await this.fallbackProvider.optimize(safeStops);
      this.emitMetrics(localResult.metrics);
      return localResult;
    }

    if (safeStops.length > this.primaryProvider.maxStops || !process.env.GOOGLE_DIRECTIONS_API_KEY) {
      const localResult = await this.fallbackProvider.optimize(safeStops);
      localResult.metrics = {
        ...localResult.metrics,
        fallbackTriggered: true,
        originalProviderFailed:
          safeStops.length > this.primaryProvider.maxStops
            ? "primary_max_stops_exceeded"
            : "google_api_key_missing",
      };
      this.emitMetrics(localResult.metrics);
      return localResult;
    }

    try {
      const primaryResult = await this.primaryProvider.optimize(safeStops);
      this.emitMetrics(primaryResult.metrics);
      return primaryResult;
    } catch (error) {
      const localResult = await this.fallbackProvider.optimize(safeStops);
      localResult.metrics = {
        ...localResult.metrics,
        fallbackTriggered: true,
        originalProviderFailed: this.primaryProvider.name,
        error: error instanceof Error ? error.message : String(error),
      };
      this.emitMetrics(localResult.metrics);
      return localResult;
    }
  }

  async optimizeRoute(stops: RouteStopInput[]): Promise<OptimizedRouteResult> {
    return this.optimize(stops);
  }

  private emitMetrics(routeMetrics: RouteMetrics) {
    if (routeMetrics.fallbackTriggered) {
      const reason = routeMetrics.originalProviderFailed || "unknown";
      const provider = routeMetrics.providerUsed || "unknown";
      const errorType = routeMetrics.error ? "provider_error" : "provider_policy";

      // route_provider_fallbacks: how often we have to leave primary route optimization
      // due to provider failures, quota limits, missing keys, or configured constraints.
      // This metric is critical for route quality/cost reliability dashboards.
      metricsEmitter.increment("route_provider_fallbacks", 1, {
        reason,
        provider,
        error_type: errorType,
      });
    }

    void eventBus.publish("route.optimized", routeMetrics).catch(() => undefined);
  }
}

export const routeService = new RouteService(googleRouteProvider, localTspProvider);