# Stormclose V2 — Team Module Specification

> Canonical reference for every widget, data model, exception type, and interaction on the Team screen.
> Derives from: `PRODUCT_CONTRACT_V2.md` §4 (Roles), §5 (Team screen), `stormclose-enterprise-architecture.md` §5 (Screen Architecture), `stormclose-navigation-design.md` §2–§3 (Sidebar & Roles), `stormclose-missions-geolocation.md` §6 (Exception Model), §7.3 (RepPresence contract).
> Builds on: `rep_presence`, `missions`, `mission_stops`, `mission_events`, `ops_alerts`, `users` tables; `PresenceService`, `MissionsService` implementations.
> Last updated: 2026-03-14

---

## 1. Team Screen Overview

**Purpose:** Spot exceptions, verify field coverage, and take corrective action. This is a _glance-and-act_ screen — not a micromanagement dashboard. AI handles most assignment; this screen handles the edge cases.

**Route:** `/dashboard/team`

**Sidebar:** Fourth item, `Users` icon, badge shows `exceptionCount` (integer count + red dot when > 0).

**Role visibility:**

| Role | Access |
|---|---|
| Owner | ✅ Full — all reps, cross-branch, all actions |
| Manager | ✅ Full — own branch reps only |
| Rep | ❌ Hidden — sidebar item not rendered |
| Office Admin | ❌ Hidden — sidebar item not rendered |

**Primary action (PageHeader):** "AI Reassign" → opens the AI Reassignment Suggestions panel.

---

## 2. KPI Strip

The Team page renders its own contextual KPI strip (not the Dashboard KPI strip).

**API:** `GET /api/team/live`

| Position | Label | Source Field | Format |
|---|---|---|---|
| 1 (primary) | Reps In Field | `repsActiveCount` | Integer, `text-storm-purple` |
| 2 | Idle Reps | `repsIdleCount` | Integer, amber when > 0 |
| 3 | Open Exceptions | `exceptionCount` | Integer, red when > 0 |
| 4 | Houses Hit Today | `housesHitTodayCount` | Integer |
| 5 | Avg Doors / Hour | `avgDoorsPerHour` | Decimal (1dp) |

```typescript
// src/types/team.ts

export interface TeamKpiStrip {
  repsActiveCount: number;
  repsIdleCount: number;
  exceptionCount: number;
  housesHitTodayCount: number;
  avgDoorsPerHour: number;
}
```

---

## 3. Grid Layout

```
Desktop (xl, ≥1280px) — 3 columns
┌──────────────────────────────────────────────────────────────────┐
│ Live Rep Map                                      (col-span-2)  │
│ (min-h-[480px])                                                  │
├─────────────────────────────────────┬────────────────────────────┤
│                                     │ Exception Feed             │
│ Rep Status Board                    │ (col-span-1, row-span-2)  │
│ (col-span-2, row-span-2)           │                            │
│                                     │                            │
│                                     ├────────────────────────────┤
│                                     │ AI Reassignment            │
│                                     │ Suggestions (col-span-1)   │
├─────────────────────────────────────┼────────────────────────────┤
│ Coverage Gaps (col-span-1)          │ Rep Leaderboard            │
│                                     │ (col-span-1)               │
└─────────────────────────────────────┴────────────────────────────┘

Tablet (md, 768–1279px) — 2 columns
- Live Rep Map: col-span-2
- Rep Status Board: col-span-2
- Exception Feed: col-span-1
- AI Reassignment Suggestions: col-span-1
- Coverage Gaps: col-span-1
- Rep Leaderboard: col-span-1

Mobile (<768px) — 1 column
- Exception Feed (top — most actionable)
- Rep Status Board
- Coverage Gaps
- AI Reassignment Suggestions
- Rep Leaderboard
- Live Rep Map: hidden (Manager/Owner only + limited utility on mobile)
```

---

## 4. Widget Specifications

---

### Widget 1: Live Rep Map

#### 4.1.1 Data Contract

**API:** `GET /api/team/live`

**Response envelope:** `{ data: TeamLiveData, error: string | null, meta: { generatedAt: string } }`

```typescript
// src/types/team.ts

export type RepFieldStatus = "active" | "idle" | "driving" | "at_door" | "offline" | "paused";

export interface TeamRepPosition {
  /** Rep user ID. */
  userId: string;
  /** Display name. */
  name: string;
  /** Avatar URL or null. */
  avatarUrl: string | null;
  /** Current latitude. */
  lat: number;
  /** Current longitude. */
  lng: number;
  /** GPS accuracy in meters. */
  accuracyMeters: number;
  /** Heading in degrees (0-360). Null if stationary. */
  heading: number | null;
  /** Speed in m/s. Null if stationary. */
  speedMps: number | null;
  /** Battery percentage. Null if not reported. */
  batteryPercent: number | null;
  /** Derived field status. */
  fieldStatus: RepFieldStatus;
  /** Active mission info (null if no active mission). */
  activeMission: {
    id: string;
    name: string;
    stormZoneName: string | null;
    stopsCompleted: number;
    stopsRemaining: number;
    completionPercent: number;
  } | null;
  /** Current or next stop address. */
  currentStopAddress: string | null;
  /** Seconds since last heartbeat. */
  lastHeartbeatSecondsAgo: number;
  /** Team / branch metadata. */
  teamId: string;
  branchId: string | null;
  branchName: string | null;
}

export interface TeamLiveData {
  kpi: TeamKpiStrip;
  reps: TeamRepPosition[];
  /** Storm zone boundaries to render on the map for coverage context. */
  activeZones: TeamZoneOverlay[];
}

export interface TeamZoneOverlay {
  id: string;
  name: string;
  score: number;
  centroidLat: number;
  centroidLng: number;
  radiusMiles: number;
  unworkedHouseCount: number;
  /** Whether any active rep is within this zone. */
  hasCoverage: boolean;
}
```

**Source tables/services:**
- `rep_presence` — current position, speed, heading, battery, fieldStatus
- `users` — name, avatar
- `missions` — active mission stats
- `mission_stops` — stop counts
- `storm_zones` — zone boundaries for overlays

#### 4.1.2 Map Rendering

- **Provider:** Mapbox GL with `NEXT_PUBLIC_MAPBOX_TOKEN`.
- **Rep markers:** Colored dots by `fieldStatus`:
  - `active` / `driving` / `at_door` → green (`#22c55e`)
  - `idle` → amber (`#f59e0b`)
  - `paused` → slate (`#64748b`)
  - `offline` → grey (`#374151`), dimmed opacity
