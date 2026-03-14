# Stormclose V2 — AI Studio Module Specification

> Canonical reference for every AI module, shared context contract, UI pattern, and cross-surface embedding in AI Studio.
> Derives from: `PRODUCT_CONTRACT_V2.md` §2 (AI-Assisted Sales), §5 (AI Studio), `stormclose-enterprise-architecture.md` §6 (AI Architecture), §5 (Screen Architecture), `stormclose-navigation-design.md` §2–§3 (Sidebar & Roles), `stormclose-dashboard-widgets.md` (Dashboard spec), `stormclose-missions-geolocation.md` §2 (Stop Lifecycle), `stormclose-team-module.md` (Team spec), `stormclose-mission-control.md` (Mission Control spec).
> Builds on: `src/lib/ai.ts` (existing `generateInsuranceReport`, `generateFollowUp`, `generateObjectionResponse`), `src/lib/objection-library.ts` (50+ objection templates), `src/lib/message-sequences.ts` (follow-up sequences), `src/types/missions.ts`, `src/types/dashboard.ts`, `src/types/team.ts`.
> Last updated: 2026-03-14

---

## 1. AI Studio Overview

**Purpose:** AI Studio is a structured AI workbench — not a chatbot. Each module is a specific AI-powered task with structured inputs and structured outputs. AI receives full workflow context (storm data, property intel, mission state, company tone) and produces actionable artifacts (text blocks, bullet lists, document drafts, structured recommendations).

**Route:** `/dashboard/ai-studio`

**Sidebar:** Sixth item, `Sparkles` icon, badge shows `aiSuggestionCount` (integer count when AI has pending recommendations).

**Role visibility:**

| Role | Access |
|---|---|
| Owner | ✅ Full — all 10 modules |
| Manager | ✅ Full — all 10 modules |
| Rep | ⚠️ Partial — Mission Copilot, Objection Response, Negotiation Coach, Follow-Up Writer only |
| Office Admin | ⚠️ Partial — Daily Brief, Opportunity Summary, Export Summary Writer, Storm Zone Summary only |

**Primary action (PageHeader):** "Manage Company Voice" → navigates to Company Voice / Prompt Templates module.

---

## 2. Shared AI Context Contract

Every AI module receives a subset of the `AiContext` object. Modules declare which context keys they require vs. accept as optional. The API assembles the context server-side before invoking the AI provider — the client never sends raw context directly.

```typescript
// src/types/ai-studio.ts

// ── Shared AI Context ────────────────────────────────────────────────────────

export interface AiCompanyProfile {
  /** Company name. */
  companyName: string;
  /** Primary service area cities/counties. */
  serviceArea: string[];
  /** Certifications: GAF Master Elite, Haag, ITEL, etc. */
  certifications: string[];
  /** Years in business. */
  yearsInBusiness: number;
  /** Warranty offering description. */
  warrantyDescription: string;
  /** Insurance carrier experience list. */
  carrierExperience: string[];
  /** Financing availability. */
  financingAvailable: boolean;
  /** Custom value propositions (3-5 bullet points). */
  valuePropositions: string[];
}

export interface AiStormContext {
  /** Storm zone ID. */
  zoneId: string;
  /** Zone display name. */
  zoneName: string;
  /** Zone composite score (0-100). */
  score: number;
  /** Severity tier. */
  severity: "extreme" | "severe" | "moderate" | "minor";
  /** Primary storm event type. */
  eventType: "hail" | "wind" | "tornado" | "mixed";
  /** Max hail size reported (inches). */
  maxHailSizeInches: number | null;
  /** Max wind speed reported (mph). */
  maxWindSpeedMph: number | null;
  /** Days since most recent contributing event. */
  stormAgeDays: number;
  /** Total houses in the zone. */
  houseCount: number;
  /** Unworked houses remaining. */
  unworkedHouseCount: number;
  /** Number of active missions in zone. */
  activeMissionCount: number;
  /** Lat/lng centroid for location reference. */
  centroidLat: number;
  centroidLng: number;
}

export interface AiHouseContext {
  /** Address line. */
  address: string;
  /** City, state, zip. */
  cityStateZip: string;
  /** Opportunity score (0-100). */
  opportunityScore: number;
  /** Score tier. */
  scoreTier: "hot" | "warm" | "moderate" | "cold";
  /** Storm severity at this location. */
  stormSeverity: "extreme" | "severe" | "moderate" | "minor";
  /** Storm age in days. */
  stormAgeDays: number;
  /** Estimated value band. */
  estimatedValueBand: "$5k–$10k" | "$10k–$20k" | "$20k–$40k" | "$40k+" | "Unknown";
  /** Year built. */
  yearBuilt: number | null;
  /** Roof age estimate. */
  roofAge: number | null;
  /** Assessed property value. */
  assessedValue: number | null;
  /** Current stop status (if part of a mission). */
  stopStatus: string | null;
  /** Outcome data from prior attempts. */
  priorAttempts: number;
  /** Homeowner name (if captured). */
  homeownerName: string | null;
  /** Rep notes from field. */
  repNotes: string | null;
}

export interface AiMissionContext {
  /** Mission ID. */
  missionId: string;
  /** Mission name. */
  missionName: string;
  /** Current mission status. */
  status: "planned" | "active" | "paused" | "completed" | "expired";
  /** Storm zone the mission targets. */
  stormZoneName: string | null;
  /** Assigned rep name. */
  assignedRepName: string | null;
  /** Total stops in mission. */
  totalStops: number;
  /** Stops completed so far. */
  stopsCompleted: number;
  /** Stops remaining. */
  stopsRemaining: number;
  /** Completion percentage (0-100). */
  completionPercent: number;
  /** Outcomes today: interested count. */
  interestedCount: number;
  /** Outcomes today: no_answer count. */
  noAnswerCount: number;
  /** Outcomes today: not_interested count. */
  notInterestedCount: number;
  /** Mission started at. */
  startedAt: string | null;
  /** Duration in minutes (if active or completed). */
  durationMinutes: number | null;
}

export interface AiRepContext {
  /** Rep user ID. */
  userId: string;
  /** Rep display name. */
  name: string;
  /** Current field status. */
  fieldStatus: "active" | "idle" | "driving" | "at_door" | "offline" | "paused";
  /** Total doors knocked today. */
  doorsTodayCount: number;
  /** Appointments set today. */
  appointmentsTodayCount: number;
  /** Interested outcomes today. */
  interestedTodayCount: number;
  /** No-answer rate (0-1). */
  noAnswerRate: number;
  /** Average doors per hour. */
  avgDoorsPerHour: number;
  /** Recent outcome sequence (last 10). */
  recentOutcomes: string[];
  /** Active mission name. */
  activeMissionName: string | null;
  /** Days active in current period. */
  daysActive: number;
  /** Lifetime doors knocked. */
  lifetimeDoorsKnocked: number;
  /** Lifetime appointments set. */
  lifetimeAppointmentsSet: number;
}

export interface AiTonePreference {
  /** Overall voice: professional, friendly, consultative, confident, empathetic, urgent. */
  voice: "professional" | "friendly" | "consultative" | "confident" | "empathetic" | "urgent";
  /** Custom system prompt suffix appended to all AI calls. */
  customSystemPromptSuffix: string | null;
  /** Output length preference. */
  lengthPreference: "concise" | "standard" | "detailed";
  /** Whether to include insurance/claim language. */
  includeInsuranceLanguage: boolean;
  /** Whether to include financing mentions. */
  includeFinancingLanguage: boolean;
  /** Banned words/phrases the company never uses. */
  bannedPhrases: string[];
}

export type AiOutputFormat = "text" | "markdown" | "html" | "json" | "pdf_draft";

/**
 * The master context object. Each AI module declares which
 * keys it requires (must be present) vs. optional (enriches output).
 * The API handler assembles this server-side.
 */
export interface AiContext {
  companyProfile: AiCompanyProfile;
  stormContext: AiStormContext | null;
  houseContext: AiHouseContext | null;
  missionContext: AiMissionContext | null;
  repContext: AiRepContext | null;
  tonePreference: AiTonePreference;
  outputFormat: AiOutputFormat;
  /** Free-text notes the user adds before generation. */
  userNotes: string | null;
}
```

