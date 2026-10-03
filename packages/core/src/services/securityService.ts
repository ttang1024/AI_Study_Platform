import type { HttpClient } from '../http';

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

/** Data rights: export everything, or schedule the account for deletion. */
export function createSecurityService(http: HttpClient) {
  return {
    getExports: () => http.get<{ data: DataExport[] }>('/api/security/exports'),

    requestExport: () => http.post<{ data: DataExport; message: string }>('/api/security/exports'),

    /** Resolves to a short-lived signed URL, not the bytes. */
    getExportDownloadUrl: (id: string) =>
      http.get<{ data: string }>(`/api/security/exports/${id}/download`),

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
