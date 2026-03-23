# Production Readiness Audit — StormClose AI

**Audit date:** March 2025  
**Last updated:** March 2026  
**Status:** P0 blockers addressed; production launch ready with checklist.

---

## ✅ Completed (This Session)

### Critical — Blocking Production
1. **Public API paths** — Added `/api/demo-request`, `/api/partner-engine/public/`, `/api/jobnimbus/webhook` to `PUBLIC_API_PREFIXES` in `src/lib/auth/access-control.ts`. Demo requests, referral forms, and JobNimbus webhooks now work without auth.

2. **Legal pages** — Created `/privacy`, `/terms`, `/security` with content covering data collection, usage, security practices, and contact info. Footer links updated in `src/components/landing/Footer.tsx`.

### Important — Before Launch
3. **Env vars** — Added to `.env.example` and `.env.production.example`:
   - `JOBNIMBUS_ENCRYPTION_KEY`, `JOBNIMBUS_WEBHOOK_URL`
   - `STORM_PROVIDER_ENCRYPTION_KEY`, `HAILTRACE_API_BASE_URL`
   - `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `DEMO_REQUEST_EMAIL`
   - `DEV_AUTO_CONFIRM_SIGNUPS`, `ENABLE_DEBUG_ENDPOINTS`

4. **README** — Updated migration list (27 migrations), removed hardcoded path, added new env vars to setup steps, added production checklist items.

5. **Dashboard error state** — Added `dataError` state and retry UI when revenue hub fetch fails. Users see a clear message and "Try again" button instead of a blank screen.

---

## Pre-Deploy Checklist

Before going live, verify:

- [ ] All env vars from `.env.example` set in Vercel
- [ ] `JOBNIMBUS_ENCRYPTION_KEY` is 32+ char hex (for JobNimbus connect)
- [ ] `STORM_PROVIDER_ENCRYPTION_KEY` set if using HailTrace/HailRecon
- [ ] Stripe webhook URL points to production
- [ ] JobNimbus webhook URL configured in JobNimbus dashboard
- [ ] Supabase Auth redirect URLs include production domain
- [ ] Resend domain verified for `RESEND_FROM_EMAIL`
- [ ] Legal pages reviewed by counsel (privacy, terms, security)

---

## March 2026 — Additional Hardening

### Completed
- **Content-Security-Policy** — Added CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy headers in `next.config.js`.
- **Rate limiting** — AI endpoints: 60/hour per user; export-lead: 50/hour per user. Supabase-backed `rate_limit_log` table.
- **Page-level role guards** — Forbidden redirect (`/dashboard?error=forbidden`) now shows inline message: "You don't have access to that page."
- **Zod validation** — `POST /api/integrations/jobnimbus/export-lead` validates `leadId` (UUID) and optional fields.
- **ai_sessions migration** — Table for AI audit trail: `module_id`, `user_id`, `model`, `token_count`, `latency_ms`, `input_hash`, `output_hash`.

### Files Changed
- `next.config.js` — Security headers
- `middleware.ts` — AI rate limit check
- `src/lib/rate-limit.ts` — New
- `src/app/api/integrations/jobnimbus/export-lead/route.ts` — Rate limit, Zod
- `src/app/(dashboard)/dashboard/page.tsx` — Forbidden error handling
- `src/app/(dashboard)/dashboard/dashboard-content.tsx` — Forbidden banner
- `supabase/migrations/202603320100_rate_limit.sql` — New
- `supabase/migrations/202603320200_ai_sessions.sql` — New

---

## Remaining Nice-to-Haves

| Item | Priority | Notes |
|------|----------|-------|
| Cookie consent banner | Medium | For GDPR; document in privacy policy |
| API documentation | Low | OpenAPI/Swagger for internal/external APIs |
| Runbook | Low | Incident response, common ops procedures |
| Health endpoint sensitivity | Low | Restrict config exposure when `CRON_SECRET` present |
| Loading/empty states | Medium | Audit remaining dashboard pages per `ENTERPRISE_HARDENING_CHECKLIST.md` |
| Staleness indicators | Low | "Updated N min ago" on dashboards |

---

## Files Changed

- `src/lib/auth/access-control.ts` — Public API prefixes
- `src/components/landing/Footer.tsx` — Legal links
- `src/app/privacy/page.tsx` — New
- `src/app/terms/page.tsx` — New
- `src/app/security/page.tsx` — New
- `.env.example` — New vars
- `.env.production.example` — New vars
- `README.md` — Migrations, env list, checklist
- `src/app/(dashboard)/dashboard/dashboard-content.tsx` — Error state + retry
