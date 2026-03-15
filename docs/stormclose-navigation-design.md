# Stormclose V2 — Navigation & App Shell Design

> Canonical reference for routing, sidebar configuration, role visibility, page shell patterns, and mobile adaptation.
> Derives from: `PRODUCT_CONTRACT_V2.md` (Product Contract) and `stormclose-enterprise-architecture.md` (Architecture).
> Last updated: 2026-03-14

---

## 1. Route Map

All authenticated screens live under the `(dashboard)` route group. The group uses `src/app/(dashboard)/layout.tsx` which renders `DashboardShell` (sidebar + top nav + KPI strip + content area).

```
(dashboard)/
├── dashboard/                          → Dashboard (landing page, all roles)
│   ├── storms/                         → Storms (zone list + live map)
│   │   └── [id]/                       → Storm Zone Detail (drawer or inline)
│   ├── missions/                       → Missions (list + map)
│   │   ├── [id]/                       → Mission Detail (map + stops + progress)
│   │   └── active/                     → Active Mission (rep field mode)
│   ├── team/                           → Team (live rep map + exception feed)
│   │   └── [id]/                       → Rep Detail (drawer)
│   ├── mission-control/                → Mission Control (TV mode available)
│   ├── ai-studio/                      → AI Studio (module hub)
│   │   ├── daily-brief/                → Daily Brief Generator
│   │   ├── mission-copilot/            → Mission Copilot
│   │   ├── opportunity-summary/        → Opportunity Summary Generator
│   │   ├── objection-response/         → Objection Response Assistant
│   │   ├── negotiation-coach/          → Negotiation Coach
│   │   ├── follow-up-writer/           → Follow-Up Writer
│   │   ├── export-summary/             → Export Summary Writer
│   │   ├── rep-coaching/               → Rep Coaching Insights
│   │   ├── storm-zone-summary/         → Storm Zone Summary
│   │   └── company-voice/              → Company Voice / Prompt Templates
│   ├── documents/                      → Documents (generated docs list)
│   │   └── [id]/                       → Document Detail (view/edit/export)
│   ├── exports/                        → Exports (queue + history)
│   │   └── [id]/                       → Export Detail (status + retry)
│   └── houses/                         → (Not a sidebar item — accessed via Dashboard/Storms)
│       └── [id]/                       → House Detail (drawer)
├── settings/                           → Settings (hub)
│   ├── profile/                        → Profile
│   ├── company/                        → Company AI Profile
│   ├── team/                           → Team Admin
│   ├── branches/                       → Branch Management
│   ├── integrations/                   → Integration Health (JobNimbus, etc.)
│   └── billing/                        → Billing / Subscription
(auth)/
├── login/                              → Login
├── signup/                             → Signup
├── forgot-password/                    → Forgot Password
├── reset-password/                     → Reset Password
└── callback/                           → Auth Callback
```

### Route → Screen Label Mapping

