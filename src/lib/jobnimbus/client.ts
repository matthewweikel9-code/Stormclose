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
  type: 'note' | 'call' | 'email' | 'meeting' | 'task';
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

const JN_BASE_URL = 'https://api.jobnimbus.com';

export class JobNimbusClient {
  private apiKey: string;
  
  constructor(config: JobNimbusConfig) {
    this.apiKey = config.apiKey;
  }
  
  private async request<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    endpoint: string,
    body?: unknown
  ): Promise<JNApiResponse<T>> {
    try {
      const response = await fetch(`${JN_BASE_URL}${endpoint}`, {
        method,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        return {
          success: false,
          error: {
            title: data.title || 'API Error',
            status: response.status,
            detail: data.detail || `Request failed with status ${response.status}`,
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
    // Try to list contacts with limit 1 to test connection
    const result = await this.request<{ results: JNContact[] }>(
      'POST',
      '/contacts/v1/contacts/list',
      { limit: 1 }
    );
    return result.success;
  }
  
  // ============================================
  // CONTACTS
  // ============================================
  
  /**
   * Create a new contact in JobNimbus
   */
  async createContact(contact: JNContact): Promise<JNApiResponse<JNContact>> {
    return this.request<JNContact>('POST', '/contacts/v1/contacts', contact);
  }
  
  /**
   * Update an existing contact
   */
  async updateContact(contactId: string, updates: Partial<JNContact>): Promise<JNApiResponse<JNContact>> {
    return this.request<JNContact>('PATCH', `/contacts/v1/contacts/${contactId}`, updates);
  }
  
  /**
   * Get a contact by ID
   */
  async getContact(contactId: string): Promise<JNApiResponse<JNContact>> {
    return this.request<JNContact>('GET', `/contacts/v1/contacts/${contactId}`);
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
    const filters: Record<string, unknown>[] = [];
    
    if (query.address) {
      filters.push({
        field: 'address_line1',
        operator: 'contains',
        value: query.address,
      });
    }
    
    if (query.email) {
      filters.push({
        field: 'email',
        operator: 'eq',
        value: query.email,
      });
    }
    
    return this.request<{ results: JNContact[] }>('POST', '/contacts/v1/contacts/list', {
      filters,
      limit: query.limit || 10,
    });
  }
  
  // ============================================
  // JOBS
  // ============================================
  
  /**
   * Create a new job in JobNimbus
   */
  async createJob(job: JNJob): Promise<JNApiResponse<JNJob>> {
    return this.request<JNJob>('POST', '/jobs/v1/jobs', job);
  }
  
  /**
   * Update an existing job
   */
  async updateJob(jobId: string, updates: Partial<JNJob>): Promise<JNApiResponse<JNJob>> {
    return this.request<JNJob>('PATCH', `/jobs/v1/jobs/${jobId}`, updates);
  }
  
  // ============================================
  // ACTIVITIES
  // ============================================
  
  /**
   * Create an activity (note, call log, etc.)
   */
  async createActivity(activity: JNActivity): Promise<JNApiResponse<JNActivity>> {
    return this.request<JNActivity>('POST', '/activities/v1/activities', activity);
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
