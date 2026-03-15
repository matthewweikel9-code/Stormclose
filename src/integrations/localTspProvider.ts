import type { IRouteProvider, OptimizedRouteResult, RouteStopInput } from "@/services/routeService";

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function haversineMiles(a: RouteStopInput, b: RouteStopInput): number {
  const earthRadiusMiles = 3958.8;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * earthRadiusMiles * Math.asin(Math.sqrt(h));
}

function routeDistance(stops: RouteStopInput[]): number {
  if (stops.length < 2) {
    return 0;
  }

  let total = 0;
  for (let i = 0; i < stops.length - 1; i += 1) {
    total += haversineMiles(stops[i], stops[i + 1]);
  }
  return total;
}

function nearestNeighborSeed(stops: RouteStopInput[]): RouteStopInput[] {
  if (stops.length <= 2) {
    return [...stops];
  }

  const remaining = [...stops];
  const ordered: RouteStopInput[] = [];
  ordered.push(remaining.shift()!);

  while (remaining.length > 0) {
    const last = ordered[ordered.length - 1];
    let nextIndex = 0;
    let shortest = Number.POSITIVE_INFINITY;

    for (let i = 0; i < remaining.length; i += 1) {
      const candidateDistance = haversineMiles(last, remaining[i]);
      if (candidateDistance < shortest) {
        shortest = candidateDistance;
        nextIndex = i;
      }
    }

    ordered.push(remaining.splice(nextIndex, 1)[0]);
  }

  return ordered;
}

/**
 * Applies iterative 2-opt swaps to improve an initial tour.
 *
 * Time complexity: O(n² × maxIterations). For n > ~100 this will block the
 * Node.js event loop. If mission sizes routinely exceed 150 stops, move this
 * to a worker_thread or switch to a streaming heuristic.
 */
function twoOpt(stops: RouteStopInput[], maxIterations = 200): RouteStopInput[] {
  if (stops.length <= 3) {
    return [...stops];
  }

  let best = [...stops];
  let bestDistance = routeDistance(best);
  let improved = true;
  let iterations = 0;

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations += 1;

    for (let i = 1; i < best.length - 2; i += 1) {
      for (let k = i + 1; k < best.length - 1; k += 1) {
        const candidate = [
          ...best.slice(0, i),
          ...best.slice(i, k + 1).reverse(),
          ...best.slice(k + 1),
        ];

        const candidateDistance = routeDistance(candidate);
        if (candidateDistance < bestDistance) {
          best = candidate;
          bestDistance = candidateDistance;
          improved = true;
        }
      }
    }
  }

  return best;
}

export class LocalTspProvider implements IRouteProvider {
  readonly name = "local_tsp_2opt";
  readonly maxStops = 500;
  readonly isNetworked = false;

  async optimize(stops: RouteStopInput[]): Promise<OptimizedRouteResult> {
    const startedAt = Date.now();
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
        estimatedDistanceMiles: routeDistance(filtered),
        metrics: {
          providerUsed: this.name,
          latencyMs: Date.now() - startedAt,
          fallbackTriggered: false,
        },
      };
    }

    const seeded = nearestNeighborSeed(filtered);
    const optimized = twoOpt(seeded);
    const estimatedDistanceMiles = routeDistance(optimized);
    const estimatedDurationMinutes = Math.round((estimatedDistanceMiles / 25) * 60);

    return {
      optimizedStops: optimized,
      estimatedDistanceMiles,
      estimatedDurationMinutes,
      metrics: {
        providerUsed: this.name,
        latencyMs: Date.now() - startedAt,
        fallbackTriggered: false,
      },
    };
  }
}

export const localTspProvider = new LocalTspProvider();
