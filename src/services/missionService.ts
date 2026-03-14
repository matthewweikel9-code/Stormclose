import { createClient } from "@/lib/supabase/server";
import { calculateThreatScore } from "@/lib/threatScore";
import { eventBus, type EventBus } from "@/lib/eventBus";
import { metrics } from "@/lib/metrics";
import { ParcelCacheService } from "@/services/parcelCacheService";
import { routeService, type RouteService } from "@/services/routeService";

type StormRecord = {
  id: string;
  latitude: number;
  longitude: number;
  impact_radius_miles?: number | null;
  hail_size_inches?: number | null;
  wind_speed_mph?: number | null;
  damage_score?: number | null;
  polygon_wkt?: string | null;
  polygon?: unknown;
  geom?: unknown;
  event_occurred_at?: string | null;
};

type ParcelRecord = {
  parcel_id?: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  lat?: number | null;
  lng?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  roof_age?: number | null;
  property_value?: number | null;
  property_type?: string | null;
  owner_name?: string | null;
  year_built?: number | null;
  square_feet?: number | null;
};

type MissionStopInsert = {
  address: string;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  latitude: number;
  longitude: number;
  owner_name?: string | null;
  year_built?: number | null;
  square_feet?: number | null;
  roof_age?: number | null;
  estimated_value?: number | null;
  estimated_claim?: number | null;
  property_type?: string | null;
  threat_score?: number;
  outcome?: string;
};

export interface CreateMissionFromStormOptions {
  limit?: number;
  signature: string;
  name?: string;
  description?: string;
  scheduledDate?: string | null;
  stormDurationMinutes?: number;
}

export interface CreateMissionFromStormResult {
  missionId: string;
  created: boolean;
  selectedStops: MissionStopInsert[];
}

interface MissionPersistence {
  getStormById(userId: string, stormId: string): Promise<StormRecord | null>;
  createMissionWithStopsTx(params: {
    userId: string;
    stormId: string;
    signature: string;
    name: string;
    description: string | null;
    centerLat: number;
    centerLng: number;
    radiusMiles: number;
    scheduledDate: string | null;
    stops: MissionStopInsert[];
  }): Promise<{ missionId: string; created: boolean }>;
}

interface ParcelService {
  getParcelsInPolygon(polygonWKT: string): Promise<ParcelRecord[]>;
}

