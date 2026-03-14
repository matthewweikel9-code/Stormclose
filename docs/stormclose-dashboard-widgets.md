# Stormclose V2 — Dashboard Widget Specification

> Canonical reference for every widget on the Dashboard screen.
> Derives from: `PRODUCT_CONTRACT_V2.md` §5 (Dashboard), `stormclose-enterprise-architecture.md` §5 (Screen Architecture), `stormclose-navigation-design.md` §4 (Page Shell Rules).
> Last updated: 2026-03-14

---

## Dashboard Overview

**Purpose:** Decide what the company should work today.

**API endpoint:** `GET /api/dashboard/today`

**KPI strip metrics (4):**

| Position | Label | Source | Format |
|---|---|---|---|
| 1 (primary) | Houses To Hit | `housesToHitCount` | Integer, `text-storm-purple` |
| 2 | Active Missions | `activeMissionCount` | Integer |
| 3 | Reps In Field | `repsInFieldCount` | Integer |
| 4 | Exports Today | `exportsTodayCount` | Integer |

**Grid layout:**

```
Desktop (xl, ≥1280px) — 3 columns
┌──────────────────────────────────────────────────────────────────┐
│ AI Daily Brief                                    (col-span-2)  │
│                                                                  │
├─────────────────────────────────────┬────────────────────────────┤
│                                     │ Top Storm Zones            │
│                                     │ (col-span-1)               │
│ Houses To Hit Today                 ├────────────────────────────┤
│ (col-span-2, row-span-2)           │ AI Deployment Plan         │
│                                     │ (col-span-1)               │
│                                     ├────────────────────────────┤
│                                     │ Live Team Snapshot         │
│                                     │ (col-span-1)               │
├─────────────────────────────────────┼────────────────────────────┤
│ Unassigned Hot Clusters             │ Recent Qualified           │
│ (col-span-1)                        │ Opportunities (col-span-1) │
├─────────────────────────────────────┼────────────────────────────┤
│ Export Queue Summary (col-span-1)   │ System Freshness           │
│                                     │ (col-span-1)               │
└─────────────────────────────────────┴────────────────────────────┘

Tablet (md, 768–1279px) — 2 columns
- AI Daily Brief: col-span-2
- Houses To Hit Today: col-span-2
- Everything else: col-span-1

Mobile (<768px) — 1 column, stacked
- AI Daily Brief
- Houses To Hit Today (horizontal scroll for table)
- Remaining widgets in document order
- Unassigned Hot Clusters: hidden
- System Freshness: hidden
```

---

## Widget Template Key

Each widget below follows this structure:

1. **Data Contract** — TypeScript interface, exact fields, source tables/services
2. **KPI Calculations** — Formulas for any derived metrics
3. **Role Differences** — Visibility and content per role
4. **Row Actions** — Interactive elements (where applicable)
5. **Layout** — Grid position, responsive behavior
6. **Empty State** — What renders when no data
7. **Refresh Behavior** — Polling interval or static

---

## Widget 1: AI Daily Brief

### 1.1 Data Contract

**API:** `GET /api/dashboard/ai-brief`

**Response envelope:** `{ data: AIDailyBrief, error: string | null, meta: { generatedAt: string } }`

```typescript
// src/types/dashboard.ts

export interface AIDailyBrief {
  /** Pre-rendered markdown summary (2–4 paragraphs). */
  summary: string;
  /** Structured highlights extracted by the AI. */
  highlights: AIDailyBriefHighlight[];
  /** ISO 8601 timestamp when this brief was generated. */
  generatedAt: string;
  /** Model identifier used to generate the brief. */
  model: string;
  /** Total token count consumed. */
  tokenCount: number;
}

export interface AIDailyBriefHighlight {
  /** "storm" | "mission" | "team" | "export" | "opportunity" */
  category: "storm" | "mission" | "team" | "export" | "opportunity";
  /** One-line insight. */
  text: string;
  /** Optional deep link (e.g., "/dashboard/storms?zone=abc"). */
  href: string | null;
}
```

**Source tables/services:**
- `storm_zones` — active zones, severity scores, recency
- `targets` + `target_scores` — today's ranked houses count, average score
- `missions` — active/planned/completed counts, completion rate
- `rep_presence` — reps currently in field
- `opportunity_exports` — exports queued/completed/failed today
- `ai_sessions` — logged after generation
- AI provider: OpenAI `gpt-4o` via `POST /api/ai/daily-brief`

### 1.2 KPI Calculations

No standalone KPIs. The AI constructs prose from these input metrics:

| Metric | Formula |
|---|---|
| New storm zones (24h) | `COUNT(storm_zones WHERE created_at > NOW() - INTERVAL '24 hours')` |
| Houses ranked today | `COUNT(target_scores WHERE scored_at::date = CURRENT_DATE)` |
| Mission completion rate | `COUNT(missions WHERE status = 'completed' AND updated_at::date = CURRENT_DATE) / NULLIF(COUNT(missions WHERE status IN ('active','completed') AND updated_at::date = CURRENT_DATE), 0)` |
| Export success rate | `COUNT(opportunity_exports WHERE status = 'success' AND created_at::date = CURRENT_DATE) / NULLIF(COUNT(opportunity_exports WHERE created_at::date = CURRENT_DATE), 0)` |
| Team coverage | `COUNT(DISTINCT rep_presence.user_id WHERE status = 'active') / NULLIF(COUNT(DISTINCT users WHERE role = 'rep'), 0)` |

### 1.3 Role Differences

| Role | Behavior |
|---|---|
| Owner | Full brief: all zones, cross-branch stats, revenue projections |
| Manager | Full brief: own branch zones, own team stats |
| Rep | Scoped brief: "Your mission today…", personal house count, personal outcomes yesterday |
| Office Admin | Full brief: same as Manager (read-only context) |

