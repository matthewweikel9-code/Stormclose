# Stormclose V2 — Storms Module Specification

> Canonical reference for every widget, data model, and interaction on the Storms screen.
> Derives from: `PRODUCT_CONTRACT_V2.md` §5 (Storms), `stormclose-enterprise-architecture.md` §5 (Screen Architecture), `stormclose-navigation-design.md` §2–§3 (Sidebar & Roles).
> Builds on: `stormclose-dashboard-widgets.md` (Dashboard spec — Phase 2 output), existing `storm_events_cache`, `territories`, `storm_alerts`, `hail_events` tables, and the `xweather.ts` / `corelogic.ts` client libraries.
> Last updated: 2026-03-14

---

## 1. Storms Screen Overview

**Purpose:** Turn raw storm data into ranked, actionable opportunity zones. This is a storm *intelligence center*, not just a map.

**Route:** `/dashboard/storms`

**Sidebar:** Second item, `CloudLightning` icon, badge shows `activeStormCount` (integer count + dot when > 0).

**Role visibility:**

| Role | Access |
|---|---|
| Owner | ✅ Full — all zones, cross-branch, all actions |
| Manager | ✅ Full — own branch territory |
| Rep | ❌ Hidden — sidebar item not rendered |
| Office Admin | ❌ Hidden — sidebar item not rendered |

**Primary action (PageHeader):** "Save Watchlist" → opens watchlist creation flow.

---

## 2. KPI Strip

The Storms page renders its own contextual KPI strip (not the Dashboard KPI strip).

**API:** `GET /api/storm-zones?summary=true`

| Position | Label | Source Field | Format |
|---|---|---|---|
| 1 (primary) | Active Zones | `activeZoneCount` | Integer, `text-storm-purple` |
| 2 | Unworked Houses | `totalUnworkedHouseCount` | Integer |
| 3 | Active Alerts | `activeAlertCount` | Integer, red dot when > 0 |
| 4 | Zones Created (7d) | `newZonesLast7Days` | Integer |
| 5 | Avg Zone Score | `avgZoneScore` | Integer (0–100) |

```typescript
// src/types/storms.ts

export interface StormsKpiStrip {
  activeZoneCount: number;
  totalUnworkedHouseCount: number;
  activeAlertCount: number;
  newZonesLast7Days: number;
  avgZoneScore: number;
}
```

---

## 3. Grid Layout

```
Desktop (xl, ≥1280px) — 3 columns
┌──────────────────────────────────────────────────────────────────┐
│ Live Storm Map                                    (col-span-2)  │
│ (min-h-[480px])                                                  │
├─────────────────────────────────────┬────────────────────────────┤
│                                     │ Recent Storm Timeline      │
│                                     │ (col-span-1)               │
├─────────────────────────────────────┤                            │
│ Storm Opportunity Zones             │                            │
│ (col-span-1, row-span-2)           │                            │
│                                     ├────────────────────────────┤
│                                     │ Territory Watchlist Alerts  │
│                                     │ (col-span-1)               │
├─────────────────────────────────────┼────────────────────────────┤
│ Unworked Opportunity Clusters       │ AI Recommendation Panel    │
│ (col-span-1)                        │ (col-span-1)               │
└─────────────────────────────────────┴────────────────────────────┘

Tablet (md, 768–1279px) — 2 columns
- Live Storm Map: col-span-2
- Storm Opportunity Zones: col-span-2
- Recent Storm Timeline: col-span-1
- Territory Watchlist Alerts: col-span-1
- Unworked Opportunity Clusters: col-span-1
- AI Recommendation Panel: col-span-1

Mobile (<768px)
- Reps and Office Admins cannot access Storms, so mobile is Manager/Owner only.
- Live Storm Map: col-span-1 (reduced height, 320px)
- Storm Opportunity Zones: col-span-1 (dominant)
- Recent Storm Timeline: col-span-1
- Territory Watchlist Alerts: hidden
- Unworked Opportunity Clusters: hidden
- AI Recommendation Panel: hidden
```

---

## 4. Storm Zone Object Model

### 4.1 `storm_zones` Entity Definition

A storm zone is a scored geographic region where one or more storm events create roofing sales opportunity. Zones are the fundamental unit of storm intelligence — they bridge raw weather data and actionable field deployment.

```typescript
// src/types/storms.ts

export type ZoneStatus = "active" | "cooling" | "saturated" | "expired";

export interface StormZone {
  /** UUID primary key. */
  id: string;
  /** Display name, auto-generated from location + event type (e.g., "North Dallas Hail Corridor"). */
  name: string;
  /** Composite zone opportunity score (0–100). */
  score: number;
  /** Zone severity derived from max storm event severity within. */
  severity: StormSeverity;
  /** Zone lifecycle status. */
  status: ZoneStatus;

  // ─── Geography ───────────────────────────────────────────────────────
  /** Centroid latitude. */
  centroidLat: number;
  /** Centroid longitude. */
  centroidLng: number;
  /** Zone boundary as GeoJSON Polygon for map rendering. */
  geometry: GeoJSON.Polygon | null;
  /** Approximate radius in miles (used when geometry is not available). */
  radiusMiles: number;
  /** Primary city/location name. */
  locationName: string;
  /** County. */
  county: string | null;
  /** State abbreviation. */
  state: string;

  // ─── Storm event aggregates ──────────────────────────────────────────
  /** Number of contributing storm events. */
  eventCount: number;
  /** Most recent storm event timestamp (ISO 8601). */
  latestEventAt: string;
  /** Oldest storm event timestamp in this zone. */
  earliestEventAt: string;
  /** Days since most recent storm event. */
  stormAgeDays: number;
  /** Maximum hail size observed across all events (inches). */
  maxHailSizeInches: number | null;
  /** Maximum wind speed observed across all events (mph). */
  maxWindSpeedMph: number | null;
  /** Dominant event type in this zone. */
  dominantEventType: "hail" | "wind" | "tornado" | "severe_thunderstorm";

  // ─── House/target metrics ────────────────────────────────────────────
  /** Total impacted houses (from CoreLogic parcel scan or estimate). */
  totalHouseCount: number;
  /** Houses not yet assigned to any mission. */
  unworkedHouseCount: number;
  /** Houses currently in active missions. */
  inProgressHouseCount: number;
  /** Houses with outcomes recorded. */
  completedHouseCount: number;
  /** Average opportunity score of houses in this zone. */
  avgHouseScore: number;

  // ─── Mission metrics ─────────────────────────────────────────────────
  /** Active missions operating in this zone. */
  activeMissionCount: number;
  /** Completed missions that operated in this zone. */
  completedMissionCount: number;

  // ─── Revenue estimates ───────────────────────────────────────────────
  /** Estimated total addressable opportunity (sum of house value bands). */
  estimatedOpportunity: number;
  /** Revenue captured so far from qualified opportunities in this zone. */
  revenueCaptured: number;

  // ─── Ownership ───────────────────────────────────────────────────────
  /** Branch ID that owns this zone (for multi-branch filtering). */
  branchId: string | null;
  /** User who created or first detected this zone. */
  createdByUserId: string;

  // ─── Timestamps ──────────────────────────────────────────────────────
  createdAt: string;
  updatedAt: string;
}
```

### 4.2 Database Table