| Route | Screen Label | Sidebar Item |
|---|---|---|
| `/dashboard` | Dashboard | Dashboard |
| `/dashboard/storms` | Storms | Storms |
| `/dashboard/storms/[id]` | Storm Zone Detail | — (drawer from Storms) |
| `/dashboard/missions` | Missions | Missions |
| `/dashboard/missions/[id]` | Mission Detail | — (drill-in from Missions) |
| `/dashboard/missions/active` | Active Mission | — (rep field mode) |
| `/dashboard/team` | Team | Team |
| `/dashboard/team/[id]` | Rep Detail | — (drawer from Team) |
| `/dashboard/mission-control` | Mission Control | Mission Control |
| `/dashboard/ai-studio` | AI Studio | AI Studio |
| `/dashboard/ai-studio/daily-brief` | Daily Brief Generator | — (tab within AI Studio) |
| `/dashboard/ai-studio/mission-copilot` | Mission Copilot | — (tab within AI Studio) |
| `/dashboard/ai-studio/opportunity-summary` | Opportunity Summary | — (tab within AI Studio) |
| `/dashboard/ai-studio/objection-response` | Objection Response | — (tab within AI Studio) |
| `/dashboard/ai-studio/negotiation-coach` | Negotiation Coach | — (tab within AI Studio) |
| `/dashboard/ai-studio/follow-up-writer` | Follow-Up Writer | — (tab within AI Studio) |
| `/dashboard/ai-studio/export-summary` | Export Summary Writer | — (tab within AI Studio) |
| `/dashboard/ai-studio/rep-coaching` | Rep Coaching Insights | — (tab within AI Studio) |
| `/dashboard/ai-studio/storm-zone-summary` | Storm Zone Summary | — (tab within AI Studio) |
| `/dashboard/ai-studio/company-voice` | Company Voice | — (tab within AI Studio) |
| `/dashboard/documents` | Documents | Documents |
| `/dashboard/documents/[id]` | Document Detail | — (drawer from Documents) |
| `/dashboard/exports` | Exports | Exports |
| `/dashboard/exports/[id]` | Export Detail | — (drawer from Exports) |
| `/dashboard/houses/[id]` | House Detail | — (drawer, contextual) |
| `/settings` | Settings | Settings |
| `/settings/profile` | Profile | — (tab within Settings) |
| `/settings/company` | Company AI Profile | — (tab within Settings) |
| `/settings/team` | Team Admin | — (tab within Settings) |
| `/settings/branches` | Branch Management | — (tab within Settings) |
| `/settings/integrations` | Integration Health | — (tab within Settings) |
| `/settings/billing` | Billing | — (tab within Settings) |

### Detail View Strategy

Detail views never navigate to a new page. They use **right-side drawers** (480px desktop, full-width mobile):

| Context | Drawer Trigger | Drawer Content |
|---|---|---|
| Houses To Hit Today row click | Table row | House Detail (address, scores, storm info, actions) |
| Storm Opportunity Zone click | Zone card or map marker | Storm Zone Detail (severity, houses, generate mission) |
| Mission stop row click | Table row | House Detail (stop status, outcome, AI assist) |
| Rep name click (Team/Mission Control) | Status board row | Rep Detail (location, mission, stats, actions) |
| Document row click | Table row | Document Detail (view, edit, export) |
| Export row click | Table row | Export Detail (status, payload preview, retry) |

---

## 2. Sidebar Config

```typescript
// src/config/navigation.ts

import type { LucideIcon } from "lucide-react";

export type UserRole = "owner" | "manager" | "rep" | "office_admin";

export interface NavItem {
  label: string;
  icon: string;           // Lucide icon name
  href: string;
  roles: UserRole[];      // roles that can see this item
  badge?: NavBadge;
  exact?: boolean;        // match route exactly (Dashboard only)
}

export interface NavBadge {
  source: string;          // API field or computed key
  variant: "live" | "count" | "alert" | "ai";
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    icon: "LayoutDashboard",
    href: "/dashboard",
    roles: ["owner", "manager", "rep", "office_admin"],
    exact: true,
  },
  {
    label: "Storms",
    icon: "CloudLightning",
    href: "/dashboard/storms",
    roles: ["owner", "manager"],
    badge: {
      source: "activeStormCount",
      variant: "live",
    },
  },
  {
    label: "Missions",
    icon: "Navigation",
    href: "/dashboard/missions",
    roles: ["owner", "manager", "rep"],
    badge: {
      source: "activeMissionCount",
      variant: "count",
    },
  },
  {
    label: "Team",
    icon: "Users",
    href: "/dashboard/team",
    roles: ["owner", "manager"],
    badge: {
      source: "exceptionCount",
      variant: "alert",
    },
  },
  {
    label: "Mission Control",
    icon: "Monitor",
    href: "/dashboard/mission-control",
    roles: ["owner", "manager", "office_admin"],
    badge: {
      source: "repsInField",
      variant: "live",
    },
  },
  {
    label: "AI Studio",
    icon: "Sparkles",
    href: "/dashboard/ai-studio",
    roles: ["owner", "manager", "rep", "office_admin"],
    badge: {
      source: undefined,
      variant: "ai",
    },
  },
  {
    label: "Documents",
    icon: "FileText",
    href: "/dashboard/documents",
    roles: ["owner", "manager", "office_admin"],
    badge: {
      source: "pendingDocCount",
      variant: "count",
    },
  },
  {
    label: "Exports",
    icon: "Upload",
    href: "/dashboard/exports",
    roles: ["owner", "manager", "office_admin"],
    badge: {
      source: "exportQueueCount",
      variant: "alert",
    },
  },
  {
    label: "Settings",
    icon: "Settings",
    href: "/settings",
    roles: ["owner", "manager", "rep", "office_admin"],
  },
];
```

