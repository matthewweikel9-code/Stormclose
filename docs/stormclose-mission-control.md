# Stormclose V2 — Mission Control Specification

> Canonical reference for layout, animation, refresh, rotation, and data contracts for the Mission Control TV mode.
> Derives from: `PRODUCT_CONTRACT_V2.md` §5 (Mission Control), `stormclose-enterprise-architecture.md` §5 (Screen Architecture), `stormclose-navigation-design.md` §5 (TV Mode), `stormclose-team-module.md` (Exception Model), `stormclose-dashboard-widgets.md` (KPI patterns).
> Builds on: `GET /api/team/live`, `GET /api/team/exceptions`, `GET /api/team/leaderboard`, `GET /api/missions`, `GET /api/storms` endpoints and existing `PresenceService`, `MissionsService`, `exceptionService` implementations.
> Last updated: 2026-03-14

---

## 1. Purpose & Constraints

**Purpose:** A zero-interaction, always-on fullscreen display for an office TV that shows the operational heartbeat of the company's storm sales operation. It must look impressive to visitors, keep the office aware of field activity, and surface exceptions that need attention — all without anyone touching it.

**Route:** `/dashboard/mission-control`

**TV Mode launch:** "Launch TV Mode" button in the page header. TV Mode sets `?tv=true` query param, hides sidebar + top nav + KPI strip, and renders content full-viewport. `Escape` key or tap anywhere shows a floating "Exit TV Mode" overlay (auto-hides after 3 seconds).

**Role visibility:**

| Role | Access |
|---|---|
| Owner | ✅ Full |
| Manager | ✅ Full |
| Rep | ❌ Hidden — sidebar item not rendered |
| Office Admin | ✅ Read-only |

**Non-functional requirements:**
- Must render legibly on a 55" 4K TV from 15 feet away.
- Must survive 24+ hours without refresh or memory leak.
- No user interaction required after launch.
- Graceful degradation when data is stale or API is unreachable.

---

## 2. Grid Layout

### 2.1 Fullscreen Grid (16:9 viewport, 1920×1080 reference)

```
┌─────────────────────────────────────────────────────────┬──────────────┐
│                                                         │              │
│                                                         │  KPI Tower   │
│                   Hero Live Map                         │  (col 2)     │
│                   (col 1, row 1-3)                      │  (row 1)     │
│                   60% width × 75% height                │  16% width   │
│                                                         │  37.5% h     │
│                                                         │              │
│                                                         ├──────────────┤
│                                                         │              │
│                                                         │  Rotating    │
│                                                         │  Panel       │
│                                                         │  (row 2)     │
│                                                         │  37.5% h     │
├───────────────────────┬─────────────────────────────────┤              │
│                       │                                 │              │
│  Storm Alert /        │                                 ├──────────────┤
│  AI Ops Insight       │      Bottom Ticker              │  Top Rep     │
│  (col 1a)             │      (col 1b)                   │  (row 3)     │
│  24% width            │      36% width                  │  25% h       │
│  25% height           │      25% height                 │  16% width   │
│                       │                                 │              │
└───────────────────────┴─────────────────────────────────┴──────────────┘
```

### 2.2 CSS Grid Definition

```css
.mc-grid {
  display: grid;
  grid-template-columns: 24fr 36fr 16fr;      /* 3 columns */
  grid-template-rows: 3fr 3fr 2fr;             /* 3 rows   */
  gap: 12px;
  padding: 16px;
  height: 100vh;
  width: 100vw;
  background: var(--storm-bg);                 /* #0B0F1A */
}
```

| Widget | Grid Area | Proportional Size |
|---|---|---|
| Hero Live Map | `col 1-2, row 1-2` | 60% × 75% — dominant element |
| KPI Tower | `col 3, row 1` | 16% × 37.5% — right column top |
| Rotating Panel | `col 3, row 2` | 16% × 37.5% — right column middle |
| Top Rep | `col 3, row 3` | 16% × 25% — right column bottom |
| Storm Alert / AI Insight | `col 1, row 3` | 24% × 25% — bottom left |
| Bottom Ticker | `col 2, row 3` | 36% × 25% — bottom center |