- **Heading indicator:** When `heading` is non-null and `speedMps > 2`, show a directional arrow on the dot.
- **Marker popup (hover):** Rep name, mission name, `{completed}/{total} stops`, last heartbeat.
- **Marker click:** Opens Rep Detail Drawer (§4.7).
- **Zone overlays:** Semi-transparent fills for `activeZones`. Red-tinted zones with `hasCoverage = false` indicate coverage gaps.
- **Fallback:** When Mapbox token missing, render a list of reps with addresses instead.

#### 4.1.3 Role Differences

| Role | Behavior |
|---|---|
| Owner | All reps across all branches. Branch filter toggle in map toolbar. |
| Manager | Own branch reps only. No branch filter. |

#### 4.1.4 Refresh Behavior

- **Polling:** Every 15 seconds.
- **Optimization:** Only fetch rep positions if map is visible (Intersection Observer).

#### 4.1.5 Empty State

- **Icon:** `Map` (h-12 w-12, `text-storm-subtle/50`)
- **Heading:** "No reps in the field"
- **Body:** "When reps start missions, their live positions will appear here."

---

### Widget 2: Rep Status Board

#### 4.2.1 Data Contract

Uses `TeamRepPosition[]` from the same `GET /api/team/live` response (shared fetch with Live Rep Map).

For each rep, the board renders a card:

```typescript
// src/types/team.ts

export interface RepStatusCard {
  userId: string;
  name: string;
  avatarUrl: string | null;
  fieldStatus: RepFieldStatus;
  activeMission: {
    id: string;
    name: string;
    stormZoneName: string | null;
    stopsCompleted: number;
    stopsRemaining: number;
    completionPercent: number;
  } | null;
  currentStopAddress: string | null;
  lastActivity: string;
  lastActivityLabel: string;
  lastHeartbeatSecondsAgo: number;
  batteryPercent: number | null;
  doorsToday: number;
  appointmentsToday: number;
  branchName: string | null;
  /** Active exceptions for this rep (shown as warning badges). */
  activeExceptions: ExceptionBadge[];
}

export interface ExceptionBadge {
  type: ExceptionType;
  severity: ExceptionSeverity;
  shortLabel: string;
}
```

**Additional source:** `GET /api/team/exceptions` to cross-reference exceptions per rep.

#### 4.2.2 Card Layout

Each rep card contains:
1. **Avatar + name** (left-aligned)
2. **Status badge** — colored pill matching `fieldStatus`
3. **Mission context** — mission name, zone, progress bar (`stopsCompleted / (stopsCompleted + stopsRemaining)`)
4. **Current stop** — address, with map pin icon
5. **KPI row** — `{doorsToday} doors · {appointmentsToday} appts`
6. **Last activity** — relative time ("2m ago — Recorded no_answer at 123 Main St")
7. **Warning badges** — exception badges stacked below (e.g., 🟡 Idle 8m, 🔴 Off-route)
8. **Battery indicator** — when < 30%, show amber battery icon. When < 10%, red.

#### 4.2.3 Card Actions

| Action | Label | API Call | Behavior | Roles |
|---|---|---|---|---|
| View Detail | card click | — | Opens Rep Detail Drawer | Owner, Manager |
| Reassign | "Reassign" button | `POST /api/team/reassign` | Opens reassignment dialog | Owner, Manager |
| Ping | "Check In" button | `POST /api/team/ping` | Sends push notification to rep | Owner, Manager |

#### 4.2.4 Sorting & Filtering

- **Default sort:** Exceptions first (reps with active exceptions at top), then by `fieldStatus` priority: `idle` > `active` > `driving` > `at_door` > `paused` > `offline`, then alphabetical.
- **Filter controls:** Status filter pills (`All`, `Active`, `Idle`, `Offline`), Branch dropdown (Owner only).

#### 4.2.5 Role Differences

| Role | Behavior |
|---|---|
| Owner | All reps. Branch dropdown filter visible. Reassign + Ping actions available. |
| Manager | Own branch reps only. No branch dropdown. Reassign + Ping actions available. |

#### 4.2.6 Empty State

- **Icon:** `Users` (h-12 w-12, `text-storm-subtle/50`)
- **Heading:** "No team members found"
- **Body:** "Add reps in Settings → Team to start tracking field operations."
- **Action:** Button — "Go to Team Settings" → `/settings/team`

---

### Widget 3: Coverage Gaps

#### 4.3.1 Data Contract

**API:** `GET /api/team/coverage-gaps`

**Response envelope:** `{ data: CoverageGap[], error: string | null, meta: { evaluatedAt: string, totalZonesChecked: number } }`

```typescript
// src/types/team.ts

export interface CoverageGap {
  id: string;
  /** Storm zone with opportunity but no rep coverage. */
  stormZoneId: string;
  stormZoneName: string;
  stormZoneScore: number;
  /** Center of the uncovered area. */
  lat: number;
  lng: number;
  /** Number of unworked houses in this gap. */
  unworkedHouseCount: number;
  /** Average opportunity score of unworked houses. */
  avgOpportunityScore: number;
  /** Nearest available rep (idle or mission nearly complete). */
  nearestRep: {
    userId: string;
    name: string;
    distanceMiles: number;
    fieldStatus: RepFieldStatus;
    availableAt: string | null;
  } | null;
  /** AI-generated reason this gap matters. */
  reason: string;
  /** When the gap was detected. */
  detectedAt: string;
}
```

**Source tables/services:**
- `storm_zones` — active zones with score ≥ 50
- `rep_presence` — all active rep positions
- `missions` — active missions per zone
- `targets` / `target_scores` — unworked house counts per zone

#### 4.3.2 Detection Logic

A coverage gap is emitted when ALL of:
1. Zone `status = 'active'` AND `score ≥ 50`.
2. Zone has ≥ 10 `unworked_house_count`.
3. No active mission currently assigned to this zone.
4. No rep with `fieldStatus IN ('active', 'driving', 'at_door')` within `zone.radius_miles + 3` miles of the zone centroid.

#### 4.3.3 Card Layout

Each gap card:
1. **Zone name + score badge** (e.g., "North Dallas Hail Corridor" · `Badge variant="danger"` "Score 87")
2. **House count** — "{N} unworked houses · Avg score {S}"
3. **Nearest rep** — "{rep name} ({X.X} mi away, {fieldStatus})" or "No rep available"
4. **Action button** — "Deploy" → opens a pre-filled mission creation dialog for this zone + nearest rep

#### 4.3.4 Role Differences

Same as parent screen (Owner = cross-branch, Manager = own branch).

#### 4.3.5 Empty State

- **Icon:** `Target` (h-12 w-12, `text-storm-subtle/50`)
- **Heading:** "Full coverage"
- **Body:** "All active storm zones have rep coverage. Nice work."

