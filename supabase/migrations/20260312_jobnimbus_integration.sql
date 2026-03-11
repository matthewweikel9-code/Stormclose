-- JobNimbus Integration Tables Migration
-- Adds support for two-way sync with JobNimbus CRM

-- ============================================================================
-- JOBNIMBUS INTEGRATIONS (Connection Settings)
-- ============================================================================
CREATE TABLE IF NOT EXISTS jobnimbus_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    
    -- API Credentials (encrypted in production)
    api_key_encrypted TEXT NOT NULL,
    jobnimbus_account_id TEXT,
    company_name TEXT,
    
    -- Sync Stats
    contacts_count INTEGER DEFAULT 0,
    jobs_count INTEGER DEFAULT 0,
    pending_changes INTEGER DEFAULT 0,
    last_sync_at TIMESTAMPTZ,
    
    -- Settings
    settings JSONB DEFAULT '{
        "autoSync": true,
        "syncInterval": 15,
        "syncContacts": true,
        "syncJobs": true,
        "syncNotes": true,
        "syncActivities": true
    }',
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jobnimbus_integrations_user ON jobnimbus_integrations(user_id);

-- ============================================================================
-- JOBNIMBUS CONTACTS (Synced from JobNimbus)
-- ============================================================================
CREATE TABLE IF NOT EXISTS jobnimbus_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    jobnimbus_id TEXT NOT NULL,
    
    -- Contact Info
    first_name TEXT,
    last_name TEXT,
    display_name TEXT,
    email TEXT,
    mobile_phone TEXT,
    home_phone TEXT,
    
    -- Address
    address_line1 TEXT,
    city TEXT,
    state_text TEXT,
    zip TEXT,
    
    -- Status
    status TEXT,
    tags JSONB DEFAULT '[]',
    
    -- Raw Data
    raw_data JSONB,
    synced_at TIMESTAMPTZ DEFAULT now(),
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(user_id, jobnimbus_id)
);

CREATE INDEX IF NOT EXISTS idx_jobnimbus_contacts_user ON jobnimbus_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_jobnimbus_contacts_jnid ON jobnimbus_contacts(jobnimbus_id);

-- ============================================================================
-- JOBNIMBUS JOBS (Synced from JobNimbus)
-- ============================================================================
CREATE TABLE IF NOT EXISTS jobnimbus_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    jobnimbus_id TEXT NOT NULL,
    contact_jnid TEXT,
    
    -- Job Info
    number TEXT,
    name TEXT,
    status TEXT,
    status_name TEXT,
    
    -- Address
    address_line1 TEXT,
    city TEXT,
    state_text TEXT,
    zip TEXT,
    
    -- Assignment
    sales_rep TEXT,
    total NUMERIC(12,2),
    
    -- Raw Data
    raw_data JSONB,
    synced_at TIMESTAMPTZ DEFAULT now(),
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(user_id, jobnimbus_id)
);

CREATE INDEX IF NOT EXISTS idx_jobnimbus_jobs_user ON jobnimbus_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobnimbus_jobs_jnid ON jobnimbus_jobs(jobnimbus_id);
CREATE INDEX IF NOT EXISTS idx_jobnimbus_jobs_contact ON jobnimbus_jobs(contact_jnid);

-- ============================================================================
-- JOBNIMBUS NOTES (Synced from JobNimbus)
-- ============================================================================
CREATE TABLE IF NOT EXISTS jobnimbus_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    jobnimbus_id TEXT NOT NULL,
    parent_jnid TEXT,
    parent_type TEXT,
    
    note TEXT,
    created_by TEXT,
    
    raw_data JSONB,
    synced_at TIMESTAMPTZ DEFAULT now(),
    
    created_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(user_id, jobnimbus_id)
);

CREATE INDEX IF NOT EXISTS idx_jobnimbus_notes_user ON jobnimbus_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_jobnimbus_notes_parent ON jobnimbus_notes(parent_jnid);

