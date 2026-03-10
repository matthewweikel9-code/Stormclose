-- ============================================================================
-- STORMCLOSE UPGRADE: Real-Time Storm Alerts + AI Sales Copilot
-- ============================================================================

-- ============================================================================
-- TERRITORIES TABLE
-- Sales territories defined by users (zip codes or polygons)
-- ============================================================================
CREATE TABLE IF NOT EXISTS territories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Territory Definition
    name TEXT NOT NULL,
    type TEXT DEFAULT 'zip_codes' CHECK (type IN ('zip_codes', 'polygon', 'radius')),
    
    -- For zip_codes type
    zip_codes TEXT[], -- Array of zip codes
    
    -- For polygon type (GeoJSON)
    polygon GEOMETRY(POLYGON, 4326),
    
    -- For radius type
    center_lat DOUBLE PRECISION,
    center_lng DOUBLE PRECISION,
    radius_miles DECIMAL(6, 2),
    
    -- Settings
    is_active BOOLEAN DEFAULT true,
    alert_enabled BOOLEAN DEFAULT true,
    email_alerts BOOLEAN DEFAULT true,
    push_alerts BOOLEAN DEFAULT true,
    sms_alerts BOOLEAN DEFAULT false,
    
    -- Stats
    total_leads INTEGER DEFAULT 0,
    active_storms INTEGER DEFAULT 0,
    last_storm_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_territories_user ON territories(user_id);
CREATE INDEX IF NOT EXISTS idx_territories_team ON territories(team_id);
CREATE INDEX IF NOT EXISTS idx_territories_polygon ON territories USING GIST(polygon);

-- ============================================================================
-- STORM ALERTS TABLE
-- Active and historical storm alerts
-- ============================================================================
CREATE TABLE IF NOT EXISTS storm_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Storm Information
    nws_event_id TEXT UNIQUE, -- NWS event identifier
    alert_type TEXT NOT NULL CHECK (alert_type IN (
        'tornado_warning', 'tornado_watch',
        'severe_thunderstorm_warning', 'severe_thunderstorm_watch',
        'hail_report', 'wind_report',
        'flash_flood_warning', 'winter_storm_warning'
    )),
    severity TEXT CHECK (severity IN ('extreme', 'severe', 'moderate', 'minor', 'unknown')),
    
    -- Location
    headline TEXT,
    description TEXT,
    affected_areas TEXT[], -- Array of county/zone names
    affected_zips TEXT[], -- Array of zip codes
    polygon GEOMETRY(POLYGON, 4326), -- Alert polygon
    
    -- Timing
    onset_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    issued_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Hail-specific data
    hail_size_inches DECIMAL(4, 2),
    wind_speed_mph INTEGER,
    
    -- Status
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
    
    -- Lead generation stats
    leads_generated INTEGER DEFAULT 0,
    properties_affected INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_storm_alerts_status ON storm_alerts(status);
CREATE INDEX IF NOT EXISTS idx_storm_alerts_type ON storm_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_storm_alerts_expires ON storm_alerts(expires_at);
CREATE INDEX IF NOT EXISTS idx_storm_alerts_polygon ON storm_alerts USING GIST(polygon);
CREATE INDEX IF NOT EXISTS idx_storm_alerts_zips ON storm_alerts USING GIN(affected_zips);

-- ============================================================================
-- USER ALERT NOTIFICATIONS
-- Track which alerts have been sent to which users
-- ============================================================================
CREATE TABLE IF NOT EXISTS alert_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    alert_id UUID NOT NULL REFERENCES storm_alerts(id) ON DELETE CASCADE,
    territory_id UUID REFERENCES territories(id) ON DELETE SET NULL,
    
    -- Notification details
    channel TEXT NOT NULL CHECK (channel IN ('push', 'email', 'sms', 'in_app')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'clicked')),
    
    -- Tracking
    sent_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    leads_claimed INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, alert_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_alert_notifications_user ON alert_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_notifications_alert ON alert_notifications(alert_id);

-- ============================================================================
-- AI PROPERTY BRIEFINGS
-- Cached AI-generated briefings for leads
-- ============================================================================
CREATE TABLE IF NOT EXISTS property_briefings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    
    -- Briefing Content (AI-generated)
    summary TEXT, -- Quick one-liner
    talking_points JSONB, -- Array of key points
    objection_handlers JSONB, -- Common objections + responses
    neighborhood_context TEXT, -- Info about the area
    competitor_intel TEXT, -- Known competitor activity
    
    -- Scoring explanation
    score_breakdown JSONB, -- Why this lead scored the way it did
    
    -- Homeowner research
    homeowner_name TEXT,
    homeowner_notes TEXT,
    
    -- Generated metadata
    model_used TEXT DEFAULT 'gpt-4o',
    tokens_used INTEGER,
    
    -- Freshness
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
    
    UNIQUE(lead_id)
);

CREATE INDEX IF NOT EXISTS idx_property_briefings_lead ON property_briefings(lead_id);
CREATE INDEX IF NOT EXISTS idx_property_briefings_expires ON property_briefings(expires_at);

