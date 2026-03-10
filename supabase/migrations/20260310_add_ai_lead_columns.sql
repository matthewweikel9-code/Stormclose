-- Add columns for AI-generated leads
-- Run this in Supabase SQL Editor

-- Add new columns to leads table for storm tracking
ALTER TABLE leads ADD COLUMN IF NOT EXISTS hail_event_id UUID REFERENCES hail_events(id);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS storm_date DATE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS hail_size DECIMAL(4,2);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS is_area_lead BOOLEAN DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_leads_hail_event ON leads(hail_event_id);
CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(source);
CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(lead_score DESC);

-- Update RLS policies to allow lead generation
-- First, drop existing problematic policies if they exist
DROP POLICY IF EXISTS "Users can view own leads" ON leads;
DROP POLICY IF EXISTS "Users can insert own leads" ON leads;
DROP POLICY IF EXISTS "Users can update own leads" ON leads;
DROP POLICY IF EXISTS "Service role can manage all leads" ON leads;

-- Create simpler RLS policies
CREATE POLICY "Users can view own leads"
ON leads FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR assigned_to = auth.uid());

CREATE POLICY "Users can insert own leads"
ON leads FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own leads"
ON leads FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Allow service role full access (for cron jobs)
CREATE POLICY "Service role full access"
ON leads FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Fix the team_members infinite recursion issue
DROP POLICY IF EXISTS "Team members can view team" ON team_members;
DROP POLICY IF EXISTS "Users can view their team memberships" ON team_members;

CREATE POLICY "Users can view their team memberships"
ON team_members FOR SELECT
TO authenticated
USING (user_id = auth.uid());
