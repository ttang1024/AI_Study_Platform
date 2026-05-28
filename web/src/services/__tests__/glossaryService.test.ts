import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockApiClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}

vi.mock('../apiClient', () => ({ apiClient: mockApiClient }))

const { glossaryService } = await import('../glossaryService')

const backendTerm = (id = 't-1') => ({
  id,
  term: 'Entropy',
  definition: 'A measure of disorder',
  documentId: 'doc-1',
  youTubeVideoId: undefined,
  courseId: 'c-1',
  sourceName: 'lecture.pdf',
  sourceKind: 'document',
})

describe('glossaryService', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('getAllGlossary', () => {
    it('returns mapped terms list', async () => {
      mockApiClient.get.mockResolvedValueOnce({ data: { data: [backendTerm('t-1'), backendTerm('t-2')] } })

      const terms = await glossaryService.getAllGlossary()

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/glossary')
      expect(terms).toHaveLength(2)
      expect(terms[0]).toMatchObject({ id: 't-1', term: 'Entropy', definition: 'A measure of disorder' })
    })

    it('returns empty array on error', async () => {
      mockApiClient.get.mockRejectedValueOnce(new Error('Network error'))

      const terms = await glossaryService.getAllGlossary()

      expect(terms).toEqual([])
    })

    it('returns empty array when data is null', async () => {
      mockApiClient.get.mockResolvedValueOnce({ data: { data: null } })

      const terms = await glossaryService.getAllGlossary()

      expect(terms).toEqual([])
    })
  })

  describe('getGlossary', () => {
    it('fetches glossary for a course+document', async () => {
      mockApiClient.get.mockResolvedValueOnce({ data: { data: [backendTerm()] } })

      const terms = await glossaryService.getGlossary('c-1', 'doc-1')

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/courses/c-1/documents/doc-1/glossary')
      expect(terms).toHaveLength(1)
    })

    it('returns empty array on error', async () => {
      mockApiClient.get.mockRejectedValueOnce(new Error('Not found'))
      const terms = await glossaryService.getGlossary('c-1', 'doc-1')
      expect(terms).toEqual([])
    })
  })

  describe('updateTerm', () => {
    it('puts and returns the mapped term', async () => {
      const updated = { ...backendTerm('t-1'), term: 'Enthalpy', definition: 'Heat content' }
      mockApiClient.put.mockResolvedValueOnce({ data: { data: updated } })

      const result = await glossaryService.updateTerm('t-1', 'Enthalpy', 'Heat content')

      expect(mockApiClient.put).toHaveBeenCalledWith('/api/glossary/terms/t-1', {
        term: 'Enthalpy',
        definition: 'Heat content',
      })
      expect(result.term).toBe('Enthalpy')
      expect(result.definition).toBe('Heat content')
    })
  })

  describe('deleteTerm', () => {
    it('calls DELETE with the term id', async () => {
      mockApiClient.delete.mockResolvedValueOnce({})

      await glossaryService.deleteTerm('t-1')

      expect(mockApiClient.delete).toHaveBeenCalledWith('/api/glossary/terms/t-1')
    })
  })
})
