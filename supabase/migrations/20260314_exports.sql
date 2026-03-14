CREATE TYPE export_status AS ENUM (
	'ready',
	'exporting',
	'exported',
	'failed',
	'retrying',
	'permanently_failed'
);

CREATE TABLE IF NOT EXISTS opportunity_exports (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	house_id UUID NOT NULL,
	mission_id UUID,
	mission_stop_id UUID,
	status export_status NOT NULL DEFAULT 'ready',
	payload JSONB,
	jobnimbus_id TEXT,
	error TEXT,
	attempts INTEGER NOT NULL DEFAULT 0,
	next_retry_at TIMESTAMPTZ,
	exported_at TIMESTAMPTZ,
	created_by UUID NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS opportunity_exports_status_idx ON opportunity_exports(status);
CREATE INDEX IF NOT EXISTS opportunity_exports_created_at_idx ON opportunity_exports(created_at DESC);
CREATE INDEX IF NOT EXISTS opportunity_exports_next_retry_idx ON opportunity_exports(next_retry_at);
CREATE INDEX IF NOT EXISTS opportunity_exports_house_id_idx ON opportunity_exports(house_id);

ALTER TABLE opportunity_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select opportunity exports"
	ON opportunity_exports FOR SELECT
	USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert opportunity exports"
	ON opportunity_exports FOR INSERT
	WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update opportunity exports"
	ON opportunity_exports FOR UPDATE
	USING (auth.uid() IS NOT NULL);

CREATE OR REPLACE FUNCTION update_opportunity_exports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
	NEW.updated_at = NOW();
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_opportunity_exports_updated_at
	BEFORE UPDATE ON opportunity_exports
	FOR EACH ROW
	EXECUTE FUNCTION update_opportunity_exports_updated_at();
