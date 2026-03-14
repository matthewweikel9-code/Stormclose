# Stormclose V2 — Build Prompts

## Operator Playbook

### Models
| Model | Role | Best at |
|-------|------|---------|
| **Claude Opus 4.6** | Architect | product contracts, UX structure, data contracts, edge cases, constraint enforcement, reasoning chains |
| **GPT-5.3 Codex** | Builder | repo-aware code generation, file creation, migrations, API routes, tests, commits |

### Workflow per phase

```
┌─────────────────────────────────────────────────────┐
│  Step 1 — Give Claude the phase's CLAUDE PROMPT     │
│           Attach: architecture doc + prior output   │
│           Result: spec / contract / design doc      │
├─────────────────────────────────────────────────────┤
│  Step 2 — Give Codex the phase's CODEX PROMPT       │
│           Attach: architecture doc + Claude output   │
│           Result: code, tests, commit               │
├─────────────────────────────────────────────────────┤
│  Step 3 — Verify: run the app, check tests          │
│           If broken → paste errors back to Codex    │
│           If stable → move to next phase            │
├─────────────────────────────────────────────────────┤
│  Step 4 (optional) — Paste Codex summary back to    │
│           Claude for review before next phase        │
└─────────────────────────────────────────────────────┘
```

### What to attach with every prompt

| Model | Always attach | Also attach |
|-------|--------------|-------------|
| Claude | `docs/stormclose-enterprise-architecture.md` | Previous phase's Claude output |
| Codex | `docs/stormclose-enterprise-architecture.md` | Current phase's Claude output + the full repo (or let Codex read it) |

### Rules
- **Never paste a Claude prompt into Codex** or vice versa.
- **Never skip a phase.** Each phase builds on the previous.
- **Always run tests after Codex finishes a phase** before moving on.
- **If Codex output breaks something**, paste the error back into Codex with: `"Fix this error from Phase X: [error]"`.
- **If you're unsure whether Codex did the right thing**, paste its summary into Claude with: `"Review this Phase X implementation summary against the architecture. Flag any drift."`.

---

## Phase 0 — Product Lock + Gap Analysis

### CLAUDE PROMPT
```text
You are the product architect for a SaaS called Stormclose.

## Context
I am attaching the full enterprise architecture document for Stormclose V2.
Read it completely before responding.

## Product constraints — these are non-negotiable
- Keep existing logo, name, and color palette — do NOT redesign the brand.
- Stormclose is an AI storm sales operating system for roofing teams.
- It is NOT a CRM, scheduler, or job management platform.
- JobNimbus is the downstream system of record — Stormclose feeds it, never replaces it.
- Core workflow: storm → zone → house → mission → team → AI assist → document → export.

## Your task
Produce a final product contract for Stormclose V2.
A coding model will use this contract as its source of truth for every decision.
The contract must be specific enough to prevent feature drift.

## Required output — use exactly these sections

### 1. Product Thesis
One paragraph. What is Stormclose and why does it exist?

### 2. Product Pillars
Bullet list. The 5-7 capabilities that define the product.

### 3. Core Workflow
Numbered list. The exact end-to-end workflow from storm detection to JobNimbus export.

### 4. Roles
For each role (Owner, Manager, Rep, Office Admin):
- What they care about
- What they see
- What they can do
- What they should NOT have to do

### 5. No-Build List
Explicit list of things Stormclose must NEVER become or build:
- categories of features to avoid
- types of screens to never add
- integrations that would cause drift

### 6. Non-Negotiable UI/Brand Constraints
Exact rules a frontend developer must follow.

### 7. Non-Negotiable Architecture Constraints
Exact rules a backend developer must follow.

### 8. Implementation Contract
A short numbered checklist that a coding model must verify against before completing any phase. Written as: "Before marking Phase N complete, confirm that..."

## Output rules
- Be specific, not vague.
- Use concrete nouns: screen names, widget names, entity names, API patterns.
- If something is ambiguous in the architecture doc, make a decision and state it clearly.
- Do not add features beyond what the architecture doc defines.
```

### CODEX PROMPT
```text
You are a senior full-stack engineer working on the Stormclose repo.

## Context files to read first
- docs/stormclose-enterprise-architecture.md (the target architecture)
- The product contract output from the architect (I am pasting it below)

## Your task
Audit the current repo against the target architecture.
Create docs/stormclose-gap-analysis.md with this exact structure:

### 1. Screen Mapping
Table with columns: Current Screen | Target Screen | Action (reuse / reshape / hide / new)

### 2. API Mapping
Table with columns: Current API Route | Target API Route | Action (reuse / reshape / remove / new)

### 3. Service/Lib Mapping
Table with columns: Current Module | Target Use | Action

### 4. Reusable Assets
List of components, hooks, utilities, and styles that carry forward unchanged.

### 5. Dead Weight
List of files/routes/components to hide or remove from primary navigation.

### 6. New Build List
Ordered list of things that must be built from scratch, grouped by phase.

### 7. Migration Needs
Any Supabase migration, data model, or schema changes needed.

## Rules
- Do NOT change any application code yet — this is analysis only.
- Be exhaustive — check every file in src/app, src/components, src/services, src/lib, src/hooks, src/types, and supabase/migrations.
- If unsure whether something is reusable, list it as "review" not "remove".
- Commit the gap analysis with message: "docs: add gap analysis for V2 architecture"
```

