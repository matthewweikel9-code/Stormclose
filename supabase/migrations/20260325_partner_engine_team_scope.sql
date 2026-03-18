-- ============================================================================
-- PARTNER ENGINE TEAM SCOPE — Enterprise upgrade
-- Add team_id to all partner engine tables, backfill, update RLS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. HELPER: All team IDs user can access (memberships + owned teams)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_accessible_team_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
    UNION
    SELECT id FROM public.teams WHERE owner_id = auth.uid();
$$;

-- ----------------------------------------------------------------------------
-- 2. ADD team_id TO PARTNER ENGINE TABLES
-- ----------------------------------------------------------------------------
ALTER TABLE partner_engine_partners ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE CASCADE;
ALTER TABLE partner_engine_referrals ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE CASCADE;
ALTER TABLE partner_engine_rewards ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE CASCADE;
ALTER TABLE partner_engine_notifications ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE CASCADE;
ALTER TABLE partner_engine_settings ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE CASCADE;

-- ----------------------------------------------------------------------------
-- 3. BACKFILL team_id FROM user_id
-- For each user: use first team_membership, else owned team, else create personal team
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    r RECORD;
    v_team_id UUID;
BEGIN
    -- Partners
    FOR r IN SELECT DISTINCT user_id FROM partner_engine_partners WHERE team_id IS NULL
    LOOP
        SELECT team_id INTO v_team_id FROM team_members WHERE user_id = r.user_id LIMIT 1;
        IF v_team_id IS NULL THEN
            SELECT id INTO v_team_id FROM teams WHERE owner_id = r.user_id LIMIT 1;
        END IF;
        IF v_team_id IS NOT NULL THEN
            UPDATE partner_engine_partners SET team_id = v_team_id WHERE user_id = r.user_id AND team_id IS NULL;
        END IF;
    END LOOP;

    -- Referrals
    FOR r IN SELECT DISTINCT user_id FROM partner_engine_referrals WHERE team_id IS NULL
    LOOP
        SELECT team_id INTO v_team_id FROM team_members WHERE user_id = r.user_id LIMIT 1;
        IF v_team_id IS NULL THEN
            SELECT id INTO v_team_id FROM teams WHERE owner_id = r.user_id LIMIT 1;
        END IF;
        IF v_team_id IS NOT NULL THEN
            UPDATE partner_engine_referrals SET team_id = v_team_id WHERE user_id = r.user_id AND team_id IS NULL;
        END IF;
    END LOOP;

    -- Rewards
    FOR r IN SELECT DISTINCT user_id FROM partner_engine_rewards WHERE team_id IS NULL
    LOOP
        SELECT team_id INTO v_team_id FROM team_members WHERE user_id = r.user_id LIMIT 1;
        IF v_team_id IS NULL THEN
            SELECT id INTO v_team_id FROM teams WHERE owner_id = r.user_id LIMIT 1;
        END IF;
        IF v_team_id IS NOT NULL THEN
            UPDATE partner_engine_rewards SET team_id = v_team_id WHERE user_id = r.user_id AND team_id IS NULL;
        END IF;
    END LOOP;

    -- Notifications
    FOR r IN SELECT DISTINCT user_id FROM partner_engine_notifications WHERE team_id IS NULL
    LOOP
        SELECT team_id INTO v_team_id FROM team_members WHERE user_id = r.user_id LIMIT 1;
        IF v_team_id IS NULL THEN
            SELECT id INTO v_team_id FROM teams WHERE owner_id = r.user_id LIMIT 1;
        END IF;
        IF v_team_id IS NOT NULL THEN
            UPDATE partner_engine_notifications SET team_id = v_team_id WHERE user_id = r.user_id AND team_id IS NULL;
        END IF;
    END LOOP;

    -- Settings
    FOR r IN SELECT DISTINCT user_id FROM partner_engine_settings WHERE team_id IS NULL
    LOOP
        SELECT team_id INTO v_team_id FROM team_members WHERE user_id = r.user_id LIMIT 1;
        IF v_team_id IS NULL THEN
            SELECT id INTO v_team_id FROM teams WHERE owner_id = r.user_id LIMIT 1;
        END IF;
        IF v_team_id IS NOT NULL THEN
            UPDATE partner_engine_settings SET team_id = v_team_id WHERE user_id = r.user_id AND team_id IS NULL;
        END IF;
    END LOOP;
END $$;

-- For users with no team: create personal team and backfill
DO $$
DECLARE
    r RECORD;
    v_team_id UUID;
BEGIN
    FOR r IN
        SELECT DISTINCT p.user_id FROM partner_engine_partners p
        WHERE p.team_id IS NULL
        UNION
        SELECT DISTINCT ref.user_id FROM partner_engine_referrals ref WHERE ref.team_id IS NULL
        UNION
        SELECT DISTINCT s.user_id FROM partner_engine_settings s WHERE s.team_id IS NULL
    LOOP
        SELECT id INTO v_team_id FROM teams WHERE owner_id = r.user_id LIMIT 1;
        IF v_team_id IS NULL THEN
            INSERT INTO teams (name, owner_id)
            VALUES ('Personal', r.user_id)
            RETURNING id INTO v_team_id;
        END IF;

        IF v_team_id IS NOT NULL THEN
            INSERT INTO team_members (team_id, user_id, role)
            VALUES (v_team_id, r.user_id, 'owner')
            ON CONFLICT (team_id, user_id) DO NOTHING;

            UPDATE partner_engine_partners SET team_id = v_team_id WHERE user_id = r.user_id AND team_id IS NULL;
            UPDATE partner_engine_referrals SET team_id = v_team_id WHERE user_id = r.user_id AND team_id IS NULL;
            UPDATE partner_engine_rewards SET team_id = v_team_id WHERE user_id = r.user_id AND team_id IS NULL;
            UPDATE partner_engine_notifications SET team_id = v_team_id WHERE user_id = r.user_id AND team_id IS NULL;
            UPDATE partner_engine_settings SET team_id = v_team_id WHERE user_id = r.user_id AND team_id IS NULL;
        END IF;
    END LOOP;
