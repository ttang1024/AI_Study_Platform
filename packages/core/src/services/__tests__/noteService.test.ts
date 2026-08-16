import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createNoteService, mapBackendNote } from '../noteService'
import type { HttpClient } from '../../http'

const fakeHttp: HttpClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}

const backendNote = (overrides: Record<string, unknown> = {}) => ({
  noteId: 'n-1',
  content: 'body',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...overrides,
})

describe('mapBackendNote', () => {
  it('defaults documentId to empty string and drops undefined optional fields', () => {
    const mapped = mapBackendNote(backendNote())
    expect(mapped.documentId).toBe('')
    expect(mapped.videoId).toBeUndefined()
    expect(mapped.documentName).toBeUndefined()
  })

  it('maps document/video names from document/video fields', () => {
    const mapped = mapBackendNote(backendNote({ document: 'Doc Title', video: 'Vid Title', videoId: 'v-1' }))
    expect(mapped.documentName).toBe('Doc Title')
    expect(mapped.videoName).toBe('Vid Title')
    expect(mapped.videoId).toBe('v-1')
  })
})

describe('noteService', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('getAllNotes', () => {
    it('fetches, maps, and paginates', async () => {
      const service = createNoteService(fakeHttp)
      vi.mocked(fakeHttp.get).mockResolvedValueOnce({
        data: { data: { items: [backendNote()], totalCount: 1, page: 1, pageSize: 20, totalPages: 1 } },
      })

      const result = await service.getAllNotes()

      expect(fakeHttp.get).toHaveBeenCalledWith('/api/notes?page=1&pageSize=20')
      expect(result.items[0].id).toBe('n-1')
      expect(result.totalCount).toBe(1)
    })

    it('collapses concurrent calls to the same page/pageSize into one request', async () => {
      const service = createNoteService(fakeHttp)
      let resolveRequest: (v: unknown) => void
      vi.mocked(fakeHttp.get).mockReturnValueOnce(
        new Promise((resolve) => {
          resolveRequest = resolve
        }) as never,
      )

      const p1 = service.getAllNotes(2, 10)
      const p2 = service.getAllNotes(2, 10)
      resolveRequest!({ data: { data: { items: [], totalCount: 0, page: 2, pageSize: 10, totalPages: 0 } } })
      await Promise.all([p1, p2])

      expect(fakeHttp.get).toHaveBeenCalledTimes(1)
    })

    it('does not dedupe requests for different pages', async () => {
      const service = createNoteService(fakeHttp)
      vi.mocked(fakeHttp.get).mockResolvedValue({
        data: { data: { items: [], totalCount: 0, page: 1, pageSize: 20, totalPages: 0 } },
      })

      await Promise.all([service.getAllNotes(1, 20), service.getAllNotes(2, 20)])

      expect(fakeHttp.get).toHaveBeenCalledTimes(2)
    })
  })

  describe('mutations', () => {
    it('createNote posts the payload', async () => {
      const service = createNoteService(fakeHttp)
      vi.mocked(fakeHttp.post).mockResolvedValueOnce({ data: { data: backendNote() } })
      const payload = { content: 'body', documentId: 'd-1' }
      await service.createNote(payload)
      expect(fakeHttp.post).toHaveBeenCalledWith('/api/notes', payload)
    })

    it('createNoteForDocument posts to the course/document-scoped endpoint', async () => {
      const service = createNoteService(fakeHttp)
      vi.mocked(fakeHttp.post).mockResolvedValueOnce({ data: { data: backendNote() } })
      await service.createNoteForDocument('c-1', 'd-1', 'body')
      expect(fakeHttp.post).toHaveBeenCalledWith('/api/courses/c-1/documents/d-1/notes', { content: 'body' })
    })

    it('updateNote puts to the note-scoped endpoint', async () => {
      const service = createNoteService(fakeHttp)
      vi.mocked(fakeHttp.put).mockResolvedValueOnce({ data: { data: backendNote() } })
      await service.updateNote('n-1', { content: 'updated' })
      expect(fakeHttp.put).toHaveBeenCalledWith('/api/notes/n-1', { content: 'updated' })
    })

    it('deleteNote deletes by id', async () => {
      const service = createNoteService(fakeHttp)
      await service.deleteNote('n-1')
      expect(fakeHttp.delete).toHaveBeenCalledWith('/api/notes/n-1')
    })

    it('deleteNotesBulk sends ids in the request body', async () => {
      const service = createNoteService(fakeHttp)
      await service.deleteNotesBulk(['n-1', 'n-2'])
      expect(fakeHttp.delete).toHaveBeenCalledWith('/api/notes/bulk', { data: { noteIds: ['n-1', 'n-2'] } })
    })
  })
})
