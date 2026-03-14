export interface RouteStopInput {
  id?: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface OptimizedRouteResult {
  optimizedStops: RouteStopInput[];
}

export class RouteService {
  async optimizeRoute(stops: RouteStopInput[]): Promise<OptimizedRouteResult> {
    const safeStops = (stops || []).filter(
      (stop) =>
        Number.isFinite(stop.latitude) &&
        Number.isFinite(stop.longitude) &&
        typeof stop.address === "string"
    );

    if (safeStops.length <= 1) {
      return { optimizedStops: safeStops };
    }

    const sorted = [...safeStops].sort((a, b) => {
      if (a.latitude === b.latitude) {
        return a.longitude - b.longitude;
      }
      return a.latitude - b.latitude;
    });

    return { optimizedStops: sorted };
  }
}

export const routeService = new RouteService();