END $$;

-- Referrals: also set team_id from partner when partner has it
UPDATE partner_engine_referrals r
SET team_id = p.team_id
FROM partner_engine_partners p
WHERE r.partner_id = p.id AND r.team_id IS NULL AND p.team_id IS NOT NULL;

-- Rewards: also set team_id from referral
UPDATE partner_engine_rewards rw
SET team_id = r.team_id
FROM partner_engine_referrals r
WHERE rw.referral_id = r.id AND rw.team_id IS NULL AND r.team_id IS NOT NULL;

-- Deduplicate settings: keep one per team (earliest created_at)
DELETE FROM partner_engine_settings
WHERE team_id IS NOT NULL
  AND id NOT IN (
    SELECT DISTINCT ON (team_id) id
    FROM partner_engine_settings
    WHERE team_id IS NOT NULL
    ORDER BY team_id, created_at ASC
  );

-- ----------------------------------------------------------------------------
-- 4. UPDATE partner_engine_settings UNIQUE constraint
-- Settings: one per team (was one per user)
-- ----------------------------------------------------------------------------
ALTER TABLE partner_engine_settings DROP CONSTRAINT IF EXISTS partner_engine_settings_user_id_key;
-- Allow one settings row per team; multiple NULL team_id for legacy
CREATE UNIQUE INDEX IF NOT EXISTS partner_engine_settings_team_id_key ON partner_engine_settings(team_id) WHERE team_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 5. CREATE INDEXES FOR team_id
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_pe_partners_team ON partner_engine_partners(team_id);
CREATE INDEX IF NOT EXISTS idx_pe_referrals_team ON partner_engine_referrals(team_id);
CREATE INDEX IF NOT EXISTS idx_pe_rewards_team ON partner_engine_rewards(team_id);
CREATE INDEX IF NOT EXISTS idx_pe_notifications_team ON partner_engine_notifications(team_id);
CREATE INDEX IF NOT EXISTS idx_pe_settings_team ON partner_engine_settings(team_id);

-- ----------------------------------------------------------------------------
-- 6. DROP OLD RLS POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Partners are user scoped" ON partner_engine_partners;
DROP POLICY IF EXISTS "Referrals are user scoped" ON partner_engine_referrals;
DROP POLICY IF EXISTS "Rewards are user scoped" ON partner_engine_rewards;
DROP POLICY IF EXISTS "Notifications are user scoped" ON partner_engine_notifications;
DROP POLICY IF EXISTS "Settings are user scoped" ON partner_engine_settings;

-- ----------------------------------------------------------------------------
-- 7. CREATE NEW TEAM-SCOPED RLS POLICIES
-- Access: team_id in user's accessible teams OR (legacy) user_id = auth.uid()
-- ----------------------------------------------------------------------------
CREATE POLICY "Partners team scoped" ON partner_engine_partners FOR ALL USING (
    team_id IN (SELECT public.get_user_accessible_team_ids())
    OR (team_id IS NULL AND user_id = auth.uid())
) WITH CHECK (
    team_id IN (SELECT public.get_user_accessible_team_ids())
    OR (team_id IS NULL AND user_id = auth.uid())
);

CREATE POLICY "Referrals team scoped" ON partner_engine_referrals FOR ALL USING (
    team_id IN (SELECT public.get_user_accessible_team_ids())
    OR (team_id IS NULL AND user_id = auth.uid())
) WITH CHECK (
    team_id IN (SELECT public.get_user_accessible_team_ids())
    OR (team_id IS NULL AND user_id = auth.uid())
);

CREATE POLICY "Rewards team scoped" ON partner_engine_rewards FOR ALL USING (
    team_id IN (SELECT public.get_user_accessible_team_ids())
    OR (team_id IS NULL AND user_id = auth.uid())
) WITH CHECK (
    team_id IN (SELECT public.get_user_accessible_team_ids())
    OR (team_id IS NULL AND user_id = auth.uid())
);

CREATE POLICY "Notifications team scoped" ON partner_engine_notifications FOR ALL USING (
    team_id IN (SELECT public.get_user_accessible_team_ids())
    OR (team_id IS NULL AND user_id = auth.uid())
) WITH CHECK (
    team_id IN (SELECT public.get_user_accessible_team_ids())
    OR (team_id IS NULL AND user_id = auth.uid())
);

CREATE POLICY "Settings team scoped" ON partner_engine_settings FOR ALL USING (
    team_id IN (SELECT public.get_user_accessible_team_ids())
    OR (team_id IS NULL AND user_id = auth.uid())
) WITH CHECK (
    team_id IN (SELECT public.get_user_accessible_team_ids())
    OR (team_id IS NULL AND user_id = auth.uid())
);
