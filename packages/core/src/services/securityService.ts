import type { HttpClient } from '../http';

export interface TwoFactorStatus {
  enabled: boolean;
  enabledAt: string | null;
  recoveryCodesRemaining: number;
}

/** Returned only while enrolment is pending — the secret never leaves the server again. */
export interface TwoFactorSetup {
  secret: string;
  otpAuthUri: string;
}

/** Recovery codes in plaintext. Shown exactly once; only hashes are stored. */
export interface TwoFactorEnabled {
  recoveryCodes: string[];
}

/** One live sign-in. `sessionId` is stable across token rotation, so it is safe to revoke by. */
export interface ActiveSession {
  sessionId: string;
  deviceName: string | null;
  ipAddress: string | null;
  startedAt: string;
  lastUsedAt: string | null;
  expiresAt: string;
  isCurrent: boolean;
}

export interface DataExport {
  dataExportRequestId: string;
  status: 'Pending' | 'Running' | 'Completed' | 'Failed';
  createdAt: string;
  completedAt: string | null;
  sizeBytes: number | null;
  expiresAt: string | null;
  errorMessage: string | null;
  isDownloadable: boolean;
}

export interface AuditEntry {
  auditLogEntryId: string;
  action: string;
  actorUserId: string | null;
  subjectUserId: string | null;
  targetType: string | null;
  targetId: string | null;
  metadataJson: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface Paged<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export function createSecurityService(http: HttpClient) {
  return {
    // ── Two-factor ───────────────────────────────────────────────────────
    getTwoFactorStatus: () => http.get<{ data: TwoFactorStatus }>('/api/security/2fa'),

    /** Begins enrolment. Nothing is enforced until `confirmTwoFactor` succeeds. */
    startTwoFactorSetup: () => http.post<{ data: TwoFactorSetup }>('/api/security/2fa/setup'),

    confirmTwoFactor: (code: string) =>
      http.post<{ data: TwoFactorEnabled }>('/api/security/2fa/confirm', { code }),

    disableTwoFactor: (password: string) =>
      http.post<{ success: boolean; message: string }>('/api/security/2fa/disable', { password }),

    regenerateRecoveryCodes: (password: string) =>
      http.post<{ data: TwoFactorEnabled }>('/api/security/2fa/recovery-codes', { password }),

    // ── Sessions ─────────────────────────────────────────────────────────
    /**
     * Native clients pass their refresh token so the server can flag which row is this device;
     * web omits it, because the HttpOnly cookie already rides along. Sent as a header rather than
     * a query parameter — query strings land in access logs, and this is a credential.
     */
    getSessions: (refreshToken?: string) =>
      http.get<{ data: ActiveSession[] }>('/api/security/sessions', {
        headers: refreshToken ? { 'X-Refresh-Token': refreshToken } : undefined,
      }),

    revokeSession: (sessionId: string) =>
      http.delete<{ success: boolean; message: string }>(`/api/security/sessions/${sessionId}`),

    /**
     * Mobile clients hold the refresh token themselves and must send it, so the server can tell
     * which session to spare. Web leaves it undefined — the HttpOnly cookie carries it.
     */
    revokeOtherSessions: (refreshToken?: string) =>
      http.post<{ data: number; message: string }>('/api/security/sessions/revoke-others', {
        refreshToken,
      }),

    // ── Data rights ──────────────────────────────────────────────────────
    getExports: () => http.get<{ data: DataExport[] }>('/api/security/exports'),

    requestExport: () => http.post<{ data: DataExport; message: string }>('/api/security/exports'),

    /** Resolves to a short-lived signed URL, not the bytes. */
    getExportDownloadUrl: (id: string) =>
      http.get<{ data: string }>(`/api/security/exports/${id}/download`),

    getAuditLog: (page = 1, pageSize = 25) =>
      http.get<{ data: Paged<AuditEntry> }>('/api/security/audit-log', {
        params: { page, pageSize },
      }),

    /**
     * Schedules deletion. Access ends immediately; the erase happens after a grace period.
     * `confirmation` must be the exact phrase the server requires.
     */
    requestAccountDeletion: (password: string, confirmation: string) =>
      http.post<{ data: string; message: string }>('/api/security/account/delete', {
        password,
        confirmation,
      }),

    /** Reachable without a session, because requesting deletion revoked them all. */
    cancelAccountDeletion: (email: string, password: string) =>
      http.post<{ success: boolean; message: string }>('/api/auth/cancel-deletion', {
        email,
        password,
      }),
  };
}

/** The phrase the deletion endpoint requires, kept here so the UI and the server agree. */
export const ACCOUNT_DELETION_CONFIRMATION = 'DELETE MY ACCOUNT';
