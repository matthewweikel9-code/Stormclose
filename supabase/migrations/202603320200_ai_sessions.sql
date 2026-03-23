-- AI Sessions audit table (contractual / compliance)
-- Logs each AI module invocation for usage and audit

CREATE TABLE IF NOT EXISTS ai_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    module_id TEXT NOT NULL,
    model TEXT,
    token_count INT,
    latency_ms INT,
    input_hash TEXT,
    output_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_sessions_user ON ai_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_sessions_module ON ai_sessions(module_id);
CREATE INDEX IF NOT EXISTS idx_ai_sessions_created ON ai_sessions(created_at DESC);

ALTER TABLE ai_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own ai_sessions" ON ai_sessions;
CREATE POLICY "Users view own ai_sessions" ON ai_sessions
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own ai_sessions" ON ai_sessions;
CREATE POLICY "Users insert own ai_sessions" ON ai_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access ai_sessions" ON ai_sessions;
CREATE POLICY "Service role full access ai_sessions" ON ai_sessions
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
