import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockApiClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}

vi.mock('../apiClient', () => ({ apiClient: mockApiClient }))

const { noteService } = await import('../noteService')

const backendNote = (id = 'n-1') => ({
  noteId: id,
  documentId: 'doc-1',
  youTubeVideoId: undefined,
  title: 'My Note',
  content: 'Note content',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  document: 'lecture.pdf',
  video: undefined,
})

describe('noteService', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('getAllNotes', () => {
    it('returns mapped paged notes with default params', async () => {
      mockApiClient.get.mockResolvedValueOnce({
        data: {
          data: {
            items: [backendNote('n-1'), backendNote('n-2')],
            totalCount: 2,
            page: 1,
            pageSize: 20,
            totalPages: 1,
          },
        },
      })

      const result = await noteService.getAllNotes()

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/notes?page=1&pageSize=20')
      expect(result.items).toHaveLength(2)
      expect(result.totalCount).toBe(2)
      expect(result.items[0]).toMatchObject({ id: 'n-1', documentId: 'doc-1', content: 'Note content' })
    })

    it('passes custom page and pageSize', async () => {
      mockApiClient.get.mockResolvedValueOnce({
        data: { data: { items: [], totalCount: 0, page: 2, pageSize: 5, totalPages: 0 } },
      })

      await noteService.getAllNotes(2, 5)

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/notes?page=2&pageSize=5')
    })

    it('maps documentName and videoName from document/video fields', async () => {
      const note = { ...backendNote(), video: 'My Video' }
      mockApiClient.get.mockResolvedValueOnce({
        data: { data: { items: [note], totalCount: 1, page: 1, pageSize: 20, totalPages: 1 } },
      })

      const result = await noteService.getAllNotes()

      expect(result.items[0].documentName).toBe('lecture.pdf')
      expect(result.items[0].videoName).toBe('My Video')
    })
  })

  describe('createNote', () => {
    it('posts and returns the raw backend note', async () => {
      const note = backendNote('new-n')
      mockApiClient.post.mockResolvedValueOnce({ data: { data: note } })

      const result = await noteService.createNote({ title: 'My Note', content: 'Note content' })

      expect(mockApiClient.post).toHaveBeenCalledWith('/api/notes', { title: 'My Note', content: 'Note content' })
      expect(result.noteId).toBe('new-n')
    })
  })

  describe('updateNote', () => {
    it('puts and returns the updated note', async () => {
      const updated = { ...backendNote('n-1'), content: 'Updated content' }
      mockApiClient.put.mockResolvedValueOnce({ data: { data: updated } })

      const result = await noteService.updateNote('n-1', { content: 'Updated content' })

      expect(mockApiClient.put).toHaveBeenCalledWith('/api/notes/n-1', { content: 'Updated content' })
      expect(result.content).toBe('Updated content')
    })
  })

  describe('deleteNote', () => {
    it('calls DELETE with the note id', async () => {
      mockApiClient.delete.mockResolvedValueOnce({})

      await noteService.deleteNote('n-1')

      expect(mockApiClient.delete).toHaveBeenCalledWith('/api/notes/n-1')
    })
  })

  describe('deleteNotesBulk', () => {
    it('calls DELETE /bulk with the ids list', async () => {
      mockApiClient.delete.mockResolvedValueOnce({})

      await noteService.deleteNotesBulk(['n-1', 'n-2', 'n-3'])

      expect(mockApiClient.delete).toHaveBeenCalledWith('/api/notes/bulk', {
        data: { noteIds: ['n-1', 'n-2', 'n-3'] },
      })
    })
  })
})
