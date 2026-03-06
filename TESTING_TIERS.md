# StormClose SaaS Tier System - Testing Instructions

## Overview

This document covers the testing steps for the new tiered subscription system with Free, Pro, and Pro+ plans.

---

## 1. Database Migration

Before testing, run the migration to add the new columns:

```bash
# Run locally against your Supabase instance
npx supabase db push
```

Or apply the migration file manually:
- `supabase/migrations/00009_add_subscription_tiers.sql`

This migration:
- Adds `subscription_tier` column to users (default: 'free')
- Adds `trial_end` column for trial tracking
- Adds `reports_this_month` and `reports_reset_at` for free tier limits
- Creates `roof_photos` table for photo analysis
- Creates `increment_report_count` function

---

## 2. Environment Variables

Add these new environment variables to your `.env.local`:

```env
# Existing Stripe config
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Tier-specific prices (create these in Stripe Dashboard)
STRIPE_PRICE_ID_PRO=price_...        # $49/month Pro plan
STRIPE_PRICE_ID_PRO_PLUS=price_...   # $99/month Pro+ plan

# Backward compatibility (use Pro price if not set)
STRIPE_PRICE_ID_MONTHLY=price_...
```

---

## 3. Testing Subscription Tiers

### Free Tier Test
1. Sign up as a new user
2. Verify you're on "Free" plan in sidebar and billing page
3. Generate a report - should work (1 of 2)
4. Generate another report - should work (2 of 2)
5. Try to generate a third report - should see limit message
6. Verify "Follow-ups" and "Objection Responses" show lock icons in sidebar

### Trial Test
1. Go to `/settings/billing`
2. Click "Upgrade to Pro" or "Get Pro+"
3. Complete Stripe Checkout (use test card: 4242 4242 4242 4242)
4. Verify 7-day trial starts
5. Check sidebar shows trial countdown
6. All Pro features should be unlocked

### Pro Tier Test
1. After trial or with active Pro subscription
2. Verify "Pro" badge in sidebar and TopNav
3. Test unlimited reports (no limit)
4. Test CSV upload at `/dashboard/report` (should work)
5. Test Follow-ups page (should work)
6. Verify "Objection Responses" still shows Pro+ badge (locked)

### Pro+ Tier Test
1. Subscribe to Pro+ plan
2. Verify "Pro+" badge with gold styling
3. Test all Pro features plus:
   - Objection Responses page (should work)
   - Photo Analysis (if implemented in UI)
4. Verify "Pro+ Member" message in sidebar bottom section

---

## 4. Testing Individual Features

### CSV Upload (Pro/Pro+ only)
```bash
# Test endpoint directly
curl -X POST https://www.stormclose.com/api/csv/upload \
  -H "Cookie: <session_cookie>" \
  -F "file=@test.csv"
```

Expected response for free user:
```json
{
  "error": "This feature requires Pro or higher. Upgrade at /settings/billing"
}
```

### Photo Analysis (Pro+ only)
```bash
curl -X POST https://www.stormclose.com/api/photos/analyze \
  -H "Cookie: <session_cookie>" \
  -F "photo=@roof.jpg"
```

Expected response for Pro user:
```json
{
  "error": "This feature requires Pro+ subscription. Upgrade at /settings/billing"
}
```

### Objection Handling (Pro+ only)
Try accessing `/dashboard/objection` with different tiers:
- Free: Should show locked/upgrade message
- Pro: Should show locked/upgrade message
- Pro+: Should work fully

---

## 5. Webhook Testing

### Local Testing with Stripe CLI
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Trigger test events
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
```

### Verify Webhook Flow
1. Complete a checkout
2. Check Supabase `users` table:
   - `subscription_tier` should be 'pro' or 'pro_plus'
   - `subscription_status` should be 'active' or 'trialing'
   - `trial_end` should be set for trial subscriptions

### Production Webhook URL
Ensure Stripe webhook is configured to:
```
https://www.stormclose.com/api/stripe/webhook
```
**Important:** Must use `www.` to avoid 307 redirects!

---

## 6. Billing Page Testing

Navigate to `/settings/billing` and verify:

1. **Current Plan Card**
   - Shows correct tier badge
   - Shows trial countdown if applicable
   - Shows reports used / limit for free tier
   - "Manage Subscription" button (for paying customers)

2. **Upgrade Options**
   - Pro plan card with features and price
   - Pro+ plan card with features and price
   - Buttons trigger Stripe Checkout

3. **Stripe Portal**
   - Click "Manage Subscription"
   - Should open Stripe Customer Portal
   - Can cancel, update payment method, view invoices

---

## 7. UI Component Testing

### Sidebar
- [ ] Shows current tier badge below logo
- [ ] Trial countdown appears when applicable
- [ ] Reports remaining for free tier
- [ ] Locked menu items show tier badges (Pro, Pro+)
- [ ] Bottom section shows upgrade CTA or "Pro+ Member"

### TopNav
- [ ] Tier badge shows with correct styling
- [ ] Trial countdown visible
- [ ] Upgrade button for non-Pro+ users

---

## 8. Test Stripe Price Setup

In Stripe Dashboard, create:

1. **Pro Plan** ($49/month)
   - Product name: "StormClose Pro"
   - Recurring: Monthly
   - Copy price ID to `STRIPE_PRICE_ID_PRO`

2. **Pro+ Plan** ($99/month)
   - Product name: "StormClose Pro+"
   - Recurring: Monthly
   - Copy price ID to `STRIPE_PRICE_ID_PRO_PLUS`

---

## 9. Common Issues

### "Feature requires Pro" when user has Pro
- Check `subscription_tier` in users table
- Verify webhook is updating correctly
- Check trial hasn't expired

### Webhook failing
- Ensure URL uses `www.stormclose.com`
- Check webhook secret matches
- Review Stripe webhook logs

### Reports not tracking
- Check `reports_this_month` column exists
- Verify `increment_report_count` function is created
- Check `reports_reset_at` for monthly reset logic

---

## 10. Production Checklist

- [ ] Migration applied to production Supabase
- [ ] Environment variables set in Vercel/hosting
- [ ] Stripe products created for Pro and Pro+
- [ ] Price IDs added to environment
- [ ] Webhook URL set to www.stormclose.com
- [ ] Test complete checkout flow
- [ ] Test tier access restrictions
- [ ] Test billing page management