```sql
-- Future migration: 20260315_storm_zones.sql

CREATE TABLE IF NOT EXISTS storm_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    score INTEGER DEFAULT 0 CHECK (score >= 0 AND score <= 100),
    severity TEXT DEFAULT 'minor' CHECK (severity IN ('extreme', 'severe', 'moderate', 'minor')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'cooling', 'saturated', 'expired')),

    -- Geography
    centroid_lat DOUBLE PRECISION NOT NULL,
    centroid_lng DOUBLE PRECISION NOT NULL,
    geometry GEOMETRY(POLYGON, 4326),
    radius_miles DECIMAL(6, 2) DEFAULT 5.0,
    location_name TEXT NOT NULL,
    county TEXT,
    state TEXT NOT NULL,

    -- Storm event aggregates (denormalized for read speed)
    event_count INTEGER DEFAULT 0,
    latest_event_at TIMESTAMPTZ,
    earliest_event_at TIMESTAMPTZ,
    max_hail_size_inches DECIMAL(4, 2),
    max_wind_speed_mph INTEGER,
    dominant_event_type TEXT DEFAULT 'hail',

    -- House/target metrics (denormalized, refreshed by worker)
    total_house_count INTEGER DEFAULT 0,
    unworked_house_count INTEGER DEFAULT 0,
    in_progress_house_count INTEGER DEFAULT 0,
    completed_house_count INTEGER DEFAULT 0,
    avg_house_score INTEGER DEFAULT 0,

    -- Mission metrics
    active_mission_count INTEGER DEFAULT 0,
    completed_mission_count INTEGER DEFAULT 0,

    -- Revenue
    estimated_opportunity DECIMAL(14, 2) DEFAULT 0,
    revenue_captured DECIMAL(14, 2) DEFAULT 0,

    -- Ownership
    branch_id UUID,
    created_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS storm_zones_status_idx ON storm_zones(status);
CREATE INDEX IF NOT EXISTS storm_zones_score_idx ON storm_zones(score DESC);
CREATE INDEX IF NOT EXISTS storm_zones_location_idx ON storm_zones USING GIST (
    ST_SetSRID(ST_MakePoint(centroid_lng, centroid_lat), 4326)
);
CREATE INDEX IF NOT EXISTS storm_zones_geometry_idx ON storm_zones USING GIST (geometry);
CREATE INDEX IF NOT EXISTS storm_zones_branch_idx ON storm_zones(branch_id);
CREATE INDEX IF NOT EXISTS storm_zones_created_at_idx ON storm_zones(created_at DESC);
```

### 4.3 Zone-to-Event Junction Table

```sql
CREATE TABLE IF NOT EXISTS storm_zone_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    storm_zone_id UUID NOT NULL REFERENCES storm_zones(id) ON DELETE CASCADE,
    storm_event_id UUID NOT NULL REFERENCES storm_events_cache(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(storm_zone_id, storm_event_id)
);

CREATE INDEX IF NOT EXISTS storm_zone_events_zone_idx ON storm_zone_events(storm_zone_id);
CREATE INDEX IF NOT EXISTS storm_zone_events_event_idx ON storm_zone_events(storm_event_id);
```

### 4.4 How Zones Are Created from Raw Storm Events

**Pipeline:** `Xweather ingest → storm_events_cache → clustering → storm_zones`

1. **Ingest.** The cron job `GET /api/cron/xweather-hail` fetches recent storm reports from Xweather and upserts them into `storm_events_cache`.

2. **Spatial clustering.** A post-ingest worker groups events into zones using a density-based approach:
   - **Algorithm:** Grid-based clustering with 5-mile cells. Events within the same cell or adjacent cells (queen contiguity) are merged into a single zone.
   - **Minimum cluster size:** 2 events or 1 event with hail ≥ 1.5" (significant enough to stand alone).
   - **Merge rule:** If a new event falls within an existing active zone's geometry (or within `radius_miles`), it is added to that zone rather than creating a new one.
   - **Zone name generation:** `"{cardinal_direction} {city} {dominant_event_type} {descriptor}"` — e.g., "North Dallas Hail Corridor", "SW Fort Worth Wind Zone". Descriptor is chosen from: "Corridor" (elongated shape), "Cluster" (compact), "Zone" (default).

3. **Boundary computation.** The zone geometry is the convex hull of all contributing event points, buffered by 0.5 miles. If only one event, the geometry is a circular polygon approximation using `radius_miles`.

4. **Aggregate refresh.** After zone creation or event addition, the worker:
   - Recalculates `event_count`, `latest_event_at`, `earliest_event_at`, `max_hail_size_inches`, `max_wind_speed_mph`
   - Queries `targets` table for house counts within the zone geometry
   - Queries `missions` for active/completed counts
   - Recalculates `score` using the Zone Scoring Algorithm (§4.5)

5. **Status transitions.**

| From | To | Trigger |
|---|---|---|
| — | `active` | Zone created with ≥ 1 recent event (< 14 days) |
| `active` | `cooling` | Most recent event > 14 days old AND unworked houses remain |
| `active` | `saturated` | `unworked_house_count = 0` (all houses in missions or completed) |
| `cooling` | `expired` | Most recent event > 45 days old OR all houses completed |
| `saturated` | `expired` | Most recent event > 45 days old |
| any | `active` | New storm event added to zone (re-activates) |

### 4.5 Zone Opportunity Scoring Algorithm

The zone score combines storm intensity, recency, target density, and work coverage into a single 0–100 composite.

```typescript
// src/lib/storms/zoneScoring.ts

export interface ZoneScoreInputs {
  /** Max hail size in inches across all events in zone. */
  maxHailSizeInches: number;
  /** Max wind speed in mph across all events in zone. */
  maxWindSpeedMph: number;
  /** Days since most recent event. */
  stormAgeDays: number;
  /** Total impacted houses in zone. */
  totalHouseCount: number;
  /** Houses not yet assigned or worked. */
  unworkedHouseCount: number;
  /** Average opportunity score of houses (from target_scores). */
  avgHouseScore: number;
  /** Number of distinct storm events in this zone. */
  eventCount: number;
}

export interface ZoneScoreWeights {
  stormIntensity: number;   // 0.30 — how severe was the storm
  recency: number;          // 0.25 — how recent (freshness decay)
  targetDensity: number;    // 0.20 — how many houses are impacted
  unworkedRatio: number;    // 0.15 — what % of houses are still available
  avgHouseQuality: number;  // 0.10 — quality of individual targets
}

export const ZONE_SCORE_WEIGHTS: ZoneScoreWeights = {
  stormIntensity: 0.30,
  recency: 0.25,
  targetDensity: 0.20,
  unworkedRatio: 0.15,
  avgHouseQuality: 0.10,
};
```

**Factor calculations:**

| Factor | Normalization | Weight |
|---|---|---|
| **Storm intensity** | `min(1, (hailInches / 2.5) * 0.7 + (windMph / 120) * 0.3)` — hail-dominant since hail drives roofing claims | 0.30 |
| **Recency** | `max(0, 1 - (stormAgeDays / 45))` — linear decay over 45 days, zone expires after 45d | 0.25 |
| **Target density** | `min(1, totalHouseCount / 500)` — saturates at 500 houses (a large suburban zone) | 0.20 |
| **Unworked ratio** | `unworkedHouseCount / max(1, totalHouseCount)` — 1.0 = fully untouched, 0.0 = fully saturated | 0.15 |
| **Avg house quality** | `avgHouseScore / 100` — normalizes the average per-house opportunity score | 0.10 |

**Formula:** `score = round((intensity * 0.30 + recency * 0.25 + density * 0.20 + unworked * 0.15 + quality * 0.10) * 100)`

**Severity derivation from score:**

| Score | Severity |
|---|---|
| ≥ 80 | `extreme` |
| ≥ 60 | `severe` |
| ≥ 40 | `moderate` |
| < 40 | `minor` |

**Relationship to Dashboard's Top Storm Zones widget:** The Dashboard widget `GET /api/storm-zones?sort=score&order=desc&limit=5&status=active` returns the top 5 active zones by score. The Storms screen shows the complete ranked list with the same scoring, plus additional detail views.

**Relationship to individual house scoring:** Zone scoring (§4.5) ranks *regions*. House scoring (via `calculateThreatScore` in `threatScore.ts` with `threatWeights.json`) ranks *individual properties* within a zone. They share some inputs (hail size, wind speed, storm age) but the zone score also considers density, coverage, and event count. A zone with moderate storms but 400 unworked houses can outscore a zone with extreme storms but only 10 remaining houses.

---

## 5. Widget Specifications

