### 1. Screen Mapping

| Current Screen | Target Screen | Action (reuse / reshape / hide / new) |
|---|---|---|
| `/` (`src/app/page.tsx`) | Marketing/Landing (outside core V2 nav) | reshape |
| `/pricing` | Settings → Billing | reshape |
| `/subscribe` | Settings → Billing | reshape |
| `/success` | Settings → Billing success state | reshape |
| `/login` | Auth | reuse |
| `/signup` | Auth | reuse |
| `/forgot-password` | Auth | reuse |
| `/reset-password` | Auth | reuse |
| `/dashboard` (`/app/(dashboard)/dashboard/page.tsx`) | `Dashboard` | reshape |
| `/dashboard/command-center` | `Mission Control` | reshape |
| `/dashboard/team` | `Team` | reshape |
| `/dashboard/documents` | `Documents` | reshape |
| `/dashboard/ai-tools` | `AI Studio` | reshape |
| `/dashboard/storm-map` | `Storms` | reshape |
| `/dashboard/lead-scoring` | `Storms` + `Dashboard/Houses To Hit Today` scoring backend | reshape |
| `/dashboard/knock-list` | `Missions` (`Assigned House List`) | reshape |
| `/dashboard/knock-tracker` | `Missions` (`Outcome Feed`) | reshape |
| `/dashboard/field-map` | `Team` (`Live Rep Map`) | reshape |
| `/dashboard/team-performance` | `Team` (`Rep Leaderboard`) | reshape |
| `/dashboard/opportunities` | `Exports` (`Ready To Export Queue`) | reshape |
| `/dashboard/route-planner` | `Missions` (`Nearby Next-Best Houses` + reroute) | reshape |
| `/dashboard/smart-route` | `Missions` / route optimization service | reshape |
| `/dashboard/property-lookup` | `Storms`/`Houses` detail drawer enrichment | reshape |
| `/dashboard/territories` | `Storms` (`Territory Watchlist Alerts`) | reshape |
| `/settings` | `Settings` | reshape |
| `/settings/profile` | `Settings` | reuse |
| `/settings/company` | `Settings` (`company_ai_profiles`) | reshape |
| `/settings/team` | `Settings` (team admin) | reshape |
| `/settings/integrations` | `Settings` (integration health) | reshape |
| `/settings/billing` | `Settings` (billing) | reuse |
| `/dashboard/jobnimbus` | `Exports` + `Settings` integration panel | reshape |
| `/dashboard/reports` | `Documents` | reshape |
| `/dashboard/report` | `Documents` | reshape |
| `/dashboard/objection` | `AI Studio` (`Objection Response Assistant`) | reshape |
| `/dashboard/negotiation` | `AI Studio` (`Negotiation Coach`) | reshape |
| `/dashboard/carriers` | No target (CRM/insurance drift) | hide |
| `/dashboard/leads` | `Houses`/`targets` list | reshape |
| `/dashboard/roof-measurement` | No target (inspection/measurement drift) | hide |
| `/dashboard/roof-measure` | No target (inspection/measurement drift) | hide |
| `/dashboard/estimate-generator` | No target (estimating drift) | hide |
| `/dashboard/supplements` | No target (supplement drift) | hide |
| `/dashboard/xactimate` | No target (estimate/supplement drift) | hide |
| `—` | `Storms` (canonical V2 screen) | new |
| `—` | `Missions` (canonical V2 screen) | new |
| `—` | `Exports` (canonical V2 screen) | new |

### 2. API Mapping

