# Stormclose V2 — Enterprise Hardening Checklist

> Readiness checklist for production launch. Each item has a concrete pass/fail criterion.
> Current state assessed against: `rewrite/mvp-backend` @ `17384c0`.
> Last updated: 2026-03-14

**Legend:** ✅ Pass | ⚠️ Partial | ❌ Fail | — Not Started

---

## 1. Role-Based Access

### 1.1 Sidebar Navigation Filtering
| # | Check | Pass Criteria | Status |
|---|---|---|---|
| 1.1.1 | `NAV_ITEMS` define `requiredRoles` for every entry | Every item in `src/config/navigation.ts` has a non-empty `requiredRoles` array matching the spec role matrix. | ✅ |
| 1.1.2 | `getNavItemsForRole()` filters at render time | `Sidebar` receives `userRole` and calls `getNavItemsForRole(role)`. Items not in the role's list are never rendered. | ✅ |
| 1.1.3 | Rep cannot see Team, Storms, Mission Control, Exports, Documents | Verify `getNavItemsForRole("rep")` returns only Dashboard, Missions, AI Studio, Settings. | ✅ |
| 1.1.4 | Office Admin cannot see Team, Storms | Verify `getNavItemsForRole("office_admin")` excludes Team and Storms. | ✅ |

### 1.2 API Route Role Enforcement
| # | Check | Pass Criteria | Status |
|---|---|---|---|
| 1.2.1 | Every V2 API route checks auth (user identity) | All routes under `/api/dashboard/*`, `/api/exports/*`, `/api/missions/*`, `/api/team/*`, `/api/documents/*`, `/api/ai/*`, `/api/storm-zones/*` call `supabase.auth.getUser()` or `getUserId()` and return 401 when unauthenticated. | ⚠️ |
| 1.2.2 | Role-specific API routes enforce role | Team endpoints (`/api/team/*`) reject `rep` and `office_admin` callers. Storm endpoints reject `rep` and `office_admin`. Exports reject `rep`. | ❌ |
| 1.2.3 | RLS policies on all V2 tables | `opportunity_exports`, `canvass_missions`, `mission_stops`, `mission_events`, `documents`, `storm_zones`, `feature_flags` have `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` and at least SELECT/INSERT policies. | ⚠️ |
| 1.2.4 | No service-role key used without audit justification | Any use of `SUPABASE_SERVICE_ROLE_KEY` in API routes is documented with a comment explaining why RLS bypass is needed (e.g., cron jobs, admin endpoints). | ⚠️ |
| 1.2.5 | `getUserId()` never returns `"test-user"` in production | The `if (process.env.NODE_ENV === "test")` guard in `getUserId()` is present and correct. Verified that `NODE_ENV` is `"production"` in Vercel. | ✅ |

### 1.3 Page-Level Role Guards
| # | Check | Pass Criteria | Status |
|---|---|---|---|
| 1.3.1 | Dashboard layout reads user role from auth | `src/app/(dashboard)/layout.tsx` resolves user role and passes it to `DashboardShell` / `Sidebar`. | ✅ |
| 1.3.2 | Role-restricted pages show 403 or redirect if wrong role | If a `rep` navigates to `/dashboard/team` directly (URL bar), they see a "Not authorized" message or are redirected — not a blank screen. | ❌ |
| 1.3.3 | Middleware blocks unauthenticated dashboard access | `middleware.ts` redirects to `/login` for all `/dashboard/*` routes when no session cookie. | ✅ |

---

## 2. Error Handling

### 2.1 Page-Level States
| # | Check | Pass Criteria | Status |
|---|---|---|---|
| 2.1.1 | Global `error.tsx` exists at app root | `src/app/error.tsx` renders a user-friendly error message with a "Try again" button. | ✅ |
| 2.1.2 | Global `global-error.tsx` exists | `src/app/global-error.tsx` renders a fallback HTML page when the root layout throws. | ✅ |
| 2.1.3 | Every page component has loading state | Each page (`Phase8DocumentsPage`, `Phase9ExportsPage`, dashboard, storms, missions, team, mission-control, AI studio) renders a loading indicator while fetching. | ⚠️ |
| 2.1.4 | Every page component has empty state | When the API returns `data: []` or zero records, the page shows a contextual "No X yet" message — not a blank white area. | ⚠️ |
| 2.1.5 | Every page component has error state | When `fetch()` rejects or returns a non-2xx status, the page renders an inline error message (not just a `console.error`). | ❌ |

