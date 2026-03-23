-- Workflow runs: orchestration for appointment.set and other async workflows
-- Tracks estimate, materials, xactimate, eagleview, crm sync steps

CREATE TABLE IF NOT EXISTS workflow_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    correlation_id TEXT NOT NULL,
    source_type TEXT NOT NULL DEFAULT 'mission_stop',
    source_id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'partial')),
    payload JSONB DEFAULT '{}',
    errors JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_correlation ON workflow_runs(correlation_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_source ON workflow_runs(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_user ON workflow_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_created ON workflow_runs(created_at DESC);

ALTER TABLE workflow_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own workflow runs" ON workflow_runs;
CREATE POLICY "Users can view their own workflow runs" ON workflow_runs FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own workflow runs" ON workflow_runs;
CREATE POLICY "Users can insert their own workflow runs" ON workflow_runs FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own workflow runs" ON workflow_runs;
CREATE POLICY "Users can update their own workflow runs" ON workflow_runs FOR UPDATE USING (user_id = auth.uid());

-- workflow_step_runs: individual steps within a run
CREATE TABLE IF NOT EXISTS workflow_step_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_run_id UUID NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
    step TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
    payload JSONB DEFAULT '{}',
    error TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_step_runs_run ON workflow_step_runs(workflow_run_id);
CREATE INDEX IF NOT EXISTS idx_workflow_step_runs_step ON workflow_step_runs(step);

ALTER TABLE workflow_step_runs ENABLE ROW LEVEL SECURITY;

-- Step runs inherit visibility from parent workflow_run
DROP POLICY IF EXISTS "Users can view workflow step runs for their workflow runs" ON workflow_step_runs;
CREATE POLICY "Users can view workflow step runs for their workflow runs" ON workflow_step_runs FOR SELECT
    USING (EXISTS (SELECT 1 FROM workflow_runs wr WHERE wr.id = workflow_step_runs.workflow_run_id AND wr.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert workflow step runs for their workflow runs" ON workflow_step_runs;
CREATE POLICY "Users can insert workflow step runs for their workflow runs" ON workflow_step_runs FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM workflow_runs wr WHERE wr.id = workflow_step_runs.workflow_run_id AND wr.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can update workflow step runs for their workflow runs" ON workflow_step_runs;
CREATE POLICY "Users can update workflow step runs for their workflow runs" ON workflow_step_runs FOR UPDATE
    USING (EXISTS (SELECT 1 FROM workflow_runs wr WHERE wr.id = workflow_step_runs.workflow_run_id AND wr.user_id = auth.uid()));