### 1.4 Row Actions

| Action | Label | Behavior |
|---|---|---|
| Regenerate | "Refresh Brief" | `POST /api/ai/daily-brief` with `{ force: true }` — re-generates and replaces cached brief |
| Expand/Collapse | Toggle | Expands from 2-line preview to full summary |

### 1.5 Layout

- **Grid:** `col-span-2` on desktop (xl), `col-span-2` on tablet (md), `col-span-1` on mobile
- **Min height:** `min-h-[200px]`
- **Position:** Row 1, first widget
- **Card style:** Standard `bg-storm-z2 border border-storm-border rounded-2xl p-5` with a purple `Sparkles` icon in header

### 1.6 Empty State

- **Icon:** `Sparkles` (h-12 w-12, `text-storm-subtle/50`)
- **Heading:** "No daily brief generated yet"
- **Body:** "Click below to generate your AI-powered daily operations summary."
- **Action:** Button — "Generate Brief" → `POST /api/ai/daily-brief`

### 1.7 Refresh Behavior

- **Auto-refresh:** No. Generated once per day or on-demand.
- **Cache:** Server caches per user per calendar day. `GET /api/dashboard/ai-brief` returns cached version if generated within the current UTC day.
- **Stale indicator:** If `generatedAt` is > 12 hours old, show amber "Stale" badge next to timestamp.

---

## Widget 2: Houses To Hit Today

### 2.1 Data Contract

**API:** `GET /api/houses/today?page=1&limit=25&sort=opportunity_score&order=desc`

**Response envelope:** `{ data: HouseToHit[], error: string | null, meta: { total: number, page: number, limit: number, generatedAt: string } }`

```typescript
export interface HouseToHit {
  /** UUID from targets table. */
  id: string;
  /** Full street address. */
  address: string;
  /** Neighborhood or city name. */
  neighborhood: string;
  /** City. */
  city: string;
  /** State abbreviation. */
  state: string;
  /** Zip code. */
  zip: string;
  /** Foreign key to storm_zones. */
  stormZoneId: string;
  /** Storm zone display name (e.g., "North Dallas Hail Corridor"). */
  stormZoneName: string;
  /** Composite opportunity score (0–100). */
  opportunityScore: number;
  /** Score tier derived from opportunityScore. */
  scoreTier: "hot" | "warm" | "moderate" | "cold";
  /** Days since the storm event that created this zone. */
  stormAgeDays: number;
  /** Storm severity label. */
  stormSeverity: "extreme" | "severe" | "moderate" | "minor";
  /** Estimated claim value band. */
  estimatedValueBand: "$5k–$10k" | "$10k–$20k" | "$20k–$40k" | "$40k+" | "Unknown";
  /** Assigned rep user ID, null if unassigned. */
  assignedRepId: string | null;
  /** Assigned rep display name, null if unassigned. */
  assignedRepName: string | null;
  /** Mission ID if part of a mission, null otherwise. */
  missionId: string | null;
  /** Current status of this target. */
  status: "new" | "targeted" | "attempted" | "no_answer" | "interested" | "not_interested" | "follow_up_needed" | "sent_to_jobnimbus";
  /** Distance in miles from the active rep or office. */
  distanceMiles: number | null;
  /** AI-generated one-line reason for this ranking. */
  aiRankingReason: string;
  /** Latitude. */
  lat: number;
  /** Longitude. */
  lng: number;
  /** Property year built (from CoreLogic cache). */
  yearBuilt: number | null;
  /** Roof age in years (computed from yearBuilt). */
  roofAge: number | null;
  /** Property assessed value (from CoreLogic cache). */
  assessedValue: number | null;
}
```

**Source tables/services:**
- `targets` — address, lat/lng, property attributes
- `target_scores` — opportunity score, AI ranking reason, scored_at
- `storm_zones` — zone name, severity, storm age
- `storm_events` — original event dates for storm age calculation
- `missions` + `mission_stops` — assigned rep, mission membership, stop status
- `parcel_cache` (via `ParcelCacheService`) — yearBuilt, assessedValue, roofAge
- `rep_presence` — for distance calculation when a rep is active
- Company office lat/lng from `company_ai_profiles` — fallback distance anchor

### 2.2 KPI Calculations

| Metric | Formula |
|---|---|
| `opportunityScore` | `calculateThreatScore({ hailSize, windSpeed, stormDurationMinutes, proximityScore, parcelValueNormalized, roofAgeYears })` — produces 0–100 using weights from `threatWeights.json` (hailSize: 0.35, windSpeed: 0.20, duration: 0.10, proximity: 0.15, value: 0.10, roofAge: 0.10) |
| `scoreTier` | `≥80 = "hot"`, `≥60 = "warm"`, `≥40 = "moderate"`, `<40 = "cold"` |
| `stormAgeDays` | `FLOOR(EXTRACT(EPOCH FROM (NOW() - storm_events.event_occurred_at)) / 86400)` |
| `stormSeverity` | Derived from max hail size in zone: `≥2.0" = "extreme"`, `≥1.5" = "severe"`, `≥1.0" = "moderate"`, `<1.0" = "minor"` |
| `estimatedValueBand` | From `estimateClaimValue()` in `corelogic.ts`: uses assessedValue, roofType, roofAge, squareFootage → returns `{ low, high, confidence }` → bucketed into display bands |
| `distanceMiles` | Haversine from active rep position (`rep_presence`) or office location to target lat/lng |

### 2.3 Role Differences

| Role | Behavior |
|---|---|
| Owner | All houses across all branches. Sort/filter by branch available. |
| Manager | All houses for own branch. |
| Rep | Only houses assigned to them (via `mission_stops` where `mission.assigned_rep_id = user.id`). Unassigned houses hidden. |
| Office Admin | All houses for own branch (read-only — no Assign or Add to Mission actions). |

