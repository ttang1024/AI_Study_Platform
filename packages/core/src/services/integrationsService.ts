import type { HttpClient } from '../http';

export interface ApiKey {
  apiKeyId: string;
  name: string;
  /** First few characters of the key. All the server can show — the rest is only stored hashed. */
  prefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

/** The one response carrying the key itself. There is no way to read it again. */
export interface CreatedApiKey {
  key: ApiKey;
  plaintextKey: string;
}

export interface Webhook {
  webhookId: string;
  url: string;
  events: string[];
  isActive: boolean;
  lastDeliveryAt: string | null;
  lastStatusCode: number | null;
  consecutiveFailures: number;
  createdAt: string;
}

/** The signing secret is returned once, at creation, and never listed. */
export interface CreatedWebhook {
  webhook: Webhook;
  secret: string;
}

export function createIntegrationsService(http: HttpClient) {
  return {
    // ── API keys ─────────────────────────────────────────────────────────
    getApiKeys: () => http.get<{ data: ApiKey[] }>('/api/integrations/api-keys'),

    getScopes: () => http.get<{ data: string[] }>('/api/integrations/api-keys/scopes'),

    createApiKey: (input: { name: string; scopes: string[]; expiresInDays?: number | null }) =>
      http.post<{ data: CreatedApiKey; message: string }>('/api/integrations/api-keys', input),

    revokeApiKey: (id: string) =>
      http.delete<{ success: boolean; message: string }>(`/api/integrations/api-keys/${id}`),

    // ── Webhooks ─────────────────────────────────────────────────────────
    getWebhooks: () => http.get<{ data: Webhook[] }>('/api/integrations/webhooks'),

    getWebhookEvents: () => http.get<{ data: string[] }>('/api/integrations/webhooks/events'),

    createWebhook: (input: { url: string; events: string[] }) =>
      http.post<{ data: CreatedWebhook; message: string }>('/api/integrations/webhooks', input),

    deleteWebhook: (id: string) =>
      http.delete<{ success: boolean; message: string }>(`/api/integrations/webhooks/${id}`),

    // ── Markdown export ──────────────────────────────────────────────────
    /** Streams a zip. Small enough to build inline, unlike the full account export. */
    exportMarkdown: (courseId: string) =>
      http.get<Blob>(`/api/integrations/export/markdown/${courseId}`, { responseType: 'blob' }),
  };
}

/**
 * Human labels for scopes and events. Kept beside the service so both clients render the same
 * wording without either having to invent it.
 */
export const API_SCOPE_LABELS: Record<string, string> = {
  'library:read': 'Read your library',
  'library:write': 'Add and edit library items',
  'flashcards:read': 'Read your flashcards',
  'flashcards:write': 'Create and edit flashcards',
  'analytics:read': 'Read your study statistics',
};

export const WEBHOOK_EVENT_LABELS: Record<string, string> = {
  'document.created': 'A document is added',
  'flashcards.generated': 'Flashcards are generated',
  'quiz.completed': 'A quiz is completed',
  'reviews.due': 'Reviews become due',
  'certificate.issued': 'A certificate is issued',
};
