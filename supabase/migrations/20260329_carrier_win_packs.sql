-- ============================================================================
-- CARRIER WIN PACKS (Phase 2 - Supplement Revenue Engine)
-- Org/template-level "what usually passes / fights" per carrier/region
-- ============================================================================

CREATE TABLE IF NOT EXISTS carrier_win_packs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Ownership (null = global template)
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Scope
    carrier_slug TEXT NOT NULL,  -- 'state-farm', 'allstate', etc.
    region TEXT,                 -- state code or null for nationwide
    
    -- Content
    usually_passes JSONB DEFAULT '[]',  -- [{ line_item, xact_code, notes }]
    usually_fights JSONB DEFAULT '[]',  -- [{ line_item, tactics, success_tip }]
    
    -- Versioning
    version INTEGER DEFAULT 1,
    effective_from DATE DEFAULT CURRENT_DATE,
    effective_to DATE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_carrier_win_packs_carrier ON carrier_win_packs(carrier_slug);
CREATE INDEX IF NOT EXISTS idx_carrier_win_packs_team ON carrier_win_packs(team_id);
CREATE INDEX IF NOT EXISTS idx_carrier_win_packs_user ON carrier_win_packs(user_id);

ALTER TABLE carrier_win_packs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own and team win packs" ON carrier_win_packs;
CREATE POLICY "Users view own and team win packs" ON carrier_win_packs
    FOR SELECT USING (
        user_id = auth.uid() OR
        team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()) OR
        (user_id IS NULL AND team_id IS NULL)
    );

DROP POLICY IF EXISTS "Users manage own win packs" ON carrier_win_packs;
CREATE POLICY "Users manage own win packs" ON carrier_win_packs
    FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins manage team win packs" ON carrier_win_packs;
CREATE POLICY "Admins manage team win packs" ON carrier_win_packs
    FOR ALL USING (
        team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid() AND role IN ('admin', 'owner'))
    );
