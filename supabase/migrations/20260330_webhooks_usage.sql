-- ============================================================================
-- OUTBOUND WEBHOOKS & AI USAGE METERING (Phase 4)
-- ============================================================================

-- Webhook endpoints (org/team configured)
CREATE TABLE IF NOT EXISTS webhook_endpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    
    url TEXT NOT NULL,
    secret TEXT,  -- for signing payloads
    events TEXT[] NOT NULL DEFAULT ARRAY['storm_threshold', 'lead_rescored', 'supplement_ready', 'jn_export_success', 'jn_export_failure'],
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_team ON webhook_endpoints(team_id);

-- Webhook delivery log (audit)
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint_id UUID REFERENCES webhook_endpoints(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    payload_snapshot JSONB,
    status TEXT NOT NULL,  -- 'delivered', 'failed'
    status_code INTEGER,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_endpoint ON webhook_deliveries(endpoint_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created ON webhook_deliveries(created_at DESC);

-- AI usage metering (per team)
CREATE TABLE IF NOT EXISTS ai_usage_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    feature TEXT NOT NULL,  -- 'supplement', 'negotiation', 'briefing', 'storm_pipeline', etc.
    token_count INTEGER DEFAULT 0,
    request_count INTEGER DEFAULT 1,
    
    created_at DATE DEFAULT CURRENT_DATE
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_team_date ON ai_usage_records(team_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_date ON ai_usage_records(user_id, created_at);

ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team admins manage webhooks" ON webhook_endpoints;
CREATE POLICY "Team admins manage webhooks" ON webhook_endpoints
    FOR ALL USING (
        team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid() AND role IN ('admin', 'owner'))
    );

DROP POLICY IF EXISTS "Team admins view deliveries" ON webhook_deliveries;
CREATE POLICY "Team admins view deliveries" ON webhook_deliveries
    FOR SELECT USING (
        endpoint_id IN (SELECT id FROM webhook_endpoints WHERE team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()))
    );

DROP POLICY IF EXISTS "Users view own usage" ON ai_usage_records;
CREATE POLICY "Users view own usage" ON ai_usage_records
    FOR SELECT USING (
        user_id = auth.uid() OR
        team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
    );
