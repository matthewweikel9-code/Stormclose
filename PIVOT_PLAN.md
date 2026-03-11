# StormClose AI - Pivot Plan
## From CRM → Sales & Office Assistant for JobNimbus + Xactimate

---

## 🎯 New Product Vision

**"StormClose AI - The AI-Powered Sales & Office Assistant for Storm Restoration"**

> Works alongside JobNimbus (your CRM) and Xactimate (your estimating) to help you find leads, close deals, and recover more money.

### What We ARE:
- AI sales assistant (objection handling, negotiation coaching)
- AI office assistant (supplement generation, documentation)
- Lead FINDER & SCORER (AI generates and scores leads from storm data)
- Route optimizer for door-knocking
- Xactimate companion (find missing line items, OCR estimates)
- JobNimbus companion (push leads/activities back to JN)

### What We ARE NOT:
- A full CRM (JobNimbus does this)
- A contact manager (JobNimbus does this)
- A project tracker (JobNimbus does this)
- An estimating tool (Xactimate does this)

---

## 📊 Feature Matrix: KEEP vs REMOVE vs MODIFY

### ✅ KEEP (Core Value - AI Tools)

| Feature | Description | Why Keep |
|---------|-------------|----------|
| **Objection Handler** | AI responses to homeowner objections | Core sales assistant value |
| **Supplement Generator** | Find missing Xactimate line items | Core Xactimate companion |
| **Negotiation Coach** | Live adjuster call assistance | Core sales assistant value |
| **Carrier Intelligence** | Insurance company tactics & data | Unique intel value |
| **Estimate OCR** | Parse adjuster estimate PDFs | Xactimate companion |
| **Documentation AI** | Generate inspection reports | Office assistant value |
| **Roof Measurement AI** | Quick satellite roof measurements | Office assistant value |

### ✅ KEEP (Modified - Lead & Route System)

| Feature | Current | Pivot To |
|---------|---------|----------|
| **Leads** | Full CRM pipeline | Lead FINDER only - AI generates scored leads |
| **Lead Scoring** | Manual + hail data | AI-powered scoring with property + storm data |
| **Routes** | Route planner | Keep as-is - door-knocking route optimizer |
| **Territories** | Storm command | Keep - define areas to monitor for storms |
| **Hail Events** | Storm data | Keep - powers lead scoring |

### ❌ REMOVE (CRM Duplication)

| Feature | Why Remove | JobNimbus Alternative |
|---------|------------|----------------------|
| **Customers Section** | Full contact management | JN Contacts |
| **Projects Section** | Job tracking | JN Jobs |
| **Estimates Section** | Estimate management | Xactimate + JN |
| **Activities Logging** | Activity tracking | JN Activities |
| **Pipeline Management** | Deal stages | JN Workflow |
| **Full Analytics** | CRM reporting | JN Reports |

### 🔄 ADD (New Integrations)

| Feature | Purpose |
|---------|---------|
| **JobNimbus Integration** | Push leads/notes to JN |
| **Xactimate ESX Import** | Parse & analyze estimates |
| **JobNimbus OAuth** | Connect user's JN account |

---

## 🗄️ Database Changes

### Tables to KEEP (as-is or modified)

```sql
-- KEEP: Core user/team system
users                    -- Auth & billing
teams                    -- Team subscriptions
team_members             -- Team membership

-- KEEP: Lead generation system (MODIFY: remove CRM fields)
leads                    -- AI-generated leads with scores
                         -- REMOVE: status pipeline, activities
                         -- KEEP: scoring, location, property data

-- KEEP: Storm intelligence
hail_events              -- NOAA storm data
territories              -- User-defined monitoring areas
storm_alerts             -- Real-time alerts

-- KEEP: Route planning
routes                   -- Door-knocking routes

-- KEEP: AI tools data
reports                  -- Generated documentation
objections               -- Objection responses
```

### Tables to REMOVE

```sql
-- REMOVE: CRM tables (handled by JobNimbus)
activities               -- → Push to JobNimbus instead
followups                -- → Push to JobNimbus instead
customers                -- → Use JobNimbus contacts
projects                 -- → Use JobNimbus jobs
estimates                -- → Use Xactimate
```

### Tables to ADD

```sql
-- ADD: Integration tables
CREATE TABLE jobnimbus_connections (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    jn_api_key TEXT ENCRYPTED,
    connected_at TIMESTAMPTZ,
    last_sync_at TIMESTAMPTZ
);

CREATE TABLE lead_exports (
    id UUID PRIMARY KEY,
    lead_id UUID REFERENCES leads(id),
    user_id UUID REFERENCES auth.users(id),
    destination TEXT, -- 'jobnimbus', 'csv'
    jn_contact_id TEXT, -- JobNimbus contact ID after export
    exported_at TIMESTAMPTZ
);
```

