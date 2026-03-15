# Stormclose V2 — Product Contract

> This document is the single source of truth for every engineering, design, and product decision in Stormclose V2.
> If a feature, screen, API, or behavior is not described here, it does not ship.
> Last updated: 2026-03-14

---

## 1. Product Thesis

Stormclose is an AI storm sales operating system for roofing teams. It ingests live and recent storm data, uses AI to identify high-opportunity zones and rank individual houses by estimated value, then coordinates field reps through structured missions — providing real-time geolocation tracking, AI-assisted objection handling, negotiation coaching, and document generation along the way. The end of every workflow is a qualified opportunity exported into JobNimbus, the system of record. Stormclose exists because roofing companies lose revenue every day a storm zone goes unworked, a rep drives past a high-value house, or an opportunity sits in a spreadsheet instead of a CRM. It replaces guesswork with AI-ranked targets, manual dispatching with automated deployment plans, and paper tracking with live mission control.

---

## 2. Product Pillars

- **Storm Intelligence** — Ingest, normalize, and score storm data from Xweather, NWS, and CoreLogic to surface actionable opportunity zones before competitors arrive.
- **AI-Ranked Targeting** — Score and rank every house inside a storm zone by estimated value, storm severity, recency, distance, and property attributes so reps always work the highest-value doors first.
- **Mission Execution** — Create, assign, and track structured field missions with live geolocation, next-best-house suggestions, and real-time outcome capture.
- **Office Command Center** — Give managers and office staff a live operational view (Mission Control) of every rep, every mission, and every exception — on desktop and TV.
- **AI-Assisted Sales** — Embed AI into the field workflow for objection responses, negotiation coaching, follow-up drafting, and document generation — never as a standalone chatbot.
- **Document Generation** — Produce homeowner letters, storm summaries, mission recaps, and handoff sheets from structured workflow context, output as PDF, DOCX, clipboard, or print.
- **JobNimbus Export** — Push every qualified opportunity into JobNimbus with a structured handoff summary, retry logic, and audit trail. JobNimbus is always the destination, never a source.

---

## 3. Core Workflow

1. **Storm Ingestion** — Storm data is pulled from Xweather (primary) and NWS (fallback) on a recurring schedule. Raw events are normalized into `storm_events` rows.
2. **Zone Scoring** — AI clusters storm events into `storm_zones`, scores each zone by severity, recency, density, and estimated property count, and surfaces them on the Storms screen.
3. **House Ranking** — Within each zone, individual `targets` (houses) are scored using CoreLogic property data, storm severity overlaps, roof age, estimated value band, and distance from office or active rep. Results populate `Houses To Hit Today` on the Dashboard.
4. **Deployment Planning** — AI generates a deployment plan recommending which teams/reps should work which zones, shown in the `AI Deployment Plan` widget. The plan can be auto-applied or manager-approved.
5. **Mission Creation** — Missions are created from the deployment plan, from a storm zone action, or manually. Each mission contains an ordered list of `mission_stops` (houses). Status starts as `planned`.
6. **Mission Assignment** — Missions are assigned to reps. Reps see their assigned mission on the Missions screen with a map, house list, and progress summary.
7. **Field Execution** — Reps activate mission mode, which begins geolocation heartbeats (15–60s interval). They work stops in order, recording outcomes (`no_answer`, `interested`, `not_interested`, `follow_up_needed`, etc.). AI surfaces `Nearby Next-Best Houses` in real time.
8. **AI Assist In-Field** — At any stop, the rep can invoke AI for objection responses, negotiation coaching, or follow-up drafting. AI receives full structured context (storm, property, mission, rep notes, company tone).
9. **Office Monitoring** — Mission Control and the Team screen show live rep positions, mission progress, coverage gaps, and exceptions (idle rep, off-route, no rep in hot zone, etc.). Managers can reassign or rebalance.
10. **Qualification & Documentation** — When a homeowner is interested, the opportunity is marked qualified. Documents (follow-up letter, leave-behind, claim explanation) can be generated from context.
11. **JobNimbus Export** — Qualified opportunities enter the `Ready To Export Queue`. An export summary is generated. The opportunity is pushed to JobNimbus via API. Failed exports enter the `Retry Queue`. All exports are logged in `opportunity_exports` with audit trail.

