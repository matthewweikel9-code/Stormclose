/**
 * Normalized storm event shape consumed by Storm Ops map and timeline.
 * All providers (Xweather, HailTrace, Hail Recon, NWS) map to this format.
 */
export interface StormEvent {
  id: string;
  type: "hail" | "wind" | "tornado" | "severe_thunderstorm";
  severity: "minor" | "moderate" | "severe" | "extreme";
  hailSize?: number;
  windSpeed?: number;
  lat: number;
  lng: number;
  radius: number;
  startTime: string;
  endTime?: string;
  damageScore: number;
  path?: { lat: number; lng: number }[];
  isActive?: boolean;
  location?: string;
  county?: string;
  state?: string;
  comments?: string;
}

export interface FormattedAlert {
  id: string;
  type: string;
  name: string;
  severity: string;
  color: string;
  body: string;
  issuedAt: string;
  expiresAt: string;
  location: string;
  emergency: boolean;
}

export interface FormattedStormCell {
  id: string;
  lat: number;
  lng: number;
  hailProb: number;
  hailProbSevere: number;
  maxHailSize: number;
  tornadoProb: number;
  isRotating: boolean;
  isSevere: boolean;
  speedMph: number;
  direction: number;
  location: string;
}

export type StormProviderSource =
  | "hailtrace"
  | "hailrecon"
  | "xweather"
  | "nws-fallback"
  | "storm-cache"
  | "xweather+leads"
  | "nws-fallback-live";

export interface StormProviderResult {
  storms: StormEvent[];
  alerts: FormattedAlert[];
  stormCells: FormattedStormCell[];
  source: StormProviderSource;
}

export interface StormProviderAdapter {
  /** Fetch storms for map/timeline. Returns normalized StormEvent[]. */
  fetchStorms(params: {
    lat: number;
    lng: number;
    radius: number;
    live?: boolean;
    date?: string;
    days?: number;
  }): Promise<StormProviderResult>;
}
