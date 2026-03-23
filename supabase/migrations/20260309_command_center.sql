-- ============================================================================
-- STORMCLOSE COMMAND CENTER - DATABASE SCHEMA
-- ============================================================================

-- Enable PostGIS for geospatial queries (if not already enabled)
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================================
-- TEAMS TABLE
-- Company accounts that subscribe to StormClose
-- ============================================================================
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    stripe_customer_id TEXT,
    subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'pro_plus', 'enterprise')),
    subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'canceled', 'past_due', 'trialing')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TEAM MEMBERS TABLE
-- Employees belonging to a team
-- ============================================================================
CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'manager', 'member')),
    invited_email TEXT,
    invited_at TIMESTAMPTZ,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(team_id, user_id)
);

-- ============================================================================
-- LEADS TABLE
-- Properties tracked by users through the sales pipeline
-- ============================================================================
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Property Information (from CoreLogic)
    address TEXT NOT NULL,
    city TEXT,
    state TEXT,
    zip TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    
    -- Property Details
    year_built INTEGER,
    square_feet INTEGER,
    assessed_value DECIMAL(12, 2),
    roof_squares DECIMAL(6, 2),
    roof_age INTEGER, -- calculated from year_built or entered manually
    
    -- Lead Scoring
    lead_score INTEGER DEFAULT 0 CHECK (lead_score >= 0 AND lead_score <= 100),
    storm_proximity_score INTEGER DEFAULT 0,
    roof_age_score INTEGER DEFAULT 0,
    roof_size_score INTEGER DEFAULT 0,
    property_value_score INTEGER DEFAULT 0,
    hail_history_score INTEGER DEFAULT 0,
    
    -- Pipeline Status
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'appointment_set', 'inspected', 'signed', 'closed', 'lost')),
    status_changed_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Estimated Values
    estimated_claim DECIMAL(12, 2),
    actual_claim DECIMAL(12, 2),
    
    -- Metadata
    source TEXT DEFAULT 'lead_generator', -- lead_generator, manual, import
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for geospatial queries
CREATE INDEX IF NOT EXISTS leads_location_idx ON leads USING GIST (
    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
);
CREATE INDEX IF NOT EXISTS leads_user_id_idx ON leads(user_id);
CREATE INDEX IF NOT EXISTS leads_team_id_idx ON leads(team_id);
CREATE INDEX IF NOT EXISTS leads_status_idx ON leads(status);
CREATE INDEX IF NOT EXISTS leads_score_idx ON leads(lead_score DESC);

-- ============================================================================
-- ACTIVITIES TABLE
-- Track all sales activities (door knocks, calls, appointments, etc.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    
    -- Activity Details
    activity_type TEXT NOT NULL CHECK (activity_type IN (
        'door_knock', 'phone_call', 'email', 'text_message',
        'appointment_set', 'appointment_completed', 'inspection',
        'estimate_sent', 'contract_signed', 'job_completed',
        'follow_up', 'note', 'status_change'
    )),
    
    -- Activity Data
    title TEXT,
    description TEXT,
    outcome TEXT, -- not_home, interested, not_interested, appointment, etc.
    
    -- For appointments
    scheduled_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Location (for door knocks)
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS activities_user_id_idx ON activities(user_id);
CREATE INDEX IF NOT EXISTS activities_team_id_idx ON activities(team_id);
CREATE INDEX IF NOT EXISTS activities_lead_id_idx ON activities(lead_id);
CREATE INDEX IF NOT EXISTS activities_type_idx ON activities(activity_type);
CREATE INDEX IF NOT EXISTS activities_created_at_idx ON activities(created_at DESC);

-- ============================================================================
-- HAIL EVENTS TABLE
-- NOAA storm data for lead scoring and alerts
-- ============================================================================
CREATE TABLE IF NOT EXISTS hail_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Event Details
    event_date DATE NOT NULL,
    event_time TIME,
    timezone INTEGER DEFAULT 3, -- CST
    
    -- Location
    state TEXT NOT NULL,
    county TEXT,
    location_name TEXT,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    
    -- Hail Data
    size_inches DECIMAL(4, 2) NOT NULL, -- Hail size in inches (1.00 = quarter, 1.75 = golf ball, etc.)
    
    -- Metadata
    comments TEXT,
    source TEXT DEFAULT 'noaa',
    noaa_event_id TEXT, -- Original NOAA identifier if available
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Prevent duplicates
    UNIQUE(event_date, event_time, latitude, longitude, size_inches)
);

