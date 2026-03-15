# Stormclose V2 — Mission & Geolocation System

> Canonical reference for the mission lifecycle, stop lifecycle, AI deployment logic, geolocation architecture, next-best house algorithm, exception model, and all related data contracts.
> Derives from: `PRODUCT_CONTRACT_V2.md` §3 (Core Workflow), §4 (Roles), §5 (Missions screen), `stormclose-enterprise-architecture.md` §5 (Screen Architecture), §7 (Data Architecture), §8 (API Architecture), §10 (Geolocation Architecture), `stormclose-navigation-design.md` §3 (Role Visibility Matrix).
> Builds on: Existing `canvass_missions`, `mission_stops`, `storm_events_cache`, `team_locations`, `team_members`, `leads` tables and `MissionService`, `RouteService`, `ParcelCacheService` implementations.
> Last updated: 2026-03-14

---

## 1. Mission Lifecycle

### 1.1 State Machine

```
                      ┌─────────┐
              ┌──────►│ expired │
              │       └─────────┘
              │ (auto: 48h past scheduled_date
              │  with no activation)
              │
┌─────────┐   │   ┌─────────┐       ┌───────────┐
│ planned │───┼──►│ active  │──────►│ completed │
└─────────┘   │   └────┬────┘       └───────────┘
              │        │ ▲
              │        │ │
              │        ▼ │
              │   ┌─────────┐
              └──►│ paused  │
                  └─────────┘
```

### 1.2 Transition Rules

| From | To | Trigger | Who/What | Pre-conditions | Side Effects |
|---|---|---|---|---|---|
| — | `planned` | Mission creation (from storm zone, deployment plan, or manual) | AI auto-create / Owner / Manager | At least 1 stop. `assigned_rep_id` may be null (unassigned). | Emit `mission_created` event. Fire route optimization (async). Log `mission_events` row. |
| `planned` | `active` | Rep taps "Start Mission" or Manager activates | Rep (own) / Owner / Manager | `assigned_rep_id` must be set. Rep must not have another active mission. | Set `started_at = NOW()`. Begin geolocation heartbeats. Emit `mission_activated`. Create initial `rep_presence` row. |
| `planned` | `paused` | Manager pauses before activation (weather hold, reassignment pending) | Owner / Manager | — | Log reason in `mission_events`. Emit `mission_paused`. |
| `planned` | `expired` | 48 hours past `scheduled_date` with no activation | System cron (`/api/cron/expire-missions`) | `status = 'planned'` AND `scheduled_date < NOW() - INTERVAL '48 hours'` | Emit `mission_expired`. Set `expired_at = NOW()`. |
| `active` | `paused` | Rep taps "Pause" or Manager pauses | Rep (own) / Owner / Manager | — | Stop heartbeats. Snapshot current progress. Log reason. Emit `mission_paused`. |
| `active` | `completed` | Rep taps "Complete" or all stops resolved | Rep (own) / Owner / Manager / Auto (when `remaining_stops = 0`) | All stops must be in a terminal outcome OR manual override with reason. | Set `completed_at = NOW()`. Stop heartbeats. Final stats snapshot. Emit `mission_completed`. Trigger export check for interested stops. |
| `paused` | `active` | Rep or Manager resumes | Rep (own) / Owner / Manager | Rep must not have another active mission. | Resume heartbeats. Emit `mission_resumed`. |
| `paused` | `expired` | 48h in paused state | System cron | `status = 'paused'` AND `paused_at < NOW() - INTERVAL '48 hours'` | Same as planned → expired. |
| `completed` | — | Terminal state | — | — | — |
| `expired` | `planned` | Manager reactivates an expired mission | Owner / Manager | — | Reset `expired_at`. Emit `mission_reactivated`. Re-run route optimization. |

### 1.3 Invariants

- A rep can have **at most one** `active` mission at any time. Enforced at API and DB level.
- `completed` is **terminal** — no transitions out. If the mission needs rework, create a follow-up mission.
- Every transition is logged in `mission_events` with `{ actor_id, actor_type, from_status, to_status, reason, metadata, timestamp }`.
- `expired` missions can be reactivated (back to `planned`) but never directly to `active` — they must go through the planned → active transition again.

### 1.4 Mission Events Log

Every state transition, stop outcome change, assignment change, and rebalance action produces a `mission_events` row:

```typescript
// src/types/missions.ts

export type MissionEventType =
  | "created"
  | "activated"
  | "paused"
  | "resumed"
  | "completed"
  | "expired"
  | "reactivated"
  | "assigned"
  | "reassigned"
  | "rebalanced"
  | "stop_added"
  | "stop_removed"
  | "stop_outcome"
  | "route_optimized"
  | "note_added";

export interface MissionEvent {
  id: string;
  missionId: string;
  eventType: MissionEventType;
  actorId: string;
  actorType: "user" | "system" | "ai";
  fromStatus: MissionStatus | null;
  toStatus: MissionStatus | null;
  reason: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}
```

---

## 2. Stop Lifecycle

### 2.1 State Machine

```
┌─────┐     ┌──────────┐     ┌───────────┐
│ new │────►│ targeted │────►│ attempted │
└─────┘     └──────────┘     └─────┬─────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
             ┌───────────┐  ┌────────────┐  ┌─────────────────┐
             │ no_answer │  │ interested │  │ not_interested  │
             └─────┬─────┘  └──────┬─────┘  └─────────────────┘
                   │               │
                   ▼               ▼
         ┌─────────────────┐ ┌───────────────────┐
         │follow_up_needed │ │sent_to_jobnimbus  │
         └─────────────────┘ └───────────────────┘
```