### Widget Template Key

Each widget follows this structure:
1. **Data Contract** — TypeScript interface, fields, API endpoint
2. **Data Source** — Tables, services, joins
3. **Interaction Model** — Click, expand, drill-down behaviors
4. **Role Differences** — Visibility and content per role
5. **Layout** — Grid position, responsive
6. **Empty State** — What renders when no data
7. **Refresh Behavior** — Polling interval or event-driven

---

## Widget 1: Live Storm Map

### 1.1 Data Contract

**API:** Multiple concurrent fetches:
- `GET /api/storm-zones?status=active,cooling` → zone boundaries for map polygons
- `GET /api/storms?live=true&lat=X&lng=Y&radius=R` → active storm cells and alerts (real-time Xweather)
- `GET /api/houses/today?limit=200` → house markers within visible zones (paginated by map viewport)

```typescript
// src/types/storms.ts

export interface StormMapData {
  /** Active/cooling storm zones with geometry for polygon rendering. */
  zones: StormZoneMapItem[];
  /** Live storm cells from Xweather (active radar-detected storms). */
  liveCells: LiveStormCell[];
  /** Active severe weather alerts. */
  alerts: StormMapAlert[];
  /** House markers within visible zones. */
  houseMarkers: HouseMapMarker[];
  /** Active rep positions (for managers viewing team coverage). */
  repPositions: RepMapPosition[];
}

export interface StormZoneMapItem {
  id: string;
  name: string;
  score: number;
  severity: StormSeverity;
  status: ZoneStatus;
  geometry: GeoJSON.Polygon | null;
  centroidLat: number;
  centroidLng: number;
  radiusMiles: number;
  houseCount: number;
  unworkedHouseCount: number;
  activeMissionCount: number;
}

export interface LiveStormCell {
  id: string;
  lat: number;
  lng: number;
  type: "hail" | "wind" | "tornado" | "severe_thunderstorm";
  severity: StormSeverity;
  hailSizeInches: number | null;
  windSpeedMph: number | null;
  isRotating: boolean;
  isTornadic: boolean;
  trackPoints: Array<{ lat: number; lng: number }>;
  observedAt: string;
}

export interface StormMapAlert {
  id: string;
  type: string;
  headline: string;
  severity: StormSeverity;
  polygon: GeoJSON.Polygon | null;
  expiresAt: string;
  isEmergency: boolean;
}

export interface HouseMapMarker {
  id: string;
  lat: number;
  lng: number;
  score: number;
  scoreTier: ScoreTier;
  status: HouseStatus;
  stormZoneId: string;
}

export interface RepMapPosition {
  id: string;
  name: string;
  lat: number;
  lng: number;
  fieldStatus: "active" | "idle" | "offline" | "paused";
  activeMissionId: string | null;
}
```

### 1.2 Data Source

| Data | Source Table/Service | Notes |
|---|---|---|
| Zone polygons | `storm_zones.geometry` | Served as GeoJSON |
| Live cells | `xweather.getStormCells()` | Real-time, not cached |
| Alerts | `xweather.getActiveAlerts()` + `storm_alerts` table | Merged: Xweather live + DB cached |
| House markers | `targets` + `target_scores` | Filtered to visible viewport bounds |
| Rep positions | `rep_presence` | Active reps only |

### 1.3 Interaction Model

| Interaction | Behavior |
|---|---|
| **Zone polygon click** | Opens Storm Detail Drawer (§Widget 5) for that zone |
| **Zone polygon hover** | Shows tooltip: zone name, score badge, house count, severity |
| **House marker click** | Opens House Detail Drawer (shared with Dashboard) |
| **House marker cluster click** | Zooms map to cluster bounds |
| **Live cell click** | Shows cell popover: type, hail size, wind speed, track direction |
| **Alert polygon click** | Shows alert popover: headline, expires at, affected areas |
| **Rep position click** | Opens Rep Detail Drawer (shared with Team screen) |
| **Map viewport change** | Refetches house markers for visible bounds (debounced 500ms) |
| **Zoom level behavior** | < zoom 10: show only zone polygons. ≥ 10: show individual house markers. ≥ 12: show house labels. |

**Map configuration:**
- **Provider:** Mapbox GL JS
- **Style:** Dark (consistent with all Stormclose maps)
- **Default center:** Company office location from `company_ai_profiles` or user's last-known position
- **Default zoom:** 9 (city-level, shows zone polygons)
- **Layers (bottom to top):** Alert polygons (red translucent) → Zone polygons (color-coded by severity) → House markers (color-coded by score tier) → Live storm cells (animated pulse) → Rep positions (green dots)

**Zone polygon colors:**

| Severity | Fill | Stroke |
|---|---|---|
| extreme | `rgba(239, 68, 68, 0.20)` (red-500/20) | `#ef4444` (red-500) |
| severe | `rgba(245, 158, 11, 0.20)` (amber-500/20) | `#f59e0b` (amber-500) |
| moderate | `rgba(59, 130, 246, 0.20)` (blue-500/20) | `#3b82f6` (blue-500) |
| minor | `rgba(100, 116, 139, 0.20)` (slate-500/20) | `#64748b` (slate-500) |

**House marker colors (dot style):**

| Score Tier | Color |
|---|---|
| hot (≥80) | `#ef4444` (red) |
| warm (60–79) | `#f59e0b` (amber) |
| moderate (40–59) | `#3b82f6` (blue) |
| cold (<40) | `#64748b` (slate) |

### 1.4 Role Differences

| Role | Behavior |
|---|---|
| Owner | All zones across all branches. Rep positions from all branches. |
| Manager | Own branch zones only. Own branch rep positions. |
| Rep | ❌ Screen hidden |
| Office Admin | ❌ Screen hidden |

### 1.5 Layout

- **Grid:** `col-span-2` on desktop, `col-span-2` on tablet, `col-span-1` on mobile
- **Min height:** `min-h-[480px]` desktop, `min-h-[320px]` mobile
- **Position:** Row 1, dominant widget
- **Card style:** `bg-storm-z2 border border-storm-border rounded-2xl p-0` — map fills entire card with rounded corners via `overflow-hidden`
- **Controls (top-right overlay):**
  - Layer toggle: Zones / Houses / Cells / Alerts / Reps (checkboxes)
  - Time filter: "Last 24h" | "7 days" | "30 days" | "All active"
  - Fullscreen toggle

### 1.6 Empty State

- **When:** No active zones and no live weather data
- **Icon:** `CloudLightning` (h-12 w-12, centered on map area, `text-storm-subtle/50`)
- **Heading:** "No active storm data"
- **Body:** "Storm zones will appear here when weather events are detected in your territory."
- **Action:** Button — "Check Xweather" → triggers a manual ingest fetch

### 1.7 Refresh Behavior

- **Zone polygons:** Every **5 minutes** (zones change slowly)
- **Live cells + alerts:** Every **60 seconds** (weather is live)
- **House markers:** On viewport change (debounced), cached for 5 min per viewport tile
- **Rep positions:** Every **15 seconds** (matches team snapshot)

---

## Widget 2: Recent Storm Timeline

### 2.1 Data Contract

**API:** `GET /api/storms/timeline?lat=X&lng=Y&days=30&radius=50`

**Response envelope:** `{ data: StormTimelineEntry[], error: string | null, meta: { total: number, daysRange: number } }`