### Badge Sources

| Badge Source | API Origin | Format |
|---|---|---|
| `activeStormCount` | `GET /api/dashboard/today` → `data.activeStorms` | Integer count; shows dot + count when > 0 |
| `activeMissionCount` | `GET /api/dashboard/today` → `data.activeMissions` | Integer count; hidden when 0 |
| `exceptionCount` | `GET /api/team/exceptions` → `data.length` | Integer count; red dot when > 0 |
| `repsInField` | `GET /api/team/live` → `data.repsActive` | Integer count; green dot when > 0 |
| `pendingDocCount` | `GET /api/documents?status=draft` → `meta.total` | Integer count; hidden when 0 |
| `exportQueueCount` | `GET /api/exports?status=pending` → `meta.total` | Integer count; red dot when > 3 |
| AI Studio | Static | Always shows purple "AI" pill |

### Icon Mapping (Lucide)

| Nav Item | Lucide Icon | Rationale |
|---|---|---|
| Dashboard | `LayoutDashboard` | Standard dashboard grid icon |
| Storms | `CloudLightning` | Storm/weather association |
| Missions | `Navigation` | Field navigation/compass |
| Team | `Users` | People/team |
| Mission Control | `Monitor` | Office display/TV mode |
| AI Studio | `Sparkles` | AI/intelligence |
| Documents | `FileText` | Document generation |
| Exports | `Upload` | Push/export to external system |
| Settings | `Settings` | Standard gear |

---

## 3. Role Visibility Matrix

### Screen × Role

| Screen | Owner | Manager | Rep | Office Admin |
|---|---|---|---|---|
| **Dashboard** | ✅ All widgets | ✅ All widgets | ✅ Filtered (own assignments) | ✅ All widgets |
| **Storms** | ✅ Full | ✅ Full | ❌ Hidden | ❌ Hidden |
| **Missions** | ✅ All missions | ✅ All missions | ✅ Own mission only | ❌ Hidden |
| **Team** | ✅ Full + cross-branch | ✅ Full (own branch) | ❌ Hidden | ❌ Hidden |
| **Mission Control** | ✅ Full | ✅ Full | ❌ Hidden | ✅ Read-only |
| **AI Studio** | ✅ All 10 modules | ✅ All 10 modules | ✅ 4 modules* | ✅ 3 modules** |
| **Documents** | ✅ Full | ✅ Full | ❌ Hidden | ✅ Full |
| **Exports** | ✅ Full | ✅ Full | ❌ Hidden | ✅ Full |
| **Settings** | ✅ All tabs | ✅ Profile, Team, Integrations | ✅ Profile only | ✅ Profile only |

\* **Rep AI Studio modules:** Mission Copilot, Objection Response, Negotiation Coach, Follow-Up Writer
\** **Office Admin AI Studio modules:** Export Summary Writer, Document Draft, Daily Brief Generator

### Dashboard Widget × Role

| Widget | Owner | Manager | Rep | Office Admin |
|---|---|---|---|---|
| AI Daily Brief | ✅ | ✅ | ✅ (own scope) | ✅ |
| Houses To Hit Today | ✅ | ✅ | ✅ (own assigned) | ✅ |
| Top Storm Zones | ✅ | ✅ | ❌ | ❌ |
| AI Deployment Plan | ✅ | ✅ | ❌ | ❌ |
| Live Team Snapshot | ✅ | ✅ | ❌ | ✅ |
| Unassigned Hot Clusters | ✅ | ✅ | ❌ | ❌ |
| Recent Qualified Opportunities | ✅ | ✅ | ✅ (own) | ✅ |
| Export Queue Summary | ✅ | ✅ | ❌ | ✅ |
| System Freshness / Data Health | ✅ | ✅ | ❌ | ❌ |

