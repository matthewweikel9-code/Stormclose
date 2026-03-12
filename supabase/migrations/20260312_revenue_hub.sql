-- ============================================================================
-- REVENUE HUB UPGRADE - NEW TABLES
-- ============================================================================

-- ============================================================================
-- USER GOALS TABLE
-- Personal revenue/activity targets per month
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Revenue Goals
    monthly_revenue_goal DECIMAL(12, 2) DEFAULT 25000,
    commission_rate DECIMAL(5, 4) DEFAULT 0.10,  -- e.g. 0.10 = 10%
    
    -- Activity Goals
    daily_door_knock_goal INTEGER DEFAULT 30,
    daily_call_goal INTEGER DEFAULT 20,
    weekly_appointment_goal INTEGER DEFAULT 10,
    monthly_deal_goal INTEGER DEFAULT 4,
    
    -- Preferences
    preferred_canvas_start TIME DEFAULT '09:00',
    preferred_canvas_end TIME DEFAULT '17:00',
    
    -- Metadata
    month DATE NOT NULL DEFAULT date_trunc('month', NOW())::date,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, month)
);

CREATE INDEX IF NOT EXISTS user_goals_user_month_idx ON user_goals(user_id, month DESC);

-- ============================================================================
-- REVENUE SNAPSHOTS TABLE
-- Daily pipeline/revenue snapshots for trend charting
-- ============================================================================
CREATE TABLE IF NOT EXISTS revenue_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Snapshot Date
    snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Revenue Metrics
    pipeline_value DECIMAL(12, 2) DEFAULT 0,
    closed_value DECIMAL(12, 2) DEFAULT 0,
    total_leads INTEGER DEFAULT 0,
    hot_leads INTEGER DEFAULT 0,
    appointments_set INTEGER DEFAULT 0,
    deals_closed INTEGER DEFAULT 0,
    close_rate DECIMAL(5, 2) DEFAULT 0,
    avg_deal_size DECIMAL(12, 2) DEFAULT 0,
    
    -- Activity Metrics  
    door_knocks INTEGER DEFAULT 0,
    phone_calls INTEGER DEFAULT 0,
    inspections INTEGER DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS revenue_snapshots_user_date_idx ON revenue_snapshots(user_id, snapshot_date DESC);

-- ============================================================================
-- FUNCTION: Get user's conversion funnel
-- ============================================================================
CREATE OR REPLACE FUNCTION get_conversion_funnel(p_user_id UUID, p_days_back INTEGER DEFAULT 30)
RETURNS TABLE (
    stage TEXT,
    lead_count BIGINT,
    stage_value DECIMAL,
    conversion_rate DECIMAL
) AS $$
DECLARE
    total_leads BIGINT;
BEGIN
    -- Get total leads in period
    SELECT COUNT(*) INTO total_leads
    FROM leads 
    WHERE user_id = p_user_id 
    AND created_at >= NOW() - (p_days_back || ' days')::INTERVAL;
    
    IF total_leads = 0 THEN total_leads := 1; END IF;
    
    RETURN QUERY
    WITH funnel AS (
        SELECT 
            l.status,
            COUNT(*) as cnt,
            COALESCE(SUM(l.estimated_claim), 0) as total_value
        FROM leads l
        WHERE l.user_id = p_user_id
        GROUP BY l.status
    ),
    ordered_funnel AS (
        SELECT 
            f.status,
            f.cnt,
            f.total_value,
            CASE f.status
                WHEN 'new' THEN 1
                WHEN 'contacted' THEN 2
                WHEN 'appointment_set' THEN 3
                WHEN 'inspected' THEN 4
                WHEN 'signed' THEN 5
                WHEN 'closed' THEN 6
                WHEN 'lost' THEN 7
            END as sort_order
        FROM funnel f
    )
    SELECT 
        of.status::TEXT as stage,
        of.cnt as lead_count,
        of.total_value as stage_value,
        ROUND((of.cnt::DECIMAL / total_leads) * 100, 1) as conversion_rate
    FROM ordered_funnel of
    WHERE of.sort_order <= 6
    ORDER BY of.sort_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION: Snapshot daily revenue (call via cron)