### 2.4 Row Actions

| # | Action Label | Button Style | API Call | Behavior | Available Roles |
|---|---|---|---|---|---|
| 1 | **Assign** | Ghost, `text-storm-purple` | `POST /api/houses/:id/assign` `{ repId }` | Opens rep-picker dropdown → assigns target to rep | Owner, Manager |
| 2 | **Add to Mission** | Ghost, `text-storm-purple` | `PATCH /api/missions/:id` `{ addStops: [houseId] }` | Opens mission-picker dropdown → adds house as mission stop | Owner, Manager |
| 3 | **View Details** | Ghost, `text-white` | — (client-side) | Opens House Detail drawer (right-side, 480px) | All roles |
| 4 | **Send to JobNimbus** | Ghost, `text-brand-500` | `POST /api/houses/:id/send-to-jobnimbus` | Queues export → shows confirmation toast. Only enabled when `status = "interested"` | Owner, Manager, Office Admin |
| 5 | **AI Assist** | Ghost, `text-storm-purple` with `Sparkles` icon | `POST /api/ai/opportunity-summary` `{ targetId }` | Opens AI assist popover with opportunity summary, suggested pitch, objection prep | Owner, Manager, Rep |
| 6 | **Generate Document** | Ghost, `text-white` | `POST /api/documents/generate` `{ targetId, type }` | Opens document-type picker → generates leave-behind or follow-up letter | Owner, Manager, Rep (leave-behind only), Office Admin |

**Row click behavior:** Opens House Detail drawer (same as "View Details").

**Table features:**
- Sortable columns: opportunityScore (default desc), stormAgeDays, estimatedValueBand, distanceMiles, status
- Filterable by: scoreTier, stormZoneName, status, assignedRepId
- Pagination: server-side, 25 rows per page default
- Sticky header row
- Row background: `bg-storm-z1`, hover: `bg-storm-z2`
- Score tier badge colors: hot = `bg-red-500/20 text-red-400`, warm = `bg-amber-500/20 text-amber-400`, moderate = `bg-blue-500/20 text-blue-400`, cold = `bg-slate-500/20 text-slate-400`

### 2.5 Layout

- **Grid:** `col-span-2` on desktop (xl), `col-span-2` on tablet (md), `col-span-1` on mobile
- **Row span:** 2 rows on desktop (this is the dominant widget)
- **Min height:** `min-h-[480px]`
- **Position:** Row 2–3, left two columns
- **Mobile:** Table scrolls horizontally. Shows: address, score badge, status, action overflow menu (⋯)
- **Card style:** `bg-storm-z2 border border-storm-border rounded-2xl p-0` (no padding — table fills card)

### 2.6 Empty State

- **Icon:** `Home` (lucide, h-12 w-12, `text-storm-subtle/50`)
- **Heading:** "No houses ranked yet"
- **Body:** "Houses will appear here once storm zones are scored and targets are ranked."
- **Action:** Button — "View Storms" → navigates to `/dashboard/storms`

### 2.7 Refresh Behavior

- **Auto-refresh:** Every **60 seconds** (polling). Only refreshes the current page of data.
- **Manual refresh:** Pull-to-refresh on mobile, refresh icon in card header on desktop.
- **Optimistic updates:** When a row action is taken (Assign, Send to JobNimbus), the row updates immediately in the UI before the API responds. Reverts on error.

---

## Widget 3: Top Storm Zones

### 3.1 Data Contract

**API:** `GET /api/storm-zones?sort=score&order=desc&limit=5&status=active`

**Response envelope:** `{ data: StormZoneSummary[], error: string | null, meta: { total: number } }`

```typescript
export interface StormZoneSummary {
  /** UUID from storm_zones table. */
  id: string;
  /** Display name (e.g., "North Dallas Hail Corridor"). */
  name: string;
  /** Composite zone score (0–100). */
  score: number;
  /** Zone severity label. */
  severity: "extreme" | "severe" | "moderate" | "minor";
  /** Total impacted houses in this zone. */
  houseCount: number;
  /** Houses not yet assigned or attempted. */
  unworkedHouseCount: number;
  /** Days since the storm event that created this zone. */
  stormAgeDays: number;
  /** Zone centroid latitude. */
  lat: number;
  /** Zone centroid longitude. */
  lng: number;
  /** Zone polygon as GeoJSON (for map rendering). */
  geometry: GeoJSON.Polygon | null;
  /** Number of active missions operating in this zone. */
  activeMissionCount: number;
}
```

**Source tables/services:**
- `storm_zones` — id, name, score, severity, geometry, created_at
- `storm_events` — event_occurred_at (for storm age)
- `targets` — count per zone
- `target_scores` — for unworked count (status = "new")
- `missions` — active missions referencing this zone

### 3.2 KPI Calculations

| Metric | Formula |
|---|---|
| `score` | Average of all `target_scores.opportunity_score` within the zone, weighted by zone-level storm severity multiplier: `AVG(target_scores.opportunity_score) * severity_multiplier` where extreme=1.0, severe=0.85, moderate=0.65, minor=0.45 |
| `unworkedHouseCount` | `COUNT(targets WHERE storm_zone_id = :id AND id NOT IN (SELECT target_id FROM mission_stops WHERE status NOT IN ('new')))` |
| `stormAgeDays` | Same formula as Houses To Hit |

### 3.3 Role Differences

| Role | Behavior |
|---|---|
| Owner | Visible. All zones across all branches. |
| Manager | Visible. Zones within branch territory. |
| Rep | **Hidden.** Widget not rendered. |
| Office Admin | **Hidden.** Widget not rendered. |

### 3.4 Row Actions

