import { beforeEach, describe, expect, it, vi } from "vitest";
import { calculateThreatScore } from "../src/lib/threatScore";
import { EventBus } from "../src/lib/eventBus";
import {
  type LeadFilters,
  type LeadPayload,
  type LeadRecord,
  type LeadRepo,
} from "../src/repos/leadRepo";
import { LeadService } from "../src/services/leadService";

function buildLead(overrides: Partial<LeadRecord> = {}): LeadRecord {
  return {
    id: "lead-1",
    user_id: "user-1",
    address: "123 Main St",
    homeowner_name: "Jane Doe",
    lead_score: 42,
    status: "new",
    ...overrides,
  };
}

describe("LeadService", () => {
  let repo: LeadRepo;
  let bus: EventBus;
  let service: LeadService;

  beforeEach(() => {
    repo = {
      getLeads: vi.fn(),
      upsertLead: vi.fn(),
      updateLead: vi.fn(),
      deleteLead: vi.fn(),
    };
    bus = new EventBus();
    service = new LeadService(repo, bus);
  });

  it("getLeads should return leads from repo with filters", async () => {
    const leads = [buildLead(), buildLead({ id: "lead-2" })];
    (repo.getLeads as any).mockResolvedValue(leads);

    const filters: LeadFilters = { status: "new", limit: 10, offset: 0 };
    const result = await service.getLeads("user-1", filters);

    expect(repo.getLeads).toHaveBeenCalledWith("user-1", filters);
    expect(result).toEqual(leads);
  });

  it("createLead should validate, compute deterministic score, upsert, and publish event", async () => {
    const payload: LeadPayload = {
      address: "123 Main St",
      hailSize: 25.4,
      windSpeed: 80,
      stormDurationMinutes: 30,
      proximityScore: 0.8,
      parcelValueNormalized: 0.2,
      roofAgeYears: 15,
    };

    const expectedScore = calculateThreatScore({
      hailSize: 25.4,
      windSpeed: 80,
      stormDurationMinutes: 30,
      proximityScore: 0.8,
      parcelValueNormalized: 0.2,
      roofAgeYears: 15,
    });

    const createdLead = buildLead({ id: "lead-99", lead_score: expectedScore });
    (repo.upsertLead as any).mockResolvedValue(createdLead);

    const published: Array<{ event: string; payload: unknown }> = [];
    bus.subscribe("lead.created", (eventPayload) => {
      published.push({ event: "lead.created", payload: eventPayload });
    });

    const result = await service.createLead("user-1", payload);

    expect(repo.upsertLead).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        lead_score: expectedScore,
        address: "123 Main St",
      })
    );
    expect(result).toEqual(createdLead);
    expect(published).toHaveLength(1);
    expect(published[0]).toEqual({
      event: "lead.created",
      payload: expect.objectContaining({
        userId: "user-1",
        leadId: "lead-99",
        leadScore: expectedScore,
      }),
    });
  });

  it("createLead should reject invalid payloads", async () => {
    await expect(service.createLead("user-1", {})).rejects.toThrow(
      "leadPayload requires at least address or homeowner_name"
    );
    expect(repo.upsertLead).not.toHaveBeenCalled();
  });

  it("updateLead should perform safe partial updates", async () => {
    const updatedLead = buildLead({ id: "lead-10", status: "contacted", notes: "Updated" });
    (repo.updateLead as any).mockResolvedValue(updatedLead);

    const result = await service.updateLead("lead-10", {
      status: "contacted",
      notes: "Updated",
      id: "should-be-ignored",
      user_id: "should-be-ignored",
      phone: undefined,
    });

    expect(repo.updateLead).toHaveBeenCalledWith("lead-10", {
      status: "contacted",
      notes: "Updated",
    });
    expect(result).toEqual(updatedLead);
  });

  it("updateLead should reject empty updates", async () => {
    await expect(service.updateLead("lead-1", { phone: undefined })).rejects.toThrow(
      "updates cannot be empty"
    );
    expect(repo.updateLead).not.toHaveBeenCalled();
  });

  it("deleteLead should call repo delete", async () => {
    (repo.deleteLead as any).mockResolvedValue(undefined);

    await service.deleteLead("lead-11");

    expect(repo.deleteLead).toHaveBeenCalledWith("lead-11");
  });
});