---

## 4. Roles

### Owner
- **Cares about:** Revenue impact of storm response speed, team utilization, branch performance, AI ROI.
- **Sees:** Dashboard (all widgets), Storms (zone-level view), Mission Control, Team leaderboard, Export summary, Settings (billing, branches, company AI profile).
- **Can do:** Everything a Manager can do, plus: manage branches, manage billing/subscription, configure company AI profile and prompt templates, view cross-branch data.
- **Should NOT have to:** Manually assign individual houses, manually create missions, write documents, or touch the export queue day-to-day.

### Manager / Office Manager
- **Cares about:** Daily deployment efficiency, rep coverage, exception handling, export throughput.
- **Sees:** Dashboard, Storms, Missions, Team, Mission Control, Documents, Exports, AI Studio.
- **Can do:** Approve/reject AI deployment plans, create and assign missions, reassign reps, rebalance missions, resolve exceptions, review and approve exports, generate documents, invoke any AI module.
- **Should NOT have to:** Configure billing, manage branches, build storm zones manually, or write export summaries by hand.

### Rep
- **Cares about:** Knowing exactly which doors to knock, having AI backup for objections and negotiation, fast outcome capture, seeing their own stats.
- **Sees:** Dashboard (filtered to their assignments), Missions (their active mission only), AI Studio (Mission Copilot, Objection Assistant, Negotiation Coach, Follow-Up Writer), their own leaderboard position.
- **Can do:** Activate/pause/complete missions, record stop outcomes, invoke AI assist, generate leave-behind documents, view their assigned houses and next-best suggestions, share live location during mission mode.
- **Should NOT have to:** See other reps' missions, access Mission Control, manage exports, configure teams, or see billing/settings.

### Office Admin
- **Cares about:** Export queue health, document generation, Mission Control monitoring, handoff completeness.
- **Sees:** Dashboard, Mission Control, Documents, Exports, AI Studio (Export Summary Writer, Document Draft).
- **Can do:** Generate and edit documents, process export queue, retry failed exports, monitor Mission Control, generate handoff summaries.
- **Should NOT have to:** Go into the field, manage rep assignments, configure AI profiles, or handle billing.

---

## 5. No-Build List

### Feature categories Stormclose must NEVER build
- **CRM features** — contact management, deal pipelines, sales stages, customer records, activity timelines per contact. That is JobNimbus.
- **Scheduling / calendaring** — appointment booking, calendar sync, availability management, reminders.
- **Job management** — project tracking, material ordering, crew scheduling, invoicing, change orders, completion tracking.
- **Accounting / payments** — invoicing, payment collection, QuickBooks integration, financial reporting.
- **HR / payroll** — time tracking, PTO, payroll, employee records.
- **Marketing automation** — email campaigns, drip sequences, landing pages, lead magnets, social media posting.
- **Generic chat / messaging** — internal team chat, Slack-style channels, direct messaging between users.
- **Photo annotation / inspection tools** — roof measurement from photos, damage markup, photo comparison tools. (Existing `roof_photos` and `reports` tables from V1 are deprecated and must not be extended.)
- **Estimate / supplement generation** — Xactimate integration for estimate writing, supplement creation. (The `xactimate` and `supplements` API routes from V1 are deprecated.)
- **Insurance claim management** — claim filing, adjuster coordination, claim status tracking.

