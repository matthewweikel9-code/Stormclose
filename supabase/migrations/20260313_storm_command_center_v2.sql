-- ============================================================================
-- STORM COMMAND CENTER V2 - DATABASE UPGRADE
-- Canvass Missions, Mission Stops, Storm Events Cache, Alert Thresholds
-- ============================================================================

-- ============================================================================
-- STORM EVENTS CACHE TABLE
-- Cached storm events from XWeather for timeline/history views
-- ============================================================================
CREATE TABLE IF NOT EXISTS storm_events_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Event identification
    xweather_id TEXT,
    event_type TEXT NOT NULL CHECK (event_type IN ('hail', 'wind', 'tornado', 'severe_thunderstorm', 'flood')),
    
    -- Severity & measurements
    severity TEXT DEFAULT 'minor' CHECK (severity IN ('minor', 'moderate', 'severe', 'extreme')),
    hail_size_inches DECIMAL(4, 2),
    wind_speed_mph INTEGER,
    damage_score INTEGER DEFAULT 0 CHECK (damage_score >= 0 AND damage_score <= 100),
    
    -- Location
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    location_name TEXT,
    county TEXT,
    state TEXT,
    
    -- Impact radius for map rendering (miles)
    impact_radius_miles DECIMAL(6, 2) DEFAULT 5.0,
    
    -- Estimated affected properties (from CoreLogic scan or estimate)
    estimated_properties INTEGER DEFAULT 0,
    estimated_opportunity DECIMAL(14, 2) DEFAULT 0,  -- total addressable revenue
    
    -- Canvass tracking
    properties_scanned INTEGER DEFAULT 0,
    properties_canvassed INTEGER DEFAULT 0,
    leads_generated INTEGER DEFAULT 0,
    appointments_set INTEGER DEFAULT 0,
    revenue_captured DECIMAL(14, 2) DEFAULT 0,
    
    -- Ownership
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Timestamps
    event_occurred_at TIMESTAMPTZ NOT NULL,
    first_detected_at TIMESTAMPTZ DEFAULT NOW(),
    comments TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Prevent duplicate caching of same event per user
    UNIQUE(user_id, xweather_id)
);

CREATE INDEX IF NOT EXISTS storm_events_cache_user_idx ON storm_events_cache(user_id);
CREATE INDEX IF NOT EXISTS storm_events_cache_date_idx ON storm_events_cache(event_occurred_at DESC);
CREATE INDEX IF NOT EXISTS storm_events_cache_type_idx ON storm_events_cache(event_type);
CREATE INDEX IF NOT EXISTS storm_events_cache_location_idx ON storm_events_cache USING GIST (
    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
);

-- ============================================================================
-- CANVASS MISSIONS TABLE
-- Deployments to storm-affected areas
-- ============================================================================
CREATE TABLE IF NOT EXISTS canvass_missions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    
    -- Mission identity
    name TEXT NOT NULL,
    description TEXT,
    
    -- Source storm event (optional — missions can be manual too)
    storm_event_id UUID REFERENCES storm_events_cache(id) ON DELETE SET NULL,
    
    -- Target area
    center_lat DOUBLE PRECISION NOT NULL,
    center_lng DOUBLE PRECISION NOT NULL,
    radius_miles DECIMAL(6, 2) DEFAULT 1.0,
    
    -- Mission stats (denormalized for fast reads)
    total_stops INTEGER DEFAULT 0,
    stops_completed INTEGER DEFAULT 0,
    stops_knocked INTEGER DEFAULT 0,
    stops_not_home INTEGER DEFAULT 0,
    stops_not_interested INTEGER DEFAULT 0,
    appointments_set INTEGER DEFAULT 0,
    inspections_scheduled INTEGER DEFAULT 0,
    leads_created INTEGER DEFAULT 0,
    
    -- Revenue tracking
    estimated_pipeline DECIMAL(14, 2) DEFAULT 0,
    actual_pipeline DECIMAL(14, 2) DEFAULT 0,
    
    -- Route data
    optimized_route JSONB,  -- cached route result from Google Directions
    estimated_duration_minutes INTEGER,
    estimated_distance_miles DECIMAL(8, 2),
    
    -- Status
    status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
    scheduled_date DATE,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Weather conditions during mission
    weather_conditions JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS canvass_missions_user_idx ON canvass_missions(user_id);
CREATE INDEX IF NOT EXISTS canvass_missions_status_idx ON canvass_missions(status);
CREATE INDEX IF NOT EXISTS canvass_missions_date_idx ON canvass_missions(scheduled_date DESC);
CREATE INDEX IF NOT EXISTS canvass_missions_storm_idx ON canvass_missions(storm_event_id);

