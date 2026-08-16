import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRecommendationService } from '../recommendationService'
import type { HttpClient } from '../../http'

const fakeHttp: HttpClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}

describe('recommendationService', () => {
  beforeEach(() => vi.clearAllMocks())
  const service = createRecommendationService(fakeHttp)

  it('fetches and unwraps recommendations', async () => {
    const payload = { reviewQueue: [], nextBestContent: [], generatedAt: '2026-08-01T00:00:00Z' }
    vi.mocked(fakeHttp.get).mockResolvedValueOnce({ data: { data: payload } })

    const result = await service.getRecommendations()

    expect(fakeHttp.get).toHaveBeenCalledWith('/api/recommendations')
    expect(result).toEqual(payload)
  })
})
