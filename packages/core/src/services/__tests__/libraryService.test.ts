import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createLibraryService, mapLibraryItem, type BackendLibraryItem } from '../libraryService'
import type { HttpClient } from '../../http'

const fakeHttp: HttpClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}

const backendDoc = (overrides: Partial<BackendLibraryItem> = {}): BackendLibraryItem => ({
  kind: 'document',
  id: 'd-1',
  courseId: 'c-1',
  courseName: 'Algorithms',
  courseColor: '#3B82F6',
  createdAt: '2026-01-01T00:00:00Z',
  fileName: 'notes.pdf',
  blobUrl: 'https://blob/notes.pdf',
  contentType: 'application/pdf',
  fileSize: 1024,
  ...overrides,
})

const backendVideo = (overrides: Partial<BackendLibraryItem> = {}): BackendLibraryItem => ({
  kind: 'video',
  id: 'v-1',
  courseId: 'c-1',
  courseName: 'Algorithms',
  courseColor: '#3B82F6',
  createdAt: '2026-01-01T00:00:00Z',
  videoId: 'yt-1',
  videoUrl: 'https://youtube.com/watch?v=yt-1',
  title: 'Intro video',
  thumbnailUrl: 'https://img/thumb.jpg',
  sourceType: 'youtube',
  ...overrides,
})

describe('mapLibraryItem', () => {
  it('maps a document row into a document entry', () => {
    const entry = mapLibraryItem(backendDoc())
    expect(entry.kind).toBe('document')
    if (entry.kind === 'document') {
      expect(entry.data.id).toBe('d-1')
      expect(entry.data.name).toBe('notes.pdf')
    }
  })

  it('maps a video row into a video entry', () => {
    const entry = mapLibraryItem(backendVideo())
    expect(entry.kind).toBe('video')
    if (entry.kind === 'video') {
      expect(entry.data.videoId).toBe('yt-1')
      expect(entry.data.title).toBe('Intro video')
    }
  })

  it('defaults tags to an empty array when absent', () => {
    expect(mapLibraryItem(backendDoc()).tags).toEqual([])
  })

  it('passes through provided tags', () => {
    const tags = [{ libraryTagId: 't-1', name: 'Important', kind: 'tag' as const, color: '#fff' }]
    expect(mapLibraryItem(backendDoc({ tags })).tags).toEqual(tags)
  })

  it('defaults video sourceType to youtube when absent', () => {
    const entry = mapLibraryItem(backendVideo({ sourceType: undefined }))
    if (entry.kind === 'video') expect(entry.data.sourceType).toBe('youtube')
  })
})

describe('createLibraryService', () => {
  beforeEach(() => vi.clearAllMocks())
  const service = createLibraryService(fakeHttp, (item) => item)

  describe('getLibrary', () => {
    it('builds query params with defaults and maps items', async () => {
      vi.mocked(fakeHttp.get).mockResolvedValueOnce({
        data: { data: { items: [backendDoc()], totalCount: 1, page: 1, pageSize: 8, totalPages: 1 } },
      })

      const result = await service.getLibrary()

      const url = vi.mocked(fakeHttp.get).mock.calls[0][0] as string
      expect(url).toContain('type=all')
      expect(url).toContain('page=1')
      expect(url).toContain('pageSize=8')
      expect(result.items).toHaveLength(1)
    })

    it('includes courseId/search/tagIds when provided', async () => {
      vi.mocked(fakeHttp.get).mockResolvedValueOnce({
        data: { data: { items: [], totalCount: 0, page: 1, pageSize: 8, totalPages: 0 } },
      })

      await service.getLibrary({ courseId: 'c-1', search: 'algo', tagIds: ['t-1', 't-2'] })

      const url = vi.mocked(fakeHttp.get).mock.calls[0][0] as string
      const params = new URLSearchParams(url.split('?')[1])
      expect(params.get('courseId')).toBe('c-1')
      expect(params.get('search')).toBe('algo')
      expect(params.getAll('tagIds')).toEqual(['t-1', 't-2'])
    })

    it('omits courseId/search when falsy', async () => {
      vi.mocked(fakeHttp.get).mockResolvedValueOnce({
        data: { data: { items: [], totalCount: 0, page: 1, pageSize: 8, totalPages: 0 } },
      })

      await service.getLibrary({ courseId: null, search: '' })

      const url = vi.mocked(fakeHttp.get).mock.calls[0][0] as string
      expect(url).not.toContain('courseId=')
      expect(url).not.toContain('search=')
    })
  })

  describe('getAllByType', () => {
    it('pages through the server until totalPages is exhausted', async () => {
      vi.mocked(fakeHttp.get)
        .mockResolvedValueOnce({
          data: { data: { items: [backendDoc({ id: 'd-1' })], totalCount: 3, page: 1, pageSize: 100, totalPages: 3 } },
        })
        .mockResolvedValueOnce({
          data: { data: { items: [backendDoc({ id: 'd-2' })], totalCount: 3, page: 2, pageSize: 100, totalPages: 3 } },
        })
        .mockResolvedValueOnce({
          data: { data: { items: [backendDoc({ id: 'd-3' })], totalCount: 3, page: 3, pageSize: 100, totalPages: 3 } },
        })

      const all = await service.getAllByType('documents')

      expect(fakeHttp.get).toHaveBeenCalledTimes(3)
      expect(all.map((i) => i.id)).toEqual(['d-1', 'd-2', 'd-3'])
    })

    it('makes a single request when there is only one page', async () => {
      vi.mocked(fakeHttp.get).mockResolvedValueOnce({
        data: { data: { items: [backendDoc()], totalCount: 1, page: 1, pageSize: 100, totalPages: 1 } },
      })

      await service.getAllByType('documents')

      expect(fakeHttp.get).toHaveBeenCalledTimes(1)
    })
  })
})
