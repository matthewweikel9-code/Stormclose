-- Rate limit log for AI and export endpoints
-- Tracks requests per user per hour for abuse prevention

CREATE TABLE IF NOT EXISTS rate_limit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    bucket_key TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_log_user_bucket ON rate_limit_log(user_id, bucket_key);
CREATE INDEX IF NOT EXISTS idx_rate_limit_log_created ON rate_limit_log(created_at);

-- RLS: users can only read/insert their own rows (service role used in API)
ALTER TABLE rate_limit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own rate limit rows" ON rate_limit_log;
CREATE POLICY "Users can insert own rate limit rows" ON rate_limit_log
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own rate limit rows" ON rate_limit_log;
CREATE POLICY "Users can read own rate limit rows" ON rate_limit_log
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access" ON rate_limit_log;
CREATE POLICY "Service role full access" ON rate_limit_log
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Cleanup old rows (run periodically via cron or on insert)
-- Optional: add a cron job to DELETE FROM rate_limit_log WHERE created_at < now() - interval '24 hours';