---

## Phase 1 — Navigation + App Shell

### CLAUDE PROMPT
```text
You are designing the navigation and app shell for Stormclose V2.

## Context
I am attaching:
1. The enterprise architecture document
2. The product contract from Phase 0

## Constraints
- Primary nav items: Dashboard, Storms, Missions, Team, Mission Control, AI Studio, Documents, Exports, Settings
- Four roles: Owner, Manager, Rep, Office Admin
- Current brand/visual system must be preserved exactly
- Dashboard is the landing page for all roles

## Your task
Design the complete navigation system.

## Required output

### 1. Route Map
A tree showing every route path under (dashboard)/. Example:
/dashboard → Dashboard
/dashboard/storms → Storms
/dashboard/storms/[id] → Storm Detail
...etc for every screen.

### 2. Sidebar Config
JSON-like structure showing each nav item with:
- label
- icon suggestion
- route
- roles that can see it
- badge source (if any)

### 3. Role Visibility Matrix
Table: Screen × Role → visible / hidden / read-only

### 4. Page Shell Rules
Define the consistent page structure every screen must follow:
- header pattern
- KPI strip pattern
- content area pattern
- drawer/modal pattern
- empty state pattern
- loading state pattern

### 5. Current Nav Cleanup
List of current nav items to: keep, rename, merge, or hide.

### 6. Mobile / Rep Mode Notes
How navigation should adapt for mobile rep experience.
```

### CODEX PROMPT
```text
You are implementing Phase 1 for Stormclose V2: navigation and app shell refactor.

## Context files
- docs/stormclose-enterprise-architecture.md
- The navigation design from the architect (pasted below)

## Stack
- Next.js 14 app router
- React 18, TypeScript
- Tailwind CSS
- Supabase auth (user roles stored in user metadata or a users table)

## Implementation requirements

### Navigation
- Update src/config/navigation.ts (or equivalent) to match the target nav structure.
- Each nav item must have: label, href, icon, requiredRoles[], optional badgeEndpoint.
- Hide or comment out any nav items not in the target architecture.

### Layout
- Update src/app/(dashboard)/layout.tsx and sidebar components.
- Preserve the current Stormclose logo, color palette, and premium dark theme.
- Do NOT change fonts, colors, or logo.

### Role awareness
- Add a utility or hook that checks the current user's role.
- Use it to filter nav items.
- If role data isn't available yet, scaffold a `useUserRole()` hook that returns a role string.

### Placeholder pages
- For any target route that doesn't exist yet, create a placeholder page.tsx with the screen name and "Coming in Phase N" text.
- Ensure every nav link resolves to a real route.

### Tests
- Add a test for the nav config: given a role, it returns the correct filtered nav items.
- Add a test for the role hook if you create one.

## Deliverables checklist
- [ ] Updated nav config
- [ ] Updated sidebar component
- [ ] Updated layout
- [ ] Role-aware filtering
- [ ] Placeholder pages for new routes
- [ ] Tests
- [ ] Commit: "feat(nav): role-aware navigation for V2 architecture"
```

---

## Phase 2 — Dashboard / Houses To Hit Today

### CLAUDE PROMPT
```text
You are designing the Stormclose V2 Dashboard — the daily action center.

## Context
I am attaching:
1. Enterprise architecture document
2. Product contract
3. Phase 1 navigation output

## Target widgets
1. AI Daily Brief
2. Houses To Hit Today (the primary table — most screen real estate)
3. Top Storm Zones
4. AI Deployment Plan
5. Live Team Snapshot
6. Unassigned Hot Clusters
7. Recent Qualified Opportunities
8. Export Queue Summary
9. System Freshness / Data Health

## Your task
For EACH widget, define:

### Data contract
- Exact fields returned by the API
- TypeScript interface name and shape
- Source tables/services

### KPI calculations
- Exact formulas (e.g., "conversion_rate = interested / (attempted + interested + not_interested)")

### Role differences
- What the owner sees vs manager vs rep vs office admin
- Any widgets that are hidden for certain roles

### Row actions (for Houses To Hit Today)
- Each action button, what it does, what API it calls

### Layout
- Which widgets are full-width vs half-width vs sidebar
- Suggested grid positions
- What collapses on mobile

### Empty states
- What each widget shows when there's no data

### Refresh behavior
- Which widgets auto-refresh and at what interval
- Which are static until page reload

## Output format
Use a consistent template per widget. Do not skip any widget.
```

