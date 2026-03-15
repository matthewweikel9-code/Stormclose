CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS storm_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    storm_event_id UUID NOT NULL REFERENCES storm_events_cache(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    centroid GEOGRAPHY(POINT, 4326) NOT NULL,
    radius_km DECIMAL(8, 2) NOT NULL DEFAULT 8.00,
    opportunity_score INTEGER NOT NULL DEFAULT 0 CHECK (opportunity_score >= 0 AND opportunity_score <= 100),
    house_count INTEGER NOT NULL DEFAULT 0,
    unworked_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS storm_zones_storm_event_idx ON storm_zones(storm_event_id);
CREATE INDEX IF NOT EXISTS storm_zones_score_idx ON storm_zones(opportunity_score DESC);
CREATE INDEX IF NOT EXISTS storm_zones_centroid_idx ON storm_zones USING GIST (centroid);

CREATE TABLE IF NOT EXISTS territory_watchlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    bounds GEOGRAPHY(POLYGON, 4326) NOT NULL,
    alert_threshold INTEGER NOT NULL DEFAULT 70 CHECK (alert_threshold >= 0 AND alert_threshold <= 100),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS territory_watchlists_user_idx ON territory_watchlists(user_id);
CREATE INDEX IF NOT EXISTS territory_watchlists_bounds_idx ON territory_watchlists USING GIST (bounds);

CREATE TABLE IF NOT EXISTS watchlist_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    watchlist_id UUID NOT NULL REFERENCES territory_watchlists(id) ON DELETE CASCADE,
    storm_zone_id UUID NOT NULL REFERENCES storm_zones(id) ON DELETE CASCADE,
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acknowledged BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS watchlist_alerts_watchlist_idx ON watchlist_alerts(watchlist_id);
CREATE INDEX IF NOT EXISTS watchlist_alerts_zone_idx ON watchlist_alerts(storm_zone_id);
CREATE INDEX IF NOT EXISTS watchlist_alerts_triggered_idx ON watchlist_alerts(triggered_at DESC);

ALTER TABLE storm_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE territory_watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own storm zones via source event ownership" ON storm_zones;
CREATE POLICY "Users can view own storm zones via source event ownership"
ON storm_zones FOR SELECT
USING (
    storm_event_id IN (
        SELECT id FROM storm_events_cache WHERE user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Users can manage own watchlists" ON territory_watchlists;
CREATE POLICY "Users can manage own watchlists"
ON territory_watchlists FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view own watchlist alerts" ON watchlist_alerts;
CREATE POLICY "Users can view own watchlist alerts"
ON watchlist_alerts FOR SELECT
USING (
    watchlist_id IN (
        SELECT id FROM territory_watchlists WHERE user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Users can acknowledge own watchlist alerts" ON watchlist_alerts;
CREATE POLICY "Users can acknowledge own watchlist alerts"
ON watchlist_alerts FOR UPDATE
USING (
    watchlist_id IN (
        SELECT id FROM territory_watchlists WHERE user_id = auth.uid()
    )
);

CREATE OR REPLACE FUNCTION set_storm_zones_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS storm_zones_updated_at_trigger ON storm_zones;
CREATE TRIGGER storm_zones_updated_at_trigger
BEFORE UPDATE ON storm_zones
FOR EACH ROW
EXECUTE FUNCTION set_storm_zones_updated_at();