```typescript
// src/types/storms.ts

export interface StormTimelineEntry {
  /** storm_events_cache UUID. */
  id: string;
  /** Event type. */
  eventType: "hail" | "wind" | "tornado" | "severe_thunderstorm" | "flood";
  /** Severity label. */
  severity: StormSeverity;
  /** Hail size in inches (null if not hail). */
  hailSizeInches: number | null;
  /** Wind speed in mph (null if not wind). */
  windSpeedMph: number | null;
  /** Damage score (0–100). */
  damageScore: number;
  /** Location name. */
  locationName: string;
  /** County. */
  county: string | null;
  /** State abbreviation. */
  state: string;
  /** Latitude. */
  lat: number;
  /** Longitude. */
  lng: number;
  /** When the event occurred. */
  eventOccurredAt: string;
  /** Days ago from today. */
  daysAgo: number;
  /** Estimated affected properties. */
  estimatedProperties: number;
  /** Estimated total opportunity ($). */
  estimatedOpportunity: number;
  /** Properties canvassed so far. */
  propertiesCanvassed: number;
  /** Canvass completion percentage. */
  canvassPct: number;
  /** Number of missions created from this event. */
  missionCount: number;
  /** Storm zone ID if this event belongs to a zone. */
  stormZoneId: string | null;
  /** Storm zone name. */
  stormZoneName: string | null;
}
```

### 2.2 Data Source

| Data | Source | Notes |
|---|---|---|
| Events | `storm_events_cache` via `get_storm_timeline()` RPC | Existing function, needs zone join |
| Zone association | `storm_zone_events` junction table | New — links events to zones |
| Canvass stats | `storm_events_cache` denormalized fields | `properties_canvassed`, `leads_generated`, etc. |
| Fresh events | `xweather.getHailReports()` + `xweather.getStormReports()` | Merged with cached events, deduped by `xweather_id` |

### 2.3 Interaction Model

| Interaction | Behavior |
|---|---|
| **Event row click** | If event belongs to a zone → opens Storm Detail Drawer for that zone. If no zone → pans map to event location. |
| **Event row hover** | Highlights corresponding marker/polygon on the Live Storm Map (cross-widget communication via shared state). |
| **"Generate Zone" button** (on unzoned events) | `POST /api/storm-zones` `{ eventIds: [id] }` — creates a new zone from this event |
| **Severity badge click** | Filters timeline to that severity level |
| **Time range selector** | "7 days" / "14 days" / "30 days" / "90 days" — adjusts `days` query param |

### 2.4 Role Differences

| Role | Behavior |
|---|---|
| Owner | All events across all branches/territories |
| Manager | Events within own branch territory |
| Rep | ❌ Screen hidden |
| Office Admin | ❌ Screen hidden |

### 2.5 Layout

- **Grid:** `col-span-1` on desktop, `col-span-1` on tablet, `col-span-1` on mobile
- **Position:** Row 2, right column
- **Max visible rows:** 10 (scrollable within card)
- **Card style:** Standard `bg-storm-z2 border border-storm-border rounded-2xl p-5`
- **Row style:** Compact timeline layout with severity dot (colored), event type icon, location text, time-ago text, and canvass progress bar

### 2.6 Empty State

- **Icon:** `Clock` (h-12 w-12, `text-storm-subtle/50`)
- **Heading:** "No recent storm events"
- **Body:** "Storm events will appear here as they are detected by Xweather and NWS."
- **Action:** None

### 2.7 Refresh Behavior

- **Auto-refresh:** Every **5 minutes**
- **On new zone creation:** Immediately re-fetches to show zone association

---

## Widget 3: Storm Opportunity Zones (Ranked List)

### 3.1 Data Contract

**API:** `GET /api/storm-zones?sort=score&order=desc&status=active,cooling&limit=20`

**Response envelope:** `{ data: StormZoneListItem[], error: string | null, meta: { total: number } }`

```typescript
// src/types/storms.ts

export interface StormZoneListItem {
  /** UUID. */
  id: string;
  /** Display name. */
  name: string;
  /** Composite zone score (0–100). */
  score: number;
  /** Severity. */
  severity: StormSeverity;
  /** Status. */
  status: ZoneStatus;
  /** Location label (city, state). */
  locationLabel: string;
  /** Days since most recent event. */
  stormAgeDays: number;
  /** Max hail size across events. */
  maxHailSizeInches: number | null;
  /** Total houses. */
  totalHouseCount: number;
  /** Unworked houses. */
  unworkedHouseCount: number;
  /** Active missions in zone. */
  activeMissionCount: number;
  /** Estimated opportunity ($). */
  estimatedOpportunity: number;
  /** Centroid for map pan. */
  centroidLat: number;
  centroidLng: number;
  /** Dominant event type. */
  dominantEventType: "hail" | "wind" | "tornado" | "severe_thunderstorm";
}
```

### 3.2 Data Source

| Data | Source | Notes |
|---|---|---|
| Zones | `storm_zones` table | Sorted by `score DESC`, filtered by `status` |
| House counts | Denormalized on `storm_zones` or computed from `targets WHERE storm_zone_id = :id` | Prefer denormalized for list performance |
| Missions | `canvass_missions WHERE storm_event_id IN (SELECT storm_event_id FROM storm_zone_events WHERE storm_zone_id = :id)` | Or denormalized `active_mission_count` on zone |

### 3.3 Interaction Model

| Interaction | Behavior |
|---|---|
| **Zone row click** | Opens Storm Detail Drawer (§Widget 5) |
| **Zone row hover** | Highlights zone polygon on Live Storm Map |
| **"Generate Mission" button** | `POST /api/storm-zones/:id/generate-mission` — creates a mission from top unworked houses in zone |
| **"View Houses" button** | Navigates to `/dashboard/storms?zone=:id` and pans map to zone, or opens Houses tab in Storm Detail Drawer |
| **Score badge click** | No action (visual only) |
| **Sort controls** | Sort by: Score (default), Unworked houses, Storm age, Estimated opportunity |
| **Filter controls** | Filter by: Status (active/cooling), Severity, Event type |

**Zone row layout:**
```
┌──────────────────────────────────────────────────┐
│ [Severity dot]  Zone Name                  [85]  │ ← score badge
│ Hail 2.1" · 3 days ago · Dallas, TX             │ ← subtitle
│ ████████████░░░░ 234/312 houses  ·  2 missions   │ ← progress bar + counts
│ [Generate Mission]  [View Houses]                │ ← actions (on hover)
└──────────────────────────────────────────────────┘
```

### 3.4 Role Differences

| Role | Behavior |
|---|---|
| Owner | All zones, all branches. "Generate Mission" available. |
| Manager | Own branch zones. "Generate Mission" available. |
| Rep | ❌ Screen hidden |
| Office Admin | ❌ Screen hidden |

### 3.5 Layout

- **Grid:** `col-span-1` on desktop, `col-span-2` on tablet, `col-span-1` on mobile
- **Position:** Row 2–3, left column (row-span-2)
- **Max visible rows:** 10 (scrollable, with "View all" at bottom showing total count)
- **Card style:** Standard card. Each zone is a compact card-within-card.

### 3.6 Empty State

- **Icon:** `CloudLightning` (h-12 w-12, `text-storm-subtle/50`)
- **Heading:** "No active storm zones"
- **Body:** "Storm zones will appear here when storm data is ingested and clustered into opportunity regions."
- **Action:** None

### 3.7 Refresh Behavior

- **Auto-refresh:** Every **5 minutes** (same as map zones)
- **On zone creation:** Immediately re-fetches

---

## Widget 4: Territory Watchlist Alerts

### 4.1 Data Contract

**API:** `GET /api/watchlists?include_alerts=true`

**Response envelope:** `{ data: WatchlistWithAlerts[], error: string | null, meta: { total: number } }`

