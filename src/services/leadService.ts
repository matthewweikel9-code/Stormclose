import { calculateThreatScore } from "@/lib/threatScore";
import { eventBus, type EventBus } from "@/lib/eventBus";
import {
  type LeadFilters,
  type LeadPayload,
  type LeadRecord,
  type LeadRepo,
  SupabaseLeadRepo,
} from "@/repos/leadRepo";

export interface LeadCreatedEvent {
  userId: string;
  leadId: string;
  leadScore: number;
  lead: LeadRecord;
}

function ensureString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} is required`);
  }

  return value.trim();
}

function parseFiniteNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return fallback;
}

function sanitizePartialUpdate<T extends Record<string, unknown>>(payload: T): Partial<T> {
  const result: Partial<T> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (value !== undefined) {
      (result as Record<string, unknown>)[key] = value;
    }
  }

  return result;
}

function validateLeadPayload(leadPayload: LeadPayload): LeadPayload {
  if (!leadPayload || typeof leadPayload !== "object") {
    throw new Error("leadPayload must be a valid object");
  }

  const normalized = { ...leadPayload };

  if (
    typeof normalized.address !== "string" &&
    typeof normalized.homeowner_name !== "string"
  ) {
    throw new Error("leadPayload requires at least address or homeowner_name");
  }

  return normalized;
}

function buildThreatScoreInput(leadPayload: LeadPayload) {
  return {
    hailSize: parseFiniteNumber(leadPayload.hailSize, 0),
    windSpeed: parseFiniteNumber(leadPayload.windSpeed, 0),
    stormDurationMinutes: parseFiniteNumber(leadPayload.stormDurationMinutes, 0),
    proximityScore: parseFiniteNumber(leadPayload.proximityScore, 0.5),
    parcelValueNormalized: parseFiniteNumber(leadPayload.parcelValueNormalized, 0.5),
    roofAgeYears: parseFiniteNumber(leadPayload.roofAgeYears, 10),
  };
}

export class LeadService {
  constructor(private readonly repo: LeadRepo, private readonly bus: EventBus) {}

  async getLeads(userId: string, filters: LeadFilters = {}) {
    const safeUserId = ensureString(userId, "userId");
    return this.repo.getLeads(safeUserId, filters);
  }

  async createLead(userId: string, leadPayload: LeadPayload) {
    const safeUserId = ensureString(userId, "userId");
    const validatedPayload = validateLeadPayload(leadPayload);

    const initialScore = calculateThreatScore(buildThreatScoreInput(validatedPayload));

    const upsertPayload: LeadPayload = {
      ...validatedPayload,
      user_id: safeUserId,
      lead_score: initialScore,
    };

    const createdLead = await this.repo.upsertLead(upsertPayload);

    await this.bus.publish<LeadCreatedEvent>("lead.created", {
      userId: safeUserId,
      leadId: createdLead.id,
      leadScore: initialScore,
      lead: createdLead,
    });

    return createdLead;
  }

  async updateLead(leadId: string, updates: Partial<LeadPayload>) {
    const safeLeadId = ensureString(leadId, "leadId");
    const sanitizedUpdates = sanitizePartialUpdate(updates ?? {});

    delete sanitizedUpdates.id;
    delete sanitizedUpdates.user_id;

    if (Object.keys(sanitizedUpdates).length === 0) {
      throw new Error("updates cannot be empty");
    }

    return this.repo.updateLead(safeLeadId, sanitizedUpdates);
  }

  async deleteLead(leadId: string) {
    const safeLeadId = ensureString(leadId, "leadId");
    await this.repo.deleteLead(safeLeadId);
  }
}

const defaultLeadService = new LeadService(new SupabaseLeadRepo(), eventBus);

export function getLeads(userId: string, filters: LeadFilters = {}): Promise<LeadRecord[]> {
  return defaultLeadService.getLeads(userId, filters);
}

export function createLead(userId: string, leadPayload: LeadPayload): Promise<LeadRecord> {
  return defaultLeadService.createLead(userId, leadPayload);
}

export function updateLead(leadId: string, updates: Partial<LeadPayload>): Promise<LeadRecord> {
  return defaultLeadService.updateLead(leadId, updates);
}

export function deleteLead(leadId: string): Promise<void> {
  return defaultLeadService.deleteLead(leadId);
}