### 2.2 Transition Rules & Data Capture

| From | To | Trigger | Data Captured |
|---|---|---|---|
| `new` | `targeted` | Mission activated OR rep navigating toward this stop | `targeted_at: ISO timestamp` |
| `targeted` | `attempted` | Rep arrives at property (auto via geofence, or manual tap "I'm Here") | `arrived_at: ISO timestamp`, `arrival_lat`, `arrival_lng`, `distance_from_stop_meters` |
| `attempted` | `no_answer` | Rep taps "No Answer" | `outcome_at`, `outcome_notes` (optional), `attempt_count` (incremented) |
| `attempted` | `interested` | Rep taps "Interested" | `outcome_at`, `homeowner_name`, `homeowner_phone` (optional), `homeowner_email` (optional), `outcome_notes`, `appointment_date` (optional), `interest_level: "high" \| "medium" \| "low"` |
| `attempted` | `not_interested` | Rep taps "Not Interested" | `outcome_at`, `decline_reason: "no_damage" \| "already_repaired" \| "insurance_pending" \| "not_homeowner" \| "other"`, `outcome_notes` (optional) |
| `no_answer` | `follow_up_needed` | Rep flags for follow-up OR auto-flag after 2nd no_answer | `follow_up_reason`, `preferred_follow_up_time` (optional) |
| `no_answer` | `attempted` | Rep returns to the same stop (retry) | Same as targeted → attempted. `attempt_count` incremented. |
| `interested` | `sent_to_jobnimbus` | Export triggered (manual or auto) | `exported_at`, `jobnimbus_contact_id`, `export_payload_hash` |
| `follow_up_needed` | `attempted` | Rep returns for follow-up visit | Same as targeted → attempted. `attempt_count` incremented. |

### 2.3 Terminal States

- `not_interested` — terminal. No further action.
- `sent_to_jobnimbus` — terminal. The handoff is complete.

### 2.4 Re-attempt Logic

- Stops in `no_answer` can be re-attempted up to 3 times per mission (configurable via `company_ai_profiles.max_reattempts`, default 3).
- After `max_reattempts`, `no_answer` auto-transitions to `follow_up_needed`.
- `follow_up_needed` stops surface in a separate "Follow-Up Queue" on the Missions screen and the Dashboard.

### 2.5 Geofence Arrival Detection

When a rep's heartbeat position is within **50 meters** of a stop's lat/lng AND the stop is `targeted`:
1. Auto-transition stop to `attempted`.
2. Show "You've arrived" prompt on mobile.
3. Pre-load AI context for this property (storm data, property intel, scoring reason).

The 50m threshold is configurable per company via `company_ai_profiles.arrival_geofence_meters`.

---

## 3. AI Deployment Logic

### 3.1 Core Principle

The owner should NOT sit there assigning everyone all day. AI recommends deployment; managers approve or override when needed.

### 3.2 Deployment Recommendation Generation

**Trigger:** Runs automatically when:
1. New storm zones scored (>= 60 opportunity score) — via `storm_zone_scored` event.
2. Daily at 5:00 AM local (company timezone) — pre-shift planning.
3. On-demand via `POST /api/ai/deployment-plan` by Owner/Manager.
4. When an exception is detected (no rep in hot zone, idle rep available).

**API:** `POST /api/ai/deployment-plan`

**Input assembly:**

```typescript
export interface DeploymentPlanInput {
  /** All active storm zones with scores, house counts, unworked counts. */
  stormZones: StormZoneSummary[];

  /** All available reps with current state. */
  reps: RepAvailability[];

  /** Active missions already assigned (to avoid double-deployment). */
  activeMissions: ActiveMissionSummary[];

  /** Company preferences. */
  companyProfile: {
    maxMissionsPerRep: number;       // default 1
    maxStopsPerMission: number;      // default 80
    preferClosestRep: boolean;       // default true
    autoDeployThreshold: number;     // zone score above which auto-deploy is allowed (default 85)
    approvalRequired: boolean;       // default true — require manager approval
    workingHoursStart: string;       // "08:00"
    workingHoursEnd: string;         // "18:00"
    timezone: string;                // "America/Chicago"
  };

  /** Historical rep performance for skill-matching. */
  repPerformance: RepPerformanceHistory[];
}

export interface RepAvailability {
  id: string;
  name: string;
  role: "rep";
  teamId: string;
  branchId: string | null;
  currentLat: number | null;
  currentLng: number | null;
  lastHeartbeatAt: string | null;
  fieldStatus: "active" | "idle" | "offline" | "paused";
  activeMissionId: string | null;
  activeMissionStopsRemaining: number;
  availableAt: string | null;          // estimated time available if on active mission
  skills: RepSkillProfile;
}

export interface RepSkillProfile {
  /** Appointment set rate (0-1) over last 30 days. */
  appointmentRate: number;
  /** Average doors per hour. */
  doorsPerHour: number;
  /** Average outcome quality score (0-100). */
  outcomeQualityScore: number;
  /** Storm types this rep has experience with. */
  experiencedStormTypes: ("hail" | "wind" | "tornado")[];
  /** Total missions completed. */
  missionsCompleted: number;
  /** Preferred zones (territory familiarity). */
  familiarZoneIds: string[];
}

export interface RepPerformanceHistory {
  repId: string;
  last30Days: {
    missionsCompleted: number;
    totalStops: number;
    appointmentRate: number;
    interestRate: number;
    avgDoorsPerHour: number;
    avgMissionCompletionMinutes: number;
  };
}

export interface ActiveMissionSummary {
  missionId: string;
  assignedRepId: string;
  stormZoneId: string | null;
  stopsRemaining: number;
  stopsCompleted: number;
  estimatedCompletionAt: string | null;
}
```