```typescript
// src/types/storms.ts

export type WatchlistType = "zip_codes" | "polygon" | "radius";

export interface Watchlist {
  /** UUID from territories table. */
  id: string;
  /** User-defined name (e.g., "North Dallas Coverage Area"). */
  name: string;
  /** Territory definition type. */
  type: WatchlistType;
  /** Zip codes (for zip_codes type). */
  zipCodes: string[] | null;
  /** Center lat (for radius type). */
  centerLat: number | null;
  /** Center lng (for radius type). */
  centerLng: number | null;
  /** Radius in miles (for radius type). */
  radiusMiles: number | null;
  /** Polygon as GeoJSON (for polygon type). */
  polygon: GeoJSON.Polygon | null;
  /** Whether alerts are enabled. */
  alertEnabled: boolean;
  /** Active storms currently in this territory. */
  activeStormCount: number;
  /** Last storm detected timestamp. */
  lastStormAt: string | null;
  /** Total leads generated from this territory. */
  totalLeads: number;
  /** Is this watchlist currently active. */
  isActive: boolean;
  createdAt: string;
}

export interface WatchlistAlert {
  /** UUID. */
  id: string;
  /** Watchlist this alert belongs to. */
  watchlistId: string;
  /** Watchlist name. */
  watchlistName: string;
  /** Alert type. */
  alertType: "new_storm" | "storm_upgrade" | "zone_created" | "unworked_houses" | "competitor_activity";
  /** Alert severity / priority. */
  priority: "high" | "medium" | "low";
  /** Alert title. */
  title: string;
  /** Alert body. */
  body: string;
  /** Related storm zone ID (if applicable). */
  stormZoneId: string | null;
  /** Related storm event ID (if applicable). */
  stormEventId: string | null;
  /** Whether the user has seen/dismissed this alert. */
  isRead: boolean;
  /** ISO 8601 timestamp. */
  createdAt: string;
}

export interface WatchlistWithAlerts {
  watchlist: Watchlist;
  alerts: WatchlistAlert[];
}
```

### 4.2 Data Source

| Data | Source | Notes |
|---|---|---|
| Watchlists | `territories` table | Existing table from `20260311_storm_alerts_upgrade.sql` — renamed conceptually to "watchlists" in V2 UI |
| Alerts | `alert_notifications` + `storm_alerts` | Join to get alert details |
| Active storms | `storm_zones WHERE ST_Intersects(geometry, territory.polygon)` or zip overlap | Spatial join |

**Alert generation rules:**

| Alert Type | Trigger | Priority |
|---|---|---|
| `new_storm` | New `storm_events_cache` entry falls within watchlist territory | `high` if severity ≥ severe, `medium` otherwise |
| `storm_upgrade` | Existing zone severity increases (e.g., moderate → severe) | `high` |
| `zone_created` | New `storm_zones` entry overlaps watchlist territory | `medium` |
| `unworked_houses` | Zone in territory has > 50 unworked houses for > 3 days | `low` |

### 4.3 Interaction Model

| Interaction | Behavior |
|---|---|
| **Alert row click** | If has `stormZoneId` → opens Storm Detail Drawer. Otherwise highlights event on map. |
| **"Dismiss" button** | Marks alert as read (`PATCH /api/watchlists/alerts/:id` `{ isRead: true }`) |
| **"Create Watchlist" button** | Opens watchlist creation modal (§6) |
| **Watchlist name click** | Pans map to watchlist territory bounds |
| **"Edit" button** on watchlist | Opens watchlist edit modal |
| **"Delete" button** on watchlist | Confirmation modal → `DELETE /api/watchlists/:id` |

### 4.4 Role Differences

| Role | Behavior |
|---|---|
| Owner | All watchlists across all users/branches. Can create for any branch. |
| Manager | Own watchlists + team watchlists within branch. |
| Rep | ❌ Screen hidden |
| Office Admin | ❌ Screen hidden |

### 4.5 Layout

- **Grid:** `col-span-1` on desktop, `col-span-1` on tablet, hidden on mobile
- **Position:** Row 3, right column (below Recent Storm Timeline)
- **Card style:** Standard card. Watchlist headers are collapsible sections; alerts are compact rows within.
- **Max alerts per watchlist:** 5 (with "View all" link)
- **Alert row style:** Priority dot (red=high, amber=medium, grey=low), title, time-ago, dismiss "×" button

### 4.6 Empty State

- **Icon:** `Bell` (h-12 w-12, `text-storm-subtle/50`)
- **Heading:** "No watchlists configured"
- **Body:** "Create a territory watchlist to get alerted when storms hit your coverage areas."
- **Action:** Button — "Create Watchlist" → opens creation modal

### 4.7 Refresh Behavior

- **Auto-refresh:** Every **60 seconds** (alerts are time-sensitive)
- **On alert dismiss:** Optimistic UI update, then re-fetch

---

## Widget 5: Storm Detail Drawer

### 5.1 Data Contract

**API:** `GET /api/storm-zones/:id`

**Response envelope:** `{ data: StormZoneDetail, error: string | null, meta: {} }`

```typescript
// src/types/storms.ts

export interface StormZoneDetail extends StormZone {
  /** Contributing storm events. */
  events: StormTimelineEntry[];
  /** Top houses in this zone (by opportunity score). */
  topHouses: HouseToHit[];
  /** Active missions in this zone. */
  missions: ZoneMissionSummary[];
  /** AI-generated zone summary. */
  aiSummary: string | null;
  /** AI-suggested actions. */
  aiSuggestedActions: ZoneAISuggestion[];
}

export interface ZoneMissionSummary {
  id: string;
  name: string;
  status: "planned" | "active" | "paused" | "completed" | "expired";
  assignedRepName: string | null;
  totalStops: number;
  completedStops: number;
  startedAt: string | null;
}

export interface ZoneAISuggestion {
  type: "generate_mission" | "assign_rep" | "expand_zone" | "prioritize_houses";
  title: string;
  description: string;
  actionLabel: string;
  actionEndpoint: string;
  actionPayload: Record<string, unknown>;
}
```

### 5.2 Data Source

| Data | Source | Notes |
|---|---|---|
| Zone detail | `storm_zones` | Full row |
| Events | `storm_zone_events` → `storm_events_cache` | Joined list |
| Top houses | `targets` + `target_scores` WHERE `storm_zone_id = :id` | Sorted by score DESC, limit 20 |
| Missions | `canvass_missions` via `storm_zone_events` link | Status + rep info |
| AI summary | `POST /api/ai/storm-zone-summary` (cached in `ai_sessions`) | Generated on-demand, cached 24h |

### 5.3 Interaction Model

The drawer slides in from the right (480px wide on desktop, full-width on mobile). It has tabbed content:

| Tab | Content |
|---|---|
| **Overview** | Zone stats, severity badge, score breakdown, AI summary, suggested actions |
| **Houses** | Paginated table of houses in this zone (same as Houses To Hit Today, filtered to zone) |
| **Events** | Timeline of contributing storm events |
| **Missions** | List of missions created from this zone |

**Actions in drawer header:**

| Action | Label | API | Behavior |
|---|---|---|---|
| Generate Mission | "Generate Mission" | `POST /api/storm-zones/:id/generate-mission` | Creates mission from top unworked houses → navigates to Mission Detail |
| Open Impacted Houses | "View All Houses" | — (client-side) | Switches to Houses tab |
| Assign Team | "Assign Team" | `POST /api/houses/:id/assign` (bulk) | Opens rep-picker for bulk assignment |
| Generate Storm Summary | "Generate Summary" | `POST /api/ai/storm-zone-summary` `{ zoneId }` | Generates AI summary document |
| Save Watchlist | "Watch This Zone" | `POST /api/watchlists` `{ centroidLat, centroidLng, radiusMiles }` | Creates a watchlist centered on this zone |

### 5.4 Role Differences

| Role | Actions Available |
|---|---|
| Owner | All actions |
| Manager | All actions (scoped to own branch) |
| Rep | ❌ Cannot open (screen hidden) |
| Office Admin | ❌ Cannot open (screen hidden) |

### 5.5 Layout

- **Width:** 480px desktop, 100% mobile
- **Animation:** Slide in from right, `duration-300`
- **Backdrop:** `bg-black/50` overlay
- **Header:** Zone name, severity badge, score badge, close button
- **Tab bar:** `bg-storm-z1` tabs with `border-b border-storm-border`
- **Content area:** Scrollable

### 5.6 Empty State

N/A — the drawer only opens when a zone is selected.

### 5.7 Refresh Behavior

- **On open:** Fetches fresh data
- **While open:** No auto-refresh (user is reading/interacting)
- **On action completion:** Refetches drawer data and parent widget data