-- Create spatial index for proximity queries
CREATE INDEX IF NOT EXISTS hail_events_location_idx ON hail_events USING GIST (
    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
);
CREATE INDEX IF NOT EXISTS hail_events_date_idx ON hail_events(event_date DESC);
CREATE INDEX IF NOT EXISTS hail_events_state_idx ON hail_events(state);
CREATE INDEX IF NOT EXISTS hail_events_size_idx ON hail_events(size_inches DESC);

-- ============================================================================
-- ROUTES TABLE
-- Saved routes for users
-- ============================================================================
CREATE TABLE IF NOT EXISTS routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    name TEXT DEFAULT 'My Route',
    scheduled_date DATE,
    
    -- Route data stored as JSONB array of stops
    stops JSONB NOT NULL DEFAULT '[]',
    
    -- Route stats
    total_stops INTEGER DEFAULT 0,
    estimated_duration_minutes INTEGER,
    estimated_distance_miles DECIMAL(8, 2),
    
    -- Status
    status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed')),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS routes_user_id_idx ON routes(user_id);
CREATE INDEX IF NOT EXISTS routes_date_idx ON routes(scheduled_date);

-- ============================================================================
-- USER SETTINGS TABLE
-- Store user preferences and default location
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    
    -- Default location for searches and alerts
    default_latitude DOUBLE PRECISION,
    default_longitude DOUBLE PRECISION,
    default_city TEXT,
    default_state TEXT,
    default_radius_miles INTEGER DEFAULT 25,
    
    -- Notification preferences
    email_storm_alerts BOOLEAN DEFAULT TRUE,
    email_daily_digest BOOLEAN DEFAULT TRUE,
    
    -- UI preferences
    dashboard_layout JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE hail_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Teams: Users can see teams they own or are members of
DROP POLICY IF EXISTS teams_select ON teams;
CREATE POLICY teams_select ON teams FOR SELECT USING (
    owner_id = auth.uid() OR 
    id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
);
DROP POLICY IF EXISTS teams_insert ON teams;
CREATE POLICY teams_insert ON teams FOR INSERT WITH CHECK (owner_id = auth.uid());
DROP POLICY IF EXISTS teams_update ON teams;
CREATE POLICY teams_update ON teams FOR UPDATE USING (owner_id = auth.uid());
DROP POLICY IF EXISTS teams_delete ON teams;
CREATE POLICY teams_delete ON teams FOR DELETE USING (owner_id = auth.uid());

-- Team Members: Team owners/admins can manage, members can view
DROP POLICY IF EXISTS team_members_select ON team_members;
CREATE POLICY team_members_select ON team_members FOR SELECT USING (
    team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid()) OR
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
);
DROP POLICY IF EXISTS team_members_insert ON team_members;
CREATE POLICY team_members_insert ON team_members FOR INSERT WITH CHECK (
    team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid()) OR
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
);
DROP POLICY IF EXISTS team_members_update ON team_members;
CREATE POLICY team_members_update ON team_members FOR UPDATE USING (
    team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid()) OR
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
);
DROP POLICY IF EXISTS team_members_delete ON team_members;
CREATE POLICY team_members_delete ON team_members FOR DELETE USING (
    team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid()) OR
    user_id = auth.uid() -- Can remove self
);

-- Leads: Users can see their own leads or team leads
DROP POLICY IF EXISTS leads_select ON leads;
CREATE POLICY leads_select ON leads FOR SELECT USING (
    user_id = auth.uid() OR
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
);
DROP POLICY IF EXISTS leads_insert ON leads;
CREATE POLICY leads_insert ON leads FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS leads_update ON leads;
CREATE POLICY leads_update ON leads FOR UPDATE USING (
    user_id = auth.uid() OR
    assigned_to = auth.uid() OR
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager'))
);
DROP POLICY IF EXISTS leads_delete ON leads;
CREATE POLICY leads_delete ON leads FOR DELETE USING (
    user_id = auth.uid() OR
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
);

-- Activities: Users can see their own activities or team activities
DROP POLICY IF EXISTS activities_select ON activities;
CREATE POLICY activities_select ON activities FOR SELECT USING (
    user_id = auth.uid() OR
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
);
DROP POLICY IF EXISTS activities_insert ON activities;
CREATE POLICY activities_insert ON activities FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS activities_update ON activities;
CREATE POLICY activities_update ON activities FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS activities_delete ON activities;
CREATE POLICY activities_delete ON activities FOR DELETE USING (user_id = auth.uid());