| Action | Label | API | Behavior |
|---|---|---|---|
| Zone click | — | — (client-side) | Opens Storm Zone Detail drawer |
| Generate Mission | "Generate Mission" | `POST /api/storm-zones/:id/generate-mission` | Creates a mission from the top unworked houses in this zone |
| View on Map | "Map" icon button | — (client-side) | Navigates to `/dashboard/storms?zone=:id` |

### 3.5 Layout

- **Grid:** `col-span-1` on desktop, `col-span-1` on tablet, `col-span-1` on mobile
- **Position:** Row 2, right column
- **Card style:** Standard card. Each zone renders as a mini-card row inside the widget.
- **Mobile:** Stacked below Houses To Hit. Shows zone name, score badge, house count.

### 3.6 Empty State

- **Icon:** `CloudLightning` (h-12 w-12, `text-storm-subtle/50`)
- **Heading:** "No active storm zones"
- **Body:** "Storm zones will appear here when storm data is ingested and scored."
- **Action:** None

### 3.7 Refresh Behavior

- **Auto-refresh:** Every **5 minutes** (300s). Storm data changes slowly.
- **Cache:** Served from a materialized view or application-level cache on the server. The `data_freshness_snapshots` table tracks the last storm ingest time.

---

## Widget 4: AI Deployment Plan

### 4.1 Data Contract

**API:** `GET /api/dashboard/today` → `data.deploymentPlan` (sub-field of the main dashboard endpoint)

Alternatively, if generated on demand: `POST /api/ai/daily-brief` returns a `deploymentPlan` section.

```typescript
export interface AIDeploymentPlan {
  /** Whether a plan has been generated for today. */
  generated: boolean;
  /** ISO 8601 timestamp when this plan was generated. */
  generatedAt: string | null;
  /** Plan status. */
  status: "pending_approval" | "approved" | "auto_applied" | "expired";
  /** Individual assignments in the plan. */
  assignments: DeploymentAssignment[];
  /** AI reasoning summary (1–2 sentences). */
  reasoning: string;
}

export interface DeploymentAssignment {
  /** Rep user ID. */
  repId: string;
  /** Rep display name. */
  repName: string;
  /** Target storm zone ID. */
  stormZoneId: string;
  /** Target storm zone name. */
  stormZoneName: string;
  /** Estimated house count for this rep in this zone. */
  estimatedHouseCount: number;
  /** Whether a mission already exists for this assignment. */
  missionCreated: boolean;
  /** Mission ID if created. */
  missionId: string | null;
}
```

**Source tables/services:**
- `ai_sessions` — the most recent `daily-brief` session for today
- `storm_zones` — active zones
- `users` — reps available (role = "rep", active)
- `rep_presence` — last known locations for proximity calculation
- `missions` — existing missions to avoid duplicate assignment
- AI provider: OpenAI `gpt-4o` for plan generation

### 4.2 KPI Calculations

| Metric | Formula |
|---|---|
| Coverage % | `COUNT(DISTINCT assignments.stormZoneId) / NULLIF(COUNT(storm_zones WHERE status = 'active'), 0) * 100` |
| Reps deployed | `COUNT(DISTINCT assignments.repId)` |
| Houses planned | `SUM(assignments.estimatedHouseCount)` |

### 4.3 Role Differences

| Role | Behavior |
|---|---|
| Owner | Visible. Can approve or reject the plan. Shows all branches. |
| Manager | Visible. Can approve or reject the plan. Shows own branch. |
| Rep | **Hidden.** Widget not rendered. |
| Office Admin | **Hidden.** Widget not rendered. |

### 4.4 Row Actions

| Action | Label | API | Behavior |
|---|---|---|---|
| Approve Plan | "Approve" | `PATCH /api/dashboard/deployment-plan` `{ status: "approved" }` | Converts assignments to missions. Button becomes "Approved ✓". |
| Reject Plan | "Dismiss" | `PATCH /api/dashboard/deployment-plan` `{ status: "expired" }` | Marks the plan as expired. |
| Regenerate | "Regenerate" | `POST /api/ai/daily-brief` `{ force: true }` | Generates a new plan. |

### 4.5 Layout

- **Grid:** `col-span-1` on desktop, `col-span-1` on tablet, `col-span-1` on mobile
- **Position:** Row 3, right column (below Top Storm Zones)
- **Card style:** Standard card with a purple top border (`border-t-2 border-storm-purple`) to signal AI content.

### 4.6 Empty State

- **Icon:** `Sparkles` (h-12 w-12, `text-storm-subtle/50`)
- **Heading:** "No deployment plan generated"
- **Body:** "Generate a daily brief to receive an AI-recommended rep deployment plan."
- **Action:** Button — "Generate Brief" → `POST /api/ai/daily-brief`

### 4.7 Refresh Behavior

- **Auto-refresh:** No. Plan is generated once per day or on-demand.
- **Status polling:** If `status = "pending_approval"`, poll every **30 seconds** to check if another manager approved it.

---

## Widget 5: Live Team Snapshot

### 5.1 Data Contract

**API:** `GET /api/team/live`

**Response envelope:** `{ data: TeamSnapshot, error: string | null, meta: { updatedAt: string } }`

```typescript
export interface TeamSnapshot {
  /** Total reps with role = "rep" in this branch. */
  totalReps: number;
  /** Reps currently in active mission mode (sharing location). */
  repsInField: number;
  /** Reps who are idle (last heartbeat > 15 min ago during active mission). */
  repsIdle: number;
  /** Reps with no active mission today. */
  repsUndeployed: number;
  /** Individual rep summaries. */
  reps: RepSnapshotRow[];
}

export interface RepSnapshotRow {
  /** User ID. */
  id: string;
  /** Display name. */
  name: string;
  /** Avatar URL. */
  avatarUrl: string | null;
  /** "active" | "idle" | "offline" | "paused" */
  fieldStatus: "active" | "idle" | "offline" | "paused";
  /** Current mission ID, null if none. */
  activeMissionId: string | null;
  /** Current mission name. */
  activeMissionName: string | null;
  /** Houses completed in current mission. */
  housesCompleted: number;
  /** Houses remaining in current mission. */
  housesRemaining: number;
  /** Seconds since last heartbeat. */
  lastHeartbeatSecondsAgo: number;
}
```