### 3.3 AI Decision Factors (Weighted)

The AI deployment model considers these factors when assigning reps to zones:

| Factor | Weight | Description |
|---|---|---|
| Zone opportunity score | 0.30 | Higher-scored zones get priority for best reps |
| Rep proximity to zone | 0.25 | Closer reps assigned first (reduces drive time) |
| Rep skill match | 0.15 | Higher appointment rate + outcome quality = preferred |
| Workload balance | 0.15 | Avoid overloading one rep while another is idle |
| Territory familiarity | 0.10 | Reps who've worked the area before are preferred |
| Storm type experience | 0.05 | Match rep experience to the storm type in the zone |

### 3.4 Deployment Recommendation Output

```typescript
export type DeploymentApprovalMode = "auto" | "requires_approval";

export interface DeploymentRecommendation {
  id: string;
  generatedAt: string;
  expiresAt: string;                        // 4 hours from generation
  status: "pending_approval" | "approved" | "partially_approved" | "rejected" | "auto_applied" | "expired";
  approvalMode: DeploymentApprovalMode;
  assignments: DeploymentAssignment[];
  unassignedZones: UnassignedZoneReason[];   // zones that couldn't be covered
  reasoning: string;                         // AI explanation of the plan
  model: string;                             // AI model used
  inputHash: string;                         // hash of inputs for idempotency
  totalEstimatedHouses: number;
  totalEstimatedDriveMinutes: number;
}

export interface DeploymentAssignment {
  repId: string;
  repName: string;
  stormZoneId: string;
  stormZoneName: string;
  estimatedHouseCount: number;
  estimatedDriveMinutes: number;
  estimatedWorkMinutes: number;
  matchScore: number;                        // 0-100 — how well this rep fits this zone
  matchReasons: string[];                    // ["closest rep (4.2 mi)", "highest appointment rate (38%)"]
  missionCreated: boolean;                   // false until approved
  missionId: string | null;                  // populated after approval creates mission
  overridden: boolean;                       // true if manager changed the assignment
  overrideReason: string | null;
}

export interface UnassignedZoneReason {
  stormZoneId: string;
  stormZoneName: string;
  reason: "no_available_reps" | "all_reps_at_capacity" | "zone_too_far" | "zone_score_below_threshold";
  suggestedAction: string;
}
```

### 3.5 Approval vs Auto-Deploy

| Condition | Behavior |
|---|---|
| `companyProfile.approvalRequired = true` (default) | All recommendations go to `pending_approval`. Manager/Owner sees "AI Deployment Plan" widget on Dashboard. |
| `companyProfile.approvalRequired = false` AND zone score ≥ `autoDeployThreshold` | Missions auto-created with status `planned`. Manager notified via alert. |
| `companyProfile.approvalRequired = false` AND zone score < `autoDeployThreshold` | Still requires approval (only high-confidence zones auto-deploy). |
| Manager approves individual assignments | Each assignment can be approved, rejected, or reassigned independently. |
| Recommendation expires (4 hours) | Status → `expired`. New recommendation generated on next trigger. |

### 3.6 Approval Flow

1. AI generates `DeploymentRecommendation` with N assignments.
2. Dashboard "AI Deployment Plan" widget shows the recommendation.
3. Manager can:
   - **Approve All** → Missions created for all assignments. Status → `approved`.
   - **Approve Some** → Selected assignments create missions. Status → `partially_approved`.
   - **Reject** → No missions created. Status → `rejected`. AI logs rejection reason for future learning.
   - **Override** → Change rep on an assignment, then approve. `overridden = true`.
4. Approved assignments fire `POST /api/missions` for each, creating `planned` missions with stops populated from the zone's ranked houses.

---

## 4. Geolocation Architecture

### 4.1 Heartbeat Model

**Active during:** `active` mission mode only. Tracking STOPS when mission is `paused`, `completed`, or rep has no active mission.

**Endpoint:** `POST /api/presence/heartbeat`

```typescript
export interface PresenceHeartbeat {
  /** Rep's current latitude. */
  lat: number;
  /** Rep's current longitude. */
  lng: number;
  /** GPS accuracy in meters (from device). */
  accuracyMeters: number;
  /** Heading in degrees (0-360, 0 = North). Null if stationary. */
  heading: number | null;
  /** Speed in m/s. Null if stationary. */
  speedMps: number | null;
  /** Device battery percentage (0-100). */
  batteryPercent: number | null;
  /** Current mission ID. Required. */
  missionId: string;
  /** Device timestamp (ISO 8601). Used to detect clock drift. */
  deviceTimestamp: string;
}
```

**Response:**

```typescript
export interface HeartbeatResponse {
  /** Next heartbeat interval in seconds. Server can adjust. */
  nextIntervalSeconds: number;
  /** Server-side commands for the client. */
  commands: HeartbeatCommand[];
}

export type HeartbeatCommand =
  | { type: "show_arrival"; stopId: string; stopAddress: string }
  | { type: "suggest_reroute"; reason: string; newStopOrder: string[] }
  | { type: "alert"; message: string; severity: "info" | "warning" }
  | { type: "mission_update"; field: string; value: unknown };
```