### CODEX PROMPT
```text
You are implementing Phase 2 for Stormclose V2: the Dashboard.

## Context files
- docs/stormclose-enterprise-architecture.md
- Dashboard design from the architect (pasted below)

## Stack
Next.js 14 app router, React 18, TypeScript, Tailwind CSS, Supabase, shadcn/ui components.

## Implementation requirements

### API routes to create or update
- GET /api/dashboard/today — returns all dashboard widget data in one payload
- GET /api/dashboard/ai-brief — returns AI daily brief content
- GET /api/dashboard/export-summary — returns export queue summary

### Types to create
- src/types/dashboard.ts with interfaces for each widget's data contract
- Match the architect's spec exactly

### Dashboard page
- Replace or reshape src/app/(dashboard)/dashboard/page.tsx
- Use a responsive grid layout
- Each widget should be its own component in src/components/dashboard/
- Widget components: AIDailyBrief, HousesToHitToday, TopStormZones, AIDeploymentPlan, LiveTeamSnapshot, UnassignedHotClusters, RecentQualifiedOpps, ExportQueueSummary, DataHealth

### Houses To Hit Today
- This is the primary widget — give it the most space
- Must include: address, storm zone, opportunity score, storm severity, assigned rep, status, AI reason
- Row actions: Assign, Add to Mission, View Details, Send to JobNimbus, AI Assist

### Role filtering
- Use the role hook from Phase 1
- Hide owner-only widgets from reps

### Data
- If real data isn't available, use realistic mock data that matches the types
- Add a TODO comment where real service calls should replace mocks

### Tests
- Test the dashboard API route returns the correct shape
- Test that role filtering hides the right widgets

## Deliverables checklist
- [ ] Dashboard types
- [ ] Dashboard API route(s)
- [ ] Dashboard page with widget grid
- [ ] Individual widget components
- [ ] Houses To Hit Today with row actions
- [ ] Role-based widget visibility
- [ ] Tests
- [ ] Commit: "feat(dashboard): houses to hit today + widget grid"
```

---

## Phase 3 — Storm Intelligence + Watchlists

### CLAUDE PROMPT
```text
You are designing the Stormclose V2 Storms module.

## Context
I am attaching:
1. Enterprise architecture document
2. Product contract
3. Outputs from Phases 0-2

## Core idea
This module turns raw storm data into ranked, actionable opportunity zones.
It is NOT just a storm map. It is a storm intelligence center.

## Target widgets
1. Live Storm Map (Mapbox)
2. Recent Storm Timeline
3. Storm Opportunity Zones (ranked list)
4. Territory Watchlist Alerts
5. Storm Detail Drawer
6. Unworked Opportunity Clusters
7. AI Recommendation Panel

## Your task
For EACH widget, define:
- Data contract (TypeScript interface shape)
- Data source (which API, which table)
- Interaction model (click, expand, drill-down)
- Role differences

Additionally define:
### Storm Zone object model
- What fields define a storm_zone entity
- How zones are created from raw storm events
- Scoring algorithm for zone opportunity ranking

### Watchlist behavior
- How a user creates a watchlist territory
- How alerts are generated
- Alert delivery (in-app only for now)

### AI ranking
- What factors determine "top zone"
- How zones are scored vs individual houses within zones
- How this connects to the dashboard's Top Storm Zones widget

## Output format
Use a consistent template per widget. Include TypeScript interface sketches.
```

### CODEX PROMPT
```text
You are implementing Phase 3 for Stormclose V2: Storm Intelligence.

## Context files
- docs/stormclose-enterprise-architecture.md
- Storms module design from the architect (pasted below)

## Stack
Next.js 14 app router, React 18, TypeScript, Tailwind, Supabase, Mapbox GL JS.

## Implementation requirements

### Data model
- Create migration: supabase/migrations/YYYYMMDD_storm_zones.sql
  - storm_zones table: id, storm_event_id, name, centroid (geography), radius_km, opportunity_score, house_count, unworked_count, created_at, updated_at
  - territory_watchlists table: id, user_id, name, bounds (geography/polygon), alert_threshold, active, created_at
  - watchlist_alerts table: id, watchlist_id, storm_zone_id, triggered_at, acknowledged

### API routes
- GET /api/storm-zones — list scored zones with filters
- GET /api/storm-zones/[id] — zone detail with houses
- POST /api/storm-zones/[id]/generate-mission — create mission from zone
- GET /api/watchlists — user's watchlists
- POST /api/watchlists — create watchlist
- PATCH /api/watchlists/[id] — update watchlist

### Page
- Create or reshape src/app/(dashboard)/dashboard/storms/page.tsx
- Split layout: map on left/top, zone list on right/bottom
- Storm Detail as a slide-out drawer
- Watchlist management in settings or a sub-tab

### Reuse
- Use existing Xweather/NWS integration in src/lib/xweather.ts
- Use existing Mapbox setup if present
- Use existing storm API routes as data sources, adapt output shape

### Tests
- Test storm zone API returns correct shape
- Test zone scoring logic if extracted as a utility
- Test watchlist CRUD

## Deliverables checklist
- [ ] Storm zones migration
- [ ] Watchlists migration
- [ ] Storm zone API routes
- [ ] Watchlist API routes
- [ ] Storms page with map + zone list
- [ ] Storm detail drawer
- [ ] Tests
- [ ] Commit: "feat(storms): storm zones, watchlists, and intelligence module"
```