### Settings Tab × Role

| Settings Tab | Owner | Manager | Rep | Office Admin |
|---|---|---|---|---|
| Profile | ✅ | ✅ | ✅ | ✅ |
| Company AI Profile | ✅ | ❌ | ❌ | ❌ |
| Team Admin | ✅ | ✅ | ❌ | ❌ |
| Branch Management | ✅ | ❌ | ❌ | ❌ |
| Integration Health | ✅ | ✅ | ❌ | ❌ |
| Billing | ✅ | ❌ | ❌ | ❌ |

### Action × Role

| Action | Owner | Manager | Rep | Office Admin |
|---|---|---|---|---|
| Create mission | ✅ | ✅ | ❌ | ❌ |
| Assign mission | ✅ | ✅ | ❌ | ❌ |
| Activate/pause/complete mission | ✅ | ✅ | ✅ (own) | ❌ |
| Record stop outcome | ❌ | ❌ | ✅ | ❌ |
| Approve AI deployment plan | ✅ | ✅ | ❌ | ❌ |
| Reassign rep | ✅ | ✅ | ❌ | ❌ |
| Generate document | ✅ | ✅ | ✅ (leave-behind only) | ✅ |
| Process export queue | ✅ | ✅ | ❌ | ✅ |
| Retry failed export | ✅ | ✅ | ❌ | ✅ |
| Send to JobNimbus | ✅ | ✅ | ❌ | ✅ |
| Invoke AI assist (in-field) | ❌ | ❌ | ✅ | ❌ |
| Manage branches | ✅ | ❌ | ❌ | ❌ |
| Manage billing | ✅ | ❌ | ❌ | ❌ |
| Configure company AI profile | ✅ | ❌ | ❌ | ❌ |
| View cross-branch data | ✅ | ❌ | ❌ | ❌ |
| Share live location | ❌ | ❌ | ✅ | ❌ |

---

## 4. Page Shell Rules

Every authenticated page inside `(dashboard)/` renders inside `DashboardShell`. The shell enforces a consistent visual and structural pattern.

### 4.1 Shell Layout

