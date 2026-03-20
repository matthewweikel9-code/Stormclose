# Production Launch Checklist — Vercel + Supabase

**Last updated:** March 2025  
**Scope:** Full production readiness for StormClose AI on Vercel + Supabase.

---

## Pre-Launch Verification

### 1. Billing & Subscription

- [ ] **Stripe Live Mode**
  - `STRIPE_SECRET_KEY` = `sk_live_*` (not test)
  - `STRIPE_WEBHOOK_SECRET` = live webhook secret from Stripe Dashboard
  - `STRIPE_PRICE_ID_PRO` and `STRIPE_PRICE_ID_ENTERPRISE` = live price IDs
- [ ] **Stripe Webhook**
  - Endpoint: `https://<your-domain>/api/stripe/webhook`
  - Events: `checkout.session.completed`, `customer.subscription.*`, `invoice.*`
  - Verify webhook signing in Stripe Dashboard
- [ ] **Subscription Flow**
  - Signup → Subscribe (Pro/Enterprise) → Success redirect
  - Webhook updates `users.subscription_status`, `subscription_tier`
  - Billing portal link works from Settings
- [ ] **Tier Gating**
  - Storm Ops (storm-map, knock-list, smart-route, opportunities) requires `lead_generator`
  - AI Image Engine, Neighborhood Engine require `lead_generator`
  - Xactimate, reports/generate-with-ai require `supplement_generator`
  - Objection handler, negotiation coach, carrier intelligence gated per tier

### 2. Webhooks & Cron Jobs

- [ ] **Public API Paths** (no user auth required)
  - `/api/stripe/webhook` — Stripe events
  - `/api/cron/*` — Vercel cron (sync-hail, generate-leads, storm-alerts)
  - `/api/hail-import` — Historical import (CRON_SECRET)
  - `/api/storm-alerts/monitor` — Alert monitor (CRON_SECRET or user)
  - `/api/debug-supabase` — Ops debug (ENABLE_DEBUG_ENDPOINTS + CRON_SECRET)
  - `/api/demo-request` — Demo form
  - `/api/partner-engine/public/*` — Referral capture
  - `/api/jobnimbus/webhook` — JobNimbus events
- [ ] **Vercel Cron**
  - `vercel.json` crons: sync-hail (6 AM UTC), generate-leads (7 AM UTC), storm-alerts (every 5 min)
  - `CRON_SECRET` set in Vercel env; cron requests use `Authorization: Bearer <CRON_SECRET>`
- [ ] **JobNimbus Webhook**
  - `JOBNIMBUS_WEBHOOK_URL` = `https://<your-domain>/api/jobnimbus/webhook`
  - `JOBNIMBUS_WEBHOOK_SECRET` configured in JobNimbus dashboard
  - `JOBNIMBUS_ENCRYPTION_KEY` = 32-char hex for API key encryption

### 3. Auth & Access Control

- [ ] **Supabase Auth**
  - Site URL = production domain
  - Redirect URLs include `https://<your-domain>/callback`
  - Email templates customized if needed
- [ ] **Role-Based Access**
  - PAGE_ROLE_RULES: missions, team, mission-control, ai-image-engine, documents, exports
  - API_ROLE_RULES: dashboard, storms, missions, team, ai, documents, exports
  - Forbidden redirect: `/dashboard?error=forbidden` (banner shown in DashboardShell)
- [ ] **Deprecated Routes**
  - `/dashboard/command-center`, `/dashboard/leads`, `/dashboard/route-planner` → redirect to `/dashboard/storm-map`

### 4. Environment Variables

- [ ] **Required** (from `.env.production.example`)
  - `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
  - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_PRO`, `STRIPE_PRICE_ID_ENTERPRISE`
  - `OPENAI_API_KEY`, `XWEATHER_CLIENT_ID`, `XWEATHER_CLIENT_SECRET`
  - `CORELOGIC_CONSUMER_KEY`, `CORELOGIC_CONSUMER_SECRET`
  - `GOOGLE_MAPS_API_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `GOOGLE_SOLAR_API_KEY`
  - `NEXT_PUBLIC_MAPBOX_TOKEN`, `CRON_SECRET`
- [ ] **Optional**
  - `JOBNIMBUS_WEBHOOK_SECRET`, `OPENAI_MODEL`, `STRIPE_APP_URL`
  - `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `DEMO_REQUEST_EMAIL`
  - `STORM_PROVIDER_ENCRYPTION_KEY`, `HAILTRACE_API_BASE_URL`
