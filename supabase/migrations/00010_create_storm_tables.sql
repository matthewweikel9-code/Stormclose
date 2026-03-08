-- Storm Command Center Tables
-- Migration: 00010_create_storm_tables.sql

-- Storm events (cached from weather API)
CREATE TABLE IF NOT EXISTS storm_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT UNIQUE,
  event_type TEXT NOT NULL CHECK (event_type IN ('hail', 'wind', 'tornado', 'mixed')),
  severity TEXT CHECK (severity IN ('minor', 'moderate', 'severe', 'extreme')),
  hail_size_inches DECIMAL,
  wind_speed_mph INTEGER,
  city TEXT,
  state TEXT,
  county TEXT,
  latitude DECIMAL NOT NULL,
  longitude DECIMAL NOT NULL,
  radius_miles DECIMAL DEFAULT 5,
  event_date DATE NOT NULL,
  event_time TIME,
  source TEXT DEFAULT 'noaa',
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User service areas (territories they work in)
CREATE TABLE IF NOT EXISTS service_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  city TEXT,
  state TEXT,
  zip_codes TEXT[],
  radius_miles DECIMAL DEFAULT 25,
  center_lat DECIMAL,
  center_lng DECIMAL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Storm leads (properties in storm-affected areas)
CREATE TABLE IF NOT EXISTS storm_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storm_event_id UUID REFERENCES storm_events(id) ON DELETE SET NULL,
  
  -- Property info
  address TEXT NOT NULL,
  city TEXT,
  state TEXT,
  zip TEXT,
  latitude DECIMAL,
  longitude DECIMAL,
  
  -- Property data (from enrichment)
  property_value INTEGER,
  year_built INTEGER,
  roof_age_years INTEGER,
  roof_type TEXT,
  square_footage INTEGER,
  
  -- Contact info (from skip tracing)
  owner_name TEXT,
  phone TEXT,
  email TEXT,
  
  -- Scoring
  damage_probability INTEGER CHECK (damage_probability >= 0 AND damage_probability <= 100),
  lead_score INTEGER CHECK (lead_score >= 0 AND lead_score <= 100),
  lead_temperature TEXT CHECK (lead_temperature IN ('hot', 'warm', 'cold')),
  
  -- Status tracking
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'scheduled', 'inspected', 'quoted', 'sold', 'lost', 'not_interested')),
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Storm routes (optimized door-knocking routes)
CREATE TABLE IF NOT EXISTS storm_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storm_event_id UUID REFERENCES storm_events(id) ON DELETE SET NULL,
  
  name TEXT NOT NULL,
  status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
  
  -- Route metadata
  total_stops INTEGER DEFAULT 0,
  completed_stops INTEGER DEFAULT 0,
  estimated_duration_minutes INTEGER,
  total_distance_miles DECIMAL,
  
  -- Start/end points
  start_address TEXT,
  start_lat DECIMAL,
  start_lng DECIMAL,
  
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Route stops (individual addresses in a route)
CREATE TABLE IF NOT EXISTS route_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES storm_routes(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES storm_leads(id) ON DELETE SET NULL,
  
  stop_order INTEGER NOT NULL,
  address TEXT NOT NULL,
  latitude DECIMAL,
  longitude DECIMAL,
  
  -- Outcome tracking
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'skipped', 'not_home', 'callback')),
  outcome TEXT CHECK (outcome IN ('not_interested', 'callback_scheduled', 'inspection_scheduled', 'already_has_roofer', 'no_damage', 'sold')),
  callback_date DATE,
  callback_time TIME,
  notes TEXT,
  
  knocked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Storm alerts (notifications for service areas)
CREATE TABLE IF NOT EXISTS storm_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storm_event_id UUID REFERENCES storm_events(id) ON DELETE CASCADE,
  service_area_id UUID REFERENCES service_areas(id) ON DELETE CASCADE,
  
  alert_type TEXT DEFAULT 'storm_detected' CHECK (alert_type IN ('storm_detected', 'hail_confirmed', 'leads_ready')),
  message TEXT,
  is_read BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_storm_events_date ON storm_events(event_date DESC);
CREATE INDEX IF NOT EXISTS idx_storm_events_location ON storm_events(state, city);
CREATE INDEX IF NOT EXISTS idx_storm_leads_user ON storm_leads(user_id);
CREATE INDEX IF NOT EXISTS idx_storm_leads_storm ON storm_leads(storm_event_id);
CREATE INDEX IF NOT EXISTS idx_storm_leads_status ON storm_leads(status);
CREATE INDEX IF NOT EXISTS idx_storm_routes_user ON storm_routes(user_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_route ON route_stops(route_id);
CREATE INDEX IF NOT EXISTS idx_service_areas_user ON service_areas(user_id);

-- RLS Policies
ALTER TABLE storm_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE storm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE storm_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE storm_alerts ENABLE ROW LEVEL SECURITY;

-- Storm events are readable by all authenticated users
CREATE POLICY "Storm events are viewable by authenticated users" ON storm_events
  FOR SELECT USING (auth.role() = 'authenticated');

-- Service areas belong to users
CREATE POLICY "Users can manage their service areas" ON service_areas
  FOR ALL USING (auth.uid() = user_id);

-- Leads belong to users
CREATE POLICY "Users can manage their leads" ON storm_leads
  FOR ALL USING (auth.uid() = user_id);

-- Routes belong to users
CREATE POLICY "Users can manage their routes" ON storm_routes
  FOR ALL USING (auth.uid() = user_id);

-- Route stops accessible via route ownership
CREATE POLICY "Users can manage stops on their routes" ON route_stops
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM storm_routes 
      WHERE storm_routes.id = route_stops.route_id 
      AND storm_routes.user_id = auth.uid()
    )
  );

-- Alerts belong to users
CREATE POLICY "Users can view their alerts" ON storm_alerts
  FOR ALL USING (auth.uid() = user_id);