### 4.2 Heartbeat Frequency

| Condition | Interval | Rationale |
|---|---|---|
| Moving (speed > 2 m/s) | 15 seconds | High frequency for live map and ETA |
| Stationary at a stop | 60 seconds | Rep is working a door; conserve battery |
| Low battery (< 20%) | 60 seconds | Battery preservation |
| Background (app minimized) | 30 seconds | Balanced accuracy/battery |

The server returns `nextIntervalSeconds` in each heartbeat response, so the interval is server-controlled and can be adjusted dynamically.

### 4.3 Privacy Model

| Principle | Implementation |
|---|---|
| Tracking only during active mission | Client MUST NOT send heartbeats when no mission is active. Server rejects heartbeats without a valid active `missionId`. |
| Ephemeral position data | `rep_presence` table stores only the **latest** position per rep. Previous heartbeats are overwritten, not appended. |
| Historical breadcrumbs (optional) | If `company_ai_profiles.store_breadcrumbs = true`, heartbeats are appended to `rep_breadcrumbs` (partitioned by day, auto-deleted after 7 days). Used for route replay and idle detection. Default: `false`. |
| Mission end = tracking end | When mission transitions to `completed` or `paused`, the server deletes the `rep_presence` row. Client stops heartbeats. |
| No off-duty tracking | No mechanism exists to track reps outside of active mission mode. The system has no "always-on" location feature. |
| Data retention | `rep_presence`: real-time only (latest row). `rep_breadcrumbs`: 7-day TTL. Mission events: permanent (audit log). |
| Rep visibility | Reps can see their OWN position on map. They cannot see other reps. Only Owner/Manager see all rep positions. |

### 4.4 Rep Presence Data

```typescript
export interface RepPresence {
  id: string;
  userId: string;
  missionId: string;
  lat: number;
  lng: number;
  accuracyMeters: number;
  heading: number | null;
  speedMps: number | null;
  batteryPercent: number | null;
  fieldStatus: "active" | "idle" | "driving" | "at_door";
  currentStopId: string | null;
  lastHeartbeatAt: string;
  createdAt: string;
  updatedAt: string;
}
```

### 4.5 Field Status Derivation

`fieldStatus` is computed server-side from heartbeat data:

| Status | Condition |
|---|---|
| `active` | Mission is active, heartbeats arriving on schedule |
| `driving` | Speed > 5 m/s AND distance to current stop > 100m |
| `at_door` | Within 50m of the current targeted stop AND speed < 1 m/s |
| `idle` | No heartbeat received for > 5 minutes while mission is active |

### 4.6 Geolocation Consumers

| Consumer | What it reads | Frequency |
|---|---|---|
| **Live Rep Map** (Team screen, Mission Control) | `rep_presence` for all active reps | Poll every 15s or WebSocket |
| **Next-Best House** algorithm | Current rep position from `rep_presence` | On each stop outcome + on request |
| **Idle Detection** | `rep_presence.updated_at` vs NOW() | Every 60s (server cron) |
| **Off-Route Detection** | Rep position vs expected route polyline | Every heartbeat (server-side check) |
| **Coverage Gap Detection** | All rep positions vs all active zone centroids | Every 5 minutes (server cron) |
| **Arrival Geofence** | Rep position vs next stop lat/lng | Every heartbeat |
| **ETA Calculation** | Rep position + remaining stops + route data | On heartbeat when driving |

### 4.7 Mission Mode Lifecycle

```
Rep taps "Start Mission"
    │
    ▼
POST /api/presence/start-mission { missionId }
    │
    ├─ Validates: mission is planned/paused, assigned to this rep, rep has no other active mission
    ├─ Transitions mission: planned/paused → active
    ├─ Creates rep_presence row
    ├─ Returns: { nextIntervalSeconds: 15, missionId, stops: [...] }
    │
    ▼
Client begins heartbeat loop
    │
    ├─ POST /api/presence/heartbeat (every N seconds)
    │   ├─ Server updates rep_presence
    │   ├─ Server checks geofences
    │   ├─ Server detects idle/off-route
    │   └─ Returns: { nextIntervalSeconds, commands }
    │
    ▼
Rep taps "End Mission" or all stops complete
    │
    ▼
POST /api/presence/end-mission { missionId, reason }
    │
    ├─ Transitions mission: active → completed (or paused if reason = "pause")
    ├─ Deletes rep_presence row
    ├─ Returns: { summary: MissionCompletionSummary }
    │
    ▼
Client stops heartbeat loop
```

---

## 5. Next-Best House Algorithm

### 5.1 Purpose

When a rep finishes a stop, the system suggests the next best house to visit — not just the next stop in the original route order, but the dynamically optimal choice considering current position, remaining stops, and nearby unassigned high-value houses.

### 5.2 Trigger Conditions

| Trigger | Context |
|---|---|
| After each stop outcome is recorded | Auto-suggest next house |
| Rep taps "What's Next?" | On-demand request |
| Idle detected (> 5 min at a non-stop location) | Proactive suggestion via heartbeat command |
| Mission rebalance requested | Full re-ranking of remaining stops |

### 5.3 Algorithm Inputs

