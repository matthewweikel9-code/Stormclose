-- Storm provider integrations: HailTrace, Hail Recon (BYO storm data)
-- Stores encrypted API keys per user; Storm Ops uses these instead of Xweather when configured

CREATE TABLE IF NOT EXISTS storm_provider_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('hailtrace', 'hailrecon')),
    encrypted_credentials TEXT NOT NULL,
    settings_json JSONB DEFAULT '{"defaultRadius": 100}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_storm_provider_integrations_user ON storm_provider_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_storm_provider_integrations_provider ON storm_provider_integrations(provider);

ALTER TABLE storm_provider_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own storm provider integrations" ON storm_provider_integrations;
CREATE POLICY "Users can view their own storm provider integrations" ON storm_provider_integrations FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own storm provider integrations" ON storm_provider_integrations;
CREATE POLICY "Users can insert their own storm provider integrations" ON storm_provider_integrations FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own storm provider integrations" ON storm_provider_integrations;
CREATE POLICY "Users can update their own storm provider integrations" ON storm_provider_integrations FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own storm provider integrations" ON storm_provider_integrations;
CREATE POLICY "Users can delete their own storm provider integrations" ON storm_provider_integrations FOR DELETE USING (user_id = auth.uid());
