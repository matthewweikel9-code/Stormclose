-- ============================================================================
-- PERFORMANCE TUNING: INDEXES + MATERIALIZED VIEW
-- ============================================================================
-- NOTE:
-- Direct DB EXPLAIN ANALYZE execution is environment-dependent and may not be
-- available in CI/local editor context. This migration applies optimizations
-- derived from captured production query patterns in the codebase:
--
-- 1) Parcel geom lookups (ST_Intersects / ST_DWithin)
--    Query source: get_parcels_in_polygon() / parcel cache spatial lookups.
--
-- 2) Lead scoring bulk updates and hot-lead filters
--    Query source: /api/cron/rescore-leads, /api/dashboard/revenue-hub,
--    and lead-scoring workflows that target active (non closed/lost) leads.
--
-- 3) Mission stats heavy aggregates
--    Query source: get_mission_stats() used by /api/missions.
-- ============================================================================

-- ============================================================================
-- 1) PARCEL GEOM QUERIES
-- ============================================================================
-- Existing: parcel_cache_geom_idx on geom (geometry).
-- Added: geography functional GIST to accelerate meter/mile distance lookups
-- that cast to geography in ST_DWithin patterns.
CREATE INDEX IF NOT EXISTS parcel_cache_geom_geography_gist_idx
    ON parcel_cache
    USING GIST (geography(geom))
    WHERE geom IS NOT NULL;

-- Helps recency-first cache scans on rows that also have usable geometry.
CREATE INDEX IF NOT EXISTS parcel_cache_last_seen_geom_idx
    ON parcel_cache(last_seen DESC)
    WHERE geom IS NOT NULL;

-- ============================================================================
-- 2) LEADS SCORING BULK UPDATE / HOT-LEAD FILTERS (PARTIAL INDEXES)
-- ============================================================================
-- Active lead queue used by rescoring and dashboard pipelines.
CREATE INDEX IF NOT EXISTS leads_rescore_active_idx
    ON leads(user_id, created_at DESC, id)
    WHERE status NOT IN ('closed', 'lost');

-- Hot lead retrieval path (lead_score threshold + active statuses).
CREATE INDEX IF NOT EXISTS leads_hot_active_idx
    ON leads(user_id, lead_score DESC)
    WHERE status NOT IN ('closed', 'lost');

-- Fast identification of unscored / stale candidates in active pipeline.
CREATE INDEX IF NOT EXISTS leads_unscored_active_idx
    ON leads(user_id, id)
    WHERE status NOT IN ('closed', 'lost')
      AND (lead_score IS NULL OR lead_score = 0);

-- ============================================================================
-- 3) MISSION STATS HEAVY AGGREGATES (MATERIALIZED VIEW)
-- ============================================================================
DROP MATERIALIZED VIEW IF EXISTS mission_stats_daily_mv;

CREATE MATERIALIZED VIEW mission_stats_daily_mv AS
SELECT
    cm.user_id,
    (cm.created_at AT TIME ZONE 'UTC')::DATE AS mission_date,
    COUNT(*)::BIGINT AS total_missions,
    COUNT(*) FILTER (WHERE cm.status = 'in_progress')::BIGINT AS active_missions,
    COALESCE(SUM(cm.stops_knocked), 0)::BIGINT AS total_doors_knocked,
    COALESCE(SUM(cm.stops_not_home), 0)::BIGINT AS total_not_home,
    COALESCE(SUM(cm.appointments_set), 0)::BIGINT AS total_appointments,
    COALESCE(SUM(cm.leads_created), 0)::BIGINT AS total_leads,
    COALESCE(SUM(cm.estimated_pipeline), 0)::DECIMAL AS total_estimated_pipeline
FROM canvass_missions cm
GROUP BY cm.user_id, (cm.created_at AT TIME ZONE 'UTC')::DATE
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS mission_stats_daily_mv_user_date_uidx
    ON mission_stats_daily_mv(user_id, mission_date);

CREATE INDEX IF NOT EXISTS mission_stats_daily_mv_user_date_idx
    ON mission_stats_daily_mv(user_id, mission_date DESC);

-- Initial populate (non-concurrent is fine for first load).
REFRESH MATERIALIZED VIEW mission_stats_daily_mv;

-- Refresh helper for cron/manual refresh jobs.
CREATE OR REPLACE FUNCTION refresh_mission_stats_daily_mv(p_concurrent BOOLEAN DEFAULT TRUE)
RETURNS VOID AS $$
BEGIN
    IF p_concurrent THEN
        REFRESH MATERIALIZED VIEW CONCURRENTLY mission_stats_daily_mv;
    ELSE
        REFRESH MATERIALIZED VIEW mission_stats_daily_mv;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-point existing mission stats RPC to aggregate from MV instead of raw table.
CREATE OR REPLACE FUNCTION get_mission_stats(p_user_id UUID, p_days_back INTEGER DEFAULT 30)
RETURNS TABLE (
    total_missions BIGINT,
    active_missions BIGINT,
    total_doors_knocked BIGINT,
    total_not_home BIGINT,
    total_appointments BIGINT,
    total_leads BIGINT,
    total_estimated_pipeline DECIMAL,
    avg_doors_per_mission DECIMAL,
    avg_appointments_per_mission DECIMAL,
    appointment_rate DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(SUM(mv.total_missions), 0)::BIGINT AS total_missions,
        COALESCE(SUM(mv.active_missions), 0)::BIGINT AS active_missions,
        COALESCE(SUM(mv.total_doors_knocked), 0)::BIGINT AS total_doors_knocked,
        COALESCE(SUM(mv.total_not_home), 0)::BIGINT AS total_not_home,
        COALESCE(SUM(mv.total_appointments), 0)::BIGINT AS total_appointments,
        COALESCE(SUM(mv.total_leads), 0)::BIGINT AS total_leads,
        COALESCE(SUM(mv.total_estimated_pipeline), 0)::DECIMAL AS total_estimated_pipeline,
        CASE WHEN COALESCE(SUM(mv.total_missions), 0) > 0
            THEN ROUND(COALESCE(SUM(mv.total_doors_knocked), 0)::DECIMAL / SUM(mv.total_missions), 1)
            ELSE 0
        END AS avg_doors_per_mission,
        CASE WHEN COALESCE(SUM(mv.total_missions), 0) > 0
            THEN ROUND(COALESCE(SUM(mv.total_appointments), 0)::DECIMAL / SUM(mv.total_missions), 1)
            ELSE 0
        END AS avg_appointments_per_mission,
        CASE WHEN COALESCE(SUM(mv.total_doors_knocked), 0) > 0
            THEN ROUND((COALESCE(SUM(mv.total_appointments), 0)::DECIMAL / SUM(mv.total_doors_knocked)) * 100, 1)
            ELSE 0
        END AS appointment_rate
    FROM mission_stats_daily_mv mv
    WHERE mv.user_id = p_user_id
      AND mv.mission_date >= CURRENT_DATE - GREATEST(p_days_back, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
