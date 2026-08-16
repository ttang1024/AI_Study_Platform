import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createQuizSubmissionService } from '../documentService'
import type { HttpClient } from '../../http'

const fakeHttp: HttpClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}

describe('createQuizSubmissionService', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('getAllSubmissions', () => {
    it('maps submissions and paginates', async () => {
      const service = createQuizSubmissionService(fakeHttp)
      vi.mocked(fakeHttp.get).mockResolvedValueOnce({
        data: { data: { items: [{ submissionId: 's-1', documentId: 'd-1', score: 5, total: 10, submittedAt: '2026-01-01' }], totalCount: 1, page: 1, pageSize: 20, totalPages: 1 } },
      })

      const result = await service.getAllSubmissions()

      expect(fakeHttp.get).toHaveBeenCalledWith('/api/quiz-submissions?page=1&pageSize=20')
      expect(result.items[0].submissionId).toBe('s-1')
    })

    it('caches a response for repeat calls within the TTL', async () => {
      const service = createQuizSubmissionService(fakeHttp)
      vi.mocked(fakeHttp.get).mockResolvedValue({
        data: { data: { items: [], totalCount: 0, page: 1, pageSize: 20, totalPages: 0 } },
      })

      await service.getAllSubmissions()
      await service.getAllSubmissions()

      expect(fakeHttp.get).toHaveBeenCalledTimes(1)
    })

    it('clearListCache forces a re-fetch', async () => {
      const service = createQuizSubmissionService(fakeHttp)
      vi.mocked(fakeHttp.get).mockResolvedValue({
        data: { data: { items: [], totalCount: 0, page: 1, pageSize: 20, totalPages: 0 } },
      })

      await service.getAllSubmissions()
      service.clearListCache()
      await service.getAllSubmissions()

      expect(fakeHttp.get).toHaveBeenCalledTimes(2)
    })

    it('collapses concurrent in-flight requests for the same page', async () => {
      const service = createQuizSubmissionService(fakeHttp)
      let resolveRequest: (v: unknown) => void
      vi.mocked(fakeHttp.get).mockReturnValueOnce(
        new Promise((resolve) => {
          resolveRequest = resolve
        }) as never,
      )

      const p1 = service.getAllSubmissions()
      const p2 = service.getAllSubmissions()
      resolveRequest!({ data: { data: { items: [], totalCount: 0, page: 1, pageSize: 20, totalPages: 0 } } })
      await Promise.all([p1, p2])

      expect(fakeHttp.get).toHaveBeenCalledTimes(1)
    })
  })

  it('getCoverage defaults ids to [] and dedupes concurrent calls', async () => {
    const service = createQuizSubmissionService(fakeHttp)
    let resolveRequest: (v: unknown) => void
    vi.mocked(fakeHttp.get).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRequest = resolve
      }) as never,
    )

    const p1 = service.getCoverage()
    const p2 = service.getCoverage()
    resolveRequest!({ data: { data: {} } })
    const [c1, c2] = await Promise.all([p1, p2])

    expect(fakeHttp.get).toHaveBeenCalledTimes(1)
    expect(c1).toEqual({ documentIds: [], videoIds: [] })
    expect(c2).toEqual({ documentIds: [], videoIds: [] })
  })

  it('getPendingMaterials and getGeneratedMaterials use independent in-flight keys', async () => {
    const service = createQuizSubmissionService(fakeHttp)
    vi.mocked(fakeHttp.get).mockResolvedValue({ data: { data: null } })

    await Promise.all([service.getPendingMaterials(), service.getGeneratedMaterials()])

    expect(fakeHttp.get).toHaveBeenCalledTimes(2)
    expect(fakeHttp.get).toHaveBeenCalledWith('/api/quiz-submissions/pending-materials')
    expect(fakeHttp.get).toHaveBeenCalledWith('/api/quiz-submissions/generated-materials')
  })

  it('getPendingMaterials defaults to an empty array when data is null', async () => {
    const service = createQuizSubmissionService(fakeHttp)
    vi.mocked(fakeHttp.get).mockResolvedValueOnce({ data: { data: null } })
    expect(await service.getPendingMaterials()).toEqual([])
  })
})