```typescript
export interface NextBestHouseInput {
  /** Rep's current position. */
  currentLat: number;
  currentLng: number;

  /** Remaining stops in the current mission (not yet visited). */
  remainingStops: MissionStopSummary[];

  /** Nearby unassigned houses from active storm zones (within 2 miles). */
  nearbyUnassigned: NearbyUnassignedHouse[];

  /** Current time and working hours remaining. */
  currentTime: string;
  workingHoursEnd: string;

  /** Rep's average minutes per stop (from performance history). */
  avgMinutesPerStop: number;

  /** Whether the company allows adding unassigned houses mid-mission. */
  allowMidMissionAdditions: boolean;
}

export interface MissionStopSummary {
  id: string;
  address: string;
  lat: number;
  lng: number;
  opportunityScore: number;
  stormAgeDays: number;
  estimatedValueBand: string;
  attemptCount: number;
  status: StopStatus;
}

export interface NearbyUnassignedHouse {
  targetId: string;
  address: string;
  lat: number;
  lng: number;
  opportunityScore: number;
  stormZoneId: string;
  stormZoneName: string;
  stormAgeDays: number;
  estimatedValueBand: string;
}
```

### 5.4 Scoring Formula

For each candidate house (remaining stops + nearby unassigned):

```
candidateScore =
    (opportunityScore / 100)             × 0.35    // house quality
  + (1 - distanceMiles / maxRadius)      × 0.30    // proximity to current position
  + (recencyBonus)                       × 0.15    // newer storms get priority
  + (timeEfficiency)                     × 0.10    // can rep reach + work before shift ends?
  + (noReattemptPenalty)                 × 0.10    // penalize houses already attempted 2+ times
```

Where:
- `maxRadius` = 5 miles (candidates beyond this are excluded)
- `recencyBonus` = `clamp(1 - stormAgeDays / 30, 0, 1)`
- `timeEfficiency` = `1.0` if estimated arrival + work fits within working hours, `0.0` otherwise
- `noReattemptPenalty` = `1.0` if `attemptCount = 0`, `0.5` if `attemptCount = 1`, `0.0` if `attemptCount >= 2`

### 5.5 Output

```typescript
export interface NextBestHouseResult {
  /** Top 5 ranked suggestions. */
  suggestions: NextBestHouseSuggestion[];
  /** Whether any suggestions are from outside the current mission. */
  includesUnassigned: boolean;
  /** Estimated houses workable before shift end. */
  estimatedRemainingCapacity: number;
  /** Generated at timestamp. */
  generatedAt: string;
}

export interface NextBestHouseSuggestion {
  rank: number;
  /** "mission_stop" or "unassigned" — whether this is already in the mission. */
  source: "mission_stop" | "unassigned";
  stopId: string | null;                  // non-null for mission stops
  targetId: string | null;                // non-null for unassigned houses
  address: string;
  lat: number;
  lng: number;
  distanceMiles: number;
  estimatedDriveMinutes: number;
  opportunityScore: number;
  candidateScore: number;                 // the computed composite score
  reasons: string[];                      // ["Highest opportunity score (89)", "0.3 mi away"]
  stormZoneName: string;
  estimatedValueBand: string;
}
```

### 5.6 Mid-Mission Addition Flow

When a rep selects an "unassigned" suggestion:
1. Client calls `PATCH /api/missions/:id` with `{ addStops: [{ targetId, address, lat, lng, ... }] }`.
2. Server adds the stop to the mission with `stop_order` = current max + 1.
3. Server logs `mission_events` with `eventType = "stop_added"`.
4. Route re-optimized for remaining stops (async).
5. Stop immediately set to `targeted`.

---

## 6. Exception Model

### 6.1 Exception Types

Every exception produces an `ops_alerts` row. Exceptions are surfaced on the Team screen (Exception Feed widget) and Mission Control.

| # | Exception Type | Trigger Condition | Severity | Suggested Action | Visible To |
|---|---|---|---|---|---|
| 1 | `idle_rep` | Rep has active mission but no heartbeat for > 5 minutes AND last known speed < 1 m/s | `warning` | "Check in with {rep}. Last seen at {address} {N} min ago." | Owner, Manager |
| 2 | `off_route` | Rep position > 0.5 miles from the nearest remaining stop or expected route polyline for > 10 minutes | `warning` | "Suggest reroute to {rep}. Currently {X} mi from nearest stop." | Owner, Manager |
| 3 | `no_rep_in_hot_zone` | Storm zone with score ≥ 75 has zero active missions AND zero reps within 10 miles | `critical` | "Deploy to {zone}. {N} unworked houses, score {S}. Nearest available rep: {rep} ({X} mi)." | Owner, Manager |
| 4 | `mission_nearly_complete_cluster_nearby` | Mission has ≤ 3 remaining stops AND there's an unworked cluster of ≥ 10 houses within 2 miles | `info` | "Extend mission for {rep}? {N} unworked houses {X} mi from current position." | Owner, Manager |
| 5 | `low_quality_outcomes` | Rep records ≥ 5 consecutive `not_interested` outcomes in current mission | `warning` | "Check pitch quality for {rep}. {N} consecutive rejections. Consider coaching or zone reassignment." | Owner, Manager |
| 6 | `export_backlog_growing` | Export queue has > 10 pending exports older than 2 hours | `warning` | "Export backlog at {N} items. Oldest: {X} hours. Process queue or check JobNimbus connection." | Owner, Manager, Office Admin |
| 7 | `battery_critical` | Rep's heartbeat reports battery < 10% | `warning` | "Battery critical for {rep} ({X}%). Mission may lose tracking." | Owner, Manager |
| 8 | `rep_inactive_during_hours` | Rep with `fieldStatus = "offline"` during working hours (8 AM–6 PM) AND has a `planned` mission | `info` | "Deploy {rep}? Planned mission '{mission}' not yet started." | Owner, Manager |
| 9 | `coverage_gap` | Active zone quadrant with ≥ 20 unworked houses AND no rep within 3 miles of the quadrant centroid | `info` | "Coverage gap in {zone} ({quadrant}). {N} unworked houses with no nearby rep." | Owner, Manager |
| 10 | `heartbeat_lost` | No heartbeat from rep with active mission for > 15 minutes | `critical` | "Lost contact with {rep}. Last known position: {address}. Mission: {mission}." | Owner, Manager |
| 11 | `mission_overtime` | Active mission duration > 10 hours | `info` | "Mission '{name}' has been active for {N} hours. Check on {rep}." | Owner, Manager |
| 12 | `duplicate_zone_deployment` | Two missions created for the same zone with overlapping stop addresses (> 50% overlap) | `warning` | "Possible duplicate deployment in {zone}. Mission A ({repA}) and Mission B ({repB}) overlap {N}%." | Owner, Manager |

