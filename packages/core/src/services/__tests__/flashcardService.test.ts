import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createFlashcardService, mapBackendFlashcard, type BackendFlashcard } from '../flashcardService'
import type { HttpClient } from '../../http'

const fakeHttp: HttpClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}

const backendCard = (overrides: Partial<BackendFlashcard> = {}): BackendFlashcard => ({
  flashcardId: 'f-1',
  front: 'Q',
  back: 'A',
  ...overrides,
})

describe('mapBackendFlashcard', () => {
  it('normalizes an unrecognized cardType to basic', () => {
    expect(mapBackendFlashcard(backendCard({ cardType: 'weird' })).cardType).toBe('basic')
  })

  it('passes through recognized card types', () => {
    expect(mapBackendFlashcard(backendCard({ cardType: 'cloze' })).cardType).toBe('cloze')
    expect(mapBackendFlashcard(backendCard({ cardType: 'chart' })).cardType).toBe('chart')
    expect(mapBackendFlashcard(backendCard({ cardType: 'occlusion' })).cardType).toBe('occlusion')
  })

  it('normalizes difficulty to medium unless easy/hard', () => {
    expect(mapBackendFlashcard(backendCard({ difficulty: 'expert' })).difficulty).toBe('medium')
    expect(mapBackendFlashcard(backendCard({ difficulty: 'easy' })).difficulty).toBe('easy')
    expect(mapBackendFlashcard(backendCard({ difficulty: 'hard' })).difficulty).toBe('hard')
  })

  it('keeps documentId/videoId as undefined rather than empty string when absent', () => {
    const mapped = mapBackendFlashcard(backendCard())
    expect(mapped.documentId).toBeUndefined()
    expect(mapped.videoId).toBeUndefined()
  })

  it('prefers document over title for documentName, falling back to title', () => {
    expect(mapBackendFlashcard(backendCard({ document: 'Doc', title: 'Title' })).documentName).toBe('Doc')
    expect(mapBackendFlashcard(backendCard({ title: 'Title' })).documentName).toBe('Title')
  })

  it('maps srs when present and defaults isSuspended to false', () => {
    const mapped = mapBackendFlashcard(
      backendCard({ srs: { state: 1, stability: 2, difficulty: 3, reps: 4, lapses: 0, due: '2026-01-01', retrievability: 0.9 } }),
    )
    expect(mapped.srs?.isSuspended).toBe(false)
  })

  it('leaves srs undefined when absent', () => {
    expect(mapBackendFlashcard(backendCard()).srs).toBeUndefined()
  })

  it('parses occlusionsJson into an array', () => {
    const mapped = mapBackendFlashcard(backendCard({ occlusionsJson: '[{"x":1,"y":2,"w":3,"h":4}]' }))
    expect(mapped.occlusions).toEqual([{ x: 1, y: 2, w: 3, h: 4 }])
  })

  it('returns undefined occlusions for malformed JSON', () => {
    expect(mapBackendFlashcard(backendCard({ occlusionsJson: '{bad' })).occlusions).toBeUndefined()
  })

  it('returns undefined occlusions when the JSON is not an array', () => {
    expect(mapBackendFlashcard(backendCard({ occlusionsJson: '{"x":1}' })).occlusions).toBeUndefined()
  })

  it('normalizes citation when present', () => {
    const mapped = mapBackendFlashcard(backendCard({ citation: { quote: 'q', page: 3 } }))
    expect(mapped.citation).toEqual({ quote: 'q', startOffset: undefined, endOffset: undefined, page: 3, startSeconds: undefined })
  })
})