| Current API Route | Target API Route | Action (reuse / reshape / remove / new) |
|---|---|---|
| `GET /api/health` | `GET /api/health` | reuse |
| `POST /api/stripe-webhook` | `POST /api/stripe-webhook` | reuse |
| `GET /api/storms` | `GET /api/storms` | reshape |
| `GET /api/missions` | `GET /api/missions` | reshape |
| `POST /api/missions` | `POST /api/missions` | reshape |
| `PATCH /api/missions` | `PATCH /api/missions/:id` | reshape |
| `POST /api/missions/create-from-storm` | `POST /api/missions/create-from-storm` | reuse |
| `GET /api/team/locations` | `GET /api/team/live` | reshape |
| `GET /api/team/performance` | `GET /api/team/live` / `GET /api/team/exceptions` | reshape |
| `GET /api/team/members` | `GET /api/team/live` (supporting) | reshape |
| `POST /api/team/members` | `POST /api/team/reassign` (supporting) | reshape |
| `GET /api/ai/daily-briefing` | `POST /api/ai/daily-brief` | reshape |
| `POST /api/ai/storm-briefing` | `POST /api/ai/opportunity-summary` | reshape |
| `POST /api/ai/chat` | Contextual AI endpoints only (no generic chat) | remove |
| `GET/POST /api/ai/briefing` | `POST /api/ai/opportunity-summary` | reshape |
| `GET/POST /api/ai/voice-notes` | No target in V2 contract | remove |
| `POST /api/negotiation` | `POST /api/ai/negotiation-coach` | reshape |
| `POST /api/generate-objection` | `POST /api/ai/objection-response` | reshape |
| `GET /api/property/lookup` | `GET /api/houses/:id` (enrichment path) | reshape |
| `GET /api/properties` | `GET /api/houses/today` / `GET /api/houses/nearby` | reshape |
| `POST /api/properties` | `POST /api/houses/:id/assign` | reshape |
| `GET /api/leads` | `GET /api/houses/today` | reshape |
| `POST /api/leads` | `POST /api/houses/:id/assign` (or mission stop create path) | reshape |
| `PATCH /api/leads` | `PATCH /api/mission-stops/:id/outcome` | reshape |
| `DELETE /api/leads` | No direct V2 target | remove |
| `GET /api/leads/nearby` | `GET /api/houses/nearby` | reshape |
| `GET/POST /api/leads/score` | `target_scores` compute path (internal) | reshape |
| `GET/POST /api/opportunities` | `GET /api/exports` + `POST /api/exports/jobnimbus` | reshape |
| `POST /api/integrations/jobnimbus/export-lead` | `POST /api/exports/jobnimbus` | reshape |
| `GET/POST /api/integrations/jobnimbus/connect` | Settings integration management | reshape |
| `POST /api/jobnimbus/connect` | Settings integration management | reshape |
| `POST /api/jobnimbus/disconnect` | Settings integration management | reshape |
| `GET /api/jobnimbus/status` | Settings integration health | reshape |
| `PUT/GET /api/jobnimbus/settings` | Settings integration management | reshape |
| `POST /api/jobnimbus/sync` | export sync worker support | reshape |
| `POST /api/jobnimbus/webhook` | webhook ingestion support | reshape |
| `GET /api/dashboard/stats` | `GET /api/dashboard/today` | reshape |
| `GET /api/dashboard/revenue-hub` | `GET /api/dashboard/today` | reshape |
| `POST /api/dashboard/revenue-hub` | No target in V2 | remove |
| `GET /api/storms/timeline` | `GET /api/storms` / `GET /api/storm-zones` | reshape |
| `GET /api/storms/revenue-analysis` | `GET /api/dashboard/export-summary` + ops KPIs | reshape |
| `GET /api/weather` | Storm ingestion internals | reshape |
| `GET /api/weather/feed` | Storm ingestion internals | reshape |
| `GET /api/weather/forecast` | Optional dashboard context | reshape |
| `GET/POST /api/weather/hail-verify` | Storm validation internals | reshape |
| `GET /api/storm-alerts` | `GET /api/storms` / watchlists | reshape |
| `GET/POST /api/storm-alerts/monitor` | storm ingestion monitor internals | reshape |
| `GET/POST /api/hail-events` | storm ingestion internals (`storm_events`) | reshape |
| `POST/GET /api/hail-import` | storm ingestion worker | reshape |
| `GET/POST /api/cron/generate-leads` | zone→house scoring worker | reshape |
| `GET/POST /api/cron/rescore-leads` | target rescoring worker | reshape |
| `GET /api/cron/sync-hail` | storm ingestion worker | reshape |
| `GET/POST /api/cron/xweather-hail` | storm ingestion worker | reshape |
| `GET /api/cron/storm-alerts` | storm ingestion worker | reshape |
| `GET /api/corelogic/parcels` | internal CoreLogic enrichment service | reshape |
| `POST /api/route-optimize` | mission rebalance/reroute internals | reshape |
| `GET /api/places-autocomplete` | optional address input helper | reshape |
| `GET /api/street-view` | No target in V2 contract | remove |
| `GET/POST /api/door-knocks` | `mission_stops` outcomes | reshape |
| `GET/POST /api/activities` | `mission_events` / `ops_alerts` | reshape |
| `GET/POST /api/teams` | supporting team admin | reshape |
| `GET /api/teams/[id]/leaderboard` | Team leaderboard | reshape |
| `GET/POST/DELETE /api/teams/[id]/members` | team assignment support | reshape |
| `GET/POST/PUT/DELETE /api/territories` | `watchlists` | reshape |
| `GET/POST /api/territories/[id]/leads` | `GET /api/houses/today` scoped by watchlist | reshape |
| `POST /api/admin/feature-flags` | feature flag admin support | reshape |
| `GET /api/auth/me` | auth/session helper | reshape |
| `POST /api/auth/update-profile` | settings profile update | reshape |
| `GET /(auth)/callback` | `POST /api/auth/callback` | reshape |
| `POST /api/reports/generate` | `POST /api/documents/generate` | reshape |
| `POST /api/download-report-csv` | No target in V2 contract | remove |
| `POST /api/estimate-ocr` | No target in V2 contract | remove |
| `POST /api/roof-measurement` | No target in V2 contract | remove |
| `GET/POST /api/xactimate` | No target in V2 contract | remove |
| `POST /api/xactimate/upload` | No target in V2 contract | remove |
| `POST /api/xactimate/[id]/analyze` | No target in V2 contract | remove |
| `POST /api/xactimate/[id]/supplement` | No target in V2 contract | remove |
| `POST /api/supplements` | No target in V2 contract | remove |
| `POST /api/carriers` | No target in V2 contract | remove |
| `GET /api/knock-list/properties` | `GET /api/houses/today` | reshape |
| `POST /api/knock-list/properties` | `POST /api/houses/:id/assign` | reshape |
| `GET /api/debug-supabase` | dev-only diagnostics | reshape |
| `—` | `GET /api/dashboard/today` | new |
| `—` | `GET /api/dashboard/ai-brief` | new |
| `—` | `GET /api/dashboard/export-summary` | new |
| `—` | `GET /api/storm-zones` | new |
| `—` | `GET /api/storm-zones/:id` | new |
| `—` | `POST /api/storm-zones/:id/generate-mission` | new |
| `—` | `GET /api/watchlists` | new |
| `—` | `POST /api/watchlists` | new |
| `—` | `GET /api/houses/today` | new |
| `—` | `GET /api/houses/nearby` | new |
| `—` | `GET /api/houses/:id` | new |
| `—` | `POST /api/houses/:id/assign` | new |
| `—` | `POST /api/houses/:id/send-to-jobnimbus` | new |
| `—` | `GET /api/missions/:id` | new |
| `—` | `PATCH /api/missions/:id` | new |
| `—` | `PATCH /api/mission-stops/:id/outcome` | new |
| `—` | `POST /api/missions/:id/rebalance` | new |
| `—` | `POST /api/presence/heartbeat` | new |
| `—` | `POST /api/presence/start-mission` | new |
| `—` | `POST /api/presence/end-mission` | new |
| `—` | `GET /api/team/live` | new |
| `—` | `GET /api/team/exceptions` | new |
| `—` | `POST /api/team/reassign` | new |
| `—` | `POST /api/ai/mission-copilot` | new |
| `—` | `POST /api/ai/opportunity-summary` | new |
| `—` | `POST /api/ai/objection-response` | new |
| `—` | `POST /api/ai/negotiation-coach` | new |
| `—` | `POST /api/ai/follow-up-writer` | new |
| `—` | `POST /api/ai/reassignment-suggestions` | new |
| `—` | `POST /api/ai/document-draft` | new |
| `—` | `GET /api/documents` | new |
| `—` | `GET /api/documents/:id` | new |
| `—` | `PATCH /api/documents/:id` | new |
| `—` | `POST /api/documents/:id/export` | new |
| `—` | `GET /api/exports` | new |
| `—` | `POST /api/exports/jobnimbus` | new |
| `—` | `POST /api/exports/:id/retry` | new |
| `—` | `GET /api/exports/:id/status` | new |

