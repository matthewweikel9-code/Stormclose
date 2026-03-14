# Stormclose V2 — Exports Module Specification

> Canonical reference for the Exports screen, JobNimbus export queue, retry logic, handoff summaries, and cross-surface export visibility.
> Derives from: `PRODUCT_CONTRACT_V2.md` §2 (JobNimbus Export pillar), §3 (Core Workflow step 11), §5 (Exports screen), `stormclose-enterprise-architecture.md` §5 (Screen Architecture — Exports), §8 (API Architecture — `POST /api/exports/jobnimbus`), `stormclose-dashboard-widgets.md` §8 (Export Queue Summary widget), `stormclose-mission-control.md` §3.1 (Sent To JN Today KPI), `stormclose-missions-geolocation.md` §2 (Stop Lifecycle — `sent_to_jobnimbus` terminal status).
> Builds on: `src/lib/jobnimbus/client.ts` (existing `JobNimbusClient`), `src/app/api/integrations/jobnimbus/export-lead/route.ts` (V1 single-lead export), `src/lib/ai/modules/exportSummary.ts` (AI handoff summary generator), `src/types/dashboard.ts` (`ExportQueueSummary`, `RecentExportRow`), `src/components/dashboard/ExportQueueSummary.tsx` (dashboard widget).
> Last updated: 2026-03-14

---

## 1. Exports Module Overview

**Purpose:** Push qualified opportunities into JobNimbus with structured handoff summaries, retry logic, and full audit trail. The export queue is a first-class operational surface — not a hidden settings page. Every qualified opportunity flows through this pipeline before reaching the CRM.

**Route:** `/dashboard/exports`

**Sidebar:** Eighth item, `Upload` icon, badge shows `readyCount` (integer count of opportunities ready to export, red dot when > 0).

**Role visibility:**

| Role | Access |
|---|---|
| Owner | ✅ Full — all exports, cross-branch, all actions, configure export rules |
| Manager | ✅ Full — own branch exports, all actions except rule configuration |
| Rep | ❌ Hidden — sidebar item not rendered (reps mark stops as `interested`; export is an office function) |
| Office Admin | ✅ Full — all actions, primary export operator |

**Primary action (PageHeader):** "Export All Ready" → triggers batch export of entire ready queue.

---

## 2. Export Criteria — What Makes an Opportunity "Ready to Export"

An opportunity is **ready to export** when ALL of the following are true:

| Criterion | Source | Rule |
|---|---|---|
| Stop outcome = `interested` | `mission_stops.status` | Stop must have reached `interested` status |
| Homeowner name captured | `mission_stops.homeowner_name` | Non-null, non-empty string |
| Interest level set | `mission_stops.interest_level` | Must be `high`, `medium`, or `low` |
| Not already exported | `opportunity_exports` | No row with `status = 'exported'` for this `mission_stop_id` |
| Not permanently failed | `opportunity_exports` | No row with `status = 'permanently_failed'` for this `mission_stop_id` |
| Mission is active or completed | `missions.status` | Mission must be `active` or `completed` (not `planned`, `paused`, or `expired`) |
| JobNimbus connected | `user_settings.jobnimbus_api_key` | Company must have a valid JobNimbus API key configured |

### 2.1 Optional Enrichment Criteria (for auto-export)

These additional criteria gate **automatic** export. Manual export bypasses them:

| Criterion | Source | Rule |
|---|---|---|
| Minimum opportunity score | `target_scores.score` | Score ≥ threshold (configurable, default 60) |
| Phone or email captured | `mission_stops` | At least one contact method present |
| Appointment date set | `mission_stops.appointment_date` | Non-null (indicates high commitment) |

---

## 3. Auto-Export vs. Manual Approval

### 3.1 Decision Matrix

```
                     ┌─────────────────────────────────────────────┐
                     │           Opportunity Qualified              │
                     │    (stop.status = 'interested')              │
                     └──────────────────┬──────────────────────────┘
                                        │
                              ┌─────────▼─────────┐
                              │  Auto-export       │
                              │  enabled for       │
                              │  this company?      │
                              └──┬──────────────┬──┘
                           YES   │              │  NO
                     ┌───────────▼──┐    ┌──────▼──────────┐
                     │  Meets ALL    │    │  → ready queue   │
                     │  auto-export  │    │  (manual review) │
                     │  criteria?    │    └─────────────────┘
                     └──┬────────┬──┘
                   YES  │        │  NO
              ┌─────────▼──┐  ┌──▼──────────────┐
              │  → auto     │  │  → ready queue   │
              │  enqueue    │  │  (manual review) │
              │  (status =  │  └─────────────────┘
              │  'ready')   │
              └─────────────┘
```

### 3.2 Auto-Export Rules (Configurable)

```typescript
// src/types/exports.ts

export interface ExportRuleSet {
  /** Whether auto-export is enabled. Default: false (manual approval). */
  autoExportEnabled: boolean;
  /** Minimum opportunity score for auto-export. Default: 60. */
  minScoreForAutoExport: number;
  /** Require phone or email for auto-export. Default: true. */
  requireContactInfo: boolean;
  /** Require appointment date for auto-export. Default: false. */
  requireAppointmentDate: boolean;
  /** Auto-export interest levels. Default: ['high']. */
  autoExportInterestLevels: Array<"high" | "medium" | "low">;
  /** Hours after qualification to auto-export if not manually reviewed. Default: null (never). */
  autoExportDelayHours: number | null;
  /** Maximum exports per hour (rate limit safety). Default: 50. */
  maxExportsPerHour: number;
  /** Notification on auto-export. Default: true. */
  notifyOnAutoExport: boolean;
  /** Notification on failure. Default: true. */
  notifyOnFailure: boolean;
}
```