### 6.2 Exception Data Contract

```typescript
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
  /** Related entity IDs for deep-linking. */
  context: {
    repId?: string;
    repName?: string;
    missionId?: string;
    missionName?: string;
    stormZoneId?: string;
    stormZoneName?: string;
    lat?: number;
    lng?: number;
  };
  /** Whether this exception has been acknowledged by a manager. */
  acknowledged: boolean;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  /** Auto-resolved when the condition clears. */
  resolvedAt: string | null;
  createdAt: string;
  expiresAt: string;           // exceptions auto-expire after 4 hours if unacknowledged
}
```

### 6.3 Exception Detection Schedule

| Exception | Detection Method | Frequency |
|---|---|---|
| `idle_rep`, `off_route`, `battery_critical`, `heartbeat_lost` | Evaluated on each heartbeat + 60s server cron for timeouts | Real-time + 60s |
| `no_rep_in_hot_zone`, `coverage_gap` | Server cron | Every 5 minutes |
| `mission_nearly_complete_cluster_nearby` | After each stop outcome | Real-time |
| `low_quality_outcomes` | After each stop outcome | Real-time |
| `export_backlog_growing` | Server cron | Every 10 minutes |
| `rep_inactive_during_hours` | Server cron | Every 15 minutes (during working hours only) |
| `mission_overtime` | Server cron | Every 30 minutes |
| `duplicate_zone_deployment` | On mission creation | Real-time |

---

## 7. Data Contracts

### 7.1 Mission

```typescript
export type MissionStatus = "planned" | "active" | "paused" | "completed" | "expired";

export type MissionSource = "ai_deployment" | "storm_zone" | "manual" | "reactivated";

export interface Mission {
  id: string;
  /** User who created the mission (may differ from assigned rep). */
  createdById: string;
  /** Rep assigned to execute the mission. Null = unassigned. */
  assignedRepId: string | null;
  assignedRepName: string | null;
  teamId: string;
  branchId: string | null;

  /** Mission identity. */
  name: string;
  description: string | null;
  source: MissionSource;

  /** Storm zone linkage. */
  stormEventId: string | null;
  stormZoneId: string | null;
  stormZoneName: string | null;

  /** Target area center + radius. */
  centerLat: number;
  centerLng: number;
  radiusMiles: number;

  /** Idempotency. */
  missionSignature: string;

  /** Schedule. */
  scheduledDate: string | null;        // ISO date (YYYY-MM-DD)
  startedAt: string | null;
  completedAt: string | null;
  expiredAt: string | null;
  pausedAt: string | null;

  /** Status. */
  status: MissionStatus;

  /** Denormalized stop stats (updated by trigger on stop outcome changes). */
  totalStops: number;
  stopsCompleted: number;
  stopsRemaining: number;
  stopsNoAnswer: number;
  stopsInterested: number;
  stopsNotInterested: number;
  stopsSentToJobNimbus: number;
  stopsFollowUpNeeded: number;

  /** Revenue tracking. */
  estimatedPipeline: number;           // sum of estimated_claim for all stops
  actualPipeline: number;              // sum of estimated_claim for interested/exported stops

  /** Route data (cached from RouteService). */
  optimizedRoute: OptimizedRouteData | null;
  estimatedDurationMinutes: number | null;
  estimatedDistanceMiles: number | null;

  /** Weather at mission area. */
  weatherConditions: WeatherSnapshot | null;

  /** Completion metrics (populated on completion). */
  completionSummary: MissionCompletionSummary | null;

  /** Timestamps. */
  createdAt: string;
  updatedAt: string;
}

export interface OptimizedRouteData {
  /** Ordered stop IDs representing the optimized route. */
  stopOrder: string[];
  /** Route polyline (encoded). */
  polyline: string | null;
  /** Provider that generated this route. */
  provider: "google" | "local";
  /** When the route was last optimized. */
  optimizedAt: string;
}

export interface WeatherSnapshot {
  tempF: number;
  condition: string;
  windSpeedMph: number;
  precipChance: number;
  capturedAt: string;
}

export interface MissionCompletionSummary {
  totalDurationMinutes: number;
  totalDistanceMiles: number;
  doorsKnocked: number;
  appointmentsSet: number;
  interestRate: number;               // interested / (interested + not_interested + no_answer)
  avgMinutesPerStop: number;
  pipeline: number;
  topOutcome: string;
  completedAt: string;
}
```

