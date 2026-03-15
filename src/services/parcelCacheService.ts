import { createClient } from "@/lib/supabase/server";

export interface ParcelCacheData {
  parcel_id: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  geomWKT?: string | null; // Well-Known Text geometry
  roof_age?: number | null;
  property_value?: number | null;
  corelogic_hash?: string | null;
}

export class ParcelCacheService {
  /**
   * Retrieves parcels intersecting a given WKT polygon
   */
  static async getParcelsInPolygon(polygonWKT: string) {
    const supabase = await createClient();
    
    // We use a raw PostGIS query via an RPC function
    const { data, error } = await supabase.rpc('get_parcels_in_polygon', {
      p_polygon_wkt: polygonWKT
    } as any);

    if (error) {
      console.error("Error fetching parcels in polygon:", error);
      throw error;
    }

    return data;
  }

  /**
   * Upserts a single parcel into the cache
   */
  static async upsertParcel(data: ParcelCacheData) {
    const supabase = await createClient();
    
    // Convert WKT to PostGIS geometry using ST_GeomFromText via RPC
    const { data: result, error } = await supabase.rpc('upsert_parcel_cache', {
      p_parcel_id: data.parcel_id,
      p_address: data.address,
      p_lat: data.lat,
      p_lng: data.lng,
      p_geom_wkt: data.geomWKT,
      p_roof_age: data.roof_age,
      p_property_value: data.property_value,
      p_corelogic_hash: data.corelogic_hash
    } as any);

    if (error) {
      // Fallback if RPC doesn't exist, just do a normal upsert without geom
      const { data: fallbackResult, error: fallbackError } = await (supabase
        .from('parcel_cache') as any)
        .upsert({
          parcel_id: data.parcel_id,
          address: data.address,
          lat: data.lat,
          lng: data.lng,
          roof_age: data.roof_age,
          property_value: data.property_value,
          corelogic_hash: data.corelogic_hash,
          last_seen: new Date().toISOString()
        } as any, { onConflict: 'parcel_id' })
        .select()
        .single();
        
      if (fallbackError) throw fallbackError;
      return fallbackResult;
    }

    return result && Array.isArray(result) ? result[0] : result;
  }

  /**
   * Marks a list of parcel IDs for bulk refresh / signals to the sync worker
   */
  static async bulkRefresh(parcelIds: string[]) {
    const supabase = await createClient();
    
    // Update last_seen to epoch to force a refresh on next cron run
    const { data, error } = await (supabase
      .from('parcel_cache') as any)
      .update({ last_seen: new Date(0).toISOString() } as any)
      .in('parcel_id', parcelIds)
      .select();
      
    if (error) throw error;
    return data;
  }
}
