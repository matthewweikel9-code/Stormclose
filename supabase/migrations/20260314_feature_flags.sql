-- ============================================================================
-- FEATURE FLAGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL,
  user_id UUID NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One global flag value per key (user_id is NULL)
CREATE UNIQUE INDEX IF NOT EXISTS feature_flags_global_key_uidx
ON feature_flags(key)
WHERE user_id IS NULL;

-- One per-user override per key
CREATE UNIQUE INDEX IF NOT EXISTS feature_flags_user_key_uidx
ON feature_flags(key, user_id)
WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS feature_flags_lookup_idx
ON feature_flags(key, user_id, created_at DESC);

ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

-- Users can read global flags and their own overrides
DROP POLICY IF EXISTS "Users can view applicable feature flags" ON feature_flags;
CREATE POLICY "Users can view applicable feature flags"
ON feature_flags FOR SELECT
USING (user_id IS NULL OR auth.uid() = user_id);