### 3. Service/Lib Mapping

| Current Module | Target Use | Action |
|---|---|---|
| `src/services/missionService.ts` | `missions`, `mission_stops`, storm→mission orchestration | reshape |
| `src/services/leadService.ts` | house/target scoring + assignment service | reshape |
| `src/services/routeService.ts` | reroute + mission rebalance provider abstraction | reuse |
| `src/services/parcelCacheService.ts` | CoreLogic parcel cache access (`parcel_cache`) | reuse |
| `src/services/analytics/queries.ts` | V2 KPI/query layer | new (currently empty) |
| `src/services/users/queries.ts` | role/branch/team profile reads | new (currently empty) |
| `src/services/users/mutations.ts` | profile/role mutations | new (currently empty) |
| `src/services/subscriptions/queries.ts` | billing read model | review (currently empty) |
| `src/services/subscriptions/mutations.ts` | billing write model | review (currently empty) |
| `src/services/subscriptions/limits.ts` | feature-gate limits | review (currently empty) |
| `src/lib/api-middleware.ts` | auth, response envelope, request logging | reshape |
| `src/lib/metrics.ts` | structured metrics emitter | reuse |
| `src/lib/eventBus.ts` | mission/ops events | reuse |
| `src/lib/featureFlag.ts` | feature flag checks (`ai.enabled` etc.) | reuse |
| `src/lib/xweather.ts` | primary storm ingestion provider | reuse |
| `src/lib/corelogic.ts` | property intelligence enrichment | reuse |
| `src/lib/jobnimbus/client.ts` | downstream export integration client | reuse |
| `src/lib/jobnimbus/index.ts` | JobNimbus export entrypoint | reuse |
| `src/lib/threatScore.ts` | opportunity score primitive | reshape |
| `src/lib/lead-scoring.ts` | `target_scores` scoring pipeline | reshape |
| `src/lib/scoreOneLead.ts` | per-target scoring helper | reshape |
| `src/lib/ai.ts` | AI request orchestration | reshape |
| `src/lib/ai/client.ts` | OpenAI client wrapper | reuse |
| `src/lib/ai/config.ts` | AI config + model defaults | reshape |
| `src/lib/ai/chat.ts` | generic chat module | remove |
| `src/lib/ai/estimate-generator.ts` | estimate generation | remove |
| `src/lib/ai/report-generator.ts` | report generation | reshape to documents |
| `src/lib/ai/damage-analyzer.ts` | damage analysis module | remove |
| `src/lib/ai/prompts/report-prompt.ts` | document prompt templates | reshape |
| `src/lib/ai/prompts/estimate-prompt.ts` | estimate prompts | remove |
| `src/lib/ai/prompts/damage-analysis-prompt.ts` | damage prompts | remove |
| `src/lib/pdf.ts` | PDF generation utility | reshape |
| `src/lib/pdf/report-pdf.ts` | document rendering | reshape |
| `src/lib/pdf/estimate-pdf.ts` | estimate PDF rendering | remove |
| `src/lib/objection-library.ts` | objection response seed content | reuse |
| `src/lib/message-sequences.ts` | follow-up writer content library | reshape |
| `src/lib/csv/parser.ts` | CSV import utility (storm/property ingest support) | review |
| `src/lib/csv/index.ts` | CSV utility barrel | review |
| `src/lib/subscriptions/tiers.ts` | billing tiers + feature access constants | reuse |
| `src/lib/subscriptions/access.ts` | subscription access checks | reuse |
| `src/lib/subscriptions/index.ts` | billing utilities index | reuse |
| `src/lib/supabase/client.ts` | browser Supabase client | reuse |
| `src/lib/supabase/server.ts` | server Supabase client | reuse |
| `src/lib/supabase/admin.ts` | service-role Supabase client | reuse |
| `src/lib/supabase/middleware.ts` | auth session middleware | reuse |
| `src/lib/stripe/config.ts` | Stripe config | reuse |
| `src/lib/stripe/client.ts` | Stripe SDK client | reuse |
| `src/lib/stripe/checkout.ts` | billing checkout | reuse |
| `src/lib/stripe/portal.ts` | billing portal | reuse |
| `src/lib/stripe/subscription.ts` | subscription sync logic | reuse |
| `src/lib/stripe/webhook-endpoint.ts` | Stripe webhook endpoint logic | reuse |
| `src/lib/stripe/webhook-handlers.ts` | Stripe event handlers | reuse |

