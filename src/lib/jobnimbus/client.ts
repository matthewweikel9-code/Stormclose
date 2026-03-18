/**
 * JobNimbus API Client
 * 
 * Integration layer for syncing leads and activities to JobNimbus CRM.
 * API Docs: https://developer.jobnimbus.com/
 */

export interface JobNimbusConfig {
  apiKey: string;
}

export interface JNContact {
  id?: string;
  first_name?: string;
  last_name?: string;
  display_name?: string;
  company?: string;
  email?: string;
  mobile_phone?: string;
  home_phone?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state_text?: string;
  zip?: string;
  country?: string;
  notes?: string;
  description?: string;
  source_name?: string;
  tags?: string[];
  // Custom fields
  custom_fields?: Record<string, string | number | boolean>;
}

export interface JNJob {
  id?: string;
  contact_id: string;
  name?: string;
  description?: string;
  status_name?: string;
  address_line1?: string;
  city?: string;
  state_text?: string;
  zip?: string;
  tags?: string[];
  custom_fields?: Record<string, string | number | boolean>;
}

export interface JNActivity {
  id?: string;
  contact_id?: string;
  job_id?: string;
  type: 'note' | 'call' | 'email' | 'meeting' | 'task' | 'activity';
  title?: string;
  note?: string;
  date_created?: string;
}

export interface JNApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    title: string;
    status: number;
    detail?: string;
  };
}

// JobNimbus: app.jobnimbus.com/api1 (legacy) and api.jobnimbus.com (Platform API)
const JN_APP_BASE = 'https://app.jobnimbus.com/api1';
const JN_API_BASE = 'https://api.jobnimbus.com';

export class JobNimbusClient {
  private apiKey: string;
  
  constructor(config: JobNimbusConfig) {
    this.apiKey = config.apiKey;
  }
  