### 2.3 Grid Template Areas

```css
.mc-grid {
  grid-template-areas:
    "map     map     kpi"
    "map     map     rotating"
    "alert   ticker  toprep";
}
```

---

## 3. Widget Specifications

### 3.1 Hero Live Map

**Grid area:** `map` (spans 2 columns, 2 rows — largest element)

**Content:**
- Mapbox GL JS dark-v11 style, no interaction controls (zoom/pan disabled for TV).
- **Storm zones:** Rendered as translucent purple polygon fills (`storm-purple` at 20% opacity) with white border strokes. Zone labels rendered as Mapbox symbol layers showing zone name + score.
- **Rep dots:** Animated pulsing circles. Color encodes field status:
  - `active` / `at_door` → green (`#10B981`, storm-success)
  - `driving` → blue (`#3B82F6`, storm-info)
  - `idle` → yellow (`#F59E0B`, storm-warning)
  - `offline` → gray (`#64748B`, storm-subtle) — rendered smaller, no pulse
- **Rep labels:** Name + mission completion % shown as Mapbox popup anchored above the dot. Font size 14px. Only shown for active reps (max 20 labels to avoid clutter; if >20 reps, show top 20 by activity).
- **Cluster markers:** When reps are within 0.5 miles of each other, cluster into a numbered circle showing count.
- **Storm alert flash:** When a new storm event is detected (via polling), the affected area gets a brief red ring pulse animation (2 seconds, then settles to purple zone fill).
- **Bounds:** Auto-fit to all active rep positions + all active zone centroids with 20% padding. Re-fit every 5 minutes (not on every poll — prevents jarring re-centers).

**Overlay elements (rendered as HTML, not Mapbox layers):**
- Top-left: Stormclose logo mark (32px, white, 50% opacity).
- Top-right: Current time in `h:mm A` format, updated every minute. Font: 20px, `text-storm-muted`.
- Bottom-left: "LIVE" badge — green dot with pulse animation + "LIVE" text. Shows amber "DELAYED" if last successful poll was >60 seconds ago. Shows red "OFFLINE" if >3 minutes.

**Refresh:** Every 15 seconds (matches presence heartbeat cadence).

**Stale behavior:** If data is >60 seconds old, overlay dims to 50% opacity and "DELAYED" badge replaces "LIVE". If >3 minutes, "OFFLINE" badge. Map remains showing last known positions.

---

### 3.2 KPI Tower

**Grid area:** `kpi`

**Content:** Vertical stack of 5 large-format KPI cards. Each card:
- Large number: `text-5xl font-bold` (readable from 15ft)
- Label below: `text-sm uppercase tracking-widest text-storm-muted`
- Subtle separator between cards (1px `storm-border`)

| Position | Label | Source API | Number Color | Behavior |
|---|---|---|---|---|
| 1 | Reps In Field | `GET /api/team/live` → `kpi.repsActiveCount` | `text-green-400` | Green pulse dot next to number |
| 2 | Active Missions | `GET /api/team/live` → missions count | `text-storm-purple` | — |
| 3 | Houses Left | `GET /api/team/live` → `kpi.housesHitTodayCount` inverse | `text-white` | — |
| 4 | Qualified Today | Computed from mission stops with `interested` outcome | `text-yellow-400` | — |
| 5 | Sent to JN | Export count (from exports API or aggregated) | `text-blue-400` | — |

**Number transition animation:** When a value changes, the old number fades out-up and the new number fades in-up using the existing `count-up` keyframe (0.6s ease-out). This creates a subtle "counter ticking" effect.

**Refresh:** Every 30 seconds.

**Stale behavior:** Numbers dim to 50% opacity after 2 minutes of no update.

---

### 3.3 Rotating Panel

**Grid area:** `rotating`

**Content:** This panel cycles through 3 sub-panels on a fixed rotation:

