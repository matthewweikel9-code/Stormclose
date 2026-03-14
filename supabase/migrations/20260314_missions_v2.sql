-- ==========================================================================
-- MISSIONS V2 + PRESENCE + EVENTS
-- ==========================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mission_status_v2') THEN
    CREATE TYPE mission_status_v2 AS ENUM ('planned', 'active', 'paused', 'completed', 'expired');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mission_stop_status_v2') THEN
    CREATE TYPE mission_stop_status_v2 AS ENUM (
      'new',
      'targeted',
      'attempted',
      'no_answer',
      'interested',
      'not_interested',
      'follow_up_needed',
      'sent_to_jobnimbus'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rep_presence_mode_v2') THEN
    CREATE TYPE rep_presence_mode_v2 AS ENUM ('active_mission', 'idle', 'offline');
  END IF;
END $$;

-- --------------------------------------------------------------------------
-- Missions table (canonical V2 table)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_rep_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  storm_event_id UUID REFERENCES storm_events_cache(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  status mission_status_v2 NOT NULL DEFAULT 'planned',
  ai_generated BOOLEAN NOT NULL DEFAULT FALSE,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deployment_recommendation JSONB NOT NULL DEFAULT '{}'::jsonb,
  center_lat DOUBLE PRECISION,
  center_lng DOUBLE PRECISION,
  radius_miles DECIMAL(8, 2),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS missions_created_by_idx ON missions(created_by);
CREATE INDEX IF NOT EXISTS missions_assigned_rep_idx ON missions(assigned_rep_id);
CREATE INDEX IF NOT EXISTS missions_status_idx ON missions(status);
CREATE INDEX IF NOT EXISTS missions_created_at_idx ON missions(created_at DESC);

-- Also keep legacy canvass_missions compatible with V2 fields
ALTER TABLE canvass_missions
  ADD COLUMN IF NOT EXISTS ai_generated BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deployment_recommendation JSONB NOT NULL DEFAULT '{}'::jsonb;

-- --------------------------------------------------------------------------
-- mission_stops V2 fields (existing table extended)
-- --------------------------------------------------------------------------
ALTER TABLE mission_stops
  ADD COLUMN IF NOT EXISTS house_id UUID,
  ADD COLUMN IF NOT EXISTS sequence INTEGER,
  ADD COLUMN IF NOT EXISTS status mission_stop_status_v2,
  ADD COLUMN IF NOT EXISTS outcome_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS departed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notes TEXT;

UPDATE mission_stops
SET sequence = COALESCE(stop_order, 0)
WHERE sequence IS NULL;

UPDATE mission_stops
SET status = CASE
  WHEN outcome IN ('pending') THEN 'new'::mission_stop_status_v2
  WHEN outcome IN ('knocked') THEN 'attempted'::mission_stop_status_v2
  WHEN outcome IN ('not_home') THEN 'no_answer'::mission_stop_status_v2
  WHEN outcome IN ('appointment_set', 'inspection_set') THEN 'interested'::mission_stop_status_v2
  WHEN outcome IN ('not_interested') THEN 'not_interested'::mission_stop_status_v2
  ELSE 'new'::mission_stop_status_v2
END
WHERE status IS NULL;

ALTER TABLE mission_stops
  ALTER COLUMN sequence SET NOT NULL,
  ALTER COLUMN status SET NOT NULL;

CREATE INDEX IF NOT EXISTS mission_stops_sequence_idx ON mission_stops(mission_id, sequence);
CREATE INDEX IF NOT EXISTS mission_stops_status_v2_idx ON mission_stops(status);

-- --------------------------------------------------------------------------
-- rep_presence
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rep_presence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mission_id UUID REFERENCES missions(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  mode rep_presence_mode_v2 NOT NULL DEFAULT 'idle',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS rep_presence_mode_idx ON rep_presence(mode);
CREATE INDEX IF NOT EXISTS rep_presence_recorded_at_idx ON rep_presence(recorded_at DESC);
CREATE INDEX IF NOT EXISTS rep_presence_mission_idx ON rep_presence(mission_id);

-- --------------------------------------------------------------------------
-- mission_events
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mission_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT mission_events_mission_fk
    FOREIGN KEY (mission_id)
    REFERENCES missions(id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS mission_events_mission_idx ON mission_events(mission_id, created_at DESC);
CREATE INDEX IF NOT EXISTS mission_events_type_idx ON mission_events(event_type);

-- --------------------------------------------------------------------------
-- RLS
-- --------------------------------------------------------------------------
ALTER TABLE missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rep_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE mission_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS missions_select ON missions;
CREATE POLICY missions_select ON missions
FOR SELECT USING (
  created_by = auth.uid() OR assigned_rep_id = auth.uid()
);

DROP POLICY IF EXISTS missions_insert ON missions;
CREATE POLICY missions_insert ON missions
FOR INSERT WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS missions_update ON missions;
CREATE POLICY missions_update ON missions
FOR UPDATE USING (
  created_by = auth.uid() OR assigned_rep_id = auth.uid()
);

DROP POLICY IF EXISTS rep_presence_select ON rep_presence;
CREATE POLICY rep_presence_select ON rep_presence
FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS rep_presence_insert ON rep_presence;
CREATE POLICY rep_presence_insert ON rep_presence
FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS rep_presence_update ON rep_presence;
CREATE POLICY rep_presence_update ON rep_presence
FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS rep_presence_delete ON rep_presence;
CREATE POLICY rep_presence_delete ON rep_presence
FOR DELETE USING (user_id = auth.uid());

DROP POLICY IF EXISTS mission_events_select ON mission_events;
CREATE POLICY mission_events_select ON mission_events
FOR SELECT USING (
  mission_id IN (
    SELECT id FROM missions WHERE created_by = auth.uid() OR assigned_rep_id = auth.uid()
  )
);

DROP POLICY IF EXISTS mission_events_insert ON mission_events;
CREATE POLICY mission_events_insert ON mission_events
FOR INSERT WITH CHECK (
  mission_id IN (
    SELECT id FROM missions WHERE created_by = auth.uid() OR assigned_rep_id = auth.uid()
  )
);

-- --------------------------------------------------------------------------
-- Trigger updated_at
-- --------------------------------------------------------------------------
DROP TRIGGER IF EXISTS missions_updated_at ON missions;
CREATE TRIGGER missions_updated_at
  BEFORE UPDATE ON missions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS rep_presence_updated_at ON rep_presence;
CREATE TRIGGER rep_presence_updated_at
  BEFORE UPDATE ON rep_presence
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