#### 4.3.6 Refresh Behavior

- Every 5 minutes (aligned with server-side detection cron).

---

### Widget 4: AI Reassignment Suggestions

#### 4.4.1 Data Contract

**API:** `POST /api/ai/reassignment-suggestions`

**Request body:** `{}`  (server assembles context from live state)

**Response envelope:** `{ data: ReassignmentSuggestion[], error: string | null, meta: { generatedAt: string, model: string } }`

```typescript
// src/types/team.ts

export interface ReassignmentSuggestion {
  id: string;
  /** The rep to move. */
  fromRep: {
    userId: string;
    name: string;
    currentMissionId: string | null;
    currentMissionName: string | null;
    currentZoneName: string | null;
    fieldStatus: RepFieldStatus;
  };
  /** Where to move them. */
  toZone: {
    stormZoneId: string;
    stormZoneName: string;
    score: number;
    unworkedHouseCount: number;
    distanceMiles: number;
  };
  /** Why AI recommends this move. */
  reasoning: string;
  /** Estimated impact of the reassignment. */
  estimatedImpact: {
    additionalHousesReachable: number;
    estimatedAdditionalAppointments: number;
    driveMinutes: number;
  };
  /** Confidence 0–100. */
  confidence: number;
  /** Status of this suggestion. */
  status: "pending" | "approved" | "rejected" | "expired";
}
```

**Source (AI model input):**
- `rep_presence` — all rep positions + statuses
- `storm_zones` — scored zones with coverage status
- `missions` — active missions + completion progress
- `mission_stops` — outcome history for rep skill assessment
- `ops_alerts` — active exceptions that motivate the reassignment

#### 4.4.2 Card Layout

Each suggestion card:
1. **Headline:** "Move {fromRep.name} from {fromZone} to {toZone}" (or "Deploy {fromRep.name} to {toZone}" if rep is idle)
2. **Reasoning:** AI explanation (1–2 sentences)
3. **Impact metrics:** "+{N} houses reachable · ~{N} appts · {N} min drive"
4. **Confidence bar:** Horizontal bar, colored by confidence (≥80 green, ≥60 amber, <60 red)
5. **Actions:**
   - **Approve** → `POST /api/team/reassign { repId, toZoneId, suggestionId }`
   - **Reject** → `PATCH /api/ai/reassignment-suggestions/:id { status: "rejected" }`
   - **Modify** → Opens reassignment dialog with pre-filled values

#### 4.4.3 Generation Trigger

- **Automatic:** Generated whenever a `no_rep_in_hot_zone`, `coverage_gap`, or `idle_rep` exception is created.
- **Manual:** Owner/Manager clicks "AI Reassign" button in PageHeader or in the widget.
- **Staleness:** Suggestions expire after 30 minutes (field state changes fast).

#### 4.4.4 Role Differences

| Role | Behavior |
|---|---|
| Owner | Sees all suggestions across branches. Can approve/reject. |
| Manager | Sees suggestions for own branch reps only. Can approve/reject. |

#### 4.4.5 Empty State

- **Icon:** `Sparkles` (h-12 w-12, `text-storm-subtle/50`)
- **Heading:** "No reassignment suggestions"
- **Body:** "AI has no recommended moves right now. All reps appear well-deployed."

---

### Widget 5: Rep Leaderboard

#### 4.5.1 Data Contract

**API:** `GET /api/team/leaderboard?period={today|week|month}`

**Response envelope:** `{ data: LeaderboardEntry[], error: string | null, meta: { period: string, generatedAt: string } }`

```typescript
// src/types/team.ts

export type LeaderboardPeriod = "today" | "week" | "month";

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  avatarUrl: string | null;
  branchName: string | null;
  metrics: {
    /** Total stops with outcome recorded. */
    doorsKnocked: number;
    /** Stops with status "interested" or "sent_to_jobnimbus". */
    appointmentsSet: number;
    /** appointmentsSet / doorsKnocked. */
    conversionRate: number;
    /** Stops with "no_answer". */
    noAnswerCount: number;
    /** Average doors per hour during active mission time. */
    doorsPerHour: number;
    /** Total active mission minutes. */
    activeMinutes: number;
    /** Number of missions completed. */
    missionsCompleted: number;
    /** Estimated pipeline from interested stops. */
    estimatedPipeline: number;
  };
  /** Change in rank from previous period (+1 = moved up 1, -2 = moved down 2). */
  rankDelta: number | null;
}
```

**Source tables:**
- `mission_stops` — outcome counts by `status`, filtered by `outcome_at` within period
- `missions` — completion counts, active duration
- `users` — name, avatar

#### 4.5.2 Sort & Display

- **Default sort:** By `doorsKnocked` descending (activity-first, not just outcomes).
- **Period toggle:** `Today` | `This Week` | `This Month` — pills at top of widget.
- **Rank delta:** Up/down arrow with signed integer.
- **Top 3 treatment:** Gold/silver/bronze badge on rank 1/2/3.

#### 4.5.3 Role Differences

| Role | Behavior |
|---|---|
| Owner | All reps across all branches. Branch filter available. |
| Manager | Own branch reps only. |

#### 4.5.4 Empty State

- **Icon:** `Trophy` (h-12 w-12, `text-storm-subtle/50`)
- **Heading:** "No activity yet"
- **Body:** "Leaderboard populates as reps record stop outcomes."

#### 4.5.5 Refresh Behavior

- On page load + on period toggle change. No auto-poll (data is aggregate, not real-time).

---

### Widget 6: Exception Feed

#### 4.6.1 Data Contract

**API:** `GET /api/team/exceptions?status=active&limit=50`

**Response envelope:** `{ data: OpsException[], error: string | null, meta: { total: number, activeCount: number, generatedAt: string } }`

```typescript
// src/types/team.ts

export type ExceptionSeverity = "critical" | "warning" | "info";

export type ExceptionType =
  | "idle_rep"
  | "off_route"
  | "no_rep_in_hot_zone"
  | "mission_nearly_complete_cluster_nearby"
  | "low_quality_outcomes"
  | "export_backlog_growing"
  | "battery_critical"
  | "rep_inactive_during_hours"
  | "coverage_gap"
  | "heartbeat_lost"
  | "mission_overtime"
  | "duplicate_zone_deployment";

export interface OpsException {
  id: string;
  type: ExceptionType;
  severity: ExceptionSeverity;
  title: string;
  description: string;
  suggestedAction: string;
  context: {
    repId?: string;
    repName?: string;
    missionId?: string;
    missionName?: string;
    stormZoneId?: string;
    stormZoneName?: string;
    lat?: number;
    lng?: number;
    /** Additional structured data for display. */
    minutesIdle?: number;
    distanceOffRouteMiles?: number;
    consecutiveOutcomes?: number;
    batteryPercent?: number;
    backlogCount?: number;
    overlapPercent?: number;
    activeHours?: number;
  };
  acknowledged: boolean;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  expiresAt: string;
}
```

