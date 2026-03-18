-- ============================================================================
-- JOBNIMBUS TEAM-LEVEL INTEGRATION
-- Add team_id to jobnimbus_integrations for shared team CRM connection
-- ============================================================================

-- Add team_id (nullable for backward compatibility)
ALTER TABLE jobnimbus_integrations ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE CASCADE;

-- Unique constraint: one integration per team when team_id is set
CREATE UNIQUE INDEX IF NOT EXISTS idx_jobnimbus_integrations_team ON jobnimbus_integrations(team_id) WHERE team_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_jobnimbus_integrations_team_id ON jobnimbus_integrations(team_id);

-- Update RLS: team members can access team-level integrations
DROP POLICY IF EXISTS "Users can view their own integrations" ON jobnimbus_integrations;
CREATE POLICY "Users can view own or team integrations" ON jobnimbus_integrations FOR SELECT USING (
    user_id = auth.uid()
    OR (team_id IS NOT NULL AND team_id IN (SELECT public.get_user_accessible_team_ids()))
);

DROP POLICY IF EXISTS "Users can insert their own integrations" ON jobnimbus_integrations;
CREATE POLICY "Users can insert own integrations" ON jobnimbus_integrations FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own integrations" ON jobnimbus_integrations;
CREATE POLICY "Users can update own or team integrations" ON jobnimbus_integrations FOR UPDATE USING (
    user_id = auth.uid()
    OR (team_id IS NOT NULL AND team_id IN (SELECT public.get_user_accessible_team_ids()))
);

DROP POLICY IF EXISTS "Users can delete their own integrations" ON jobnimbus_integrations;
CREATE POLICY "Users can delete own integrations" ON jobnimbus_integrations FOR DELETE USING (user_id = auth.uid());
