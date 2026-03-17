-- Team Notes - Shared notes for team collaboration
CREATE TABLE IF NOT EXISTS team_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_notes_team ON team_notes(team_id);
CREATE INDEX IF NOT EXISTS idx_team_notes_created ON team_notes(created_at DESC);

ALTER TABLE team_notes ENABLE ROW LEVEL SECURITY;

-- Team members can view notes for their team
CREATE POLICY team_notes_select ON team_notes FOR SELECT USING (
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
);

-- Team members can insert notes
CREATE POLICY team_notes_insert ON team_notes FOR INSERT WITH CHECK (
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
    AND user_id = auth.uid()
);

-- Authors can update/delete their own notes
CREATE POLICY team_notes_update ON team_notes FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY team_notes_delete ON team_notes FOR DELETE USING (user_id = auth.uid());
