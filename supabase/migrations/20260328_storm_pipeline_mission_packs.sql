-- ============================================================================
-- STORM PIPELINE & MISSION PACKS (Phase 1 - Enterprise Roadmap)
-- Orchestrated storm-to-rep workflow: alert → re-score → briefing → mission pack
-- ============================================================================

-- ============================================================================
-- STORM PIPELINE RUNS
-- Tracks each pipeline execution for debugging and audit
-- ============================================================================
CREATE TABLE IF NOT EXISTS storm_pipeline_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Trigger
    trigger_type TEXT NOT NULL CHECK (trigger_type IN ('storm_alert', 'territory_update', 'manual')),
    trigger_id TEXT, -- storm_alert.id, territory.id, or null for manual
    
    -- Scope
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Location context
    center_lat DOUBLE PRECISION,
    center_lng DOUBLE PRECISION,
    radius_miles DECIMAL(6, 2),
    
    -- Results
    leads_rescored INTEGER DEFAULT 0,
    briefing_text TEXT,
    mission_pack_id UUID, -- set after mission pack created
    
    -- Status
    status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'partial')),
    error_message TEXT,
    
    -- Idempotency (optional - for cron dedup)
    idempotency_key TEXT UNIQUE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_storm_pipeline_runs_user ON storm_pipeline_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_storm_pipeline_runs_team ON storm_pipeline_runs(team_id);
CREATE INDEX IF NOT EXISTS idx_storm_pipeline_runs_created ON storm_pipeline_runs(created_at DESC);

-- ============================================================================
-- MISSION PACKS
-- Ready-to-use briefing for reps: talk tracks, carrier notes, territory summary
-- ============================================================================
CREATE TABLE IF NOT EXISTS mission_packs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Ownership
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Source
    pipeline_run_id UUID REFERENCES storm_pipeline_runs(id) ON DELETE SET NULL,
    storm_alert_id UUID REFERENCES storm_alerts(id) ON DELETE SET NULL,
    territory_id UUID REFERENCES territories(id) ON DELETE SET NULL,
    
    -- Content
    title TEXT NOT NULL,
    briefing_text TEXT NOT NULL,
    objection_snippets JSONB DEFAULT '[]', -- [{ objection, response }]
    carrier_notes JSONB DEFAULT '[]',   -- [{ carrier, tactics }]
    territory_summary TEXT,
    
    -- Metadata for export
    top_leads_preview JSONB DEFAULT '[]', -- [{ address, score, estimated_claim }]
    total_opportunity_value DECIMAL(14, 2),
    recommended_action TEXT, -- 'deploy', 'hold', 'monitor'
    
    -- Location
    center_lat DOUBLE PRECISION,
    center_lng DOUBLE PRECISION,
    location_name TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mission_packs_user ON mission_packs(user_id);
CREATE INDEX IF NOT EXISTS idx_mission_packs_team ON mission_packs(team_id);
CREATE INDEX IF NOT EXISTS idx_mission_packs_created ON mission_packs(created_at DESC);

-- ============================================================================
-- RLS
-- ============================================================================
ALTER TABLE storm_pipeline_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE mission_packs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own pipeline runs" ON storm_pipeline_runs;
CREATE POLICY "Users view own pipeline runs" ON storm_pipeline_runs
    FOR SELECT USING (
        user_id = auth.uid() OR
        team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Users insert own pipeline runs" ON storm_pipeline_runs;
CREATE POLICY "Users insert own pipeline runs" ON storm_pipeline_runs
    FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users update own pipeline runs" ON storm_pipeline_runs;
CREATE POLICY "Users update own pipeline runs" ON storm_pipeline_runs
    FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users view own mission packs" ON mission_packs;
CREATE POLICY "Users view own mission packs" ON mission_packs
    FOR SELECT USING (
        user_id = auth.uid() OR
        team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Users insert own mission packs" ON mission_packs;
CREATE POLICY "Users insert own mission packs" ON mission_packs
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- Idempotency key for lead_exports (JobNimbus trust)
-- ============================================================================
ALTER TABLE lead_exports ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_lead_exports_idempotency ON lead_exports(idempotency_key) WHERE idempotency_key IS NOT NULL;
