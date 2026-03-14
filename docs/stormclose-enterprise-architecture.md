# Stormclose Enterprise Architecture

## 1. Product Definition

**Stormclose** is an AI storm sales operating system for roofing companies.

It is:
- a storm intelligence platform
- a field sales coordination system
- an office command center
- an AI assistant for documents, objections, negotiation, and deployment decisions

It is not:
- a CRM of record
- a scheduling platform
- a job management platform
- a replacement for `JobNimbus`

## 2. Core Product Workflow

The entire product should follow one connected workflow:

1. Storm data is ingested from live + recent sources.
2. AI identifies and scores high-opportunity storm zones.
3. AI ranks individual houses inside those zones.
4. Dashboard shows `Houses To Hit Today`.
5. AI generates a deployment plan.
6. Missions are auto-created or manager-approved.
7. Reps work missions in the field with live geolocation.
8. AI continuously reranks nearby targets and detects gaps.
9. Mission Control shows live operations in the office.
10. AI drafts documents, objections, negotiation guidance, and summaries.
11. Qualified opportunities are exported into `JobNimbus`.

## 3. Users and Roles

### Owner
- wants executive visibility
- wants minimal manual assignment
- wants AI-driven deployment and exception handling
- wants branch/team performance

### Manager / Office Manager
- approves AI deployment when needed
- watches live field operations
- handles exceptions and reassignments
- reviews export queue

### Rep
- sees assigned mission and next-best houses
- updates outcomes quickly
- uses AI for objections and negotiation
- shares live location only during active mission mode

### Office Admin
- generates documents
- exports qualified opportunities to `JobNimbus`
- monitors Mission Control and handoff queue

## 4. Core Navigation

Primary navigation:
- `Dashboard`
- `Storms`
- `Missions`
- `Team`
- `Mission Control`
- `AI Studio`
- `Documents`
- `Exports`
- `Settings`

All other current surfaces should be hidden, merged, or deprioritized unless they clearly support the main workflow.

## 5. Screen Architecture

## Dashboard
**Purpose:** Decide what the company should work today.

### Exact widgets
- `AI Daily Brief`
- `Houses To Hit Today`
- `Top Storm Zones`
- `AI Deployment Plan`
- `Live Team Snapshot`
- `Unassigned Hot Clusters`
- `Recent Qualified Opportunities`
- `Export Queue Summary`
- `System Freshness / Data Health`

### Houses To Hit Today row fields
- address
- neighborhood / city
- storm zone
- opportunity score
- storm age
- storm severity
- estimated value band
- assigned rep / mission
- current status
- distance from active rep / office
- AI reason for ranking

### Row actions
- `Assign`
- `Add to Mission`
- `View Details`
- `Send to JobNimbus`
- `AI Assist`
- `Generate Document`

## Storms
**Purpose:** Turn storm data into actionable opportunity zones.

### Exact widgets
- `Live Storm Map`
- `Recent Storm Timeline`
- `Storm Opportunity Zones`
- `Territory Watchlist Alerts`
- `Storm Detail Drawer`
- `Unworked Opportunity Clusters`
- `AI Recommendation Panel`

### Actions
- `Generate Mission`
- `Open Impacted Houses`
- `Assign Team`
- `Generate Storm Summary`
- `Save Watchlist`

## Missions
**Purpose:** Execute field work from top opportunities.

### Exact widgets
- `Mission List`
- `Mission Map`
- `Assigned House List`
- `Live Rep Position`
- `Mission Progress Summary`
- `Nearby Next-Best Houses`
- `AI Mission Copilot`
- `Outcome Feed`
- `Export Shortcuts`

### Mission statuses
- `planned`
- `active`
- `paused`
- `completed`
- `expired`

### Stop statuses
- `new`
- `targeted`
- `attempted`
- `no_answer`
- `interested`
- `not_interested`
- `follow_up_needed`
- `sent_to_jobnimbus`

## Team
**Purpose:** Live rep operations and exception handling.

### Exact widgets
- `Live Rep Map`
- `Rep Status Board`
- `Coverage Gaps`
- `AI Reassignment Suggestions`
- `Rep Leaderboard`
- `Exception Feed`
- `Rep Detail Drawer`

### Exact exception types
- idle rep
- off-route rep
- no rep in hot zone
- mission nearly complete with nearby unworked cluster
- repeated low-quality outcomes in current zone
- export backlog growing

## Mission Control
**Purpose:** Fullscreen office display / TV mode.

### Exact widgets
- `Hero Live Map`
- `AI Priority Zone`
- `Reps In Field`
- `Active Missions`
- `Houses Left To Hit`
- `Qualified Opportunities Today`
- `Sent to JobNimbus Today`
- `Top Rep / Team`
- `Unworked Hot Cluster`
- `Live Storm Alert`
- `AI Ops Insight`
- `Rotating Bottom Ticker`

## AI Studio
**Purpose:** Central AI workbench connected to live operations.

### Exact modules
- `Daily Brief Generator`
- `Mission Copilot`
- `Opportunity Summary Generator`
- `Objection Response Assistant`
- `Negotiation Coach`
- `Follow-Up Writer`
- `Export Summary Writer`
- `Rep Coaching Insights`
- `Storm Zone Summary`
- `Company Voice / Prompt Templates`

## Documents
**Purpose:** Generate operational and sales documents from workflow context.

### Exact document types
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

