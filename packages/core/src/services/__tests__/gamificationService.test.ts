import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createGamificationService } from '../gamificationService'
import type { HttpClient } from '../../http'

const fakeHttp: HttpClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}

describe('gamificationService', () => {
  beforeEach(() => vi.clearAllMocks())
  const service = createGamificationService(fakeHttp)

  it('fetches and unwraps the weekly digest', async () => {
    const digest = { from: '2026-01-01', to: '2026-01-07', studyMinutes: 120, activeDays: 5 }
    vi.mocked(fakeHttp.get).mockResolvedValueOnce({ data: { data: digest } })

    const result = await service.getWeeklyDigest()

    expect(fakeHttp.get).toHaveBeenCalledWith('/api/notifications/weekly-digest')
    expect(result).toEqual(digest)
  })

  it('downloads the ICS calendar as a blob', async () => {
    const blob = new Blob(['ics content'])
    vi.mocked(fakeHttp.get).mockResolvedValueOnce({ data: blob })

    const result = await service.downloadCalendarIcs()

    expect(fakeHttp.get).toHaveBeenCalledWith('/api/calendar/ics', { responseType: 'blob' })
    expect(result).toBe(blob)
  })
})
