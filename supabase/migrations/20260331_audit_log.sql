-- ============================================================================
-- AUDIT LOG (Phase 5 - Enterprise)
-- Append-only log: tool used, exports, webhook deliveries
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    action TEXT NOT NULL,  -- 'tool_used', 'export', 'webhook_delivery', 'login', etc.
    resource_type TEXT,    -- 'supplement', 'lead', 'mission_stop', etc.
    resource_id TEXT,
    
    metadata JSONB DEFAULT '{}',  -- inputs/outputs metadata, no full PII
    ip_address INET,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_team ON audit_log(team_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own audit log" ON audit_log;
CREATE POLICY "Users view own audit log" ON audit_log
    FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users view team audit log" ON audit_log;
CREATE POLICY "Users view team audit log" ON audit_log
    FOR SELECT USING (
        team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
    );

-- No INSERT for regular users (service role bypasses RLS and inserts via admin client)