### 7.2 MissionStop

```typescript
export type StopStatus =
  | "new"
  | "targeted"
  | "attempted"
  | "no_answer"
  | "interested"
  | "not_interested"
  | "follow_up_needed"
  | "sent_to_jobnimbus";

export interface MissionStop {
  id: string;
  missionId: string;
  userId: string;

  /** Position within route. */
  stopOrder: number;

  /** Property location. */
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  lat: number;
  lng: number;

  /** Property intel (cached at mission creation from CoreLogic/parcel_cache). */
  ownerName: string | null;
  yearBuilt: number | null;
  squareFeet: number | null;
  roofAge: number | null;
  estimatedValue: number | null;
  estimatedClaim: number | null;
  propertyType: string | null;

  /** Scoring. */
  opportunityScore: number;
  scoreTier: ScoreTier;
  aiRankingReason: string | null;

  /** Storm context. */
  stormZoneId: string | null;
  stormZoneName: string | null;
  stormAgeDays: number | null;
  stormSeverity: StormSeverity | null;

  /** Status. */
  status: StopStatus;
  attemptCount: number;

  /** Outcome data (populated as rep progresses). */
  homeownerName: string | null;
  homeownerPhone: string | null;
  homeownerEmail: string | null;
  outcomeNotes: string | null;
  declineReason: DeclineReason | null;
  interestLevel: "high" | "medium" | "low" | null;
  appointmentDate: string | null;
  followUpReason: string | null;
  preferredFollowUpTime: string | null;

  /** Arrival tracking. */
  targetedAt: string | null;
  arrivedAt: string | null;
  arrivalLat: number | null;
  arrivalLng: number | null;
  distanceFromStopMeters: number | null;
  outcomeAt: string | null;
  completedAt: string | null;

  /** Export linkage. */
  exportedAt: string | null;
  jobNimbusContactId: string | null;
  leadId: string | null;

  /** Timestamps. */
  createdAt: string;
  updatedAt: string;
}

export type DeclineReason =
  | "no_damage"
  | "already_repaired"
  | "insurance_pending"
  | "not_homeowner"
  | "other";
```

### 7.3 RepPresence

```typescript
export interface RepPresence {
  id: string;
  userId: string;
  userName: string;
  missionId: string;
  missionName: string;

  /** Current position. */
  lat: number;
  lng: number;
  accuracyMeters: number;
  heading: number | null;
  speedMps: number | null;
  batteryPercent: number | null;

  /** Derived status. */
  fieldStatus: "active" | "idle" | "driving" | "at_door";

  /** Current stop context. */
  currentStopId: string | null;
  currentStopAddress: string | null;
  stopsCompleted: number;
  stopsRemaining: number;

  /** Heartbeat timing. */
  lastHeartbeatAt: string;
  heartbeatIntervalSeconds: number;

  /** Timestamps. */
  createdAt: string;
  updatedAt: string;
}
```

### 7.4 DeploymentRecommendation

(See §3.4 above — `DeploymentRecommendation`, `DeploymentAssignment`, `UnassignedZoneReason`.)

### 7.5 NextBestHouse

(See §5.5 above — `NextBestHouseResult`, `NextBestHouseSuggestion`.)

---

## 8. API Endpoints Summary

### Mission APIs

| Method | Path | Purpose | Roles |
|---|---|---|---|
| `GET` | `/api/missions` | List missions (filtered by role: rep sees own, manager sees team) | Owner, Manager, Rep |
| `POST` | `/api/missions` | Create mission (from deployment plan, manual, or storm zone) | Owner, Manager |
| `GET` | `/api/missions/:id` | Get mission detail with stops | Owner, Manager, Rep (own) |
| `PATCH` | `/api/missions/:id` | Update mission (status, add/remove stops, reassign) | Owner, Manager, Rep (own — limited to status transitions) |
| `POST` | `/api/missions/create-from-storm` | Create mission from storm event (existing) | Owner, Manager |
| `POST` | `/api/missions/:id/rebalance` | Re-optimize remaining stops + add nearby houses | Owner, Manager, Rep (own) |

### Stop APIs

| Method | Path | Purpose | Roles |
|---|---|---|---|
| `PATCH` | `/api/mission-stops/:id/outcome` | Record stop outcome | Rep (own) |
| `GET` | `/api/mission-stops/:id/ai-context` | Get AI-assembled context for this property | Rep (own) |

### Presence / Geolocation APIs

| Method | Path | Purpose | Roles |
|---|---|---|---|
| `POST` | `/api/presence/start-mission` | Begin active mission mode + geolocation | Rep |
| `POST` | `/api/presence/heartbeat` | Send position update | Rep |
| `POST` | `/api/presence/end-mission` | End active mission mode | Rep |
| `GET` | `/api/team/live` | Get all active rep positions + statuses | Owner, Manager |
| `GET` | `/api/team/exceptions` | Get active ops exceptions | Owner, Manager, Office Admin |
| `POST` | `/api/team/reassign` | Reassign rep to different mission | Owner, Manager |

### AI Deployment APIs

| Method | Path | Purpose | Roles |
|---|---|---|---|
| `POST` | `/api/ai/deployment-plan` | Generate deployment recommendation | Owner, Manager |
| `PATCH` | `/api/ai/deployment-plan/:id` | Approve/reject/override deployment | Owner, Manager |
| `POST` | `/api/ai/next-best-house` | Get next-best house suggestions | Rep |
| `POST` | `/api/ai/mission-copilot` | Contextual AI assistance during mission | Rep |
| `POST` | `/api/ai/reassignment-suggestions` | AI suggestions for reassigning reps | Owner, Manager |