### 2.2 API Error Envelope
| # | Check | Pass Criteria | Status |
|---|---|---|---|
| 2.2.1 | V2 API routes use `{ data, error, meta }` envelope | All routes under `/api/dashboard/*`, `/api/exports/*`, `/api/documents/*`, `/api/storm-zones/*`, `/api/missions/*`, `/api/team/*` return `{ data: T, error: string \| null, meta: { generatedAt } }`. | ⚠️ |
| 2.2.2 | `handleNextRoute` wrapper used on new routes | Routes use `handleNextRoute` from `api-middleware.ts` for automatic error mapping and metrics. | ❌ |
| 2.2.3 | `toHttpError` handles all known error shapes | `ZodError`, `ValidationError`, `AuthError`, `ForbiddenError`, `NotFoundError`, generic objects with `.statusCode`, and bare `Error` all map to correct HTTP codes. | ✅ |
| 2.2.4 | No stack traces leaked in production responses | Error responses contain `{ code, message }` — never `error.stack`. | ✅ |

### 2.3 Frontend Error Presentation
| # | Check | Pass Criteria | Status |
|---|---|---|---|
| 2.3.1 | API errors show toast or inline alert | After a failed export, retry, or document generation, the user sees a visible error message — not a silent failure. | ⚠️ |
| 2.3.2 | Network failures show "Could not connect" message | When `fetch()` throws `TypeError: Failed to fetch`, the UI shows a retry-able error state. | ❌ |

---

## 3. Data Freshness

### 3.1 Timestamp Display
| # | Check | Pass Criteria | Status |
|---|---|---|---|
| 3.1.1 | API responses include `meta.generatedAt` | Every V2 endpoint returns `meta: { generatedAt: ISO8601 }` in the response. | ⚠️ |
| 3.1.2 | Dashboard widgets render "Updated N min ago" | Each card shows the relative timestamp from `meta.generatedAt`. | ❌ |
| 3.1.3 | Mission Control shows last-refresh timestamp | The fullscreen TV display shows a small timestamp so operators know if data is stale. | ❌ |

### 3.2 Staleness Indicators
| # | Check | Pass Criteria | Status |
|---|---|---|---|
| 3.2.1 | AI Daily Brief shows amber "Stale" badge if > 12h old | Compare `generatedAt` to `Date.now()` and render badge. Spec defined in `stormclose-dashboard-widgets.md`. | ❌ |
| 3.2.2 | Storm zone data shows amber indicator if > 8h old | Per `stormclose-storms-module.md` spec. | ❌ |

### 3.3 Auto-Refresh
| # | Check | Pass Criteria | Status |
|---|---|---|---|
| 3.3.1 | Dashboard auto-refreshes every 5 minutes | `useEffect` or `useSWR` with `refreshInterval: 300_000` on the dashboard page. | ❌ |
| 3.3.2 | Mission Control auto-refreshes every 15 seconds | Per `stormclose-mission-control.md` spec, poll `GET /api/mission-control/live` every 15s. | ❌ |
| 3.3.3 | Team page auto-refreshes every 30 seconds | Rep positions update at heartbeat cadence (15–60s). | ❌ |
| 3.3.4 | Exports page auto-refreshes every 60 seconds | Show near-real-time export status transitions. | ❌ |
| 3.3.5 | Auto-refresh intervals documented in one place | A table in `docs/` listing every screen and its polling interval. | ❌ |

---

## 4. Observability

### 4.1 Structured Logging
| # | Check | Pass Criteria | Status |
|---|---|---|---|
| 4.1.1 | `MetricsEmitter` exists and exports singleton | `src/lib/metrics.ts` exports `metrics` with `.increment()` method. Emits JSON to `console.log`. | ✅ |
| 4.1.2 | `logRequest()` called on every route | `handleNextRoute` calls `logRequest` with `{ route, userId, method, timestamp }`. | ⚠️ |
| 4.1.3 | API error metric emitted on failures | `api_error_rate` counter incremented with `{ route, status, type }` labels. | ✅ |