### Document outputs
- PDF
- DOCX
- clipboard text
- print
- export package attachment

## Exports
**Purpose:** Push qualified opportunities into `JobNimbus`.

### Exact widgets
- `Ready To Export Queue`
- `Recently Exported`
- `Failed Exports`
- `Retry Queue`
- `Export Rules`
- `Handoff Summary Preview`

## 6. AI Architecture

AI should be embedded across the workflow, not isolated as a generic chatbot.

### AI layers
1. **Decision AI**
   - daily brief
   - top storm zone recommendation
   - next-best house
   - deployment suggestions
2. **Execution AI**
   - mission reprioritization
   - rerouting suggestions
   - saturation detection
   - team exception detection
3. **Communication AI**
   - documents
   - objections
   - negotiation
   - export summaries

### AI inputs
Every AI action should accept structured context:
- company profile
- storm event and storm zone
- property / house details
- mission state
- rep notes
- target outcome goal
- company tone
- export destination

### AI rules
- every output must be explainable
- every recommendation must include why it was generated
- AI can recommend / summarize / draft / coach
- AI should never silently mutate workflow-critical state without user visibility

## 7. Data Architecture

### Core entities
- `users`
- `teams`
- `branches`
- `rep_presence`
- `storm_events`
- `storm_zones`
- `territory_watchlists`
- `targets` / `houses`
- `target_scores`
- `missions`
- `mission_stops`
- `mission_events`
- `opportunity_exports`
- `documents`
- `ai_sessions`
- `ops_alerts`

### Important supporting entities
- `integration_sync_logs`
- `data_freshness_snapshots`
- `jobnimbus_export_queue`
- `document_templates`
- `company_ai_profiles`

## 8. API Architecture

### Dashboard APIs
- `GET /api/dashboard/today`
- `GET /api/dashboard/ai-brief`
- `GET /api/dashboard/export-summary`

### Storm APIs
- `GET /api/storms`
- `GET /api/storm-zones`
- `GET /api/storm-zones/:id`
- `POST /api/storm-zones/:id/generate-mission`
- `GET /api/watchlists`
- `POST /api/watchlists`

### Target / House APIs
- `GET /api/houses/today`
- `GET /api/houses/nearby`
- `GET /api/houses/:id`
- `POST /api/houses/:id/assign`
- `POST /api/houses/:id/send-to-jobnimbus`

### Mission APIs
- `GET /api/missions`
- `POST /api/missions`
- `POST /api/missions/create-from-storm`
- `GET /api/missions/:id`
- `PATCH /api/missions/:id`
- `PATCH /api/mission-stops/:id/outcome`
- `POST /api/missions/:id/rebalance`

### Presence / Team APIs
- `POST /api/presence/heartbeat`
- `POST /api/presence/start-mission`
- `POST /api/presence/end-mission`
- `GET /api/team/live`
- `GET /api/team/exceptions`
- `POST /api/team/reassign`

### AI APIs
- `POST /api/ai/daily-brief`
- `POST /api/ai/mission-copilot`
- `POST /api/ai/opportunity-summary`
- `POST /api/ai/objection-response`
- `POST /api/ai/negotiation-coach`
- `POST /api/ai/follow-up-writer`
- `POST /api/ai/reassignment-suggestions`
- `POST /api/ai/document-draft`

### Document APIs
- `GET /api/documents`
- `POST /api/documents/generate`
- `GET /api/documents/:id`
- `PATCH /api/documents/:id`
- `POST /api/documents/:id/export`

### Export APIs
- `GET /api/exports`
- `POST /api/exports/jobnimbus`
- `POST /api/exports/:id/retry`
- `GET /api/exports/:id/status`

## 9. Integrations

### Required
- `Xweather` for live + recent storm data
- `NWS` as fallback alert source
- `CoreLogic` for property / parcel intelligence
- `Mapbox` for maps
- `Google Directions` for premium routing
- local route fallback provider
- `OpenAI` for AI features
- `JobNimbus` for handoff/export

### Optional later
- SMS provider
- email provider
- analytics warehouse
- branch-level BI tooling

## 10. Geolocation Architecture

### Principles
- exact rep geolocation is only used during active mission mode or work mode
- geolocation powers routing, coverage, exceptions, and Mission Control
- position heartbeats should be sent every 15–60 seconds

### Geolocation use cases
- nearest next-best house
- rerouting to nearby high-value cluster
- idle detection
- off-route detection
- live mission progress
- coverage gap detection
- nearest rep to hot zone alert

## 11. Enterprise Requirements

### Product
- clear role-based experience
- multi-team ready
- branch-aware
- no dead-end screens
- every module connected to main workflow

### Frontend
- shared page shell
- consistent KPI strip
- consistent map/list interaction pattern
- unified drawers / modals / filters
- strong empty states and loading states
- TV mode support
- mobile rep mode

### Backend
- idempotent write APIs
- structured logging
- metrics + alerts
- audit history for exports, AI actions, and mission changes
- safe fallbacks for third-party outages
- feature flag control
- retryable exports

## 12. Build Priorities

### Phase 1
- Dashboard
- Storm Zones
- Houses To Hit Today
- basic AI Daily Brief

### Phase 2
- Mission creation and mission execution
- live rep geolocation
- Team exceptions screen

### Phase 3
- Mission Control TV mode
- JobNimbus export queue
- AI documents

### Phase 4
- Objection AI
- Negotiation AI
- branch/team maturity
- operational hardening