---

## Phase 4 — Missions + Geolocation

### CLAUDE PROMPT
```text
You are designing the Stormclose V2 mission and geolocation system.

## Context
I am attaching:
1. Enterprise architecture document
2. Product contract
3. Outputs from Phases 0-3

## Core idea
Missions are AI-assisted field deployments, not manual scheduling.
The owner should NOT sit there assigning everyone all day.
AI recommends deployment; managers approve or override when needed.
Rep geolocation is exact during active mission mode.

## Your task
Define the complete mission and geolocation system:

### 1. Mission lifecycle
State machine: planned → active → paused → completed → expired
Define exact transition rules and who/what triggers each.

### 2. Stop lifecycle
States: new → targeted → attempted → no_answer / interested / not_interested / follow_up_needed / sent_to_jobnimbus
Define what data is captured at each transition.

### 3. AI deployment logic
- How does AI decide which reps go where?
- What inputs does it use? (rep location, zone scores, rep skills, workload, distance)
- What does the deployment recommendation look like?
- When does it require approval vs auto-deploy?

### 4. Geolocation architecture
- Heartbeat model: what data, how often (15-60s), privacy controls
- Active mission mode vs inactive
- How geolocation feeds: next-best house, rerouting, idle detection, off-route detection, coverage gaps
- Privacy: when tracking stops, what's stored vs ephemeral

### 5. Next-best house algorithm
- Inputs: current location, remaining stops, nearby unassigned houses, scores, storm recency
- Output: ranked suggestion list
- When it triggers: after each stop outcome, on idle, on request

### 6. Exception model
List every exception type with: trigger condition, severity, suggested action, who sees it.

### 7. Data contracts
TypeScript interfaces for: Mission, MissionStop, RepPresence, DeploymentRecommendation, NextBestHouse.

## Output format
Use numbered sections matching above. Include TypeScript interface sketches.
```

### CODEX PROMPT
```text
You are implementing Phase 4 for Stormclose V2: Missions and Geolocation.

## Context files
- docs/stormclose-enterprise-architecture.md
- Mission system design from the architect (pasted below)

## Stack
Next.js 14 app router, React 18, TypeScript, Tailwind, Supabase (with Realtime), Mapbox.

## Implementation requirements

### Data model
- Create migration: supabase/migrations/YYYYMMDD_missions_v2.sql
  - Update missions table if needed: add status enum (planned/active/paused/completed/expired), ai_generated boolean, approved_by, deployment_recommendation jsonb
  - Update or create mission_stops: id, mission_id, house_id, sequence, status enum, outcome_data jsonb, arrived_at, departed_at, notes
  - Create rep_presence: id, user_id, mission_id, lat, lng, accuracy, heading, speed, recorded_at, mode enum (active_mission/idle/offline)
  - Create mission_events: id, mission_id, event_type, payload jsonb, created_at

### API routes
- POST /api/presence/heartbeat — upsert rep position, return next-best house suggestion
- POST /api/presence/start-mission — set rep to active mission mode
- POST /api/presence/end-mission — set rep to idle, stop tracking
- GET /api/missions — list with filters
- POST /api/missions — create mission (manual or from AI recommendation)
- POST /api/missions/create-from-storm — create from storm zone (reuse existing if present)
- GET /api/missions/[id] — mission detail with stops and live rep position
- PATCH /api/missions/[id] — update status
- PATCH /api/mission-stops/[id]/outcome — record stop outcome
- POST /api/missions/[id]/rebalance — AI rebalance remaining stops

### Services
- Create or update src/services/missions/missionService.ts
- Create src/services/presence/presenceService.ts
- Create src/lib/nextBestHouse.ts — pure function for ranking

### Page
- Create or update src/app/(dashboard)/dashboard/missions/page.tsx
  - Mission list with status filters
  - Mission map showing stops and rep position
  - Mission detail drawer/page
- Active mission view for reps: current stop, next stops, next-best suggestion, quick outcome buttons

### Tests
- Test mission state transitions
- Test stop outcome recording
- Test next-best house ranking logic (pure function)
- Test heartbeat endpoint response shape

## Deliverables checklist
- [ ] Missions V2 migration
- [ ] Presence migration
- [ ] Mission API routes
- [ ] Presence API routes
- [ ] Mission service
- [ ] Presence service
- [ ] Next-best house utility
- [ ] Missions page
- [ ] Rep active mission view
- [ ] Tests
- [ ] Commit: "feat(missions): mission lifecycle, geolocation, and next-best house"
```