### 4.2 Business Metrics
| # | Check | Pass Criteria | Status |
|---|---|---|---|
| 4.2.1 | `mission_creation_success` metric emitted | Fired in `missionService.ts` after transactional create. | ✅ |
| 4.2.2 | `corelogic_cache_miss` metric emitted | Fired in `corelogicCachedClient.ts`. | ✅ |
| 4.2.3 | `route_provider_fallbacks` metric emitted | Fired in `routeService.ts` when local TSP fallback used. | ✅ |
| 4.2.4 | `export_success` / `export_failure` metrics emitted | Counters in `/api/exports/jobnimbus` route for successful and failed exports. | ❌ |
| 4.2.5 | `ai_call_duration_ms` metric emitted | Timer metric on AI module calls (daily-brief, objection-response, etc.) recording wall-clock latency. | ❌ |
| 4.2.6 | `heartbeat_received` metric emitted | Counter in `/api/presence/heartbeat` tracking rep heartbeats. | ❌ |

### 4.3 Alert Thresholds
| # | Check | Pass Criteria | Status |
|---|---|---|---|
| 4.3.1 | Alert thresholds documented in runbook | `docs/runbook.md` or `docs/observability.md` lists P1/P2 alert conditions with PromQL/CloudWatch queries. | ⚠️ |
| 4.3.2 | `api_error_rate > 50/5min` triggers P2 alert | Defined in monitoring config or documented as PromQL rule. | ❌ |
| 4.3.3 | Export failure rate > 20% triggers alert | `export_failure_total / (export_success_total + export_failure_total) > 0.2` over 1h. | ❌ |
| 4.3.4 | No heartbeats for > 5 min from active rep triggers alert | Detect stale `rep_presence` rows for reps with `field_status = 'active'`. | ❌ |

### 4.4 Prometheus / APM Integration
| # | Check | Pass Criteria | Status |
|---|---|---|---|
| 4.4.1 | Prometheus Pushgateway integration works | `MetricsEmitter.pushToPrometheus()` sends accumulated counters. `PROMETHEUS_PUSHGATEWAY_URL` env var documented. | ✅ |
| 4.4.2 | Sample dashboard queries documented | `docs/observability.md` includes Loki, CloudWatch, and PromQL query examples. | ✅ |

---

## 5. Audit Trail

### 5.1 Export Audit
| # | Check | Pass Criteria | Status |
|---|---|---|---|
| 5.1.1 | `opportunity_exports` table records every export attempt | Every export creates a row with `id`, `house_id`, `created_by`, `status`, `created_at`. | ✅ |
| 5.1.2 | Export retries logged with attempt count | `attempts` column incremented on each retry. `next_retry_at` computed with exponential backoff. | ✅ |
| 5.1.3 | Export errors stored with message | `error` column captures the failure reason text. | ✅ |
| 5.1.4 | `exported_at` timestamp recorded on success | Set when status transitions to `exported`. | ✅ |
| 5.1.5 | `jobnimbus_id` stored on successful push | The external ID returned from JobNimbus API is persisted. | ✅ |

### 5.2 AI Audit
| # | Check | Pass Criteria | Status |
|---|---|---|---|
| 5.2.1 | `ai_sessions` table migration exists | SQL migration creates `ai_sessions` table with `module_id`, `user_id`, `input_hash`, `output_hash`, `model`, `token_count`, `latency_ms`, `created_at`. | ❌ |
| 5.2.2 | Every AI module call logs to `ai_sessions` | All 10 AI modules (`dailyBrief`, `missionCopilot`, `opportunitySummary`, `objectionResponse`, `negotiationCoach`, `followUpWriter`, `exportSummary`, `repCoaching`, `zoneSummary`, `documentDraft`) insert a row after each invocation. | ❌ |
| 5.2.3 | PII redaction before storage | `redactPii()` scrubs homeowner names, phone numbers, and emails from `input_snapshot` before insert. | ❌ |

