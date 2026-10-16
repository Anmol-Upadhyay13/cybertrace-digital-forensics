/**
 * CyberTrace API Client with Cryptographic Bearer Token Authorization
 * Features automatic token refresh, session persistence, and seamless 401 retry recovery.
 */

import {
  User,
  Investigation,
  EvidenceItem,
  CustodyTransfer,
  IntegrityCheck,
  AuditEvent,
  AuditVerificationResult,
  DashboardStats,
  SecuritySettings
} from '../types/forensics';

const BASE_URL = '/api';
const TOKEN_STORAGE_KEY = 'cybertrace_auth_token';

let currentAuthToken: string | null = null;

// Initialize token from sessionStorage if present
if (typeof window !== 'undefined') {
  try {
    currentAuthToken = sessionStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function setAuthToken(token: string) {
  currentAuthToken = token;
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    } catch {
      // ignore
    }
  }
}

export function getAuthToken(): string | null {
  return currentAuthToken;
}

function getAuthHeaders(isFormData = false): Record<string, string> {
  const headers: Record<string, string> = {};
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  if (currentAuthToken) {
    headers['Authorization'] = `Bearer ${currentAuthToken}`;
  }
  return headers;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    if (res.status === 401) {
      currentAuthToken = null;
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.removeItem(TOKEN_STORAGE_KEY);
        } catch {
          // ignore
        }
      }
    }
    let errMessage = `HTTP error ${res.status}`;
    try {
      const data = await res.json();
      errMessage = data.error || data.message || errMessage;
    } catch {
      // ignore
    }
    throw new Error(errMessage);
  }
  return res.json();
}

/**
 * Robust fetch wrapper that attaches Bearer tokens and automatically handles
 * token recovery / retries if a token has expired or dev server was restarted.
 */
async function requestWithAuth<T>(
  endpoint: string,
  options: RequestInit = {},
  isFormData = false
): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  const headers = getAuthHeaders(isFormData);
  if (options.headers) {
    Object.assign(headers, options.headers);
  }

  let res = await fetch(url, { ...options, headers });

  // If 401 Unauthorized occurs on an authenticated endpoint, recover session and retry once
  if (res.status === 401 && !endpoint.includes('/session')) {
    try {
      const freshSession = await api.getSession();
      if (freshSession?.token) {
        const retryHeaders = getAuthHeaders(isFormData);
        if (options.headers) {
          Object.assign(retryHeaders, options.headers);
        }
        res = await fetch(url, { ...options, headers: retryHeaders });
      }
    } catch {
      // Let handleResponse produce the error
    }
  }

  return handleResponse<T>(res);
}