### 3.3 Who Configures Rules

| Role | Can Configure |
|---|---|
| Owner | ✅ Full — all rules |
| Manager | ❌ Read-only view of rules |
| Office Admin | ❌ Read-only view of rules |

Rules are stored in `company_ai_profiles.export_rules` (JSONB column) — one rule set per company.

---

## 4. Export State Machine

### 4.1 State Diagram

```
                         ┌──────────────────┐
                         │                  │
          ┌──────────────▼──┐               │
          │     ready        │               │
          │  (awaiting send) │               │
          └───────┬──────────┘               │
                  │                          │
         trigger  │  (manual click           │
         export   │   or auto-export)        │
                  │                          │
          ┌───────▼──────────┐               │
          │   exporting      │               │
          │  (API call        │               │
          │   in flight)     │               │
          └───┬──────────┬───┘               │
              │          │                   │
         success       failure               │
              │          │                   │
     ┌────────▼──┐  ┌────▼───────┐           │
     │ exported  │  │  failed    │           │
     │ (terminal │  │            │           │
     │  success) │  └────┬───────┘           │
     └───────────┘       │                   │
                         │                   │
               ┌─────────▼──────────┐        │
               │  attempts < 3?     │        │
               └──┬──────────────┬──┘        │
              YES │              │ NO         │
         ┌────────▼────┐  ┌─────▼──────────┐ │
         │  retrying   │  │ permanently    │ │
         │ (backoff    │  │ _failed        │ │
         │  timer)     │  │ (terminal)     │ │
         └──────┬──────┘  └────────────────┘ │
                │                             │
                │  (timer fires)              │
                └─────────────────────────────┘
                      (back to ready)
```

### 4.2 State Definitions

| Status | Description | Terminal? | Can Transition To |
|---|---|---|---|
| `ready` | Opportunity meets export criteria, awaiting send | No | `exporting` |
| `exporting` | API call to JobNimbus is in flight | No | `exported`, `failed` |
| `exported` | Successfully pushed to JobNimbus, `jobnimbus_id` recorded | **Yes** | — |
| `failed` | API call failed, will evaluate for retry | No | `retrying`, `permanently_failed` |
| `retrying` | Queued for retry with backoff timer | No | `ready` (when timer fires) |
| `permanently_failed` | Exhausted all retry attempts | **Yes** | `ready` (manual override only) |

### 4.3 Transition Rules

| From | To | Trigger | Side Effects |
|---|---|---|---|
| — | `ready` | Stop reaches `interested` + criteria met, OR manual "Add to Export Queue" | Create `opportunity_exports` row. Check auto-export rules → if auto, immediately transition to `exporting`. |
| `ready` | `exporting` | User clicks "Export" / batch export / auto-export timer | Set `exporting_at = NOW()`. Lock row (prevent duplicate sends). |
| `exporting` | `exported` | JobNimbus API returns 2xx with contact/job ID | Set `exported_at = NOW()`, `jobnimbus_id = response.id`. Update `mission_stops.status = 'sent_to_jobnimbus'`. Log to `integration_sync_logs`. Emit `opportunity_exported` event. |
| `exporting` | `failed` | JobNimbus API returns 4xx/5xx, timeout, or network error | Set `error = error_message`, `attempts += 1`. Log to `integration_sync_logs`. If `attempts < 3`: transition to `retrying`. If `attempts >= 3`: transition to `permanently_failed`. |
| `failed` | `retrying` | Automatic (when `attempts < MAX_RETRIES`) | Set `next_retry_at` using exponential backoff. |
| `failed` | `permanently_failed` | Automatic (when `attempts >= MAX_RETRIES`) | Emit `export_permanently_failed` event. Notify configured users. |
| `retrying` | `ready` | Backoff timer fires (`NOW() >= next_retry_at`) | Reset to `ready` for re-processing. |
| `permanently_failed` | `ready` | Manual override by Owner/Manager/Admin | Reset `attempts = 0`, clear `error`. Log override in `mission_events`. |

---

## 5. Retry Logic

### 5.1 Configuration

| Parameter | Value |
|---|---|
| Max retries | 3 attempts (initial + 2 retries) |
| Backoff strategy | Exponential with jitter |
| Backoff base | 60 seconds |
| Backoff formula | `base * 2^(attempt - 1) + random(0, 30)` seconds |
| Max backoff | 15 minutes |
| Retry window | 24 hours (after 24h in `retrying`, auto-transition to `permanently_failed`) |

### 5.2 Backoff Schedule

| Attempt | Base Delay | With Jitter (range) |
|---|---|---|
| 1 (initial) | Immediate | — |
| 2 (1st retry) | 60s | 60–90s |
| 3 (2nd retry) | 120s | 120–150s |
| 4+ | — | → `permanently_failed` |

### 5.3 Failure Classification

| Error Type | HTTP Status | Retryable? | Notes |
|---|---|---|---|
| Rate limited | 429 | ✅ Yes | Respect `Retry-After` header if present |
| Server error | 500, 502, 503 | ✅ Yes | Transient — retry with backoff |
| Timeout | — | ✅ Yes | Network timeout (10s default) |
| Bad request | 400 | ❌ No | Payload issue — immediately `permanently_failed` |
| Unauthorized | 401 | ❌ No | API key invalid — `permanently_failed` + notify |
| Not found | 404 | ❌ No | Endpoint issue — `permanently_failed` |
| Conflict / Duplicate | 409 | ❌ No | Already exists in JN — mark `exported`, fetch existing ID |

