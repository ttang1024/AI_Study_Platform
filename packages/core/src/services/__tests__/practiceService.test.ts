import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPracticeService } from '../practiceService'
import type { HttpClient } from '../../http'

const fakeHttp: HttpClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}

describe('practiceService', () => {
  beforeEach(() => vi.clearAllMocks())
  const service = createPracticeService(fakeHttp)

  describe('generate', () => {
    it('builds no query params when opts is empty', async () => {
      vi.mocked(fakeHttp.get).mockResolvedValueOnce({ data: { data: { questions: [], count: 0, generatedAt: '' } } })
      await service.generate()
      expect(fakeHttp.get).toHaveBeenCalledWith('/api/practice/generate?')
    })

    it('includes count, courseId, and a comma-joined sources list', async () => {
      vi.mocked(fakeHttp.get).mockResolvedValueOnce({ data: { data: { questions: [], count: 0, generatedAt: '' } } })
      await service.generate({ count: 10, courseId: 'c-1', sources: ['quiz', 'flashcard'] })

      const url = vi.mocked(fakeHttp.get).mock.calls[0][0] as string
      const params = new URLSearchParams(url.split('?')[1])
      expect(params.get('count')).toBe('10')
      expect(params.get('courseId')).toBe('c-1')
      expect(params.get('sources')).toBe('quiz,flashcard')
    })

    it('omits sources when the list is empty', async () => {
      vi.mocked(fakeHttp.get).mockResolvedValueOnce({ data: { data: { questions: [], count: 0, generatedAt: '' } } })
      await service.generate({ sources: [] })
      const url = vi.mocked(fakeHttp.get).mock.calls[0][0] as string
      expect(url).not.toContain('sources=')
    })
  })

  it('generateSmartSession GETs the smart-session endpoint', async () => {
    vi.mocked(fakeHttp.get).mockResolvedValueOnce({ data: { data: { questions: [], count: 0, generatedAt: '' } } })
    await service.generateSmartSession()
    expect(fakeHttp.get).toHaveBeenCalledWith('/api/practice/smart-session')
  })

  it('submit posts the results and returns the summary', async () => {
    const results = [{ source: 'quiz' as const, sourceId: 'q-1', isCorrect: true }]
    vi.mocked(fakeHttp.post).mockResolvedValueOnce({ data: { data: { total: 1, correct: 1, accuracyPercent: 100 } } })

    const summary = await service.submit(results)

    expect(fakeHttp.post).toHaveBeenCalledWith('/api/practice/submit', { results })
    expect(summary.accuracyPercent).toBe(100)
  })
})
