-- Fix infinite recursion in team_members RLS policies
-- Policies that read team_members in their subqueries cause recursion.
-- Use SECURITY DEFINER functions to bypass RLS when reading.

-- Function: teams where user can manage members (owner or admin)
CREATE OR REPLACE FUNCTION public.get_teams_where_user_can_manage()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id FROM teams WHERE owner_id = auth.uid()
  UNION
  SELECT team_id FROM team_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin');
$$;

-- Drop recursive policies
DROP POLICY IF EXISTS team_members_select ON team_members;
DROP POLICY IF EXISTS team_members_insert ON team_members;
DROP POLICY IF EXISTS team_members_update ON team_members;
DROP POLICY IF EXISTS team_members_delete ON team_members;

-- Recreate with non-recursive definitions (all use SECURITY DEFINER functions)
CREATE POLICY team_members_select ON team_members FOR SELECT USING (
    team_id IN (SELECT public.get_user_team_ids()) OR
    team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid())
);

CREATE POLICY team_members_insert ON team_members FOR INSERT WITH CHECK (
    team_id IN (SELECT public.get_teams_where_user_can_manage())
);

CREATE POLICY team_members_update ON team_members FOR UPDATE USING (
    team_id IN (SELECT public.get_teams_where_user_can_manage())
);

CREATE POLICY team_members_delete ON team_members FOR DELETE USING (
    team_id IN (SELECT public.get_teams_where_user_can_manage()) OR
    user_id = auth.uid()
);