---

## Phase 5 — Team Operations + Exceptions

### CLAUDE PROMPT
```text
You are designing the Stormclose V2 Team module.

## Context
I am attaching prior phase outputs.

## Core idea
This is an EXCEPTIONS and LIVE OPS screen, not a micromanagement screen.
The owner glances at it to see if anything needs attention.
AI handles most assignment; this screen handles the edge cases.

## Target widgets
1. Live Rep Map — real-time dots on Mapbox
2. Rep Status Board — grid of rep cards with status/mission/last activity
3. Coverage Gaps — zones with high opportunity but no active rep nearby
4. AI Reassignment Suggestions — "Move Sarah from Zone A to Zone B because..."
5. Rep Leaderboard — daily/weekly/monthly KPIs
6. Exception Feed — chronological list of issues requiring attention
7. Rep Detail Drawer — slide-out with rep's current mission, stops, location, stats

## Your task
For each widget, define data contract, source, and role visibility.

For exception logic specifically:
- Define every exception type with: trigger condition, detection method (polling vs event), severity (info/warning/critical), suggested action, auto-resolve conditions.

Exception types to define at minimum:
- idle rep (no stop outcome in X minutes while on active mission)
- off-route rep (position far from next assigned stop)
- no rep in hot zone (high-scoring zone with zero active missions)
- mission nearly complete with nearby unworked cluster
- repeated low-quality outcomes (e.g., 5 consecutive no_answer)
- export backlog growing (X qualified opps not yet exported)

## Output format
Widget-by-widget specs, then exception logic table, then TypeScript interfaces.
```

### CODEX PROMPT
```text
You are implementing Phase 5 for Stormclose V2: Team Operations.

## Context files
- docs/stormclose-enterprise-architecture.md
- Team module design from architect (pasted below)

## Implementation requirements

### API routes
- GET /api/team/live — all reps with current position, status, active mission
- GET /api/team/exceptions — current exception feed
- POST /api/team/reassign — manual reassignment override
- GET /api/team/leaderboard — rep KPIs with date range filter

### Services
- Create src/services/team/exceptionService.ts
  - detectExceptions(teamState): Exception[] — pure function
  - Each exception type from the architect's spec

### Page
- Create src/app/(dashboard)/dashboard/team/page.tsx
  - Split: map on top/left, status board + exception feed on right/bottom
  - Rep Detail as drawer
  - Leaderboard as collapsible section or tab

### Tests
- Test exception detection logic with fixture data
- Test leaderboard KPI calculations
- Test live team API response shape

## Deliverables checklist
- [ ] Team API routes
- [ ] Exception service with detection logic
- [ ] Team page with all widgets
- [ ] Rep detail drawer
- [ ] Tests
- [ ] Commit: "feat(team): live ops, exception detection, and leaderboard"
```

---

## Phase 6 — Mission Control TV Mode

### CLAUDE PROMPT
```text
You are designing Mission Control — a fullscreen enterprise TV display for Stormclose.

## Context
I am attaching prior phase outputs.

## Core idea
This runs on a TV in the office. It must look impressive, update live, and require zero interaction.

## Target widgets
- Hero Live Map (storm zones + rep dots, largest element)
- KPI Tower (vertical stack of key numbers)
  - Reps In Field
  - Active Missions
  - Houses Left To Hit
  - Qualified Opportunities Today
  - Sent To JobNimbus Today
- AI Priority Zone highlight
- Top Rep / Team
- Unworked Hot Cluster
- Live Storm Alert (flash when new storm detected)
- AI Ops Insight (rotating AI-generated one-liner insights)
- Bottom Ticker (scrolling recent events)

## Your task
Define:
- Exact grid layout with proportions
- Refresh intervals per widget
- Which panels rotate and on what cycle
- Animation/transition behavior
- What happens when data is stale
- Color treatment for alerts/warnings
- Sound: yes/no for alerts

## Output format
Layout diagram (ASCII or description), per-widget refresh spec, rotation rules.
```

### CODEX PROMPT
```text
You are implementing Phase 6 for Stormclose V2: Mission Control TV Mode.

## Context files
- docs/stormclose-enterprise-architecture.md
- Mission Control design from architect (pasted below)

## Implementation requirements

### Route
- Create src/app/(dashboard)/dashboard/mission-control/page.tsx
- Fullscreen layout, no sidebar, minimal chrome
- Add ?tv=true query param or a dedicated /mission-control route outside (dashboard) layout

### API
- GET /api/mission-control/live — single endpoint returning all MC widget data
- Should aggregate from: storms, missions, presence, exports, team KPIs
- Include cache headers or stale-while-revalidate for performance

### Components
- src/components/mission-control/ folder
- HeroMap, KPITower, AIPriorityZone, TopRep, HotCluster, StormAlert, OpsInsight, BottomTicker
- Use CSS Grid for layout
- Auto-refresh with setInterval or SWR revalidation (30s-60s)

### Visual
- Use Stormclose dark theme
- Make KPIs large and readable from across a room
- Subtle animations for data changes (number ticking up, new alert flash)

### Tests
- Test the /api/mission-control/live route returns correct shape
- Smoke test the page renders without errors

## Deliverables checklist
- [ ] Mission Control page (fullscreen)
- [ ] Live data API
- [ ] Widget components
- [ ] Auto-refresh behavior
- [ ] Tests
- [ ] Commit: "feat(mission-control): fullscreen TV mode with live data"
```