### 5.3 Mission Audit
| # | Check | Pass Criteria | Status |
|---|---|---|---|
| 5.3.1 | `mission_events` table exists | Table stores `{ mission_id, event_type, from_status, to_status, actor_id, reason, metadata, created_at }`. | ✅ |
| 5.3.2 | Every mission state transition logs an event | `missionService` inserts into `mission_events` on create, activate, pause, resume, complete, expire, rebalance. | ⚠️ |
| 5.3.3 | Stop outcome changes log an event | When a stop transitions (`no_answer`, `interested`, etc.), an event is recorded. | ⚠️ |
| 5.3.4 | Assignment changes log an event | Rep reassignment produces a `mission_events` row with `event_type = "assignment_changed"`. | ⚠️ |

---

## 6. Resilience

### 6.1 Third-Party Outage Fallbacks
| # | Check | Pass Criteria | Status |
|---|---|---|---|
| 6.1.1 | CoreLogic: 3-tier fallback (API → cache → synthetic) | `corelogicCachedClient.ts` falls back to `parcel_cache`, then generates a synthetic stub. `CORELOGIC_USE_FALLBACK=true` forces cache-only. | ✅ |
| 6.1.2 | Google Directions: fallback to local TSP solver | `routeService.ts` catches Google API failure and routes through `LocalTspProvider`. | ✅ |
| 6.1.3 | Xweather: graceful degradation | If Xweather API is down, storm ingest cron logs the error and returns without crashing. Dashboard shows stale storm data. | ⚠️ |
| 6.1.4 | OpenAI: AI modules return structured error, not crash | AI module functions return `{ success: false, error: "..." }` when OpenAI returns 500/429 — the UI renders a fallback. | ⚠️ |
| 6.1.5 | JobNimbus: export fails gracefully with retry queue | `sendToJobNimbus` catches API errors, sets export to `failed`, increments `attempts`, and computes `next_retry_at`. | ✅ |

### 6.2 Retry Logic
| # | Check | Pass Criteria | Status |
|---|---|---|---|
| 6.2.1 | Export retry: exponential backoff, max 3 attempts | `calculateRetryDelaySeconds(n)` = `60 * 2^(n-1) + 15`. After 3 failures, status = `permanently_failed`. | ✅ |
| 6.2.2 | CoreLogic: rate-limit cooldown (60s) | `rateLimitHitAt` tracker prevents re-calling a 429'd API for 60 seconds. | ✅ |
| 6.2.3 | OpenAI 429: exponential backoff (2s/4s/8s), max 3 retries | Spec says retry on 429, fail-fast on 500. | ❌ |
| 6.2.4 | Supabase transient errors: retry with jitter | DB connection failures on write paths retry once before returning error. | ❌ |

### 6.3 Feature Flags
| # | Check | Pass Criteria | Status |
|---|---|---|---|
| 6.3.1 | `isFeatureEnabled()` utility exists | `src/lib/featureFlag.ts` resolves env → per-user DB → global DB → false. | ✅ |
| 6.3.2 | `feature_flags` table migration exists | `supabase/migrations/20260314_feature_flags.sql` creates the table with unique indexes. | ✅ |
| 6.3.3 | Admin API for flag management | `POST /api/admin/feature-flags` allows authorized admins to toggle flags. | ✅ |
| 6.3.4 | Feature flags documented in runbook | `docs/runbook.md` §5 explains env var override, admin API, SQL toggle, and lists current flags. | ✅ |
| 6.3.5 | AI modules gated behind feature flag | Each AI module checks `isFeatureEnabled(userId, "ai.enabled")` before calling OpenAI. | ❌ |
| 6.3.6 | Export module gated behind feature flag | `/api/exports/jobnimbus` checks `isFeatureEnabled(userId, "exports.enabled")`. | ❌ |

---

## 7. Security

### 7.1 Input Validation
| # | Check | Pass Criteria | Status |
|---|---|---|---|
| 7.1.1 | All POST/PATCH/PUT API routes validate request body | Body is checked against a schema (TypeScript type guard or Zod schema) before processing. Missing/invalid fields return 400. | ⚠️ |
| 7.1.2 | Zod schemas used on write endpoints | Import `zod` and define `.parse()` schemas for mission creation, export trigger, document generation, AI invocations. | ❌ |
| 7.1.3 | Query parameter validation on GET endpoints | Numeric params (`limit`, `offset`, `page`) parsed with `parseInt` and clamped to max values. Invalid values return 400. | ⚠️ |
| 7.1.4 | UUID parameters validated | Dynamic route params `[id]` are checked against UUID format before DB query. | ❌ |

