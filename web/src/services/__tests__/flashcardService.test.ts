import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockApiClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
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
  youTubeVideoId: undefined,
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
    it('maps youTubeVideoId and videoName when present', async () => {
      const videoCard = {
        flashcardId: 'fc-2',
        front: 'Q',
        back: 'A',
        youTubeVideoId: 'yt-1',
        video: 'My Video',
      }
      mockApiClient.post.mockResolvedValueOnce({ data: { data: videoCard } })

      const result = await flashcardService.createFlashcard({ front: 'Q', back: 'A' })
      expect(result.youTubeVideoId).toBe('yt-1')
      expect(result.videoName).toBe('My Video')
      expect(result.documentId).toBe('')
    })
  })
})