### 2.1 Context Assembly Rules

| Rule | Detail |
|---|---|
| **Server-side only** | The client sends identifiers (`stormZoneId`, `missionId`, `houseId`, `repId`). The API handler fetches the full context from DB/services. No raw context crosses the network from client. |
| **Company profile cached** | `AiCompanyProfile` is loaded from `company_ai_profiles` table, cached per company per hour. |
| **Tone preference inherited** | If the user has not customized tone, inherit from `company_ai_profiles.default_tone`. |
| **Null = not applicable** | If a module doesn't need storm context (e.g., Rep Coaching), `stormContext` is `null`. The AI prompt adapter skips null sections. |
| **Token budget** | Each module defines a `maxOutputTokens` limit. The prompt builder includes a hard instruction: "Your response must not exceed N tokens." |

### 2.2 Context-to-Module Matrix

| Module | companyProfile | stormContext | houseContext | missionContext | repContext | tonePreference |
|---|---|---|---|---|---|---|
| Daily Brief Generator | Required | Optional | — | Optional | — | Required |
| Mission Copilot | Required | Required | Required | Required | Optional | Required |
| Opportunity Summary Generator | Required | Required | Required | Optional | Optional | Required |
| Objection Response Assistant | Required | Optional | Optional | Optional | — | Required |
| Negotiation Coach | Required | Optional | Required | Optional | — | Required |
| Follow-Up Writer | Required | Optional | Required | Optional | — | Required |
| Export Summary Writer | Required | Required | Required | Required | Optional | Required |
| Rep Coaching Insights | Required | — | — | Optional | Required | Required |
| Storm Zone Summary | Required | Required | — | Optional | — | Required |
| Company Voice / Prompt Templates | Required | — | — | — | — | Required |

---

## 3. AI Studio Hub Page

**Route:** `/dashboard/ai-studio`

**Layout:** Module grid — each module is a card. Cards are organized in a 3-column grid (desktop), 2-column (tablet), 1-column (mobile).

```typescript
// src/types/ai-studio.ts (continued)

export type AiModuleId =
  | "daily-brief"
  | "mission-copilot"
  | "opportunity-summary"
  | "objection-response"
  | "negotiation-coach"
  | "follow-up-writer"
  | "export-summary"
  | "rep-coaching"
  | "storm-zone-summary"
  | "company-voice";

export interface AiModuleCard {
  id: AiModuleId;
  label: string;
  description: string;
  icon: string; // Lucide icon name
  route: string;
  /** Roles allowed to access this module. */
  allowedRoles: Array<"owner" | "manager" | "rep" | "office_admin">;
  /** Whether the module has a pending AI suggestion. */
  hasSuggestion: boolean;
  /** Last generated timestamp (if applicable). */
  lastGeneratedAt: string | null;
  /** Category for visual grouping. */
  category: "operations" | "field" | "communication" | "admin";
}
```

### 3.1 Hub Card Grid

```
Desktop (xl, ≥1280px) — 3 columns, 4 rows
┌────────────────────┬────────────────────┬────────────────────┐
│ Daily Brief        │ Mission Copilot    │ Opportunity        │
│ Generator          │                    │ Summary            │
├────────────────────┼────────────────────┼────────────────────┤
│ Objection Response │ Negotiation Coach  │ Follow-Up Writer   │
├────────────────────┼────────────────────┼────────────────────┤
│ Export Summary     │ Rep Coaching       │ Storm Zone Summary │
│ Writer             │ Insights           │                    │
├────────────────────┼────────────────────┼────────────────────┤
│ Company Voice /    │                    │                    │
│ Prompt Templates   │                    │                    │
└────────────────────┴────────────────────┴────────────────────┘
```

Each card shows:
- Module icon (Lucide, `text-storm-purple`)
- Module name (bold)
- One-line description
- Category badge (operations / field / communication / admin)
- "Last generated: 2h ago" or "Never used" timestamp
- "Open →" action

Cards the current user's role cannot access are **not rendered** (hidden, not disabled).

---

## 4. Module Specifications

---

### Module 1: Daily Brief Generator

**Route:** `/dashboard/ai-studio/daily-brief`

**API:** `POST /api/ai/daily-brief`

**Purpose:** Generate a morning operations summary for the team. Covers storm activity, house ranking changes, mission status, team coverage, export throughput.

#### 4.1.1 Input Context

| Field | Source | Required |
|---|---|---|
| `companyProfile` | `company_ai_profiles` table | ✅ |
| `stormContext` | Latest active storm zones (top 5 by score) | Optional — enriches if zones exist |
| `missionContext` | Aggregate: active/completed/planned counts for today | Optional |
| `tonePreference` | Company default or user override | ✅ |
| `userNotes` | Free-text "focus areas" input | Optional |

#### 4.1.2 Additional Structured Inputs (Server-Side Aggregation)

```typescript
export interface DailyBriefInput {
  /** Date for the brief (default: today). */
  briefDate: string; // ISO date
  /** Optional focus areas from user. */
  focusAreas: string | null;
  /** Whether to force regeneration (ignore cache). */
  force: boolean;
}

export interface DailyBriefAggregatedData {
  newStormZones24h: number;
  activeStormZones: Array<{ name: string; score: number; severity: string; houseCount: number }>;
  housesRankedToday: number;
  avgOpportunityScore: number;
  missionsActive: number;
  missionsCompletedToday: number;
  missionCompletionRate: number;
  repsInField: number;
  totalReps: number;
  teamCoveragePercent: number;
  exportsToday: number;
  exportSuccessRate: number;
  topPerformingRep: { name: string; doorsKnocked: number; interested: number } | null;
  openExceptions: number;
}
```

#### 4.1.3 Output

```typescript
export interface DailyBriefOutput {
  /** Pre-rendered markdown summary (2-4 paragraphs). */
  summary: string;
  /** Highlight bullets with category and link. */
  highlights: Array<{
    category: "storm" | "mission" | "team" | "export" | "opportunity";
    text: string;
    href: string | null;
  }>;
  /** ISO timestamp of generation. */
  generatedAt: string;
  /** Model used. */
  model: string;
  /** Token count consumed. */
  tokenCount: number;
}
```

**Output type:** Markdown text block + structured highlight bullets.

#### 4.1.4 UI Pattern

**Card with single-click generate.**

1. Top section: Date picker (defaults to today) + "Focus Areas" textarea (optional, 2 lines).
2. "Generate Brief" button (primary, `bg-storm-purple`). Shows spinner during generation.
3. If cached brief exists for today: show it immediately with "Regenerate" secondary button.
4. Output renders as styled markdown in a `Card` below the form.
5. Actions on output: Copy to clipboard, Download as PDF, Share (future).

#### 4.1.5 Role Visibility

