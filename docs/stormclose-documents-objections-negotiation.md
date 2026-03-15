# Stormclose V2 — Documents, Objection AI & Negotiation AI Specification

> Canonical reference for the Documents module, Objection Response AI, and Negotiation Coach AI.
> Derives from: `PRODUCT_CONTRACT_V2.md` §5 (Documents, AI Studio), §7 (Architecture Constraints), `stormclose-enterprise-architecture.md` §5 (Documents screen, AI Studio), §6 (AI Architecture), §8 (Document APIs), `stormclose-ai-studio.md` §4 (Module Specifications for objection-response and negotiation-coach), `stormclose-navigation-design.md` §1 (Route Map).
> Builds on: `src/lib/ai/modules/objectionResponse.ts`, `src/lib/ai/modules/negotiationCoach.ts`, `src/lib/ai/modules/followUpWriter.ts`, `src/lib/ai/modules/exportSummary.ts`, `src/lib/objection-library.ts` (50+ objection templates), `src/lib/pdf.ts` (existing PDF generation), `src/types/ai-context.ts` (AiContext contract).
> Last updated: 2026-03-14

---

## 1. Documents Module Overview

**Purpose:** Generate operational and sales documents from structured workflow context. Documents are always connected to a workflow entity (storm zone, house, mission, opportunity, or team) — never blank-page writing tools.

**Route:** `/dashboard/documents`

**Sidebar:** Seventh item, `FileText` icon, badge shows `pendingDocumentCount` (integer count of documents in "draft" status).

**Role visibility:**

| Role | Access |
|---|---|
| Owner | ✅ Full — all 10 document types, all actions |
| Manager | ✅ Full — all 10 document types, all actions |
| Rep | ⚠️ Partial — can generate: leave-behind, rep field recap. Can view own documents. |
| Office Admin | ✅ Full — all 10 document types, all actions. Primary doc generator. |

---

## 2. Document Data Model

### 2.1 `documents` Table

```sql
-- Migration: supabase/migrations/20260315_documents.sql

CREATE TYPE document_type AS ENUM (
    'homeowner_follow_up_letter',
    'neighborhood_flyer',
    'storm_impact_summary',
    'mission_recap',
    'manager_daily_summary',
    'office_summary',
    'qualified_opportunity_handoff',
    'claim_explanation_letter',
    'leave_behind',
    'rep_field_recap'
);

CREATE TYPE document_status AS ENUM (
    'draft',
    'final',
    'exported'
);

CREATE TYPE document_format AS ENUM (
    'pdf',
    'docx',
    'clipboard',
    'print'
);

CREATE TYPE document_context_type AS ENUM (
    'storm_zone',
    'house',
    'mission',
    'opportunity',
    'team',
    'company'
);

CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type document_type NOT NULL,
    title TEXT NOT NULL,
    status document_status NOT NULL DEFAULT 'draft',

    -- Workflow context reference
    context_type document_context_type NOT NULL,
    context_id UUID NOT NULL,

    -- Content
    content TEXT NOT NULL,               -- Markdown content body
    content_html TEXT,                    -- Pre-rendered HTML (for print/export)
    metadata JSONB DEFAULT '{}',         -- Document-type-specific metadata

    -- Output
    format document_format NOT NULL DEFAULT 'pdf',
    file_url TEXT,                        -- S3/Supabase Storage URL if exported to file

    -- Ownership
    created_by UUID NOT NULL REFERENCES auth.users(id),
    company_id UUID,
    branch_id UUID,

    -- Export tracking
    exported BOOLEAN NOT NULL DEFAULT FALSE,
    exported_at TIMESTAMPTZ,
    export_destination TEXT,              -- 'jobnimbus', 'email', 'download', etc.

    -- AI generation metadata
    ai_session_id UUID,                   -- Reference to ai_sessions table
    model_used TEXT,
    token_count INTEGER,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS documents_type_idx ON documents(type);
CREATE INDEX IF NOT EXISTS documents_status_idx ON documents(status);
CREATE INDEX IF NOT EXISTS documents_context_idx ON documents(context_type, context_id);
CREATE INDEX IF NOT EXISTS documents_created_by_idx ON documents(created_by);
CREATE INDEX IF NOT EXISTS documents_created_at_idx ON documents(created_at DESC);
CREATE INDEX IF NOT EXISTS documents_company_idx ON documents(company_id);

-- RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company documents"
    ON documents FOR SELECT
    USING (created_by = auth.uid() OR company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
    ));

CREATE POLICY "Users can insert documents"
    ON documents FOR INSERT
    WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update own documents"
    ON documents FOR UPDATE
    USING (created_by = auth.uid());
```

### 2.2 `document_templates` Table

```sql
CREATE TABLE IF NOT EXISTS document_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type document_type NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    system_prompt TEXT NOT NULL,          -- AI system prompt for this template
    user_prompt_template TEXT NOT NULL,   -- User prompt with {{variable}} placeholders
    variables JSONB NOT NULL DEFAULT '[]', -- Array of { name, label, required, default }
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    company_id UUID,                      -- NULL = system template, non-null = company override
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(type, company_id, is_default)
);

CREATE INDEX IF NOT EXISTS document_templates_type_idx ON document_templates(type);
CREATE INDEX IF NOT EXISTS document_templates_company_idx ON document_templates(company_id);
```

### 2.3 TypeScript Types

