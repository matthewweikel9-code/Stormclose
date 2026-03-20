/**
 * Hail Recon adapter (placeholder)
 * API spec to be reviewed during implementation.
 * Maps Hail Recon responses to normalized StormEvent format.
 *
 * Until API spec is confirmed, returns empty result.
 */

import type { StormProviderResult } from "./types";

export async function fetchHailReconStorms(
  _apiKey: string,
  _params: {
    lat: number;
    lng: number;
    radius: number;
    live?: boolean;
    date?: string;
    days?: number;
  }
): Promise<StormProviderResult> {
  // TODO: Implement after Hail Recon API spec review
  return {
    storms: [],
    alerts: [],
    stormCells: [],
    source: "hailrecon",
  };
}