- [ ] **Production Safety**
  - `ENABLE_DEBUG_ENDPOINTS=false` (never `true` in production)

### 5. Database & Migrations

- [ ] **Migrations Applied**
  - Run `supabase db push` or apply all migrations in order (see README)
  - Key tables: `users`, `teams`, `team_members`, `leads`, `missions`, `mission_stops`, `hail_events`, `partner_engine_partners`, `partner_engine_referrals`, `demo_requests`, `xactimate_estimates`, `workflow_runs`
- [ ] **RLS Policies**
  - Verify RLS enabled on sensitive tables
  - Service role bypasses RLS for server-side operations

### 6. UX & Edge Cases

- [ ] **Loading States**
  - Dashboard: SkeletonDashboard while loading
  - Missions: LoadingState
  - Exports: LoadingState
- [ ] **Error States**
  - Dashboard: dataError with "Try again" button
  - Missions, Exports: ErrorState
- [ ] **Empty States**
  - Dashboard: EmptyState for no leads, no overdue follow-ups
  - Missions: EmptyState for no missions
- [ ] **Forbidden State**
  - Role-denied redirect shows banner: "Access denied" with Upgrade link
  - Subscription-gated pages redirect to `/settings/billing?upgrade=pro`

### 7. Legal & Marketing

- [ ] **Pages**
  - `/privacy`, `/terms`, `/security` — reviewed
  - `/pricing`, `/subscribe` — tier copy matches Stripe
- [ ] **Footer**
  - Legal links present and correct

### 8. Health & Ops

- [ ] **Health Endpoint**
  - `GET /api/health` — returns `status: "healthy"` when all required env vars set
  - With `Authorization: Bearer <CRON_SECRET>` — returns `missingRequiredEnvVars`, `missingOptionalEnvVars`
- [ ] **Debug Endpoint** (optional, ops only)
  - `GET /api/debug-supabase` — requires `ENABLE_DEBUG_ENDPOINTS=true` and `CRON_SECRET`
  - Use for quick DB connectivity check; disable in production

---

## Post-Launch Smoke Tests

1. **Auth**: Sign up, log in, log out
2. **Billing**: Subscribe (Pro), verify webhook, access gated feature
3. **Storm Ops**: Open storm-map, load knock-list, view opportunities
4. **AI**: Generate briefing, use objection handler
5. **JobNimbus**: Connect, sync, export lead
6. **Referral**: Submit referral via partner link
7. **Demo**: Submit demo request form
8. **Cron**: Trigger one cron manually with CRON_SECRET; verify no 401

---

## Rollback

- Revert Vercel deployment to previous
- Stripe webhook: disable or update URL if needed
- Supabase: migrations are additive; no automatic rollback

---

## Files Reference (Production Sweep)

| Area | Files |
|------|-------|
| Billing gating | `src/lib/subscriptions/access.ts`, `src/app/api/ai/briefing/route.ts`, `src/app/api/workflows/appointment-set/route.ts`, `src/app/api/reports/generate-with-ai/route.ts`, `src/app/api/xactimate/*`, `src/app/api/knock-list/properties/route.ts`, `src/app/api/opportunities/route.ts`, `src/app/(dashboard)/dashboard/(storm-ops)/layout.tsx` |
| Webhooks/crons | `src/lib/auth/access-control.ts` (PUBLIC_API_PREFIXES), `vercel.json` |
| Routing | `src/lib/auth/access-control.ts` (PAGE_ROLE_RULES), `middleware.ts`, `src/app/(dashboard)/dashboard/missions/page.tsx`, `missions-hub.tsx` (ai-studio → ai-image-engine) |
| Ops | `.env.production.example`, `src/app/api/health/route.ts` |
| UX | `src/components/dashboard/DashboardShell.tsx`, `src/components/ui/state-feedback.tsx` (ForbiddenState) |
