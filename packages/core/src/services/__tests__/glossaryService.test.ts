import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createGlossaryService } from '../glossaryService'
import type { HttpClient } from '../../http'

const fakeHttp: HttpClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}

const backendTerm = (overrides: Record<string, unknown> = {}) => ({
  id: 't-1',
  term: 'Mitosis',
  definition: 'Cell division',
  documentId: 'd-1',
  ...overrides,
})

describe('glossaryService', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('getAllGlossary', () => {
    it('maps terms and normalizes citation', async () => {
      const service = createGlossaryService(fakeHttp)
      vi.mocked(fakeHttp.get).mockResolvedValueOnce({
        data: { data: [backendTerm({ citation: { quote: 'q', page: 2 } })] },
      })

      const terms = await service.getAllGlossary()

      expect(fakeHttp.get).toHaveBeenCalledWith('/api/glossary')
      expect(terms[0].citation).toEqual({ quote: 'q', startOffset: undefined, endOffset: undefined, page: 2, startSeconds: undefined })
    })

    it('caches successful results when an offline cache is injected', async () => {
      const offlineCache = { cacheGlossary: vi.fn(), getCachedGlossary: vi.fn() }
      const service = createGlossaryService(fakeHttp, offlineCache)
      vi.mocked(fakeHttp.get).mockResolvedValueOnce({ data: { data: [backendTerm()] } })

      await service.getAllGlossary()

      expect(offlineCache.cacheGlossary).toHaveBeenCalledWith([
        expect.objectContaining({ id: 't-1', term: 'Mitosis' }),
      ])
    })

    it('does not cache an empty result', async () => {
      const offlineCache = { cacheGlossary: vi.fn(), getCachedGlossary: vi.fn() }
      const service = createGlossaryService(fakeHttp, offlineCache)
      vi.mocked(fakeHttp.get).mockResolvedValueOnce({ data: { data: [] } })

      await service.getAllGlossary()

      expect(offlineCache.cacheGlossary).not.toHaveBeenCalled()
    })

    it('falls back to the offline cache on request failure', async () => {
      const cached = [backendTerm()]
      const offlineCache = { cacheGlossary: vi.fn(), getCachedGlossary: vi.fn().mockResolvedValue(cached) }
      const service = createGlossaryService(fakeHttp, offlineCache)
      vi.mocked(fakeHttp.get).mockRejectedValueOnce(new Error('offline'))

      const terms = await service.getAllGlossary()

      expect(terms).toBe(cached)
    })

    it('rethrows on failure when there is no offline cache', async () => {
      const service = createGlossaryService(fakeHttp)
      vi.mocked(fakeHttp.get).mockRejectedValueOnce(new Error('network down'))

      await expect(service.getAllGlossary()).rejects.toThrow('network down')
    })
  })

  describe('getGlossary', () => {
    it('fetches the course/document-scoped glossary', async () => {
      const service = createGlossaryService(fakeHttp)
      vi.mocked(fakeHttp.get).mockResolvedValueOnce({ data: { data: [backendTerm()] } })

      const terms = await service.getGlossary('c-1', 'd-1')

      expect(fakeHttp.get).toHaveBeenCalledWith('/api/courses/c-1/documents/d-1/glossary')
      expect(terms).toEqual([{ id: 't-1', term: 'Mitosis', definition: 'Cell division', documentId: 'd-1' }])
    })

    it('returns an empty array on failure', async () => {
      const service = createGlossaryService(fakeHttp)
      vi.mocked(fakeHttp.get).mockRejectedValueOnce(new Error('fail'))
      expect(await service.getGlossary('c-1', 'd-1')).toEqual([])
    })
  })

  describe('getVideoGlossary / generateVideoGlossary', () => {
    it('stamps the requested videoId onto each mapped term', async () => {
      const service = createGlossaryService(fakeHttp)
      vi.mocked(fakeHttp.get).mockResolvedValueOnce({ data: { data: [backendTerm({ videoId: 'other' })] } })

      const terms = await service.getVideoGlossary('v-1')

      expect(fakeHttp.get).toHaveBeenCalledWith('/api/videos/v-1/glossary')
      expect(terms[0].videoId).toBe('v-1')
    })

    it('generateVideoGlossary posts the videoUrl and stamps videoId', async () => {
      const service = createGlossaryService(fakeHttp)
      vi.mocked(fakeHttp.post).mockResolvedValueOnce({ data: { data: [backendTerm()] } })

      const terms = await service.generateVideoGlossary('v-1', 'https://youtu.be/x')

      expect(fakeHttp.post).toHaveBeenCalledWith('/api/videos/v-1/glossary/generate', { videoUrl: 'https://youtu.be/x' })
      expect(terms[0].videoId).toBe('v-1')
    })
  })

  describe('updateTerm / deleteTerm / mastery', () => {
    it('updateTerm puts and maps the result', async () => {
      const service = createGlossaryService(fakeHttp)
      vi.mocked(fakeHttp.put).mockResolvedValueOnce({ data: { data: backendTerm({ term: 'Updated' }) } })

      const term = await service.updateTerm('t-1', 'Updated', 'New def')

      expect(fakeHttp.put).toHaveBeenCalledWith('/api/glossary/terms/t-1', { term: 'Updated', definition: 'New def' })
      expect(term.term).toBe('Updated')
    })

    it('deleteTerm deletes by id', async () => {
      const service = createGlossaryService(fakeHttp)
      await service.deleteTerm('t-1')
      expect(fakeHttp.delete).toHaveBeenCalledWith('/api/glossary/terms/t-1')
    })

    it('getMasteredIds defaults to an empty array', async () => {
      const service = createGlossaryService(fakeHttp)
      vi.mocked(fakeHttp.get).mockResolvedValueOnce({ data: { data: undefined } })
      expect(await service.getMasteredIds()).toEqual([])
    })

    it('toggleMastered posts and returns the new state', async () => {
      const service = createGlossaryService(fakeHttp)
      vi.mocked(fakeHttp.post).mockResolvedValueOnce({ data: { data: true } })
      expect(await service.toggleMastered('t-1')).toBe(true)
      expect(fakeHttp.post).toHaveBeenCalledWith('/api/glossary/mastered/t-1')
    })
  })
})