---

## 9. Database Schema Additions

The following new tables and columns are required beyond the existing `canvass_missions`, `mission_stops`, `storm_events_cache`, and `team_locations` schemas:

### 9.1 New Tables

```sql
-- Mission events audit log
CREATE TABLE IF NOT EXISTS mission_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id UUID NOT NULL REFERENCES canvass_missions(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    actor_id UUID NOT NULL,
    actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'system', 'ai')),
    from_status TEXT,
    to_status TEXT,
    reason TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Real-time rep presence (one row per active rep, upserted on heartbeat)
CREATE TABLE IF NOT EXISTS rep_presence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    mission_id UUID NOT NULL REFERENCES canvass_missions(id) ON DELETE CASCADE,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    accuracy_meters DOUBLE PRECISION,
    heading DOUBLE PRECISION,
    speed_mps DOUBLE PRECISION,
    battery_percent INTEGER,
    field_status TEXT DEFAULT 'active' CHECK (field_status IN ('active', 'idle', 'driving', 'at_door')),
    current_stop_id UUID REFERENCES mission_stops(id),
    heartbeat_interval_seconds INTEGER DEFAULT 15,
    last_heartbeat_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Optional breadcrumb trail (partitioned, 7-day TTL)
CREATE TABLE IF NOT EXISTS rep_breadcrumbs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    mission_id UUID NOT NULL REFERENCES canvass_missions(id) ON DELETE CASCADE,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    accuracy_meters DOUBLE PRECISION,
    speed_mps DOUBLE PRECISION,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ops exceptions / alerts
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

-- AI deployment recommendations
CREATE TABLE IF NOT EXISTS deployment_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status TEXT NOT NULL CHECK (status IN ('pending_approval', 'approved', 'partially_approved', 'rejected', 'auto_applied', 'expired')),
    approval_mode TEXT NOT NULL CHECK (approval_mode IN ('auto', 'requires_approval')),
    assignments JSONB NOT NULL DEFAULT '[]',
    unassigned_zones JSONB DEFAULT '[]',
    reasoning TEXT,
    model TEXT,
    input_hash TEXT,
    total_estimated_houses INTEGER DEFAULT 0,
    total_estimated_drive_minutes INTEGER DEFAULT 0,
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 9.2 Columns to Add to Existing Tables

```sql
-- canvass_missions: add V2 fields
ALTER TABLE canvass_missions
ADD COLUMN IF NOT EXISTS assigned_rep_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS assigned_rep_name TEXT,
ADD COLUMN IF NOT EXISTS branch_id UUID,
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual' CHECK (source IN ('ai_deployment', 'storm_zone', 'manual', 'reactivated')),
ADD COLUMN IF NOT EXISTS storm_zone_id UUID,
ADD COLUMN IF NOT EXISTS storm_zone_name TEXT,
ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS expired_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS completion_summary JSONB;

-- mission_stops: add V2 fields
ALTER TABLE mission_stops
ADD COLUMN IF NOT EXISTS opportunity_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS score_tier TEXT,
ADD COLUMN IF NOT EXISTS ai_ranking_reason TEXT,
ADD COLUMN IF NOT EXISTS storm_zone_id UUID,
ADD COLUMN IF NOT EXISTS storm_zone_name TEXT,
ADD COLUMN IF NOT EXISTS storm_age_days INTEGER,
ADD COLUMN IF NOT EXISTS storm_severity TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'new' CHECK (status IN ('new', 'targeted', 'attempted', 'no_answer', 'interested', 'not_interested', 'follow_up_needed', 'sent_to_jobnimbus')),
ADD COLUMN IF NOT EXISTS attempt_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS interest_level TEXT CHECK (interest_level IN ('high', 'medium', 'low')),
ADD COLUMN IF NOT EXISTS decline_reason TEXT,
ADD COLUMN IF NOT EXISTS follow_up_reason TEXT,
ADD COLUMN IF NOT EXISTS preferred_follow_up_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS targeted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS arrival_lat DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS arrival_lng DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS distance_from_stop_meters DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS outcome_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS exported_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS jobnimbus_contact_id TEXT;
```

---

## 10. Implementation Sequence

| Phase | Deliverable | Dependencies |
|---|---|---|
| 4a | Migration: `mission_events`, `rep_presence`, `ops_alerts`, `deployment_recommendations` tables + ALTER columns | Phase 3 complete |
| 4b | Mission state machine service (`MissionStateMachine`) + API routes (`GET/POST/PATCH /api/missions`) | 4a |
| 4c | Stop outcome API (`PATCH /api/mission-stops/:id/outcome`) with lifecycle enforcement | 4b |
| 4d | Presence heartbeat API (`POST /api/presence/*`) + `RepPresenceService` | 4a |
| 4e | Exception detection service + `GET /api/team/exceptions` | 4d |
| 4f | Next-best house algorithm + `POST /api/ai/next-best-house` | 4c, 4d |
| 4g | AI deployment plan generation + approval flow | 4b, 4f |
| 4h | Missions page UI (list + map + stop detail + progress) | 4b, 4c |
| 4i | Team screen (live map + exception feed) | 4d, 4e |
| 4j | Integration tests for full mission lifecycle | 4a–4f |

---

*End of Mission & Geolocation System Specification.*