### 4. Reusable Assets

- **Components (carry forward unchanged):**
  - `src/components/ui/button.tsx`
  - `src/components/ui/card.tsx`
  - `src/components/ui/table.tsx`
  - `src/components/ui/dialog.tsx`
  - `src/components/ui/modal.tsx`
  - `src/components/ui/tabs.tsx`
  - `src/components/ui/badge.tsx`
  - `src/components/ui/skeleton.tsx`
  - `src/components/ui/input.tsx`
  - `src/components/ui/textarea.tsx`
  - `src/components/ui/select.tsx`
  - `src/components/ui/checkbox.tsx`
  - `src/components/ui/switch.tsx`
  - `src/components/ui/toast.tsx`
  - `src/components/ui/tooltip.tsx`
  - `src/components/ui/avatar.tsx`
  - `src/components/ui/dropdown.tsx`
  - `src/components/ui/pagination.tsx`
  - `src/components/ui/progress.tsx`
  - `src/components/ui/radio.tsx`
  - `src/components/ui/MapboxMap.tsx` (as shared map base, styling reshape only)
- **Hooks (carry forward unchanged):**
  - `src/hooks/useGeolocation.ts`
  - `src/hooks/ui/use-debounce.ts`
  - `src/hooks/ui/use-media-query.ts`
  - `src/hooks/ui/use-modal.ts`
  - `src/hooks/ui/use-toast.ts`
  - `src/hooks/auth/use-auth.ts`
  - `src/hooks/auth/use-session.ts`
  - `src/hooks/auth/use-user.ts`