**Source tables/services:**
- `users` — rep roster (role = "rep")
- `rep_presence` — lat/lng, status, last_heartbeat_at, active_mission_id
- `missions` — mission name, status
- `mission_stops` — completion counts per mission

### 5.2 KPI Calculations

| Metric | Formula |
|---|---|
| `repsInField` | `COUNT(rep_presence WHERE status = 'active' AND last_heartbeat_at > NOW() - INTERVAL '5 minutes')` |
| `repsIdle` | `COUNT(rep_presence WHERE status = 'active' AND last_heartbeat_at BETWEEN NOW() - INTERVAL '15 minutes' AND NOW() - INTERVAL '5 minutes')` |
| `repsUndeployed` | `totalReps - COUNT(DISTINCT rep_presence.user_id WHERE status IN ('active','paused') AND updated_at::date = CURRENT_DATE)` |
| `fieldStatus` | `active` = heartbeat < 5 min, `idle` = heartbeat 5–15 min, `paused` = mission paused, `offline` = heartbeat > 15 min or no presence record today |

### 5.3 Role Differences

| Role | Behavior |
|---|---|
| Owner | Visible. Cross-branch view (all reps). |
| Manager | Visible. Own branch reps only. |
| Rep | **Hidden.** Widget not rendered. |
| Office Admin | Visible. Own branch reps, read-only. |

### 5.4 Row Actions

| Action | Label | API | Behavior |
|---|---|---|---|
| Rep row click | — | — (client-side) | Opens Rep Detail drawer |
| Reassign | "Reassign" | `POST /api/team/reassign` `{ repId, newMissionId }` | Opens mission-picker → reassigns rep |

### 5.5 Layout

- **Grid:** `col-span-1` on desktop, `col-span-1` on tablet, `col-span-1` on mobile
- **Position:** Row 4, right column (below AI Deployment Plan)
- **Max visible rows:** 5 (with "View all →" link to `/dashboard/team`)
- **Card style:** Standard card. Each rep renders as a compact row with status dot (green=active, amber=idle, red=offline, blue=paused), name, mission name truncated, and houses X/Y progress bar.

### 5.6 Empty State

- **Icon:** `Users` (h-12 w-12, `text-storm-subtle/50`)
- **Heading:** "No reps in field"
- **Body:** "Reps will appear here when they activate mission mode and begin sharing location."
- **Action:** None

### 5.7 Refresh Behavior

- **Auto-refresh:** Every **15 seconds** (live operational data).
- **Visual heartbeat:** Status dots pulse gently to indicate live data.

---

## Widget 6: Unassigned Hot Clusters

### 6.1 Data Contract

**API:** `GET /api/storm-zones?unworked=true&min_score=60&limit=5`

**Response envelope:** `{ data: HotCluster[], error: string | null, meta: { total: number } }`

```typescript
export interface HotCluster {
  /** UUID — this is a storm_zone ID with a computed cluster sub-region. */
  id: string;
  /** Cluster display label (generated from neighborhood + zone name). */
  label: string;
  /** Parent storm zone ID. */
  stormZoneId: string;
  /** Parent storm zone name. */
  stormZoneName: string;
  /** Number of unworked houses in this cluster. */
  unworkedHouseCount: number;
  /** Average opportunity score of houses in this cluster. */
  avgOpportunityScore: number;
  /** Cluster centroid latitude. */
  lat: number;
  /** Cluster centroid longitude. */
  lng: number;
  /** Distance from nearest active rep (miles), null if no reps active. */
  nearestRepDistanceMiles: number | null;
  /** Nearest rep name. */
  nearestRepName: string | null;
}
```

**Source tables/services:**
- `storm_zones` — parent zone
- `targets` + `target_scores` — houses with score ≥ 60 not in any active mission stop
- `rep_presence` — nearest rep calculation
- Clustering: server-side spatial clustering (grid-based or DBSCAN on target lat/lng within a zone)

### 6.2 KPI Calculations

| Metric | Formula |
|---|---|
| `avgOpportunityScore` | `AVG(target_scores.opportunity_score) WHERE target_id IN (cluster targets) AND status = 'new'` |
| `nearestRepDistanceMiles` | `MIN(haversine(cluster.lat, cluster.lng, rep_presence.lat, rep_presence.lng)) WHERE rep_presence.status = 'active'` |
| Cluster qualification | A cluster qualifies when `unworkedHouseCount ≥ 3 AND avgOpportunityScore ≥ 60` |

### 6.3 Role Differences

| Role | Behavior |
|---|---|
| Owner | Visible. Cross-branch clusters. |
| Manager | Visible. Own branch territory clusters. |
| Rep | **Hidden.** Widget not rendered. |
| Office Admin | **Hidden.** Widget not rendered. |

### 6.4 Row Actions

| Action | Label | API | Behavior |
|---|---|---|---|
| Cluster click | — | — (client-side) | Opens Storm Zone Detail drawer, scrolled to the cluster sub-section |
| Generate Mission | "Create Mission" | `POST /api/storm-zones/:stormZoneId/generate-mission` `{ clusterIds: [id] }` | Creates a mission from the cluster houses |
| Assign Team | "Assign" | `POST /api/houses/:id/assign` (bulk) | Opens rep-picker → bulk-assigns cluster houses |