class SupabaseMissionPersistence implements MissionPersistence {
  async getStormById(userId: string, stormId: string): Promise<StormRecord | null> {
    const supabase = await createClient();
    const { data, error } = await (supabase.from("storm_events_cache") as any)
      .select("*")
      .eq("id", stormId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return (data as StormRecord | null) ?? null;
  }

  async createMissionWithStopsTx(params: {
    userId: string;
    stormId: string;
    signature: string;
    name: string;
    description: string | null;
    centerLat: number;
    centerLng: number;
    radiusMiles: number;
    scheduledDate: string | null;
    stops: MissionStopInsert[];
  }): Promise<{ missionId: string; created: boolean }> {
    const supabase = await createClient();

    const { data, error } = await (supabase.rpc as any)("create_mission_with_stops", {
      p_user_id: params.userId,
      p_storm_event_id: params.stormId,
      p_signature: params.signature,
      p_name: params.name,
      p_description: params.description,
      p_center_lat: params.centerLat,
      p_center_lng: params.centerLng,
      p_radius_miles: params.radiusMiles,
      p_scheduled_date: params.scheduledDate,
      p_stops: params.stops,
    });

    if (error) {
      throw error;
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.mission_id) {
      throw new Error("Failed to create or fetch mission");
    }

    return {
      missionId: String(row.mission_id),
      created: Boolean(row.created),
    };
  }
}

function ensureRequiredString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} is required`);
  }

  return value.trim();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toWKTFromUnknownGeometry(value: unknown): string | null {
  if (typeof value === "string" && value.toUpperCase().startsWith("POLYGON")) {
    return value;
  }

  if (value && typeof value === "object") {
    const candidate = value as Record<string, unknown>;
    if (typeof candidate.wkt === "string") {
      return candidate.wkt;
    }
  }

  return null;
}

function milesToDegreesLat(miles: number): number {
  return miles / 69.0;
}

function milesToDegreesLng(miles: number, lat: number): number {
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const safe = Math.max(0.00001, Math.abs(cosLat));
  return miles / (69.172 * safe);
}

function buildCirclePolygonWKT(lat: number, lng: number, radiusMiles: number, points = 24): string {
  const ring: string[] = [];
  for (let i = 0; i <= points; i += 1) {
    const angle = (2 * Math.PI * i) / points;
    const dLat = milesToDegreesLat(radiusMiles) * Math.sin(angle);
    const dLng = milesToDegreesLng(radiusMiles, lat) * Math.cos(angle);
    ring.push(`${lng + dLng} ${lat + dLat}`);
  }
  return `POLYGON((${ring.join(", ")}))`;
}

function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function isResidential(parcel: ParcelRecord): boolean {
  const type = String(parcel.property_type || "").toLowerCase();
  if (!type) {
    return true;
  }
  const nonResidentialTokens = ["commercial", "industrial", "warehouse", "office", "retail"];
  return !nonResidentialTokens.some((token) => type.includes(token));
}

function computePropertyValueNormalization(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return 0.5;
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return 0.5;
  return clamp((value - min) / (max - min), 0, 1);
}

export class MissionService {
  constructor(
    private readonly persistence: MissionPersistence,
    private readonly parcelService: ParcelService,
    private readonly routeSvc: RouteService,
    private readonly bus: EventBus
  ) {}

  async createMissionFromStorm(
    userId: string,
    stormId: string,
    options: CreateMissionFromStormOptions
  ): Promise<CreateMissionFromStormResult> {
    const safeUserId = ensureRequiredString(userId, "userId");
    const safeStormId = ensureRequiredString(stormId, "stormId");
    const safeSignature = ensureRequiredString(options?.signature, "options.signature");

    const storm = await this.persistence.getStormById(safeUserId, safeStormId);
    if (!storm) {
      throw new Error("Storm event not found");
    }

    const centerLat = toFiniteNumber(storm.latitude, 0);
    const centerLng = toFiniteNumber(storm.longitude, 0);
    const radiusMiles = clamp(toFiniteNumber(storm.impact_radius_miles, 1), 0.1, 50);

    if (!Number.isFinite(storm.latitude) || !Number.isFinite(storm.longitude)) {
      console.warn(
        `[MissionService] Storm ${safeStormId} has missing lat/lng — defaulting to 0,0. Check storm_events_cache data.`
      );
    }

    const polygonWKT =
      storm.polygon_wkt ||
      toWKTFromUnknownGeometry(storm.polygon) ||
      toWKTFromUnknownGeometry(storm.geom) ||
      buildCirclePolygonWKT(centerLat, centerLng, radiusMiles);

    const parcels = (await this.parcelService.getParcelsInPolygon(polygonWKT)) || [];
    const residentialParcels = parcels.filter(isResidential);

    if (residentialParcels.length === 0) {
      throw new Error("No residential parcels found within the storm polygon");
    }

    const values = residentialParcels
      .map((parcel) => toFiniteNumber(parcel.property_value, Number.NaN))
      .filter((value) => Number.isFinite(value));

    const minValue = values.length > 0 ? Math.min(...values) : 0;
    const maxValue = values.length > 0 ? Math.max(...values) : 1;

    const hailSizeMm = clamp(toFiniteNumber(storm.hail_size_inches, 0) * 25.4, 0, 200);
    const windSpeed = clamp(toFiniteNumber(storm.wind_speed_mph, 0), 0, 250);
    const stormDurationMinutes = clamp(toFiniteNumber(options.stormDurationMinutes, 30), 0, 360);

    const scoredStops: MissionStopInsert[] = residentialParcels
      .map((parcel) => {
        const lat = toFiniteNumber(parcel.lat ?? parcel.latitude, Number.NaN);
        const lng = toFiniteNumber(parcel.lng ?? parcel.longitude, Number.NaN);
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || !parcel.address) {
          return null;
        }

        const distanceMiles = haversineMiles(centerLat, centerLng, lat, lng);
        const proximityScore = clamp(1 - distanceMiles / Math.max(0.1, radiusMiles), 0, 1);

        const estimatedValue = toFiniteNumber(parcel.property_value, 0);
        const parcelValueNormalized = computePropertyValueNormalization(estimatedValue, minValue, maxValue);
        const roofAgeYears = clamp(toFiniteNumber(parcel.roof_age, 10), 0, 80);

        const threatScore = calculateThreatScore({
          hailSize: hailSizeMm,
          windSpeed,
          stormDurationMinutes,
          proximityScore,
          parcelValueNormalized,
          roofAgeYears,
        });

        const rawClaim = estimatedValue * 0.12 * (threatScore / 100);
        const estimatedClaim = Number.isFinite(rawClaim) ? Math.round(Math.max(0, rawClaim)) : 0;

        return {
          address: String(parcel.address),
          city: parcel.city ?? null,
          state: parcel.state ?? null,
          zip: parcel.zip ?? null,
          latitude: lat,
          longitude: lng,
          owner_name: parcel.owner_name ?? null,
          year_built: parcel.year_built ?? null,
          square_feet: parcel.square_feet ?? null,
          roof_age: parcel.roof_age ?? null,
          estimated_value: estimatedValue || null,
          estimated_claim: estimatedClaim || null,
          property_type: parcel.property_type ?? "residential",
          threat_score: threatScore,
          outcome: "pending",
        } as MissionStopInsert;
      })
      .filter((stop): stop is MissionStopInsert => Boolean(stop));

    const safeLimit = clamp(toFiniteNumber(options.limit, 100), 1, 1000);
    const selectedStops = scoredStops
      .sort((a, b) => (b.threat_score || 0) - (a.threat_score || 0))
      .slice(0, safeLimit);

    const missionName =
      options.name ||
      `Storm Mission ${new Date(storm.event_occurred_at || Date.now()).toISOString().slice(0, 10)}`;

    const txResult = await this.persistence.createMissionWithStopsTx({
      userId: safeUserId,
      stormId: safeStormId,
      signature: safeSignature,
      name: missionName,
      description: options.description || null,
      centerLat,
      centerLng,
      radiusMiles,
      scheduledDate: options.scheduledDate || null,
      stops: selectedStops,
    });

    metrics.increment("mission_creation_success", 1, {
      created: txResult.created,
      stop_count: selectedStops.length,
    });

    await this.bus.publish("mission_created", {
      missionId: txResult.missionId,
      userId: safeUserId,
      stormId: safeStormId,
      created: txResult.created,
      stopCount: selectedStops.length,
    });

    void this.routeSvc.optimizeRoute(
      selectedStops.map((stop) => ({
        address: stop.address,
        latitude: stop.latitude,
        longitude: stop.longitude,
      }))
    ).catch((error) => {
      console.error("[MissionService] optimizeRoute failed:", error);
    });

    return {
      missionId: txResult.missionId,
      created: txResult.created,
      selectedStops,
    };
  }
}

const defaultMissionService = new MissionService(
  new SupabaseMissionPersistence(),
  ParcelCacheService,
  routeService,
  eventBus
);

export function createMissionFromStorm(
  userId: string,
  stormId: string,
  options: CreateMissionFromStormOptions
) {
  return defaultMissionService.createMissionFromStorm(userId, stormId, options);
}
