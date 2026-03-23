-- ============================================================================
-- JOBNIMBUS INTEGRATION SCHEMA
-- Adds fields for JobNimbus API integration
-- ============================================================================

-- Add JobNimbus fields to user_settings
ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS jobnimbus_api_key TEXT,
ADD COLUMN IF NOT EXISTS jobnimbus_connected_at TIMESTAMPTZ;

-- Create lead_exports table to track exports
CREATE TABLE IF NOT EXISTS lead_exports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    destination TEXT NOT NULL DEFAULT 'jobnimbus', -- 'jobnimbus', 'csv', etc.
    jn_contact_id TEXT, -- JobNimbus contact ID after export
    jn_job_id TEXT, -- JobNimbus job ID if created
    exported_at TIMESTAMPTZ DEFAULT NOW(),
    sync_status TEXT DEFAULT 'exported', -- 'exported', 'synced', 'error'
    last_sync_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(lead_id, destination)
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS lead_exports_user_id_idx ON lead_exports(user_id);
CREATE INDEX IF NOT EXISTS lead_exports_lead_id_idx ON lead_exports(lead_id);
CREATE INDEX IF NOT EXISTS lead_exports_jn_contact_idx ON lead_exports(jn_contact_id);

-- Enable RLS
ALTER TABLE lead_exports ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY lead_exports_select ON lead_exports 
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY lead_exports_insert ON lead_exports 
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY lead_exports_update ON lead_exports 
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY lead_exports_delete ON lead_exports 
    FOR DELETE USING (auth.uid() = user_id);

-- Add comment
COMMENT ON TABLE lead_exports IS 'Tracks leads exported to external systems like JobNimbus';
COMMENT ON COLUMN lead_exports.jn_contact_id IS 'JobNimbus contact ID returned after export';
