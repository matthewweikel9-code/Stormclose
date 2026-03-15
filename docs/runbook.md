# Production Runbook — Stormclose

> **Last updated:** 2026-03-14  
> **Branch:** `rewrite/mvp-backend`  
> **Hosting:** Vercel (Next.js) + Supabase (Postgres + Auth + Storage)

---

## Table of Contents

1. [Top 5 Failure Modes & Recovery](#1-top-5-failure-modes--recovery)
2. [Backup & Restore](#2-backup--restore)
3. [CoreLogic Outage Handling](#3-corelogic-outage-handling)
4. [Google Directions API Outage Handling](#4-google-directions-api-outage-handling)
5. [Feature Flag Management](#5-feature-flag-management)
6. [Contact List & Escalation](#6-contact-list--escalation)

---

## 1. Top 5 Failure Modes & Recovery

### 1.1 Supabase Database Unreachable

**Symptoms:** All API routes return 500. Logs show `ECONNREFUSED` or `connection terminated unexpectedly` from `@supabase/supabase-js`.

**Impact:** Total outage — auth, leads, missions, revenue hub all down.

**Recovery:**
1. Check [Supabase Status](https://status.supabase.com/) for platform-wide incidents.
2. Open the Supabase Dashboard → **Database** → **Health**. Look for connection pool exhaustion.
3. If pool exhaustion:
   - Navigate to **Settings → Database → Connection Pooling**.
   - Increase `Pool Size` or switch to `transaction` mode temporarily.
   - Restart pooler: click **Restart** on the database settings page.
4. If Supabase-side outage, engage Supabase support via their dashboard chat and post in `#incidents` Slack.
5. If a bad migration caused the issue:
   ```bash
   # Roll back the last migration (adjust filename)
   supabase db reset --linked
   # Or apply a targeted revert migration
   supabase migration new revert_bad_migration
   ```
6. Verify recovery: `curl -s https://<app>.vercel.app/api/health | jq .`

---

### 1.2 Vercel Deployment Crash / 502s

**Symptoms:** Users see 502/504. Vercel function logs show `FUNCTION_INVOCATION_TIMEOUT` or `EDGE_FUNCTION_CRASHED`.

**Impact:** All web traffic affected. Cron jobs fail.

**Recovery:**
1. Open [Vercel Dashboard](https://vercel.com/) → project → **Deployments**.
2. Identify the failing deployment. Click **Instant Rollback** on the last known-good deployment.
3. Check **Runtime Logs** for the error. Common causes:
   - Missing env var after config change → verify in **Settings → Environment Variables**.
   - Memory exhaustion on a route → check if a route loads unbounded data (add `LIMIT`).
   - Cold start timeout → split heavy logic into background API routes.
4. If a recent commit caused the crash, revert on the branch:
   ```bash
   git revert HEAD
   git push origin rewrite/mvp-backend
   ```
5. Verify crons resumed: check `vercel.json` crons in the Vercel dashboard → **Crons** tab.

---

### 1.3 Cron Job Failures (Storm Alerts / Lead Generation / Rescore)

**Symptoms:** No new storm alerts, leads stop appearing, scores go stale. Vercel cron logs show errors.

**Impact:** Stale data. Users miss storm opportunities.

**Recovery:**
1. Check Vercel → **Crons** tab for execution history and error logs.
2. Verify `CRON_SECRET` env var matches the `Authorization: Bearer <secret>` header sent by Vercel.
3. For NWS API failures (`/api/cron/storm-alerts`):
   - Check [NWS API Status](https://api.weather.gov/) — their rate limit is generous but outages happen.
   - Manual trigger: `curl -H "Authorization: Bearer $CRON_SECRET" https://<app>.vercel.app/api/cron/storm-alerts`
4. For lead generation failures (`/api/cron/generate-leads`):
   - Usually caused by CoreLogic API issues — see [Section 3](#3-corelogic-outage-handling).
   - Manual trigger: `curl -H "Authorization: Bearer $CRON_SECRET" https://<app>.vercel.app/api/cron/generate-leads`
5. For rescore failures (`/api/cron/rescore-leads`):
   - Check if the `leads` table is accessible and has rows.
   - Manual trigger: `curl -H "Authorization: Bearer $CRON_SECRET" https://<app>.vercel.app/api/cron/rescore-leads`
6. Add to `vercel.json` if a new cron is missing:
   ```json
   { "path": "/api/cron/rescore-leads", "schedule": "0 8 * * *" }
   ```

---

### 1.4 Auth / Session Failures

**Symptoms:** Users get 401 on previously-working routes. Login succeeds but redirects loop.

**Impact:** All authenticated features inaccessible.

**Recovery:**
1. Verify Supabase Auth is healthy: Supabase Dashboard → **Authentication** → check for errors.
2. Check env vars are set:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. If cookies are malformed (common after domain changes):
   - Clear `sb-*` cookies in the browser.
   - Verify `middleware.ts` cookie handling matches the Supabase SSR package version.
4. If the service role key was rotated in Supabase:
   - Copy the new key from Supabase → **Settings → API**.
   - Update in Vercel → **Settings → Environment Variables** → redeploy.
5. Validate: `curl -s https://<app>.vercel.app/api/auth/session | jq .`

---

### 1.5 Mission Stats Materialized View Stale

**Symptoms:** `/api/missions` returns outdated aggregate stats (totals don't match stop-level data).

**Impact:** Dashboard KPIs are lagging. Not a hard outage.

**Recovery:**
1. Manually refresh the materialized view:
   ```sql
   -- Via Supabase SQL Editor or psql
   SELECT refresh_mission_stats_daily_mv(true);  -- concurrent refresh
   ```
2. If concurrent refresh fails (first-ever run or missing unique index):
   ```sql
   SELECT refresh_mission_stats_daily_mv(false);  -- full refresh
   ```
3. Set up a Vercel cron to keep it fresh (recommended every 15 minutes):
   ```json
   { "path": "/api/cron/refresh-mission-stats", "schedule": "*/15 * * * *" }
   ```
4. Verify: call `GET /api/missions?days=30` and compare `stats.totalMissions` to the mission list count.

---

## 2. Backup & Restore

### 2.1 Supabase Managed Backups

Supabase Pro plans include **daily automated backups** with 7-day retention (30 days on Team/Enterprise).

**To restore from a Supabase backup:**
1. Go to Supabase Dashboard → **Database** → **Backups**.
2. Select the desired point-in-time and click **Restore**.
3. ⚠️ This replaces the entire database — coordinate with the team first.

### 2.2 Manual Backup (pg_dump)

```bash
# Set your Supabase connection string
export DATABASE_URL="postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres"

# Full schema + data backup
pg_dump "$DATABASE_URL" \
  --no-owner \
  --no-acl \
  --format=custom \
  --file="backup_$(date +%Y%m%d_%H%M%S).dump"

# Schema-only backup
pg_dump "$DATABASE_URL" \
  --schema-only \
  --no-owner \
  --file="schema_$(date +%Y%m%d).sql"
```

### 2.3 Restore from Manual Backup

```bash
# Restore to a fresh Supabase project or local DB
pg_restore \
  --dbname="$DATABASE_URL" \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists \
  "backup_20260314_120000.dump"
```

### 2.4 Table-Level Export (Emergency)

```bash
# Export a single critical table
psql "$DATABASE_URL" -c "\COPY leads TO 'leads_export.csv' WITH CSV HEADER"
psql "$DATABASE_URL" -c "\COPY canvass_missions TO 'missions_export.csv' WITH CSV HEADER"
```

---

## 3. CoreLogic Outage Handling

The `corelogicCachedClient` (`src/integrations/corelogicCachedClient.ts`) implements a 3-tier fallback:

| Priority | Source | Condition |
|---|---|---|
| 1 | **CoreLogic API** | Cache miss or stale (>24h) |
| 2 | **parcel_cache table** | API fails or 429 rate-limited |
| 3 | **Synthetic fallback** | No cache + API down |

### During a CoreLogic Outage

**Symptoms:** `corelogic_cache_miss` metric spikes, logs show `CoreLogicError` with 5xx or timeout.

**Immediate mitigation — force cache-only mode:**

```bash
# Set env var in Vercel (takes effect on next cold start)
vercel env add CORELOGIC_USE_FALLBACK true production

# Or in Supabase Edge Functions
# CORELOGIC_USE_FALLBACK=true
```

This skips all API calls and serves from `parcel_cache` + synthetic fallback.

**Recovery:**

1. Monitor CoreLogic status / contact your CoreLogic account rep.
2. Once CoreLogic is back, remove the override:
   ```bash
   vercel env rm CORELOGIC_USE_FALLBACK production
   ```
3. Trigger a cache warm-up by running the lead generation cron:
   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" https://<app>.vercel.app/api/cron/generate-leads
   ```
4. Verify cache freshness:
   ```sql
   SELECT COUNT(*), MAX(last_seen), MIN(last_seen)
   FROM parcel_cache
   WHERE last_seen > NOW() - INTERVAL '24 hours';
   ```

---

## 4. Google Directions API Outage Handling

The `RouteService` (`src/services/routeService.ts`) has an automatic fallback:

| Priority | Provider | Details |
|---|---|---|
| 1 | **GoogleRouteProvider** | Google Directions API (up to 25 waypoints) |
| 2 | **LocalTspProvider** | Nearest-neighbor + 2-opt solver (unlimited stops, no network) |

### During a Google API Outage

**Symptoms:** `route_provider_fallbacks` metric fires with `reason: "google_primary"`. Route optimization still works but uses the local solver.

**This is self-healing** — no manual action required. The local TSP provider runs in-process with O(n²) complexity.

**If you want to force local-only (e.g., to save API costs):**
```bash
# Remove the API key — RouteService will skip Google and use local
vercel env rm GOOGLE_DIRECTIONS_API_KEY production
```

**To re-enable Google after recovery:**
```bash
vercel env add GOOGLE_DIRECTIONS_API_KEY <your-key> production
```

**Verify provider usage:**
```sql
-- Check recent route_provider_fallbacks in structured logs
-- Or via Prometheus:
-- sum(rate(route_provider_fallbacks_total[1h])) by (reason)
```

---

## 5. Feature Flag Management

Feature flags resolve in this order:
1. **Environment variable** `FEATURE_FLAG_<KEY>` (highest priority)
2. **Per-user DB row** in `feature_flags` table
3. **Global DB row** (where `user_id IS NULL`)
4. **`false`** (default)

### 5.1 Toggle via Environment Variable (Fastest)

```bash
# Enable for all users immediately (next cold start)
vercel env add FEATURE_FLAG_MISSION_V2 true production

# Disable
vercel env add FEATURE_FLAG_MISSION_V2 false production

# Remove override (fall back to DB rows)
vercel env rm FEATURE_FLAG_MISSION_V2 production
```

### 5.2 Toggle via Admin API

Requires the caller's user ID or email to be in `FEATURE_FLAG_ADMIN_USER_IDS` or `FEATURE_FLAG_ADMIN_EMAILS`.

```bash
# Enable globally
curl -X POST https://<app>.vercel.app/api/admin/feature-flags \
  -H "Content-Type: application/json" \
  -H "Cookie: <auth-cookies>" \
  -d '{"key": "mission_v2", "enabled": true}'

# Enable for a specific user
curl -X POST https://<app>.vercel.app/api/admin/feature-flags \
  -H "Content-Type: application/json" \
  -H "Cookie: <auth-cookies>" \
  -d '{"key": "mission_v2", "enabled": true, "userId": "<target-user-uuid>"}'

# Disable globally
curl -X POST https://<app>.vercel.app/api/admin/feature-flags \
  -H "Content-Type: application/json" \
  -H "Cookie: <auth-cookies>" \
  -d '{"key": "mission_v2", "enabled": false}'
```

### 5.3 Toggle via SQL (Emergency)

```sql
-- Enable globally
INSERT INTO feature_flags (key, enabled)
VALUES ('mission_v2', true)
ON CONFLICT (key) WHERE user_id IS NULL
DO UPDATE SET enabled = true;

-- Disable globally
UPDATE feature_flags SET enabled = false
WHERE key = 'mission_v2' AND user_id IS NULL;

-- Check current state
SELECT key, user_id, enabled, created_at
FROM feature_flags
WHERE key = 'mission_v2'
ORDER BY user_id NULLS LAST;
```

### 5.4 Current Feature Flags

| Flag Key | Purpose | Default |
|---|---|---|
| `mission_v2` | Gates `createMissionFromStorm` in POST `/api/missions` | `false` |

---

## 6. Contact List & Escalation

### Escalation Tiers

| Tier | Response Time | Who | Action |
|---|---|---|---|
| **P1 — Total outage** | < 15 min | On-call engineer | Rollback deploy, engage Supabase/Vercel support |
| **P2 — Degraded** | < 1 hour | Engineering lead | Investigate logs, toggle feature flags, apply hotfix |
| **P3 — Minor** | < 4 hours | Assigned engineer | File issue, fix in next sprint |
| **P4 — Cosmetic** | Next business day | Any engineer | Fix when convenient |

### Key Contacts

| Role | Name | Contact | Notes |
|---|---|---|---|
| **Engineering Lead** | *(fill in)* | *(email / phone)* | Primary on-call, Vercel & Supabase admin |
| **Backend Engineer** | *(fill in)* | *(email / phone)* | API routes, services, integrations |
| **DevOps / Infra** | *(fill in)* | *(email / phone)* | CI/CD, Vercel config, DNS |
| **Product Owner** | *(fill in)* | *(email / phone)* | Business impact assessment |

### External Vendor Support

| Vendor | Support Channel | Account ID |
|---|---|---|
| **Supabase** | Dashboard chat + support@supabase.io | *(project ref)* |
| **Vercel** | Dashboard support + support@vercel.com | *(team slug)* |
| **CoreLogic** | Account rep + API support portal | *(contract #)* |
| **Google Cloud** | Cloud Console support | *(project ID)* |
| **Stripe** | Dashboard + support@stripe.com | *(account ID)* |

### Incident Communication

1. Post in `#incidents` Slack channel with: **What broke, when, who's on it, ETA**.
2. Update channel every 30 minutes during P1/P2.
3. After resolution, file a postmortem within 48 hours.

---

## Quick Reference: Key Environment Variables

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key (client-side) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin key (server-side only) |
| `CRON_SECRET` | Bearer token for cron endpoint auth |
| `GOOGLE_DIRECTIONS_API_KEY` | Google Directions API |
| `CORELOGIC_USE_FALLBACK` | `"true"` to skip CoreLogic API entirely |
| `PROMETHEUS_PUSHGATEWAY_URL` | Optional Prometheus push target |
| `FEATURE_FLAG_ADMIN_USER_IDS` | Comma-separated admin user UUIDs |
| `FEATURE_FLAG_ADMIN_EMAILS` | Comma-separated admin emails |
| `FEATURE_FLAG_<KEY>` | Per-flag env override (e.g. `FEATURE_FLAG_MISSION_V2`) |