### 6.5 Layout

- **Grid:** `col-span-1` on desktop, `col-span-1` on tablet, hidden on mobile
- **Position:** Row 5, left column
- **Card style:** Standard card. Each cluster is a compact row with score badge, house count, and distance pill.
- **Mobile:** Hidden — mobile users (reps) don't see this widget per role rules, and tablet/desktop managers have it visible.

### 6.6 Empty State

- **Icon:** `MapPin` (h-12 w-12, `text-storm-subtle/50`)
- **Heading:** "No unworked hot clusters"
- **Body:** "All high-scoring storm areas have active missions or assignments."
- **Action:** None

### 6.7 Refresh Behavior

- **Auto-refresh:** Every **5 minutes** (same cadence as Top Storm Zones — they share underlying data).

---

## Widget 7: Recent Qualified Opportunities

### 7.1 Data Contract

**API:** `GET /api/houses/today?status=interested&sort=updated_at&order=desc&limit=10`

(Reuses the houses endpoint with a status filter.)

**Response envelope:** `{ data: QualifiedOpportunity[], error: string | null, meta: { total: number } }`

```typescript
export interface QualifiedOpportunity {
  /** Target UUID. */
  id: string;
  /** Street address. */
  address: string;
  /** City. */
  city: string;
  /** State abbreviation. */
  state: string;
  /** Opportunity score. */
  opportunityScore: number;
  /** Estimated value band. */
  estimatedValueBand: "$5k–$10k" | "$10k–$20k" | "$20k–$40k" | "$40k+" | "Unknown";
  /** Rep who recorded the outcome. */
  repName: string;
  /** When the "interested" outcome was recorded. */
  qualifiedAt: string;
  /** Export status. */
  exportStatus: "not_exported" | "queued" | "exported" | "failed";
  /** Storm zone name for context. */
  stormZoneName: string;
}
```

**Source tables/services:**
- `targets` — address, property data
- `mission_stops` — status = "interested", outcome timestamp
- `target_scores` — opportunity score
- `missions` — assigned rep
- `opportunity_exports` — export status lookup
- `storm_zones` — zone name

### 7.2 KPI Calculations

| Metric | Formula |
|---|---|
| Conversion rate | `COUNT(mission_stops WHERE status = 'interested') / NULLIF(COUNT(mission_stops WHERE status IN ('attempted','interested','not_interested','no_answer')), 0)` |
| Avg value of qualified | `AVG(target_scores.opportunity_score WHERE mission_stops.status = 'interested')` |

### 7.3 Role Differences

| Role | Behavior |
|---|---|
| Owner | Visible. Cross-branch opportunities. |
| Manager | Visible. Own branch opportunities. |
| Rep | Visible. Only their own qualified opportunities. |
| Office Admin | Visible. Own branch opportunities (they handle exports). |

### 7.4 Row Actions

| Action | Label | API | Behavior |
|---|---|---|---|
| Row click | — | — | Opens House Detail drawer |
| Export | "Send to JN" | `POST /api/houses/:id/send-to-jobnimbus` | Queues for JobNimbus export |
| Generate Doc | "Doc" icon | `POST /api/documents/generate` `{ targetId, type: "handoff_sheet" }` | Generates handoff summary document |

### 7.5 Layout

- **Grid:** `col-span-1` on desktop, `col-span-1` on tablet, `col-span-1` on mobile
- **Position:** Row 5, right column (next to Unassigned Hot Clusters)
- **Max visible rows:** 5 (with "View all →" link, navigates to `/dashboard/exports`)
- **Card style:** Standard card. Each row shows address (truncated), score badge, rep name, and export status dot (green=exported, amber=queued, red=failed, grey=not exported).

### 7.6 Empty State

- **Icon:** `TrendingUp` (h-12 w-12, `text-storm-subtle/50`)
- **Heading:** "No qualified opportunities yet"
- **Body:** "Opportunities appear here when reps mark homeowners as interested during missions."
- **Action:** None

### 7.7 Refresh Behavior

- **Auto-refresh:** Every **30 seconds** (operational data — managers want to see new qualifications quickly).

---

## Widget 8: Export Queue Summary

### 8.1 Data Contract

**API:** `GET /api/dashboard/export-summary`

**Response envelope:** `{ data: ExportQueueSummary, error: string | null, meta: { updatedAt: string } }`

```typescript
export interface ExportQueueSummary {
  /** Exports queued and ready to push. */
  readyCount: number;
  /** Exports successfully sent to JobNimbus today. */
  exportedTodayCount: number;
  /** Exports that failed and need retry. */
  failedCount: number;
  /** Exports in the retry queue. */
  retryQueueCount: number;
  /** Success rate for today. */
  successRatePercent: number;
  /** Recent export activity (last 5). */
  recentExports: RecentExportRow[];
}

export interface RecentExportRow {
  /** Export UUID. */
  id: string;
  /** Target address. */
  address: string;
  /** "success" | "failed" | "pending" | "retrying" */
  status: "success" | "failed" | "pending" | "retrying";
  /** ISO 8601 timestamp. */
  exportedAt: string;
  /** Error message if failed. */
  errorMessage: string | null;
}
```

**Source tables/services:**
- `opportunity_exports` — status, created_at, error_message, target references
- `jobnimbus_export_queue` — pending/retry counts
- `targets` — address for display

### 8.2 KPI Calculations

| Metric | Formula |
|---|---|
| `readyCount` | `COUNT(jobnimbus_export_queue WHERE status = 'ready')` |
| `exportedTodayCount` | `COUNT(opportunity_exports WHERE status = 'success' AND created_at::date = CURRENT_DATE)` |
| `failedCount` | `COUNT(opportunity_exports WHERE status = 'failed' AND created_at::date = CURRENT_DATE)` |
| `retryQueueCount` | `COUNT(jobnimbus_export_queue WHERE status = 'retrying')` |
| `successRatePercent` | `ROUND(exportedTodayCount / NULLIF(exportedTodayCount + failedCount, 0) * 100)` — defaults to `100` if no exports attempted |