---

## Phase 7 — AI Studio

### CLAUDE PROMPT
```text
You are designing AI Studio for Stormclose V2.

## Context
I am attaching prior phase outputs.

## Core idea
AI Studio is NOT a chatbot. It is a structured AI workbench.
Each module is a specific AI-powered task with structured inputs and outputs.

## Target modules
1. Daily Brief Generator — morning summary for the team
2. Mission Copilot — real-time suggestions during active mission
3. Opportunity Summary Generator — writeup for a qualified opportunity
4. Objection Response Assistant — contextual objection handling
5. Negotiation Coach — pricing/scope negotiation guidance
6. Follow-Up Writer — draft follow-up messages
7. Export Summary Writer — summary attached to JobNimbus handoff
8. Rep Coaching Insights — AI analysis of rep performance patterns
9. Storm Zone Summary — summary of storm zone opportunity
10. Company Voice / Prompt Templates — customize AI tone

## Your task
For EACH module, define:
- Input context: what structured data it needs (storms, houses, missions, notes, company profile)
- Output type: what it produces (text block, bullet list, structured JSON, document draft)
- UI pattern: card with form? wizard? single-click generate?
- Role visibility: who can use it
- Where else it appears: e.g., objection assistant also appears as a button in mission stop view

### Shared AI Context Contract
Define the standard context object that all AI modules receive:
- company_profile
- current_storm_context
- current_house_context
- current_mission_context
- rep_notes
- tone_preference
- output_format_preference

## Output format
Module-by-module specs with TypeScript interface for shared context.
```

### CODEX PROMPT
```text
You are implementing Phase 7 for Stormclose V2: AI Studio.

## Context files
- docs/stormclose-enterprise-architecture.md
- AI Studio design from architect (pasted below)

## Implementation requirements

### Shared AI infrastructure
- Create src/types/ai-context.ts with the shared AIContext interface
- Create src/lib/ai/buildContext.ts — utility to assemble context from current state
- Create src/lib/ai/modules/ folder with one file per module

### API routes
- POST /api/ai/daily-brief
- POST /api/ai/mission-copilot
- POST /api/ai/opportunity-summary
- POST /api/ai/objection-response
- POST /api/ai/negotiation-coach
- POST /api/ai/follow-up-writer
- POST /api/ai/export-summary
- POST /api/ai/rep-coaching
- POST /api/ai/zone-summary
Each accepts { context: AIContext, params: ModuleSpecificParams } and returns structured output.

### Page
- Create src/app/(dashboard)/dashboard/ai-studio/page.tsx
- Grid of module cards
- Clicking a card opens the module's interface
- Each module: input form → generate button → output display → copy/export actions

### Reuse
- Use existing OpenAI integration in src/lib/ai.ts
- Refactor prompt construction to use the new context contract

### Workflow entry points
- Add "AI Assist" buttons to: Houses To Hit Today rows, Mission stop view, Opportunity detail
- These buttons open the relevant AI Studio module pre-filled with context

### Tests
- Test buildContext utility
- Test each API route accepts and returns the correct shape
- Test at least one module's prompt construction

## Deliverables checklist
- [ ] AI context types
- [ ] Context builder utility
- [ ] AI module files
- [ ] AI API routes
- [ ] AI Studio page with module cards
- [ ] Workflow entry points (AI Assist buttons)
- [ ] Tests
- [ ] Commit: "feat(ai-studio): structured AI workbench with context contracts"
```

---

## Phase 8 — Documents + Objections + Negotiation

### CLAUDE PROMPT
```text
You are designing the Documents, Objection AI, and Negotiation AI workflow for Stormclose V2.

## Context
I am attaching prior phase outputs.

## Core idea
Documents are workflow-connected, not random writing tools.
Objection and Negotiation AI are contextual, not generic.

## Document types (from architecture doc)
- homeowner follow-up letter
- neighborhood flyer
- storm impact summary
- mission recap
- manager daily summary
- office summary
- qualified opportunity handoff sheet
- claim explanation letter
- leave-behind document
- rep field recap

## Your task
### Documents
- For each document type: what context it needs, who generates it, when in the workflow it appears, what format it outputs (PDF/DOCX/clipboard/print)
- Document metadata model: id, type, context_ref (storm/house/mission), created_by, content, format, exported, created_at

### Objection categories
Define the common roofing sales objection categories:
- For each: example objections, what context the AI needs, how the response is structured
- Where the objection tool appears in the workflow

### Negotiation categories
Define common negotiation scenarios:
- For each: inputs needed, AI coaching structure, output format
- Where the negotiation tool appears

### Permissions
Who can generate, view, edit, export each type.

## Output format
Category-by-category specs with TypeScript interfaces.
```