  private async request<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    endpoint: string,
    body?: unknown,
    base: string = JN_APP_BASE
  ): Promise<JNApiResponse<T>> {
    try {
      const response = await fetch(`${base}${endpoint}`, {
        method,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      
      let data: Record<string, unknown> = {};
      let rawText = '';
      try {
        rawText = await response.text();
        data = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : {};
      } catch {
        data = {};
      }
      
      if (!response.ok) {
        // Parse error from various JobNimbus/API formats
        const rawDetail = (data.detail as string) ||
          (data.message as string) ||
          (typeof data.error === 'string' ? data.error : null) ||
          (Array.isArray(data.errors) ? (data.errors as string[]).join('; ') : null);
        const nestedErrors = data.errors as Array<{ message?: string }> | undefined;
        const nestedMsg = Array.isArray(nestedErrors) && nestedErrors[0]?.message
          ? nestedErrors.map((e) => e.message).join('; ')
          : null;
        const jsonDetail = typeof data === 'object' && Object.keys(data).length ? JSON.stringify(data) : null;
        const detail =
          rawDetail ||
          nestedMsg ||
          jsonDetail ||
          (rawText ? rawText.slice(0, 300) : null) ||
          `Request failed with status ${response.status}`;
        if (response.status >= 400 && response.status < 500 && rawText) {
          console.warn('[JobNimbus API]', response.status, endpoint, 'raw:', rawText.slice(0, 500));
        }
        return {
          success: false,
          error: {
            title: (data.title as string) || 'API Error',
            status: response.status,
            detail,
          },
        };
      }
      
      return {
        success: true,
        data: data as T,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          title: 'Network Error',
          status: 0,
          detail: error instanceof Error ? error.message : 'Unknown error occurred',
        },
      };
    }
  }
  
  /**
   * Test the API connection
   */
  async testConnection(): Promise<boolean> {
    const result = await this.request<{ results?: JNContact[] }>('GET', '/contacts?limit=1');
    return result.success;
  }
  
  // ============================================
  // CONTACTS
  // ============================================
  
  /**
   * Create a new contact in JobNimbus
   * POST app.jobnimbus.com/api1/contacts
   * Sends only standard fields; omits source_name (may require predefined value)
   */
  async createContact(contact: JNContact): Promise<JNApiResponse<JNContact>> {
    const body: Record<string, unknown> = {};
    const allowed = ['first_name', 'last_name', 'display_name', 'email', 'mobile_phone', 'home_phone', 'address_line1', 'address_line2', 'city', 'state_text', 'zip', 'notes'];
    for (const k of allowed) {
      const v = (contact as Record<string, unknown>)[k];
      if (v !== undefined && v !== null && String(v).trim() !== '') {
        body[k] = v;
      }
    }
    if (!body.display_name && (body.first_name || body.last_name)) {
      body.display_name = [body.first_name, body.last_name].filter(Boolean).join(' ').trim() || 'Contact';
    }
    if (!body.first_name) body.first_name = 'Contact';
    if (!body.last_name) body.last_name = 'Referral';

    let result = await this.request<JNContact>('POST', '/contacts', body, JN_APP_BASE);
    if (!result.success && result.error?.status === 404) {
      result = await this.request<JNContact>('POST', '/contacts', body, JN_API_BASE);
    }
    return result;
  }
  
  /**
   * Update an existing contact
   * JobNimbus app API may require PUT; try PUT first, fallback to PATCH
   */
  async updateContact(contactId: string, updates: Partial<JNContact>): Promise<JNApiResponse<JNContact>> {
    const body: Record<string, unknown> = {};
    const allowed = ['first_name', 'last_name', 'display_name', 'email', 'mobile_phone', 'home_phone', 'address_line1', 'address_line2', 'city', 'state_text', 'zip', 'notes', 'description'];
    for (const k of allowed) {
      const v = (updates as Record<string, unknown>)[k];
      if (v !== undefined && v !== null && String(v).trim() !== '') {
        body[k] = v;
      }
    }
    if (Object.keys(body).length === 0) return { success: true, data: {} as JNContact };
    const result = await this.request<JNContact>('PUT', `/contacts/${contactId}`, body);
    if (!result.success && result.error?.status === 405) {
      return this.request<JNContact>('PATCH', `/contacts/${contactId}`, body);
    }
    return result;
  }
  
  /**
   * Get a contact by ID
   */
  async getContact(contactId: string): Promise<JNApiResponse<JNContact>> {
    return this.request<JNContact>('GET', `/contacts/${contactId}`);
  }
  
  /**
   * Search for contacts
   */
  async searchContacts(query: {
    address?: string;
    email?: string;
    phone?: string;
    limit?: number;
  }): Promise<JNApiResponse<{ results: JNContact[] }>> {
    const params = new URLSearchParams();
    if (query.limit) params.set('limit', String(query.limit));
    const qs = params.toString();
    return this.request<{ results: JNContact[] }>('GET', `/contacts${qs ? `?${qs}` : ''}`);
  }

  /**
   * Search for contacts by address (finds existing contact before creating duplicate)
   * Fetches recent contacts and filters by address match
   */
  async searchContactsByAddress(propertyAddress: string): Promise<JNApiResponse<JNContact[]>> {
    const streetPart = (propertyAddress || '').trim().split(',')[0]?.trim().toLowerCase() || '';
    if (!streetPart || streetPart.length < 5) {
      return { success: true, data: [] };
    }
    const result = await this.request<{ results?: JNContact[] }>(
      'GET',
      '/contacts?limit=200',
      undefined,
      JN_APP_BASE
    );
    if (!result.success || !result.data) {
      return { success: true, data: [] };
    }
    const list = (result.data as { results?: JNContact[] }).results ?? [];
    const matches = list.filter((c) => {
      const addr = [c.address_line1, c.city, c.state_text, c.zip].filter(Boolean).join(' ').toLowerCase();
      return addr.includes(streetPart) || (c.address_line1 || '').toLowerCase().includes(streetPart);
    });
    return { success: true, data: matches };
  }
  
  // ============================================
  // JOBS
  // ============================================
  
  /**
   * Create a new job in JobNimbus
   */
  async createJob(job: JNJob): Promise<JNApiResponse<JNJob>> {
    return this.request<JNJob>('POST', '/jobs', job);
  }
  
  /**
   * Update an existing job
   */
  async updateJob(jobId: string, updates: Partial<JNJob>): Promise<JNApiResponse<JNJob>> {
    return this.request<JNJob>('PATCH', `/jobs/${jobId}`, updates);
  }
  
  // ============================================
  // ACTIVITIES
  // ============================================
  
  /**
   * Create an activity (note, call log, etc.)
   * Tries app.jobnimbus.com/api1 first; JobNimbus may use different API for activities.
   */
  async createActivity(activity: JNActivity): Promise<JNApiResponse<JNActivity>> {
    let result = await this.request<JNActivity>('POST', '/activities', activity, JN_APP_BASE);
    if (!result.success) {
      console.warn('[JobNimbus] createActivity failed:', result.error?.status, result.error?.detail);
      if (result.error?.status === 404) {
        result = await this.request<JNActivity>('POST', '/activities', activity, JN_API_BASE);
      }
    }
    return result;
  }
  
  /**
   * Log a door knock activity
   */
  async logDoorKnock(contactId: string, outcome: string, notes?: string): Promise<JNApiResponse<JNActivity>> {
    return this.createActivity({
      contact_id: contactId,
      type: 'note',
      title: `Door Knock - ${outcome}`,
      note: notes || `Door knock logged via StormClose AI. Outcome: ${outcome}`,
    });
  }
  
  /**
   * Log a phone call
   */
  async logCall(contactId: string, outcome: string, notes?: string): Promise<JNApiResponse<JNActivity>> {
    return this.createActivity({
      contact_id: contactId,
      type: 'call',
      title: `Call - ${outcome}`,
      note: notes,
    });
  }
}

/**
 * Create a JobNimbus client from API key
 */
export function createJobNimbusClient(apiKey: string): JobNimbusClient {
  return new JobNimbusClient({ apiKey });
}