```typescript
// src/types/documents.ts

// ── Document Types ───────────────────────────────────────────────────────────

export type DocumentType =
  | "homeowner_follow_up_letter"
  | "neighborhood_flyer"
  | "storm_impact_summary"
  | "mission_recap"
  | "manager_daily_summary"
  | "office_summary"
  | "qualified_opportunity_handoff"
  | "claim_explanation_letter"
  | "leave_behind"
  | "rep_field_recap";

export type DocumentStatus = "draft" | "final" | "exported";

export type DocumentFormat = "pdf" | "docx" | "clipboard" | "print";

export type DocumentContextType =
  | "storm_zone"
  | "house"
  | "mission"
  | "opportunity"
  | "team"
  | "company";

// ── Document Entity ──────────────────────────────────────────────────────────

export interface Document {
  id: string;
  type: DocumentType;
  title: string;
  status: DocumentStatus;
  contextType: DocumentContextType;
  contextId: string;
  content: string;
  contentHtml: string | null;
  metadata: DocumentMetadata;
  format: DocumentFormat;
  fileUrl: string | null;
  createdBy: string;
  companyId: string | null;
  branchId: string | null;
  exported: boolean;
  exportedAt: string | null;
  exportDestination: string | null;
  aiSessionId: string | null;
  modelUsed: string | null;
  tokenCount: number | null;
  createdAt: string;
  updatedAt: string;
}

// ── Document Metadata (type-specific) ────────────────────────────────────────

export type DocumentMetadata =
  | HomeownerFollowUpMetadata
  | NeighborhoodFlyerMetadata
  | StormImpactSummaryMetadata
  | MissionRecapMetadata
  | ManagerDailySummaryMetadata
  | OfficeSummaryMetadata
  | QualifiedOpportunityHandoffMetadata
  | ClaimExplanationMetadata
  | LeaveBehindMetadata
  | RepFieldRecapMetadata
  | Record<string, unknown>;

export interface HomeownerFollowUpMetadata {
  homeownerName: string;
  propertyAddress: string;
  visitDate: string;
  repName: string;
  followUpReason: string;
  appointmentDate: string | null;
}

export interface NeighborhoodFlyerMetadata {
  neighborhoodName: string;
  stormZoneName: string;
  stormDate: string;
  housesAffectedCount: number;
}

export interface StormImpactSummaryMetadata {
  stormZoneId: string;
  stormZoneName: string;
  severity: string;
  housesImpacted: number;
  missionsGenerated: number;
}

export interface MissionRecapMetadata {
  missionId: string;
  missionName: string;
  repName: string;
  stopsCompleted: number;
  stopsTotal: number;
  interestedCount: number;
  duration: string;
}

export interface ManagerDailySummaryMetadata {
  reportDate: string;
  missionsActive: number;
  missionsCompleted: number;
  housesHit: number;
  appointmentsSet: number;
  exportsSent: number;
}

export interface OfficeSummaryMetadata {
  reportDate: string;
  branchName: string | null;
  activeZoneCount: number;
  totalHousesWorked: number;
  exportQueueSize: number;
}

export interface QualifiedOpportunityHandoffMetadata {
  houseId: string;
  homeownerName: string;
  propertyAddress: string;
  estimatedValue: string;
  interestLevel: "high" | "medium" | "low";
  exportId: string | null;
}

export interface ClaimExplanationMetadata {
  homeownerName: string;
  propertyAddress: string;
  insuranceCarrier: string | null;
  damageType: string;
  stormDate: string;
}

export interface LeaveBehindMetadata {
  homeownerName: string | null;
  propertyAddress: string;
  repName: string;
  visitDate: string;
  damageFindings: string[];
}

export interface RepFieldRecapMetadata {
  repName: string;
  missionName: string;
  date: string;
  doorsKnocked: number;
  appointmentsSet: number;
  notableOutcomes: string[];
}

// ── Document Template ────────────────────────────────────────────────────────

export interface DocumentTemplate {
  id: string;
  type: DocumentType;
  name: string;
  description: string | null;
  systemPrompt: string;
  userPromptTemplate: string;
  variables: DocumentTemplateVariable[];
  isDefault: boolean;
  companyId: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentTemplateVariable {
  name: string;
  label: string;
  required: boolean;
  default: string | null;
}

// ── API Request / Response ───────────────────────────────────────────────────

export interface GenerateDocumentRequest {
  type: DocumentType;
  contextType: DocumentContextType;
  contextId: string;
  format: DocumentFormat;
  templateId?: string;
  overrides?: Record<string, string>;
  title?: string;
}

export interface DocumentListFilters {
  type?: DocumentType;
  status?: DocumentStatus;
  contextType?: DocumentContextType;
  contextId?: string;
  createdBy?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export interface DocumentListResponse {
  data: Document[];
  meta: {
    total: number;
    page: number;
    limit: number;
    generatedAt: string;
  };
  error: string | null;
}

export interface ExportDocumentRequest {
  format: DocumentFormat;
  destination?: "download" | "jobnimbus" | "email";
}
```

---

## 3. Document Type Specifications

### 3.1 Homeowner Follow-Up Letter

| Attribute | Value |
|---|---|
| **Type key** | `homeowner_follow_up_letter` |
| **Context type** | `house` |
| **Context needed** | House address, storm zone data (severity, hail size, storm date), visit date, rep name, visit outcome, homeowner name (if captured), company profile (certifications, warranty, financing), company tone |
| **Who generates** | Rep (after visit), Office Admin (batch follow-ups), Manager |
| **When in workflow** | After a stop outcome of `interested`, `no_answer`, or `follow_up_needed` |
| **Output formats** | PDF (primary), clipboard (for email paste), print |
| **AI prompt focus** | Personalized letter referencing specific storm damage to their property, explaining the inspection/claim process, and requesting a callback or appointment |
| **Word count target** | 250–400 words |

**Workflow entry points:**
- Houses To Hit Today → row action "Generate Document"
- Mission stop → after recording outcome → "Generate Follow-Up Letter"
- Documents page → "New Document" → select type

---

### 3.2 Neighborhood Flyer

| Attribute | Value |
|---|---|
| **Type key** | `neighborhood_flyer` |
| **Context type** | `storm_zone` |
| **Context needed** | Storm zone name, severity score, hail size, wind speed, storm date, houses affected count, neighborhood name, company profile, company logo URL |
| **Who generates** | Manager, Office Admin |
| **When in workflow** | After a storm zone is identified as high-opportunity, before or during mission deployment |
| **Output formats** | PDF (primary — designed for print), print |
| **AI prompt focus** | Attention-grabbing flyer for door hangers or mailboxes. Mentions the specific storm, dates, and damage indicators. Includes company contact info, free inspection offer, and urgency language. |
| **Word count target** | 100–180 words (concise for flyer format) |

**Workflow entry points:**
- Storms page → zone row action "Generate Document"
- Documents page → "New Document" → select type

---

### 3.3 Storm Impact Summary

| Attribute | Value |
|---|---|
| **Type key** | `storm_impact_summary` |
| **Context type** | `storm_zone` |
| **Context needed** | Storm zone data (score, severity, event type, hail/wind stats, house count, unworked count, mission count), contributing storm events, territory info, historical zone performance |
| **Who generates** | Manager, Owner, Office Admin |
| **When in workflow** | When a new storm zone is created or updated, for internal briefing or homeowner presentation |
| **Output formats** | PDF, clipboard, print |
| **AI prompt focus** | Data-driven summary: storm event timeline, affected area description, damage potential assessment, recommended response (mission count, rep allocation), comparison to similar past zones |
| **Word count target** | 400–600 words |

**Workflow entry points:**
- Storms page → zone detail drawer → "Generate Storm Summary"
- Dashboard → Top Storm Zones widget → zone action
- Documents page → "New Document"

---

### 3.4 Mission Recap

| Attribute | Value |
|---|---|
| **Type key** | `mission_recap` |
| **Context type** | `mission` |
| **Context needed** | Mission name, status, assigned rep, storm zone, start/end times, duration, total stops, completed stops, outcomes breakdown (interested/no_answer/not_interested), interested homeowner names, next steps, route efficiency |
| **Who generates** | Auto-generated on mission completion, Manager, Owner |
| **When in workflow** | When a mission transitions to `completed` (auto-draft) or on demand from Missions page |
| **Output formats** | PDF, clipboard, print |
| **AI prompt focus** | Structured recap: mission objectives, execution summary, outcome statistics, notable contacts (interested homeowners), follow-up actions needed, performance assessment |
| **Word count target** | 300–500 words |

**Workflow entry points:**
- Missions page → mission detail → "Generate Recap" (auto-offered on completion)
- Documents page → "New Document"

---

### 3.5 Manager Daily Summary

| Attribute | Value |
|---|---|
| **Type key** | `manager_daily_summary` |
| **Context type** | `company` |
| **Context needed** | Today's metrics: missions active/completed, houses hit, appointments set, exports sent, active zones, team coverage, exceptions raised, top-performing rep, AI brief highlights |
| **Who generates** | Auto-generated at end of business day (cron), Manager, Owner |
| **When in workflow** | End of day, or on-demand from Dashboard |
| **Output formats** | PDF, clipboard (for email paste), print |
| **AI prompt focus** | Executive summary of the day's storm sales operations: what was accomplished, what was missed, what needs attention tomorrow, team performance highlights |
| **Word count target** | 300–500 words |

**Workflow entry points:**
- Dashboard → AI Daily Brief widget → "Export as Document"
- Documents page → "New Document"
- Cron job: `GET /api/cron/daily-summary-doc` (auto-drafts at 6 PM local)

