-- ============================================================================
-- MISSION IDEMPOTENCY + TRANSACTIONAL CREATE
-- ============================================================================

ALTER TABLE canvass_missions
ADD COLUMN IF NOT EXISTS mission_signature TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS canvass_missions_user_storm_signature_uidx
ON canvass_missions(user_id, storm_event_id, mission_signature)
WHERE storm_event_id IS NOT NULL AND mission_signature IS NOT NULL;

CREATE OR REPLACE FUNCTION create_mission_with_stops(
  p_user_id UUID,
  p_storm_event_id UUID,
  p_signature TEXT,
  p_name TEXT,
  p_description TEXT,
  p_center_lat DOUBLE PRECISION,
  p_center_lng DOUBLE PRECISION,
  p_radius_miles DECIMAL,
  p_scheduled_date DATE,
  p_stops JSONB
)
RETURNS TABLE (
  mission_id UUID,
  created BOOLEAN
) AS $$
DECLARE
  v_existing_id UUID;
  v_mission_id UUID;
  v_total_stops INTEGER := COALESCE(jsonb_array_length(p_stops), 0);
  v_estimated_pipeline DECIMAL(14, 2) := 0;
BEGIN
  IF p_signature IS NULL OR length(trim(p_signature)) = 0 THEN
    RAISE EXCEPTION 'p_signature is required';
  END IF;

  SELECT id INTO v_existing_id
  FROM canvass_missions
  WHERE user_id = p_user_id
    AND storm_event_id = p_storm_event_id
    AND mission_signature = p_signature
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN QUERY SELECT v_existing_id, FALSE;
    RETURN;
  END IF;

  SELECT COALESCE(SUM((elem->>'estimated_claim')::DECIMAL), 0)
    INTO v_estimated_pipeline
  FROM jsonb_array_elements(COALESCE(p_stops, '[]'::jsonb)) AS elem;

  INSERT INTO canvass_missions (
    user_id,
    name,
    description,
    storm_event_id,
    mission_signature,
    center_lat,
    center_lng,
    radius_miles,
    total_stops,
    estimated_pipeline,
    scheduled_date,
    status
  ) VALUES (
    p_user_id,
    p_name,
    p_description,
    p_storm_event_id,
    p_signature,
    p_center_lat,
    p_center_lng,
    COALESCE(p_radius_miles, 1.0),
    v_total_stops,
    v_estimated_pipeline,
    p_scheduled_date,
    'planned'
  )
  ON CONFLICT (user_id, storm_event_id, mission_signature)
  DO NOTHING
  RETURNING id INTO v_mission_id;

  IF v_mission_id IS NULL THEN
    SELECT id INTO v_existing_id
    FROM canvass_missions
    WHERE user_id = p_user_id
      AND storm_event_id = p_storm_event_id
      AND mission_signature = p_signature
    LIMIT 1;

    RETURN QUERY SELECT v_existing_id, FALSE;
    RETURN;
  END IF;

  INSERT INTO mission_stops (
    mission_id,
    user_id,
    stop_order,
    address,
    city,
    state,
    zip,
    latitude,
    longitude,
    owner_name,
    year_built,
    square_feet,
    roof_age,
    estimated_value,
    estimated_claim,
    property_type,
    outcome
  )
  SELECT
    v_mission_id,
    p_user_id,
    row_number() OVER (),
    COALESCE(elem->>'address', 'Unknown Address'),
    elem->>'city',
    elem->>'state',
    elem->>'zip',
    COALESCE((elem->>'latitude')::DOUBLE PRECISION, (elem->>'lat')::DOUBLE PRECISION),
    COALESCE((elem->>'longitude')::DOUBLE PRECISION, (elem->>'lng')::DOUBLE PRECISION),
    elem->>'owner_name',
    NULLIF(elem->>'year_built', '')::INTEGER,
    NULLIF(elem->>'square_feet', '')::INTEGER,
    NULLIF(elem->>'roof_age', '')::INTEGER,
    NULLIF(elem->>'estimated_value', '')::DECIMAL,
    NULLIF(elem->>'estimated_claim', '')::DECIMAL,
    elem->>'property_type',
    COALESCE(elem->>'outcome', 'pending')
  FROM jsonb_array_elements(COALESCE(p_stops, '[]'::jsonb)) AS elem;

  RETURN QUERY SELECT v_mission_id, TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;