### CODEX PROMPT
```text
You are implementing Phase 8 for Stormclose V2: Documents, Objections, Negotiation.

## Context files
- docs/stormclose-enterprise-architecture.md
- Documents design from architect (pasted below)

## Implementation requirements

### Data model
- Create migration: supabase/migrations/YYYYMMDD_documents.sql
  - documents table: id, type enum, title, context_type, context_id, content text, format, created_by, exported boolean, created_at, updated_at

### API routes
- GET /api/documents — list with filters
- POST /api/documents/generate — AI-generate a document from context
- GET /api/documents/[id] — get document
- PATCH /api/documents/[id] — update/edit
- POST /api/documents/[id]/export — export as PDF/DOCX/clipboard

### Objection + Negotiation
- These are AI Studio modules already built in Phase 7
- This phase adds: dedicated sub-pages or drawers accessible from Documents tab
- POST /api/ai/objection-response and POST /api/ai/negotiation-coach should already exist from Phase 7; enhance if needed

### Page
- Create src/app/(dashboard)/dashboard/documents/page.tsx
  - Document list with type filters
  - Generate new document flow
  - Document viewer/editor
  - Export actions

### Workflow entry points
- "Generate Document" button on: Houses To Hit Today rows, Mission detail, Opportunity detail, Storm zone detail

### Tests
- Test document generation API shape
- Test document list filters
- Test export endpoint

## Deliverables checklist
- [ ] Documents migration
- [ ] Document API routes
- [ ] Documents page
- [ ] Generate + view + edit + export flow
- [ ] Workflow entry points
- [ ] Tests
- [ ] Commit: "feat(documents): document generation, viewer, and export"
```

---

## Phase 9 — JobNimbus Export Queue

### CLAUDE PROMPT
```text
You are designing the Stormclose V2 Exports module.

## Context
I am attaching prior phase outputs.

## Core idea
Stormclose feeds qualified opportunities into JobNimbus. It does NOT replace JobNimbus.
The export queue is a first-class operational surface, not a hidden settings page.

## Target widgets
1. Ready To Export Queue — opportunities meeting export criteria, awaiting send
2. Recently Exported — last 50 successful exports with timestamps
3. Failed Exports — exports that failed with error details
4. Retry Queue — failed exports queued for retry
5. Export Rules — configurable criteria for auto-export vs manual approval
6. Handoff Summary Preview — preview of what will be sent to JobNimbus

## Your task
Define:
- Export criteria: what makes an opportunity "ready to export"
- Auto-export vs manual approval: when each applies
- Export data package: exact fields sent to JobNimbus
- Retry logic: max retries, backoff, failure notifications
- Export state machine: ready → exporting → exported / failed → retrying → exported / permanently_failed
- Cross-surface visibility: how export state shows on dashboard, team, mission control
- Handoff summary: what's included, who reviews it

## Output format
Specs with state machine diagram (ASCII), data contracts, and API contracts.
```

### CODEX PROMPT
```text
You are implementing Phase 9 for Stormclose V2: JobNimbus Export Queue.

## Context files
- docs/stormclose-enterprise-architecture.md
- Exports design from architect (pasted below)

## Implementation requirements

### Data model
- Create migration: supabase/migrations/YYYYMMDD_exports.sql
  - opportunity_exports table: id, house_id, mission_id, mission_stop_id, status enum (ready/exporting/exported/failed/retrying/permanently_failed), payload jsonb, jobnimbus_id, error text, attempts integer, next_retry_at, exported_at, created_by, created_at, updated_at

### API routes
- GET /api/exports — list with status filters
- POST /api/exports/jobnimbus — trigger export for one or batch
- POST /api/exports/[id]/retry — retry a failed export
- GET /api/exports/[id]/status — check export status
- GET /api/exports/[id]/preview — handoff summary preview

### Services
- Create src/services/exports/exportService.ts
  - buildExportPayload(house, mission, stops, notes): JobNimbusPayload
  - sendToJobNimbus(payload): result
  - retryExport(exportId): result
- Retry logic: max 3 attempts, exponential backoff

### Page
- Create src/app/(dashboard)/dashboard/exports/page.tsx
  - Tabs or sections: Ready, Recently Exported, Failed, Retry Queue
  - Handoff summary preview drawer
  - Bulk export action

### Cross-surface
- Dashboard Export Queue Summary widget should pull from this data
- Mission Control "Sent To JobNimbus Today" should pull from this data

### Tests
- Test export payload builder
- Test retry logic
- Test status transitions
- Test API route shapes

## Deliverables checklist
- [ ] Exports migration
- [ ] Export API routes
- [ ] Export service with retry logic
- [ ] Exports page with tabs
- [ ] Handoff preview
- [ ] Cross-surface data connections
- [ ] Tests
- [ ] Commit: "feat(exports): JobNimbus export queue with retry logic"
```