**Source:** `ops_alerts` table.

#### 4.6.2 Feed Layout

Chronological list (newest first). Each exception card:
1. **Severity icon:**
   - `critical` → red `AlertTriangle`
   - `warning` → amber `AlertTriangle`
   - `info` → blue `Info`
2. **Title** — bold, one line
3. **Description** — muted, 1–2 lines
4. **Suggested action** — purple text, actionable
5. **Context link** — "View {rep}" → opens Rep Detail Drawer, or "View {zone}" → navigates to zone
6. **Timestamp** — relative ("3m ago")
7. **Actions:**
   - **Acknowledge** → `PATCH /api/team/exceptions/:id { acknowledged: true }`
   - **Act** → context-dependent: "Reassign" / "Check In" / "Deploy" / "Process Queue"

#### 4.6.3 Sorting & Filtering

- **Default sort:** `severity` descending (critical first), then `createdAt` descending.
- **Filter pills:** `All` | `Critical` | `Warning` | `Info`
- **Acknowledged toggle:** "Show resolved" checkbox to include acknowledged/resolved items.

#### 4.6.4 Role Differences

| Role | Behavior |
|---|---|
| Owner | All exceptions across branches. |
| Manager | Exceptions for own branch reps + global exceptions (`no_rep_in_hot_zone`, `export_backlog_growing`). |

#### 4.6.5 Empty State

- **Icon:** `CheckCircle` (h-12 w-12, `text-green-500/50`)
- **Heading:** "All clear"
- **Body:** "No active exceptions. Operations look healthy."

#### 4.6.6 Refresh Behavior

- **Polling:** Every 30 seconds.

---

### Widget 7: Rep Detail Drawer

#### 4.7.1 Data Contract

**API:** `GET /api/team/:userId`

**Response envelope:** `{ data: RepDetail, error: string | null, meta: { generatedAt: string } }`

```typescript
// src/types/team.ts

export interface RepDetail {
  /** User identity. */
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  role: "rep";
  teamId: string;
  branchId: string | null;
  branchName: string | null;

  /** Live state. */
  presence: TeamRepPosition | null;

  /** Active mission detail (null if no active mission). */
  activeMission: {
    id: string;
    name: string;
    stormZoneName: string | null;
    status: "planned" | "active" | "paused";
    startedAt: string | null;
    stopsCompleted: number;
    stopsRemaining: number;
    completionPercent: number;
    /** Remaining stops ordered by sequence. */
    remainingStops: Array<{
      id: string;
      address: string;
      opportunityScore: number;
      status: string;
      sequence: number;
    }>;
    /** Route polyline for map rendering. */
    routePolyline: string | null;
  } | null;

  /** Today's stats. */
  todayStats: {
    doorsKnocked: number;
    appointmentsSet: number;
    conversionRate: number;
    activeMinutes: number;
    noAnswerCount: number;
  };

  /** Performance history. */
  performanceLast30Days: {
    missionsCompleted: number;
    totalDoors: number;
    totalAppointments: number;
    avgDoorsPerHour: number;
    avgConversionRate: number;
  };

  /** Active exceptions for this rep. */
  activeExceptions: OpsException[];

  /** Recent mission history (last 5). */
  recentMissions: Array<{
    id: string;
    name: string;
    status: string;
    completedAt: string | null;
    stopsTotal: number;
    stopsInterested: number;
  }>;
}
```

**Source tables/services:**
- `users` — identity
- `rep_presence` — live state
- `missions` — active + recent missions
- `mission_stops` — stop stats + remaining stops
- `ops_alerts` — exceptions for this rep

#### 4.7.2 Drawer Layout

**Width:** 480px desktop, full-width mobile. Slides in from right. Backdrop overlay.

**Sections (top to bottom):**
1. **Header** — Avatar, name, status badge, branch name. Close button top-right.
2. **Live Position Map** — Small inline Mapbox map (200px height) showing rep position + remaining stop markers + route polyline.
3. **Active Mission** — Mission name, progress bar, stop list (scrollable, max 10 visible). Each stop shows address, score, status badge.
4. **Today's Stats** — 2×2 grid: Doors, Appointments, Conversion %, Active Minutes.
5. **Active Exceptions** — List of exception badges with descriptions (from `activeExceptions`).
6. **Performance (30d)** — Sparkline or summary: missions, doors, avg conversion.
7. **Recent Missions** — Compact list of last 5 missions: name, date, interested count.
8. **Actions bar** (sticky bottom):
   - **Reassign** → opens reassignment dialog
   - **Check In** → sends push notification
   - **View Mission** → navigates to `/dashboard/missions/{missionId}`

#### 4.7.3 Role Differences

Same as parent — Owner sees all, Manager sees own branch.

---

## 5. Exception Logic — Detailed Specification

Every exception type below follows a standard lifecycle:

```
Detected → Created (ops_alerts row) → Active → Acknowledged OR Auto-Resolved → Expired (4h TTL)
```

### 5.1 Exception Type Reference Table

| # | Type | Display Label | Severity | Detection Method | Frequency | Auto-Resolve Condition | Expiry |
|---|---|---|---|---|---|---|---|
| 1 | `idle_rep` | Idle Rep | `warning` | Heartbeat eval + 60s cron | Real-time + 60s | Next heartbeat received with `speedMps > 0` OR stop outcome recorded | 4h |
| 2 | `off_route` | Off-Route Rep | `warning` | Heartbeat eval (every heartbeat) | Real-time | Rep returns within 0.5 mi of nearest stop OR records a stop outcome | 4h |
| 3 | `no_rep_in_hot_zone` | Unworked Hot Zone | `critical` | 5-min server cron | 5 min | A mission is created for the zone OR a rep enters the zone radius | 4h |
| 4 | `mission_nearly_complete_cluster_nearby` | Nearby Cluster | `info` | After each stop outcome | Real-time | Rep's mission is extended to include the cluster OR mission completed | 4h |
| 5 | `low_quality_outcomes` | Low-Quality Outcomes | `warning` | After each stop outcome | Real-time | Rep records a non-rejected outcome (interested, follow_up) | 4h |
| 6 | `export_backlog_growing` | Export Backlog | `warning` | 10-min server cron | 10 min | Backlog drops below threshold (≤5 pending) | 4h |
| 7 | `battery_critical` | Battery Critical | `warning` | Heartbeat eval | Real-time | Battery rises above 15% (charging) OR mission ends | 4h |
| 8 | `rep_inactive_during_hours` | Undeployed Rep | `info` | 15-min server cron (working hours) | 15 min | Rep starts a mission OR outside working hours | 4h |
| 9 | `coverage_gap` | Coverage Gap | `info` | 5-min server cron | 5 min | Rep enters zone OR mission created for zone | 4h |
| 10 | `heartbeat_lost` | Heartbeat Lost | `critical` | 60s cron checking `rep_presence.updated_at` | 60s | Heartbeat resumes OR mission ends | 4h |
| 11 | `mission_overtime` | Mission Overtime | `info` | 30-min server cron | 30 min | Mission completed or paused | 4h |
| 12 | `duplicate_zone_deployment` | Duplicate Deployment | `warning` | On mission creation | Real-time | One of the duplicate missions is cancelled/completed | 4h |