-- ============================================================================
-- JOBNIMBUS ACTIVITIES (Synced from JobNimbus)
-- ============================================================================
CREATE TABLE IF NOT EXISTS jobnimbus_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    jobnimbus_id TEXT NOT NULL,
    parent_jnid TEXT,
    parent_type TEXT,
    
    type TEXT,
    title TEXT,
    date_start TIMESTAMPTZ,
    date_end TIMESTAMPTZ,
    completed BOOLEAN DEFAULT false,
    
    raw_data JSONB,
    synced_at TIMESTAMPTZ DEFAULT now(),
    
    created_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(user_id, jobnimbus_id)
);

CREATE INDEX IF NOT EXISTS idx_jobnimbus_activities_user ON jobnimbus_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_jobnimbus_activities_parent ON jobnimbus_activities(parent_jnid);

-- ============================================================================
-- JOBNIMBUS WEBHOOK EVENTS (Incoming webhooks)
-- ============================================================================
CREATE TABLE IF NOT EXISTS jobnimbus_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    event_type TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    
    payload JSONB NOT NULL,
    payload_preview TEXT,
    
    received_at TIMESTAMPTZ DEFAULT now(),
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMPTZ,
    error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_jobnimbus_webhook_events_user ON jobnimbus_webhook_events(user_id);
CREATE INDEX IF NOT EXISTS idx_jobnimbus_webhook_events_processed ON jobnimbus_webhook_events(processed) WHERE processed = false;

-- ============================================================================
-- UPDATE JOBNIMBUS SYNC LOG (add missing columns)
-- ============================================================================
DO $$ 
BEGIN
    -- Add entity_type if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'jobnimbus_sync_log' AND column_name = 'entity_type') THEN
        ALTER TABLE jobnimbus_sync_log ADD COLUMN entity_type TEXT;
    END IF;
    
    -- Add action if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'jobnimbus_sync_log' AND column_name = 'action') THEN
        ALTER TABLE jobnimbus_sync_log ADD COLUMN action TEXT;
    END IF;
    
    -- Add message if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'jobnimbus_sync_log' AND column_name = 'message') THEN
        ALTER TABLE jobnimbus_sync_log ADD COLUMN message TEXT;
    END IF;
    
    -- Add jobnimbus_id if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'jobnimbus_sync_log' AND column_name = 'jobnimbus_id') THEN
        ALTER TABLE jobnimbus_sync_log ADD COLUMN jobnimbus_id TEXT;
    END IF;
END $$;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- JobNimbus Integrations RLS
ALTER TABLE jobnimbus_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own integrations"
ON jobnimbus_integrations FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own integrations"
ON jobnimbus_integrations FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own integrations"
ON jobnimbus_integrations FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own integrations"
ON jobnimbus_integrations FOR DELETE
USING (user_id = auth.uid());

-- JobNimbus Contacts RLS
ALTER TABLE jobnimbus_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own contacts"
ON jobnimbus_contacts FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own contacts"
ON jobnimbus_contacts FOR ALL
USING (user_id = auth.uid());

-- JobNimbus Jobs RLS
ALTER TABLE jobnimbus_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own jobs"
ON jobnimbus_jobs FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own jobs"
ON jobnimbus_jobs FOR ALL
USING (user_id = auth.uid());

-- JobNimbus Notes RLS
ALTER TABLE jobnimbus_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notes"
ON jobnimbus_notes FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own notes"
ON jobnimbus_notes FOR ALL
USING (user_id = auth.uid());

-- JobNimbus Activities RLS
ALTER TABLE jobnimbus_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own activities"
ON jobnimbus_activities FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own activities"
ON jobnimbus_activities FOR ALL
USING (user_id = auth.uid());

-- JobNimbus Webhook Events RLS
ALTER TABLE jobnimbus_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own webhook events"
ON jobnimbus_webhook_events FOR SELECT
USING (user_id = auth.uid());