### 8.3 Role Differences

| Role | Behavior |
|---|---|
| Owner | Visible. Cross-branch export totals. |
| Manager | Visible. Own branch export totals. |
| Rep | **Hidden.** Widget not rendered. |
| Office Admin | Visible. Own branch. Can take action on failed exports. |

### 8.4 Row Actions

| Action | Label | API | Behavior |
|---|---|---|---|
| "Export All Ready" | Button in header | `POST /api/exports/jobnimbus` `{ all: true }` | Processes entire ready queue |
| Failed row click | — | — | Opens Export Detail drawer |
| Retry | "Retry" on failed row | `POST /api/exports/:id/retry` | Re-queues the failed export |
| "View Queue →" | Link | — | Navigates to `/dashboard/exports` |

### 8.5 Layout

- **Grid:** `col-span-1` on desktop, `col-span-1` on tablet, `col-span-1` on mobile
- **Position:** Row 6, left column
- **Card style:** Standard card. Top section shows 4 metric pills (ready, exported, failed, retry). Bottom section shows 5 most recent export rows.
- **Alert state:** If `failedCount > 0`, card border changes to `border-storm-danger` (red).

### 8.6 Empty State

- **Icon:** `Upload` (h-12 w-12, `text-storm-subtle/50`)
- **Heading:** "No exports pending"
- **Body:** "Qualified opportunities will appear here when they're ready to send to JobNimbus."
- **Action:** None

### 8.7 Refresh Behavior

- **Auto-refresh:** Every **30 seconds** (export operations are time-sensitive).
- **Realtime:** If Supabase Realtime channels are configured on `opportunity_exports`, prefer subscription over polling.

---

## Widget 9: System Freshness / Data Health

### 9.1 Data Contract

**API:** `GET /api/dashboard/today` → `data.systemFreshness` (sub-field of the main dashboard endpoint)

```typescript
export interface SystemFreshness {
  /** Individual data source statuses. */
  sources: DataSourceStatus[];
  /** Overall health: "healthy" | "degraded" | "unhealthy" */
  overallHealth: "healthy" | "degraded" | "unhealthy";
}

export interface DataSourceStatus {
  /** Data source identifier. */
  source: "xweather" | "nws" | "corelogic" | "jobnimbus" | "openai" | "mapbox" | "google_directions";
  /** Display label. */
  label: string;
  /** Last successful sync timestamp (ISO 8601). */
  lastSyncAt: string | null;
  /** Minutes since last successful sync. */
  minutesSinceSync: number | null;
  /** "healthy" | "stale" | "down" | "unknown" */
  status: "healthy" | "stale" | "down" | "unknown";
  /** Optional error message from last failed attempt. */
  lastError: string | null;
}
```

**Freshness thresholds:**

| Source | Healthy | Stale | Down |
|---|---|---|---|
| Xweather | < 60 min | 60–360 min | > 360 min or last call errored |
| NWS | < 120 min | 120–720 min | > 720 min |
| CoreLogic | < 24 hours | 24–72 hours | > 72 hours or errored |
| JobNimbus | < 30 min | 30–120 min | > 120 min or errored |
| OpenAI | < 60 min | 60–360 min | > 360 min or errored |
| Mapbox | Always healthy (client-side) | — | Errored |
| Google Directions | < 60 min | 60–360 min | > 360 min or errored |

**Source tables/services:**
- `data_freshness_snapshots` — last_sync_at, status, error per source
- `integration_sync_logs` — most recent log entry per source for error details

### 9.2 KPI Calculations

| Metric | Formula |
|---|---|
| `overallHealth` | `"healthy"` if all sources are healthy. `"degraded"` if any source is stale. `"unhealthy"` if any source is down. |
| `minutesSinceSync` | `EXTRACT(EPOCH FROM (NOW() - last_sync_at)) / 60` |
| `status` per source | Compare `minutesSinceSync` against the threshold table above |

### 9.3 Role Differences

| Role | Behavior |
|---|---|
| Owner | Visible. Full details including error messages. |
| Manager | Visible. Full details including error messages. |
| Rep | **Hidden.** Widget not rendered. |
| Office Admin | **Hidden.** Widget not rendered. |

### 9.4 Row Actions

| Action | Label | API | Behavior |
|---|---|---|---|
| Source row click | — | — | Expands row to show last error message and last 3 sync timestamps |
| "Details →" | Link | — | Navigates to `/settings/integrations` |

### 9.5 Layout

- **Grid:** `col-span-1` on desktop, `col-span-1` on tablet, hidden on mobile
- **Position:** Row 6, right column (next to Export Queue Summary)
- **Card style:** Standard card. Each source renders as a compact row with status dot (green=healthy, amber=stale, red=down, grey=unknown) and "X min ago" text.
- **Alert state:** If `overallHealth = "unhealthy"`, card border changes to `border-storm-danger`.
- **Mobile:** Hidden — operational health monitoring is not a mobile use case.

### 9.6 Empty State

- **Icon:** `Activity` (h-12 w-12, `text-storm-subtle/50`)
- **Heading:** "No data sources configured"
- **Body:** "Data source health will appear here once integrations are connected."
- **Action:** Button — "Configure Integrations" → navigates to `/settings/integrations`

### 9.7 Refresh Behavior

- **Auto-refresh:** Every **60 seconds**.
- **Visual indicator:** A subtle "Last checked: Xs ago" timestamp in the card footer.

---

## Role → Widget Visibility Summary

