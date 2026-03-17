-- ============================================================================
-- TEAMS & TEAM MEMBERS - Complete schema for team management
-- Recreates team_members with correct schema (drops existing if wrong structure)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. TEAMS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    stripe_customer_id TEXT,
    subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'pro_plus', 'enterprise')),
    subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'canceled', 'past_due', 'trialing')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 2. DROP & RECREATE TEAM_MEMBERS (fixes schema drift from Supabase Organizations)
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS team_members CASCADE;

CREATE TABLE team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'manager', 'member')),
    invited_email TEXT,
    invited_at TIMESTAMPTZ,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);

-- ----------------------------------------------------------------------------
-- 3. HELPER FUNCTION (breaks RLS recursion for team membership checks)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_team_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT team_id FROM public.team_members WHERE user_id = auth.uid();
$$;

-- ----------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS teams_select ON teams;
DROP POLICY IF EXISTS teams_insert ON teams;
DROP POLICY IF EXISTS teams_update ON teams;
DROP POLICY IF EXISTS teams_delete ON teams;
DROP POLICY IF EXISTS team_members_select ON team_members;
DROP POLICY IF EXISTS team_members_insert ON team_members;
DROP POLICY IF EXISTS team_members_update ON team_members;
DROP POLICY IF EXISTS team_members_delete ON team_members;
DROP POLICY IF EXISTS "Users can view their team memberships" ON team_members;
DROP POLICY IF EXISTS "Team members can view team" ON team_members;

-- Teams: owners see their teams; members see teams they belong to
CREATE POLICY teams_select ON teams FOR SELECT USING (
    owner_id = auth.uid() OR
    id IN (SELECT public.get_user_team_ids())
);
CREATE POLICY teams_insert ON teams FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY teams_update ON teams FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY teams_delete ON teams FOR DELETE USING (owner_id = auth.uid());

-- Team Members: see members of your teams; owners/admins can insert/update/delete
CREATE POLICY team_members_select ON team_members FOR SELECT USING (
    team_id IN (SELECT public.get_user_team_ids()) OR
    team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid())
);
CREATE POLICY team_members_insert ON team_members FOR INSERT WITH CHECK (
    team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid()) OR
    team_id IN (
        SELECT tm.team_id FROM team_members tm
        WHERE tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
    )
);
CREATE POLICY team_members_update ON team_members FOR UPDATE USING (
    team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid()) OR
    team_id IN (
        SELECT tm.team_id FROM team_members tm
        WHERE tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
    )
);
CREATE POLICY team_members_delete ON team_members FOR DELETE USING (
    team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid()) OR
    user_id = auth.uid() OR
    team_id IN (
        SELECT tm.team_id FROM team_members tm
        WHERE tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
    )
);