---

### 3.6 Office Summary

| Attribute | Value |
|---|---|
| **Type key** | `office_summary` |
| **Context type** | `company` |
| **Context needed** | Multi-day metrics (7-day window), branch-level data, zone activity, export queue health, team utilization, storm pipeline |
| **Who generates** | Owner, Manager, Office Admin |
| **When in workflow** | Weekly or on-demand for internal reporting |
| **Output formats** | PDF, clipboard, print |
| **AI prompt focus** | Broader operational health report: weekly zone activity, team utilization trends, export throughput, pipeline value, areas of concern, strategic recommendations |
| **Word count target** | 500–800 words |

**Workflow entry points:**
- Documents page → "New Document"
- Settings → scheduled reports (future)

---

### 3.7 Qualified Opportunity Handoff Sheet

| Attribute | Value |
|---|---|
| **Type key** | `qualified_opportunity_handoff` |
| **Context type** | `opportunity` |
| **Context needed** | House data (address, property details, storm damage, assessed value), homeowner info (name, phone, email), visit history, rep notes, interest level, appointment date, storm zone, estimated value band, company profile |
| **Who generates** | Office Admin (primary), Manager, auto-generated on export to JobNimbus |
| **When in workflow** | When a stop outcome is `interested` and the opportunity enters the export queue, or when manually exported |
| **Output formats** | PDF (attached to JN export), clipboard |
| **AI prompt focus** | Structured handoff: property overview, damage assessment, homeowner interaction summary, recommended next steps, pricing guidance, attached as a note to the JobNimbus contact |
| **Word count target** | 200–350 words |

**Workflow entry points:**
- Exports page → Ready To Export Queue → "Preview Handoff"
- Dashboard → Recent Qualified Opportunities → row action "Generate Document"
- Houses To Hit Today → row action "Send to JobNimbus" (auto-generates)

---

### 3.8 Claim Explanation Letter

| Attribute | Value |
|---|---|
| **Type key** | `claim_explanation_letter` |
| **Context type** | `house` |
| **Context needed** | House data, storm zone data, homeowner name, insurance carrier (if known), damage type, storm date, company certifications, claims process overview |
| **Who generates** | Rep (at door), Office Admin, Manager |
| **When in workflow** | During or after a stop when the homeowner asks about the insurance claim process |
| **Output formats** | PDF, clipboard, print |
| **AI prompt focus** | Educational letter explaining: what storm damage looks like, how insurance claims work for roofing, what the inspection process involves, timelines, what the homeowner needs to do, why acting promptly matters |
| **Word count target** | 300–450 words |

**Workflow entry points:**
- Mission stop → AI Assist → "Generate Claim Letter"
- Houses To Hit Today → "Generate Document" → select type
- Documents page → "New Document"

---

### 3.9 Leave-Behind Document

| Attribute | Value |
|---|---|
| **Type key** | `leave_behind` |
| **Context type** | `house` |
| **Context needed** | House address, storm zone name, storm date, damage indicators, company profile (name, phone, certifications, warranty), rep name, free inspection offer |
| **Who generates** | Rep (at door — quick generate from mobile) |
| **When in workflow** | During a stop, especially after `no_answer` — left at the door |
| **Output formats** | PDF (primary — single page, designed for print), print, clipboard |
| **AI prompt focus** | Short, professional door-hanger or letter: identifies specific storm, mentions visible damage indicators for their area, offers free no-obligation inspection, includes contact info and urgency |
| **Word count target** | 80–150 words (must fit a single page or door hanger) |

**Workflow entry points:**
- Active mission → current stop → "Leave Behind" quick action
- Houses To Hit Today → "Generate Document"
- Documents page → "New Document"

---

### 3.10 Rep Field Recap

| Attribute | Value |
|---|---|
| **Type key** | `rep_field_recap` |
| **Context type** | `mission` |
| **Context needed** | Mission data (stops, outcomes, duration), rep name, rep stats for the day, notable interactions, interested homeowners, follow-up needs |
| **Who generates** | Rep (end of day), auto-generated on mission completion |
| **When in workflow** | When rep completes a mission or at end of field day |
| **Output formats** | Clipboard (primary — for pasting into text/email to manager), PDF |
| **AI prompt focus** | Quick personal recap: doors knocked, appointments set, notable conversations, follow-ups needed, challenges encountered, tomorrow's priority |
| **Word count target** | 150–250 words |

**Workflow entry points:**
- Missions page → after mission completion → "Generate Field Recap"
- Documents page → "New Document"

---

## 4. Document Generation Pipeline

### 4.1 Generation Flow

```
Client request
  └─► POST /api/documents/generate
        ├─► Validate auth + role permissions
        ├─► Resolve context (fetch storm_zone / house / mission / etc.)
        ├─► Select template (company override → system default)
        ├─► Build AiContext from resolved entities
        ├─► Inject template variables into user prompt
        ├─► Call OpenAI via generateFromPrompt()
        ├─► Parse response → markdown content
        ├─► Insert into documents table (status: 'draft')
        ├─► Log to ai_sessions
        └─► Return { data: Document, error: null, meta }
```

### 4.2 Document Generation Module

