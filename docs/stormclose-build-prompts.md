# Stormclose Build Prompts

Use this document as the step-by-step prompt sequence for `Claude Opus 4.6` and `GPT-5.3 Codex` to rebuild `Stormclose` into the new architecture.

## How to Use These Prompts

- Use **Claude** for product shaping, architecture refinement, information architecture, and detailed implementation plans.
- Use **Codex** for direct repo implementation, migrations, APIs, components, tests, and commits.
- Each phase should result in:
  - code changes
  - tests
  - a commit
  - a short status summary
- Keep the existing `Stormclose` logo, name, color palette, and overall premium frontend vibe.
- Do **not** turn the product into a CRM, scheduler, or job management tool.
- Keep `JobNimbus` as the system of record after qualified opportunity handoff.

---

## Phase 0 — Product Lock + Existing UI Preservation

### Claude Prompt
```text
You are helping redesign an existing SaaS called Stormclose.

Important product constraints:
- Keep the existing logo, name, and color palette.
- Preserve the premium visual identity and frontend vibe.
- Do NOT redesign the brand from scratch.
- Stormclose is NOT a CRM, scheduler, or job management platform.
- Stormclose IS an AI storm sales operating system for roofing teams.
- JobNimbus remains the downstream system of record.
- Core workflow is: storm -> zone -> house -> mission -> team -> AI assist -> document -> export.

Your task:
1. Review the attached architecture document.
2. Produce a final product contract for Stormclose V2.
3. Define the product pillars, role definitions, primary workflow, and no-build list.
4. Write a concise implementation contract that a coding model can follow without drifting.

Output format:
- Product thesis
- Product pillars
- Core workflow
- Roles
- No-build list
- Non-negotiable UI/brand constraints
- Non-negotiable architecture constraints
```

### Codex Prompt
```text
Read `docs/stormclose-enterprise-architecture.md` and the finalized product contract.

Your task:
1. Audit the current repo structure against the target architecture.
2. Create a markdown file `docs/stormclose-gap-analysis.md`.
3. In that file, map:
   - existing screens to target screens
   - existing APIs to target APIs
   - reusable modules
   - dead weight / hide-for-now surfaces
   - migration needs
4. Do not change application behavior yet.
5. Commit the gap analysis.

Output required:
- Exact reuse list
- Exact remove/hide list
- Exact architectural gaps
- Prioritized implementation order
```

---

## Phase 1 — Navigation + App Shell Refactor

### Claude Prompt
```text
Design the exact navigation, route hierarchy, and role-aware app shell for Stormclose V2.

Constraints:
- Preserve brand identity and current premium aesthetic.
- Main nav should be:
  Dashboard, Storms, Missions, Team, Mission Control, AI Studio, Documents, Exports, Settings
- Role-aware navigation for owner, manager, rep, office admin.
- Dashboard must become the daily action center focused on Houses To Hit Today.

Output:
- route map
- sidebar structure
- top nav behavior
- role visibility matrix
- what current nav items should be hidden or merged
- UX rules for consistent page shells
```

### Codex Prompt
```text
Implement Phase 1 for Stormclose V2.

Requirements:
- Refactor navigation to match the target route hierarchy.
- Hide or remove non-core nav items from the primary sidebar.
- Preserve the current Stormclose branding, logo, colors, and premium style.
- Create role-aware navigation scaffolding.
- Do not build all target pages yet; placeholders are acceptable if clearly structured.
- Add tests for any role-based navigation logic.

Deliverables:
- updated navigation and layout components
- role-aware sidebar config
- placeholder routes if needed
- tests
- commit
```

---

## Phase 2 — Dashboard / Houses To Hit Today

### Claude Prompt
```text
Design the Stormclose V2 Dashboard in detail.

It must be an enterprise-level daily action center with these widgets:
- AI Daily Brief
- Houses To Hit Today
- Top Storm Zones
- AI Deployment Plan
- Live Team Snapshot
- Unassigned Hot Clusters
- Recent Qualified Opportunities
- Export Queue Summary

Your task:
- define exact widget responsibilities
- define widget data contracts
- define KPI calculations
- define row-level actions for Houses To Hit Today
- define owner/manager/rep differences

Output:
- full dashboard information architecture
- widget-by-widget data specification
- interaction design notes
```

### Codex Prompt
```text
Implement Phase 2 for Stormclose V2.

Requirements:
- Build the new Dashboard as the product home.
- Preserve current brand identity and design tone.
- Create backend endpoints or adapters needed to feed:
  AI Daily Brief, Houses To Hit Today, Top Storm Zones, AI Deployment Plan, Live Team Snapshot, Unassigned Hot Clusters, Recent Qualified Opportunities, Export Queue Summary.
- Reuse current APIs/services where practical, but reorganize them to match the new workflow.
- Add unit/integration tests for the new dashboard data route(s).
- Do not add CRM or scheduling concepts.

Deliverables:
- dashboard page
- dashboard data API(s)
- types/contracts
- tests
- commit
```