### 5.4 Retry Worker

Retries are processed by a cron-like endpoint:

```
POST /api/cron/process-export-retries
```

- Runs every 60 seconds (Vercel cron or external scheduler).
- Fetches all `opportunity_exports` where `status = 'retrying'` AND `next_retry_at <= NOW()`.
- Processes up to 10 per invocation (prevent timeout).
- Transitions each back to `ready` for re-export.

---

## 6. Export Data Package — Fields Sent to JobNimbus

### 6.1 Contact Record

The primary export creates a **JNContact** in JobNimbus:

```typescript
// src/types/exports.ts

export interface ExportPayload {
  /** Contact fields for JN contact creation. */
  contact: {
    first_name: string;
    last_name: string;
    display_name: string;
    address_line1: string;
    city: string;
    state_text: string;
    zip: string;
    mobile_phone: string | null;
    email: string | null;
    source_name: "Stormclose AI";
    tags: string[];
    notes: string;
  };
  /** Job fields for JN job creation (attached to contact). */
  job: {
    name: string;
    description: string;
    status_name: string;
    address_line1: string;
    city: string;
    state_text: string;
    zip: string;
    tags: string[];
  };
  /** Activity note attached to the contact/job. */
  activity: {
    type: "note";
    title: string;
    note: string;
  };
  /** AI-generated handoff summary (from export-summary module). */
  handoffSummary: string;
}
```

### 6.2 Tag Strategy

All exported contacts/jobs receive these tags for traceability:

| Tag | Example | Purpose |
|---|---|---|
| `Stormclose` | `Stormclose` | Source system identification |
| `AI Lead` | `AI Lead` | Lead generated/scored by AI |
| Storm zone name | `Hail Zone - Dallas 03/10` | Storm context |
| Interest level | `Interest: High` | Qualification level |
| Mission name | `Mission: North Dallas 03/14` | Field operation context |

### 6.3 Notes Field Content

The `notes` field on the JN contact is a structured plaintext summary:

```
--- Imported from Stormclose AI ---

Property: 1234 Oak St, Dallas, TX 75201
Storm Zone: North Dallas Hail — March 10, 2026
Hail Size: 1.75"
Estimated Claim Value: $15,000–$25,000

Homeowner: John Smith
Interest Level: High
Appointment: March 16, 2026 @ 2:00 PM

Rep: Sarah Johnson
Visit Date: March 14, 2026
Outcome: Interested — visible hail damage on north-facing slope

Rep Notes: "Homeowner noticed leaking after last storm. Very receptive.
 Existing insurance claim not yet filed."

Opportunity Score: 87/100

Exported: March 14, 2026 3:45 PM
Source: Stormclose AI
```

### 6.4 Handoff Summary (AI-Generated)

The AI handoff summary is generated by `POST /api/ai/export-summary` using the `exportSummary` AI module. It produces:

| Field | Description |
|---|---|
| `summary` | 2–3 paragraph narrative summary of the opportunity |
| `crmFields.contactName` | Homeowner name |
| `crmFields.contactPhone` | Phone if captured |
| `crmFields.contactEmail` | Email if captured |
| `crmFields.propertyAddress` | Full address |
| `crmFields.leadSource` | Always "Stormclose AI" |
| `crmFields.estimatedValue` | Value band string |
| `crmFields.stormEvent` | Storm event description |
| `crmFields.damageType` | Observed damage type |
| `crmFields.interestLevel` | high / medium / low |
| `crmFields.nextAction` | Recommended next step |
| `crmFields.appointmentDate` | If scheduled |
| `visitTimeline` | Array of `{ timestamp, action, outcome }` visit events |

The handoff summary is attached as a JN activity note and also stored in `opportunity_exports.payload` for audit.

---

## 7. Data Model

### 7.1 `opportunity_exports` Table

```sql
-- Migration: supabase/migrations/20260315_exports.sql

CREATE TYPE export_status AS ENUM (
    'ready',
    'exporting',
    'exported',
    'failed',
    'retrying',
    'permanently_failed'
);

CREATE TABLE IF NOT EXISTS opportunity_exports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Source references
    house_id UUID NOT NULL,
    mission_id UUID,
    mission_stop_id UUID,

    -- Export state
    status export_status NOT NULL DEFAULT 'ready',
    payload JSONB,
    handoff_summary TEXT,

    -- JobNimbus response
    jobnimbus_contact_id TEXT,
    jobnimbus_job_id TEXT,

    -- Error tracking
    error TEXT,
    error_code TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    next_retry_at TIMESTAMPTZ,

    -- Timestamps
    queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    exporting_at TIMESTAMPTZ,
    exported_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    permanently_failed_at TIMESTAMPTZ,

    -- Audit
    created_by UUID NOT NULL,
    approved_by UUID,
    auto_exported BOOLEAN NOT NULL DEFAULT false,

    -- Standard
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_opportunity_exports_status ON opportunity_exports(status);
CREATE INDEX idx_opportunity_exports_house ON opportunity_exports(house_id);
CREATE INDEX idx_opportunity_exports_mission_stop ON opportunity_exports(mission_stop_id);
CREATE INDEX idx_opportunity_exports_created_by ON opportunity_exports(created_by);
CREATE INDEX idx_opportunity_exports_next_retry ON opportunity_exports(next_retry_at)
    WHERE status = 'retrying';
CREATE INDEX idx_opportunity_exports_exported_today ON opportunity_exports(exported_at)
    WHERE status = 'exported';
CREATE INDEX idx_opportunity_exports_created_at ON opportunity_exports(created_at DESC);

-- RLS
ALTER TABLE opportunity_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company exports"
    ON opportunity_exports FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create exports"
    ON opportunity_exports FOR INSERT
    WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own company exports"
    ON opportunity_exports FOR UPDATE
    USING (auth.uid() IS NOT NULL);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_opportunity_exports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_opportunity_exports_updated_at
    BEFORE UPDATE ON opportunity_exports
    FOR EACH ROW
    EXECUTE FUNCTION update_opportunity_exports_updated_at();
```