```typescript
// src/lib/ai/modules/documentDraft.ts

import type { AiContext } from "@/types/ai-context";
import type { DocumentType, DocumentFormat, GenerateDocumentRequest } from "@/types/documents";
import { buildSystemSections } from "@/lib/ai/promptBuilder";

// ── Document Type Configs ────────────────────────────────────────────────────

export interface DocumentTypeConfig {
  type: DocumentType;
  label: string;
  description: string;
  contextTypes: Array<"storm_zone" | "house" | "mission" | "opportunity" | "team" | "company">;
  allowedFormats: DocumentFormat[];
  defaultFormat: DocumentFormat;
  maxTokens: number;
  wordCountRange: [number, number];
  allowedRoles: Array<"owner" | "manager" | "rep" | "office_admin">;
  requiresContext: Array<keyof AiContext>;
}

export const DOCUMENT_TYPE_CONFIGS: Record<DocumentType, DocumentTypeConfig> = {
  homeowner_follow_up_letter: {
    type: "homeowner_follow_up_letter",
    label: "Homeowner Follow-Up Letter",
    description: "Personalized follow-up letter after a property visit",
    contextTypes: ["house"],
    allowedFormats: ["pdf", "clipboard", "print"],
    defaultFormat: "pdf",
    maxTokens: 800,
    wordCountRange: [250, 400],
    allowedRoles: ["owner", "manager", "rep", "office_admin"],
    requiresContext: ["companyProfile", "houseContext", "tonePreference"],
  },
  neighborhood_flyer: {
    type: "neighborhood_flyer",
    label: "Neighborhood Flyer",
    description: "Door-hanger or mailbox flyer for a storm-affected neighborhood",
    contextTypes: ["storm_zone"],
    allowedFormats: ["pdf", "print"],
    defaultFormat: "pdf",
    maxTokens: 500,
    wordCountRange: [100, 180],
    allowedRoles: ["owner", "manager", "office_admin"],
    requiresContext: ["companyProfile", "stormContext", "tonePreference"],
  },
  storm_impact_summary: {
    type: "storm_impact_summary",
    label: "Storm Impact Summary",
    description: "Data-driven summary of a storm zone's impact and response plan",
    contextTypes: ["storm_zone"],
    allowedFormats: ["pdf", "clipboard", "print"],
    defaultFormat: "pdf",
    maxTokens: 1200,
    wordCountRange: [400, 600],
    allowedRoles: ["owner", "manager", "office_admin"],
    requiresContext: ["companyProfile", "stormContext", "tonePreference"],
  },
  mission_recap: {
    type: "mission_recap",
    label: "Mission Recap",
    description: "Structured recap of a completed mission with outcomes",
    contextTypes: ["mission"],
    allowedFormats: ["pdf", "clipboard", "print"],
    defaultFormat: "pdf",
    maxTokens: 1000,
    wordCountRange: [300, 500],
    allowedRoles: ["owner", "manager"],
    requiresContext: ["companyProfile", "missionContext", "tonePreference"],
  },
  manager_daily_summary: {
    type: "manager_daily_summary",
    label: "Manager Daily Summary",
    description: "End-of-day executive summary of all storm sales operations",
    contextTypes: ["company"],
    allowedFormats: ["pdf", "clipboard", "print"],
    defaultFormat: "pdf",
    maxTokens: 1000,
    wordCountRange: [300, 500],
    allowedRoles: ["owner", "manager"],
    requiresContext: ["companyProfile", "tonePreference"],
  },
  office_summary: {
    type: "office_summary",
    label: "Office Summary",
    description: "Weekly operational health report for internal use",
    contextTypes: ["company"],
    allowedFormats: ["pdf", "clipboard", "print"],
    defaultFormat: "pdf",
    maxTokens: 1600,
    wordCountRange: [500, 800],
    allowedRoles: ["owner", "manager", "office_admin"],
    requiresContext: ["companyProfile", "tonePreference"],
  },
  qualified_opportunity_handoff: {
    type: "qualified_opportunity_handoff",
    label: "Qualified Opportunity Handoff Sheet",
    description: "Structured handoff summary for JobNimbus export",
    contextTypes: ["opportunity", "house"],
    allowedFormats: ["pdf", "clipboard"],
    defaultFormat: "pdf",
    maxTokens: 700,
    wordCountRange: [200, 350],
    allowedRoles: ["owner", "manager", "office_admin"],
    requiresContext: ["companyProfile", "houseContext", "tonePreference"],
  },
  claim_explanation_letter: {
    type: "claim_explanation_letter",
    label: "Claim Explanation Letter",
    description: "Educational letter explaining the insurance claim process",
    contextTypes: ["house"],
    allowedFormats: ["pdf", "clipboard", "print"],
    defaultFormat: "pdf",
    maxTokens: 900,
    wordCountRange: [300, 450],
    allowedRoles: ["owner", "manager", "rep", "office_admin"],
    requiresContext: ["companyProfile", "houseContext", "stormContext", "tonePreference"],
  },
  leave_behind: {
    type: "leave_behind",
    label: "Leave-Behind Document",
    description: "Short door-hanger or letter left at a no-answer property",
    contextTypes: ["house"],
    allowedFormats: ["pdf", "print", "clipboard"],
    defaultFormat: "pdf",
    maxTokens: 400,
    wordCountRange: [80, 150],
    allowedRoles: ["owner", "manager", "rep", "office_admin"],
    requiresContext: ["companyProfile", "houseContext", "tonePreference"],
  },
  rep_field_recap: {
    type: "rep_field_recap",
    label: "Rep Field Recap",
    description: "Quick end-of-day personal recap for rep-to-manager update",
    contextTypes: ["mission"],
    allowedFormats: ["clipboard", "pdf"],
    defaultFormat: "clipboard",
    maxTokens: 500,
    wordCountRange: [150, 250],
    allowedRoles: ["owner", "manager", "rep"],
    requiresContext: ["companyProfile", "missionContext", "repContext", "tonePreference"],
  },
};

// ── Prompt Builders ──────────────────────────────────────────────────────────

export interface DocumentDraftParams {
  documentType: DocumentType;
  contextType: string;
  contextId: string;
  format: DocumentFormat;
  overrides: Record<string, string>;
  templateId: string | null;
}

export interface DocumentDraftOutput {
  title: string;
  content: string;
  wordCount: number;
  generatedAt: string;
  model: string;
  tokenCount: number;
}

const DOCUMENT_SYSTEM_PROMPTS: Record<DocumentType, string> = {
  homeowner_follow_up_letter:
    "You are a professional roofing sales communication specialist. Write a personalized follow-up letter to a homeowner after a property visit. The letter should reference the specific storm event, describe observed or likely damage, explain the inspection/claim process, and include a clear call to action (schedule inspection or callback). Tone should be helpful, not aggressive.",

  neighborhood_flyer:
    "You are a marketing copywriter for a roofing company. Create a concise, attention-grabbing flyer for distribution in a storm-affected neighborhood. Mention the specific storm, date, and damage type. Include a free inspection offer, company contact info, and urgency language. Format for a single-page door hanger. Use short paragraphs and bullet points.",

  storm_impact_summary:
    "You are a storm intelligence analyst. Write a data-driven summary of a storm zone's impact. Include: storm event timeline, affected area description, damage potential assessment (hail size, wind speed, property count), recommended response plan (mission count, rep allocation), and comparison context. Use professional tone suitable for internal briefings.",

  mission_recap:
    "You are an operations analyst. Write a structured mission recap. Include: mission objectives, execution summary (duration, route, stops visited), outcome statistics (interested/no answer/not interested breakdown), notable contacts with names and details, required follow-up actions, and performance assessment. Format with clear headers and bullet points.",

  manager_daily_summary:
    "You are an executive briefing specialist. Write a concise end-of-day summary for a storm sales operations manager. Cover: missions completed, houses hit, appointments set, exports processed, exceptions handled, top performer highlight, and tomorrow's priorities. Keep it scannable with metrics up front.",

  office_summary:
    "You are a business intelligence analyst. Write a weekly operational health report. Cover: zone activity trends (7-day), team utilization, export throughput, pipeline value estimate, coverage gaps, areas of concern, and strategic recommendations. Use data-driven language and include specific numbers.",

  qualified_opportunity_handoff:
    "You are a CRM data specialist. Write a structured handoff summary for a qualified roofing opportunity being exported to JobNimbus. Include: property overview, damage assessment, homeowner interaction timeline, contact information, interest level, estimated value, and recommended next steps. This will be attached as a note to a CRM contact record.",

  claim_explanation_letter:
    "You are a roofing insurance claims educator. Write a clear, educational letter explaining the insurance claim process to a homeowner. Cover: what storm damage looks like on a roof, how insurance claims work, what the free inspection entails, typical timelines, what the homeowner needs to do, and why prompt action matters. Avoid aggressive sales language — be educational and trustworthy.",

  leave_behind:
    "You are a field marketing specialist. Write a very short leave-behind document for a door where no one answered. It should: identify the recent storm event, mention that their neighborhood was affected, offer a free no-obligation inspection, include company name and phone number, and create mild urgency. Must fit a single page or door hanger. Maximum 150 words.",

  rep_field_recap:
    "You are a field sales rep writing a quick end-of-day recap for your manager. Include: doors knocked, appointments set, notable conversations (homeowner names if available), follow-ups needed, challenges encountered, and tomorrow's priority. Keep it casual but professional — this is an internal communication, not a formal report.",
};

export function buildDocumentDraftPrompt(
  ctx: AiContext,
  params: DocumentDraftParams,
): { system: string; user: string } {
  const config = DOCUMENT_TYPE_CONFIGS[params.documentType];
  const contextSections = buildSystemSections(ctx);
  const typePrompt = DOCUMENT_SYSTEM_PROMPTS[params.documentType];

  const system = [
    typePrompt,
    "",
    `Target word count: ${config.wordCountRange[0]}–${config.wordCountRange[1]} words.`,
    `Output format: ${params.format}.`,
    'Output valid JSON: { title: string, content: string (markdown formatted), wordCount: number }.',
    `Maximum ${config.maxTokens} tokens.`,
    "",
    contextSections,
  ].join("\n");

  const overrideLines = Object.entries(params.overrides)
    .map(([key, val]) => `${key}: ${val}`)
    .join("\n");

  const user = [
    `Generate a ${config.label} document.`,
    overrideLines || null,
    "",
    "Return only valid JSON.",
  ]
    .filter(Boolean)
    .join("\n");

  return { system, user };
}

export function parseDocumentDraftOutput(
  raw: string,
  params: DocumentDraftParams,
  model: string,
  tokenCount: number,
): DocumentDraftOutput {
  try {
    const parsed = JSON.parse(raw);
    const content = String(parsed.content ?? raw);
    return {
      title: String(
        parsed.title ??
          DOCUMENT_TYPE_CONFIGS[params.documentType].label,
      ),
      content,
      wordCount: content.split(/\s+/).length,
      generatedAt: new Date().toISOString(),
      model,
      tokenCount,
    };
  } catch {
    return {
      title: DOCUMENT_TYPE_CONFIGS[params.documentType].label,
      content: raw,
      wordCount: raw.split(/\s+/).length,
      generatedAt: new Date().toISOString(),
      model,
      tokenCount,
    };
  }
}
```

