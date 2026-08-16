import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSearchService } from '../searchService'
import type { HttpClient } from '../../http'

const fakeHttp: HttpClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}

describe('searchService', () => {
  beforeEach(() => vi.clearAllMocks())
  const service = createSearchService(fakeHttp)

  it('builds query params with defaults when types/page/pageSize are omitted', async () => {
    vi.mocked(fakeHttp.get).mockResolvedValueOnce({ data: { data: { items: [], totalCount: 0, page: 1, pageSize: 20 } } })

    await service.search('photosynthesis')

    const calledUrl = vi.mocked(fakeHttp.get).mock.calls[0][0] as string
    expect(calledUrl).toContain('/api/search?')
    expect(calledUrl).toContain('q=photosynthesis')
    expect(calledUrl).toContain('page=1')
    expect(calledUrl).toContain('pageSize=20')
  })

  it('appends one types param per requested type', async () => {
    vi.mocked(fakeHttp.get).mockResolvedValueOnce({ data: { data: { items: [], totalCount: 0, page: 1, pageSize: 20 } } })

    await service.search('q', ['document', 'flashcard'], 2, 10)

    const calledUrl = vi.mocked(fakeHttp.get).mock.calls[0][0] as string
    const params = new URLSearchParams(calledUrl.split('?')[1])
    expect(params.getAll('types')).toEqual(['document', 'flashcard'])
    expect(params.get('page')).toBe('2')
    expect(params.get('pageSize')).toBe('10')
  })

  it('returns the unwrapped results', async () => {
    const results = { items: [{ id: '1', type: 'document', title: 'T', snippet: 'S', url: null }], totalCount: 1, page: 1, pageSize: 20 }
    vi.mocked(fakeHttp.get).mockResolvedValueOnce({ data: { data: results } })
    expect(await service.search('q')).toEqual(results)
  })

  it('askLibrary posts the question and returns the answer', async () => {
    const answer = { answer: 'It is X.', citations: [] }
    vi.mocked(fakeHttp.post).mockResolvedValueOnce({ data: { data: answer } })
    const result = await service.askLibrary('What is X?')
    expect(fakeHttp.post).toHaveBeenCalledWith('/api/search/ask', { question: 'What is X?' })
    expect(result).toEqual(answer)
  })
})