### Screens Stormclose must NEVER add
- Contact detail page (that's JobNimbus)
- Deal / pipeline board
- Calendar / scheduler view
- Invoice / payment screen
- Project / job detail page
- Generic AI chatbot page (AI is always contextual, never a blank prompt box)
- Social media dashboard
- Email campaign builder

### Integrations that would cause drift
- QuickBooks, Xero, or any accounting system
- Google Calendar, Outlook Calendar, or any scheduling system
- Mailchimp, SendGrid marketing, or any campaign tool
- Slack, Teams, or any team messaging platform
- Salesforce, HubSpot, or any CRM other than JobNimbus as export target
- Any project management tool (Asana, Monday, Trello)

---

## 6. Non-Negotiable UI / Brand Constraints

### Brand identity
- **Name:** Stormclose. No renaming, no abbreviations in the UI.
- **Logo:** Use the existing logo from `/public/images/`. Do not redesign or replace.
- **Color palette:** The existing dark theme defined in `tailwind.config.ts` is canonical:
  - Background layers: `storm-bg` (#0B0F1A), `storm-z0` through `storm-z3`
  - Primary accent: `storm-purple` (#6D5CFF), hover: `storm-purple-hover` (#5B4AE8), glow: `storm-glow` (#A78BFA)
  - Text: `storm-text` (#F9FAFB), `storm-muted` (#94A3B8), `storm-subtle` (#64748B)
  - Borders: `storm-border` (#1F2937), `storm-border-light` (#374151)
  - Semantic: `storm-success` (#10B981), `storm-warning` (#F59E0B), `storm-danger` (#EF4444), `storm-info` (#3B82F6)
  - Brand cyan accents: `brand-500` (#06b6d4), `brand-600` (#0891b2)
- **Do not** introduce a light theme, additional color tokens outside this palette, or alternative accent colors.

### Layout rules
- **Page shell:** Every authenticated page uses a shared shell with collapsible sidebar (72px collapsed / 264px expanded) and 64px top nav.
- **Sidebar navigation items (exact order):** Dashboard, Storms, Missions, Team, Mission Control, AI Studio, Documents, Exports, Settings.
- **No other top-level navigation items.** Sub-navigation lives within each page as tabs or segmented controls, never as additional sidebar entries.
- **KPI strip:** Every main screen has a horizontal KPI strip below the top nav showing 4–6 contextual metrics. The strip uses `storm-z2` background, `storm-purple` accent for primary metric, and consistent height (72px).

### Component rules
- **Cards:** Use `storm-z2` background, `storm-border` border, `rounded-2xl`, `shadow-depth-1`. Hover state adds `shadow-glow-sm`.
- **Drawers:** Slide in from the right, 480px wide on desktop, full-width on mobile. Used for detail views (house detail, rep detail, mission detail, storm detail). Never open a new page for detail views.
- **Modals:** Centered overlay, max-width 560px. Used only for confirmations, destructive actions, and quick forms. Never for detail views.
- **Tables:** Use `storm-z1` row backgrounds with `storm-z2` on hover. Sortable columns. Sticky header. Row click opens drawer.
- **Maps:** Mapbox GL JS only. Dark style. All maps use consistent marker/cluster styling from a shared map config.
- **Empty states:** Every widget and list must have a designed empty state with icon, message, and primary action button. No blank white/black space.
- **Loading states:** Skeleton loaders matching the widget layout. No spinners except for inline actions.
- **TV Mode (Mission Control):** Full-screen, no sidebar, no top nav, auto-refreshing data, large typography, high-contrast. Must be launchable from the Mission Control page header.

### Mobile rules
- Rep mobile mode shows only: active mission, house list, outcome capture, AI assist, and location sharing toggle.
- No sidebar on mobile. Bottom tab bar with: Mission, Houses, AI, Profile.
- Responsive breakpoints: mobile (<768px), tablet (768–1024px), desktop (>1024px).

---

## 7. Non-Negotiable Architecture Constraints

### Stack
- **Framework:** Next.js (App Router, `src/app/` directory)
- **Language:** TypeScript, strict mode, no `any` types in production code
- **Database:** Supabase (PostgreSQL), accessed via `@supabase/supabase-js`
- **Auth:** Supabase Auth, row-level security (RLS) on all tables
- **AI:** OpenAI API via server-side calls only; never expose API keys to the client
- **Maps:** Mapbox GL JS
- **Routing (directions):** Google Directions API (primary), local TSP provider (fallback)
- **Storm data:** Xweather API (primary), NWS (fallback)
- **Property data:** CoreLogic API with local cache (`parcelCacheService`)
- **Export target:** JobNimbus API
- **Payments:** Stripe (existing integration, do not replace)
- **Styling:** Tailwind CSS using the token system in `tailwind.config.ts`
- **Testing:** Vitest (configured in `vitest.config.mts`)

### API design
- All API routes live under `src/app/api/`.
- Route pattern: `src/app/api/{resource}/route.ts` for collection, `src/app/api/{resource}/[id]/route.ts` for item.
- Every write endpoint must be **idempotent** — use idempotency keys or upsert patterns.
- Every API response uses a consistent envelope: `{ data, error, meta }`.
- Authentication: every API route validates the Supabase session via `api-middleware.ts`. Unauthenticated requests return 401.
- Authorization: role checks happen in the API route handler, not in middleware. Use the role from the user's profile row.
- Rate limiting: applied via middleware for AI endpoints (per-user, per-minute).

### API routes (canonical list from architecture doc)
These are the only API routes that should exist. Any route not on this list must be justified against the core workflow before creation.

| Group | Routes |
|---|---|
| Dashboard | `GET /api/dashboard/today`, `GET /api/dashboard/ai-brief`, `GET /api/dashboard/export-summary` |
| Storms | `GET /api/storms`, `GET /api/storm-zones`, `GET /api/storm-zones/:id`, `POST /api/storm-zones/:id/generate-mission`, `GET /api/watchlists`, `POST /api/watchlists` |
| Houses | `GET /api/houses/today`, `GET /api/houses/nearby`, `GET /api/houses/:id`, `POST /api/houses/:id/assign`, `POST /api/houses/:id/send-to-jobnimbus` |
| Missions | `GET /api/missions`, `POST /api/missions`, `POST /api/missions/create-from-storm`, `GET /api/missions/:id`, `PATCH /api/missions/:id`, `PATCH /api/mission-stops/:id/outcome`, `POST /api/missions/:id/rebalance` |
| Presence | `POST /api/presence/heartbeat`, `POST /api/presence/start-mission`, `POST /api/presence/end-mission` |
| Team | `GET /api/team/live`, `GET /api/team/exceptions`, `POST /api/team/reassign` |
| AI | `POST /api/ai/daily-brief`, `POST /api/ai/mission-copilot`, `POST /api/ai/opportunity-summary`, `POST /api/ai/objection-response`, `POST /api/ai/negotiation-coach`, `POST /api/ai/follow-up-writer`, `POST /api/ai/reassignment-suggestions`, `POST /api/ai/document-draft` |
| Documents | `GET /api/documents`, `POST /api/documents/generate`, `GET /api/documents/:id`, `PATCH /api/documents/:id`, `POST /api/documents/:id/export` |
| Exports | `GET /api/exports`, `POST /api/exports/jobnimbus`, `POST /api/exports/:id/retry`, `GET /api/exports/:id/status` |
| Auth | `POST /api/auth/callback` (existing Supabase auth flow) |
| Stripe | `POST /api/stripe-webhook` (existing, keep as-is) |
| Health | `GET /api/health` (existing, keep as-is) |

### V1 API routes to deprecate and remove
The following existing API route directories are from V1 and must be removed or consolidated into the canonical routes above during migration. They must not be extended:
`activities`, `admin`, `carriers`, `corelogic`, `debug-supabase`, `door-knocks`, `download-report-csv`, `estimate-ocr`, `generate-objection`, `hail-events`, `hail-import`, `integrations`, `knock-list`, `leads`, `negotiation`, `opportunities`, `places-autocomplete`, `properties`, `property`, `reports`, `roof-measurement`, `route-optimize`, `storm-alerts`, `street-view`, `supplements`, `territories`, `upload`, `weather`, `xactimate`.

### Database entities (canonical list)
These are the core tables. The V1 tables (`email_drafts`, `roof_photos`, `objections`, `followups`, `reports`) are deprecated and must not receive new columns or queries.

| Entity | Purpose |
|---|---|
| `users` | Auth identity, profile, role, subscription, branch membership |
| `teams` | Named team with branch assignment |
| `branches` | Company branch / office location |
| `rep_presence` | Latest lat/lng, timestamp, status, active mission ref |
| `storm_events` | Raw storm event from Xweather/NWS |
| `storm_zones` | AI-clustered opportunity zone with score |
| `territory_watchlists` | Saved geographic areas for storm alerts |
| `targets` | Individual house/property with address, lat/lng, CoreLogic parcel ref |
| `target_scores` | Computed opportunity score per target per storm zone |
| `missions` | Planned/active field mission with status, assigned rep, zone ref |
| `mission_stops` | Ordered house within a mission with stop status and outcome |
| `mission_events` | Audit log of mission state changes |
| `opportunity_exports` | Record of each JobNimbus export attempt with status and payload |
| `documents` | Generated document with type, content, format, and refs |
| `ai_sessions` | Log of every AI invocation with input context and output |
| `ops_alerts` | Exception events (idle, off-route, coverage gap, etc.) |
| `integration_sync_logs` | Audit log for all third-party API calls |
| `data_freshness_snapshots` | Last-updated timestamps per data source |
| `jobnimbus_export_queue` | Pending exports with retry metadata |
| `document_templates` | Prompt templates for document generation |
| `company_ai_profiles` | Company-level AI tone, context, and preferences |

### Data rules
- All tables must have `id` (UUID), `created_at`, and `updated_at` columns.
- All user-facing tables must have RLS policies.
- Soft delete preferred over hard delete for audit-sensitive tables (`missions`, `opportunity_exports`, `ai_sessions`).
- Foreign keys must be explicit and named.
- All timestamps are UTC, stored as `timestamptz`.

### AI rules
- Every AI endpoint accepts a structured `context` object — never a raw user string alone.
- Every AI response includes a `reasoning` field explaining why the output was generated.
- AI never silently mutates workflow-critical state (mission status, export status, rep assignment). It can recommend; a user or explicit approval flow must confirm.
- AI outputs are logged to `ai_sessions` with input hash, model, token count, and latency.
- Feature flag `ai.enabled` must gate all AI endpoints. Individual modules have their own flags (e.g., `ai.objection_response.enabled`).

### Integration rules
- All third-party calls go through a service layer (`src/services/` or `src/integrations/`), never called directly from API route handlers.
- All third-party calls are logged to `integration_sync_logs`.
- All third-party calls have timeout (10s default), retry (3x with exponential backoff), and circuit-breaker fallback.
- CoreLogic data is cached in `parcelCacheService` — never call CoreLogic on every request.
- JobNimbus exports are queued and retryable. The `opportunity_exports` table is the audit trail.

### Code organization
- `src/app/api/` — API route handlers (thin: validate → call service → return envelope)
- `src/services/` — Business logic, orchestration
- `src/repos/` — Database access (Supabase queries)
- `src/integrations/` — Third-party API clients
- `src/lib/` — Shared utilities, AI prompt builders, scoring algorithms
- `src/hooks/` — React hooks for client-side data fetching and UI state
- `src/components/` — React components organized by domain (`dashboard/`, `missions/`, `storms/`, `team/`, `ai/`, `documents/`, `exports/`, `ui/`)
- `src/types/` — TypeScript type definitions
- `src/config/` — Static configuration (navigation, features, plans, site, threat weights)
- `tests/` — Test files colocated by module name

### Logging and observability
- Structured JSON logging on all API routes (request id, user id, route, duration, status).
- Metrics emitted for: API latency, AI latency, export success/failure rate, storm data freshness, active missions count.
- Alerts configured for: export failure rate > 10%, AI endpoint error rate > 5%, storm data older than 6 hours, zero active reps during business hours.

---

## 8. Implementation Contract

### Before marking Phase 1 complete, confirm that:
1. The shared page shell (sidebar + top nav) renders on all authenticated routes with the exact 9 navigation items in the specified order.
2. The Dashboard page renders all 9 widgets listed in Section 5 of the architecture doc, each with loading and empty states.
3. `Houses To Hit Today` displays all 11 specified row fields and supports all 6 row actions.
4. The Storms page renders the live storm map, storm timeline, and storm opportunity zones with the 5 specified actions.
5. `GET /api/dashboard/today`, `GET /api/storms`, `GET /api/storm-zones`, `GET /api/houses/today` return data in the `{ data, error, meta }` envelope.
6. `POST /api/ai/daily-brief` generates an AI brief with structured context input and `reasoning` field in output, gated by feature flag.
7. Storm data ingestion from Xweather is functional with NWS fallback, logged to `integration_sync_logs`, and freshness tracked in `data_freshness_snapshots`.
8. CoreLogic property lookups are cached via `parcelCacheService`.
9. The KPI strip appears on Dashboard and Storms with contextual metrics.
10. All API routes validate Supabase session and return 401 for unauthenticated requests.
11. No V1-only routes (`door-knocks`, `knock-list`, `leads`, `reports`, `estimate-ocr`, `xactimate`, `supplements`) are referenced by any V2 page.

### Before marking Phase 2 complete, confirm that:
1. `POST /api/missions`, `POST /api/missions/create-from-storm`, `GET /api/missions/:id`, `PATCH /api/missions/:id` are implemented and idempotent.
2. `PATCH /api/mission-stops/:id/outcome` accepts exactly the stop statuses defined in the architecture doc.
3. Mission status transitions follow the exact lifecycle: `planned` → `active` → `paused` → `completed` | `expired`.
4. `POST /api/presence/heartbeat` accepts lat/lng, writes to `rep_presence`, and returns within 200ms.
5. `POST /api/presence/start-mission` and `POST /api/presence/end-mission` toggle geolocation tracking.
6. The Missions page renders mission map, house list, live rep position, progress summary, nearby next-best houses, and AI Mission Copilot.
7. The Team page renders live rep map, rep status board, coverage gaps, and all 6 exception types.
8. `GET /api/team/exceptions` detects and returns: idle rep, off-route rep, no rep in hot zone, mission nearly complete with nearby cluster, repeated low-quality outcomes, export backlog growing.
9. `POST /api/team/reassign` and `POST /api/missions/:id/rebalance` are implemented.
10. All mission state changes are logged to `mission_events`.

### Before marking Phase 3 complete, confirm that:
1. Mission Control page renders all 12 widgets specified in the architecture doc.
2. TV mode launches full-screen with no sidebar/top nav, auto-refreshing data, large typography.
3. `POST /api/exports/jobnimbus` pushes to JobNimbus API with structured handoff summary.
4. `GET /api/exports` returns the export queue. `POST /api/exports/:id/retry` retries failed exports.
5. All exports are logged to `opportunity_exports` with status, payload, and timestamp.
6. Export failures trigger retry with exponential backoff (max 3 attempts).
7. The Exports page renders: Ready To Export Queue, Recently Exported, Failed Exports, Retry Queue, Export Rules, Handoff Summary Preview.
8. `POST /api/documents/generate` produces documents for all 10 document types listed in the architecture doc.
9. Documents output in PDF, DOCX, clipboard text, and print formats.
10. The Documents page lists generated documents with filtering by type and date.

### Before marking Phase 4 complete, confirm that:
1. `POST /api/ai/objection-response` accepts structured context (objection text, property details, storm data, company tone) and returns response with `reasoning`.
2. `POST /api/ai/negotiation-coach` accepts deal context and returns coaching guidance with `reasoning`.
3. AI Studio page renders all 10 modules listed in the architecture doc, each pre-populated with relevant workflow context.
4. Branch/team data model supports multiple branches per company, teams per branch, reps per team.
5. Owner role can view cross-branch data; Manager role is scoped to their branch.
6. All AI endpoints are individually feature-flagged.
7. All AI invocations are logged to `ai_sessions` with input hash, model, token count, and latency.
8. Alert thresholds are configured: export failure rate > 10%, AI error rate > 5%, storm data > 6 hours stale, zero active reps during business hours.
9. No screen in the application is a dead end — every screen has navigation back to the core workflow and at least one primary action.
10. The No-Build List has not been violated: no CRM, scheduling, job management, accounting, HR, marketing, generic chat, photo annotation, estimate generation, or insurance claim features exist anywhere in the codebase.