### 4.3 Export Pipeline

```typescript
// src/lib/documents/exportDocument.ts

import type { Document, DocumentFormat } from "@/types/documents";

export interface ExportResult {
  success: boolean;
  format: DocumentFormat;
  url: string | null;         // Download URL for PDF/DOCX
  clipboardText: string | null; // Text for clipboard
  error: string | null;
}

/**
 * Export flow per format:
 *
 * PDF:
 *   1. Parse document.content (markdown) → HTML
 *   2. Render via jsPDF with company branding (header, footer, logo)
 *   3. Upload to Supabase Storage → get signed URL
 *   4. Update document row: fileUrl, exported=true, exportedAt
 *   5. Return { url }
 *
 * DOCX:
 *   1. Parse document.content (markdown) → docx XML via `docx` npm package
 *   2. Apply company branding (header, styles)
 *   3. Upload to Supabase Storage → get signed URL
 *   4. Update document row
 *   5. Return { url }
 *
 * Clipboard:
 *   1. Return document.content as plain text (strip markdown if needed)
 *   2. Client calls navigator.clipboard.writeText()
 *   3. Mark exported in DB
 *
 * Print:
 *   1. Return contentHtml (pre-rendered HTML with print styles)
 *   2. Client opens in new window → window.print()
 *   3. Mark exported in DB
 */
```

---

## 5. Document API Routes

### 5.1 `GET /api/documents`

**Purpose:** List documents with filters.

**Query params:** `type`, `status`, `contextType`, `contextId`, `createdBy`, `dateFrom`, `dateTo`, `page` (default 1), `limit` (default 25).

**Response:**

```typescript
{
  data: Document[],
  error: null,
  meta: {
    total: number,
    page: number,
    limit: number,
    generatedAt: string
  }
}
```

**Role scoping:**
- Owner: all documents across all branches
- Manager: documents from own branch
- Rep: own documents only
- Office Admin: all documents from own branch

---

### 5.2 `POST /api/documents/generate`

**Purpose:** AI-generate a document from workflow context.

**Request body:** `GenerateDocumentRequest`

**Flow:**
1. Validate auth, role, required fields
2. Check role has permission for this `DocumentType` (via `DOCUMENT_TYPE_CONFIGS[type].allowedRoles`)
3. Resolve context entity (fetch storm_zone / house / mission by `contextId`)
4. Build `AiContext` from resolved entity
5. Look up template: company-specific → system default for this type
6. Call `buildDocumentDraftPrompt()` → `generateFromPrompt()` → `parseDocumentDraftOutput()`
7. Insert into `documents` table with status `draft`
8. Log to `ai_sessions`
9. Return `{ data: Document, error: null, meta }`

---

### 5.3 `GET /api/documents/[id]`

**Purpose:** Get a single document.

**Response:** `{ data: Document, error: null, meta }`

---

### 5.4 `PATCH /api/documents/[id]`

**Purpose:** Update document content or status.

**Request body:**
```typescript
{
  content?: string;
  title?: string;
  status?: "draft" | "final";
}
```

**Rules:**
- Cannot edit a document with status `exported`
- Only the creator or a Manager/Owner can edit
- Changing `content` resets `contentHtml` to null (re-render on next export)

---

### 5.5 `POST /api/documents/[id]/export`

**Purpose:** Export a document in a specific format.

**Request body:** `ExportDocumentRequest`

**Flow:**
1. Fetch document
2. Render to target format (PDF via `jsPDF`, DOCX via `docx` lib, etc.)
3. Upload to Supabase Storage if file-based format
4. Update document: `exported = true`, `exportedAt = NOW()`, `fileUrl`, `exportDestination`
5. If `destination = jobnimbus`, attach to the associated export record
6. Return `{ data: { url, format }, error: null, meta }`

---

## 6. Documents Page Layout

### 6.1 Grid Layout

```
Desktop (xl, ≥1280px) — 3 columns
┌──────────────────────────────────────────────────────────────────┐
│ Document List (col-span-2)                                       │
│ - Filterable table: type, status, date, creator                  │
│ - Row click → opens Document Viewer drawer                       │
│                                                                  │
│                                                                  │
├─────────────────────────────────────┬────────────────────────────┤
│ Recent Drafts (col-span-1)          │ Quick Generate             │
│                                     │ (col-span-1)               │
│                                     │                            │
│                                     │ - Type selector            │
│                                     │ - Context picker           │
│                                     │ - "Generate" button        │
└─────────────────────────────────────┴────────────────────────────┘
```

### 6.2 KPI Strip

| Position | Label | Source | Format |
|---|---|---|---|
| 1 (primary) | Total Documents | `totalCount` | Integer, `text-storm-purple` |
| 2 | Drafts | `draftCount` | Integer, amber when > 5 |
| 3 | Exported Today | `exportedTodayCount` | Integer |
| 4 | Generated This Week | `generatedThisWeekCount` | Integer |

### 6.3 Document Viewer Drawer

Slide-in drawer (480px desktop, full-width mobile) showing:
- Document title + type badge
- Status badge (draft / final / exported)
- Rendered content (markdown → HTML)
- Edit button (inline markdown editor)
- Export actions bar: PDF, DOCX, Copy to Clipboard, Print
- Metadata: created by, created at, context reference link, AI model used, word count

### 6.4 Quick Generate Panel