| Slot | Panel | Duration | Content |
|---|---|---|---|
| A | AI Priority Zone | 15 seconds | Highest-score active storm zone. Shows: zone name, score (large), house count, "Unworked: X" in amber if X > 0. Background: subtle purple gradient pulse. |
| B | Unworked Hot Cluster | 15 seconds | Nearest unworked cluster with >20 houses. Shows: cluster name, house count, distance from nearest rep, "Deploy?" suggestion. Background: subtle amber gradient. |
| C | AI Ops Insight | 15 seconds | Single AI-generated insight sentence. Rotates through a pre-fetched list of 5–10 insights (fetched once per 5 minutes). Examples: "Rep Jake has hit 32 doors today — 40% above team average.", "North Dallas Zone has cooled — consider redeploying Sarah.", "Export backlog cleared. 12 opportunities pushed to JobNimbus in the last hour." |

**Transition animation:** Crossfade between panels (opacity 0→1 over 500ms with `ease-in-out`). Panel content slides up 8px during fade-in (reuses `fadeInUp` keyframe).

**Rotation cycle:** 45 seconds total (3 × 15s). Continuous loop.

**Pause rotation:** Never. Rotation is uninterruptible. No user interaction.

**Refresh:** Underlying data refreshes every 60 seconds. The rotation continues showing cached data between refreshes.

**Stale behavior:** If data is >5 minutes old, show "Data may be delayed" in `text-xs text-storm-subtle` below the panel content.

---

### 3.4 Top Rep

**Grid area:** `toprep`

**Content:** Today's leading rep by doors knocked.
- Avatar placeholder (colored circle with initials, 48px)
- Name: `text-lg font-bold text-white`
- "Top Rep Today" label: `text-xs uppercase text-storm-muted`
- Key stat: "42 doors · 8 appointments · 19% conv." in `text-sm text-storm-muted`
- Trophy icon (`🏆`) next to name
- Subtle gold gradient border on the card (`from-yellow-500/20 to-yellow-600/5`)

**Rotation:** If there are multiple teams, rotate between "Top Rep" and "Top Team" every 30 seconds.

**Refresh:** Every 60 seconds.

**Stale behavior:** Dims after 5 minutes.

---

### 3.5 Storm Alert / AI Ops Insight

**Grid area:** `alert`

**Default state (no active alert):** Shows the most recent AI ops insight (same pool as Rotating Panel slot C, but shows a different insight to avoid duplication).

**Alert state (new storm detected):** When a new storm event appears in the data:
1. Panel background flashes `storm-danger` (red) at 30% opacity with a 2-second pulse, then settles to `storm-danger` at 10%.
2. Lightning bolt icon (`⚡`) appears with glow animation.
3. Alert text: "NEW STORM: {zone_name}" in `text-lg font-bold text-red-400`.
4. Sub-text: "{event_count} events · {max_hail_size}" hail · {house_count} houses" in `text-sm text-storm-muted`.
5. Alert persists for 5 minutes, then auto-dismisses back to AI insight mode.
6. If multiple storms detected within 5 minutes, stack them (most recent on top, max 3 visible).

**Sound:** **No.** The product contract specifies TV mode as zero-interaction. Sound would require a user to unmute the browser tab. Audio is architecturally unreliable in a kiosk-like setup. Visual alerts (flash, pulse, color change) are sufficient.

**Refresh:** Alert detection runs every 30 seconds (same poll as exceptions). AI insights refresh every 5 minutes.

---

### 3.6 Bottom Ticker

**Grid area:** `ticker`

**Content:** A continuously scrolling horizontal ticker showing recent operational events, styled like a news crawl.

**Event sources (merged + sorted by timestamp, newest first):**
- Mission state changes: "✅ Mission 'North Dallas Hail' completed by Jake (32 doors)"
- Stop outcomes: "🏠 Interested: 742 Oak Ave — appointment set for 3/15"
- Exports: "📤 Exported: Johnson family → JobNimbus"
- Exception detections: "⚠️ Alert: Sarah idle for 12 minutes"
- New storms: "🌩️ New storm zone: SW Fort Worth Wind Cluster (score 78)"

**Visual:**
- Background: `storm-z1` with 1px `storm-border` top and bottom
- Text: `text-sm text-storm-muted` — event type icon leads, timestamp trails
- Scrolling: CSS `animation: ticker 60s linear infinite` — continuous left scroll. Speed: approximately 60px/second (entire ticker width traverses in ~30 seconds for a 1920px screen).
- Separator between events: `·` (middle dot) in `text-storm-subtle`

