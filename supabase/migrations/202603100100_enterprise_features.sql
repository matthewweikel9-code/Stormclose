-- Enterprise Features Migration
-- Adds support for: Live Field Map, Knock Tracker, Team Performance, Xactimate Integration

-- ============================================================================
-- TEAM LOCATIONS (Live Field Map - GPS Tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS team_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    accuracy DOUBLE PRECISION, -- GPS accuracy in meters
    heading DOUBLE PRECISION, -- Direction of travel (0-360)
    speed DOUBLE PRECISION, -- Speed in m/s
    battery_level INTEGER, -- Battery percentage (0-100)
    is_active BOOLEAN DEFAULT true, -- Currently tracking
    last_activity TEXT, -- 'knocking', 'driving', 'idle'
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast team lookups
CREATE INDEX IF NOT EXISTS idx_team_locations_team ON team_locations(team_id);
CREATE INDEX IF NOT EXISTS idx_team_locations_user ON team_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_team_locations_active ON team_locations(is_active) WHERE is_active = true;

-- ============================================================================
-- DOOR KNOCKS ENHANCEMENT (Knock Tracker Heatmap)
-- ============================================================================
-- Add columns to existing door_knocks table if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'door_knocks' AND column_name = 'weather_conditions') THEN
        ALTER TABLE door_knocks ADD COLUMN weather_conditions JSONB;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'door_knocks' AND column_name = 'duration_seconds') THEN
        ALTER TABLE door_knocks ADD COLUMN duration_seconds INTEGER;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'door_knocks' AND column_name = 'synced_to_jobnimbus') THEN
        ALTER TABLE door_knocks ADD COLUMN synced_to_jobnimbus BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'door_knocks' AND column_name = 'jobnimbus_contact_id') THEN
        ALTER TABLE door_knocks ADD COLUMN jobnimbus_contact_id TEXT;
    END IF;
END $$;

-- Spatial index for heatmap queries
CREATE INDEX IF NOT EXISTS idx_door_knocks_location 
ON door_knocks(latitude, longitude) 
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- ============================================================================
-- TEAM PERFORMANCE METRICS
-- ============================================================================
CREATE TABLE IF NOT EXISTS team_performance_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Activity Metrics
    doors_knocked INTEGER DEFAULT 0,
    contacts_made INTEGER DEFAULT 0,
    appointments_set INTEGER DEFAULT 0,
    inspections_completed INTEGER DEFAULT 0,
    deals_closed INTEGER DEFAULT 0,
    
    -- Outcome Metrics
    not_home_count INTEGER DEFAULT 0,
    not_interested_count INTEGER DEFAULT 0,
    callback_count INTEGER DEFAULT 0,
    
    -- Financial Metrics
    pipeline_value NUMERIC(12,2) DEFAULT 0,
    closed_value NUMERIC(12,2) DEFAULT 0,
    
    -- Efficiency Metrics
    avg_time_per_door_seconds INTEGER,
    total_drive_time_minutes INTEGER,
    total_knock_time_minutes INTEGER,
    miles_driven NUMERIC(8,2),
    
    -- Time Tracking
    first_knock_at TIMESTAMPTZ,
    last_knock_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_team_performance_daily_team ON team_performance_daily(team_id, date);
CREATE INDEX IF NOT EXISTS idx_team_performance_daily_user ON team_performance_daily(user_id, date);