- Document type dropdown (10 types, filtered by current user's role)
- Context picker: depends on type → auto-suggests relevant entities
  - `house` types → search houses by address
  - `storm_zone` types → select from active zones
  - `mission` types → select from recent missions
  - `company` types → uses current company (no picker needed)
  - `opportunity` types → select from export queue
- Optional: override fields (homeowner name, custom instructions)
- "Generate Document" button → calls `POST /api/documents/generate`

---

## 7. Objection Response AI — Enhanced Specification

### 7.1 Overview

The Objection Response module is already implemented in Phase 7 (`src/lib/ai/modules/objectionResponse.ts`, `POST /api/ai/objection-response`). This phase enhances it with:
- A browsable objection library (from `src/lib/objection-library.ts`)
- Contextual awareness of the current stop and homeowner
- Integration into the Documents flow (save response as a document)

### 7.2 Objection Categories

| Category | Key | Example Objections | Context AI Needs |
|---|---|---|---|
| **Price & Budget** | `price` | "Your price is higher than others", "I wasn't planning on spending that much", "Can you match the other quote?", "The deductible is too much" | Our quote amount, competitor quote (if known), insurance coverage, financing options, material/warranty differences |
| **Trust & Credibility** | `trust` | "I've never heard of your company", "How do I know you're legit?", "My neighbor got scammed by a roofer", "I don't trust door knockers" | Company certifications (GAF Master Elite, etc.), years in business, Google review count/rating, BBB rating, local references, licensing |
| **Timing & Urgency** | `timing` | "I want to wait", "It's not a good time", "Let me think about it", "I'll deal with it next year" | Storm date (urgency decay), claim filing deadline, damage progression risk, insurance policy renewal date, seasonal pricing |
| **Process & Logistics** | `process` | "This seems like a hassle", "I don't want to deal with insurance", "How long does this take?", "Will it disrupt my life?" | Company's process overview, typical timeline (inspection → claim → install), what the homeowner has to do vs. what the company handles |
| **Competition** | `competition` | "I already have three quotes", "My neighbor uses a different company", "I want to get more estimates", "The other guy is cheaper" | Company differentiators, warranty comparison framework, material quality tiers, scope comparison checklist |
| **Insurance & Claims** | `insurance` | "My insurance won't cover it", "I don't want my rates to go up", "My adjuster said it's fine", "I already filed and was denied" | Storm date, damage type, typical coverage for this event type, rate impact (storm claims don't typically increase rates), supplementing process, re-inspection rights |
| **Decision Making** | `decision` | "I need to talk to my spouse", "I want to research more", "I'm not the homeowner", "I just don't want to deal with this" | Decision-maker identification, information package availability, urgency factors, simplification of process (company handles everything) |

### 7.3 Response Structure (LAER Framework)

Every AI objection response follows the LAER framework:

```typescript
// Already defined in src/lib/ai/modules/objectionResponse.ts

interface ObjectionResponseOutput {
  /** Full conversational response (150-250 words) */
  response: string;
  /** LAER breakdown */
  framework: {
    /** Listen: What to say to show understanding (1-2 sentences) */
    listen: string;
    /** Acknowledge: Validate the concern (1-2 sentences) */
    acknowledge: string;
    /** Explore: Ask a clarifying question (1 sentence) */
    explore: string;
    /** Respond: Address with value/evidence (2-4 sentences) */
    respond: string;
  };
  /** Under 50 words — for texting or quick at-door reference */
  shortVersion: string;
  /** Transition question to keep the conversation moving */
  followUpQuestion: string;
}
```

### 7.4 Workflow Entry Points

| Surface | Trigger | Context Pre-filled |
|---|---|---|
| Active mission stop | "Objection Assist" button in stop actions | House context, storm context, stop status, rep notes |
| AI Studio hub | Objection Response module card | Optional: pre-selected house from URL params |
| Houses To Hit Today | Row action "AI Assist" → deep-link | House context |
| Documents page | "Objection Response" in Quick Generate (saves as doc) | Selected house context |

### 7.5 Objection Library Integration

The existing `src/lib/objection-library.ts` contains 50+ pre-written objection templates. The enhanced flow:

1. **Browse mode:** User can browse library by category, see template responses
2. **AI-enhance mode:** User selects a template OR types a custom objection → AI generates a contextual response using the template as a starting point + live property/storm context
3. **Save to Documents:** Response can be saved as a `claim_explanation_letter` or `homeowner_follow_up_letter` document type if the user wants to leave it in writing

```typescript
// src/types/objections.ts

export interface ObjectionLibraryEntry {
  id: string;
  category: ObjectionCategory;
  objection: string;
  shortTitle: string;
  suggestedTone: "consultative" | "confident" | "empathetic";
  keyInsights: string[];
  suggestedResponse: string;
}

export interface ObjectionAiRequest {
  /** The objection text (free-form or from library) */
  objection: string;
  /** Category for better targeting (auto-detected if null) */
  category: ObjectionCategory | null;
  /** Library template ID if starting from a template */
  templateId: string | null;
  /** Property context IDs for AI enrichment */
  houseId: string | null;
  missionId: string | null;
  stopId: string | null;
  /** Preferred response tone */
  tone: "consultative" | "confident" | "empathetic";
  /** Whether to save the response as a document */
  saveAsDocument: boolean;
}

export type ObjectionCategory =
  | "price"
  | "trust"
  | "timing"
  | "process"
  | "competition"
  | "insurance"
  | "decision";
```

---

## 8. Negotiation Coach AI — Enhanced Specification

### 8.1 Overview

The Negotiation Coach module is already implemented in Phase 7 (`src/lib/ai/modules/negotiationCoach.ts`, `POST /api/ai/negotiation-coach`). This phase enhances it with:
- Defined negotiation scenario categories with specific input structures
- Pricing intelligence integration (estimated value bands, competitor data)
- Structured coaching output with concession ladders
- Document generation integration (save strategy as internal document)

### 8.2 Negotiation Scenarios

#### Scenario 1: Initial Pricing

| Attribute | Value |
|---|---|
| **Key** | `initial_pricing` |
| **When** | First pricing discussion with homeowner (at door or follow-up call) |
| **Inputs needed** | Property estimated value band, roof size/complexity, storm damage type, insurance deductible estimate, company pricing range, homeowner's budget concern |
| **AI coaching** | Anchor pricing strategy, value stacking (certifications + warranty + materials), framing as investment not cost, insurance coverage explanation |
| **Output** | Strategy narrative + 3-5 talking points + pricing anchor suggestion + concession ladder (3 levels) |

#### Scenario 2: Competitor Comparison

| Attribute | Value |
|---|---|
| **Key** | `competitor_comparison` |
| **When** | Homeowner mentions another quote or is comparing options |
| **Inputs needed** | Our quote amount, competitor quote amount (if known), material differences, warranty differences, scope differences, company differentiators |
| **AI coaching** | Value comparison framework (not price matching), scope alignment check, quality/warranty emphasis, "apples to oranges" positioning |
| **Output** | Strategy + comparison talking points + what to avoid saying + closing technique |

#### Scenario 3: Insurance Supplement

| Attribute | Value |
|---|---|
| **Key** | `insurance_supplement` |
| **When** | Insurance adjuster's assessment is lower than actual scope, or claim was partially denied |
| **Inputs needed** | Original claim amount, adjuster assessment, actual scope needed, damage documentation, carrier name, supplement history |
| **AI coaching** | Supplement filing strategy, re-inspection rights, documentation approach, professional adjuster communication, escalation paths |
| **Output** | Strategy + supplement talking points + documentation checklist + timeline guidance |

#### Scenario 4: Scope Reduction Request

| Attribute | Value |
|---|---|
| **Key** | `scope_reduction` |
| **When** | Homeowner asks to reduce scope to lower price (e.g., "just patch the damaged area") |
| **Inputs needed** | Full scope description, proposed reduction, warranty implications, code compliance requirements, long-term cost of partial repair |
| **AI coaching** | Explain why partial repairs are risky, code compliance requirements, warranty void risks, long-term cost comparison, insurance coverage for full scope |
| **Output** | Strategy + risk explanation + code/warranty talking points + concession alternatives |

#### Scenario 5: Payment Terms

| Attribute | Value |
|---|---|
| **Key** | `payment_terms` |
| **When** | Homeowner agrees to the work but wants different payment structure |
| **Inputs needed** | Total project cost, insurance payout timeline, financing options available, deductible amount, company payment policy |
| **AI coaching** | Payment scheduling options, financing presentation, insurance payout timing, deductible handling, deposit requirements |
| **Output** | Strategy + payment option scripts + financing pitch + closing technique |

#### Scenario 6: Adjuster Meeting

| Attribute | Value |
|---|---|
| **Key** | `adjuster_meeting` |
| **When** | Before or after meeting with insurance adjuster at the property |
| **Inputs needed** | Carrier name, adjuster name (if known), damage documentation, claim number, property details, historical adjuster behavior (if available) |
| **AI coaching** | Meeting preparation, documentation to present, professional communication approach, re-inspection triggers, supplement preparation |
| **Output** | Pre-meeting checklist + talking points + documentation list + post-meeting follow-up plan |

#### Scenario 7: Custom

| Attribute | Value |
|---|---|
| **Key** | `custom` |
| **When** | Any negotiation situation not covered by predefined scenarios |
| **Inputs needed** | Free-form situation description, homeowner concern, pricing context (optional) |
| **AI coaching** | General negotiation strategy based on described situation |
| **Output** | Strategy + talking points + avoid list + closing technique |

### 8.3 Response Structure

```typescript
// Already defined in src/lib/ai/modules/negotiationCoach.ts

interface NegotiationCoachOutput {
  /** Overall strategy in markdown (200-400 words) */
  strategy: string;
  /** 3-5 specific talking points to use */
  talkingPoints: string[];
  /** 2-3 things to explicitly NOT say */
  avoidSaying: string[];
  /** Pricing guidance (null for non-pricing scenarios) */
  pricingGuidance: {
    /** Suggested anchor price or range */
    suggestedAnchorPrice: string | null;
    /** Why this anchor works */
    justification: string;
    /** 3-level concession ladder: what to give up at each level */
    concessionLadder: string[];
  } | null;
  /** Recommended closing technique */
  closingTechnique: {
    /** Name of the technique (e.g., "Assumptive Close", "Urgency Close") */
    name: string;
    /** Exact script to use */
    script: string;
  };
}
```

### 8.4 Workflow Entry Points

| Surface | Trigger | Context Pre-filled |
|---|---|---|
| Active mission stop | "Negotiation Coach" button in stop actions | House context, storm context, estimated value band |
| AI Studio hub | Negotiation Coach module card | Optional: pre-selected house from URL params |
| Houses To Hit Today | Row action "AI Assist" → deep-link with `module=negotiation_coach` | House context |
| Mission stop (interested outcome) | Auto-suggested after marking "Interested" | Full stop context + homeowner info |

### 8.5 Enhanced Negotiation Request

```typescript
// src/types/negotiation.ts

export type NegotiationScenario =
  | "initial_pricing"
  | "competitor_comparison"
  | "insurance_supplement"
  | "scope_reduction"
  | "payment_terms"
  | "adjuster_meeting"
  | "custom";

export interface NegotiationAiRequest {
  /** The negotiation scenario type */
  scenario: NegotiationScenario;
  /** Free-form situation description */
  situationDescription: string;
  /** Property context */
  houseId: string | null;
  missionId: string | null;
  stopId: string | null;
  /** Homeowner's stated concern */
  homeownerConcern: string | null;
  /** Pricing data (all optional — AI adapts to what's provided) */
  competitorQuote: number | null;
  ourQuote: number | null;
  insuranceClaimAmount: number | null;
  deductibleAmount: number | null;
  /** Whether to save the strategy as an internal document */
  saveAsDocument: boolean;
}

export const NEGOTIATION_SCENARIO_CONFIGS: Record<NegotiationScenario, {
  label: string;
  description: string;
  requiredInputs: string[];
  optionalInputs: string[];
}> = {
  initial_pricing: {
    label: "Initial Pricing Discussion",
    description: "First pricing conversation with a homeowner",
    requiredInputs: ["situationDescription"],
    optionalInputs: ["ourQuote", "homeownerConcern", "insuranceClaimAmount"],
  },
  competitor_comparison: {
    label: "Competitor Comparison",
    description: "Homeowner is comparing quotes from other companies",
    requiredInputs: ["situationDescription"],
    optionalInputs: ["competitorQuote", "ourQuote", "homeownerConcern"],
  },
  insurance_supplement: {
    label: "Insurance Supplement",
    description: "Adjuster assessment is lower than actual scope needed",
    requiredInputs: ["situationDescription", "insuranceClaimAmount"],
    optionalInputs: ["ourQuote", "homeownerConcern"],
  },
  scope_reduction: {
    label: "Scope Reduction Request",
    description: "Homeowner wants to reduce scope to lower price",
    requiredInputs: ["situationDescription"],
    optionalInputs: ["ourQuote", "homeownerConcern"],
  },
  payment_terms: {
    label: "Payment Terms Negotiation",
    description: "Homeowner wants different payment structure",
    requiredInputs: ["situationDescription"],
    optionalInputs: ["ourQuote", "insuranceClaimAmount", "deductibleAmount"],
  },
  adjuster_meeting: {
    label: "Adjuster Meeting Prep",
    description: "Preparing for or debriefing from insurance adjuster meeting",
    requiredInputs: ["situationDescription"],
    optionalInputs: ["insuranceClaimAmount", "homeownerConcern"],
  },
  custom: {
    label: "Custom Scenario",
    description: "Any negotiation situation not covered above",
    requiredInputs: ["situationDescription"],
    optionalInputs: ["competitorQuote", "ourQuote", "insuranceClaimAmount", "homeownerConcern"],
  },
};
```

---

## 9. Permissions Matrix

### 9.1 Document Permissions

| Action | Owner | Manager | Rep | Office Admin |
|---|---|---|---|---|
| **Generate** homeowner_follow_up_letter | ✅ | ✅ | ✅ | ✅ |
| **Generate** neighborhood_flyer | ✅ | ✅ | ❌ | ✅ |
| **Generate** storm_impact_summary | ✅ | ✅ | ❌ | ✅ |
| **Generate** mission_recap | ✅ | ✅ | ❌ | ❌ |
| **Generate** manager_daily_summary | ✅ | ✅ | ❌ | ❌ |
| **Generate** office_summary | ✅ | ✅ | ❌ | ✅ |
| **Generate** qualified_opportunity_handoff | ✅ | ✅ | ❌ | ✅ |
| **Generate** claim_explanation_letter | ✅ | ✅ | ✅ | ✅ |
| **Generate** leave_behind | ✅ | ✅ | ✅ | ✅ |
| **Generate** rep_field_recap | ✅ | ✅ | ✅ | ❌ |
| **View** all documents | ✅ | ✅ (own branch) | ❌ (own only) | ✅ (own branch) |
| **Edit** document content | ✅ | ✅ | ✅ (own only) | ✅ |
| **Export** as PDF/DOCX/print | ✅ | ✅ | ✅ (own only) | ✅ |
| **Delete** document | ✅ | ✅ | ❌ | ❌ |

### 9.2 Objection Response Permissions

| Action | Owner | Manager | Rep | Office Admin |
|---|---|---|---|---|
| **Browse** objection library | ✅ | ✅ | ✅ | ✅ |
| **Generate** AI response | ✅ | ✅ | ✅ | ❌ |
| **Save** response as document | ✅ | ✅ | ✅ | ✅ |
| **Access** via AI Studio | ✅ | ✅ | ✅ | ❌ |
| **Access** via mission stop | ✅ | ✅ | ✅ | ❌ |

### 9.3 Negotiation Coach Permissions

| Action | Owner | Manager | Rep | Office Admin |
|---|---|---|---|---|
| **Generate** coaching strategy | ✅ | ✅ | ✅ | ❌ |
| **Save** strategy as document | ✅ | ✅ | ✅ | ❌ |
| **Access** via AI Studio | ✅ | ✅ | ✅ | ❌ |
| **Access** via mission stop | ✅ | ✅ | ✅ | ❌ |
| **View** pricing guidance | ✅ | ✅ | ✅ | ❌ |

---

## 10. Workflow Integration Points

### 10.1 "Generate Document" Button Placement

| Surface | Button Location | Available Document Types | Context Provided |
|---|---|---|---|
| Houses To Hit Today (row action) | Row action dropdown | follow_up_letter, claim_explanation, leave_behind | `contextType: "house"`, `contextId: house.id` |
| Mission detail page | Page header action bar | mission_recap, rep_field_recap | `contextType: "mission"`, `contextId: mission.id` |
| Mission stop (after outcome) | Stop action bar | follow_up_letter, claim_explanation, leave_behind | `contextType: "house"`, `contextId: stop.houseId` |
| Storm zone detail drawer | Drawer action bar | storm_impact_summary, neighborhood_flyer | `contextType: "storm_zone"`, `contextId: zone.id` |
| Recent Qualified Opps (row action) | Row action dropdown | qualified_opportunity_handoff | `contextType: "opportunity"`, `contextId: opp.id` |
| Export Queue (Ready To Export) | Row action | qualified_opportunity_handoff | `contextType: "opportunity"`, `contextId: export.id` |
| Dashboard AI Daily Brief | Widget action | manager_daily_summary | `contextType: "company"`, `contextId: company.id` |
| Documents page | Quick Generate panel | All types (filtered by role) | User selects context |

### 10.2 Deep-Link URL Pattern

All "Generate Document" buttons navigate to the Documents page with query params:

```
/dashboard/documents?action=generate&type={documentType}&contextType={contextType}&contextId={contextId}
```

The Documents page reads these params and auto-opens the Quick Generate panel with the type and context pre-filled.

### 10.3 Auto-Generation Triggers

| Trigger | Document Type | Condition |
|---|---|---|
| Mission completed | `mission_recap` | Status transitions to `completed` → auto-draft (status: "draft") |
| Opportunity exported to JobNimbus | `qualified_opportunity_handoff` | Export initiated → auto-generate and attach to export |
| End of business day cron | `manager_daily_summary` | Cron at 6 PM local → auto-draft for each Manager/Owner |

---

## 11. API Route: `POST /api/ai/document-draft`

This is the AI endpoint (distinct from `POST /api/documents/generate` which is the full document lifecycle endpoint). This endpoint is called by the document generation pipeline internally.

```typescript
// src/app/api/ai/document-draft/route.ts

// Request: { context: AiContext | null, params: DocumentDraftParams }
// Response: { data: DocumentDraftOutput, error: null, meta }

// Uses: buildDocumentDraftPrompt() → generateFromPrompt() → parseDocumentDraftOutput()
// Gated by: feature flag ai.document_draft.enabled
// Rate limit: 10 per minute per user
// Max tokens: varies by document type (400-1600)
```

---

## 12. Testing Requirements

### 12.1 Document Tests

```typescript
// tests/documents.test.ts

// API shape tests:
// - POST /api/documents/generate validates required fields (type, contextType, contextId, format)
// - POST /api/documents/generate rejects invalid document type
// - POST /api/documents/generate rejects role without permission (rep → manager_daily_summary)
// - GET /api/documents returns filtered list
// - GET /api/documents/[id] returns single document
// - PATCH /api/documents/[id] updates content and title
// - PATCH /api/documents/[id] rejects edit on exported document
// - POST /api/documents/[id]/export returns export result

// AI module tests:
// - buildDocumentDraftPrompt includes context sections
// - buildDocumentDraftPrompt uses correct system prompt per document type
// - parseDocumentDraftOutput handles valid JSON
// - parseDocumentDraftOutput handles raw text fallback
// - DOCUMENT_TYPE_CONFIGS has all 10 document types
// - Each config has valid allowedRoles and allowedFormats

// Objection tests:
// - POST /api/ai/objection-response validates required fields
// - buildObjectionResponsePrompt includes LAER framework instruction
// - parseObjectionResponseOutput returns all framework fields
// - Objection library covers all 7 categories

// Negotiation tests:
// - POST /api/ai/negotiation-coach validates required fields
// - buildNegotiationCoachPrompt includes scenario-specific context
// - parseNegotiationCoachOutput returns concession ladder
// - NEGOTIATION_SCENARIO_CONFIGS has all 7 scenarios
```

---

## 13. Build Checklist

```
- [ ] Create migration: supabase/migrations/20260315_documents.sql
  - [ ] documents table with all columns
  - [ ] document_templates table
  - [ ] RLS policies
  - [ ] Indexes
- [ ] Create src/types/documents.ts (all TypeScript interfaces)
- [ ] Create src/lib/ai/modules/documentDraft.ts
  - [ ] DOCUMENT_TYPE_CONFIGS (all 10 types)
  - [ ] DOCUMENT_SYSTEM_PROMPTS (all 10 types)
  - [ ] buildDocumentDraftPrompt()
  - [ ] parseDocumentDraftOutput()
- [ ] Create src/lib/documents/exportDocument.ts (export pipeline)
- [ ] API routes:
  - [ ] GET /api/documents (list with filters)
  - [ ] POST /api/documents/generate (full generation pipeline)
  - [ ] GET /api/documents/[id] (get single)
  - [ ] PATCH /api/documents/[id] (update)
  - [ ] POST /api/documents/[id]/export (export to format)
  - [ ] POST /api/ai/document-draft (AI-only endpoint)
- [ ] Documents page:
  - [ ] src/app/(dashboard)/dashboard/documents/page.tsx
  - [ ] Document list with type/status/date filters
  - [ ] Document viewer drawer
  - [ ] Quick Generate panel
  - [ ] KPI strip
- [ ] Workflow entry points:
  - [ ] "Generate Document" on Houses To Hit Today rows
  - [ ] "Generate Document" on Mission detail
  - [ ] "Generate Document" on Storm zone detail
  - [ ] "Generate Document" on Recent Qualified Opps rows
  - [ ] Auto-generate on mission completion (draft)
  - [ ] Auto-generate on JobNimbus export
- [ ] Create src/types/objections.ts (enhanced types)
- [ ] Create src/types/negotiation.ts (NEGOTIATION_SCENARIO_CONFIGS)
- [ ] Enhance objection-response route: support saveAsDocument flag
- [ ] Enhance negotiation-coach route: support saveAsDocument flag
- [ ] Tests:
  - [ ] Document generation API validation
  - [ ] Document list filters
  - [ ] Document export endpoint
  - [ ] Document type configs completeness
  - [ ] AI module prompt/parse for documentDraft
  - [ ] Objection library category coverage
  - [ ] Negotiation scenario configs completeness
- [ ] Commit: "feat(documents): document generation, viewer, and export"
```