| Role | Access |
|---|---|
| Owner | ✅ Full — cross-branch aggregation |
| Manager | ✅ Full — own branch only |
| Rep | ❌ Not visible in AI Studio (gets scoped brief on Dashboard) |
| Office Admin | ✅ Read-only — same data as Manager |

#### 4.1.6 Cross-Surface Appearances

| Surface | Behavior |
|---|---|
| Dashboard → AI Daily Brief widget | Renders the same cached output. "Regenerate" button calls `POST /api/ai/daily-brief?force=true`. |
| Mission Control → AI Ops Insight | Extracts `highlights` array and shows as rotating insight panel. |

#### 4.1.7 Cache Rules

- Cached per user per calendar day (UTC).
- `GET /api/dashboard/ai-brief` returns cached version. `POST /api/ai/daily-brief` generates fresh.
- Stale indicator: if `generatedAt` > 12 hours old, show amber "Stale" badge.

#### 4.1.8 Token Budget

- `maxOutputTokens: 1500`
- System prompt: ~800 tokens
- Context payload: ~500 tokens
- Total budget: ~2800 tokens per call

---

### Module 2: Mission Copilot

**Route:** `/dashboard/ai-studio/mission-copilot`

**API:** `POST /api/ai/mission-copilot`

**Purpose:** Real-time AI suggestions during an active mission. Provides next-stop recommendations, talking point preparation, objection pre-emption, and pace analysis.

#### 4.2.1 Input Context

| Field | Source | Required |
|---|---|---|
| `companyProfile` | `company_ai_profiles` | ✅ |
| `stormContext` | Storm zone the mission targets | ✅ |
| `houseContext` | Current stop or next targeted stop | ✅ |
| `missionContext` | Active mission state (progress, outcomes so far) | ✅ |
| `repContext` | Current rep field stats (pace, outcomes) | Optional |
| `tonePreference` | Company tone | ✅ |

#### 4.2.2 Additional Structured Inputs

```typescript
export type CopilotSuggestionType =
  | "next_stop_prep"      // Pre-load context for the upcoming stop
  | "pace_check"          // Analyze current pace vs. target
  | "reroute_suggestion"  // Suggest route adjustment
  | "talking_points"      // Property-specific talking points
  | "zone_summary";       // Quick summary of remaining zone opportunity

export interface MissionCopilotInput {
  /** What kind of suggestion the rep wants. */
  suggestionType: CopilotSuggestionType;
  /** Active mission ID. */
  missionId: string;
  /** Current stop ID (if at a stop). */
  currentStopId: string | null;
  /** Free-text question from rep. */
  repQuestion: string | null;
}
```

#### 4.2.3 Output

```typescript
export interface MissionCopilotOutput {
  /** Suggestion type echoed back. */
  suggestionType: CopilotSuggestionType;
  /** Primary suggestion text (markdown). */
  suggestion: string;
  /** Structured talking points (for next_stop_prep). */
  talkingPoints: string[] | null;
  /** Pace analysis (for pace_check). */
  paceAnalysis: {
    currentDoorsPerHour: number;
    targetDoorsPerHour: number;
    projectedCompletion: string; // ISO time
    suggestion: string;
  } | null;
  /** Reroute data (for reroute_suggestion). */
  rerouteSuggestion: {
    reason: string;
    suggestedNextStopId: string;
    suggestedNextStopAddress: string;
    estimatedTimeSavedMinutes: number;
  } | null;
  generatedAt: string;
  model: string;
  tokenCount: number;
}
```

**Output type:** Structured JSON with markdown text blocks per section.

#### 4.2.4 UI Pattern

**Contextual action card — appears inline during active mission.**

When accessed from AI Studio hub: shows a mission selector dropdown, then the suggestion type selector, then results.

When accessed from active mission view: appears as a floating action button (FAB) → opens a bottom sheet with suggestion type pills → shows result inline.

1. Suggestion type selector: 5 pill buttons at top.
2. If `next_stop_prep` or `talking_points`: auto-populates from active mission + current stop.
3. "Ask Copilot" button generates. Result renders below.
4. Optional: rep can type a free-text question ("What should I say about the insurance claim process?").

#### 4.2.5 Role Visibility

| Role | Access |
|---|---|
| Owner | ✅ Full |
| Manager | ✅ Full |
| Rep | ✅ Full — primary user of this module |
| Office Admin | ❌ Not visible |

#### 4.2.6 Cross-Surface Appearances

| Surface | Behavior |
|---|---|
| Missions → Active Mission view | FAB "AI Copilot" → opens bottom sheet with `next_stop_prep` auto-selected. |
| Missions → Mission Detail → Stop row action | "AI Prep" button → opens copilot with `talking_points` for that stop. |
| Dashboard → Houses To Hit Today → row action "AI Assist" | Opens copilot with `talking_points` pre-filled for that house. |

#### 4.2.7 Token Budget

- `maxOutputTokens: 800`
- Latency target: < 3 seconds (use streaming for longer outputs).
- System prompt: ~600 tokens
- Total budget: ~1800 tokens per call

---

### Module 3: Opportunity Summary Generator

**Route:** `/dashboard/ai-studio/opportunity-summary`

**API:** `POST /api/ai/opportunity-summary`

**Purpose:** Generate a comprehensive writeup for a qualified opportunity — used for internal handoff, document generation, or export attachment.

#### 4.3.1 Input Context

| Field | Source | Required |
|---|---|---|
| `companyProfile` | `company_ai_profiles` | ✅ |
| `stormContext` | Storm zone the house is in | ✅ |
| `houseContext` | Full property detail + outcome data | ✅ |
| `missionContext` | Mission the opportunity came from | Optional |
| `repContext` | Rep who qualified the opportunity | Optional |
| `tonePreference` | Company tone | ✅ |

#### 4.3.2 Additional Structured Inputs

```typescript
export interface OpportunitySummaryInput {
  /** House / target ID. */
  houseId: string;
  /** Whether to include insurance claim context. */
  includeInsuranceContext: boolean;
  /** Whether to include storm damage evidence. */
  includeStormEvidence: boolean;
  /** Custom sections to include. */
  customSections: string[];
  /** Output format preference. */
  outputFormat: "markdown" | "html" | "pdf_draft";
}
```

#### 4.3.3 Output

```typescript
export interface OpportunitySummaryOutput {
  /** Full opportunity writeup (markdown or HTML). */
  content: string;
  /** Structured sections for programmatic use. */
  sections: Array<{
    heading: string;
    body: string;
  }>;
  /** Key metrics extracted. */
  keyMetrics: {
    estimatedValue: string;
    stormSeverity: string;
    roofAge: string;
    interestLevel: string;
  };
  generatedAt: string;
  model: string;
  tokenCount: number;
}
```

**Output type:** Markdown or HTML document draft with structured sections.

#### 4.3.4 UI Pattern

**Card with form → generate.**

1. House selector (searchable dropdown, pre-populated if launched from context).
2. Toggles: "Include Insurance Context", "Include Storm Evidence".
3. Optional: custom section names (tags input).
4. Output format selector: Markdown / HTML / PDF Draft.
5. "Generate Summary" button.
6. Result renders as styled document preview with section headings.
7. Actions: Copy, Download as PDF, Attach to Export, Send to Documents.

#### 4.3.5 Role Visibility