| Widget | Owner | Manager | Rep | Office Admin |
|---|---|---|---|---|
| AI Daily Brief | ✅ | ✅ | ✅ (scoped) | ✅ |
| Houses To Hit Today | ✅ | ✅ | ✅ (own assigned) | ✅ (read-only) |
| Top Storm Zones | ✅ | ✅ | ❌ | ❌ |
| AI Deployment Plan | ✅ | ✅ | ❌ | ❌ |
| Live Team Snapshot | ✅ | ✅ | ❌ | ✅ |
| Unassigned Hot Clusters | ✅ | ✅ | ❌ | ❌ |
| Recent Qualified Opps | ✅ | ✅ | ✅ (own) | ✅ |
| Export Queue Summary | ✅ | ✅ | ❌ | ✅ |
| System Freshness | ✅ | ✅ | ❌ | ❌ |

**Rep sees:** 3 widgets (AI Daily Brief, Houses To Hit Today, Recent Qualified Opportunities).
**Office Admin sees:** 5 widgets (AI Daily Brief, Houses To Hit Today, Live Team Snapshot, Recent Qualified Opportunities, Export Queue Summary).
**Manager/Owner sees:** All 9 widgets.

---

## Rep Layout (3-widget grid)

When role = "rep", the dashboard renders a simplified layout:

```
Mobile (<768px) — 1 column
┌──────────────────────────┐
│ AI Daily Brief           │
│ (col-span-1)             │
├──────────────────────────┤
│ Houses To Hit Today      │
│ (col-span-1, dominant)   │
├──────────────────────────┤
│ Recent Qualified Opps    │
│ (col-span-1)             │
└──────────────────────────┘

Desktop — 2 columns (no 3rd column needed)
┌────────────────────────────────────────┐
│ AI Daily Brief (col-span-2)           │
├────────────────────────────────────────┤
│ Houses To Hit Today (col-span-2)      │
├────────────────────────────────────────┤
│ Recent Qualified Opps (col-span-2)    │
└────────────────────────────────────────┘
```

---

## Office Admin Layout (5-widget grid)

```
Desktop (xl) — 2 columns
┌────────────────────────────────────────┐
│ AI Daily Brief (col-span-2)           │
├────────────────────────────────────────┤
│ Houses To Hit Today (col-span-2)      │
├────────────────────┬───────────────────┤
│ Live Team Snapshot │ Recent Qualified  │
│ (col-span-1)      │ Opps (col-span-1) │
├────────────────────┴───────────────────┤
│ Export Queue Summary (col-span-2)     │
└────────────────────────────────────────┘
```

---

## Auto-Refresh Summary

| Widget | Interval | Method |
|---|---|---|
| AI Daily Brief | Manual / once per day | Cached by calendar day |
| Houses To Hit Today | 60s | Polling (current page only) |
| Top Storm Zones | 300s (5 min) | Polling |
| AI Deployment Plan | Manual / 30s status poll | Polling only when `status = pending_approval` |
| Live Team Snapshot | 15s | Polling (or Supabase Realtime on `rep_presence`) |
| Unassigned Hot Clusters | 300s (5 min) | Polling |
| Recent Qualified Opps | 30s | Polling |
| Export Queue Summary | 30s | Polling (or Supabase Realtime on `opportunity_exports`) |
| System Freshness | 60s | Polling |

---

## Consolidated TypeScript Interfaces File

All interfaces above should be defined in `src/types/dashboard.ts`. The file exports:

```typescript
// src/types/dashboard.ts

export type { AIDailyBrief, AIDailyBriefHighlight } from "./dashboard";
export type { HouseToHit } from "./dashboard";
export type { StormZoneSummary } from "./dashboard";
export type { AIDeploymentPlan, DeploymentAssignment } from "./dashboard";
export type { TeamSnapshot, RepSnapshotRow } from "./dashboard";
export type { HotCluster } from "./dashboard";
export type { QualifiedOpportunity } from "./dashboard";
export type { ExportQueueSummary, RecentExportRow } from "./dashboard";
export type { SystemFreshness, DataSourceStatus } from "./dashboard";
```

---

## API Endpoint Summary

| Endpoint | Method | Used By Widgets | Response Key |
|---|---|---|---|
| `/api/dashboard/today` | GET | KPI strip, AI Deployment Plan, System Freshness | `data.kpi`, `data.deploymentPlan`, `data.systemFreshness` |
| `/api/dashboard/ai-brief` | GET | AI Daily Brief | `data` (AIDailyBrief) |
| `/api/dashboard/export-summary` | GET | Export Queue Summary | `data` (ExportQueueSummary) |
| `/api/houses/today` | GET | Houses To Hit Today, Recent Qualified Opps | `data` (HouseToHit[]) |
| `/api/storm-zones` | GET | Top Storm Zones, Unassigned Hot Clusters | `data` (StormZoneSummary[] / HotCluster[]) |
| `/api/team/live` | GET | Live Team Snapshot | `data` (TeamSnapshot) |
| `/api/ai/daily-brief` | POST | AI Daily Brief (generate) | `data` (AIDailyBrief) |
| `/api/ai/opportunity-summary` | POST | Houses row → AI Assist | `data` |
| `/api/houses/:id/assign` | POST | Houses row → Assign | `data` |
| `/api/houses/:id/send-to-jobnimbus` | POST | Houses row → Export | `data` |
| `/api/documents/generate` | POST | Houses row → Generate Doc | `data` |
| `/api/storm-zones/:id/generate-mission` | POST | Top Storm Zones, Hot Clusters → Generate Mission | `data` |
| `/api/exports/jobnimbus` | POST | Export Queue → Export All | `data` |
| `/api/exports/:id/retry` | POST | Export Queue → Retry | `data` |
| `/api/team/reassign` | POST | Live Team → Reassign | `data` |
