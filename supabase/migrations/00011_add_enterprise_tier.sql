-- Migration: Add enterprise tier to subscription_tier constraint
-- Run this migration on your Supabase project

-- Drop the existing constraint
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_subscription_tier_check;

-- Add the updated constraint with enterprise tier
ALTER TABLE public.users
  ADD CONSTRAINT users_subscription_tier_check
  CHECK (subscription_tier IN ('free', 'pro', 'pro_plus', 'enterprise', 'trial'));

-- Update any users who should be enterprise (optional - run manually if needed)
-- UPDATE public.users SET subscription_tier = 'enterprise' WHERE id = 'your-user-id';