describe('createFlashcardService', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('getAllFlashcards', () => {
    it('fetches, maps, and caches the result', async () => {
      const service = createFlashcardService(fakeHttp)
      vi.mocked(fakeHttp.get).mockResolvedValueOnce({
        data: { data: { items: [backendCard()], totalCount: 1, page: 1, pageSize: 20, totalPages: 1 } },
      })

      const result = await service.getAllFlashcards()

      expect(fakeHttp.get).toHaveBeenCalledWith('/api/flashcards?page=1&pageSize=20')
      expect(result.items[0].id).toBe('f-1')
    })

    it('serves a cached response on a second call for the same page', async () => {
      const service = createFlashcardService(fakeHttp)
      vi.mocked(fakeHttp.get).mockResolvedValue({
        data: { data: { items: [backendCard()], totalCount: 1, page: 1, pageSize: 20, totalPages: 1 } },
      })

      await service.getAllFlashcards()
      await service.getAllFlashcards()

      expect(fakeHttp.get).toHaveBeenCalledTimes(1)
    })

    it('collapses concurrent in-flight requests for the same page', async () => {
      const service = createFlashcardService(fakeHttp)
      let resolveRequest: (v: unknown) => void
      vi.mocked(fakeHttp.get).mockReturnValueOnce(
        new Promise((resolve) => {
          resolveRequest = resolve
        }) as never,
      )

      const p1 = service.getAllFlashcards()
      const p2 = service.getAllFlashcards()
      resolveRequest!({ data: { data: { items: [], totalCount: 0, page: 1, pageSize: 20, totalPages: 0 } } })
      await Promise.all([p1, p2])

      expect(fakeHttp.get).toHaveBeenCalledTimes(1)
    })

    it('re-fetches after invalidateFlashcardListCache is called', async () => {
      const service = createFlashcardService(fakeHttp)
      vi.mocked(fakeHttp.get).mockResolvedValue({
        data: { data: { items: [], totalCount: 0, page: 1, pageSize: 20, totalPages: 0 } },
      })

      await service.getAllFlashcards()
      service.invalidateFlashcardListCache()
      await service.getAllFlashcards()

      expect(fakeHttp.get).toHaveBeenCalledTimes(2)
    })
  })

  it('getCoverage defaults ids to empty arrays when absent', async () => {
    const service = createFlashcardService(fakeHttp)
    vi.mocked(fakeHttp.get).mockResolvedValueOnce({ data: { data: {} } })

    const coverage = await service.getCoverage()

    expect(coverage).toEqual({ documentIds: [], videoIds: [] })
  })

  it('getPendingMaterials defaults to an empty array', async () => {
    const service = createFlashcardService(fakeHttp)
    vi.mocked(fakeHttp.get).mockResolvedValueOnce({ data: { data: null } })
    expect(await service.getPendingMaterials()).toEqual([])
  })

  it('createFlashcard posts, invalidates the cache, and returns the mapped card', async () => {
    const service = createFlashcardService(fakeHttp)
    vi.mocked(fakeHttp.get).mockResolvedValue({
      data: { data: { items: [], totalCount: 0, page: 1, pageSize: 20, totalPages: 0 } },
    })
    vi.mocked(fakeHttp.post).mockResolvedValueOnce({ data: { data: backendCard() } })

    await service.getAllFlashcards() // populate cache
    const card = await service.createFlashcard({ front: 'Q', back: 'A' })
    await service.getAllFlashcards() // should re-fetch since cache was invalidated

    expect(card.id).toBe('f-1')
    expect(fakeHttp.get).toHaveBeenCalledTimes(2)
  })

  it('deleteFlashcard deletes by id and invalidates the cache', async () => {
    const service = createFlashcardService(fakeHttp)
    await service.deleteFlashcard('f-1')
    expect(fakeHttp.delete).toHaveBeenCalledWith('/api/flashcards/f-1')
  })

  it('deleteFlashcardsBulk sends ids in the DELETE body', async () => {
    const service = createFlashcardService(fakeHttp)
    await service.deleteFlashcardsBulk(['f-1', 'f-2'])
    expect(fakeHttp.delete).toHaveBeenCalledWith('/api/flashcards/bulk', { data: { flashcardIds: ['f-1', 'f-2'] } })
  })

  it('reviewFlashcard posts the rating and maps the returned srs', async () => {
    const service = createFlashcardService(fakeHttp)
    vi.mocked(fakeHttp.post).mockResolvedValueOnce({
      data: {
        data: {
          scheduledDays: 3,
          retrievability: 0.95,
          srs: { state: 2, stability: 5, difficulty: 4, reps: 2, lapses: 0, due: '2026-01-05', retrievability: 0.95 },
        },
      },
    })

    const result = await service.reviewFlashcard('f-1', 3)

    expect(fakeHttp.post).toHaveBeenCalledWith('/api/flashcards/f-1/review', { rating: 3 })
    expect(result.srs.isSuspended).toBe(false)
    expect(result.scheduledDays).toBe(3)
  })

  it('getLeeches passes the threshold and defaults to an empty list', async () => {
    const service = createFlashcardService(fakeHttp)
    vi.mocked(fakeHttp.get).mockResolvedValueOnce({ data: { data: null } })
    const result = await service.getLeeches(6)
    expect(fakeHttp.get).toHaveBeenCalledWith('/api/flashcards/leeches?threshold=6')
    expect(result).toEqual([])
  })

  it('setSuspended patches and maps the resulting srs state', async () => {
    const service = createFlashcardService(fakeHttp)
    vi.mocked(fakeHttp.patch).mockResolvedValueOnce({
      data: { data: { state: 0, stability: 1, difficulty: 1, reps: 0, lapses: 0, due: '2026-01-01', retrievability: 1 } },
    })
    const result = await service.setSuspended('f-1', true)
    expect(fakeHttp.patch).toHaveBeenCalledWith('/api/flashcards/f-1/suspend', { suspended: true })
    expect(result.isSuspended).toBe(false) // backend didn't send isSuspended in this fixture
  })

  it('resetSrs posts to the reset endpoint', async () => {
    const service = createFlashcardService(fakeHttp)
    await service.resetSrs('f-1')
    expect(fakeHttp.post).toHaveBeenCalledWith('/api/flashcards/f-1/srs/reset', {})
  })

  it('getSrsStates builds a Map keyed by flashcardId', async () => {
    const service = createFlashcardService(fakeHttp)
    vi.mocked(fakeHttp.get).mockResolvedValueOnce({
      data: {
        data: [
          { flashcardId: 'f-1', state: 1, stability: 1, difficulty: 1, reps: 1, lapses: 0, due: '2026-01-01', retrievability: 1 },
          { flashcardId: 'f-2', state: 2, stability: 2, difficulty: 2, reps: 2, lapses: 0, due: '2026-01-02', retrievability: 0.5 },
        ],
      },
    })

    const map = await service.getSrsStates()

    expect(map.size).toBe(2)
    expect(map.get('f-1')?.state).toBe(1)
    expect(map.get('f-2')?.state).toBe(2)
  })

  it('getSrsStates returns an empty Map when data is absent', async () => {
    const service = createFlashcardService(fakeHttp)
    vi.mocked(fakeHttp.get).mockResolvedValueOnce({ data: { data: null } })
    expect((await service.getSrsStates()).size).toBe(0)
  })
})