---

## Widget 6: Unworked Opportunity Clusters

### 6.1 Data Contract

**API:** `GET /api/storm-zones/clusters?min_score=60&min_houses=3&limit=8`

**Response envelope:** `{ data: OpportunityCluster[], error: string | null, meta: { total: number } }`

```typescript
// src/types/storms.ts

export interface OpportunityCluster {
  /** Cluster UUID (generated, not persisted — computed on-the-fly). */
  id: string;
  /** Display label (auto-generated from neighborhood + zone). */
  label: string;
  /** Parent storm zone ID. */
  stormZoneId: string;
  /** Parent storm zone name. */
  stormZoneName: string;
  /** Cluster centroid lat. */
  lat: number;
  /** Cluster centroid lng. */
  lng: number;
  /** Number of unworked houses in this cluster. */
  unworkedHouseCount: number;
  /** Average opportunity score of houses. */
  avgScore: number;
  /** Score tier. */
  scoreTier: ScoreTier;
  /** Estimated total opportunity for this cluster. */
  estimatedOpportunity: number;
  /** Nearest active rep distance (miles), null if no reps active. */
  nearestRepDistanceMiles: number | null;
  /** Nearest rep name. */
  nearestRepName: string | null;
  /** Dominant storm type in this cluster's zone. */
  stormType: "hail" | "wind" | "tornado" | "severe_thunderstorm";
  /** Days since storm. */
  stormAgeDays: number;
}
```

### 6.2 Data Source

| Data | Source | Notes |
|---|---|---|
| Clusters | Computed from `targets` + `target_scores` | Server-side spatial clustering within each active zone |
| Clustering algorithm | Grid-based (0.5-mile cells) grouping unworked targets with score ≥ 60 | Minimum 3 houses per cluster |
| Nearest rep | `rep_presence` WHERE `status = 'active'` | Haversine distance to cluster centroid |

### 6.3 Interaction Model

| Interaction | Behavior |
|---|---|
| **Cluster card click** | Opens Storm Detail Drawer for parent zone, scrolled to Houses tab filtered to cluster |
| **Cluster card hover** | Highlights cluster area on Live Storm Map |
| **"Create Mission" button** | `POST /api/storm-zones/:stormZoneId/generate-mission` `{ clusterCenter: { lat, lng }, radius: 0.5 }` |
| **"Assign Rep" button** | Opens rep-picker → bulk assigns cluster houses |

### 6.4 Role Differences

| Role | Behavior |
|---|---|
| Owner | All clusters, all branches |
| Manager | Own branch clusters |
| Rep | ❌ Screen hidden |
| Office Admin | ❌ Screen hidden |

### 6.5 Layout

- **Grid:** `col-span-1` on desktop, `col-span-1` on tablet, hidden on mobile
- **Position:** Row 4, left column
- **Card style:** Standard card. Each cluster is a compact row: label, score badge, house count, nearest rep pill.

### 6.6 Empty State

- **Icon:** `MapPin` (h-12 w-12, `text-storm-subtle/50`)
- **Heading:** "No unworked clusters"
- **Body:** "All high-scoring areas have active missions or assignments."
- **Action:** None

### 6.7 Refresh Behavior

- **Auto-refresh:** Every **5 minutes** (aligned with zone refresh)

---

## Widget 7: AI Recommendation Panel

### 7.1 Data Contract

**API:** `POST /api/ai/storm-zone-summary` `{ scope: "all_active_zones" }` or served as part of `GET /api/dashboard/ai-brief`

**Response envelope:** `{ data: StormAIRecommendation, error: string | null, meta: { generatedAt: string } }`

```typescript
// src/types/storms.ts

export interface StormAIRecommendation {
  /** Overall AI assessment of current storm landscape. */
  summary: string;
  /** Ranked action recommendations. */
  recommendations: AIStormAction[];
  /** Model used. */
  model: string;
  /** When this was generated. */
  generatedAt: string;
  /** Whether this is cached or freshly generated. */
  isCached: boolean;
}

export interface AIStormAction {
  /** Priority rank (1 = most important). */
  rank: number;
  /** Action category. */
  category: "deploy_team" | "create_mission" | "expand_zone" | "alert" | "reassign";
  /** Human-readable title. */
  title: string;
  /** Explanation of why this action is recommended. */
  reasoning: string;
  /** Related storm zone ID (if applicable). */
  stormZoneId: string | null;
  /** Related storm zone name. */
  stormZoneName: string | null;
  /** Estimated revenue impact. */
  estimatedImpact: number | null;
  /** Urgency level. */
  urgency: "immediate" | "today" | "this_week";
  /** CTA button label. */
  actionLabel: string;
  /** API endpoint for the action. */
  actionEndpoint: string;
  /** Payload for the action API call. */
  actionPayload: Record<string, unknown>;
}
```

### 7.2 Data Source

| Data | Source | Notes |
|---|---|---|
| Active zones | `storm_zones WHERE status = 'active'` | Top 10 by score |
| Unworked clusters | Cluster computation (§Widget 6) | |
| Team availability | `rep_presence` + `users WHERE role = 'rep'` | Available vs deployed |
| Recent missions | `canvass_missions WHERE created_at > NOW() - INTERVAL '7 days'` | Completion rates, coverage |
| AI generation | OpenAI `gpt-4o` | Structured output with reasoning |

**AI prompt context (sent to OpenAI):**
- Company profile from `company_ai_profiles`
- List of active zones with scores, house counts, unworked counts
- Current team deployment (who is in field, who is available)
- Recent mission completion rates
- Watchlist alert status
- Time of day and day of week (weekday morning = high urgency for deployment)

### 7.3 Interaction Model

| Interaction | Behavior |
|---|---|
| **Recommendation card click** | If has `stormZoneId` → opens Storm Detail Drawer. Otherwise, no-op. |
| **Action button click** | Calls `actionEndpoint` with `actionPayload` → shows success/error toast |
| **"Regenerate" button** | `POST /api/ai/storm-zone-summary` `{ scope: "all_active_zones", force: true }` |
| **Expand/collapse** | Each recommendation card is collapsible: title visible, reasoning hidden until expanded |

### 7.4 Role Differences

| Role | Behavior |
|---|---|
| Owner | Full recommendations, cross-branch. Can execute all actions. |
| Manager | Recommendations scoped to own branch. Can execute branch-level actions. |
| Rep | ❌ Screen hidden |
| Office Admin | ❌ Screen hidden |

### 7.5 Layout

- **Grid:** `col-span-1` on desktop, `col-span-1` on tablet, hidden on mobile
- **Position:** Row 4, right column (next to Unworked Opportunity Clusters)
- **Card style:** Standard card with purple top border (`border-t-2 border-storm-purple`) to signal AI content. `Sparkles` icon in header.
- **Max recommendations:** 5 (with "See more" expandable)
- **Recommendation card style:** Each recommendation is a mini-card with urgency dot (red=immediate, amber=today, blue=this_week), title, reasoning (collapsible), and action button.

### 7.6 Empty State

- **Icon:** `Sparkles` (h-12 w-12, `text-storm-subtle/50`)
- **Heading:** "No AI recommendations"
- **Body:** "Generate storm recommendations to get AI-powered deployment suggestions."
- **Action:** Button — "Generate Recommendations" → `POST /api/ai/storm-zone-summary`

### 7.7 Refresh Behavior

- **Auto-refresh:** No. Generated on-demand or once per day.
- **Cache:** Server caches per user per calendar day. Shows "Generated X hours ago" timestamp.
- **Stale indicator:** If `generatedAt` > 8 hours old, show amber "Stale" badge.

---

## 6. Watchlist Behavior

### 6.1 Creating a Watchlist

**Entry points:**
1. "Save Watchlist" button in Storms page header
2. "Create Watchlist" button in Territory Watchlist Alerts empty state
3. "Watch This Zone" action in Storm Detail Drawer
4. Settings → Integrations → Watchlists tab

