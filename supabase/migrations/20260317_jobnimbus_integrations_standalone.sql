-- Standalone: Create jobnimbus_integrations if missing (for JobNimbus connect)
-- Run this in Supabase SQL Editor if "Failed to save connection" occurs

CREATE TABLE IF NOT EXISTS jobnimbus_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    api_key_encrypted TEXT NOT NULL,
    jobnimbus_account_id TEXT,
    company_name TEXT,
    contacts_count INTEGER DEFAULT 0,
    jobs_count INTEGER DEFAULT 0,
    pending_changes INTEGER DEFAULT 0,
    last_sync_at TIMESTAMPTZ,
    settings JSONB DEFAULT '{"autoSync":true,"syncInterval":15,"syncContacts":true,"syncJobs":true,"syncNotes":true,"syncActivities":true}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jobnimbus_integrations_user ON jobnimbus_integrations(user_id);

ALTER TABLE jobnimbus_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own integrations" ON jobnimbus_integrations;
CREATE POLICY "Users can view their own integrations" ON jobnimbus_integrations FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own integrations" ON jobnimbus_integrations;
CREATE POLICY "Users can insert their own integrations" ON jobnimbus_integrations FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own integrations" ON jobnimbus_integrations;
CREATE POLICY "Users can update their own integrations" ON jobnimbus_integrations FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own integrations" ON jobnimbus_integrations;
CREATE POLICY "Users can delete their own integrations" ON jobnimbus_integrations FOR DELETE USING (user_id = auth.uid());