-- ============================================================================
-- VOICE NOTES
-- Voice recordings with AI transcription
-- ============================================================================
CREATE TABLE IF NOT EXISTS voice_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    activity_id UUID REFERENCES activities(id) ON DELETE SET NULL,
    
    -- Audio file
    audio_url TEXT NOT NULL,
    duration_seconds INTEGER,
    
    -- Transcription
    transcription TEXT,
    transcription_status TEXT DEFAULT 'pending' CHECK (transcription_status IN ('pending', 'processing', 'completed', 'failed')),
    
    -- AI Analysis
    summary TEXT,
    action_items JSONB, -- Extracted action items
    sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
    
    -- Lead updates suggested by AI
    suggested_status TEXT,
    suggested_notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voice_notes_user ON voice_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_notes_lead ON voice_notes(lead_id);

-- ============================================================================
-- PUSH NOTIFICATION SUBSCRIPTIONS
-- Web Push subscriptions for real-time alerts
-- ============================================================================
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Push subscription data (Web Push API)
    endpoint TEXT NOT NULL,
    p256dh_key TEXT NOT NULL,
    auth_key TEXT NOT NULL,
    
    -- Device info
    user_agent TEXT,
    device_type TEXT CHECK (device_type IN ('desktop', 'mobile', 'tablet')),
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMPTZ DEFAULT NOW(),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);

-- ============================================================================
-- ADD COLUMNS TO EXISTING TABLES
-- ============================================================================

-- Add territory reference to leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS territory_id UUID REFERENCES territories(id);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS storm_alert_id UUID REFERENCES storm_alerts(id);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS claimed_by UUID REFERENCES auth.users(id);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

-- Add AI copilot columns to leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_briefing_generated BOOLEAN DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_ai_briefing_at TIMESTAMPTZ;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_leads_territory ON leads(territory_id);
CREATE INDEX IF NOT EXISTS idx_leads_storm_alert ON leads(storm_alert_id);
CREATE INDEX IF NOT EXISTS idx_leads_claimed_by ON leads(claimed_by);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Territories RLS
ALTER TABLE territories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own territories"
ON territories FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own territories"
ON territories FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own territories"
ON territories FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can delete own territories"
ON territories FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Storm Alerts RLS (everyone can read active alerts)
ALTER TABLE storm_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view active alerts"
ON storm_alerts FOR SELECT
TO authenticated
USING (status = 'active' OR expires_at > NOW() - INTERVAL '24 hours');

CREATE POLICY "Service role can manage alerts"
ON storm_alerts FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Property Briefings RLS
ALTER TABLE property_briefings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view briefings for their leads"
ON property_briefings FOR SELECT
TO authenticated
USING (
    lead_id IN (
        SELECT id FROM leads WHERE user_id = auth.uid() OR assigned_to = auth.uid()
    )
);

CREATE POLICY "Service role can manage briefings"
ON property_briefings FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Voice Notes RLS
ALTER TABLE voice_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own voice notes"
ON voice_notes FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Push Subscriptions RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own push subscriptions"
ON push_subscriptions FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Alert Notifications RLS
ALTER TABLE alert_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
ON alert_notifications FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Service role can manage notifications"
ON alert_notifications FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to check if a point is in a user's territory
CREATE OR REPLACE FUNCTION is_in_territory(
    p_user_id UUID,
    p_lat DOUBLE PRECISION,
    p_lng DOUBLE PRECISION,
    p_zip TEXT DEFAULT NULL
)
RETURNS TABLE(territory_id UUID, territory_name TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT t.id, t.name
    FROM territories t
    WHERE t.user_id = p_user_id
      AND t.is_active = true
      AND (
          -- Check zip codes
          (t.type = 'zip_codes' AND p_zip = ANY(t.zip_codes))
          -- Check polygon
          OR (t.type = 'polygon' AND ST_Contains(t.polygon, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)))
          -- Check radius
          OR (t.type = 'radius' AND ST_DWithin(
              ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
              ST_SetSRID(ST_MakePoint(t.center_lng, t.center_lat), 4326)::geography,
              t.radius_miles * 1609.34 -- Convert miles to meters
          ))
      );
END;
$$ LANGUAGE plpgsql;

-- Function to find users with territories affected by a storm
CREATE OR REPLACE FUNCTION get_users_for_storm_alert(
    p_alert_id UUID
)
RETURNS TABLE(user_id UUID, territory_id UUID, territory_name TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT t.user_id, t.id, t.name
    FROM territories t
    JOIN storm_alerts sa ON sa.id = p_alert_id
    WHERE t.is_active = true
      AND t.alert_enabled = true
      AND (
          -- Check if any territory zips match alert zips
          (t.type = 'zip_codes' AND t.zip_codes && sa.affected_zips)
          -- Check if territory polygon intersects alert polygon
          OR (t.type = 'polygon' AND sa.polygon IS NOT NULL AND ST_Intersects(t.polygon, sa.polygon))
          -- Check if territory center is within alert polygon
          OR (t.type = 'radius' AND sa.polygon IS NOT NULL AND ST_Contains(
              sa.polygon,
              ST_SetSRID(ST_MakePoint(t.center_lng, t.center_lat), 4326)
          ))
      );
END;
$$ LANGUAGE plpgsql;
