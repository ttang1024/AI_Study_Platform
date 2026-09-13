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
      // No documentId on video cards — undefined (not '') so `documentId ?? videoId`
      // deck grouping falls through to the videoId.
      expect(result.documentId).toBeUndefined()
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
  // ─── FSRS scheduler settings ──────────────────────────────────────────────

  describe('FSRS scheduler settings', () => {
    const backendSettings = {
      desiredRetention: 0.9,
      maximumIntervalDays: 36500,
      enableFuzz: true,
      usingOptimizedWeights: false,
      reviewsAtOptimization: 0,
      weights: [0.4072, 1.1829],
      reviewCount: 412,
      minimumReviewsToOptimize: 200,
    }

    it('reads settings', async () => {
      mockApiClient.get.mockResolvedValueOnce({ data: { data: backendSettings } })

      const result = await flashcardService.getFsrsSettings()

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/flashcards/srs/settings')
      expect(result.desiredRetention).toBe(0.9)
      expect(result.reviewCount).toBe(412)
    })

    it('sends only the fields being changed', async () => {
      mockApiClient.put = vi.fn().mockResolvedValueOnce({
        data: { data: { ...backendSettings, desiredRetention: 0.85 } },
      })

      const result = await flashcardService.updateFsrsSettings({ desiredRetention: 0.85 })

      expect(mockApiClient.put).toHaveBeenCalledWith('/api/flashcards/srs/settings', { desiredRetention: 0.85 })
      expect(result.desiredRetention).toBe(0.85)
    })

    it('reports an optimization run that was adopted', async () => {
      mockApiClient.post.mockResolvedValueOnce({
        data: {
          data: {
            applied: true,
            reviewCount: 540,
            logLossBefore: 0.62,
            logLossAfter: 0.51,
            rmseBefore: 0.31,
            rmseAfter: 0.27,
            improvement: 0.1774,
            weights: [0.5, 1.2],
          },
        },
      })

      const result = await flashcardService.optimizeFsrsWeights()

      expect(mockApiClient.post).toHaveBeenCalledWith('/api/flashcards/srs/optimize', {})
      expect(result.applied).toBe(true)
      expect(result.logLossAfter).toBeLessThan(result.logLossBefore)
    })

    it('resets to the stock scheduler', async () => {
      mockApiClient.post.mockResolvedValueOnce({ data: { data: backendSettings } })

      const result = await flashcardService.resetFsrsWeights()

      expect(mockApiClient.post).toHaveBeenCalledWith('/api/flashcards/srs/weights/reset', {})
      expect(result.usingOptimizedWeights).toBe(false)
    })
  })

  // ─── undoLastReview ───────────────────────────────────────────────────────

  describe('undoLastReview', () => {
    it('maps the restored srs state back', async () => {
      mockApiClient.post.mockResolvedValueOnce({
        data: {
          data: {
            flashcardId: 'fc-1',
            rating: 4,
            cardReset: false,
            srs: {
              state: 2,
              stability: 12.5,
              difficulty: 5.25,
              reps: 3,
              lapses: 1,
              due: '2026-05-20T00:00:00Z',
              retrievability: 0.9,
            },
          },
        },
      })

      const result = await flashcardService.undoLastReview('fc-1')

      expect(mockApiClient.post).toHaveBeenCalledWith('/api/flashcards/review/undo', { flashcardId: 'fc-1' })
      expect(result.cardReset).toBe(false)
      expect(result.srs!.stability).toBe(12.5)
      expect(result.srs!.isSuspended).toBe(false)
    })

    it('has no srs to return when the card went back to new', async () => {
      mockApiClient.post.mockResolvedValueOnce({
        data: { data: { flashcardId: 'fc-1', rating: 3, cardReset: true } },
      })

      const result = await flashcardService.undoLastReview('fc-1')

      expect(result.cardReset).toBe(true)
      expect(result.srs).toBeUndefined()
    })
  })
  // ─── Review forecast + backlog ────────────────────────────────────────────

  describe('review forecast', () => {
    it('reads the forecast for a given window', async () => {
      mockApiClient.get.mockResolvedValueOnce({
        data: {
          data: {
            overdue: 312,
            days: [{ day: '2026-09-02T00:00:00Z', count: 40 }],
            maxReviewsPerDay: 100,
            newCardsPerDay: 20,
          },
        },
      })

      const result = await flashcardService.getReviewForecast(14)

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/flashcards/srs/forecast?days=14')
      expect(result.overdue).toBe(312)
      expect(result.days).toHaveLength(1)
    })

    it('spreads a backlog over the requested number of days', async () => {
      mockApiClient.post.mockResolvedValueOnce({
        data: { data: { moved: 312, days: 7, perDay: 45 } },
      })

      const result = await flashcardService.rescheduleBacklog(7)

      expect(mockApiClient.post).toHaveBeenCalledWith('/api/flashcards/srs/reschedule-backlog', { days: 7 })
      expect(result.moved).toBe(312)
      expect(result.perDay).toBe(45)
    })

    it('patches the daily limits like any other setting', async () => {
      mockApiClient.put = vi.fn().mockResolvedValueOnce({
        data: { data: { newCardsPerDay: 5, maxReviewsPerDay: 80 } },
      })

      const result = await flashcardService.updateFsrsSettings({ newCardsPerDay: 5, maxReviewsPerDay: 80 })

      expect(mockApiClient.put).toHaveBeenCalledWith('/api/flashcards/srs/settings', {
        newCardsPerDay: 5,
        maxReviewsPerDay: 80,
      })
      expect(result.newCardsPerDay).toBe(5)
    })
  })
})
