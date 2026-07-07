import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockApiClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}

vi.mock('../apiClient', () => ({ apiClient: mockApiClient }))

const { flashcardService } = await import('../flashcardService')

const backendCard = {
  flashcardId: 'fc-1',
  front: 'What is React?',
  back: 'A UI library',
  documentId: 'doc-1',
  document: 'Intro.pdf',
}

const mappedCard = {
  id: 'fc-1',
  front: 'What is React?',
  back: 'A UI library',
  documentId: 'doc-1',
  documentName: 'Intro.pdf',
  videoName: undefined,
  videoId: undefined,
  difficulty: 'medium',
}

describe('flashcardService', () => {
  beforeEach(() => vi.clearAllMocks())

  // ─── getAllFlashcards ───────────────────────────────────────────────────────

  describe('getAllFlashcards', () => {
    it('returns mapped paged flashcards', async () => {
      mockApiClient.get.mockResolvedValueOnce({
        data: {
          data: {
            items: [backendCard],
            totalCount: 1,
            page: 1,
            pageSize: 20,
            totalPages: 1,
          },
        },
      })

      const result = await flashcardService.getAllFlashcards()

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/flashcards?page=1&pageSize=20')
      expect(result.totalCount).toBe(1)
      expect(result.items).toHaveLength(1)
      expect(result.items[0]).toMatchObject(mappedCard)
    })

    it('passes custom page and pageSize in the query string', async () => {
      mockApiClient.get.mockResolvedValueOnce({
        data: { data: { items: [], totalCount: 0, page: 2, pageSize: 10, totalPages: 0 } },
      })
      await flashcardService.getAllFlashcards(2, 10)
      expect(mockApiClient.get).toHaveBeenCalledWith('/api/flashcards?page=2&pageSize=10')
    })
  })

  // ─── createFlashcard ───────────────────────────────────────────────────────

  describe('createFlashcard', () => {
    it('posts and returns the mapped flashcard', async () => {
      mockApiClient.post.mockResolvedValueOnce({ data: { data: backendCard } })

      const result = await flashcardService.createFlashcard({
        front: 'What is React?',
        back: 'A UI library',
        documentId: 'doc-1',
      })

      expect(mockApiClient.post).toHaveBeenCalledWith('/api/flashcards', {
        front: 'What is React?',
        back: 'A UI library',
        documentId: 'doc-1',
      })
      expect(result).toMatchObject(mappedCard)
    })
  })

  // ─── deleteFlashcard ───────────────────────────────────────────────────────

  describe('deleteFlashcard', () => {
    it('calls DELETE with the flashcard id', async () => {
      mockApiClient.delete.mockResolvedValueOnce({})
      await flashcardService.deleteFlashcard('fc-1')
      expect(mockApiClient.delete).toHaveBeenCalledWith('/api/flashcards/fc-1')
    })
  })

  // ─── deleteFlashcardsBulk ──────────────────────────────────────────────────

  describe('deleteFlashcardsBulk', () => {
    it('calls DELETE /bulk with the ids list', async () => {
      mockApiClient.delete.mockResolvedValueOnce({})
      await flashcardService.deleteFlashcardsBulk(['fc-1', 'fc-2'])
      expect(mockApiClient.delete).toHaveBeenCalledWith('/api/flashcards/bulk', {
        data: { flashcardIds: ['fc-1', 'fc-2'] },
      })
    })
  })

  // ─── mapFlashcard (via createFlashcard) ────────────────────────────────────

  describe('mapFlashcard edge cases', () => {
    it('maps videoId and videoName when present', async () => {
      const videoCard = {
        flashcardId: 'fc-2',
        front: 'Q',
        back: 'A',
        videoId: 'yt-1',
        video: 'My Video',
      }
      mockApiClient.post.mockResolvedValueOnce({ data: { data: videoCard } })

      const result = await flashcardService.createFlashcard({ front: 'Q', back: 'A' })
      expect(result.videoId).toBe('yt-1')
      expect(result.videoName).toBe('My Video')
      expect(result.documentId).toBe('')
    })
  })

  // ─── getCoverage ───────────────────────────────────────────────────────────

  describe('getCoverage', () => {
    it('returns document and video id arrays', async () => {
      mockApiClient.get.mockResolvedValueOnce({
        data: { data: { documentIds: ['doc-1', 'doc-2'], videoIds: ['yt-1'] } },
      })

      const result = await flashcardService.getCoverage()

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/flashcards/coverage')
      expect(result.documentIds).toEqual(['doc-1', 'doc-2'])
      expect(result.videoIds).toEqual(['yt-1'])
    })

    it('defaults to empty arrays when fields are missing', async () => {
      mockApiClient.get.mockResolvedValueOnce({ data: { data: {} } })

      const result = await flashcardService.getCoverage()

      expect(result.documentIds).toEqual([])
      expect(result.videoIds).toEqual([])
    })
  })

  // ─── getPendingMaterials ───────────────────────────────────────────────────

  describe('getPendingMaterials', () => {
    it('returns the data array from the response', async () => {
      const pending = [{ kind: 'document', id: 'doc-1', name: 'Notes.pdf' }]
      mockApiClient.get.mockResolvedValueOnce({ data: { data: pending } })

      const result = await flashcardService.getPendingMaterials()

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/flashcards/pending-materials')
      expect(result).toEqual(pending)
    })

    it('returns empty array when data is null', async () => {
      mockApiClient.get.mockResolvedValueOnce({ data: { data: null } })

      const result = await flashcardService.getPendingMaterials()

      expect(result).toEqual([])
    })
  })

  // ─── reviewFlashcard ──────────────────────────────────────────────────────

  describe('reviewFlashcard', () => {
    const backendSrs = {
      state: 2 as const,
      stability: 10.5,
      difficulty: 5.2,
      reps: 3,
      lapses: 0,
      due: '2026-05-20T00:00:00Z',
      lastReview: '2026-05-15T12:00:00Z',
      retrievability: 0.92,
    }

    it('posts rating and returns scheduledDays, retrievability, and srs', async () => {
      mockApiClient.post.mockResolvedValueOnce({
        data: { data: { scheduledDays: 5, retrievability: 0.92, srs: backendSrs } },
      })

      const result = await flashcardService.reviewFlashcard('fc-1', 3)

      expect(mockApiClient.post).toHaveBeenCalledWith('/api/flashcards/fc-1/review', { rating: 3 })
      expect(result.scheduledDays).toBe(5)
      expect(result.retrievability).toBe(0.92)
      expect(result.srs.state).toBe(2)
      expect(result.srs.stability).toBe(10.5)
    })

    it('maps srs fields correctly', async () => {
      mockApiClient.post.mockResolvedValueOnce({
        data: { data: { scheduledDays: 1, retrievability: 0.5, srs: { ...backendSrs, state: 1, reps: 1, lapses: 1 } } },
      })

      const result = await flashcardService.reviewFlashcard('fc-1', 1)

      expect(result.srs.state).toBe(1)
      expect(result.srs.reps).toBe(1)
      expect(result.srs.lapses).toBe(1)
    })
  })

  // ─── classifyFlashcard ────────────────────────────────────────────────────

  describe('classifyFlashcard', () => {
    it('patches classify endpoint and returns mapped flashcard', async () => {
      const updatedCard = { ...backendCard, difficulty: 'hard' }
      mockApiClient.patch = vi.fn().mockResolvedValueOnce({ data: { data: updatedCard } })

      const result = await flashcardService.classifyFlashcard('fc-1', { difficulty: 'hard' })

      expect(mockApiClient.patch).toHaveBeenCalledWith('/api/flashcards/fc-1/classify', { difficulty: 'hard' })
      expect(result.difficulty).toBe('hard')
      expect(result.id).toBe('fc-1')
    })

    it('can update chapter and tags', async () => {
      const updated = { ...backendCard, chapter: 'Ch2', tags: ['algebra'] }
      mockApiClient.patch = vi.fn().mockResolvedValueOnce({ data: { data: updated } })

      const result = await flashcardService.classifyFlashcard('fc-1', { chapter: 'Ch2', tags: ['algebra'] })

      expect(result.chapter).toBe('Ch2')
      expect(result.tags).toEqual(['algebra'])
    })
  })

  // ─── getSrsStates ─────────────────────────────────────────────────────────

  describe('getSrsStates', () => {
    it('returns a Map keyed by flashcardId', async () => {
      const srsItem = {
        flashcardId: 'fc-1',
        state: 2,
        stability: 8.0,
        difficulty: 5.0,
        reps: 4,
        lapses: 0,
        due: '2026-05-22T00:00:00Z',
        lastReview: '2026-05-15T00:00:00Z',
        retrievability: 0.88,
      }
      mockApiClient.get.mockResolvedValueOnce({ data: { data: [srsItem] } })

      const result = await flashcardService.getSrsStates()

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/flashcards/srs')
      expect(result).toBeInstanceOf(Map)
      expect(result.has('fc-1')).toBe(true)
      expect(result.get('fc-1')!.state).toBe(2)
      expect(result.get('fc-1')!.stability).toBe(8.0)
    })

    it('returns empty map when data is empty', async () => {
      mockApiClient.get.mockResolvedValueOnce({ data: { data: [] } })

      const result = await flashcardService.getSrsStates()

      expect(result.size).toBe(0)
    })
  })
})
