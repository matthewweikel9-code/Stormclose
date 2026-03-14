CREATE TYPE document_type AS ENUM (
    'homeowner_follow_up_letter',
    'neighborhood_flyer',
    'storm_impact_summary',
    'mission_recap',
    'manager_daily_summary',
    'office_summary',
    'qualified_opportunity_handoff',
    'claim_explanation_letter',
    'leave_behind',
    'rep_field_recap'
);

CREATE TYPE document_format AS ENUM (
    'pdf',
    'docx',
    'clipboard',
    'print'
);

CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type document_type NOT NULL,
    title TEXT NOT NULL,
    context_type TEXT NOT NULL,
    context_id UUID NOT NULL,
    content TEXT NOT NULL,
    format document_format NOT NULL DEFAULT 'pdf',
    created_by UUID NOT NULL REFERENCES auth.users(id),
    exported BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS documents_type_idx ON documents(type);
CREATE INDEX IF NOT EXISTS documents_context_idx ON documents(context_type, context_id);
CREATE INDEX IF NOT EXISTS documents_created_by_idx ON documents(created_by);
CREATE INDEX IF NOT EXISTS documents_created_at_idx ON documents(created_at DESC);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documents_select_own_or_company"
ON documents
FOR SELECT
USING (
    created_by = auth.uid()
    OR EXISTS (
        SELECT 1
        FROM users u_creator
        JOIN users u_viewer ON u_viewer.id = auth.uid()
        WHERE u_creator.id = documents.created_by
        AND u_creator.company_id = u_viewer.company_id
    )
);

CREATE POLICY "documents_insert_own"
ON documents
FOR INSERT
WITH CHECK (created_by = auth.uid());

CREATE POLICY "documents_update_own"
ON documents
FOR UPDATE
USING (created_by = auth.uid());