---

## 📱 New UI Structure

### Sidebar Navigation (After Pivot)

```
📊 Dashboard (AI Stats & Storm Overview)
├── Today's storm alerts
├── New AI-generated leads
└── Quick actions

🎯 Lead Finder (AI-Powered)
├── AI-generated leads with scores
├── Filter by score/location/storm
├── Export to JobNimbus
└── Add to route

🗺️ Route Planner
├── Build door-knocking routes
├── Optimized ordering
└── Mobile-friendly

⛈️ Storm Command
├── Active territories
├── Hail event map
└── Alert settings

─────────────────────────
🤖 AI TOOLS
─────────────────────────

💬 Objection Handler
├── Pre-built objections
└── Custom AI responses

📄 Supplement Generator
├── Upload adjuster estimate
└── Find missing line items

🎯 Negotiation Coach
├── Live call assistance
└── Carrier-specific tactics

🏢 Carrier Intelligence
├── Insurance company profiles
└── Tactics & approval rates

📐 Roof Measurement
└── Satellite roof sizing

─────────────────────────
⚙️ Settings
├── JobNimbus Connection
├── Notification preferences
└── Team management
```

---

## 🔌 API Integrations Needed

### 1. JobNimbus API Integration

**Base URL:** `https://api.jobnimbus.com`

**Endpoints to Use:**
```
POST /v1/contacts          -- Create contact from lead
POST /v1/activities        -- Log door knock activity
GET  /v1/contacts/list     -- Check if contact exists
PATCH /v1/contacts/{id}    -- Update contact notes
```

**Implementation:**
```typescript
// src/lib/jobnimbus/client.ts
export class JobNimbusClient {
  constructor(private apiKey: string) {}
  
  async createContact(lead: Lead) {
    // Push lead to JN as contact
  }
  
  async logActivity(contactId: string, activity: Activity) {
    // Log door knock, call, etc. to JN
  }
}
```

### 2. Xactimate Integration

**ESX/XML File Parsing:**
```typescript
// src/lib/xactimate/parser.ts
export function parseESXFile(file: Buffer): XactimateEstimate {
  // Parse ESX file (XML inside ZIP)
  // Extract line items, pricing, claim info
}

export function findMissingLineItems(
  adjusterEstimate: XactimateEstimate,
  propertyData: PropertyData
): MissingLineItem[] {
  // AI analysis to find commonly missed items
}
```

---

## 🔄 Migration Steps

### Phase 1: Remove CRM UI (Keep Data)
1. Remove `/customers` route and pages
2. Remove `/projects` route and pages  
3. Remove `/estimates` route and pages
4. Simplify Sidebar navigation
5. Update dashboard to focus on storms & leads

### Phase 2: Simplify Leads System
1. Remove pipeline/status tracking from leads
2. Focus leads UI on scoring & export
3. Add "Export to JobNimbus" button
4. Add "Add to Route" flow

### Phase 3: Add JobNimbus Integration
1. Create settings page for JN API key
2. Build JN client library
3. Implement "Export Lead" functionality
4. Implement "Log Activity" sync

### Phase 4: Enhance AI Tools
1. Improve supplement generator
2. Add ESX file upload/parsing
3. Enhance Xactimate code suggestions

---

## 📁 Files to DELETE

```
src/app/(dashboard)/customers/          -- Full directory
src/app/(dashboard)/projects/           -- Full directory
src/app/(dashboard)/estimates/          -- Full directory
src/app/(dashboard)/analytics/          -- Full directory (keep storm analytics)

src/services/customers/                 -- Full directory
src/services/projects/                  -- Full directory
src/services/estimates/                 -- Full directory

src/app/api/customers/                  -- If exists
src/app/api/projects/                   -- If exists
src/app/api/estimates/                  -- If exists
```

## 📁 Files to MODIFY

```
src/components/dashboard/Sidebar.tsx    -- Remove CRM nav items
src/app/(dashboard)/dashboard/          -- Simplify to storm focus
src/app/(dashboard)/dashboard/leads/    -- Remove pipeline, add export
src/app/api/leads/                      -- Remove CRM logic
src/types/                              -- Remove CRM types
```

## 📁 Files to ADD