---

## Phase 3 — Storm Intelligence + Territory Watchlists

### Claude Prompt
```text
Design the Stormclose V2 Storms module.

It should turn raw storm data into actionable zones, not just maps.

Required features:
- live storm map
- recent storm timeline
- storm opportunity zones
- territory watchlist alerts
- storm detail drawer
- unworked opportunity clusters
- AI recommendation panel

Define:
- exact UX structure
- storm zone object model
- watchlist behavior
- AI ranking criteria for top zones
- what the owner vs manager vs rep should see
```

### Codex Prompt
```text
Implement Phase 3 for Stormclose V2.

Requirements:
- Build/reshape the Storms module around actionable storm zones.
- Add territory watchlists and alerts.
- Use existing Xweather/NWS infrastructure where possible.
- Add or adapt the backend to expose storm zones and watchlist alerts.
- Preserve current brand and visual system.
- Add tests around zone generation / alert logic where feasible.

Deliverables:
- storms page/module
- watchlist settings/data flow
- storm zone API(s)
- tests
- commit
```

---

## Phase 4 — Missions + Field Workflow + Geolocation

### Claude Prompt
```text
Design the Stormclose V2 mission system as an AI-assisted field workflow.

Important constraints:
- the owner should NOT manually assign everyone all day
- AI should create or recommend deployment by default
- exact rep geolocation matters during active mission mode
- rep tracking should support live operations, next-best house, coverage gaps, and exception handling
- this is NOT appointment scheduling

Define:
- mission lifecycle
- stop lifecycle
- live presence model
- exact rep workflow
- exact manager workflow
- next-best house logic
- exception types
- privacy model for geolocation
```

### Codex Prompt
```text
Implement Phase 4 for Stormclose V2.

Requirements:
- Build or refactor missions around the new lifecycle.
- Add rep live presence / heartbeat infrastructure.
- Add geolocation-aware mission behavior for active mission mode.
- Add stop outcomes: new, targeted, attempted, no_answer, interested, not_interested, follow_up_needed, sent_to_jobnimbus.
- Add backend contracts for live presence and mission progress.
- Keep the product out of scheduling/CRM territory.
- Add tests for mission state transitions and presence handling.

Deliverables:
- mission data model updates
- mission UI flow
- presence endpoints/services
- tests
- commit
```

---

## Phase 5 — Team Operations + Exceptions

### Claude Prompt
```text
Design the Stormclose V2 Team module.

It should be an exceptions and live operations screen, not a micromanagement screen.

Required widgets:
- Live Rep Map
- Rep Status Board
- Coverage Gaps
- AI Reassignment Suggestions
- Rep Leaderboard
- Exception Feed
- Rep Detail Drawer

Define:
- exact exception logic
- status model for reps
- location-aware team behaviors
- what owners/managers should be able to override manually
- what should remain fully automatic
```

### Codex Prompt
```text
Implement Phase 5 for Stormclose V2.

Requirements:
- Build the Team screen around live field operations and exceptions.
- Add the exact widgets from the target architecture.
- Use geolocation/presence data from Phase 4.
- Surface AI suggestions without allowing silent uncontrolled state changes.
- Add tests for exception generation logic.

Deliverables:
- team screen
- exception APIs/services
- rep status model
- tests
- commit
```

---

## Phase 6 — Mission Control TV Mode

### Claude Prompt
```text
Design Mission Control as a fullscreen enterprise TV mode for Stormclose.

Required features:
- live map with storm zones and rep dots
- KPI tower
- AI Priority Zone
- Reps In Field
- Active Missions
- Houses Left To Hit
- Qualified Opportunities Today
- Sent To JobNimbus Today
- Top Rep/Team
- Unworked Hot Cluster
- Live Storm Alert
- AI Ops Insight
- rotating ticker/panels

Define exact layout, refresh behavior, information density, and what should rotate automatically.
```

### Codex Prompt
```text
Implement Phase 6 for Stormclose V2.

Requirements:
- Build Mission Control as a fullscreen TV-ready route.
- Use existing branding and premium dark visual system.
- Pull live data from storms, missions, team presence, and exports.
- Add auto-refresh and optional rotating panels.
- Make the experience visually polished and enterprise-grade.
- Add smoke tests or basic coverage for the data endpoint(s).

Deliverables:
- Mission Control route/page
- live summary API(s)
- refresh behavior
- tests
- commit
```

---

## Phase 7 — AI Studio