### 7.2 `export_rules` Storage

Export rules are stored as a JSONB column on `company_ai_profiles`:

```sql
-- Migration addition to company_ai_profiles
ALTER TABLE company_ai_profiles
    ADD COLUMN IF NOT EXISTS export_rules JSONB DEFAULT '{
        "autoExportEnabled": false,
        "minScoreForAutoExport": 60,
        "requireContactInfo": true,
        "requireAppointmentDate": false,
        "autoExportInterestLevels": ["high"],
        "autoExportDelayHours": null,
        "maxExportsPerHour": 50,
        "notifyOnAutoExport": true,
        "notifyOnFailure": true
    }'::jsonb;
```

---

## 8. API Contracts

### 8.1 `GET /api/exports` — List Exports

**Purpose:** List exports with status filtering, pagination, and search.

**Query parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `status` | `export_status` | — | Filter by status (comma-separated for multiple) |
| `q` | string | — | Search by address or homeowner name |
| `from` | ISO date | — | Created after this date |
| `to` | ISO date | — | Created before this date |
| `limit` | integer | 50 | Max results |
| `offset` | integer | 0 | Pagination offset |
| `sort` | string | `created_at` | Sort field: `created_at`, `exported_at`, `status` |
| `order` | `asc` \| `desc` | `desc` | Sort order |

**Response:**

```typescript
interface ListExportsResponse {
  data: {
    exports: OpportunityExportRow[];
    total: number;
    readyCount: number;
    exportedTodayCount: number;
    failedCount: number;
    retryingCount: number;
    permanentlyFailedCount: number;
  };
  error: string | null;
  meta: {
    timestamp: string;
    limit: number;
    offset: number;
  };
}

interface OpportunityExportRow {
  id: string;
  houseId: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  missionId: string | null;
  missionName: string | null;
  missionStopId: string | null;
  homeownerName: string | null;
  interestLevel: "high" | "medium" | "low" | null;
  opportunityScore: number | null;
  estimatedValueBand: string | null;
  status: ExportStatus;
  jobnimbusContactId: string | null;
  jobnimbusJobId: string | null;
  error: string | null;
  errorCode: string | null;
  attempts: number;
  nextRetryAt: string | null;
  autoExported: boolean;
  queuedAt: string;
  exportedAt: string | null;
  createdBy: string;
  createdAt: string;
}
```

---

### 8.2 `POST /api/exports/jobnimbus` — Trigger Export

**Purpose:** Trigger export for one opportunity, a batch, or all ready.

**Request body:**

```typescript
interface TriggerExportRequest {
  /** Export a single opportunity by export ID. */
  exportId?: string;
  /** Export multiple by IDs. */
  exportIds?: string[];
  /** Export all ready opportunities. */
  all?: boolean;
  /** Whether to generate an AI handoff summary before export. Default: true. */
  generateHandoffSummary?: boolean;
}
```

**Response:**

```typescript
interface TriggerExportResponse {
  data: {
    triggered: number;
    results: Array<{
      exportId: string;
      status: "exported" | "failed";
      jobnimbusContactId: string | null;
      jobnimbusJobId: string | null;
      error: string | null;
    }>;
  };
  error: string | null;
  meta: {
    timestamp: string;
    batchId: string;
    durationMs: number;
  };
}
```

**Behavior:**
1. Validate all referenced exports exist and are in `ready` status.
2. For each export:
   a. Transition to `exporting`.
   b. Build export payload (`buildExportPayload`).
   c. Optionally generate AI handoff summary (`POST /api/ai/export-summary`).
   d. Call `JobNimbusClient.createContact()`.
   e. If contact created, call `JobNimbusClient.createJob()` with `contact_id`.
   f. Attach handoff summary as JN activity note.
   g. On success: transition to `exported`, record JN IDs.
   h. On failure: transition to `failed`, record error, evaluate retry.
3. Return aggregate results.

---

### 8.3 `POST /api/exports/[id]/retry` — Retry Failed Export

**Purpose:** Manually retry a failed or permanently failed export.

**Request body:**

```typescript
interface RetryExportRequest {
  /** Optional: override the payload before retrying. */
  payloadOverrides?: Partial<ExportPayload>;
  /** Reset attempt counter. Default: false. */
  resetAttempts?: boolean;
}
```

**Response:**

```typescript
interface RetryExportResponse {
  data: {
    exportId: string;
    newStatus: ExportStatus;
    nextRetryAt: string | null;
  };
  error: string | null;
  meta: { timestamp: string };
}
```

**Behavior:**
1. Validate export exists and is in `failed` or `permanently_failed` status.
2. If `resetAttempts`, set `attempts = 0`.
3. Apply `payloadOverrides` to stored payload if provided.
4. Transition to `ready`.
5. If auto-export enabled, immediately trigger export.

---

### 8.4 `GET /api/exports/[id]/status` — Export Status Detail