-- Hail Events: Everyone can read (public data)
DROP POLICY IF EXISTS hail_events_select ON hail_events;
CREATE POLICY hail_events_select ON hail_events FOR SELECT USING (true);
-- Only service role can insert/update (for sync jobs)
DROP POLICY IF EXISTS hail_events_insert ON hail_events;
CREATE POLICY hail_events_insert ON hail_events FOR INSERT WITH CHECK (false);
DROP POLICY IF EXISTS hail_events_update ON hail_events;
CREATE POLICY hail_events_update ON hail_events FOR UPDATE USING (false);

-- Routes: Users can see their own routes
DROP POLICY IF EXISTS routes_select ON routes;
CREATE POLICY routes_select ON routes FOR SELECT USING (
    user_id = auth.uid() OR
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
);
DROP POLICY IF EXISTS routes_insert ON routes;
CREATE POLICY routes_insert ON routes FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS routes_update ON routes;
CREATE POLICY routes_update ON routes FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS routes_delete ON routes;
CREATE POLICY routes_delete ON routes FOR DELETE USING (user_id = auth.uid());

-- User Settings: Users can only see/edit their own settings
DROP POLICY IF EXISTS user_settings_select ON user_settings;
CREATE POLICY user_settings_select ON user_settings FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS user_settings_insert ON user_settings;
CREATE POLICY user_settings_insert ON user_settings FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS user_settings_update ON user_settings;
CREATE POLICY user_settings_update ON user_settings FOR UPDATE USING (user_id = auth.uid());

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to calculate distance between two points in miles
CREATE OR REPLACE FUNCTION distance_miles(lat1 DOUBLE PRECISION, lon1 DOUBLE PRECISION, lat2 DOUBLE PRECISION, lon2 DOUBLE PRECISION)
RETURNS DOUBLE PRECISION AS $$
BEGIN
    RETURN ST_DistanceSphere(
        ST_SetSRID(ST_MakePoint(lon1, lat1), 4326),
        ST_SetSRID(ST_MakePoint(lon2, lat2), 4326)
    ) / 1609.34; -- Convert meters to miles
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to find hail events near a location
CREATE OR REPLACE FUNCTION find_nearby_hail_events(
    p_latitude DOUBLE PRECISION,
    p_longitude DOUBLE PRECISION,
    p_radius_miles DOUBLE PRECISION DEFAULT 10,
    p_days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
    id UUID,
    event_date DATE,
    event_time TIME,
    state TEXT,
    county TEXT,
    location_name TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    size_inches DECIMAL(4, 2),
    distance_miles DOUBLE PRECISION,
    days_ago INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        h.id,
        h.event_date,
        h.event_time,
        h.state,
        h.county,
        h.location_name,
        h.latitude,
        h.longitude,
        h.size_inches,
        distance_miles(p_latitude, p_longitude, h.latitude, h.longitude) AS distance_miles,
        (CURRENT_DATE - h.event_date)::INTEGER AS days_ago
    FROM hail_events h
    WHERE h.event_date >= CURRENT_DATE - p_days_back
    AND distance_miles(p_latitude, p_longitude, h.latitude, h.longitude) <= p_radius_miles
    ORDER BY h.event_date DESC, distance_miles(p_latitude, p_longitude, h.latitude, h.longitude);
END;
$$ LANGUAGE plpgsql;

-- Function to count historical hail events in an area
CREATE OR REPLACE FUNCTION count_hail_history(
    p_latitude DOUBLE PRECISION,
    p_longitude DOUBLE PRECISION,
    p_radius_miles DOUBLE PRECISION DEFAULT 5,
    p_years_back INTEGER DEFAULT 5
)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)::INTEGER
        FROM hail_events h
        WHERE h.event_date >= CURRENT_DATE - (p_years_back * 365)
        AND distance_miles(p_latitude, p_longitude, h.latitude, h.longitude) <= p_radius_miles
    );
END;
$$ LANGUAGE plpgsql;

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS teams_updated_at ON teams;
CREATE TRIGGER teams_updated_at BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS leads_updated_at ON leads;
CREATE TRIGGER leads_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS routes_updated_at ON routes;
CREATE TRIGGER routes_updated_at BEFORE UPDATE ON routes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS user_settings_updated_at ON user_settings;
CREATE TRIGGER user_settings_updated_at BEFORE UPDATE ON user_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- DONE!
-- ============================================================================
