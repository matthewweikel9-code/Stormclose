import { createClient } from "@/lib/supabase/server";

export interface LeadFilters {
  status?: string;
  minLeadScore?: number;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface LeadThreatInputs {
  hailSize?: number;
  windSpeed?: number;
  stormDurationMinutes?: number;
  proximityScore?: number;
  parcelValueNormalized?: number;
  roofAgeYears?: number;
}

export interface LeadPayload extends LeadThreatInputs {
  id?: string;
  user_id?: string;
  lead_score?: number;
  status?: string;
  address?: string;
  homeowner_name?: string;
  phone?: string;
  email?: string;
  notes?: string;
  [key: string]: unknown;
}

export interface LeadRecord extends LeadPayload {
  id: string;
  user_id: string;
}

export interface LeadRepo {
  getLeads(userId: string, filters?: LeadFilters): Promise<LeadRecord[]>;
  upsertLead(lead: LeadPayload): Promise<LeadRecord>;
  updateLead(leadId: string, updates: Partial<LeadPayload>): Promise<LeadRecord>;
  deleteLead(leadId: string): Promise<void>;
}

export class SupabaseLeadRepo implements LeadRepo {
  async getLeads(userId: string, filters: LeadFilters = {}): Promise<LeadRecord[]> {
    const supabase = await createClient();

    let query = (supabase.from("leads") as any)
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (filters.status) {
      query = query.eq("status", filters.status);
    }

    if (typeof filters.minLeadScore === "number") {
      query = query.gte("lead_score", filters.minLeadScore);
    }

    if (filters.search) {
      const safeSearch = `%${filters.search}%`;
      query = query.or(`address.ilike.${safeSearch},homeowner_name.ilike.${safeSearch}`);
    }

    if (typeof filters.limit === "number") {
      const start = Math.max(0, filters.offset ?? 0);
      const end = start + Math.max(1, filters.limit) - 1;
      query = query.range(start, end);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return (data ?? []) as LeadRecord[];
  }

  async upsertLead(lead: LeadPayload): Promise<LeadRecord> {
    const supabase = await createClient();
    const { data, error } = await (supabase.from("leads") as any)
      .upsert(lead, { onConflict: "id" })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return data as LeadRecord;
  }

  async updateLead(leadId: string, updates: Partial<LeadPayload>): Promise<LeadRecord> {
    const supabase = await createClient();
    const { data, error } = await (supabase.from("leads") as any)
      .update(updates)
      .eq("id", leadId)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return data as LeadRecord;
  }

  async deleteLead(leadId: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await (supabase.from("leads") as any).delete().eq("id", leadId);

    if (error) {
      throw error;
    }
  }
}