### 7.2 Rate Limiting
| # | Check | Pass Criteria | Status |
|---|---|---|---|
| 7.2.1 | AI endpoints rate-limited per user | 60 AI calls/hour per user. Returns 429 with `Retry-After` header when exceeded. | ❌ |
| 7.2.2 | Export endpoint rate-limited | Max 50 exports/hour per user (per spec `maxExportsPerHour`). | ❌ |
| 7.2.3 | Auth endpoints rate-limited | Login/signup limited to prevent brute force. Supabase Auth handles this natively. | ✅ |
| 7.2.4 | Cron endpoints protected by `CRON_SECRET` | All `/api/cron/*` routes check `Authorization: Bearer <CRON_SECRET>`. | ✅ |

### 7.3 Geolocation Privacy
| # | Check | Pass Criteria | Status |
|---|---|---|---|
| 7.3.1 | Rep location stored only during active mission | `rep_presence` rows are only created/updated when a mission is `active`. Location data has a TTL or expiry policy. | ⚠️ |
| 7.3.2 | Location data not exposed to other reps | RLS on `rep_presence` restricts SELECT to the rep themselves + manager/owner of their team. | ⚠️ |
| 7.3.3 | Location consent documented | Privacy policy or in-app notice explains that location is tracked during active missions only. | ❌ |
| 7.3.4 | Geolocation data retention policy defined | `rep_presence` rows older than N days are purged. Policy documented. | ❌ |