**Event buffer:** Holds last 50 events. When buffer is full, oldest events are evicted.

**Refresh:** New events are appended to the buffer every 30 seconds. The scroll animation does not restart — new items are spliced into the scroll at the right edge.

**Stale behavior:** If no new events for 10 minutes, ticker shows: "No recent activity — last event {X} minutes ago" as a static centered message.

---

## 4. Refresh Schedule Summary

| Widget | Interval | Source API | Notes |
|---|---|---|---|
| Hero Live Map | 15s | `GET /api/team/live` | Matches heartbeat cadence |
| KPI Tower | 30s | `GET /api/mission-control/live` | Aggregated endpoint |
| Rotating Panel | 60s data / 15s visual | `GET /api/mission-control/live` | Data refreshes every 60s; panel rotates every 15s |
| Top Rep | 60s | `GET /api/team/leaderboard?period=today` | — |
| Storm Alert | 30s | `GET /api/team/exceptions` + storm events | Alert-priority polling |
| AI Ops Insight | 300s (5 min) | `GET /api/mission-control/live` → `insights[]` | Pre-fetched batch |
| Bottom Ticker | 30s | `GET /api/mission-control/live` → `recentEvents[]` | Append-only buffer |

### 4.1 API Consolidation

To minimize network requests from a single TV page, all widget data (except the map's rep positions) is consolidated into **one aggregated endpoint**:

**`GET /api/mission-control/live`**

Returns:

```typescript
// src/types/mission-control.ts

export interface MissionControlLiveData {
  /** Current timestamp */
  timestamp: string;

  /** KPI values */
  kpi: {
    repsInField: number;
    activeMissions: number;
    housesLeftToHit: number;
    qualifiedToday: number;
    sentToJobNimbusToday: number;
  };

  /** All active rep positions (fed to map) */
  reps: Array<{
    userId: string;
    name: string;
    lat: number;
    lng: number;
    fieldStatus: "active" | "at_door" | "driving" | "idle" | "offline";
    missionName: string | null;
    completionPercent: number;
    lastHeartbeatSecondsAgo: number;
  }>;

  /** Active storm zones for map overlay */
  zones: Array<{
    id: string;
    name: string;
    score: number;
    centroidLat: number;
    centroidLng: number;
    radiusMiles: number;
    houseCount: number;
    unworkedCount: number;
  }>;

  /** Highest-score active zone */
  priorityZone: {
    name: string;
    score: number;
    houseCount: number;
    unworkedCount: number;
  } | null;

  /** Nearest unworked cluster */
  hotCluster: {
    name: string;
    houseCount: number;
    distanceFromNearestRepMiles: number;
  } | null;

  /** Top rep today */
  topRep: {
    name: string;
    doorsKnocked: number;
    appointmentsSet: number;
    conversionRate: number;
  } | null;

  /** AI-generated one-liner insights (batch of 5-10) */
  insights: string[];

  /** Recent events for bottom ticker (last 50) */
  recentEvents: Array<{
    id: string;
    icon: string;
    text: string;
    timestamp: string;
  }>;

  /** Active storm alerts */
  stormAlerts: Array<{
    id: string;
    zoneName: string;
    eventCount: number;
    maxHailSizeInches: number | null;
    houseCount: number;
    detectedAt: string;
  }>;

  /** Active ops exceptions */
  exceptions: Array<{
    id: string;
    type: string;
    severity: "critical" | "warning" | "info";
    title: string;
    description: string;
  }>;
}
```

**Polling strategy:**
- Primary poll: `GET /api/mission-control/live` every 30 seconds.
- Map-only poll: `GET /api/team/live` every 15 seconds (for smoother rep dot movement — only updates map markers, not other widgets).
- Both polls use `AbortController` with 10-second timeout. On failure, retry after 5 seconds (max 3 retries before falling into stale mode).

---

## 5. Animation & Transition Behavior

### 5.1 Number Transitions (KPI Tower)

When a KPI value changes:
1. Old value: `animate-fade-out-up` (translateY -8px, opacity 0→0 over 300ms)
2. New value: `animate-count-up` (translateY 4px→0, opacity 0→1 over 600ms)
3. Brief glow flash on the number container: `shadow-glow-sm` for 1 second, then fade

### 5.2 Panel Rotation (Rotating Panel)

Panel A → B → C cycle:
1. Current panel: opacity 1→0 over 400ms
2. 100ms gap (panel area shows `storm-z2` background)
3. Next panel: opacity 0→1 + translateY 8px→0 over 400ms

### 5.3 Map Marker Movement

Rep dots use Mapbox's `easeTo` for position updates:
- Duration: 2 seconds
- Easing: `ease-in-out`
- This creates smooth "gliding" movement instead of jumping between positions

### 5.4 Storm Alert Flash

When a new storm alert fires:
1. Alert panel background: `bg-red-500/0` → `bg-red-500/30` (200ms) → `bg-red-500/10` (800ms settle)
2. Lightning icon: `animate-glow` (2s infinite alternate, existing keyframe)
3. Map: red ring pulse at zone location (CSS animation on a marker overlay, 2 cycles)
4. KPI Tower: no change (numbers update on their own cadence)

### 5.5 Ticker Scroll

- CSS `@keyframes ticker-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }`
- Content is duplicated (original + clone) to create seamless loop
- Duration: calculated based on content width. Target: ~60px/second
- `animation-timing-function: linear`
- `animation-iteration-count: infinite`

### 5.6 Stale Mode Transitions

When entering stale mode:
- All widget containers: `transition-opacity duration-1000` → `opacity-50`
- "DELAYED" / "OFFLINE" badges: `animate-fade-in` (300ms)
- When data returns: `opacity-100` transition (1 second), badges fade out

---

## 6. Stale Data Behavior

| Threshold | Visual Change | Widget Behavior |
|---|---|---|
| >30s since last poll | — | Normal. Expected between polls. |
| >60s since last poll | "LIVE" → "DELAYED" (amber) on map | KPI numbers still visible |
| >3min since last poll | "DELAYED" → "OFFLINE" (red) on map. All widgets dim to 50% opacity. | Show last known data. No spinners. |
| >10min since last poll | Full stale overlay: centered message "Connection lost — reconnecting…" with subtle pulse animation | Retry every 30 seconds in background |
| >30min since last poll | Display "Mission Control offline. Check network connection." static message. Stop retrying. | Requires page reload or `Escape` → re-enter TV mode to restart. |

**Recovery:** When a successful poll returns after being in stale mode:
1. Remove stale overlay immediately
2. Update all widget data
3. Flash all KPI numbers with `animate-count-up`
4. Restore "LIVE" badge
5. Resume normal poll cadence

---

## 7. Color Treatment

### 7.1 Default Palette (follows existing storm-* tokens)

| Element | Color Token | Hex |
|---|---|---|
| Background | `storm-bg` | `#0B0F1A` |
| Widget background | `storm-z2` | `#1A1F2E` |
| Widget border | `storm-border` | `#1F2937` |
| Primary text | `storm-text` | `#F9FAFB` |
| Secondary text | `storm-muted` | `#94A3B8` |
| Accent (brand) | `storm-purple` | `#6D5CFF` |
| Accent glow | `storm-glow` | `#A78BFA` |

### 7.2 Alert Colors

| Severity | Background Flash | Text Color | Border Glow |
|---|---|---|---|
| Critical (new storm, heartbeat lost) | `bg-red-500/30` pulse → `bg-red-500/10` settle | `text-red-400` | `shadow-[0_0_20px_rgba(239,68,68,0.3)]` |
| Warning (idle rep, off-route, battery) | `bg-yellow-500/20` | `text-yellow-400` | `shadow-[0_0_15px_rgba(245,158,11,0.2)]` |
| Info (mission complete, cluster nearby) | `bg-blue-500/15` | `text-blue-400` | none |
| Success (export complete, mission done) | `bg-green-500/15` | `text-green-400` | none |

### 7.3 Map Colors

| Element | Color | Notes |
|---|---|---|
| Storm zone fill | `rgba(109, 92, 255, 0.15)` | storm-purple at 15% |
| Storm zone stroke | `rgba(109, 92, 255, 0.5)` | storm-purple at 50% |
| Active rep dot | `#10B981` (green) | 12px diameter, pulse animation |
| Driving rep dot | `#3B82F6` (blue) | 10px diameter, directional arrow |
| Idle rep dot | `#F59E0B` (yellow) | 10px diameter, no pulse |
| Offline rep dot | `#64748B` (gray) | 8px diameter, no animation |
| Storm alert ring | `#EF4444` (red) | Expanding ring animation on detection |

---

## 8. Sound

**Sound: No.**

Rationale:
1. Browser tabs default to muted. Requiring a user to unmute defeats the "zero-interaction" requirement.
2. In an office environment, notification sounds from a TV become noise pollution.
3. Visual alerts (color flash, animation, badge changes) are sufficient for the 15-foot viewing distance.
4. If audio is ever added as a future enhancement, it should be an opt-in setting (`settings.missionControl.audioAlerts`) gated behind a user preference, not a default.

---

## 9. Implementation Map

### 9.1 Files to Create

| File | Purpose |
|---|---|
| `src/types/mission-control.ts` | `MissionControlLiveData` interface |
| `src/app/api/mission-control/live/route.ts` | Aggregated data endpoint |
| `src/app/(dashboard)/dashboard/mission-control/page.tsx` | Server component (auth + TV mode detection) |
| `src/app/(dashboard)/dashboard/mission-control/mission-control-hub.tsx` | Client component (all widgets, polling, animation) |
| `src/components/mission-control/HeroMap.tsx` | Mapbox GL map with rep dots + zone overlays |
| `src/components/mission-control/KpiTower.tsx` | 5-metric vertical stack |
| `src/components/mission-control/RotatingPanel.tsx` | 3-panel auto-rotate (PriorityZone / HotCluster / AiInsight) |
| `src/components/mission-control/TopRep.tsx` | Leading rep card |
| `src/components/mission-control/StormAlert.tsx` | Alert flash + fallback insight |
| `src/components/mission-control/BottomTicker.tsx` | Scrolling event crawl |
| `src/components/mission-control/StaleOverlay.tsx` | Stale/offline state overlay |
| `tests/mission-control-live-api.test.ts` | API response shape test |

### 9.2 TV Mode Shell

The Mission Control page needs to support two modes:

**Standard mode** (no `?tv=true`): Renders within the normal `(dashboard)` layout with sidebar + top nav. All widgets are present but sized for a desktop monitor. PageHeader shows "Launch TV Mode" button.

**TV mode** (`?tv=true`): Full viewport. No sidebar, no top nav, no KPI strip. The `mission-control-hub.tsx` component detects the query param and renders the fullscreen grid directly. `Escape` key listener shows a floating "Exit TV Mode" button for 3 seconds.

### 9.3 Commit

```
feat(mission-control): fullscreen TV mode with live data
```

---

## 10. Widget Data Source Mapping

| Widget | Primary Data | Fallback When Empty |
|---|---|---|
| Hero Live Map | `GET /api/team/live` (reps) + `GET /api/mission-control/live` (zones) | Empty map centered on company office location. "No active field operations" overlay text. |
| KPI Tower | `GET /api/mission-control/live` → `kpi` | All zeros. No special empty state — zeros are valid. |
| Rotating Panel: Priority Zone | `GET /api/mission-control/live` → `priorityZone` | "No active storm zones" in `text-storm-subtle` |
| Rotating Panel: Hot Cluster | `GET /api/mission-control/live` → `hotCluster` | "All clusters covered" in `text-green-400` (positive message) |
| Rotating Panel: AI Insight | `GET /api/mission-control/live` → `insights[]` | "Generating insights…" with shimmer animation |
| Top Rep | `GET /api/team/leaderboard` → first entry | "No field activity today" |
| Storm Alert | `GET /api/mission-control/live` → `stormAlerts[]` | Falls back to AI insight display (default state) |
| Bottom Ticker | `GET /api/mission-control/live` → `recentEvents[]` | Static: "Waiting for field activity…" centered text |
