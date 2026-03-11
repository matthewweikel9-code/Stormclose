-- Create door_knocks table for the Knock Tracker feature
CREATE TABLE IF NOT EXISTS door_knocks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    property_address TEXT NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    outcome TEXT NOT NULL CHECK (outcome IN (
        'appointment_set', 'interested', 'callback', 
        'not_interested', 'not_home', 'no_answer',
        'appointment', 'come_back'
    )),
    notes TEXT,
    owner_name TEXT,
    duration_seconds INTEGER,
    weather_conditions JSONB,
    synced_to_jobnimbus BOOLEAN DEFAULT false,
    jobnimbus_contact_id TEXT,
    knocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_door_knocks_user_id ON door_knocks(user_id);
CREATE INDEX IF NOT EXISTS idx_door_knocks_knocked_at ON door_knocks(knocked_at DESC);
CREATE INDEX IF NOT EXISTS idx_door_knocks_outcome ON door_knocks(outcome);
CREATE INDEX IF NOT EXISTS idx_door_knocks_location ON door_knocks(latitude, longitude) WHERE latitude IS NOT NULL;

-- RLS policies
ALTER TABLE door_knocks ENABLE ROW LEVEL SECURITY;

-- Users can read their own knocks
CREATE POLICY "Users can view own door knocks" ON door_knocks
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own knocks
CREATE POLICY "Users can insert own door knocks" ON door_knocks
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own knocks
CREATE POLICY "Users can update own door knocks" ON door_knocks
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own knocks
CREATE POLICY "Users can delete own door knocks" ON door_knocks
    FOR DELETE USING (auth.uid() = user_id);
