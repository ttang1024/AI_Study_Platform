import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createStatsService } from '../statsService'
import type { HttpClient } from '../../http'

const fakeHttp: HttpClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}

const fullStats = {
  totalDocuments: 5,
  totalArticles: 2,
  totalAudio: 1,
  totalMaterials: 8,
  totalNotes: 3,
  totalFlashcards: 40,
  totalGlossaryTerms: 12,
  totalQuizQuestions: 30,
  totalQuizSubmissions: 4,
  totalVideos: 6,
  courseMaterialCounts: [{ courseId: 'c-1', documents: 1, articles: 0, audio: 0, videos: 0, total: 1 }],
  achievements: { perfectQuizzes: 2, averageQuizScore: 88, flashcardsMastered: 10 },
}

describe('statsService', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('getUserStats', () => {
    it('fetches and returns the full stats payload', async () => {
      const service = createStatsService(fakeHttp)
      vi.mocked(fakeHttp.get).mockResolvedValueOnce({ data: { data: fullStats } })

      const result = await service.getUserStats()

      expect(fakeHttp.get).toHaveBeenCalledWith('/api/stats')
      expect(result).toEqual(fullStats)
    })

    it('defaults optional fields when the backend omits them', async () => {
      const service = createStatsService(fakeHttp)
      const partial = {
        totalDocuments: 0,
        totalArticles: 0,
        totalAudio: 0,
        totalMaterials: 0,
        totalNotes: 0,
        totalFlashcards: 0,
        totalQuizSubmissions: 0,
        totalVideos: 0,
      }
      vi.mocked(fakeHttp.get).mockResolvedValueOnce({ data: { data: partial } })

      const result = await service.getUserStats()

      expect(result.totalGlossaryTerms).toBe(0)
      expect(result.totalQuizQuestions).toBe(0)
      expect(result.courseMaterialCounts).toEqual([])
      expect(result.achievements).toEqual({ perfectQuizzes: 0, averageQuizScore: 0, flashcardsMastered: 0 })
    })

    it('collapses concurrent calls into a single in-flight request', async () => {
      const service = createStatsService(fakeHttp)
      let resolveRequest: (v: unknown) => void
      vi.mocked(fakeHttp.get).mockReturnValueOnce(
        new Promise((resolve) => {
          resolveRequest = resolve
        }) as never,
      )

      const p1 = service.getUserStats()
      const p2 = service.getUserStats()

      resolveRequest!({ data: { data: fullStats } })
      await Promise.all([p1, p2])

      expect(fakeHttp.get).toHaveBeenCalledTimes(1)
    })

    it('allows a new request after the in-flight one settles', async () => {
      const service = createStatsService(fakeHttp)
      vi.mocked(fakeHttp.get).mockResolvedValue({ data: { data: fullStats } })

      await service.getUserStats()
      await service.getUserStats()

      expect(fakeHttp.get).toHaveBeenCalledTimes(2)
    })
  })

  describe('getXp', () => {
    it('fetches and unwraps the XP summary', async () => {
      const service = createStatsService(fakeHttp)
      const xp = { totalXp: 500, level: 3, xpIntoLevel: 100, xpForNextLevel: 200, levelProgress: 0.5, breakdown: [] }
      vi.mocked(fakeHttp.get).mockResolvedValueOnce({ data: { data: xp } })

      const result = await service.getXp()

      expect(fakeHttp.get).toHaveBeenCalledWith('/api/stats/xp')
      expect(result).toEqual(xp)
    })
  })
})
