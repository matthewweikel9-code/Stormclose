-- Migration: Add subscription tiers, trial support, and roof_photos table
-- Run this migration on your Supabase project

-- 1. Update users table with new tier fields
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS subscription_tier text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS trial_end timestamptz,
  ADD COLUMN IF NOT EXISTS reports_this_month integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reports_reset_at timestamptz NOT NULL DEFAULT now();

-- Add constraint for subscription_tier values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_subscription_tier_check'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_subscription_tier_check
      CHECK (subscription_tier IN ('free', 'pro', 'pro_plus', 'trial'));
  END IF;
END $$;

-- Create index for faster tier lookups
CREATE INDEX IF NOT EXISTS users_subscription_tier_idx ON public.users (subscription_tier);

-- 2. Create roof_photos table for photo analysis feature
CREATE TABLE IF NOT EXISTS public.roof_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_id uuid REFERENCES public.reports(id) ON DELETE SET NULL,
  photo_url text NOT NULL,
  storage_path text NOT NULL,
  analysis jsonb,
  damage_types text[] DEFAULT '{}',
  confidence_score numeric(3,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on roof_photos
ALTER TABLE public.roof_photos ENABLE ROW LEVEL SECURITY;

-- RLS policies for roof_photos
DROP POLICY IF EXISTS "Users can view own photos" ON public.roof_photos;
CREATE POLICY "Users can view own photos"
  ON public.roof_photos
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own photos" ON public.roof_photos;
CREATE POLICY "Users can insert own photos"
  ON public.roof_photos
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own photos" ON public.roof_photos;
CREATE POLICY "Users can update own photos"
  ON public.roof_photos
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own photos" ON public.roof_photos;
CREATE POLICY "Users can delete own photos"
  ON public.roof_photos
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create indexes for roof_photos
CREATE INDEX IF NOT EXISTS roof_photos_user_id_idx ON public.roof_photos (user_id);
CREATE INDEX IF NOT EXISTS roof_photos_report_id_idx ON public.roof_photos (report_id);

-- 3. Create email_drafts table for storing generated emails
CREATE TABLE IF NOT EXISTS public.email_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_id uuid REFERENCES public.reports(id) ON DELETE SET NULL,
  subject text NOT NULL,
  body text NOT NULL,
  recipient_type text DEFAULT 'adjuster',
  template_type text DEFAULT 'standard',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on email_drafts
ALTER TABLE public.email_drafts ENABLE ROW LEVEL SECURITY;

-- RLS policies for email_drafts
DROP POLICY IF EXISTS "Users can view own emails" ON public.email_drafts;
CREATE POLICY "Users can view own emails"
  ON public.email_drafts
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own emails" ON public.email_drafts;
CREATE POLICY "Users can insert own emails"
  ON public.email_drafts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own emails" ON public.email_drafts;
CREATE POLICY "Users can update own emails"
  ON public.email_drafts
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own emails" ON public.email_drafts;
CREATE POLICY "Users can delete own emails"
  ON public.email_drafts
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create indexes for email_drafts
CREATE INDEX IF NOT EXISTS email_drafts_user_id_idx ON public.email_drafts (user_id);
CREATE INDEX IF NOT EXISTS email_drafts_report_id_idx ON public.email_drafts (report_id);

-- 4. Add photo_analysis_id to reports for linking
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS csv_source text,
  ADD COLUMN IF NOT EXISTS photo_analysis_summary jsonb;

-- 5. Create storage bucket for roof photos (run separately in Supabase dashboard or via API)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('roof-photos', 'roof-photos', false);

-- 6. Function to reset monthly report counts
CREATE OR REPLACE FUNCTION reset_monthly_reports()
RETURNS void AS $$
BEGIN
  UPDATE public.users
  SET 
    reports_this_month = 0,
    reports_reset_at = now()
  WHERE reports_reset_at < now() - interval '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