### 7.4 General Security
| # | Check | Pass Criteria | Status |
|---|---|---|---|
| 7.4.1 | No secrets in client-side code | Only `NEXT_PUBLIC_*` env vars are accessible in the browser. `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, etc. are server-only. | ✅ |
| 7.4.2 | `Content-Security-Policy` header set | `next.config.js` or middleware sets CSP headers. | ❌ |
| 7.4.3 | SQL injection prevented | All DB queries use parameterized Supabase SDK calls — no raw string interpolation. | ✅ |
| 7.4.4 | XSS prevention | React's JSX escaping + no `dangerouslySetInnerHTML` without sanitization. AI-generated markdown rendered via a sanitizing renderer. | ⚠️ |

---

## 8. UI Polish

### 8.1 Design Consistency
| # | Check | Pass Criteria | Status |
|---|---|---|---|
| 8.1.1 | All pages use `storm-*` design tokens | Colors: `storm-bg`, `storm-purple`, `storm-glow`, `storm-success`, `storm-muted`, `storm-subtle`. No raw hex values outside Tailwind config. | ⚠️ |
| 8.1.2 | Typography follows system | Headings use `text-xl font-semibold` (h2) or `text-2xl font-bold` (h1). Body text uses `text-sm` / `text-base`. | ⚠️ |
| 8.1.3 | Spacing is consistent | Cards use `p-4` or `p-6`. Grid gaps use `gap-4` or `gap-6`. No ad-hoc spacing. | ⚠️ |
| 8.1.4 | Icons sourced from `lucide-react` only | No mixing of icon libraries. | ✅ |
| 8.1.5 | UI components from `src/components/ui/` | `Card`, `Badge`, `Button`, `Skeleton` used consistently — no inline ad-hoc recreations. | ⚠️ |

### 8.2 Responsive Layout
| # | Check | Pass Criteria | Status |
|---|---|---|---|
| 8.2.1 | Dashboard works at xl (≥1280px) | 3-column grid renders correctly. | ⚠️ |
| 8.2.2 | Dashboard works at md (768–1279px) | 2-column fallback. `col-span-2` widgets adapt. | ⚠️ |
| 8.2.3 | Dashboard works at mobile (<768px) | 1-column stack. Horizontal scroll for tables. Hidden widgets per spec. | ⚠️ |
| 8.2.4 | Mission Control renders at 1920×1080 (TV) | Fullscreen grid fills viewport. Text readable at 15ft on 55" screen. | ⚠️ |
| 8.2.5 | No layout overflow or horizontal scroll (except tables) | No elements break out of their containers. | ⚠️ |

### 8.3 Accessibility (WCAG AA)
| # | Check | Pass Criteria | Status |
|---|---|---|---|
| 8.3.1 | Color contrast ratio ≥ 4.5:1 for body text | White text on `storm-bg (#0B0F1A)` passes. Verify `storm-muted` (#94A3B8 on #0B0F1A) passes. | ⚠️ |
| 8.3.2 | All interactive elements keyboard-accessible | Buttons, links, tabs, drawers reachable via Tab key and activatable via Enter/Space. | ⚠️ |
| 8.3.3 | Focus indicators visible | `focus-visible:ring-2 focus-visible:ring-storm-purple` on all interactive elements. | ❌ |
| 8.3.4 | `aria-label` on icon-only buttons | Buttons with only an icon (close, export, retry) have `aria-label`. Mission Control widgets have landmark roles. | ⚠️ |
| 8.3.5 | Form inputs have associated labels | All `<input>`, `<select>`, `<textarea>` elements have `<label>` or `aria-label`. | ⚠️ |
| 8.3.6 | Dynamic content announces to screen readers | Toast notifications, loading states, and error messages use `role="alert"` or `aria-live="polite"`. | ❌ |
| 8.3.7 | Modal/drawer traps focus | Handoff Preview drawer and Storm Detail drawer trap focus inside when open and return focus to trigger element on close. | ❌ |

---

## Summary Scorecard

| Category | Total Items | ✅ Pass | ⚠️ Partial | ❌ Fail |
|---|---|---|---|---|
| 1. Role-Based Access | 12 | 6 | 3 | 3 |
| 2. Error Handling | 11 | 4 | 4 | 3 |
| 3. Data Freshness | 9 | 0 | 1 | 8 |
| 4. Observability | 14 | 6 | 2 | 6 |
| 5. Audit Trail | 10 | 6 | 3 | 1 (ai_sessions migration missing) |
| 6. Resilience | 14 | 8 | 2 | 4 |
| 7. Security | 14 | 5 | 5 | 4 |
| 8. UI Polish | 17 | 1 | 12 | 4 |
| **Total** | **101** | **36** | **32** | **33** |

---

## Priority Remediation Order

### P0 — Ship Blockers (fix before any production traffic)
1. **1.2.2** — API route role enforcement (data leak risk)
2. **1.3.2** — Page-level role guards (direct URL access)
3. **7.1.2** — Zod schemas on all write endpoints
4. **7.2.1** — Rate limiting on AI endpoints (cost/abuse risk)
5. **7.4.2** — Content-Security-Policy header
6. **5.2.1** — `ai_sessions` migration (contractual audit requirement)

### P1 — Required for GA
7. **2.1.5** — Page-level error states (not just console.error)
8. **3.3.1–3.3.4** — Auto-refresh on all live screens
9. **4.2.4–4.2.6** — Export/AI/heartbeat metrics
10. **6.2.3** — OpenAI retry with exponential backoff
11. **7.3.3–7.3.4** — Geolocation consent and retention policy
12. **8.3.3** — Visible focus indicators
13. **8.3.7** — Drawer focus trapping

### P2 — Post-GA Hardening
14. **2.2.2** — Migrate all V2 routes to `handleNextRoute` wrapper
15. **3.1.2–3.2.2** — "Updated N min ago" + staleness badges
16. **4.3.2–4.3.4** — Alert threshold rules in monitoring
17. **6.3.5–6.3.6** — Feature flag gates on AI and exports
18. **8.1–8.2** — Visual audit pass for design token consistency

---

## How to Use This Checklist

1. **Assign each P0 item** to an engineer with a target date.
2. **Re-run `npx vitest run`** after each remediation to ensure no regressions.
3. **Update the Status column** as items are addressed (commit the changes to this doc).
4. **Gate staging promotion** on all P0 items being ✅.
5. **Gate production launch** on all P0 + P1 items being ✅.