### 5.2 Exception Trigger Details

#### Exception 1: `idle_rep`

```
TRIGGER CONDITION:
  rep_presence.mode = 'active_mission'
  AND rep_presence.updated_at < NOW() - INTERVAL '5 minutes'
  AND (rep_presence.speed IS NULL OR rep_presence.speed < 1)
  AND no mission_stop outcome recorded for this rep in last 5 minutes

DETECTION METHOD:
  - Primary: 60-second server cron scans all rep_presence rows with active_mission mode
  - Secondary: each heartbeat response checks time since last stop outcome

SEVERITY: warning

TITLE: "Idle: {repName}"
DESCRIPTION: "{repName} has been stationary at {lastKnownAddress} for {N} minutes with no activity."
SUGGESTED ACTION: "Check in with {repName} or review their current stop."

CONTEXT:
  repId, repName, missionId, missionName, lat, lng, minutesIdle

AUTO-RESOLVE:
  - Next heartbeat with speed > 0 (rep started moving)
  - Stop outcome recorded (rep was working a door)
  - Mission paused or completed

DEDUPLICATION:
  Only one active idle_rep exception per rep at a time.
  If existing active exception, update minutesIdle but don't create a new row.
```

#### Exception 2: `off_route`

```
TRIGGER CONDITION:
  rep_presence.mode = 'active_mission'
  AND haversine(rep.lat, rep.lng, nearestRemainingStop.lat, nearestRemainingStop.lng) > 0.5 miles
  AND this distance has persisted for > 10 minutes (checked via last N heartbeats)

DETECTION METHOD:
  - Each heartbeat: server computes distance to nearest remaining stop
  - If distance > 0.5 mi, set off_route_since timestamp in rep_presence metadata
  - If off_route_since > 10 min ago, fire exception

SEVERITY: warning

TITLE: "Off-Route: {repName}"
DESCRIPTION: "{repName} is {X} miles from their nearest assigned stop. Off-route for {N} minutes."
SUGGESTED ACTION: "Suggest reroute to {repName} or check if they need reassignment."

CONTEXT:
  repId, repName, missionId, missionName, lat, lng, distanceOffRouteMiles

AUTO-RESOLVE:
  - Rep returns within 0.5 mi of any remaining stop
  - Rep records a stop outcome (they arrived somewhere)
  - Mission paused or completed

DEDUPLICATION:
  One active per rep. Update distance on each heartbeat.
```

#### Exception 3: `no_rep_in_hot_zone`

```
TRIGGER CONDITION:
  storm_zones.status = 'active'
  AND storm_zones.score >= 75
  AND COUNT(missions WHERE storm_zone_id = zone.id AND status = 'active') = 0
  AND COUNT(rep_presence WHERE haversine(rep.lat, rep.lng, zone.centroid_lat, zone.centroid_lng) <= 10) = 0

DETECTION METHOD:
  5-minute server cron. For each active zone with score >= 75:
    1. Check if any active mission targets this zone
    2. Check if any active rep is within 10 miles
    3. If both false → emit exception

SEVERITY: critical

TITLE: "No Rep in {zoneName}"
DESCRIPTION: "{zoneName} (score {S}) has {N} unworked houses and no active rep within 10 miles."
SUGGESTED ACTION: "Deploy to {zoneName}. Nearest available rep: {repName} ({X} mi away)."

CONTEXT:
  stormZoneId, stormZoneName, lat, lng (zone centroid)

AUTO-RESOLVE:
  - Mission created for this zone
  - Rep enters within 10 mi of zone centroid
  - Zone score drops below 75

DEDUPLICATION:
  One active per zone. Refresh nearest rep info each detection cycle.
```

#### Exception 4: `mission_nearly_complete_cluster_nearby`

```
TRIGGER CONDITION:
  mission.status = 'active'
  AND COUNT(remaining_stops WHERE status NOT IN ('not_interested', 'sent_to_jobnimbus')) <= 3
  AND EXISTS(unworked cluster of >= 10 houses within 2 miles of rep's current position)

DETECTION METHOD:
  Evaluated after each stop outcome:
    1. Count remaining stops
    2. If <= 3, query unworked houses within 2 mi of rep_presence position
    3. If cluster >= 10 houses found → emit exception

SEVERITY: info

TITLE: "Nearby Cluster for {repName}"
DESCRIPTION: "{repName}'s mission is nearly complete. {N} unworked houses found {X} mi away in {zoneName}."
SUGGESTED ACTION: "Extend mission for {repName}? Create follow-up mission for the nearby cluster."

CONTEXT:
  repId, repName, missionId, missionName, stormZoneId, stormZoneName, lat, lng

AUTO-RESOLVE:
  - Mission extended with new stops from the cluster
  - Mission completed
  - Manager acknowledges and dismisses

DEDUPLICATION:
  One active per rep per zone cluster. Don't re-emit for the same cluster.
```

#### Exception 5: `low_quality_outcomes`

```
TRIGGER CONDITION:
  Last 5 consecutive stop outcomes for this rep in the current mission
  are ALL in ('not_interested')

DETECTION METHOD:
  After each stop outcome:
    1. Query last 5 outcomes for this mission + rep
    2. If all 5 are 'not_interested' → fire exception

SEVERITY: warning

TITLE: "Low Quality: {repName}"
DESCRIPTION: "{repName} has recorded {N} consecutive rejections in {missionName}."
SUGGESTED ACTION: "Consider coaching {repName} or reassigning to a different zone."

CONTEXT:
  repId, repName, missionId, missionName, consecutiveOutcomes

AUTO-RESOLVE:
  - Rep records an 'interested' or 'follow_up_needed' outcome
  - Mission paused or completed

DEDUPLICATION:
  One active per rep per mission. Update consecutiveOutcomes count on each new outcome.
```

#### Exception 6: `export_backlog_growing`

