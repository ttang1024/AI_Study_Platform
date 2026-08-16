import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHandwritingService } from '../handwritingService'
import type { HttpClient } from '../../http'

const fakeHttp: HttpClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}

describe('handwritingService', () => {
  beforeEach(() => vi.clearAllMocks())
  const service = createHandwritingService(fakeHttp)
  const pages = [{ data: 'base64', mimeType: 'image/png' }]

  it('posts pages and trimmed problem text', async () => {
    vi.mocked(fakeHttp.post).mockResolvedValueOnce({ data: { data: { isCorrect: true } } })

    await service.grade(pages, '  2 + 2 = ?  ')

    expect(fakeHttp.post).toHaveBeenCalledWith('/api/handwriting/grade', { pages, problem: '2 + 2 = ?' })
  })

  it('sends null for an absent or blank problem', async () => {
    vi.mocked(fakeHttp.post).mockResolvedValue({ data: { data: { isCorrect: true } } })

    await service.grade(pages)
    expect(fakeHttp.post).toHaveBeenCalledWith('/api/handwriting/grade', { pages, problem: null })

    await service.grade(pages, '   ')
    expect(fakeHttp.post).toHaveBeenCalledWith('/api/handwriting/grade', { pages, problem: null })
  })

  it('returns the unwrapped grade', async () => {
    const grade = { isCorrect: false, firstErrorStep: 2 }
    vi.mocked(fakeHttp.post).mockResolvedValueOnce({ data: { data: grade } })
    const result = await service.grade(pages)
    expect(result).toEqual(grade)
  })
})