---

## Phase 10 — Enterprise Hardening

### CLAUDE PROMPT
```text
You are defining the enterprise hardening checklist for Stormclose V2.

## Context
I am attaching prior phase outputs and the architecture document.

## Your task
Produce a concrete, checkable readiness checklist organized by category:

### 1. Role-Based Access
- Every API route checks user role
- Every page/component respects role visibility
- No data leaks across roles

### 2. Error Handling
- Every page has: loading state, empty state, error state
- API errors return consistent shape
- Frontend shows user-friendly error messages

### 3. Data Freshness
- Every widget shows when data was last updated
- Stale data is visually indicated
- Auto-refresh intervals are documented

### 4. Observability
- Structured logging on all API routes
- Metrics for: API latency, AI call duration, export success/failure, heartbeat frequency
- Alert thresholds defined

### 5. Audit Trail
- All exports logged with who/when/what
- All AI actions logged with input context hash
- All mission state changes logged

### 6. Resilience
- Third-party outage fallbacks (Xweather, CoreLogic, OpenAI, JobNimbus)
- Retry logic on all external calls
- Feature flags for graceful degradation

### 7. Security
- Input validation on all API routes
- Rate limiting on AI endpoints
- Geolocation data handling / privacy compliance

### 8. UI Polish
- Consistent spacing, typography, color usage
- No broken layouts at any viewport
- Accessible (WCAG AA minimum)

## Output format
Numbered checklist with pass/fail criteria for each item.
```

### CODEX PROMPT
```text
You are implementing Phase 10 for Stormclose V2: Enterprise Hardening.

## Context files
- docs/stormclose-enterprise-architecture.md
- Hardening checklist from architect (pasted below)

## Implementation requirements
Work through the architect's checklist and implement fixes for each gap.

### Priority order
1. Role enforcement on all API routes (middleware or per-route check)
2. Consistent error responses (create a shared error handler utility)
3. Loading/empty/error states on all page components
4. Data freshness indicators on dashboard widgets
5. Structured logging utility (wrap console.log or use a logger)
6. Audit log entries for exports and mission changes
7. Fallback behavior for third-party outages
8. Input validation (zod schemas on API routes)
9. Feature flag checks on new features

### Deliverable doc
- Create docs/stormclose-readiness-checklist.md
- For each checklist item: status (done/partial/todo), notes

### Tests
- Run full test suite — all tests must pass
- Add smoke tests for: dashboard loads, missions load, exports load, AI studio loads

## Deliverables checklist
- [ ] Role enforcement across API routes
- [ ] Error handling utility
- [ ] Loading/empty/error state components
- [ ] Freshness indicators
- [ ] Logging utility
- [ ] Audit logging
- [ ] Fallback behavior
- [ ] Input validation schemas
- [ ] Readiness checklist doc
- [ ] Full test suite passing
- [ ] Commit: "chore(hardening): enterprise readiness pass"
```

---

## Master Prompt — Full Autonomous Build

Use this if you want Codex to execute all phases from the repo.

### CODEX MASTER PROMPT
```text
You are rebuilding Stormclose into an enterprise-grade AI storm sales operating system.

## Read these files first — they are your source of truth
- docs/stormclose-enterprise-architecture.md — the target architecture
- docs/stormclose-build-prompts-v2.md — the phase-by-phase build plan
- docs/stormclose-gap-analysis.md — the gap analysis (if present)

## Non-negotiable constraints
1. Keep the current Stormclose logo, name, color palette, and premium visual identity.
2. Do NOT turn the product into a CRM, scheduler, or job management platform.
3. JobNimbus is the downstream system of record — Stormclose feeds it, never replaces it.
4. Core workflow: storm → zone → house → mission → team → AI assist → document → export.
5. Enterprise feel across UI, architecture, backend reliability, and AI behavior.
6. Every screen must have loading, empty, and error states.
7. Every API route must validate input and check user role.
8. Every new feature must have at least one test.

## Execution rules
1. Work through phases 1-10 in order. Do not skip ahead.
2. After each phase: run tests, verify the app builds, then commit.
3. Commit messages follow: "feat(scope): description" or "chore(scope): description".
4. Reuse existing code where it makes sense — check existing files before creating new ones.
5. Hide or deprioritize non-core surfaces rather than leaving clutter.
6. If a phase depends on data that doesn't exist yet, use realistic mock data with TODO comments.
7. After each phase, output a brief summary: what changed, what files were touched, what tests pass.

## Start
Begin with Phase 1 (Navigation + App Shell). Do not proceed to Phase 2 until Phase 1 builds and tests pass.
```