```
TRIGGER CONDITION:
  COUNT(opportunity_exports WHERE status = 'pending' AND created_at < NOW() - INTERVAL '2 hours') > 10

DETECTION METHOD:
  10-minute server cron queries export queue.

SEVERITY: warning

TITLE: "Export Backlog: {N} Items"
DESCRIPTION: "{N} qualified opportunities have been pending export for over 2 hours. Oldest: {X} hours."
SUGGESTED ACTION: "Process the export queue or check JobNimbus connection health."

CONTEXT:
  backlogCount

AUTO-RESOLVE:
  - Backlog drops to <= 5 pending items
  - All pending items processed

DEDUPLICATION:
  One active export_backlog exception at a time (global, not per-user).
```

#### Exception 7: `battery_critical`

```
TRIGGER CONDITION:
  rep_presence.battery_percent IS NOT NULL
  AND rep_presence.battery_percent < 10
  AND rep_presence.mode = 'active_mission'

DETECTION METHOD:
  Evaluated on each heartbeat (battery_percent is a heartbeat field).

SEVERITY: warning

TITLE: "Battery Critical: {repName}"
DESCRIPTION: "{repName}'s device is at {X}% battery. Mission tracking may be lost."
SUGGESTED ACTION: "Advise {repName} to charge or complete mission soon."

CONTEXT:
  repId, repName, missionId, batteryPercent

AUTO-RESOLVE:
  - Battery rises above 15%
  - Mission ends

DEDUPLICATION:
  One active per rep. Update battery_percent on each heartbeat.
```

#### Exception 8: `rep_inactive_during_hours`

```
TRIGGER CONDITION:
  user.role = 'rep'
  AND current time is within working hours (company_ai_profiles.working_hours_start to working_hours_end)
  AND (rep_presence IS NULL OR rep_presence.mode = 'offline')
  AND EXISTS(mission WHERE assigned_rep_id = user.id AND status = 'planned')

DETECTION METHOD:
  15-minute server cron during working hours.

SEVERITY: info

TITLE: "Undeployed: {repName}"
DESCRIPTION: "{repName} is offline during working hours with planned mission '{missionName}' not started."
SUGGESTED ACTION: "Deploy {repName}? Their mission has {N} stops ready."

CONTEXT:
  repId, repName, missionId, missionName

AUTO-RESOLVE:
  - Rep starts a mission (mode changes to active_mission)
  - Outside working hours
  - Planned mission is cancelled or reassigned

DEDUPLICATION:
  One active per rep. Don't re-emit if rep was already notified within 30 minutes.
```

#### Exception 9: `coverage_gap`

```
TRIGGER CONDITION:
  Zone quadrant with >= 20 unworked houses
  AND no rep within 3 miles of the quadrant centroid
  AND zone.status = 'active'

DETECTION METHOD:
  5-minute server cron. Each active zone is divided into 4 quadrants.
  For each quadrant with >= 20 unworked houses, check nearest rep distance.

SEVERITY: info

TITLE: "Coverage Gap: {zoneName} ({quadrant})"
DESCRIPTION: "{N} unworked houses in {zoneName} ({quadrant}) with no nearby rep."
SUGGESTED ACTION: "Consider deploying a rep to cover this area."

CONTEXT:
  stormZoneId, stormZoneName, lat, lng

AUTO-RESOLVE:
  - Rep enters within 3 mi
  - Mission created for this quadrant
  - Unworked count drops below 10

DEDUPLICATION:
  One per zone-quadrant pair. Refresh on each cron cycle.
```

#### Exception 10: `heartbeat_lost`

```
TRIGGER CONDITION:
  rep_presence.mode = 'active_mission'
  AND rep_presence.updated_at < NOW() - INTERVAL '15 minutes'

DETECTION METHOD:
  60-second server cron checking all rep_presence rows with active mode.

SEVERITY: critical

TITLE: "Heartbeat Lost: {repName}"
DESCRIPTION: "No heartbeat from {repName} for {N} minutes. Last known position: {lastAddress}."
SUGGESTED ACTION: "Attempt to contact {repName}. Last seen at ({lat}, {lng})."

CONTEXT:
  repId, repName, missionId, missionName, lat, lng

AUTO-RESOLVE:
  - Heartbeat resumes
  - Mission paused or completed

DEDUPLICATION:
  One active per rep. Subsumes any existing idle_rep exception (escalation).
```

#### Exception 11: `mission_overtime`

```
TRIGGER CONDITION:
  mission.status = 'active'
  AND mission.started_at < NOW() - INTERVAL '10 hours'

DETECTION METHOD:
  30-minute server cron.

SEVERITY: info

TITLE: "Mission Overtime: {missionName}"
DESCRIPTION: "Mission '{missionName}' ({repName}) has been active for {N} hours."
SUGGESTED ACTION: "Check on {repName}. Consider completing or pausing the mission."

CONTEXT:
  repId, repName, missionId, missionName, activeHours

AUTO-RESOLVE:
  - Mission completed or paused

DEDUPLICATION:
  One active per mission.
```

#### Exception 12: `duplicate_zone_deployment`

```
TRIGGER CONDITION:
  On mission creation: check if another active/planned mission exists for the same storm_zone_id
  AND stop address overlap > 50%

DETECTION METHOD:
  Real-time — evaluated during POST /api/missions.

SEVERITY: warning

TITLE: "Duplicate Deployment: {zoneName}"
DESCRIPTION: "Mission '{missionA}' ({repA}) and '{missionB}' ({repB}) in {zoneName} overlap {N}%."
SUGGESTED ACTION: "Review and consolidate or cancel one of the overlapping missions."

CONTEXT:
  missionId (both), stormZoneId, stormZoneName, overlapPercent

AUTO-RESOLVE:
  - One of the missions is cancelled or completed
  - Overlap drops below 30% after stop adjustments

DEDUPLICATION:
  One per mission pair.
```

---

## 6. API Endpoints

### 6.1 Team Live

```
GET /api/team/live
```

**Purpose:** Returns all active rep positions, KPI strip data, and zone overlays for the Live Rep Map + Rep Status Board.

**Query params:**
| Param | Type | Default | Description |
|---|---|---|---|
| `branchId` | `string?` | — | Filter by branch (Owner only) |

**Response:** `ApiEnvelope<TeamLiveData>`

**Auth:** Owner, Manager. Manager auto-scoped to own branch.

**Polling:** Every 15s from client.

---

### 6.2 Team Exceptions

```
GET /api/team/exceptions
```

**Purpose:** Returns active ops exceptions for the Exception Feed widget.