-- ============================================================================
-- XACTIMATE ESTIMATES
-- ============================================================================
CREATE TABLE IF NOT EXISTS xactimate_estimates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    
    -- Estimate Info
    claim_number TEXT,
    property_address TEXT NOT NULL,
    insurance_carrier TEXT,
    adjuster_name TEXT,
    adjuster_email TEXT,
    adjuster_phone TEXT,
    
    -- File Info
    file_url TEXT,
    file_name TEXT,
    file_type TEXT, -- 'esx', 'pdf', 'xml'
    
    -- Parsed Data
    original_rcv NUMERIC(12,2),
    original_acv NUMERIC(12,2),
    depreciation NUMERIC(12,2),
    deductible NUMERIC(12,2),
    
    -- Line Items (parsed from Xactimate)
    line_items JSONB DEFAULT '[]',
    
    -- AI Analysis
    ai_analysis JSONB, -- Missing items, suggested supplements
    missing_items JSONB DEFAULT '[]',
    suggested_supplement_amount NUMERIC(12,2),
    
    -- Status
    status TEXT DEFAULT 'uploaded', -- 'uploaded', 'analyzing', 'analyzed', 'supplemented'
    supplement_status TEXT, -- 'pending', 'submitted', 'approved', 'denied'
    
    -- Supplement Details
    supplement_amount NUMERIC(12,2),
    supplement_file_url TEXT,
    supplement_submitted_at TIMESTAMPTZ,
    supplement_approved_at TIMESTAMPTZ,
    final_approved_amount NUMERIC(12,2),
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_xactimate_estimates_user ON xactimate_estimates(user_id);
CREATE INDEX IF NOT EXISTS idx_xactimate_estimates_lead ON xactimate_estimates(lead_id);
CREATE INDEX IF NOT EXISTS idx_xactimate_estimates_status ON xactimate_estimates(status);

-- ============================================================================
-- JOBNIMBUS SYNC LOG
-- ============================================================================
CREATE TABLE IF NOT EXISTS jobnimbus_sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Sync Details
    sync_type TEXT NOT NULL, -- 'lead_export', 'contact_import', 'activity_sync', 'webhook'
    direction TEXT NOT NULL, -- 'outbound', 'inbound'
    
    -- Entity Info
    local_entity_type TEXT, -- 'lead', 'door_knock', 'activity'
    local_entity_id UUID,
    jobnimbus_entity_type TEXT, -- 'contact', 'job', 'activity', 'task'
    jobnimbus_entity_id TEXT,
    
    -- Status
    status TEXT DEFAULT 'pending', -- 'pending', 'success', 'failed'
    error_message TEXT,
    
    -- Payload (for debugging)
    request_payload JSONB,
    response_payload JSONB,
    
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jobnimbus_sync_log_user ON jobnimbus_sync_log(user_id);
CREATE INDEX IF NOT EXISTS idx_jobnimbus_sync_log_entity ON jobnimbus_sync_log(local_entity_type, local_entity_id);

-- ============================================================================
-- WEATHER CACHE (for Weather-Aware Routing)
-- ============================================================================
CREATE TABLE IF NOT EXISTS weather_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    
    -- Current Weather
    temperature_f NUMERIC(5,2),
    feels_like_f NUMERIC(5,2),
    humidity INTEGER,
    wind_speed_mph NUMERIC(5,2),
    wind_direction TEXT,
    conditions TEXT, -- 'clear', 'cloudy', 'rain', 'snow', etc.
    conditions_icon TEXT,
    
    -- Precipitation
    precipitation_chance INTEGER, -- 0-100
    precipitation_type TEXT, -- 'rain', 'snow', 'sleet', 'hail'
    
    -- Hourly Forecast (next 12 hours)
    hourly_forecast JSONB DEFAULT '[]',
    
    -- Alerts
    active_alerts JSONB DEFAULT '[]',
    
    -- Cache Info
    fetched_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ DEFAULT (now() + interval '30 minutes')
);