**Creation flow (modal, max-width 560px):**

```
Step 1: Define Territory
┌─────────────────────────────────────────────────────┐
│  Create Watchlist                             [×]   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Name: [___________________________]                │
│                                                     │
│  Territory Type:                                    │
│  ○ Zip Codes   ○ Draw on Map   ○ Radius            │
│                                                     │
│  [If Zip Codes:]                                    │
│  Enter zip codes: [75201, 75202, 75203___]          │
│                                                     │
│  [If Radius:]                                       │
│  Center: [Address or lat/lng________]               │
│  Radius: [25] miles                                 │
│                                                     │
│  [If Draw on Map:]                                  │
│  [Mini Mapbox map with polygon draw tool]           │
│                                                     │
│                        [Cancel]  [Create Watchlist]  │
└─────────────────────────────────────────────────────┘
```

**API:** `POST /api/watchlists`

```typescript
// Request body
export interface CreateWatchlistRequest {
  name: string;
  type: WatchlistType;
  zipCodes?: string[];
  centerLat?: number;
  centerLng?: number;
  radiusMiles?: number;
  polygon?: GeoJSON.Polygon;
  alertEnabled?: boolean; // default true
}
```

**Behavior after creation:**
1. Watchlist appears in Territory Watchlist Alerts widget
2. System immediately checks for existing storm events within the new territory
3. If existing storms found → generates `zone_created` alerts retroactively
4. Future storm events that fall within territory → generate `new_storm` alerts

### 6.2 Alert Generation

Alerts are generated by a background process (triggered after each storm ingest cycle):

```
Storm ingest completes
    → For each new/updated storm_events_cache row:
        → Query territories WHERE territory contains event location
            (using is_in_territory() function from 20260311_storm_alerts_upgrade.sql)
        → For each matching territory:
            → Create alert_notification record
            → Determine alert type and priority
            → Insert into watchlist_alerts (new table, see below)
```

**New table for V2 watchlist alerts:**

```sql
CREATE TABLE IF NOT EXISTS watchlist_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    watchlist_id UUID NOT NULL REFERENCES territories(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    alert_type TEXT NOT NULL CHECK (alert_type IN ('new_storm', 'storm_upgrade', 'zone_created', 'unworked_houses')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    storm_zone_id UUID REFERENCES storm_zones(id) ON DELETE SET NULL,
    storm_event_id UUID REFERENCES storm_events_cache(id) ON DELETE SET NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Prevent duplicate alerts for same event/zone in same watchlist
    UNIQUE(watchlist_id, alert_type, COALESCE(storm_zone_id, '00000000-0000-0000-0000-000000000000'::UUID), COALESCE(storm_event_id, '00000000-0000-0000-0000-000000000000'::UUID))
);

CREATE INDEX IF NOT EXISTS watchlist_alerts_user_idx ON watchlist_alerts(user_id);
CREATE INDEX IF NOT EXISTS watchlist_alerts_watchlist_idx ON watchlist_alerts(watchlist_id);
CREATE INDEX IF NOT EXISTS watchlist_alerts_read_idx ON watchlist_alerts(is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS watchlist_alerts_created_idx ON watchlist_alerts(created_at DESC);
```

### 6.3 Alert Delivery

**V2 scope: In-app only.**

- Alerts appear in the Territory Watchlist Alerts widget on the Storms screen
- Unread alert count appears as a badge on the Storms sidebar item (via `activeStormCount` badge source, which sums zone count + unread alert count)
- No email, SMS, or push notifications in V2 (infrastructure exists in `push_subscriptions` and `alert_notifications` tables for future use)

**Future delivery channels (post-V2):**
- Email via SendGrid/Resend
- Push via Web Push API (table already exists)
- SMS via Twilio (column exists on territories)

---

## 7. AI Ranking: Zone vs House Scoring

### 7.1 Two-Level Scoring Model

Stormclose uses a two-level scoring system:

```
Level 1: Zone Scoring (WHERE should we work?)
    → Inputs: storm intensity, recency, house density, unworked ratio, avg house quality
    → Output: zone score 0–100
    → Used by: Storm Opportunity Zones widget, Top Storm Zones (Dashboard), AI Deployment Plan

Level 2: House Scoring (WHICH doors should we knock?)
    → Inputs: hail size, wind speed, storm duration, proximity, property value, roof age
    → Output: opportunity score 0–100
    → Used by: Houses To Hit Today, mission stop ordering, AI house ranking
```

### 7.2 "Top Zone" Determination

A zone is ranked as a "top zone" based on its composite score (§4.5). The factors that make a zone rank highly:

| Factor | Why It Matters | Weight |
|---|---|---|
| **Storm intensity** (30%) | Higher hail size + wind speed → more roof damage → more claims → more revenue | Dominant factor |
| **Recency** (25%) | Fresh storms = fresh damage = homeowners are motivated to act. Decay over 45 days. | Second factor |
| **Target density** (20%) | More houses = more doors to knock = higher total opportunity | Efficiency multiplier |
| **Unworked ratio** (15%) | Zones that haven't been touched yet are pure opportunity | Diminishing returns |
| **Average house quality** (10%) | Even in a hot zone, low-value houses reduce ROI | Quality floor |

### 7.3 Zone Score vs House Score

| Dimension | Zone Score | House Score |
|---|---|---|
| **Scope** | Region (convex hull of events) | Individual property |
| **Primary use** | "Where should I deploy my team today?" | "Which door should the rep knock next?" |
| **Storm inputs** | Max values across all events in zone | Proximity-weighted values for this house |
| **Property inputs** | Average house quality in zone | Specific property: year built, roof age, assessed value |
| **Density factor** | Yes (house count in zone) | No (single house) |
| **Unworked factor** | Yes (remaining opportunity) | No (always scores the individual) |
| **Algorithm** | `calculateZoneScore()` (§4.5) | `calculateThreatScore()` (existing in `threatScore.ts`) |
| **Weights config** | `src/config/zoneScoreWeights.json` (new) | `src/config/threatWeights.json` (existing) |

### 7.4 Connection to Dashboard Widgets

| Dashboard Widget | Data Source | Scoring Used |
|---|---|---|
| **Top Storm Zones** | `GET /api/storm-zones?sort=score&limit=5` | Zone score (§4.5) |
| **Houses To Hit Today** | `GET /api/houses/today` | House score (`calculateThreatScore`) |
| **AI Deployment Plan** | `POST /api/ai/daily-brief` | Zone score for zone selection, house score for rep allocation |
| **Unassigned Hot Clusters** | `GET /api/storm-zones/clusters` | House score (avg within cluster), filtered to ≥ 60 |

---

## 8. API Endpoint Summary (Storms Module)

| Endpoint | Method | Purpose | Response |
|---|---|---|---|
| `/api/storm-zones` | GET | List all zones (filterable, sortable) | `StormZoneListItem[]` |
| `/api/storm-zones?summary=true` | GET | KPI strip for Storms page | `StormsKpiStrip` |
| `/api/storm-zones/:id` | GET | Full zone detail (for drawer) | `StormZoneDetail` |
| `/api/storm-zones/:id/generate-mission` | POST | Create mission from zone's top houses | `{ missionId, stopCount }` |
| `/api/storm-zones/clusters` | GET | Unworked opportunity clusters | `OpportunityCluster[]` |
| `/api/storms` | GET | Live storm data (Xweather) | `{ storms, alerts, stormCells }` |
| `/api/storms/timeline` | GET | Recent storm event timeline | `StormTimelineEntry[]` |
| `/api/watchlists` | GET | List watchlists with alerts | `WatchlistWithAlerts[]` |
| `/api/watchlists` | POST | Create new watchlist | `Watchlist` |
| `/api/watchlists/:id` | PATCH | Update watchlist | `Watchlist` |
| `/api/watchlists/:id` | DELETE | Delete watchlist | `{ success: true }` |
| `/api/watchlists/alerts/:id` | PATCH | Mark alert as read/dismissed | `WatchlistAlert` |
| `/api/ai/storm-zone-summary` | POST | Generate AI recommendations | `StormAIRecommendation` |

