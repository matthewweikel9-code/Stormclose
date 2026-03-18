-- ============================================================================
-- DOCUMENT EXPORTS
-- Tracks reports and Xactimate estimates exported to JobNimbus
-- (Leads from appointments are tracked in lead_exports)
-- ============================================================================

CREATE TABLE IF NOT EXISTS document_exports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('report', 'xactimate_estimate')),
    entity_id UUID NOT NULL,
    jn_contact_id TEXT,
    exported_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS document_exports_user_id_idx ON document_exports(user_id);
CREATE INDEX IF NOT EXISTS document_exports_entity_idx ON document_exports(entity_type, entity_id);

ALTER TABLE document_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY document_exports_select ON document_exports
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY document_exports_insert ON document_exports
    FOR INSERT WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE document_exports IS 'Tracks reports and Xactimate estimates exported to JobNimbus';
