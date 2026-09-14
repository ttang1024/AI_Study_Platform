import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createLanguageService } from '../languageService'
import type { HttpClient } from '../../http'

const fakeHttp: HttpClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}

describe('languageService', () => {
  beforeEach(() => vi.clearAllMocks())
  const service = createLanguageService(fakeHttp)

  it('translate posts text/targetLanguage and returns the translation', async () => {
    vi.mocked(fakeHttp.post).mockResolvedValueOnce({ data: { data: 'Bonjour' } })
    const result = await service.translate('Hello', 'fr')
    expect(fakeHttp.post).toHaveBeenCalledWith('/api/ai/translate', { text: 'Hello', targetLanguage: 'fr' })
    expect(result).toBe('Bonjour')
  })

})