### Claude Prompt
```text
Design AI Studio for Stormclose V2.

It should not be a generic chatbot page.
It should be a structured AI workbench with these modules:
- Daily Brief Generator
- Mission Copilot
- Opportunity Summary Generator
- Objection Response Assistant
- Negotiation Coach
- Follow-Up Writer
- Export Summary Writer
- Rep Coaching Insights
- Storm Zone Summary
- Company Voice / Prompt Templates

Define:
- exact IA
- module interaction model
- shared AI context contract
- output types
- role visibility rules
```

### Codex Prompt
```text
Implement Phase 7 for Stormclose V2.

Requirements:
- Build AI Studio as a structured task-based interface.
- Add shared AI context contracts for storms, houses, missions, notes, and company profile.
- Reuse existing AI helpers where possible but refactor to fit the new architecture.
- Add tests for prompt-shaping utilities / output contracts where feasible.

Deliverables:
- AI Studio UI
- AI service abstractions
- prompt context contracts
- tests
- commit
```

---

## Phase 8 — Documents + Objections + Negotiation

### Claude Prompt
```text
Design the Documents, Objection AI, and Negotiation AI workflow for Stormclose V2.

Requirements:
- Documents must be workflow-connected, not random writing tools.
- Objection AI and Negotiation AI must be contextual and operational.
- All three must connect to storms, houses, missions, notes, and export handoff.

Define:
- exact document types
- exact objection categories
- exact negotiation categories
- where each tool appears in workflow
- export/output formats
- role permissions
```

### Codex Prompt
```text
Implement Phase 8 for Stormclose V2.

Requirements:
- Build the Documents module.
- Build objection response and negotiation support modules.
- Ensure these tools are accessible from the relevant workflow surfaces (dashboard, mission, house/opportunity, AI Studio).
- Add export options like PDF/DOCX/clipboard where reasonable within current stack.
- Add tests around document metadata/contracts and AI tool routing.

Deliverables:
- Documents page/module
- objection AI module
- negotiation AI module
- workflow entry points
- tests
- commit
```

---

## Phase 9 — JobNimbus Handoff + Export Queue

### Claude Prompt
```text
Design the Stormclose V2 Exports module.

Stormclose should feed qualified opportunities into JobNimbus, not replace it.

Required features:
- Ready To Export Queue
- Recently Exported
- Failed Exports
- Retry Queue
- Export Rules
- Handoff Summary Preview

Define:
- export criteria
- approval behavior
- retry behavior
- exact data package sent to JobNimbus
- what export state should be visible across dashboard/team/mission control
```

### Codex Prompt
```text
Implement Phase 9 for Stormclose V2.

Requirements:
- Build the Exports module and JobNimbus handoff queue.
- Add retry-safe export behavior.
- Add clear export statuses.
- Reuse existing JobNimbus integration where practical.
- Add tests for export queue logic and failure handling.

Deliverables:
- exports UI
- export APIs/services
- queue/retry logic
- tests
- commit
```

---

## Phase 10 — Enterprise Hardening

### Claude Prompt
```text
Define the enterprise hardening checklist for Stormclose V2.

Focus on:
- backend maturity
- role-based access
- operational resilience
- observability
- freshness indicators
- data confidence indicators
- audit trails
- deployment safety
- error/empty/loading states
- enterprise polish and trust

Output a concrete readiness checklist.
```

### Codex Prompt
```text
Implement Phase 10 for Stormclose V2.

Requirements:
- Apply enterprise hardening across the new architecture.
- Add or improve:
  - auditability
  - freshness indicators
  - data health states
  - consistent loading/empty/error states
  - observability gaps
  - role enforcement gaps
  - retry/fallback logic where missing
- Run targeted tests and smoke checks.
- Produce a readiness summary doc.

Deliverables:
- hardening changes
- readiness summary doc
- tests / smoke checks
- commit
```

---

## Final Master Prompt (Optional)

Use this once the phase docs exist and you want Codex to execute from the repo state directly.

### Codex Master Prompt
```text
You are rebuilding Stormclose into an enterprise-grade AI storm sales operating system.

Read these files first:
- docs/stormclose-enterprise-architecture.md
- docs/stormclose-build-prompts.md
- docs/stormclose-gap-analysis.md (if present)

Non-negotiable constraints:
- Keep the current Stormclose logo, name, color palette, and premium visual identity.
- Do NOT turn the product into a CRM, scheduler, or job management platform.
- Keep JobNimbus as the downstream system of record.
- The main workflow must remain: storm -> zone -> house -> mission -> team -> AI assist -> document -> export.
- Enterprise feel is required across UI, frontend architecture, backend reliability, and AI behavior.

Execution rules:
- Implement one phase at a time.
- Reuse current code where it makes sense.
- Hide/deprioritize non-core surfaces rather than preserving clutter.
- Add tests for new logic.
- Keep commits small and phase-based.
- Summarize what changed after each phase.

Start with Phase 1 and do not jump ahead until the phase is complete and stable.
```
