import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createWorkedProblemsService } from '../workedProblemsService'
import type { HttpClient } from '../../http'

const fakeHttp: HttpClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}

describe('workedProblemsService', () => {
  beforeEach(() => vi.clearAllMocks())
  const service = createWorkedProblemsService(fakeHttp)

  it('getProblems fetches without a course prefix and defaults to []', async () => {
    vi.mocked(fakeHttp.get).mockResolvedValueOnce({ data: { data: undefined } })
    const result = await service.getProblems('d-1')
    expect(fakeHttp.get).toHaveBeenCalledWith('/api/documents/d-1/worked-problems')
    expect(result).toEqual([])
  })

  it('generateProblems posts difficulty and count', async () => {
    vi.mocked(fakeHttp.post).mockResolvedValueOnce({ data: { data: [] } })
    await service.generateProblems('d-1', 'hard', 3)
    expect(fakeHttp.post).toHaveBeenCalledWith('/api/documents/d-1/worked-problems/generate', { difficulty: 'hard', count: 3 })
  })

  it('submitAttempt posts the answer to the problem-scoped endpoint', async () => {
    vi.mocked(fakeHttp.post).mockResolvedValueOnce({ data: { data: { workedProblemAttemptId: 'a-1' } } })
    await service.submitAttempt('p-1', '42')
    expect(fakeHttp.post).toHaveBeenCalledWith('/api/worked-problems/p-1/attempt', { userAnswer: '42' })
  })

  it('getAttempts defaults to [] when data is absent', async () => {
    vi.mocked(fakeHttp.get).mockResolvedValueOnce({ data: { data: undefined } })
    expect(await service.getAttempts('p-1')).toEqual([])
  })

  it('getVideoProblems / generateVideoProblems use the video-scoped endpoints', async () => {
    vi.mocked(fakeHttp.get).mockResolvedValueOnce({ data: { data: [] } })
    await service.getVideoProblems('v-1')
    expect(fakeHttp.get).toHaveBeenCalledWith('/api/videos/v-1/worked-problems')

    vi.mocked(fakeHttp.post).mockResolvedValueOnce({ data: { data: [] } })
    await service.generateVideoProblems('v-1', 'easy', 2)
    expect(fakeHttp.post).toHaveBeenCalledWith('/api/videos/v-1/worked-problems/generate', { difficulty: 'easy', count: 2 })
  })

  it('getMastered returns a Set built from the response', async () => {
    vi.mocked(fakeHttp.get).mockResolvedValueOnce({ data: { data: ['p-1', 'p-2'] } })
    const result = await service.getMastered()
    expect(result).toEqual(new Set(['p-1', 'p-2']))
  })

  it('getMastered returns an empty Set when data is absent', async () => {
    vi.mocked(fakeHttp.get).mockResolvedValueOnce({ data: { data: undefined } })
    expect(await service.getMastered()).toEqual(new Set())
  })

  it('toggleMastered posts and returns the new state', async () => {
    vi.mocked(fakeHttp.post).mockResolvedValueOnce({ data: { data: false } })
    expect(await service.toggleMastered('p-1')).toBe(false)
    expect(fakeHttp.post).toHaveBeenCalledWith('/api/worked-problems/mastered/p-1')
  })
})