| Role | Access |
|---|---|
| Owner | ✅ Full |
| Manager | ✅ Full |
| Rep | ❌ Not visible (reps don't generate summaries) |
| Office Admin | ✅ Full — primary user for export prep |

#### 4.3.6 Cross-Surface Appearances

| Surface | Behavior |
|---|---|
| Exports → Ready To Export Queue → row action "Generate Summary" | Opens this module with house pre-selected. |
| Houses → House Detail drawer → "Generate Summary" button | Opens this module with house pre-selected. |
| Missions → Stop detail → "Opportunity Summary" action | Opens with house + mission context pre-filled. |

#### 4.3.7 Token Budget

- `maxOutputTokens: 2000`
- System prompt: ~600 tokens
- Total budget: ~3200 tokens per call

---

### Module 4: Objection Response Assistant

**Route:** `/dashboard/ai-studio/objection-response`

**API:** `POST /api/ai/objection-response`

**Purpose:** Generate contextual, field-ready responses to homeowner objections. Uses the LAER framework (Listen → Acknowledge → Explore → Respond) and the 50+ objection template library.

#### 4.4.1 Input Context

| Field | Source | Required |
|---|---|---|
| `companyProfile` | `company_ai_profiles` | ✅ |
| `stormContext` | Storm zone (if available) | Optional |
| `houseContext` | Current property (if at a stop) | Optional |
| `missionContext` | Active mission (if in field) | Optional |
| `tonePreference` | Company tone | ✅ |

#### 4.4.2 Additional Structured Inputs

```typescript
export interface ObjectionResponseInput {
  /** The objection text (free-text from rep or selected from library). */
  objection: string;
  /** Objection category (from library or auto-detected). */
  category: "price" | "trust" | "timing" | "process" | "competition" | "insurance" | "decision" | null;
  /** Template ID if selected from objection library. */
  templateId: string | null;
  /** Homeowner name (if known). */
  homeownerName: string | null;
  /** Project type context. */
  projectType: string;
  /** Key benefits to leverage. */
  keyBenefits: string[];
  /** Evidence points available. */
  evidencePoints: string[];
  /** Response tone override. */
  tone: "consultative" | "confident" | "empathetic";
}
```

#### 4.4.3 Output

```typescript
export interface ObjectionResponseOutput {
  /** Full LAER-structured response. */
  response: string;
  /** LAER breakdown for learning. */
  framework: {
    listen: string;
    acknowledge: string;
    explore: string;
    respond: string;
  };
  /** Alternative shorter version (for texting). */
  shortVersion: string;
  /** Suggested follow-up question. */
  followUpQuestion: string;
  /** Related objections from library. */
  relatedObjectionIds: string[];
  generatedAt: string;
  model: string;
  tokenCount: number;
}
```

**Output type:** Structured text with LAER framework breakdown.

#### 4.4.4 UI Pattern

**Dual-mode: Library browse + AI generate.**

1. **Library mode (default):** Browse 50+ objection templates by category (7 category tabs). Each template shows: objection text, short title, suggested tone, key insights, suggested response. Click "Customize with AI" to generate a context-aware version.
2. **Custom mode:** Free-text objection input + tone selector + key benefits tags. "Generate Response" button.
3. Output: LAER framework card (4 colored sections: Listen/blue, Acknowledge/green, Explore/amber, Respond/purple).
4. Below: "Short Version (for texting)" collapsible.
5. Actions: Copy full, Copy short, Save to Favorites, Share with Team.

#### 4.4.5 Role Visibility

| Role | Access |
|---|---|
| Owner | ✅ Full |
| Manager | ✅ Full |
| Rep | ✅ Full — primary user |
| Office Admin | ❌ Not visible |

#### 4.4.6 Cross-Surface Appearances

| Surface | Behavior |
|---|---|
| Missions → Active Mission → Stop outcome "Not Interested" | Auto-suggests: "Need help with an objection?" → opens this module with house context. |
| Missions → Stop detail → "AI Assist" action | Opens with `talking_points` context from copilot, but in objection mode. |
| Dashboard → Houses To Hit Today → row action "AI Assist" | Opens this module with house context pre-filled. |

#### 4.4.7 Token Budget

- `maxOutputTokens: 600`
- System prompt: ~1200 tokens (includes LAER framework + examples)
- Total budget: ~2200 tokens per call

---

### Module 5: Negotiation Coach

**Route:** `/dashboard/ai-studio/negotiation-coach`

**API:** `POST /api/ai/negotiation-coach`

**Purpose:** Provide pricing, scope, and insurance negotiation guidance tailored to the specific property and situation. Not a price calculator — a strategic advisor.

#### 4.5.1 Input Context

| Field | Source | Required |
|---|---|---|
| `companyProfile` | `company_ai_profiles` | ✅ |
| `stormContext` | Storm zone severity + age | Optional |
| `houseContext` | Property details, assessed value, storm damage | ✅ |
| `missionContext` | Mission context for outcome patterns | Optional |
| `tonePreference` | Company tone | ✅ |

#### 4.5.2 Additional Structured Inputs

```typescript
export type NegotiationScenario =
  | "initial_pricing"         // First pricing discussion
  | "competitor_comparison"   // Homeowner has other quotes
  | "insurance_supplement"    // Fighting for full scope coverage
  | "scope_reduction"         // Homeowner wants to reduce scope
  | "payment_terms"           // Financing/payment discussion
  | "adjuster_meeting"        // Preparing for adjuster meeting
  | "custom";                 // Free-form scenario

export interface NegotiationCoachInput {
  /** Negotiation scenario type. */
  scenario: NegotiationScenario;
  /** House ID for context lookup. */
  houseId: string | null;
  /** Custom situation description. */
  situationDescription: string;
  /** Homeowner's stated concern. */
  homeownerConcern: string | null;
  /** Competitor quote amount (if applicable). */
  competitorQuote: number | null;
  /** Our quote amount (if applicable). */
  ourQuote: number | null;
  /** Insurance claim amount (if applicable). */
  insuranceClaimAmount: number | null;
}
```

#### 4.5.3 Output

```typescript
export interface NegotiationCoachOutput {
  /** Strategic advice (markdown). */
  strategy: string;
  /** Key talking points (ordered by priority). */
  talkingPoints: string[];
  /** What NOT to say. */
  avoidSaying: string[];
  /** Anchor pricing guidance (if applicable). */
  pricingGuidance: {
    suggestedAnchorPrice: string | null;
    justification: string;
    concessionLadder: string[]; // ordered concession steps
  } | null;
  /** Insurance-specific guidance (if applicable). */
  insuranceGuidance: {
    supplementItems: string[];
    adjustorTips: string[];
    codeReferences: string[];
  } | null;
  /** Closing technique recommendation. */
  closingTechnique: {
    name: string;
    script: string;
  };
  generatedAt: string;
  model: string;
  tokenCount: number;
}
```

**Output type:** Structured strategy document with talking points, pricing guidance, and closing scripts.

#### 4.5.4 UI Pattern

**Wizard: scenario selection → context form → generate.**

1. **Step 1:** Scenario selector (6 scenario cards + "Custom").
2. **Step 2:** Context form (adapts per scenario):
   - `competitor_comparison`: competitor quote input, our quote input, key differentiators
   - `insurance_supplement`: claim amount, denied items, code references
   - `initial_pricing`: property value, estimated scope, homeowner concerns
3. **Step 3:** "Get Coaching" button → results.
4. Output renders as tabbed card: Strategy | Talking Points | Pricing | Insurance | Closing.

#### 4.5.5 Role Visibility

| Role | Access |
|---|---|
| Owner | ✅ Full |
| Manager | ✅ Full |
| Rep | ✅ Full — primary user |
| Office Admin | ❌ Not visible |

#### 4.5.6 Cross-Surface Appearances

| Surface | Behavior |
|---|---|
| Missions → Stop outcome "Interested" | Suggests: "Prepare for negotiation?" → opens this module with house context. |
| Houses → House Detail drawer → "Negotiation Prep" action | Opens with house context pre-filled. |

#### 4.5.7 Token Budget

- `maxOutputTokens: 1200`
- System prompt: ~1000 tokens
- Total budget: ~2800 tokens per call

---

### Module 6: Follow-Up Writer

**Route:** `/dashboard/ai-studio/follow-up-writer`

**API:** `POST /api/ai/follow-up`

**Purpose:** Draft follow-up messages (text, email) for homeowners after field visits. Uses AIDA framework and multi-touch sequence templates.

#### 4.6.1 Input Context

| Field | Source | Required |
|---|---|---|
| `companyProfile` | `company_ai_profiles` | ✅ |
| `stormContext` | Storm zone for urgency/deadline references | Optional |
| `houseContext` | Property + outcome + homeowner info | ✅ |
| `missionContext` | Mission context for visit details | Optional |
| `tonePreference` | Company tone | ✅ |

#### 4.6.2 Additional Structured Inputs

```typescript
export type FollowUpChannel = "text" | "email" | "voicemail_script";
export type FollowUpSituation =
  | "post_inspection"
  | "waiting_insurance"
  | "quote_sent"
  | "ghosted"
  | "post_work"
  | "referral_request"
  | "no_answer_followup"
  | "custom";

export interface FollowUpWriterInput {
  /** Follow-up situation type. */
  situation: FollowUpSituation;
  /** Channel for the message. */
  channel: FollowUpChannel;
  /** House ID for context. */
  houseId: string | null;
  /** Homeowner name. */
  homeownerName: string;
  /** Last interaction summary. */
  lastInteraction: string;
  /** Desired next action. */
  desiredNextAction: string;
  /** Days since last contact. */
  daysSinceLastContact: number;
  /** Touch number in sequence (1st, 2nd, 3rd, etc.). */
  touchNumber: number;
  /** Custom instructions. */
  customInstructions: string | null;
}
```

#### 4.6.3 Output

```typescript
export interface FollowUpWriterOutput {
  /** The drafted message. */
  message: string;
  /** Subject line (email only). */
  subjectLine: string | null;
  /** Channel the message was drafted for. */
  channel: FollowUpChannel;
  /** Word count. */
  wordCount: number;
  /** Suggested send time (based on situation). */
  suggestedSendTime: string;
  /** Next touch suggestion. */
  nextTouchSuggestion: {
    day: number;
    channel: FollowUpChannel;
    purpose: string;
  } | null;
  /** Alternative version (different tone). */
  alternativeVersion: string;
  generatedAt: string;
  model: string;
  tokenCount: number;
}
```

**Output type:** Text message or email draft + suggested next touch.

#### 4.6.4 UI Pattern

**Card with form → generate.**

1. Situation selector: 8 situation buttons (visual pills).
2. Channel selector: Text | Email | Voicemail Script (radio group).
3. Form fields: Homeowner name, last interaction (textarea), desired next action (dropdown or free text), days since last contact (number).
4. Optional: sequence position (touch 1, 2, 3…).
5. "Draft Message" button.
6. Output: styled message card with subject line (email) or text bubble (text).
7. Actions: Copy, Send (future integration), Save Draft, Generate Alternative.
8. Below output: "Suggested next touch" card with timing recommendation.

#### 4.6.5 Role Visibility

| Role | Access |
|---|---|
| Owner | ✅ Full |
| Manager | ✅ Full |
| Rep | ✅ Full — primary user |
| Office Admin | ❌ Not visible |

#### 4.6.6 Cross-Surface Appearances

| Surface | Behavior |
|---|---|
| Missions → Stop outcome "No Answer" or "Interested" | Suggests: "Draft a follow-up?" → opens this module with house + outcome context. |
| Dashboard → Follow-Up Queue (future) | "Write Follow-Up" action on each row. |
| Houses → House Detail drawer → "Follow Up" action | Opens with house context pre-filled. |

#### 4.6.7 Token Budget

- `maxOutputTokens: 500`
- System prompt: ~800 tokens (includes AIDA framework + examples)
- Total budget: ~1600 tokens per call

---

### Module 7: Export Summary Writer

**Route:** `/dashboard/ai-studio/export-summary`

**API:** `POST /api/ai/export-summary`

**Purpose:** Generate a structured handoff summary that accompanies a qualified opportunity when exported to JobNimbus. Ensures every export includes complete context.

#### 4.7.1 Input Context

| Field | Source | Required |
|---|---|---|
| `companyProfile` | `company_ai_profiles` | ✅ |
| `stormContext` | Storm zone details | ✅ |
| `houseContext` | Full property + outcome + homeowner data | ✅ |
| `missionContext` | Mission the lead came from | ✅ |
| `repContext` | Rep who qualified the opportunity | Optional |
| `tonePreference` | Company tone | ✅ |

#### 4.7.2 Additional Structured Inputs

```typescript
export interface ExportSummaryInput {
  /** House ID. */
  houseId: string;
  /** Export ID (if already queued). */
  exportId: string | null;
  /** Whether to include full storm evidence. */
  includeStormEvidence: boolean;
  /** Whether to include visit timeline. */
  includeVisitTimeline: boolean;
  /** Custom notes to include in summary. */
  customNotes: string | null;
}
```

#### 4.7.3 Output

```typescript
export interface ExportSummaryOutput {
  /** Full handoff summary (plain text for CRM note field). */
  summary: string;
  /** Structured fields for CRM mapping. */
  crmFields: {
    contactName: string;
    contactPhone: string | null;
    contactEmail: string | null;
    propertyAddress: string;
    leadSource: string; // "Stormclose AI"
    estimatedValue: string;
    stormEvent: string;
    damageType: string;
    interestLevel: "high" | "medium" | "low";
    nextAction: string;
    appointmentDate: string | null;
  };
  /** Visit timeline entries. */
  visitTimeline: Array<{
    timestamp: string;
    action: string;
    outcome: string;
  }>;
  generatedAt: string;
  model: string;
  tokenCount: number;
}
```

**Output type:** Plain text summary + structured CRM fields + visit timeline.

#### 4.7.4 UI Pattern

**Single-click generate from export queue.**

When accessed from AI Studio hub:
1. House selector (searchable, filtered to houses with `status = "interested"` or `"sent_to_jobnimbus"`).
2. Toggles: "Include Storm Evidence", "Include Visit Timeline".
3. "Generate Export Summary" button.
4. Output: Two-pane view — left: formatted summary, right: CRM field mapping preview.

When accessed from Exports screen:
1. Pre-filled with all context. Single "Generate" button.
2. Output auto-attaches to the export record.

#### 4.7.5 Role Visibility

| Role | Access |
|---|---|
| Owner | ✅ Full |
| Manager | ✅ Full |
| Rep | ❌ Not visible |
| Office Admin | ✅ Full — primary user for export prep |

#### 4.7.6 Cross-Surface Appearances

| Surface | Behavior |
|---|---|
| Exports → Ready To Export Queue → row action "Generate Summary" | Opens with house pre-selected, auto-generates. |
| Exports → Export Detail drawer → "Regenerate Summary" | Re-generates and replaces the attached summary. |
| Missions → Stop outcome "Interested" → "Prepare for Export" | Opens with full context chain (storm → mission → house → outcome). |

#### 4.7.7 Token Budget

- `maxOutputTokens: 1000`
- System prompt: ~500 tokens
- Total budget: ~2000 tokens per call

---

### Module 8: Rep Coaching Insights

**Route:** `/dashboard/ai-studio/rep-coaching`

**API:** `POST /api/ai/rep-coaching`

**Purpose:** Analyze a rep's performance patterns and generate coaching recommendations. Identifies strengths, weaknesses, and specific improvement actions.

#### 4.8.1 Input Context

| Field | Source | Required |
|---|---|---|
| `companyProfile` | `company_ai_profiles` | ✅ |
| `repContext` | Full rep performance data (30-day window) | ✅ |
| `missionContext` | Recent missions (last 10) | Optional |
| `tonePreference` | Company tone | ✅ |

#### 4.8.2 Additional Structured Inputs

```typescript
export type CoachingTimeframe = "today" | "7d" | "30d" | "90d";

export interface RepCoachingInput {
  /** Rep user ID. */
  repId: string;
  /** Analysis timeframe. */
  timeframe: CoachingTimeframe;
  /** Specific area to focus on (optional). */
  focusArea: "pace" | "conversion" | "objection_handling" | "route_efficiency" | "general" | null;
}

export interface RepCoachingAggregatedData {
  /** Performance metrics for the timeframe. */
  metrics: {
    totalDoors: number;
    totalAppointments: number;
    conversionRate: number; // appointments / doors
    avgDoorsPerHour: number;
    avgDoorsPerDay: number;
    noAnswerRate: number;
    notInterestedRate: number;
    followUpRate: number;
    missionsCompleted: number;
    missionCompletionRate: number;
    avgMissionDurationMinutes: number;
    routeEfficiencyPercent: number; // (optimal distance / actual distance)
  };
  /** Daily breakdown for trend analysis. */
  dailyBreakdown: Array<{
    date: string;
    doors: number;
    appointments: number;
    conversionRate: number;
  }>;
  /** Outcome distribution. */
  outcomeDistribution: Record<string, number>;
  /** Common objections encountered (from notes). */
  commonObjections: string[];
  /** Team average for comparison. */
  teamAverage: {
    avgDoorsPerHour: number;
    conversionRate: number;
    noAnswerRate: number;
  };
}
```

#### 4.8.3 Output

```typescript
export interface RepCoachingOutput {
  /** Executive summary (2-3 sentences). */
  executiveSummary: string;
  /** Strengths identified. */
  strengths: Array<{
    area: string;
    observation: string;
    metric: string;
  }>;
  /** Areas for improvement. */
  improvements: Array<{
    area: string;
    observation: string;
    metric: string;
    actionItem: string;
  }>;
  /** Specific coaching actions (ordered by priority). */
  coachingActions: Array<{
    priority: 1 | 2 | 3;
    action: string;
    expectedImpact: string;
    timeToImplement: string;
  }>;
  /** Comparison to team average. */
  teamComparison: {
    aboveAverage: string[];
    belowAverage: string[];
  };
  /** Trend direction. */
  trend: "improving" | "stable" | "declining";
  generatedAt: string;
  model: string;
  tokenCount: number;
}
```

**Output type:** Structured coaching report with prioritized action items.

#### 4.8.4 UI Pattern

**Card with selector → generate.**

1. Rep selector dropdown (managers/owners see all their reps).
2. Timeframe selector: Today | 7 Days | 30 Days | 90 Days.
3. Optional focus area: Pace | Conversion | Objection Handling | Route Efficiency | General.
4. "Analyze Performance" button.
5. Output renders as multi-section card:
   - Executive Summary (top, highlighted)
   - Strengths (green left border)
   - Improvements (amber left border)
   - Coaching Actions (numbered, purple)
   - Team Comparison (bar chart or simple comparison)
   - Trend indicator (arrow up/flat/down)

#### 4.8.5 Role Visibility

| Role | Access |
|---|---|
| Owner | ✅ Full — all reps across branches |
| Manager | ✅ Full — own branch reps |
| Rep | ❌ Not visible (reps don't self-coach via AI Studio) |
| Office Admin | ❌ Not visible |

#### 4.8.6 Cross-Surface Appearances

| Surface | Behavior |
|---|---|
| Team → Rep Detail drawer → "AI Coaching" button | Opens with rep pre-selected, 7d timeframe default. |
| Team → Rep Leaderboard → rep row action "Coaching Insights" | Opens with rep pre-selected. |

#### 4.8.7 Token Budget

- `maxOutputTokens: 1500`
- System prompt: ~600 tokens
- Total budget: ~2800 tokens per call

---

### Module 9: Storm Zone Summary

**Route:** `/dashboard/ai-studio/storm-zone-summary`

**API:** `POST /api/ai/storm-zone-summary`

**Purpose:** Generate a narrative summary of a storm zone's opportunity — for internal use, manager briefing, or document generation.

#### 4.9.1 Input Context

| Field | Source | Required |
|---|---|---|
| `companyProfile` | `company_ai_profiles` | ✅ |
| `stormContext` | Full storm zone data | ✅ |
| `missionContext` | Missions targeting this zone | Optional |
| `tonePreference` | Company tone | ✅ |

#### 4.9.2 Additional Structured Inputs

```typescript
export interface StormZoneSummaryInput {
  /** Storm zone ID. */
  stormZoneId: string;
  /** Include competitive landscape estimate. */
  includeCompetitiveLandscape: boolean;
  /** Include revenue projection. */
  includeRevenueProjection: boolean;
  /** Include deployment recommendation. */
  includeDeploymentRecommendation: boolean;
  /** Target audience. */
  audience: "manager" | "owner" | "team_meeting" | "document";
}

export interface StormZoneSummaryAggregatedData {
  zone: {
    name: string;
    score: number;
    severity: string;
    eventType: string;
    maxHailSizeInches: number | null;
    maxWindSpeedMph: number | null;
    stormAgeDays: number;
    houseCount: number;
    unworkedHouseCount: number;
    avgOpportunityScore: number;
    topScoringHouses: Array<{ address: string; score: number; estimatedValue: string }>;
  };
  missions: Array<{
    name: string;
    status: string;
    stopsTotal: number;
    stopsCompleted: number;
    interestedCount: number;
  }>;
  revenueEstimate: {
    avgContractValue: number;
    estimatedQualifiedPercent: number;
    projectedRevenue: number;
  } | null;
}
```

#### 4.9.3 Output

```typescript
export interface StormZoneSummaryOutput {
  /** Narrative summary (markdown, 3-5 paragraphs). */
  narrative: string;
  /** Key stats callouts. */
  keyStats: Array<{
    label: string;
    value: string;
    context: string;
  }>;
  /** Deployment recommendation (if requested). */
  deploymentRecommendation: {
    suggestedTeamSize: number;
    estimatedDays: number;
    priorityAreas: string[];
    reasoning: string;
  } | null;
  /** Revenue projection (if requested). */
  revenueProjection: {
    lowEstimate: number;
    midEstimate: number;
    highEstimate: number;
    assumptions: string[];
  } | null;
  /** Urgency score (0-100). */
  urgencyScore: number;
  /** Urgency rationale. */
  urgencyRationale: string;
  generatedAt: string;
  model: string;
  tokenCount: number;
}
```

**Output type:** Narrative markdown + structured key stats + optional deployment/revenue projections.

#### 4.9.4 UI Pattern

**Card with form → generate.**

1. Storm zone selector (searchable dropdown, sorted by score desc).
2. Audience selector: Manager | Owner | Team Meeting | Document.
3. Toggles: "Include Competitive Landscape", "Include Revenue Projection", "Include Deployment Recommendation".
4. "Generate Summary" button.
5. Output: Styled narrative card with key stats badges at top.
6. If deployment recommendation included: separate card below with team size, timeline, priority areas.
7. If revenue projection included: range bar visualization (low/mid/high).
8. Actions: Copy, Download PDF, Share to Team, Create Mission from Recommendation.

#### 4.9.5 Role Visibility

| Role | Access |
|---|---|
| Owner | ✅ Full |
| Manager | ✅ Full — own branch zones |
| Rep | ❌ Not visible |
| Office Admin | ✅ Read-only |

#### 4.9.6 Cross-Surface Appearances

| Surface | Behavior |
|---|---|
| Storms → Storm Zone card → "AI Summary" action | Opens with zone pre-selected. |
| Storms → Storm Detail drawer → "Generate Summary" | Opens with zone pre-selected, "Document" audience. |
| Dashboard → Top Storm Zones widget → zone click → "AI Summary" | Opens with zone pre-selected, "Manager" audience. |

#### 4.9.7 Token Budget

- `maxOutputTokens: 1500`
- System prompt: ~500 tokens
- Total budget: ~2600 tokens per call

---

### Module 10: Company Voice / Prompt Templates

**Route:** `/dashboard/ai-studio/company-voice`

**API:** `GET/PUT /api/settings/company-voice`

**Purpose:** Customize the AI's tone, language, and behavior across all modules. This is not a generation module — it's a configuration module that feeds `AiTonePreference` to every other module.

#### 4.10.1 Data Model

```typescript
export interface CompanyVoiceConfig {
  /** Company AI profile ID. */
  id: string;
  /** Company ID. */
  companyId: string;
  /** Default voice for all modules. */
  defaultVoice: "professional" | "friendly" | "consultative" | "confident" | "empathetic" | "urgent";
  /** Default output length. */
  defaultLengthPreference: "concise" | "standard" | "detailed";
  /** Whether to include insurance language by default. */
  includeInsuranceLanguage: boolean;
  /** Whether to include financing language by default. */
  includeFinancingLanguage: boolean;
  /** Custom system prompt suffix (appended to all AI calls). */
  customSystemPromptSuffix: string | null;
  /** Banned words/phrases. */
  bannedPhrases: string[];
  /** Per-module voice overrides. */
  moduleOverrides: Partial<Record<AiModuleId, {
    voice?: CompanyVoiceConfig["defaultVoice"];
    lengthPreference?: CompanyVoiceConfig["defaultLengthPreference"];
    customSuffix?: string;
  }>>;
  /** Sample outputs for tone calibration. */
  sampleOutputs: Array<{
    moduleId: AiModuleId;
    sampleInput: string;
    sampleOutput: string;
    rating: 1 | 2 | 3 | 4 | 5;
  }>;
  updatedAt: string;
  updatedBy: string;
}
```

#### 4.10.2 UI Pattern

**Settings form with live preview.**

1. **Voice selector:** 6 tone cards with description and example snippet.
   - Professional: "Polished, industry-standard language."
   - Friendly: "Warm, neighborly, relationship-first."
   - Consultative: "Advisory, question-led, educational."
   - Confident: "Assertive, numbers-driven, authoritative."
   - Empathetic: "Understanding, gentle, story-driven."
   - Urgent: "Action-oriented, deadline-focused."

2. **Length preference:** Concise | Standard | Detailed (radio group with word count guide).

3. **Language toggles:**
   - Include insurance/claims language (default on)
   - Include financing language (default on)

4. **Banned phrases:** Tag input for words/phrases to avoid.

5. **Custom system prompt suffix:** Textarea for advanced customization. Help text: "This text is appended to every AI system prompt. Use it for company-specific instructions."

6. **Module overrides:** Expandable section — per-module voice/length/suffix overrides.

7. **Live preview:** Side panel shows a sample objection response regenerated in real-time as settings change.

8. **Save** button saves to `company_ai_profiles` table.

#### 4.10.3 Role Visibility

| Role | Access |
|---|---|
| Owner | ✅ Full — can edit all settings |
| Manager | ⚠️ Read-only — can view but not edit |
| Rep | ❌ Not visible |
| Office Admin | ❌ Not visible |

#### 4.10.4 Cross-Surface Appearances

| Surface | Behavior |
|---|---|
| Settings → Company → "AI Voice" tab | Same content as this module (shared component). |
| All AI modules → tone indicator | Small badge showing current voice setting with link to customize. |

---

## 5. AI Session Logging

Every AI generation is logged for audit, cost tracking, and quality improvement.

```typescript
// src/types/ai-studio.ts (continued)

export interface AiSession {
  id: string;
  userId: string;
  companyId: string;
  moduleId: AiModuleId;
  /** Input context snapshot (redacted of PII for storage). */
  inputSnapshot: Record<string, unknown>;
  /** Output content hash (not full content — stored separately). */
  outputHash: string;
  /** Model used. */
  model: string;
  /** Token usage. */
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  /** Estimated cost in USD. */
  estimatedCostUsd: number;
  /** Latency in milliseconds. */
  latencyMs: number;
  /** User feedback (optional). */
  feedback: "positive" | "negative" | null;
  /** Feedback text (optional). */
  feedbackText: string | null;
  createdAt: string;
}
```

### 5.1 Session Table

```sql
-- Future migration: 20260315_ai_sessions.sql

CREATE TABLE IF NOT EXISTS ai_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    company_id UUID NOT NULL,
    module_id TEXT NOT NULL,
    input_snapshot JSONB NOT NULL DEFAULT '{}',
    output_hash TEXT NOT NULL,
    model TEXT NOT NULL,
    prompt_tokens INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    estimated_cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0,
    latency_ms INTEGER NOT NULL DEFAULT 0,
    feedback TEXT CHECK (feedback IN ('positive', 'negative')),
    feedback_text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_sessions_user_idx ON ai_sessions(user_id);
CREATE INDEX IF NOT EXISTS ai_sessions_company_idx ON ai_sessions(company_id);
CREATE INDEX IF NOT EXISTS ai_sessions_module_idx ON ai_sessions(module_id);
CREATE INDEX IF NOT EXISTS ai_sessions_created_at_idx ON ai_sessions(created_at DESC);
```

### 5.2 Cost Tracking

- Every API response includes `estimatedCostUsd` computed via `estimateUsageCostUsd()` from `src/lib/ai.ts`.
- Dashboard → System Freshness widget (future) shows daily AI spend.
- Settings → Billing shows monthly AI token usage and cost.
- Rate limiting: configurable per-company daily token budget (default: 500,000 tokens/day).

---

## 6. API Architecture

### 6.1 Unified AI API Pattern

All AI module endpoints follow the same pattern:

```
POST /api/ai/{module-id}
Authorization: Bearer <supabase-jwt>
Content-Type: application/json

Request Body: {
  // Module-specific input (see each module's input type)
  // Context identifiers (stormZoneId, houseId, missionId, repId)
  // Never raw context — server assembles it
}

Response: {
  data: ModuleOutput,
  error: string | null,
  meta: {
    timestamp: string,
    model: string,
    tokenCount: number,
    estimatedCostUsd: number,
    latencyMs: number,
    sessionId: string  // AI session log ID
  }
}
```

### 6.2 Endpoint Registry

| Module | Method | Endpoint | Cache |
|---|---|---|---|
| Daily Brief | `POST` | `/api/ai/daily-brief` | Per-user per-day |
| Mission Copilot | `POST` | `/api/ai/mission-copilot` | No cache |
| Opportunity Summary | `POST` | `/api/ai/opportunity-summary` | Per-house, 1h TTL |
| Objection Response | `POST` | `/api/ai/objection-response` | No cache |
| Negotiation Coach | `POST` | `/api/ai/negotiation-coach` | No cache |
| Follow-Up Writer | `POST` | `/api/ai/follow-up` | No cache |
| Export Summary | `POST` | `/api/ai/export-summary` | Per-house, 1h TTL |
| Rep Coaching | `POST` | `/api/ai/rep-coaching` | Per-rep per-day |
| Storm Zone Summary | `POST` | `/api/ai/storm-zone-summary` | Per-zone, 4h TTL |
| Company Voice | `GET/PUT` | `/api/settings/company-voice` | No cache (config) |

### 6.3 Server-Side Context Assembly Flow

```
Client sends: { moduleId, houseId?, missionId?, stormZoneId?, repId?, moduleSpecificInput }
                                        │
                                        ▼
                        ┌───────────────────────────────┐
                        │   API Route Handler           │
                        │   1. Auth check               │
                        │   2. Role check               │
                        │   3. Rate limit check         │
                        └──────────┬────────────────────┘
                                   │
                                   ▼
                        ┌───────────────────────────────┐
                        │   Context Assembler           │
                        │   1. Load company profile     │
                        │   2. Load tone preference     │
                        │   3. Load storm context       │
                        │   4. Load house context       │
                        │   5. Load mission context     │
                        │   6. Load rep context         │
                        │   7. Build AiContext object   │
                        └──────────┬────────────────────┘
                                   │
                                   ▼
                        ┌───────────────────────────────┐
                        │   Prompt Builder              │
                        │   1. Select system prompt     │
                        │   2. Inject context sections  │
                        │   3. Apply tone modifiers     │
                        │   4. Apply banned phrases     │
                        │   5. Set token budget         │
                        │   6. Build user prompt        │
                        └──────────┬────────────────────┘
                                   │
                                   ▼
                        ┌───────────────────────────────┐
                        │   OpenAI Client               │
                        │   generateFromPrompt()        │
                        └──────────┬────────────────────┘
                                   │
                                   ▼
                        ┌───────────────────────────────┐
                        │   Response Parser             │
                        │   1. Parse structured output  │
                        │   2. Validate schema          │
                        │   3. Compute cost             │
                        │   4. Log AI session           │
                        │   5. Return envelope          │
                        └───────────────────────────────┘
```

---

## 7. Cross-Surface Embedding Summary

This table consolidates every location where AI modules appear outside of AI Studio.

| Module | Dashboard | Storms | Missions | Team | Mission Control | Exports | Houses |
|---|---|---|---|---|---|---|---|
| Daily Brief | ✅ Widget | — | — | — | ✅ Insight panel | — | — |
| Mission Copilot | ✅ Row action | — | ✅ FAB + stop action | — | — | — | ✅ Detail action |
| Opportunity Summary | — | — | ✅ Stop action | — | — | ✅ Row action | ✅ Detail action |
| Objection Response | ✅ Row action | — | ✅ Outcome trigger | — | — | — | — |
| Negotiation Coach | — | — | ✅ Outcome trigger | — | — | — | ✅ Detail action |
| Follow-Up Writer | — | — | ✅ Outcome trigger | — | — | — | ✅ Detail action |
| Export Summary | — | — | ✅ Outcome trigger | — | — | ✅ Row + detail action | — |
| Rep Coaching | — | — | — | ✅ Drawer + leaderboard | — | — | — |
| Storm Zone Summary | ✅ Zone widget | ✅ Zone card + drawer | — | — | — | — | — |
| Company Voice | — | — | — | — | — | — | — |

---

## 8. Rate Limiting & Guardrails

| Guardrail | Rule |
|---|---|
| **Per-user rate limit** | 60 AI calls per hour across all modules. |
| **Per-company daily budget** | Default 500,000 tokens/day. Configurable in company settings. |
| **Single-call token cap** | Each module defines `maxOutputTokens`. System prompt enforces it. |
| **PII redaction** | `AiContext` is logged with PII (homeowner names, phone numbers) redacted via `redactPii()` before storage in `ai_sessions.input_snapshot`. |
| **Content filtering** | OpenAI moderation API is called on all outputs before returning to client. Flagged content returns a safe fallback message. |
| **Retry policy** | On OpenAI 429 (rate limit): exponential backoff, max 3 retries, 2s/4s/8s. On 500: fail immediately, return error envelope. |
| **Timeout** | 30-second hard timeout on all AI calls. If exceeded, return `{ error: "AI generation timed out. Please try again." }`. |
| **Cost alert** | When daily spend exceeds 80% of budget, emit `ops_alerts` row with `type = "ai_budget_warning"`. |

---

## 9. Existing Code Migration

The current codebase has V1 AI implementations that will be wrapped by the new module pattern:

| V1 Function | V2 Module | Migration |
|---|---|---|
| `generateInsuranceReport()` in `src/lib/ai.ts` | Opportunity Summary Generator | Wrap with context assembler. Replace raw prompts with template + context injection. |
| `generateFollowUp()` in `src/lib/ai.ts` | Follow-Up Writer | Wrap with context assembler. Add AIDA framework prompt enhancement. |
| `generateObjectionResponse()` in `src/lib/ai.ts` | Objection Response Assistant | Wrap with context assembler. Integrate objection library templates. |
| `OBJECTION_LIBRARY` in `src/lib/objection-library.ts` | Objection Response Assistant | Library becomes the "browse" mode. AI generates custom responses on top. |
| `MESSAGE_SEQUENCES` in `src/lib/message-sequences.ts` | Follow-Up Writer | Sequences become the "suggested sequence" feature in Follow-Up Writer output. |
| `src/lib/ai/report-generator.ts` | Opportunity Summary Generator | Merge report generation into structured summary output. |
| `src/lib/ai/damage-analyzer.ts` | Opportunity Summary Generator | Damage analysis becomes input context for summaries. |
| `src/lib/ai/estimate-generator.ts` | Negotiation Coach (pricing guidance) | Estimate data feeds pricing guidance in negotiation scenarios. |

---

## 10. Build Priority

| Priority | Module | Rationale |
|---|---|---|
| P0 | Company Voice / Prompt Templates | Foundation — all modules depend on tone settings. |
| P0 | Objection Response Assistant | Highest field impact. Builds on existing V1 code. |
| P0 | Follow-Up Writer | Highest field impact. Builds on existing V1 code. |
| P1 | Daily Brief Generator | Core dashboard widget dependency. |
| P1 | Mission Copilot | Core field workflow dependency. |
| P1 | Opportunity Summary Generator | Export workflow dependency. |
| P1 | Export Summary Writer | Export workflow dependency. |
| P2 | Storm Zone Summary | Storms screen dependency. |
| P2 | Negotiation Coach | Field enhancement. |
| P2 | Rep Coaching Insights | Team management enhancement. |

---

## 11. Testing Strategy

Each module requires:

1. **Unit tests:** Context assembler correctly builds `AiContext` from identifiers.
2. **Integration tests:** API endpoint returns correct envelope, logs `ai_sessions`, respects role guards.
3. **Prompt tests:** System prompt + context produces expected output shape (mocked OpenAI, validate JSON schema).
4. **Rate limit tests:** Verify 429 after exceeding per-user limit.
5. **Cost tracking tests:** Verify `estimateUsageCostUsd` returns correct values for known token counts.

Test files follow project convention: `tests/ai-{module-id}.test.ts`.
