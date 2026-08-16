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

  it('mineSentence posts the input and returns the new card id', async () => {
    const input = { sentence: 'Le chat dort.', targetWord: 'chat', meaning: 'cat', documentId: 'd-1' }
    vi.mocked(fakeHttp.post).mockResolvedValueOnce({ data: { data: 'card-1' } })
    const result = await service.mineSentence(input)
    expect(fakeHttp.post).toHaveBeenCalledWith('/api/language/mine', input)
    expect(result).toBe('card-1')
  })
})
