import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createTodayService } from '../todayService'
import type { HttpClient } from '../../http'

const fakeHttp: HttpClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}

describe('todayService', () => {
  beforeEach(() => vi.clearAllMocks())
  const service = createTodayService(fakeHttp)

  it('fetches and unwraps the today plan', async () => {
    const plan = {
      streak: { currentStreak: 3, longestStreak: 10 },
      dailyGoalMinutes: 30,
      todayMinutes: 10,
      completionPercent: 33,
      goalMet: false,
      plannedMinutes: 30,
      dueFlashcards: 5,
      items: [],
      generatedAt: '2026-08-01T00:00:00Z',
    }
    vi.mocked(fakeHttp.get).mockResolvedValueOnce({ data: { data: plan } })

    const result = await service.getTodayPlan()

    expect(fakeHttp.get).toHaveBeenCalledWith('/api/recommendations/today')
    expect(result).toEqual(plan)
  })
})