```
┌──────────────────────────────────────────────────────────┐
│ Sidebar (72px collapsed / 264px expanded, fixed left)    │
├──────────────────────────────────────────────────────────┤
│ Top Nav (64px, sticky top, breadcrumb + search + user)   │
├──────────────────────────────────────────────────────────┤
│ KPI Strip (72px, contextual per-screen metrics)          │
├──────────────────────────────────────────────────────────┤
│ Content Area (scrollable, p-6)                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Page Header (title + subtitle + primary action)    │  │
│  ├────────────────────────────────────────────────────┤  │
│  │ Page Content (widgets/tables/maps)                 │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### 4.2 Header Pattern

Every screen renders a `PageHeader` component as the first child of the content area.

```
┌─────────────────────────────────────────────────────────┐
│  [Icon] Screen Title                    [Primary Action] │
│  Subtitle / description text            [Secondary]      │
└─────────────────────────────────────────────────────────┘
```

**Rules:**
- Title: `text-2xl font-bold text-white`
- Subtitle: `text-sm text-storm-muted mt-1`
- Icon: Lucide icon matching sidebar, `h-6 w-6 text-storm-purple`
- Primary action button: right-aligned, `bg-storm-purple hover:bg-storm-purple-hover rounded-xl px-4 py-2`
- Background: transparent (inherits `storm-bg` from shell)

| Screen | Title | Primary Action |
|---|---|---|
| Dashboard | Dashboard | — (none) |
| Storms | Storms | Save Watchlist |
| Missions | Missions | Create Mission |
| Team | Team | Reassign |
| Mission Control | Mission Control | Launch TV Mode |
| AI Studio | AI Studio | — (none) |
| Documents | Documents | Generate Document |
| Exports | Exports | Export All Ready |
| Settings | Settings | — (none) |

### 4.3 KPI Strip Pattern

A horizontal bar rendered between TopNav and content area. Each screen defines its own 4–6 contextual metrics.

```
┌──────────┬──────────┬──────────┬──────────┬──────────┐
│  Metric  │  Metric  │  Metric  │  Metric  │  Metric  │
│  Label   │  Label   │  Label   │  Label   │  Label   │
│  Value   │  Value   │  Value   │  Value   │  Value   │
│  Trend   │  Trend   │  Trend   │  Trend   │  Trend   │
└──────────┴──────────┴──────────┴──────────┴──────────┘
```

**Rules:**
- Container: `h-[72px] bg-storm-z2 border-b border-storm-border flex items-center px-6 gap-6`
- Each metric card: `flex flex-col justify-center min-w-[140px]`
- Label: `text-2xs uppercase tracking-wider text-storm-subtle`
- Value: `text-xl font-bold text-white` (primary metric uses `text-storm-purple`)
- Trend: `text-2xs` with `text-storm-success` (up) or `text-storm-danger` (down)
- First metric in the strip always uses `text-storm-purple` for its value (primary metric accent)

| Screen | KPI 1 (primary) | KPI 2 | KPI 3 | KPI 4 | KPI 5 | KPI 6 |
|---|---|---|---|---|---|---|
| Dashboard | Houses To Hit | Active Missions | Reps In Field | Exports Today | — | — |
| Storms | Active Zones | Total Impacted Houses | Avg Zone Score | Newest Storm Age | Unworked Clusters | — |
| Missions | Active Missions | Houses Remaining | Outcomes Recorded | Completion Rate | — | — |
| Team | Reps Active | Avg Houses/Rep | Coverage Gaps | Exceptions | — | — |
| Mission Control | Reps In Field | Houses Left | Qualified Today | Exported Today | Hot Zones | — |
| AI Studio | AI Calls Today | Avg Latency | Top Module | — | — | — |
| Documents | Generated Today | Drafts Pending | Exported | — | — | — |
| Exports | Ready To Export | Exported Today | Failed | Retry Queue | Success Rate | — |
| Settings | — (no KPI strip) | — | — | — | — | — |

### 4.4 Content Area Pattern

Below the KPI strip. Scrollable, padded.

**Rules:**
- Container: `min-h-[calc(100vh-4rem-72px)] p-6 animate-fade-in`
- Widget grid: `grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6` (for dashboard-style multi-widget layouts)
- Full-width sections (maps, tables): `col-span-full`
- Cards: `bg-storm-z2 border border-storm-border rounded-2xl shadow-depth-1 p-5`
- Card hover: `hover:shadow-glow-sm transition-shadow duration-200`
- Card header: `flex items-center justify-between mb-4`
- Card title: `text-sm font-semibold text-white`
- Card subtitle: `text-2xs text-storm-subtle`

### 4.5 Drawer Pattern

Right-side drawers for all detail views. Never navigate to a new page for detail views.

**Rules:**
- Overlay: `fixed inset-0 bg-black/50 backdrop-blur-sm z-50`
- Drawer panel: `fixed right-0 top-0 h-full w-[480px] bg-storm-z1 border-l border-storm-border shadow-depth-4 animate-slide-in-right`
- Mobile: `w-full` (full-width)
- Header: `flex items-center justify-between p-6 border-b border-storm-border`
- Close button: top-right, `X` icon
- Content: `overflow-y-auto p-6`
- Footer actions: `sticky bottom-0 p-4 border-t border-storm-border bg-storm-z1 flex gap-3 justify-end`

### 4.6 Modal Pattern

Centered overlay for confirmations and destructive actions only. Never for detail views.

**Rules:**
- Overlay: `fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center`
- Modal panel: `bg-storm-z2 border border-storm-border rounded-2xl shadow-depth-4 max-w-[560px] w-full mx-4 animate-scale-in`
- Header: `p-6 border-b border-storm-border`
- Content: `p-6`
- Footer: `p-4 border-t border-storm-border flex gap-3 justify-end`
- Destructive primary: `bg-storm-danger hover:bg-red-600`
- Standard primary: `bg-storm-purple hover:bg-storm-purple-hover`

**Use cases (exhaustive):**
- Confirm export to JobNimbus
- Confirm mission completion
- Confirm rep reassignment
- Delete watchlist
- Confirm bulk action
- Quick forms (create watchlist name, mission name)

### 4.7 Empty State Pattern

Every widget, table, and list must have a designed empty state.

**Rules:**
- Container: same card dimensions as populated state
- Icon: `h-12 w-12 text-storm-subtle/50 mx-auto`
- Heading: `text-sm font-medium text-storm-muted text-center mt-3`
- Body: `text-2xs text-storm-subtle text-center mt-1 max-w-[280px] mx-auto`
- Primary action: centered button below text, `bg-storm-purple rounded-xl px-4 py-2 text-sm`
- No blank white/black rectangles. Every empty container has this pattern.

| Widget | Empty Heading | Empty Action |
|---|---|---|
| Houses To Hit Today | No houses ranked yet | View Storms |
| Top Storm Zones | No active storm zones | — |
| AI Deployment Plan | No deployment plan generated | Generate Brief |
| Live Team Snapshot | No reps in field | — |
| Mission List | No missions created | Create Mission |
| Export Queue | No exports pending | — |
| Documents | No documents generated | Generate Document |
| Mission Stops | No stops in this mission | Add Houses |

### 4.8 Loading State Pattern

Skeleton loaders matching the widget layout. No spinners except for inline actions.

**Rules:**
- Skeleton bars: `bg-storm-z3 rounded-lg animate-shimmer`
- Match exact layout of populated widget (same heights, widths, spacing)
- Table skeleton: header row + 5 body rows with 3–5 columns of varying widths
- Card skeleton: title bar (h-4 w-1/3) + 3 content lines (h-3 w-full, h-3 w-2/3, h-3 w-1/2)
- Map skeleton: full-height `bg-storm-z3` with centered loading text
- KPI strip skeleton: 4–5 metric cards with `h-6 w-16` value + `h-3 w-20` label
- Inline spinners: `h-4 w-4 border-2 border-storm-purple border-t-transparent rounded-full animate-spin` — only for button loading states after user click

---

## 5. Current Nav Cleanup

### V1 → V2 Mapping

| Current V1 Nav Item | V1 Route | Action | V2 Target |
|---|---|---|---|
| Revenue Hub | `/dashboard` | **Rename** | Dashboard |
| Storm Ops | `/dashboard/command-center` | **Rename + Move** | Mission Control (`/dashboard/mission-control`) |
| AI Assistant | `/dashboard/ai-tools` | **Rename + Move** | AI Studio (`/dashboard/ai-studio`) |
| Deal Desk | `/dashboard/documents` | **Rename** | Documents |
| Team | `/dashboard/team` | **Keep** | Team |
| Settings | `/settings/billing` | **Keep** (route becomes `/settings`) | Settings |

### Items to Add (not in V1 sidebar)

| New Nav Item | Route | Notes |
|---|---|---|
| Storms | `/dashboard/storms` | New canonical screen; partially backed by V1 `/dashboard/storm-map` |
| Missions | `/dashboard/missions` | New canonical screen; partially backed by V1 `/dashboard/knock-list` + route planner |
| Mission Control | `/dashboard/mission-control` | Promoted from V1 "Storm Ops"; was `/dashboard/command-center` |
| Exports | `/dashboard/exports` | New canonical screen; partially backed by V1 `/dashboard/opportunities` + JobNimbus |

### V1 Dashboard Sub-Screens to Hide from Primary Navigation

These V1 screens must not appear in the sidebar. They are either merged into V2 screens, deprecated, or accessible only via deep links during migration.

| V1 Screen | V1 Route | Disposition |
|---|---|---|
| Storm Map | `/dashboard/storm-map` | Merged into **Storms** |
| Lead Scoring | `/dashboard/lead-scoring` | Merged into **Dashboard** (Houses To Hit Today scoring) |
| Knock List | `/dashboard/knock-list` | Merged into **Missions** (Assigned House List) |
| Knock Tracker | `/dashboard/knock-tracker` | Merged into **Missions** (Outcome Feed) |
| Field Map | `/dashboard/field-map` | Merged into **Team** (Live Rep Map) |
| Team Performance | `/dashboard/team-performance` | Merged into **Team** (Rep Leaderboard) |
| Opportunities | `/dashboard/opportunities` | Merged into **Exports** |
| Route Planner | `/dashboard/route-planner` | Merged into **Missions** (reroute/rebalance) |
| Smart Route | `/dashboard/smart-route` | Merged into **Missions** (route optimization) |
| Property Lookup | `/dashboard/property-lookup` | Available as enrichment in House Detail drawer |
| Territories | `/dashboard/territories` | Merged into **Storms** (Territory Watchlist Alerts) |
| JobNimbus | `/dashboard/jobnimbus` | Merged into **Exports** + **Settings** integration panel |
| Reports | `/dashboard/reports` | Merged into **Documents** |
| Report | `/report` | Merged into **Documents** |
| Objection | `/dashboard/objection` | Merged into **AI Studio** (Objection Response) |
| Negotiation | `/dashboard/negotiation` | Merged into **AI Studio** (Negotiation Coach) |
| Leads | `/dashboard/leads` | Merged into **Dashboard** (Houses To Hit Today) |
| Carriers | `/dashboard/carriers` | **Remove** (CRM/insurance drift) |
| Roof Measurement | `/dashboard/roof-measurement` | **Remove** (inspection drift) |
| Roof Measure | `/dashboard/roof-measure` | **Remove** (inspection drift) |
| Estimate Generator | `/dashboard/estimate-generator` | **Remove** (estimating drift) |
| Supplements | `/dashboard/supplements` | **Remove** (supplement drift) |
| Xactimate | `/dashboard/xactimate` | **Remove** (estimate drift) |

### Breadcrumb Label Updates

The `TopNav` breadcrumb map must be updated to reflect V2 labels:

| Route | Old Label | New Label |
|---|---|---|
| `/dashboard` | Dashboard | Dashboard |
| `/dashboard/storms` | — | Storms |
| `/dashboard/storms/[id]` | — | Storm Zone |
| `/dashboard/missions` | — | Missions |
| `/dashboard/missions/[id]` | — | Mission Detail |
| `/dashboard/missions/active` | — | Active Mission |
| `/dashboard/team` | Team | Team |
| `/dashboard/team/[id]` | — | Rep Detail |
| `/dashboard/mission-control` | Command Center | Mission Control |
| `/dashboard/ai-studio` | AI Tools | AI Studio |
| `/dashboard/ai-studio/*` | — | AI Studio › {Module} |
| `/dashboard/documents` | Documents | Documents |
| `/dashboard/documents/[id]` | — | Document |
| `/dashboard/exports` | — | Exports |
| `/dashboard/exports/[id]` | — | Export Detail |
| `/settings` | Settings | Settings |
| `/settings/*` | — | Settings › {Tab} |

---

## 6. Mobile / Rep Mode Notes

### Breakpoints

| Breakpoint | Width | Layout |
|---|---|---|
| Mobile | < 768px | Bottom tab bar, no sidebar, no KPI strip |
| Tablet | 768–1024px | Collapsed sidebar (72px), condensed KPI strip, stacked widgets |
| Desktop | > 1024px | Full layout with expandable sidebar, KPI strip, grid widgets |

### Mobile Navigation (Rep)

When the user is a **Rep** and viewport is < 768px, the shell switches to **Rep Mobile Mode**:

- **No sidebar.** Navigation uses a fixed bottom tab bar.
- **No top nav** (breadcrumb/search move to a simplified top bar with back button + title).
- **No KPI strip** (key metrics are inline in the active mission view).

**Bottom Tab Bar (4 items):**

| Tab | Icon | Route | Purpose |
|---|---|---|---|
| Mission | `Navigation` | `/dashboard/missions/active` | Active mission view (map + stops + progress) |
| Houses | `Home` | `/dashboard/missions/active#houses` | Scrolls to house list within active mission |
| AI | `Sparkles` | `/dashboard/ai-studio` | AI assist (Objection Response, Negotiation Coach, Follow-Up Writer, Mission Copilot) |
| Profile | `User` | `/settings/profile` | Personal profile + location sharing toggle |

**Bottom Tab Bar Rules:**
- Fixed position: `fixed bottom-0 left-0 right-0 z-50`
- Height: `h-16`
- Background: `bg-storm-z0 border-t border-storm-border`
- Active tab: `text-storm-purple` with glow dot
- Inactive tab: `text-storm-subtle`
- Safe area inset: `pb-safe` for devices with home indicator

### Mobile Navigation (Manager / Owner / Office Admin)

When the user is **not a Rep** and viewport is < 768px:

- **No sidebar.** Top hamburger menu opens a full-screen drawer with all 9 nav items.
- **Top bar:** compact, shows logo + current page title + hamburger icon + notification bell.
- **KPI strip:** condensed to 3 metrics in a horizontal scroll.
- **Drawers:** full-width instead of 480px.
- **Modals:** full-width with safe area padding.

### Rep Mobile Mode — What Is Visible

| Feature | Visible | Notes |
|---|---|---|
| Active mission map | ✅ | Full-screen map with route + stops |
| Assigned house list | ✅ | Scrollable list below map |
| Stop outcome capture | ✅ | Quick-action bottom sheet per stop |
| AI assist button | ✅ | Floating action button on mission view |
| Nearby next-best houses | ✅ | Inline section on mission view |
| Location sharing toggle | ✅ | In Profile tab, prominent toggle |
| Own stats / leaderboard position | ✅ | In Profile tab |
| Other reps' missions | ❌ | Never visible |
| Mission Control | ❌ | Never visible |
| Storms | ❌ | Never visible |
| Exports | ❌ | Never visible |
| Documents | ❌ | Never visible (except leave-behind generation from AI) |
| Settings beyond Profile | ❌ | Never visible |

### Mission Control TV Mode

When **TV Mode** is launched from the Mission Control page header:

- Sidebar: hidden
- Top nav: hidden
- KPI strip: hidden (metrics are embedded in the fullscreen layout)
- Content: full-viewport, no padding
- Auto-refresh: data refreshes every 30 seconds
- Typography: scaled up 1.5× for readability at distance
- Exit: `Escape` key or click anywhere shows a floating "Exit TV Mode" button
- Background: `bg-storm-bg`

---

## Implementation Notes

### File Changes Required

1. **`src/config/navigation.ts`** — Currently empty. Populate with the `NAV_ITEMS` config from Section 2.
2. **`src/components/dashboard/Sidebar.tsx`** — Replace hardcoded `navItems` array with import from `src/config/navigation.ts`. Add role-based filtering. Maintain existing collapse/expand behavior and visual styling.
3. **`src/components/dashboard/TopNav.tsx`** — Update `breadcrumbLabels` map to V2 route labels. No visual changes needed.
4. **`src/components/dashboard/DashboardShell.tsx`** — Add `KpiStrip` slot between `TopNav` and `main`. Accept `role: UserRole` prop for conditional rendering. No visual changes to existing shell.
5. **`src/components/dashboard/KpiStrip.tsx`** — New component implementing the 72px metric strip pattern from Section 4.3.
6. **`src/components/dashboard/PageHeader.tsx`** — New component implementing the header pattern from Section 4.2.
7. **`src/components/dashboard/Drawer.tsx`** — New shared right-side drawer component from Section 4.5.
8. **`src/components/dashboard/EmptyState.tsx`** — New shared empty state component from Section 4.7.
9. **`src/components/dashboard/MobileBottomNav.tsx`** — New component for rep mobile bottom tab bar.
10. **`src/types/database.ts`** — Add `role` field to `users` table type when V2 migration lands.

### Route Restructuring Required

1. Move `/dashboard/command-center` → `/dashboard/mission-control`
2. Move `/dashboard/ai-tools` → `/dashboard/ai-studio`
3. Create new routes: `/dashboard/storms`, `/dashboard/missions`, `/dashboard/exports`
4. Create sub-routes for AI Studio modules and Settings tabs
5. Add redirects from old V1 routes to V2 equivalents during migration period

### Dependencies

- `lucide-react` — icon library for sidebar icons (or continue using inline SVGs mapped to equivalent Lucide names)
- No new external dependencies required for navigation/shell changes
