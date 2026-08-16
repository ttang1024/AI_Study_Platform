import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createAnalyticsService } from '../analyticsService'
import type { HttpClient } from '../../http'

const fakeHttp: HttpClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}

const summary = { streak: { currentStreak: 1, longestStreak: 1, todaySeconds: 0, todayMinutes: 0, freezesAvailable: 0, vacationUntil: null }, dueFlashcards: 0, reinforcement: { quizMistakes: 0, unmasteredTerms: 0, hardFlashcards: 0 }, dailyGoalMinutes: 30 }

describe('analyticsService', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.useRealTimers())

  describe('date-range query building', () => {
    it('appends no query string when from/to are omitted', async () => {
      const service = createAnalyticsService(fakeHttp)
      vi.mocked(fakeHttp.get).mockResolvedValueOnce({ data: { data: [] } })
      await service.getQuizAccuracy()
      expect(fakeHttp.get).toHaveBeenCalledWith('/api/analytics/quiz-accuracy')
    })

    it('appends from/to as query params when given', async () => {
      const service = createAnalyticsService(fakeHttp)
      vi.mocked(fakeHttp.get).mockResolvedValueOnce({ data: { data: {} } })
      await service.getTimeOnTask('2026-01-01', '2026-01-31')
      expect(fakeHttp.get).toHaveBeenCalledWith('/api/analytics/time-on-task?from=2026-01-01&to=2026-01-31')
    })

    it('appends only the given side when one of from/to is omitted', async () => {
      const service = createAnalyticsService(fakeHttp)
      vi.mocked(fakeHttp.get).mockResolvedValueOnce({ data: { data: {} } })
      await service.getAiUsage(undefined, '2026-01-31')
      expect(fakeHttp.get).toHaveBeenCalledWith('/api/analytics/ai-usage?to=2026-01-31')
    })
  })

  it('getQuizAccuracy / getCourseMastery default to an empty array', async () => {
    const service = createAnalyticsService(fakeHttp)
    vi.mocked(fakeHttp.get).mockResolvedValue({ data: { data: undefined } })
    expect(await service.getQuizAccuracy()).toEqual([])
    expect(await service.getCourseMastery()).toEqual([])
  })

  it('getActivityHeatmap defaults days to 365', async () => {
    const service = createAnalyticsService(fakeHttp)
    vi.mocked(fakeHttp.get).mockResolvedValueOnce({ data: { data: {} } })
    await service.getActivityHeatmap()
    expect(fakeHttp.get).toHaveBeenCalledWith('/api/analytics/activity-heatmap?days=365')
  })

  it('recordStudySession posts the heartbeat as-is', async () => {
    const service = createAnalyticsService(fakeHttp)
    const heartbeat = { contextType: 'document', contextId: 'd-1', durationSeconds: 60 }
    await service.recordStudySession(heartbeat)
    expect(fakeHttp.post).toHaveBeenCalledWith('/api/analytics/study-session', heartbeat)
  })

  describe('getDashboardSummary caching', () => {
    it('serves a cached summary within the TTL window', async () => {
      vi.useFakeTimers()
      const service = createAnalyticsService(fakeHttp)
      vi.mocked(fakeHttp.get).mockResolvedValueOnce({ data: { data: summary } })

      await service.getDashboardSummary()
      vi.advanceTimersByTime(10_000)
      await service.getDashboardSummary()

      expect(fakeHttp.get).toHaveBeenCalledTimes(1)
    })

    it('re-fetches once the TTL has expired', async () => {
      vi.useFakeTimers()
      const service = createAnalyticsService(fakeHttp)
      vi.mocked(fakeHttp.get).mockResolvedValue({ data: { data: summary } })

      await service.getDashboardSummary()
      vi.advanceTimersByTime(31_000)
      await service.getDashboardSummary()

      expect(fakeHttp.get).toHaveBeenCalledTimes(2)
    })

    it('collapses concurrent in-flight requests', async () => {
      const service = createAnalyticsService(fakeHttp)
      let resolveRequest: (v: unknown) => void
      vi.mocked(fakeHttp.get).mockReturnValueOnce(
        new Promise((resolve) => {
          resolveRequest = resolve
        }) as never,
      )

      const p1 = service.getDashboardSummary()
      const p2 = service.getDashboardSummary()
      resolveRequest!({ data: { data: summary } })
      await Promise.all([p1, p2])

      expect(fakeHttp.get).toHaveBeenCalledTimes(1)
    })

    it('invalidateDashboardSummaryCache forces a re-fetch', async () => {
      const service = createAnalyticsService(fakeHttp)
      vi.mocked(fakeHttp.get).mockResolvedValue({ data: { data: summary } })

      await service.getDashboardSummary()
      service.invalidateDashboardSummaryCache()
      await service.getDashboardSummary()

      expect(fakeHttp.get).toHaveBeenCalledTimes(2)
    })

    it('updateDailyGoal invalidates the cached summary', async () => {
      const service = createAnalyticsService(fakeHttp)
      vi.mocked(fakeHttp.get).mockResolvedValue({ data: { data: summary } })

      await service.getDashboardSummary()
      await service.updateDailyGoal(45)
      await service.getDashboardSummary()

      expect(fakeHttp.put).toHaveBeenCalledWith('/api/analytics/daily-goal', { minutes: 45 })
      expect(fakeHttp.get).toHaveBeenCalledTimes(2)
    })

    it('setVacation and cancelVacation invalidate the cached summary', async () => {
      const service = createAnalyticsService(fakeHttp)
      vi.mocked(fakeHttp.get).mockResolvedValue({ data: { data: summary } })

      await service.getDashboardSummary()
      await service.setVacation('2026-01-01', '2026-01-05')
      await service.getDashboardSummary()
      await service.cancelVacation()
      await service.getDashboardSummary()

      expect(fakeHttp.post).toHaveBeenCalledWith('/api/analytics/vacation', { startDate: '2026-01-01', endDate: '2026-01-05' })
      expect(fakeHttp.delete).toHaveBeenCalledWith('/api/analytics/vacation')
      expect(fakeHttp.get).toHaveBeenCalledTimes(3)
    })
  })
})