**Purpose:** Get full detail for a single export, including payload preview and error history.

**Response:**

```typescript
interface ExportStatusResponse {
  data: {
    export: OpportunityExportRow;
    payload: ExportPayload | null;
    handoffSummary: string | null;
    timeline: Array<{
      timestamp: string;
      event: string;
      detail: string | null;
    }>;
  };
  error: string | null;
  meta: { timestamp: string };
}
```

---

### 8.5 `GET /api/exports/[id]/preview` — Handoff Summary Preview

**Purpose:** Preview the handoff summary and export payload that will be sent to JobNimbus, without actually sending.

**Response:**

```typescript
interface ExportPreviewResponse {
  data: {
    exportId: string;
    payload: ExportPayload;
    handoffSummary: string | null;
    validationWarnings: string[];
  };
  error: string | null;
  meta: { timestamp: string };
}
```

**Behavior:**
1. Build the export payload from current house/mission/stop data.
2. If handoff summary not yet generated, generate it (but don't save — preview only).
3. Run validation checks and return warnings (missing phone, low score, etc.).

---

### 8.6 `GET /api/exports/rules` — Get Export Rules

**Response:**

```typescript
interface ExportRulesResponse {
  data: ExportRuleSet;
  error: string | null;
  meta: { timestamp: string };
}
```

---

### 8.7 `PATCH /api/exports/rules` — Update Export Rules

**Request body:** `Partial<ExportRuleSet>`

**Authorization:** Owner only.

**Response:** Same as `GET /api/exports/rules`.

---

## 9. Service Layer

### 9.1 `ExportService` — `src/services/exports/exportService.ts`

```typescript
// src/services/exports/exportService.ts

export interface ExportService {
  /** Check if a mission stop qualifies for export. */
  checkExportEligibility(stopId: string): Promise<{
    eligible: boolean;
    reasons: string[];
    autoExportAllowed: boolean;
  }>;

  /** Build the full export payload for a house/stop. */
  buildExportPayload(params: {
    houseId: string;
    missionId: string | null;
    missionStopId: string | null;
    createdBy: string;
  }): Promise<ExportPayload>;

  /** Queue an opportunity for export. */
  queueForExport(params: {
    houseId: string;
    missionId: string | null;
    missionStopId: string | null;
    createdBy: string;
    autoExported: boolean;
  }): Promise<{ exportId: string; status: ExportStatus }>;

  /** Execute the export to JobNimbus. */
  sendToJobNimbus(exportId: string): Promise<{
    success: boolean;
    jobnimbusContactId: string | null;
    jobnimbusJobId: string | null;
    error: string | null;
  }>;

  /** Process retry queue — called by cron. */
  processRetryQueue(limit?: number): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
  }>;

  /** Get current export rules for the company. */
  getExportRules(userId: string): Promise<ExportRuleSet>;

  /** Update export rules. */
  updateExportRules(userId: string, rules: Partial<ExportRuleSet>): Promise<ExportRuleSet>;
}
```

### 9.2 Payload Builder — `buildExportPayload`

Assembly order:
1. Fetch house data (address, lat/lng, property details from `targets` + `parcel_cache`).
2. Fetch mission stop data (homeowner name, phone, email, interest level, appointment, rep notes).
3. Fetch mission data (mission name, zone name, rep name).
4. Fetch storm zone data (storm event dates, hail size, severity).
5. Fetch target score (opportunity score, estimated value band).
6. Compose `ExportPayload` with all fields.
7. Generate structured notes string.

### 9.3 Error Handling in `sendToJobNimbus`

```typescript
async function sendToJobNimbus(exportId: string): Promise<SendResult> {
  // 1. Fetch export row, validate status = 'ready' or 'exporting'
  // 2. Transition to 'exporting'
  // 3. Get company's JN API key
  // 4. Build JN client
  // 5. Try: createContact → createJob → createActivity
  // 6. On success: transition to 'exported'
  // 7. On 400/401/404: transition to 'permanently_failed' (non-retryable)
  // 8. On 429/5xx/timeout: transition to 'failed' → evaluate retry
  // 9. On 409 (duplicate): search JN for existing, mark 'exported' with found ID
  // 10. Log to integration_sync_logs regardless of outcome
}
```

---

## 10. Cross-Surface Visibility

Export state is visible across multiple surfaces — the Exports page is not the only place users see export status.

### 10.1 Dashboard — Export Queue Summary Widget

**Location:** `ExportQueueSummaryWidget` (existing component)
**Data source:** `GET /api/dashboard/export-summary`
**Displays:**
- Ready count (with "Export All Ready" action)
- Exported today count
- Failed count (red highlight when > 0)
- Retry queue count
- Last 5 recent exports with status badges
- "View Queue →" link to `/dashboard/exports`

### 10.2 Dashboard — Recent Qualified Opportunities

**Location:** `RecentQualifiedOpps` widget
**Displays:** `exportStatus` badge per opportunity row:
- `not_exported` → default (gray) badge
- `queued` → warning (amber) badge — maps to `ready` status
- `exported` → success (green) badge
- `failed` → danger (red) badge

**Action:** "Send to JobNimbus" row action → queues the opportunity, navigates to or opens export preview.

### 10.3 Dashboard — Houses To Hit Today

**Location:** `HousesToHitToday` widget
**Action:** "Send to JobNimbus" row action (only shown when stop is `interested` and not yet exported).

### 10.4 Mission Control — KPI Tower

**Location:** KPI Tower widget (existing `KpiTower.tsx`)
**KPI:** "SENT TO JN" → `sentToJobNimbusToday` count
**Source:** `COUNT(opportunity_exports WHERE status = 'exported' AND exported_at::date = CURRENT_DATE)`

### 10.5 Mission Control — Bottom Ticker

**Location:** Bottom ticker (rotating news feed)
**Events:** "✅ John Smith at 1234 Oak St exported to JobNimbus" appears in ticker when export succeeds.

### 10.6 Missions — Stop Status

**Location:** Mission stop list in Mission Detail view
**Status:** When a stop is exported, its status shows as `sent_to_jobnimbus` with a green check and "Sent to JN" label.
**Action:** "Export to JN" button on stops with `interested` status.

### 10.7 Team — Exception Feed

**Location:** Exception feed in Team module
**Exception type:** `export_backlog_growing` fires when:
```
COUNT(opportunity_exports WHERE status = 'ready' AND created_at < NOW() - INTERVAL '2 hours') > 10
```
**Suggested action:** "Process the export queue or check JobNimbus connection health."

---

## 11. Exports Page — UI Specification

### 11.1 KPI Strip

| Position | Label | Source | Format |
|---|---|---|---|
| 1 (primary) | Ready to Export | `readyCount` | Integer, `text-storm-purple` |
| 2 | Exported Today | `exportedTodayCount` | Integer, green when > 0 |
| 3 | Failed | `failedCount` | Integer, red when > 0 |
| 4 | Retry Queue | `retryingCount` | Integer, amber when > 0 |
| 5 | Success Rate | `successRatePercent` | Percentage |

### 11.2 Tab Layout

```
┌────────────────────────────────────────────────────────────────┐
│  [Ready (12)]  [Exported (47)]  [Failed (3)]  [Retry (2)]     │
│  [Rules]                                                        │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Tab content area                                              │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 11.3 Tab: Ready to Export

**Content:** Table of opportunities awaiting export.

| Column | Source | Width |
|---|---|---|
| Address | `house.address` | 25% |
| Homeowner | `stop.homeowner_name` | 15% |
| Interest | `stop.interest_level` | 8% |
| Score | `target_scores.score` | 8% |
| Value Band | `target_scores.estimated_value_band` | 10% |
| Rep | `users.name` | 12% |
| Queued | `opportunity_exports.queued_at` | 12% |
| Actions | — | 10% |

**Row actions:**
- "Preview" → opens Handoff Summary Preview drawer
- "Export" → triggers single export
- Checkbox for batch selection

**Header actions:**
- "Export All Ready" button (primary)
- "Export Selected" button (secondary, appears when items checked)

### 11.4 Tab: Recently Exported

**Content:** Last 50 successful exports, most recent first.

| Column | Width |
|---|---|
| Address | 25% |
| Homeowner | 15% |
| JN Contact ID | 12% |
| JN Job ID | 12% |
| Exported At | 15% |
| Exported By | 12% |
| Auto? | 8% |

**Row action:** Click opens export detail with full payload view.

### 11.5 Tab: Failed Exports

**Content:** Exports that failed, sorted by most recent failure.

| Column | Width |
|---|---|
| Address | 20% |
| Homeowner | 12% |
| Error | 25% |
| Attempts | 8% |
| Failed At | 15% |
| Actions | 20% |

**Row actions:**
- "Retry" → `POST /api/exports/[id]/retry`
- "Preview" → opens payload preview to inspect/fix issues
- "Dismiss" → transitions to `permanently_failed` (with confirmation)

### 11.6 Tab: Retry Queue

**Content:** Exports in `retrying` status, sorted by `next_retry_at`.

| Column | Width |
|---|---|
| Address | 20% |
| Homeowner | 12% |
| Error (last) | 25% |
| Attempt | 8% |
| Next Retry | 15% |
| Actions | 20% |

**Row actions:**
- "Retry Now" → skips backoff timer, immediately re-queues
- "Cancel Retry" → transitions to `permanently_failed`

### 11.7 Tab: Export Rules

**Content:** Configuration form for auto-export rules.

| Setting | Control | Default |
|---|---|---|
| Auto-export enabled | Toggle switch | Off |
| Minimum score | Number input (0–100) | 60 |
| Require contact info | Toggle switch | On |
| Require appointment date | Toggle switch | Off |
| Auto-export interest levels | Multi-select (`high`, `medium`, `low`) | `[high]` |
| Auto-export delay | Number input (hours) or "Immediate" | null (disabled) |
| Max exports per hour | Number input | 50 |
| Notify on auto-export | Toggle switch | On |
| Notify on failure | Toggle switch | On |

**Save action:** `PATCH /api/exports/rules`

### 11.8 Handoff Summary Preview Drawer

**Trigger:** "Preview" button on any Ready or Failed export row.

**Drawer content:**

```
┌──────────────────────────────────────────────┐
│  Handoff Summary Preview                 [X] │
├──────────────────────────────────────────────┤
│                                              │
│  📋 Contact                                  │
│  Name: John Smith                            │
│  Phone: (214) 555-1234                       │
│  Email: john@example.com                     │
│  Address: 1234 Oak St, Dallas, TX 75201      │
│                                              │
│  🏠 Property                                 │
│  Storm Zone: North Dallas Hail               │
│  Hail Size: 1.75"                            │
│  Estimated Value: $15,000–$25,000            │
│  Opportunity Score: 87/100                   │
│                                              │
│  📝 Visit Summary                            │
│  Rep: Sarah Johnson                          │
│  Date: March 14, 2026                        │
│  Outcome: Interested                         │
│  Interest Level: High                        │
│  Appointment: March 16 @ 2:00 PM             │
│                                              │
│  💬 AI Handoff Summary                       │
│  ┌────────────────────────────────────────┐  │
│  │ John Smith at 1234 Oak St showed       │  │
│  │ strong interest following the March    │  │
│  │ 10 hail event. Property has visible    │  │
│  │ damage on north-facing slope...        │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ⚠️ Warnings                                 │
│  • No email captured                         │
│                                              │
│  [Generate Summary]  [Export Now]  [Close]    │
│                                              │
└──────────────────────────────────────────────┘
```

### 11.9 Empty States

| Tab | Icon | Heading | Body |
|---|---|---|---|
| Ready | `Upload` | No exports pending | Qualified opportunities will appear here when reps mark homes as "Interested". |
| Exported | `CheckCircle` | No exports yet today | Successfully exported opportunities will appear here. |
| Failed | `CheckCircle` | No failures | All exports are healthy. |
| Retry | `CheckCircle` | Retry queue empty | No exports awaiting retry. |

---

## 12. Types — `src/types/exports.ts`

```typescript
// src/types/exports.ts

// ── Export Status ─────────────────────────────────────────────────────────────

export type ExportStatus =
  | "ready"
  | "exporting"
  | "exported"
  | "failed"
  | "retrying"
  | "permanently_failed";

// ── Export Record ─────────────────────────────────────────────────────────────

export interface OpportunityExportRecord {
  id: string;
  houseId: string;
  missionId: string | null;
  missionStopId: string | null;
  status: ExportStatus;
  payload: ExportPayload | null;
  handoffSummary: string | null;
  jobnimbusContactId: string | null;
  jobnimbusJobId: string | null;
  error: string | null;
  errorCode: string | null;
  attempts: number;
  maxRetries: number;
  nextRetryAt: string | null;
  queuedAt: string;
  exportingAt: string | null;
  exportedAt: string | null;
  failedAt: string | null;
  permanentlyFailedAt: string | null;
  createdBy: string;
  approvedBy: string | null;
  autoExported: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Export Payload ────────────────────────────────────────────────────────────

export interface ExportPayload {
  contact: {
    first_name: string;
    last_name: string;
    display_name: string;
    address_line1: string;
    city: string;
    state_text: string;
    zip: string;
    mobile_phone: string | null;
    email: string | null;
    source_name: "Stormclose AI";
    tags: string[];
    notes: string;
  };
  job: {
    name: string;
    description: string;
    status_name: string;
    address_line1: string;
    city: string;
    state_text: string;
    zip: string;
    tags: string[];
  };
  activity: {
    type: "note";
    title: string;
    note: string;
  };
  handoffSummary: string;
}

// ── Export Rules ──────────────────────────────────────────────────────────────

export interface ExportRuleSet {
  autoExportEnabled: boolean;
  minScoreForAutoExport: number;
  requireContactInfo: boolean;
  requireAppointmentDate: boolean;
  autoExportInterestLevels: Array<"high" | "medium" | "low">;
  autoExportDelayHours: number | null;
  maxExportsPerHour: number;
  notifyOnAutoExport: boolean;
  notifyOnFailure: boolean;
}

// ── Export Filters ────────────────────────────────────────────────────────────

export interface ExportFilters {
  status?: ExportStatus | ExportStatus[];
  q?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
  sort?: "created_at" | "exported_at" | "status" | "queued_at";
  order?: "asc" | "desc";
}

// ── API Request/Response ─────────────────────────────────────────────────────

export interface TriggerExportRequest {
  exportId?: string;
  exportIds?: string[];
  all?: boolean;
  generateHandoffSummary?: boolean;
}

export interface RetryExportRequest {
  payloadOverrides?: Partial<ExportPayload>;
  resetAttempts?: boolean;
}

export interface ExportResult {
  exportId: string;
  status: "exported" | "failed";
  jobnimbusContactId: string | null;
  jobnimbusJobId: string | null;
  error: string | null;
}

// ── Default Export Rules ─────────────────────────────────────────────────────

export const DEFAULT_EXPORT_RULES: ExportRuleSet = {
  autoExportEnabled: false,
  minScoreForAutoExport: 60,
  requireContactInfo: true,
  requireAppointmentDate: false,
  autoExportInterestLevels: ["high"],
  autoExportDelayHours: null,
  maxExportsPerHour: 50,
  notifyOnAutoExport: true,
  notifyOnFailure: true,
};
```

---

## 13. Grid Layout

```
Desktop (xl, ≥1280px) — full width
┌──────────────────────────────────────────────────────────────────┐
│ KPI Strip (5 metrics)                                            │
├──────────────────────────────────────────────────────────────────┤
│ Tab Bar: Ready | Exported | Failed | Retry | Rules               │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Active tab content (full width table or form)                    │
│                                                                  │
│                                                                  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

Tablet (md, 768–1279px) — same layout, table columns condensed
Mobile (<768px) — stacked cards instead of table rows
```

---

## 14. Refresh Behavior

| Component | Interval | Strategy |
|---|---|---|
| KPI strip | 15s | Polling |
| Ready tab | 15s | Polling |
| Exported tab | 30s | Polling |
| Failed tab | 30s | Polling |
| Retry tab | 15s | Polling (time-sensitive) |
| Rules tab | Static | Fetch once on mount |
| Handoff preview drawer | Static | Fetch on open |

If Supabase Realtime is configured on `opportunity_exports`, prefer subscription over polling for Ready, Failed, and Retry tabs.

---

## 15. Integration with Existing V1 Code

### 15.1 What to Reuse

| Component | Status | Notes |
|---|---|---|
| `src/lib/jobnimbus/client.ts` | ✅ Reuse | Full JN client with contact/job/activity CRUD |
| `src/lib/jobnimbus/index.ts` | ✅ Reuse | Barrel export |
| `src/lib/ai/modules/exportSummary.ts` | ✅ Reuse | AI handoff summary generator |
| `src/app/api/ai/export-summary/route.ts` | ✅ Reuse | AI endpoint for summary generation |
| `src/types/dashboard.ts` (`ExportQueueSummary`) | ✅ Reuse | Dashboard widget types |
| `src/components/dashboard/ExportQueueSummary.tsx` | ✅ Reuse | Dashboard widget component |

### 15.2 What to Deprecate

| Component | Action | Reason |
|---|---|---|
| `src/app/api/integrations/jobnimbus/export-lead/route.ts` | Deprecate | Replaced by `POST /api/exports/jobnimbus` with full queue semantics |
| `lead_exports` table | Migrate data → `opportunity_exports` | Legacy V1 export tracking |
| `src/app/(dashboard)/dashboard/jobnimbus/page.tsx` | Remove | Replaced by Exports page + Settings integration panel |

### 15.3 Migration Path

1. Create `opportunity_exports` table (new migration).
2. Backfill existing `lead_exports` rows into `opportunity_exports` with `status = 'exported'`.
3. New exports use `POST /api/exports/jobnimbus` exclusively.
4. V1 `export-lead` endpoint remains functional but returns deprecation header.
5. After 30 days, remove V1 endpoint.

---

## 16. Observability

### 16.1 Metrics to Track

| Metric | Type | Alert Threshold |
|---|---|---|
| `exports.ready_queue_depth` | Gauge | > 20 for > 1 hour |
| `exports.exported_per_hour` | Counter | — |
| `exports.failed_per_hour` | Counter | > 5 in any hour |
| `exports.retry_queue_depth` | Gauge | > 10 |
| `exports.permanently_failed_count` | Counter | Any increment |
| `exports.avg_export_latency_ms` | Histogram | p99 > 10,000ms |
| `exports.jobnimbus_api_error_rate` | Rate | > 10% in 15min window |
| `exports.success_rate_daily` | Gauge | < 90% |

### 16.2 Logging

Every export operation logs to `integration_sync_logs`:

```typescript
{
  integration: "jobnimbus",
  operation: "create_contact" | "create_job" | "create_activity",
  exportId: string,
  requestPayload: object,  // Sanitized (no PII in logs)
  responseStatus: number,
  responseBody: string | null,
  durationMs: number,
  success: boolean,
  errorMessage: string | null,
  timestamp: string,
}
```

### 16.3 Notifications

| Event | Channel | Recipients |
|---|---|---|
| Auto-export completed | In-app toast | User who triggered / system |
| Export failed (retryable) | In-app badge update | — (silent retry) |
| Export permanently failed | In-app alert + email (if configured) | Owner, Manager, Office Admin |
| Export backlog > 10 for > 2h | Exception feed (`export_backlog_growing`) | Team screen viewers |
| JN API key invalid (401) | In-app alert | Owner (who configured integration) |

---

## 17. Security Considerations

| Concern | Mitigation |
|---|---|
| JN API key storage | Encrypted at rest in `user_settings`. Never logged. Never sent to client. |
| PII in export payload | Homeowner name, phone, email stored in `opportunity_exports.payload` (JSONB). RLS ensures only authenticated company users can read. |
| PII in logs | `integration_sync_logs` sanitize request/response bodies — remove `first_name`, `last_name`, `phone`, `email` before logging. |
| Rate limiting | `maxExportsPerHour` setting prevents runaway batch exports. API-level rate limit of 100 requests/minute per user. |
| Duplicate prevention | Before creating JN contact, search by address. If found, link to existing contact instead of creating duplicate. |
| Idempotency | Each export operation uses `exportId` as idempotency key. Re-triggering an `exported` row is a no-op. |

---

## 18. Acceptance Criteria

Before marking Phase 9 (Exports) complete, confirm:

1. `POST /api/exports/jobnimbus` creates a JN contact + job + activity note and transitions export to `exported`.
2. `GET /api/exports` returns exports filtered by status with correct counts.
3. `POST /api/exports/[id]/retry` re-queues a failed export and respects `resetAttempts`.
4. `GET /api/exports/[id]/status` returns full export detail with payload and timeline.
5. `GET /api/exports/[id]/preview` returns handoff summary preview with validation warnings.
6. Export failures auto-transition to `retrying` with exponential backoff (max 3 attempts).
7. Non-retryable errors (400, 401, 404) immediately go to `permanently_failed`.
8. 409 (duplicate) responses search for existing JN contact and mark as `exported`.
9. Dashboard Export Queue Summary widget pulls live data from `opportunity_exports`.
10. Mission Control "SENT TO JN" KPI counts today's successful exports.
11. Mission stops update to `sent_to_jobnimbus` when their export succeeds.
12. Team exception `export_backlog_growing` fires when ready queue > 10 for > 2 hours.
13. Export Rules tab allows Owner to configure auto-export criteria.
14. Handoff Summary Preview drawer shows full payload, AI summary, and validation warnings.
15. All JN API calls are logged to `integration_sync_logs`.
16. All exports are idempotent — re-triggering an exported row is a no-op.
17. Tests cover: payload builder, retry logic, status transitions, API route shapes, duplicate detection.
