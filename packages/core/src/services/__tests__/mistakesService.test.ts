import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMistakesService } from '../mistakesService'
import type { HttpClient } from '../../http'

const fakeHttp: HttpClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}

describe('mistakesService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('getMistakes passes status as a query param when given', async () => {
    const service = createMistakesService(fakeHttp)
    vi.mocked(fakeHttp.get).mockResolvedValueOnce({ data: { data: { items: [], openCount: 0, resolvedCount: 0 } } })

    await service.getMistakes('open')

    expect(fakeHttp.get).toHaveBeenCalledWith('/api/mistakes', { params: { status: 'open' } })
  })

  it('getMistakes omits params when no status given', async () => {
    const service = createMistakesService(fakeHttp)
    vi.mocked(fakeHttp.get).mockResolvedValueOnce({ data: { data: { items: [], openCount: 0, resolvedCount: 0 } } })

    await service.getMistakes()

    expect(fakeHttp.get).toHaveBeenCalledWith('/api/mistakes', { params: undefined })
  })

  it('setStatus posts the new status', async () => {
    const service = createMistakesService(fakeHttp)
    vi.mocked(fakeHttp.post).mockResolvedValueOnce({ data: { data: { id: 'm-1', status: 'resolved' } } })

    await service.setStatus('m-1', 'resolved')

    expect(fakeHttp.post).toHaveBeenCalledWith('/api/mistakes/m-1/status', { status: 'resolved' })
  })

  it('deleteMistake deletes by id', async () => {
    const service = createMistakesService(fakeHttp)
    await service.deleteMistake('m-1')
    expect(fakeHttp.delete).toHaveBeenCalledWith('/api/mistakes/m-1')
  })

  it('promoteToFlashcards defaults to an empty array when no ids given', async () => {
    const service = createMistakesService(fakeHttp)
    vi.mocked(fakeHttp.post).mockResolvedValueOnce({ data: { data: { created: 0, skipped: 0, flashcardIds: [] } } })

    await service.promoteToFlashcards()

    expect(fakeHttp.post).toHaveBeenCalledWith('/api/mistakes/to-flashcards', { mistakeIds: [] })
  })

  it('promoteToFlashcards passes explicit ids through', async () => {
    const service = createMistakesService(fakeHttp)
    vi.mocked(fakeHttp.post).mockResolvedValueOnce({ data: { data: { created: 1, skipped: 0, flashcardIds: ['f-1'] } } })

    await service.promoteToFlashcards(['m-1', 'm-2'])

    expect(fakeHttp.post).toHaveBeenCalledWith('/api/mistakes/to-flashcards', { mistakeIds: ['m-1', 'm-2'] })
  })

  describe('generateVariants', () => {
    it('collapses concurrent requests for the same mistake id', async () => {
      const service = createMistakesService(fakeHttp)
      let resolveRequest: (v: unknown) => void
      vi.mocked(fakeHttp.post).mockReturnValueOnce(
        new Promise((resolve) => {
          resolveRequest = resolve
        }) as never,
      )

      const p1 = service.generateVariants('m-1')
      const p2 = service.generateVariants('m-1')
      resolveRequest!({ data: { data: [] } })
      await Promise.all([p1, p2])

      expect(fakeHttp.post).toHaveBeenCalledTimes(1)
    })

    it('does not dedupe requests for different mistake ids', async () => {
      const service = createMistakesService(fakeHttp)
      vi.mocked(fakeHttp.post).mockResolvedValue({ data: { data: [] } })

      await Promise.all([service.generateVariants('m-1'), service.generateVariants('m-2')])

      expect(fakeHttp.post).toHaveBeenCalledTimes(2)
    })

    it('allows a new request after the in-flight one settles', async () => {
      const service = createMistakesService(fakeHttp)
      vi.mocked(fakeHttp.post).mockResolvedValue({ data: { data: [] } })

      await service.generateVariants('m-1')
      await service.generateVariants('m-1')

      expect(fakeHttp.post).toHaveBeenCalledTimes(2)
    })
  })
})