---

## 9. Cross-Widget Communication

Widgets on the Storms page communicate through shared React state (not API calls):

| Source Widget | Target Widget | Event | Effect |
|---|---|---|---|
| Storm Opportunity Zones | Live Storm Map | Zone row hover | Highlight zone polygon on map |
| Storm Opportunity Zones | Storm Detail Drawer | Zone row click | Open drawer with zone data |
| Recent Storm Timeline | Live Storm Map | Event row hover | Show event marker on map |
| Unworked Clusters | Live Storm Map | Cluster card hover | Highlight cluster area on map |
| Live Storm Map | Storm Detail Drawer | Zone polygon click | Open drawer |
| Live Storm Map | Any | Viewport change | Update all viewport-dependent queries |
| Storm Detail Drawer | Storm Opportunity Zones | Mission created | Refresh zone list (mission count changes) |
| Storm Detail Drawer | Live Storm Map | Mission created | Refresh map (new mission markers) |

**Implementation:** Use a `StormsPageContext` React context provider wrapping all widgets. The context exposes:

```typescript
// src/app/(dashboard)/dashboard/storms/StormsPageContext.tsx

export interface StormsPageState {
  /** Currently highlighted zone ID (from hover). */
  highlightedZoneId: string | null;
  /** Currently highlighted event ID (from hover). */
  highlightedEventId: string | null;
  /** Currently highlighted cluster ID. */
  highlightedClusterId: string | null;
  /** Map viewport bounds. */
  mapBounds: { north: number; south: number; east: number; west: number } | null;
  /** Map zoom level. */
  mapZoom: number;
  /** Currently open drawer zone ID. */
  drawerZoneId: string | null;
  /** Selected time filter. */
  timeFilter: "24h" | "7d" | "30d" | "all";
}

export interface StormsPageActions {
  setHighlightedZone: (id: string | null) => void;
  setHighlightedEvent: (id: string | null) => void;
  setHighlightedCluster: (id: string | null) => void;
  setMapBounds: (bounds: StormsPageState["mapBounds"]) => void;
  setMapZoom: (zoom: number) => void;
  openDrawer: (zoneId: string) => void;
  closeDrawer: () => void;
  setTimeFilter: (filter: StormsPageState["timeFilter"]) => void;
  refreshAll: () => void;
}
```

---

## 10. Auto-Refresh Summary

| Widget | Interval | Method |
|---|---|---|
| Live Storm Map — zones | 300s (5 min) | Polling |
| Live Storm Map — live cells/alerts | 60s | Polling |
| Live Storm Map — house markers | On viewport change | Debounced fetch |
| Live Storm Map — rep positions | 15s | Polling |
| Recent Storm Timeline | 300s (5 min) | Polling |
| Storm Opportunity Zones | 300s (5 min) | Polling |
| Territory Watchlist Alerts | 60s | Polling |
| Unworked Opportunity Clusters | 300s (5 min) | Polling |
| AI Recommendation Panel | Manual | On-demand only |

---

## 11. Consolidated TypeScript Interfaces

All Storms-specific types should be defined in `src/types/storms.ts` and re-exported from `src/types/index.ts`.

**New file exports:**

```typescript
// src/types/storms.ts — exports

export type { StormSeverity, ScoreTier, ZoneStatus } from "./storms";
export type { StormsKpiStrip } from "./storms";
export type { StormZone } from "./storms";
export type { StormZoneListItem } from "./storms";
export type { StormZoneDetail, ZoneMissionSummary, ZoneAISuggestion } from "./storms";
export type { StormMapData, StormZoneMapItem, LiveStormCell, StormMapAlert, HouseMapMarker, RepMapPosition } from "./storms";
export type { StormTimelineEntry } from "./storms";
export type { Watchlist, WatchlistAlert, WatchlistWithAlerts, WatchlistType, CreateWatchlistRequest } from "./storms";
export type { OpportunityCluster } from "./storms";
export type { StormAIRecommendation, AIStormAction } from "./storms";
export type { ZoneScoreInputs, ZoneScoreWeights } from "./storms";
export type { StormsPageState, StormsPageActions } from "./storms";
```

**Shared types (already in `dashboard.ts`):** `StormSeverity`, `ScoreTier`, `HouseStatus`, `HouseToHit`, `StormZoneSummary`, `ZoneGeometry`. These should be imported from `dashboard.ts` rather than redefined.

---

## 12. Migration Path from V1

The existing V1 has these storm-related assets:

| V1 Asset | V2 Target | Action |
|---|---|---|
| `storm_events_cache` table | Keep as-is | reuse — events feed into zone creation |
| `storm_alerts` table | Keep, add `watchlist_alerts` table | reshape — alerts now linked to watchlists |
| `territories` table | Keep, rename conceptually to "watchlists" in UI | reshape — same table, different UI label |
| `hail_events` table | Keep as secondary data source | reuse — NOAA historical data supplements Xweather |
| `GET /api/storms` route | Keep, add zone-aware response fields | reshape |
| `GET /api/storms/timeline` route | Keep, add zone associations | reshape |
| `GET /api/storms/revenue-analysis` route | Replace with zone scoring | remove |
| `xweather.ts` client | Keep, all functions reused | reuse |
| `corelogic.ts` client | Keep, used for house enrichment in zones | reuse |
| `threatScore.ts` | Keep for house-level scoring | reuse |
| `threatWeights.json` | Keep for house-level weights | reuse |
| `missionService.ts` | Keep `createMissionFromStorm()`, adapt to use zones | reshape |

**New assets to create:**

| Asset | Purpose |
|---|---|
| `src/types/storms.ts` | All Storms module TypeScript interfaces |
| `src/config/zoneScoreWeights.json` | Zone-level scoring weights |
| `src/lib/storms/zoneScoring.ts` | Zone score calculation |
| `src/lib/storms/zoneClustering.ts` | Event-to-zone spatial clustering |
| `src/lib/storms/zoneNaming.ts` | Auto-generated zone name logic |
| `src/app/api/storm-zones/route.ts` | Zone CRUD + list API |
| `src/app/api/storm-zones/[id]/route.ts` | Zone detail API |
| `src/app/api/storm-zones/[id]/generate-mission/route.ts` | Mission generation from zone |
| `src/app/api/storm-zones/clusters/route.ts` | Unworked cluster computation |
| `src/app/api/watchlists/route.ts` | Watchlist CRUD |
| `src/app/api/watchlists/[id]/route.ts` | Single watchlist CRUD |
| `src/app/api/watchlists/alerts/[id]/route.ts` | Alert dismiss |
| `src/app/api/ai/storm-zone-summary/route.ts` | AI recommendations |
| `src/app/(dashboard)/dashboard/storms/page.tsx` | Storms page |
| `src/app/(dashboard)/dashboard/storms/storms-page.tsx` | Client component |
| `src/app/(dashboard)/dashboard/storms/StormsPageContext.tsx` | Cross-widget state |
| `src/components/storms/LiveStormMap.tsx` | Map widget |
| `src/components/storms/RecentStormTimeline.tsx` | Timeline widget |
| `src/components/storms/StormOpportunityZones.tsx` | Ranked zone list |
| `src/components/storms/TerritoryWatchlistAlerts.tsx` | Watchlist + alerts |
| `src/components/storms/StormDetailDrawer.tsx` | Zone detail drawer |
| `src/components/storms/UnworkedOpportunityClusters.tsx` | Cluster list |
| `src/components/storms/AIRecommendationPanel.tsx` | AI panel |
| `supabase/migrations/20260315_storm_zones.sql` | Zone + watchlist_alerts tables |
| `tests/storms-api.test.ts` | API route tests |
| `tests/zone-scoring.test.ts` | Scoring algorithm tests |