export const api = {
  // Health & Session
  async getHealth() {
    const res = await fetch(`${BASE_URL}/health`);
    return handleResponse<any>(res);
  },

  async getSession(): Promise<{ user: User; token: string }> {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (currentAuthToken) {
        headers['Authorization'] = `Bearer ${currentAuthToken}`;
      }

      const res = await fetch(`${BASE_URL}/session`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.token) {
          setAuthToken(data.token);
        }
        return data;
      }

      // If token was rejected (401), clear invalid token and fetch clean default session
      currentAuthToken = null;
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.removeItem(TOKEN_STORAGE_KEY);
        } catch {
          // ignore
        }
      }

      const retryRes = await fetch(`${BASE_URL}/session`);
      if (retryRes.ok) {
        const retryData = await retryRes.json();
        if (retryData.token) {
          setAuthToken(retryData.token);
        }
        return retryData;
      }
    } catch {
      // Network or parsing error, fallback to explicit operator bootstrap
    }

    // Fallback bootstrap: switch to default operator
    const fallbackRes = await fetch(`${BASE_URL}/session/switch-role`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'USR-001' })
    });
    const fallbackData = await handleResponse<{ success: boolean; user: User; token: string }>(fallbackRes);
    if (fallbackData.token) {
      setAuthToken(fallbackData.token);
    }
    return { user: fallbackData.user, token: fallbackData.token };
  },

  async switchRole(userId: string): Promise<{ success: boolean; user: User; token: string }> {
    const res = await fetch(`${BASE_URL}/session/switch-role`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ userId })
    });
    const data = await handleResponse<{ success: boolean; user: User; token: string }>(res);
    if (data.token) {
      setAuthToken(data.token);
    }
    return data;
  },

  // Users
  async getUsers(): Promise<User[]> {
    return requestWithAuth<User[]>('/users');
  },

  async createUser(payload: Partial<User>): Promise<User> {
    return requestWithAuth<User>('/users', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async updateUserRole(id: string, role: string): Promise<User> {
    return requestWithAuth<User>(`/users/${id}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role })
    });
  },

  async updateUserStatus(id: string, active: boolean): Promise<User> {
    return requestWithAuth<User>(`/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ active })
    });
  },

  // Dashboard
  async getDashboardStats(): Promise<DashboardStats> {
    return requestWithAuth<DashboardStats>('/dashboard/stats');
  },

  // Cases
  async getCases(): Promise<Investigation[]> {
    return requestWithAuth<Investigation[]>('/cases');
  },

  async getCase(id: string): Promise<Investigation & { evidenceItems: EvidenceItem[]; custodyTransfers: CustodyTransfer[]; auditEvents: AuditEvent[] }> {
    return requestWithAuth<any>(`/cases/${id}`);
  },

  async createCase(payload: Partial<Investigation>): Promise<Investigation> {
    return requestWithAuth<Investigation>('/cases', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async updateCase(id: string, payload: Partial<Investigation>): Promise<Investigation> {
    return requestWithAuth<Investigation>(`/cases/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  },

  // Evidence
  async getEvidence(): Promise<EvidenceItem[]> {
    return requestWithAuth<EvidenceItem[]>('/evidence');
  },

  async getEvidenceItem(id: string): Promise<EvidenceItem & { transfers: CustodyTransfer[]; verifications: IntegrityCheck[]; auditEvents: AuditEvent[] }> {
    return requestWithAuth<any>(`/evidence/${id}`);
  },

  async registerEvidence(formData: FormData): Promise<EvidenceItem> {
    return requestWithAuth<EvidenceItem>(
      '/evidence/register',
      {
        method: 'POST',
        body: formData
      },
      true // multipart
    );
  },

  async verifyEvidenceIntegrity(id: string): Promise<IntegrityCheck> {
    return requestWithAuth<IntegrityCheck>(`/evidence/${id}/verify-integrity`, {
      method: 'POST'
    });
  },

  async simulateTamper(id: string): Promise<{ success: boolean; message: string }> {
    return requestWithAuth<any>(`/evidence/${id}/simulate-tamper`, {
      method: 'POST'
    });
  },

  async restoreTamper(id: string): Promise<{ success: boolean; message: string }> {
    return requestWithAuth<any>(`/evidence/${id}/restore-tamper`, {
      method: 'POST'
    });
  },

  getEvidenceDownloadUrl(id: string): string {
    const token = currentAuthToken || '';
    return `${BASE_URL}/evidence/${id}/download?token=${encodeURIComponent(token)}`;
  },

  // Custody
  async getCustodyTransfers(): Promise<CustodyTransfer[]> {
    return requestWithAuth<CustodyTransfer[]>('/custody/transfers');
  },

  async requestCustodyTransfer(payload: {
    evidenceId: string;
    toCustodianId: string;
    transferReason: string;
    transferMethod: string;
    destinationLocation: string;
    senderNotes?: string;
  }): Promise<CustodyTransfer> {
    return requestWithAuth<CustodyTransfer>('/custody/transfers/request', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async acknowledgeCustodyTransfer(id: string, payload: { recipientNotes?: string; digitalSignatureConfirm: boolean }): Promise<any> {
    return requestWithAuth<any>(`/custody/transfers/${id}/acknowledge`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async rejectCustodyTransfer(id: string, reason: string): Promise<CustodyTransfer> {
    return requestWithAuth<CustodyTransfer>(`/custody/transfers/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  },

  async cancelCustodyTransfer(id: string, reason?: string): Promise<CustodyTransfer> {
    return requestWithAuth<CustodyTransfer>(`/custody/transfers/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  },

  // Audit
  async getAuditEvents(): Promise<AuditEvent[]> {
    return requestWithAuth<AuditEvent[]>('/audit/events');
  },

  async verifyAuditChain(): Promise<AuditVerificationResult> {
    return requestWithAuth<AuditVerificationResult>('/audit/verify-chain');
  },

  async simulateAuditTamper(): Promise<{ success: boolean; message: string }> {
    return requestWithAuth<any>('/audit/simulate-tamper', {
      method: 'POST'
    });
  },

  async restoreAuditChain(): Promise<{ success: boolean; message: string }> {
    return requestWithAuth<any>('/audit/restore-chain', {
      method: 'POST'
    });
  },

  // Settings
  async getSettings(): Promise<SecuritySettings> {
    return requestWithAuth<SecuritySettings>('/settings');
  },

  async updateSettings(settings: Partial<SecuritySettings>): Promise<SecuritySettings> {
    return requestWithAuth<SecuritySettings>('/settings', {
      method: 'PATCH',
      body: JSON.stringify(settings)
    });
  },

  // Demo
  async resetDemoData(): Promise<{ success: boolean; message: string }> {
    return requestWithAuth<any>('/demo/reset', {
      method: 'POST'
    });
  },

  getCsvExportUrl(type: 'evidence' | 'custody' | 'audit'): string {
    const token = currentAuthToken || '';
    return `${BASE_URL}/reports/export-csv?type=${type}&token=${encodeURIComponent(token)}`;
  }
};