-- Spatial index for weather lookups
CREATE INDEX IF NOT EXISTS idx_weather_cache_location ON weather_cache(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_weather_cache_expires ON weather_cache(expires_at);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Team Locations RLS
ALTER TABLE team_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their team members' locations" ON team_locations;
CREATE POLICY "Users can view their team members' locations"
ON team_locations FOR SELECT
USING (
    user_id = auth.uid() 
    OR team_id IN (
        SELECT team_id FROM team_members WHERE user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Users can insert their own location" ON team_locations;
CREATE POLICY "Users can insert their own location"
ON team_locations FOR INSERT
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own location" ON team_locations;
CREATE POLICY "Users can update their own location"
ON team_locations FOR UPDATE
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own location" ON team_locations;
CREATE POLICY "Users can delete their own location"
ON team_locations FOR DELETE
USING (user_id = auth.uid());

-- Team Performance RLS
ALTER TABLE team_performance_daily ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own performance" ON team_performance_daily;
CREATE POLICY "Users can view their own performance"
ON team_performance_daily FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Team managers can view team performance" ON team_performance_daily;
CREATE POLICY "Team managers can view team performance"
ON team_performance_daily FOR SELECT
USING (
    team_id IN (
        SELECT id FROM teams WHERE owner_id = auth.uid()
    )
    OR team_id IN (
        SELECT team_id FROM team_members WHERE user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Users can insert their own performance" ON team_performance_daily;
CREATE POLICY "Users can insert their own performance"
ON team_performance_daily FOR INSERT
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own performance" ON team_performance_daily;
CREATE POLICY "Users can update their own performance"
ON team_performance_daily FOR UPDATE
USING (user_id = auth.uid());

-- Xactimate Estimates RLS
ALTER TABLE xactimate_estimates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own estimates" ON xactimate_estimates;
CREATE POLICY "Users can view their own estimates"
ON xactimate_estimates FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own estimates" ON xactimate_estimates;
CREATE POLICY "Users can insert their own estimates"
ON xactimate_estimates FOR INSERT
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own estimates" ON xactimate_estimates;
CREATE POLICY "Users can update their own estimates"
ON xactimate_estimates FOR UPDATE
USING (user_id = auth.uid());

-- JobNimbus Sync Log RLS
ALTER TABLE jobnimbus_sync_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own sync logs" ON jobnimbus_sync_log;
CREATE POLICY "Users can view their own sync logs"
ON jobnimbus_sync_log FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own sync logs" ON jobnimbus_sync_log;
CREATE POLICY "Users can insert their own sync logs"
ON jobnimbus_sync_log FOR INSERT
WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to update team performance metrics
CREATE OR REPLACE FUNCTION update_team_performance()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO team_performance_daily (user_id, team_id, date, doors_knocked)
    VALUES (NEW.user_id, NEW.team_id, CURRENT_DATE, 1)
    ON CONFLICT (user_id, date)
    DO UPDATE SET
        doors_knocked = team_performance_daily.doors_knocked + 1,
        contacts_made = CASE 
            WHEN NEW.outcome IN ('interested', 'appointment_set', 'not_interested') 
            THEN team_performance_daily.contacts_made + 1 
            ELSE team_performance_daily.contacts_made 
        END,
        appointments_set = CASE 
            WHEN NEW.outcome = 'appointment_set' 
            THEN team_performance_daily.appointments_set + 1 
            ELSE team_performance_daily.appointments_set 
        END,
        not_home_count = CASE 
            WHEN NEW.outcome = 'not_home' 
            THEN team_performance_daily.not_home_count + 1 
            ELSE team_performance_daily.not_home_count 
        END,
        not_interested_count = CASE 
            WHEN NEW.outcome = 'not_interested' 
            THEN team_performance_daily.not_interested_count + 1 
            ELSE team_performance_daily.not_interested_count 
        END,
        callback_count = CASE 
            WHEN NEW.outcome = 'callback' 
            THEN team_performance_daily.callback_count + 1 
            ELSE team_performance_daily.callback_count 
        END,
        last_knock_at = NEW.knocked_at,
        first_knock_at = COALESCE(team_performance_daily.first_knock_at, NEW.knocked_at),
        updated_at = now();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update performance on door knock
DROP TRIGGER IF EXISTS update_performance_on_knock ON door_knocks;
CREATE TRIGGER update_performance_on_knock
    AFTER INSERT ON door_knocks
    FOR EACH ROW
    EXECUTE FUNCTION update_team_performance();