**Query params:**
| Param | Type | Default | Description |
|---|---|---|---|
| `status` | `"active" \| "acknowledged" \| "resolved" \| "all"` | `"active"` | Filter by exception status |
| `severity` | `ExceptionSeverity?` | — | Filter by severity |
| `limit` | `number` | `50` | Max results |

**Response:** `ApiEnvelope<OpsException[]>`

**Auth:** Owner, Manager, Office Admin.

---

### 6.3 Acknowledge Exception

```
PATCH /api/team/exceptions/:id
```

**Purpose:** Mark an exception as acknowledged.

**Body:** `{ acknowledged: true }`

**Response:** `ApiEnvelope<OpsException>`

**Auth:** Owner, Manager.

---

### 6.4 Team Coverage Gaps

```
GET /api/team/coverage-gaps
```

**Purpose:** Returns coverage gap analysis for the Coverage Gaps widget.

**Response:** `ApiEnvelope<CoverageGap[]>`

**Auth:** Owner, Manager.

---

### 6.5 Team Leaderboard

```
GET /api/team/leaderboard
```

**Purpose:** Returns ranked rep performance data.

**Query params:**
| Param | Type | Default | Description |
|---|---|---|---|
| `period` | `LeaderboardPeriod` | `"today"` | Time period |
| `branchId` | `string?` | — | Filter by branch (Owner only) |

**Response:** `ApiEnvelope<LeaderboardEntry[]>`

**Auth:** Owner, Manager.

---

### 6.6 Rep Detail

```
GET /api/team/:userId
```

**Purpose:** Returns full detail for the Rep Detail Drawer.

**Response:** `ApiEnvelope<RepDetail>`

**Auth:** Owner, Manager.

---

### 6.7 Reassign Rep

```
POST /api/team/reassign
```

**Purpose:** Reassign a rep to a different mission or zone.

**Body:**
```typescript
{
  repId: string;
  toMissionId?: string;       // assign to existing mission
  toStormZoneId?: string;     // create new mission from zone
  suggestionId?: string;      // link to AI suggestion if acting on one
  reason?: string;
}
```

**Response:** `ApiEnvelope<{ mission: Mission; previousMissionId: string | null }>`

**Auth:** Owner, Manager.

---

### 6.8 Ping / Check-In

```
POST /api/team/ping
```

**Purpose:** Send a check-in notification to a rep.

**Body:** `{ repId: string; message?: string }`

**Response:** `ApiEnvelope<{ sent: boolean }>`

**Auth:** Owner, Manager.

---

### 6.9 AI Reassignment Suggestions

```
POST /api/ai/reassignment-suggestions
```

**Purpose:** Generate AI-powered reassignment recommendations.

**Body:** `{}` (server assembles context)

**Response:** `ApiEnvelope<ReassignmentSuggestion[]>`

**Auth:** Owner, Manager.

---

## 7. TypeScript Interfaces — Complete Export

```typescript
// src/types/team.ts — complete file

import type { MissionStatus, PresenceMode } from "@/types/missions";
import type { StormSeverity } from "@/types/dashboard";

// ── KPI Strip ────────────────────────────────────────────────────────────────

export interface TeamKpiStrip {
  repsActiveCount: number;
  repsIdleCount: number;
  exceptionCount: number;
  housesHitTodayCount: number;
  avgDoorsPerHour: number;
}

// ── Rep Field Status ─────────────────────────────────────────────────────────

export type RepFieldStatus =
  | "active"
  | "idle"
  | "driving"
  | "at_door"
  | "offline"
  | "paused";

// ── Live Rep Position ────────────────────────────────────────────────────────

export interface TeamRepPosition {
  userId: string;
  name: string;
  avatarUrl: string | null;
  lat: number;
  lng: number;
  accuracyMeters: number;
  heading: number | null;
  speedMps: number | null;
  batteryPercent: number | null;
  fieldStatus: RepFieldStatus;
  activeMission: {
    id: string;
    name: string;
    stormZoneName: string | null;
    stopsCompleted: number;
    stopsRemaining: number;
    completionPercent: number;
  } | null;
  currentStopAddress: string | null;
  lastHeartbeatSecondsAgo: number;
  teamId: string;
  branchId: string | null;
  branchName: string | null;
}

// ── Zone Overlay (for map) ───────────────────────────────────────────────────

export interface TeamZoneOverlay {
  id: string;
  name: string;
  score: number;
  centroidLat: number;
  centroidLng: number;
  radiusMiles: number;
  unworkedHouseCount: number;
  hasCoverage: boolean;
}

// ── Team Live Response ───────────────────────────────────────────────────────

export interface TeamLiveData {
  kpi: TeamKpiStrip;
  reps: TeamRepPosition[];
  activeZones: TeamZoneOverlay[];
}

// ── Exception Types ──────────────────────────────────────────────────────────

export type ExceptionSeverity = "critical" | "warning" | "info";

export type ExceptionType =
  | "idle_rep"
  | "off_route"
  | "no_rep_in_hot_zone"
  | "mission_nearly_complete_cluster_nearby"
  | "low_quality_outcomes"
  | "export_backlog_growing"
  | "battery_critical"
  | "rep_inactive_during_hours"
  | "coverage_gap"
  | "heartbeat_lost"
  | "mission_overtime"
  | "duplicate_zone_deployment";

export interface OpsException {
  id: string;
  type: ExceptionType;
  severity: ExceptionSeverity;
  title: string;
  description: string;
  suggestedAction: string;
  context: {
    repId?: string;
    repName?: string;
    missionId?: string;
    missionName?: string;
    stormZoneId?: string;
    stormZoneName?: string;
    lat?: number;
    lng?: number;
    minutesIdle?: number;
    distanceOffRouteMiles?: number;
    consecutiveOutcomes?: number;
    batteryPercent?: number;
    backlogCount?: number;
    overlapPercent?: number;
    activeHours?: number;
  };
  acknowledged: boolean;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  expiresAt: string;
}

export interface ExceptionBadge {
  type: ExceptionType;
  severity: ExceptionSeverity;
  shortLabel: string;
}

// ── Rep Status Board ─────────────────────────────────────────────────────────

export interface RepStatusCard {
  userId: string;
  name: string;
  avatarUrl: string | null;
  fieldStatus: RepFieldStatus;
  activeMission: {
    id: string;
    name: string;
    stormZoneName: string | null;
    stopsCompleted: number;
    stopsRemaining: number;
    completionPercent: number;
  } | null;
  currentStopAddress: string | null;
  lastActivity: string;
  lastActivityLabel: string;
  lastHeartbeatSecondsAgo: number;
  batteryPercent: number | null;
  doorsToday: number;
  appointmentsToday: number;
  branchName: string | null;
  activeExceptions: ExceptionBadge[];
}

// ── Coverage Gaps ────────────────────────────────────────────────────────────

export interface CoverageGap {
  id: string;
  stormZoneId: string;
  stormZoneName: string;
  stormZoneScore: number;
  lat: number;
  lng: number;
  unworkedHouseCount: number;
  avgOpportunityScore: number;
  nearestRep: {
    userId: string;
    name: string;
    distanceMiles: number;
    fieldStatus: RepFieldStatus;
    availableAt: string | null;
  } | null;
  reason: string;
  detectedAt: string;
}

// ── AI Reassignment Suggestions ──────────────────────────────────────────────

export interface ReassignmentSuggestion {
  id: string;
  fromRep: {
    userId: string;
    name: string;
    currentMissionId: string | null;
    currentMissionName: string | null;
    currentZoneName: string | null;
    fieldStatus: RepFieldStatus;
  };
  toZone: {
    stormZoneId: string;
    stormZoneName: string;
    score: number;
    unworkedHouseCount: number;
    distanceMiles: number;
  };
  reasoning: string;
  estimatedImpact: {
    additionalHousesReachable: number;
    estimatedAdditionalAppointments: number;
    driveMinutes: number;
  };
  confidence: number;
  status: "pending" | "approved" | "rejected" | "expired";
}

// ── Leaderboard ──────────────────────────────────────────────────────────────

export type LeaderboardPeriod = "today" | "week" | "month";

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  avatarUrl: string | null;
  branchName: string | null;
  metrics: {
    doorsKnocked: number;
    appointmentsSet: number;
    conversionRate: number;
    noAnswerCount: number;
    doorsPerHour: number;
    activeMinutes: number;
    missionsCompleted: number;
    estimatedPipeline: number;
  };
  rankDelta: number | null;
}

// ── Rep Detail Drawer ────────────────────────────────────────────────────────

export interface RepDetail {
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  role: "rep";
  teamId: string;
  branchId: string | null;
  branchName: string | null;
  presence: TeamRepPosition | null;
  activeMission: {
    id: string;
    name: string;
    stormZoneName: string | null;
    status: "planned" | "active" | "paused";
    startedAt: string | null;
    stopsCompleted: number;
    stopsRemaining: number;
    completionPercent: number;
    remainingStops: Array<{
      id: string;
      address: string;
      opportunityScore: number;
      status: string;
      sequence: number;
    }>;
    routePolyline: string | null;
  } | null;
  todayStats: {
    doorsKnocked: number;
    appointmentsSet: number;
    conversionRate: number;
    activeMinutes: number;
    noAnswerCount: number;
  };
  performanceLast30Days: {
    missionsCompleted: number;
    totalDoors: number;
    totalAppointments: number;
    avgDoorsPerHour: number;
    avgConversionRate: number;
  };
  activeExceptions: OpsException[];
  recentMissions: Array<{
    id: string;
    name: string;
    status: string;
    completedAt: string | null;
    stopsTotal: number;
    stopsInterested: number;
  }>;
}

// ── Reassign Request ─────────────────────────────────────────────────────────

export interface ReassignRequest {
  repId: string;
  toMissionId?: string;
  toStormZoneId?: string;
  suggestionId?: string;
  reason?: string;
}

export interface ReassignResponse {
  mission: {
    id: string;
    name: string;
    status: MissionStatus;
    assignedRepId: string;
  };
  previousMissionId: string | null;
}

// ── Ping Request ─────────────────────────────────────────────────────────────

export interface PingRequest {
  repId: string;
  message?: string;
}

export interface PingResponse {
  sent: boolean;
}
```