-- ============================================================================
CREATE OR REPLACE FUNCTION snapshot_daily_revenue(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    v_pipeline DECIMAL;
    v_closed DECIMAL;
    v_total_leads INTEGER;
    v_hot_leads INTEGER;
    v_appointments INTEGER;
    v_deals_closed INTEGER;
    v_close_rate DECIMAL;
    v_avg_deal DECIMAL;
    v_knocks INTEGER;
    v_calls INTEGER;
    v_inspections_count INTEGER;
    v_month_start DATE;
BEGIN
    v_month_start := date_trunc('month', NOW())::date;
    
    -- Pipeline value (non-closed, non-lost)
    SELECT COALESCE(SUM(estimated_claim), 0) INTO v_pipeline
    FROM leads WHERE user_id = p_user_id AND status NOT IN ('closed', 'lost');
    
    -- Closed value this month
    SELECT COALESCE(SUM(estimated_claim), 0), COUNT(*) 
    INTO v_closed, v_deals_closed
    FROM leads WHERE user_id = p_user_id AND status = 'closed' 
    AND status_changed_at >= v_month_start;
    
    -- Total leads
    SELECT COUNT(*) INTO v_total_leads FROM leads WHERE user_id = p_user_id;
    
    -- Hot leads
    SELECT COUNT(*) INTO v_hot_leads FROM leads 
    WHERE user_id = p_user_id AND lead_score >= 70 AND status NOT IN ('closed', 'lost');
    
    -- Appointments this month
    SELECT COUNT(*) INTO v_appointments FROM activities 
    WHERE user_id = p_user_id AND activity_type = 'appointment_set' 
    AND created_at >= v_month_start;
    
    -- Close rate
    SELECT CASE WHEN COUNT(*) > 0 
        THEN ROUND((SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END)::DECIMAL / COUNT(*)) * 100, 1)
        ELSE 0 END
    INTO v_close_rate
    FROM leads WHERE user_id = p_user_id AND status NOT IN ('new');
    
    -- Avg deal size
    SELECT COALESCE(AVG(estimated_claim), 0) INTO v_avg_deal
    FROM leads WHERE user_id = p_user_id AND status = 'closed';
    
    -- Activity counts today
    SELECT COUNT(*) INTO v_knocks FROM activities 
    WHERE user_id = p_user_id AND activity_type = 'door_knock' AND created_at >= CURRENT_DATE;
    
    SELECT COUNT(*) INTO v_calls FROM activities 
    WHERE user_id = p_user_id AND activity_type = 'phone_call' AND created_at >= CURRENT_DATE;
    
    SELECT COUNT(*) INTO v_inspections_count FROM activities 
    WHERE user_id = p_user_id AND activity_type = 'inspection' AND created_at >= CURRENT_DATE;
    
    -- Upsert snapshot
    INSERT INTO revenue_snapshots (user_id, snapshot_date, pipeline_value, closed_value, total_leads, hot_leads, appointments_set, deals_closed, close_rate, avg_deal_size, door_knocks, phone_calls, inspections)
    VALUES (p_user_id, CURRENT_DATE, v_pipeline, v_closed, v_total_leads, v_hot_leads, v_appointments, v_deals_closed, v_close_rate, v_avg_deal, v_knocks, v_calls, v_inspections_count)
    ON CONFLICT (user_id, snapshot_date) DO UPDATE SET
        pipeline_value = EXCLUDED.pipeline_value,
        closed_value = EXCLUDED.closed_value,
        total_leads = EXCLUDED.total_leads,
        hot_leads = EXCLUDED.hot_leads,
        appointments_set = EXCLUDED.appointments_set,
        deals_closed = EXCLUDED.deals_closed,
        close_rate = EXCLUDED.close_rate,
        avg_deal_size = EXCLUDED.avg_deal_size,
        door_knocks = EXCLUDED.door_knocks,
        phone_calls = EXCLUDED.phone_calls,
        inspections = EXCLUDED.inspections;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- RLS Policies
-- ============================================================================
ALTER TABLE user_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own goals" ON user_goals
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own snapshots" ON revenue_snapshots
    FOR ALL USING (auth.uid() = user_id);