- **Utilities/infra (carry forward unchanged):**
  - `src/lib/supabase/client.ts`
  - `src/lib/supabase/server.ts`
  - `src/lib/supabase/admin.ts`
  - `src/lib/eventBus.ts`
  - `src/lib/metrics.ts`
  - `src/lib/featureFlag.ts`
  - `src/services/routeService.ts`
  - `src/services/parcelCacheService.ts`
- **Styles (carry forward unchanged):**
  - `src/styles/globals.css` (token system + shell spacing already aligned)
  - `tailwind.config.ts` storm palette and spacing tokens

### 5. Dead Weight

- **Routes/screens to hide from primary navigation now:**
  - `/dashboard/carriers`
  - `/dashboard/roof-measurement`
  - `/dashboard/roof-measure`
  - `/dashboard/estimate-generator`
  - `/dashboard/supplements`
  - `/dashboard/xactimate`
- **API routes to remove (explicit architecture drift):**
  - `src/app/api/supplements/route.ts`
  - `src/app/api/xactimate/**`
  - `src/app/api/estimate-ocr/route.ts`
  - `src/app/api/roof-measurement/route.ts`
  - `src/app/api/download-report-csv/route.ts`
  - `src/app/api/carriers/route.ts`
  - `src/app/api/street-view/route.ts`
  - `src/app/api/ai/chat/route.ts`
- **Legacy modules to de-prioritize/remove after migration:**
  - `src/lib/ai/estimate-generator.ts`
  - `src/lib/ai/damage-analyzer.ts`
  - `src/lib/ai/prompts/estimate-prompt.ts`
  - `src/lib/ai/prompts/damage-analysis-prompt.ts`
  - `src/lib/pdf/estimate-pdf.ts`
- **Primary-nav drift currently present in sidebar labels:**
  - `Revenue Hub`, `Storm Ops`, `AI Assistant`, `Deal Desk` in `src/components/dashboard/Sidebar.tsx` (must become exact V2 nav set/order)

### 6. New Build List

- **Phase 1 (foundation + intelligence):**
  1. Build canonical `Storms` screen (`/storms`) with `Live Storm Map`, timeline, zones, watchlist alerts, AI recommendation panel.
  2. Build canonical `Dashboard` widget set exactly as contract (all 9 widgets).
  3. Build `Houses To Hit Today` table with exact 11 fields + 6 row actions.
  4. Implement canonical APIs: `/api/dashboard/today`, `/api/dashboard/ai-brief`, `/api/dashboard/export-summary`.
  5. Implement `storm_zones`, `target_scores` pipelines and `/api/storm-zones*` endpoints.