---

## 8. Database Schema

### 8.1 `ops_alerts` Table

```sql
-- Migration: 20260315_ops_alerts.sql

CREATE TABLE IF NOT EXISTS ops_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    suggested_action TEXT NOT NULL,
    context JSONB DEFAULT '{}',
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by UUID REFERENCES auth.users(id),
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ops_alerts_type_idx ON ops_alerts(type);
CREATE INDEX IF NOT EXISTS ops_alerts_severity_idx ON ops_alerts(severity);
CREATE INDEX IF NOT EXISTS ops_alerts_active_idx ON ops_alerts(acknowledged, resolved_at) WHERE acknowledged = FALSE AND resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS ops_alerts_created_at_idx ON ops_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS ops_alerts_expires_at_idx ON ops_alerts(expires_at);

-- RLS
ALTER TABLE ops_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners and Managers can read ops_alerts"
    ON ops_alerts FOR SELECT
    USING (
        auth.role() = 'authenticated'
    );

CREATE POLICY "Owners and Managers can update ops_alerts"
    ON ops_alerts FOR UPDATE
    USING (
        auth.role() = 'authenticated'
    );

CREATE POLICY "System can insert ops_alerts"
    ON ops_alerts FOR INSERT
    WITH CHECK (true);
```

### 8.2 Rep Presence Extensions

The existing `rep_presence` table (from `20260314_missions_v2.sql`) needs these additional columns for Team module support:

```sql
ALTER TABLE rep_presence
ADD COLUMN IF NOT EXISTS battery_percent INTEGER,
ADD COLUMN IF NOT EXISTS field_status TEXT DEFAULT 'active'
    CHECK (field_status IN ('active', 'idle', 'driving', 'at_door', 'offline', 'paused')),
ADD COLUMN IF NOT EXISTS current_stop_id UUID,
ADD COLUMN IF NOT EXISTS heartbeat_interval_seconds INTEGER DEFAULT 15,
ADD COLUMN IF NOT EXISTS off_route_since TIMESTAMPTZ;
```

---

## 9. Implementation Sequence

| Phase | Deliverable | Dependencies |
|---|---|---|
| 5a | Types: `src/types/team.ts` with all interfaces | Phase 4 complete |
| 5b | Migration: `ops_alerts` table + `rep_presence` ALTER | 5a |
| 5c | Exception detection service: `src/services/team/exceptionService.ts` | 5b |
| 5d | API routes: `GET /api/team/live`, `GET /api/team/exceptions`, `PATCH /api/team/exceptions/:id` | 5c |
| 5e | API routes: `GET /api/team/coverage-gaps`, `GET /api/team/leaderboard`, `GET /api/team/:userId` | 5d |
| 5f | API routes: `POST /api/team/reassign`, `POST /api/team/ping` | 5e |
| 5g | API route: `POST /api/ai/reassignment-suggestions` | 5f |
| 5h | Team page UI: replace V1 page with Team Hub (map + status board + exception feed) | 5d, 5e |
| 5i | Rep Detail Drawer component | 5h |
| 5j | Integration tests for exception detection + team live | 5c, 5d |

---

*End of Team Module Specification.*