-- ============================================================================
-- MISSION STOPS TABLE
-- Individual property stops within a canvass mission
-- ============================================================================
CREATE TABLE IF NOT EXISTS mission_stops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id UUID NOT NULL REFERENCES canvass_missions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Stop order within route
    stop_order INTEGER NOT NULL DEFAULT 0,
    
    -- Property info
    address TEXT NOT NULL,
    city TEXT,
    state TEXT,
    zip TEXT,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    
    -- Property intel (cached from CoreLogic at mission creation)
    owner_name TEXT,
    year_built INTEGER,
    square_feet INTEGER,
    roof_age INTEGER,
    estimated_value DECIMAL(12, 2),
    estimated_claim DECIMAL(12, 2),
    property_type TEXT,
    
    -- Outcome tracking
    outcome TEXT DEFAULT 'pending' CHECK (outcome IN (
        'pending',          -- not yet visited
        'knocked',          -- knocked, spoke with homeowner
        'not_home',         -- nobody home
        'not_interested',   -- homeowner declined
        'appointment_set',  -- booked an appointment
        'inspection_set',   -- booked inspection
        'already_filed',    -- already has a claim
        'skipped'           -- skipped for any reason
    )),
    
    -- Outcome data
    outcome_notes TEXT,
    homeowner_name TEXT,
    homeowner_phone TEXT,
    homeowner_email TEXT,
    appointment_date TIMESTAMPTZ,
    
    -- Link to lead if one was created
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    
    -- Timing
    arrived_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mission_stops_mission_idx ON mission_stops(mission_id);
CREATE INDEX IF NOT EXISTS mission_stops_outcome_idx ON mission_stops(outcome);
CREATE INDEX IF NOT EXISTS mission_stops_order_idx ON mission_stops(mission_id, stop_order);

-- ============================================================================
-- STORM ALERT THRESHOLDS TABLE
-- User-configurable alert preferences
-- ============================================================================
CREATE TABLE IF NOT EXISTS storm_alert_thresholds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Hail thresholds
    min_hail_size_inches DECIMAL(4, 2) DEFAULT 1.00,
    
    -- Wind thresholds
    min_wind_speed_mph INTEGER DEFAULT 60,
    
    -- Distance
    max_distance_miles INTEGER DEFAULT 25,
    
    -- Notification preferences
    notify_desktop BOOLEAN DEFAULT TRUE,
    notify_email BOOLEAN DEFAULT FALSE,
    notify_sms BOOLEAN DEFAULT FALSE,
    
    -- Auto-actions
    auto_scan_properties BOOLEAN DEFAULT TRUE,
    auto_estimate_opportunity BOOLEAN DEFAULT TRUE,
    
    -- Active
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id)
);

