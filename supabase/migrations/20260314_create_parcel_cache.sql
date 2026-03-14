-- ============================================================================
-- PARCEL CACHE TABLE
-- Caches CoreLogic parcel boundary and assessment data locally to reduce API 
-- costs and improve spatial query performance.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS parcel_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parcel_id TEXT UNIQUE NOT NULL,
    address TEXT,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    geom GEOMETRY(Geometry, 4326),
    roof_age INTEGER,
    property_value NUMERIC(14, 2),
    corelogic_hash TEXT,
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Spatial index for fast ST_Intersects and ST_DWithin queries
CREATE INDEX IF NOT EXISTS parcel_cache_geom_idx ON parcel_cache USING GIST (geom);

-- Indexes for cache invalidation and diffing
CREATE INDEX IF NOT EXISTS parcel_cache_hash_idx ON parcel_cache(corelogic_hash);
CREATE INDEX IF NOT EXISTS parcel_cache_last_seen_idx ON parcel_cache(last_seen DESC);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_parcel_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS parcel_cache_updated_at ON parcel_cache;
CREATE TRIGGER parcel_cache_updated_at
    BEFORE UPDATE ON parcel_cache
    FOR EACH ROW
    EXECUTE FUNCTION update_parcel_cache_updated_at();

-- ============================================================================
-- RPC: Get Parcels In Polygon
-- ============================================================================
CREATE OR REPLACE FUNCTION get_parcels_in_polygon(p_polygon_wkt TEXT)
RETURNS SETOF parcel_cache AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM parcel_cache
    WHERE ST_Intersects(geom, ST_GeomFromText(p_polygon_wkt, 4326));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- RPC: Upsert Parcel Cache
-- ============================================================================
CREATE OR REPLACE FUNCTION upsert_parcel_cache(
    p_parcel_id TEXT,
    p_address TEXT DEFAULT NULL,
    p_lat DOUBLE PRECISION DEFAULT NULL,
    p_lng DOUBLE PRECISION DEFAULT NULL,
    p_geom_wkt TEXT DEFAULT NULL,
    p_roof_age INTEGER DEFAULT NULL,
    p_property_value NUMERIC DEFAULT NULL,
    p_corelogic_hash TEXT DEFAULT NULL
)
RETURNS SETOF parcel_cache AS $$
BEGIN
    RETURN QUERY
    INSERT INTO parcel_cache (
        parcel_id, address, lat, lng, geom, roof_age, property_value, corelogic_hash, last_seen
    ) VALUES (
        p_parcel_id, 
        p_address, 
        p_lat, 
        p_lng, 
        CASE WHEN p_geom_wkt IS NOT NULL THEN ST_GeomFromText(p_geom_wkt, 4326) ELSE NULL END,
        p_roof_age, 
        p_property_value, 
        p_corelogic_hash, 
        NOW()
    )
    ON CONFLICT (parcel_id) DO UPDATE SET
        address = EXCLUDED.address,
        lat = EXCLUDED.lat,
        lng = EXCLUDED.lng,
        geom = COALESCE(EXCLUDED.geom, parcel_cache.geom),
        roof_age = EXCLUDED.roof_age,
        property_value = EXCLUDED.property_value,
        corelogic_hash = EXCLUDED.corelogic_hash,
        last_seen = NOW()
    RETURNING *;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies
ALTER TABLE parcel_cache ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated users
CREATE POLICY "Allow read access to authenticated users" ON parcel_cache
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow upsert for authenticated users" ON parcel_cache
    FOR ALL USING (auth.role() = 'authenticated');