- **Phase 2 (execution + live ops):**
  1. Build canonical `Missions` screen with mission list/map/stops/outcome feed/export shortcuts.
  2. Build `presence` APIs (`heartbeat`, `start-mission`, `end-mission`) and live `rep_presence` ingestion.
  3. Build canonical `Team` exceptions pipeline + `/api/team/live`, `/api/team/exceptions`, `/api/team/reassign`.
  4. Build `/api/mission-stops/:id/outcome` and `/api/missions/:id/rebalance`.
- **Phase 3 (command center + handoff):**
  1. Build canonical `Mission Control` TV mode with all 12 required widgets.
  2. Build canonical `Documents` APIs and generation pipeline for all 10 document types.
  3. Build canonical `Exports` queue UX + APIs (`/api/exports*`) with retry and status tracking.
  4. Build JobNimbus handoff summary generator and durable export queue workers.
- **Phase 4 (advanced AI + enterprise hardening):**
  1. Build AI Studio’s full 10-module architecture with contextual inputs and explainable outputs.
  2. Build branch/team role scoping (Owner cross-branch, Manager branch-limited).
  3. Build observability alerting and hardening thresholds from contract.
  4. Complete V1 route/module deprecation + migration cleanup.

### 7. Migration Needs

- **New core tables required (not present as canonical names):**
  - `branches`
  - `rep_presence` (existing `team_locations` can be reshaped)
  - `storm_events` (existing `storm_events_cache` can be reshaped)
  - `storm_zones`
  - `territory_watchlists` (existing `territories` can be reshaped)
  - `targets` (existing `leads` can be reshaped)
  - `target_scores`
  - `missions` (existing `canvass_missions` can be reshaped/renamed)
  - `mission_events`
  - `opportunity_exports` (existing `lead_exports` can be reshaped/renamed)
  - `documents`
  - `ai_sessions`
  - `ops_alerts`
  - `integration_sync_logs` (existing `jobnimbus_sync_log` can be generalized)
  - `data_freshness_snapshots`
  - `jobnimbus_export_queue`
  - `document_templates`
  - `company_ai_profiles`
- **Table rename/compatibility migration strategy:**
  - `leads` → `targets` (or create `targets` view + phased backfill)
  - `canvass_missions` → `missions`
  - keep `mission_stops` but align statuses to contract enum (`new`, `targeted`, `attempted`, `no_answer`, `interested`, `not_interested`, `follow_up_needed`, `sent_to_jobnimbus`)
  - `storm_events_cache` → `storm_events`
  - `territories` → `territory_watchlists`
  - `lead_exports`/`jobnimbus_*` export artifacts → `opportunity_exports` + `jobnimbus_export_queue`
- **Deprecation/data freeze migrations needed:**
  - Freeze V1 feature tables from future writes: `reports`, `followups`, `objections`, `roof_photos`, `email_drafts`, `xactimate_estimates`, `door_knocks`.
  - Add migration notes + RLS hardening for read-only historical access where needed.
- **Schema standards to enforce via migrations:**
  - Ensure every core V2 table includes `id`, `created_at`, `updated_at`.
  - Add explicit foreign keys + indexes for all relation columns.
  - Ensure all core V2 tables have RLS enabled and role-aware policies.
  - Ensure UTC `timestamptz` types for all timestamps.
- **Procedures/functions needed:**
  - Idempotent write RPCs for mission creation and export enqueue.
  - `get_parcels_in_polygon` and `upsert_parcel_cache` already used; retain and version.
  - New scoring RPC/functions for `target_scores` recomputation.
- **Data migration jobs needed:**
  - Backfill `targets` from `leads`.
  - Backfill `missions` from `canvass_missions`.
  - Backfill `opportunity_exports` from `lead_exports` and JobNimbus logs.
  - Backfill `storm_events` from `hail_events` + `storm_events_cache`.
- **Operational migrations:**
  - Add `data_freshness_snapshots` writes in storm ingestion jobs.
  - Add integration audit writes to generalized `integration_sync_logs` for every third-party call.
  - Add feature flags for each AI module (`ai.daily_brief`, `ai.mission_copilot`, `ai.objection_response`, etc.).
