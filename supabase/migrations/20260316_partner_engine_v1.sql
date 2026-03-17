-- ============================================================================
-- PARTNER ENGINE V1 — ENTERPRISE
-- Referral CRM add-on with partner tiers, territory, notifications,
-- photo attachments, multi-location, and JobNimbus sync
-- ============================================================================

-- ============================================================================
-- PARTNERS
-- ============================================================================
CREATE TABLE IF NOT EXISTS partner_engine_partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    name TEXT NOT NULL,
    business_name TEXT,
    email TEXT,
    phone TEXT,
    partner_type TEXT NOT NULL DEFAULT 'other' CHECK (
        partner_type IN ('realtor','insurance_agent','home_inspector','property_manager','contractor','other')
    ),
    referral_code TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','archived')),

    -- Enterprise extensions
    tier TEXT NOT NULL DEFAULT 'bronze' CHECK (tier IN ('bronze','silver','gold','platinum')),
    territory TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    invited_by_partner_id UUID REFERENCES partner_engine_partners(id) ON DELETE SET NULL,
    invite_code TEXT UNIQUE,
    avatar_url TEXT,
    notify_email BOOLEAN NOT NULL DEFAULT TRUE,
    notify_sms BOOLEAN NOT NULL DEFAULT FALSE,
    notify_in_app BOOLEAN NOT NULL DEFAULT TRUE,
    total_referrals INTEGER NOT NULL DEFAULT 0,
    total_installs INTEGER NOT NULL DEFAULT 0,
    total_revenue NUMERIC(14,2) NOT NULL DEFAULT 0,
    total_rewards_paid NUMERIC(14,2) NOT NULL DEFAULT 0,
    last_active_at TIMESTAMPTZ,
    notes TEXT,
    tags JSONB DEFAULT '[]',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pe_partners_user ON partner_engine_partners(user_id);
CREATE INDEX IF NOT EXISTS idx_pe_partners_status ON partner_engine_partners(user_id, status);
CREATE INDEX IF NOT EXISTS idx_pe_partners_type ON partner_engine_partners(user_id, partner_type);
CREATE INDEX IF NOT EXISTS idx_pe_partners_tier ON partner_engine_partners(user_id, tier);
CREATE INDEX IF NOT EXISTS idx_pe_partners_territory ON partner_engine_partners(user_id, territory);
CREATE INDEX IF NOT EXISTS idx_pe_partners_invite ON partner_engine_partners(invited_by_partner_id);

-- ============================================================================
-- REFERRALS
-- ============================================================================
CREATE TABLE IF NOT EXISTS partner_engine_referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    partner_id UUID REFERENCES partner_engine_partners(id) ON DELETE SET NULL,

    homeowner_name TEXT,
    homeowner_phone TEXT,
    homeowner_email TEXT,
    property_address TEXT NOT NULL,
    city TEXT,
    state TEXT,
    zip TEXT,
    notes TEXT,
    photo_urls JSONB DEFAULT '[]',

    status TEXT NOT NULL DEFAULT 'received' CHECK (
        status IN (
            'received','contacted','inspection_scheduled','inspection_complete',
            'claim_filed','approved','roof_installed','closed','lost'
        )
    ),
    lost_reason TEXT,
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),

    -- Revenue
    contract_value NUMERIC(12,2) DEFAULT 0,
    job_id UUID,

    -- CRM sync
    external_crm TEXT,
    external_record_id TEXT,
    last_synced_at TIMESTAMPTZ,
    sync_error TEXT,

    -- SLA tracking
    sla_contact_by TIMESTAMPTZ,
    first_contacted_at TIMESTAMPTZ,

    -- Source tracking
    source TEXT DEFAULT 'partner_link' CHECK (source IN ('partner_link','manual','storm_alert','api')),
    storm_event_id UUID,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pe_referrals_user ON partner_engine_referrals(user_id);
CREATE INDEX IF NOT EXISTS idx_pe_referrals_partner ON partner_engine_referrals(partner_id);
CREATE INDEX IF NOT EXISTS idx_pe_referrals_status ON partner_engine_referrals(user_id, status);
CREATE INDEX IF NOT EXISTS idx_pe_referrals_created ON partner_engine_referrals(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pe_referrals_priority ON partner_engine_referrals(user_id, priority);

-- ============================================================================
-- REWARDS
-- ============================================================================
CREATE TABLE IF NOT EXISTS partner_engine_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    partner_id UUID REFERENCES partner_engine_partners(id) ON DELETE SET NULL,
    referral_id UUID NOT NULL REFERENCES partner_engine_referrals(id) ON DELETE CASCADE,

    amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    reward_type TEXT NOT NULL DEFAULT 'flat' CHECK (reward_type IN ('flat','percentage')),
    reward_rule TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','paid','cancelled')),
    approved_by TEXT,
    paid_at TIMESTAMPTZ,
    paid_method TEXT,
    payout_batch_id TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(referral_id)
);

CREATE INDEX IF NOT EXISTS idx_pe_rewards_user ON partner_engine_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_pe_rewards_partner ON partner_engine_rewards(partner_id);
CREATE INDEX IF NOT EXISTS idx_pe_rewards_status ON partner_engine_rewards(user_id, status);

-- ============================================================================
-- NOTIFICATIONS / ACTIVITY LOG
-- ============================================================================
CREATE TABLE IF NOT EXISTS partner_engine_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    partner_id UUID REFERENCES partner_engine_partners(id) ON DELETE CASCADE,
    referral_id UUID REFERENCES partner_engine_referrals(id) ON DELETE CASCADE,

    channel TEXT NOT NULL CHECK (channel IN ('email','sms','in_app')),
    event_type TEXT NOT NULL,
    subject TEXT,
    body TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
    sent_at TIMESTAMPTZ,
    error TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pe_notifications_user ON partner_engine_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_pe_notifications_partner ON partner_engine_notifications(partner_id);

-- ============================================================================
-- PARTNER ENGINE SETTINGS (per-company)
-- ============================================================================
CREATE TABLE IF NOT EXISTS partner_engine_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,

    company_slug TEXT NOT NULL UNIQUE,
    default_reward_type TEXT DEFAULT 'flat',
    default_reward_amount NUMERIC(12,2) DEFAULT 250,
    sla_contact_hours INTEGER DEFAULT 24,
    auto_reward_on_install BOOLEAN DEFAULT TRUE,
    notify_partners_on_storm BOOLEAN DEFAULT FALSE,
    jobnimbus_sync_stage TEXT DEFAULT 'received',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE partner_engine_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_engine_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_engine_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_engine_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_engine_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='partner_engine_partners' AND policyname='Partners are user scoped') THEN
        CREATE POLICY "Partners are user scoped" ON partner_engine_partners FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='partner_engine_referrals' AND policyname='Referrals are user scoped') THEN
        CREATE POLICY "Referrals are user scoped" ON partner_engine_referrals FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='partner_engine_rewards' AND policyname='Rewards are user scoped') THEN
        CREATE POLICY "Rewards are user scoped" ON partner_engine_rewards FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='partner_engine_notifications' AND policyname='Notifications are user scoped') THEN
        CREATE POLICY "Notifications are user scoped" ON partner_engine_notifications FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='partner_engine_settings' AND policyname='Settings are user scoped') THEN
        CREATE POLICY "Settings are user scoped" ON partner_engine_settings FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
    END IF;
END $$;