-- ============================================================================
-- FUNCTION: Get storm timeline for a user
-- Returns storm events with canvass progress stats
-- ============================================================================
CREATE OR REPLACE FUNCTION get_storm_timeline(
    p_user_id UUID,
    p_days_back INTEGER DEFAULT 30,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    event_id UUID,
    event_type TEXT,
    severity TEXT,
    hail_size DECIMAL,
    wind_speed INTEGER,
    damage_score INTEGER,
    location_name TEXT,
    county TEXT,
    state TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    event_occurred_at TIMESTAMPTZ,
    estimated_properties INTEGER,
    estimated_opportunity DECIMAL,
    properties_canvassed INTEGER,
    leads_generated INTEGER,
    appointments_set INTEGER,
    revenue_captured DECIMAL,
    canvass_pct DECIMAL,
    mission_count BIGINT,
    days_ago INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        sec.id as event_id,
        sec.event_type,
        sec.severity,
        sec.hail_size_inches as hail_size,
        sec.wind_speed_mph as wind_speed,
        sec.damage_score,
        sec.location_name,
        sec.county,
        sec.state,
        sec.latitude,
        sec.longitude,
        sec.event_occurred_at,
        sec.estimated_properties,
        sec.estimated_opportunity,
        sec.properties_canvassed,
        sec.leads_generated,
        sec.appointments_set,
        sec.revenue_captured,
        CASE WHEN sec.estimated_properties > 0
            THEN ROUND((sec.properties_canvassed::DECIMAL / sec.estimated_properties) * 100, 1)
            ELSE 0
        END as canvass_pct,
        (SELECT COUNT(*) FROM canvass_missions cm WHERE cm.storm_event_id = sec.id) as mission_count,
        EXTRACT(DAY FROM NOW() - sec.event_occurred_at)::INTEGER as days_ago
    FROM storm_events_cache sec
    WHERE sec.user_id = p_user_id
    AND sec.event_occurred_at >= NOW() - (p_days_back || ' days')::INTERVAL
    ORDER BY sec.event_occurred_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION: Get mission summary stats for a user
-- ============================================================================
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
        COUNT(*) as total_missions,
        COUNT(*) FILTER (WHERE cm.status = 'in_progress') as active_missions,
        COALESCE(SUM(cm.stops_knocked), 0) as total_doors_knocked,
        COALESCE(SUM(cm.stops_not_home), 0) as total_not_home,
        COALESCE(SUM(cm.appointments_set), 0) as total_appointments,
        COALESCE(SUM(cm.leads_created), 0) as total_leads,
        COALESCE(SUM(cm.estimated_pipeline), 0) as total_estimated_pipeline,
        CASE WHEN COUNT(*) > 0
            THEN ROUND(COALESCE(SUM(cm.stops_knocked), 0)::DECIMAL / COUNT(*), 1)
            ELSE 0
        END as avg_doors_per_mission,
        CASE WHEN COUNT(*) > 0
            THEN ROUND(COALESCE(SUM(cm.appointments_set), 0)::DECIMAL / COUNT(*), 1)
            ELSE 0
        END as avg_appointments_per_mission,
        CASE WHEN COALESCE(SUM(cm.stops_knocked), 0) > 0
            THEN ROUND((COALESCE(SUM(cm.appointments_set), 0)::DECIMAL / SUM(cm.stops_knocked)) * 100, 1)
            ELSE 0
        END as appointment_rate
    FROM canvass_missions cm
    WHERE cm.user_id = p_user_id
    AND cm.created_at >= NOW() - (p_days_back || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION: Update mission stats from stops (call after stop outcome changes)
-- ============================================================================
CREATE OR REPLACE FUNCTION update_mission_stats(p_mission_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE canvass_missions SET
        total_stops = (SELECT COUNT(*) FROM mission_stops WHERE mission_id = p_mission_id),
        stops_completed = (SELECT COUNT(*) FROM mission_stops WHERE mission_id = p_mission_id AND outcome != 'pending'),
        stops_knocked = (SELECT COUNT(*) FROM mission_stops WHERE mission_id = p_mission_id AND outcome = 'knocked'),
        stops_not_home = (SELECT COUNT(*) FROM mission_stops WHERE mission_id = p_mission_id AND outcome = 'not_home'),
        stops_not_interested = (SELECT COUNT(*) FROM mission_stops WHERE mission_id = p_mission_id AND outcome = 'not_interested'),
        appointments_set = (SELECT COUNT(*) FROM mission_stops WHERE mission_id = p_mission_id AND outcome IN ('appointment_set', 'inspection_set')),
        inspections_scheduled = (SELECT COUNT(*) FROM mission_stops WHERE mission_id = p_mission_id AND outcome = 'inspection_set'),
        leads_created = (SELECT COUNT(*) FROM mission_stops WHERE mission_id = p_mission_id AND lead_id IS NOT NULL),
        actual_pipeline = (SELECT COALESCE(SUM(estimated_claim), 0) FROM mission_stops WHERE mission_id = p_mission_id AND lead_id IS NOT NULL),
        updated_at = NOW()
    WHERE id = p_mission_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================
ALTER TABLE storm_events_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE canvass_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mission_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE storm_alert_thresholds ENABLE ROW LEVEL SECURITY;

-- Storm events cache: users see their own cached events
CREATE POLICY "Users manage own storm events" ON storm_events_cache
    FOR ALL USING (auth.uid() = user_id);

-- Canvass missions: users see own + team missions
CREATE POLICY "Users view own missions" ON canvass_missions
    FOR SELECT USING (
        user_id = auth.uid() OR
        team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
    );
CREATE POLICY "Users create own missions" ON canvass_missions
    FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own missions" ON canvass_missions
    FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users delete own missions" ON canvass_missions
    FOR DELETE USING (user_id = auth.uid());

-- Mission stops: users manage stops in their missions
CREATE POLICY "Users manage own mission stops" ON mission_stops
    FOR ALL USING (user_id = auth.uid());

-- Alert thresholds: users manage their own
CREATE POLICY "Users manage own alert thresholds" ON storm_alert_thresholds
    FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================
CREATE TRIGGER storm_events_cache_updated_at 
    BEFORE UPDATE ON storm_events_cache 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER canvass_missions_updated_at 
    BEFORE UPDATE ON canvass_missions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER mission_stops_updated_at 
    BEFORE UPDATE ON mission_stops 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER storm_alert_thresholds_updated_at 
    BEFORE UPDATE ON storm_alert_thresholds 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- DONE!
-- ============================================================================