```
src/lib/jobnimbus/
├── client.ts                           -- JN API client
├── types.ts                            -- JN types
└── sync.ts                             -- Sync logic

src/lib/xactimate/
├── parser.ts                           -- ESX/XML parser
├── line-items.ts                       -- Common line items DB
└── analyzer.ts                         -- Missing item detection

src/app/api/integrations/
├── jobnimbus/
│   ├── connect/route.ts                -- Save API key
│   ├── export-lead/route.ts            -- Export lead to JN
│   └── sync-activity/route.ts          -- Sync activity to JN
└── xactimate/
    └── parse/route.ts                  -- Parse ESX file

src/app/(dashboard)/settings/
└── integrations/
    └── page.tsx                        -- JN connection settings
```

---

## 🎨 New Dashboard Design

### Main Dashboard (Storm-Focused)

```
┌─────────────────────────────────────────────────────────────┐
│  ⛈️ ACTIVE STORM ALERTS                           [View All] │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │ 🔴 Hail Event   │  │ 🟡 Watch        │                   │
│  │ Plano, TX       │  │ McKinney, TX    │                   │
│  │ 1.75" • 2hrs ago│  │ Until 6PM       │                   │
│  └─────────────────┘  └─────────────────┘                   │
├─────────────────────────────────────────────────────────────┤
│  🎯 AI-GENERATED LEADS                       [Generate More] │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Score │ Address              │ Storm  │ Actions         ││
│  │ 95 🔥 │ 1234 Oak St, Plano  │ 1.75"  │ [Route] [Export]││
│  │ 87    │ 5678 Elm Ave, Allen │ 1.50"  │ [Route] [Export]││
│  │ 82    │ 910 Pine Rd, Frisco │ 1.25"  │ [Route] [Export]││
│  └─────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│  🤖 QUICK AI TOOLS                                          │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐│
│  │ Objection  │ │ Supplement │ │ Negotiate  │ │ Roof       ││
│  │ Handler    │ │ Generator  │ │ Coach      │ │ Measure    ││
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Lead Finder Page (Simplified)

```
┌─────────────────────────────────────────────────────────────┐
│  🎯 LEAD FINDER                                             │
│                                                             │
│  [📍 Location ▼] [⛈️ Storm ▼] [📊 Min Score: 70] [Generate] │
├─────────────────────────────────────────────────────────────┤
│  ☑️ Select All                    [Add to Route] [→ Export] │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ ☐ 🔥 95 │ 1234 Oak St, Plano, TX 75024                 ││
│  │         │ Built: 2005 • Roof: 28 sq • Storm: 1.75"     ││
│  │         │ Est. Claim: $18,500                          ││
│  ├─────────────────────────────────────────────────────────┤│
│  │ ☐    87 │ 5678 Elm Ave, Allen, TX 75002                ││
│  │         │ Built: 2008 • Roof: 22 sq • Storm: 1.50"     ││
│  │         │ Est. Claim: $14,200                          ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  💡 Leads are AI-scored based on storm damage, roof age,   │
│     property value, and neighborhood activity.              │
│                                                             │
│  → Export to JobNimbus to add to your sales pipeline        │
└─────────────────────────────────────────────────────────────┘
```

---

## ⏱️ Implementation Timeline

### Week 1: Remove CRM
- [ ] Delete customers, projects, estimates pages
- [ ] Update Sidebar navigation
- [ ] Simplify dashboard
- [ ] Clean up unused services

### Week 2: Simplify Leads
- [ ] Remove pipeline/status from leads UI
- [ ] Add export functionality
- [ ] Add "Add to Route" flow
- [ ] Focus on scoring display

### Week 3: JobNimbus Integration
- [ ] Build JN API client
- [ ] Create connection settings page
- [ ] Implement lead export
- [ ] Test with real JN account

### Week 4: Polish & Launch
- [ ] Update landing page messaging
- [ ] Update pricing page
- [ ] Documentation
- [ ] Beta testing

---

## 💰 New Pricing Alignment

| Tier | Price | Features |
|------|-------|----------|
| **Free** | $0 | 10 AI queries/mo, 5 leads/mo |
| **Pro** | $49/mo | Unlimited AI tools, 100 leads/mo, Route planner |
| **Pro+** | $99/mo | + Supplement generator, Negotiation coach, 500 leads/mo |
| **Enterprise** | $199/mo | + Carrier intel, Roof measurement, Unlimited leads, JN sync |

---

## ✅ Ready to Execute?

This pivot transforms StormClose from a "CRM competitor" into a "CRM companion" that adds unique AI value without duplicating JobNimbus or Xactimate functionality.

**Next Steps:**
1. Review this plan
2. Confirm which phase to start
3. Begin removing CRM features
4. Build JobNimbus integration

Let me know when you're ready to start implementing!
