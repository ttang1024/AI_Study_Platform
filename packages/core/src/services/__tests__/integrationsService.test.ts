import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createIntegrationsService, API_SCOPE_LABELS, WEBHOOK_EVENT_LABELS } from '../integrationsService'
import type { HttpClient } from '../../http'

const fakeHttp: HttpClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}

describe('integrationsService', () => {
  beforeEach(() => vi.clearAllMocks())
  const service = createIntegrationsService(fakeHttp)

  it('getApiKeys GETs /api/integrations/api-keys', () => {
    service.getApiKeys()
    expect(fakeHttp.get).toHaveBeenCalledWith('/api/integrations/api-keys')
  })

  it('createApiKey posts name/scopes/expiresInDays', () => {
    const input = { name: 'CI key', scopes: ['library:read'], expiresInDays: 30 }
    service.createApiKey(input)
    expect(fakeHttp.post).toHaveBeenCalledWith('/api/integrations/api-keys', input)
  })

  it('revokeApiKey deletes by id', () => {
    service.revokeApiKey('k-1')
    expect(fakeHttp.delete).toHaveBeenCalledWith('/api/integrations/api-keys/k-1')
  })

  it('getWebhooks GETs /api/integrations/webhooks', () => {
    service.getWebhooks()
    expect(fakeHttp.get).toHaveBeenCalledWith('/api/integrations/webhooks')
  })

  it('createWebhook posts url/events', () => {
    const input = { url: 'https://hook.example', events: ['document.created'] }
    service.createWebhook(input)
    expect(fakeHttp.post).toHaveBeenCalledWith('/api/integrations/webhooks', input)
  })

  it('deleteWebhook deletes by id', () => {
    service.deleteWebhook('w-1')
    expect(fakeHttp.delete).toHaveBeenCalledWith('/api/integrations/webhooks/w-1')
  })

  it('exportMarkdown requests a blob for the course-scoped export', () => {
    service.exportMarkdown('c-1')
    expect(fakeHttp.get).toHaveBeenCalledWith('/api/integrations/export/markdown/c-1', { responseType: 'blob' })
  })

  it('has a human label for every declared scope/event', () => {
    expect(Object.keys(API_SCOPE_LABELS).length).toBeGreaterThan(0)
    expect(Object.keys(WEBHOOK_EVENT_LABELS).length).toBeGreaterThan(0)
    expect(API_SCOPE_LABELS['library:read']).toBe('Read your library')
    expect(WEBHOOK_EVENT_LABELS['document.created']).toBe('A document is added')
  })
})
