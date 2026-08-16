import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createDocumentService,
  usesServerExtractedText,
  getDocumentViewerKind,
  mapDocument,
  type BackendDocument,
} from '../documentService'
import type { HttpClient } from '../../http'

const fakeHttp: HttpClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}
const streamSse = vi.fn()

describe('usesServerExtractedText', () => {
  it('is true for ppt/epub document types regardless of name', () => {
    expect(usesServerExtractedText({ type: 'ppt', name: 'whatever.zip' })).toBe(true)
    expect(usesServerExtractedText({ type: 'epub', name: 'whatever.zip' })).toBe(true)
  })

  it('is true for a server-extracted extension', () => {
    expect(usesServerExtractedText({ type: 'txt', name: 'legacy.doc' })).toBe(true)
    expect(usesServerExtractedText({ type: 'txt', name: 'sheet.XLSX' })).toBe(true)
  })

  it('is false for .docx, which has its own dedicated viewer rather than server extraction', () => {
    expect(usesServerExtractedText({ type: 'txt', name: 'report.docx' })).toBe(false)
  })

  it('is false for a client-renderable extension', () => {
    expect(usesServerExtractedText({ type: 'txt', name: 'notes.md' })).toBe(false)
  })
})

describe('getDocumentViewerKind', () => {
  it('maps pdf/docx/image types directly', () => {
    expect(getDocumentViewerKind({ type: 'pdf', name: 'x.pdf' })).toBe('pdf')
    expect(getDocumentViewerKind({ type: 'docx', name: 'x.docx' })).toBe('docx')
    expect(getDocumentViewerKind({ type: 'image', name: 'x.png' })).toBe('image')
  })

  it('routes server-extracted formats to text even with a misleading extension', () => {
    expect(getDocumentViewerKind({ type: 'txt', name: 'x.docx' })).toBe('text')
  })

  it('detects each viewer-kind extension group', () => {
    expect(getDocumentViewerKind({ type: 'txt', name: 'x.md' })).toBe('md')
    expect(getDocumentViewerKind({ type: 'txt', name: 'x.csv' })).toBe('table')
    expect(getDocumentViewerKind({ type: 'txt', name: 'x.ipynb' })).toBe('notebook')
    expect(getDocumentViewerKind({ type: 'txt', name: 'x.html' })).toBe('html')
    expect(getDocumentViewerKind({ type: 'txt', name: 'x.srt' })).toBe('subtitle')
    expect(getDocumentViewerKind({ type: 'txt', name: 'x.json' })).toBe('data')
    expect(getDocumentViewerKind({ type: 'txt', name: 'x.py' })).toBe('code')
  })

  it('falls back to md for a bare md-typed document with an unrecognized name', () => {
    expect(getDocumentViewerKind({ type: 'md', name: 'noext' })).toBe('md')
  })

  it('falls back to text for anything else', () => {
    expect(getDocumentViewerKind({ type: 'txt', name: 'noext' })).toBe('text')
  })
})

describe('mapDocument', () => {
  const base = (overrides: Partial<BackendDocument> = {}): BackendDocument => ({
    documentId: 'd-1',
    courseId: 'c-1',
    fileName: 'file.pdf',
    blobUrl: 'https://blob/file.pdf',
    contentType: 'application/pdf',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  })

  it('infers pdf from contentType or extension', () => {
    expect(mapDocument(base({ contentType: 'application/pdf' })).type).toBe('pdf')
    expect(mapDocument(base({ contentType: 'application/octet-stream', fileName: 'x.pdf' })).type).toBe('pdf')
  })

  it('infers docx from the OOXML content type', () => {
    const bd = base({ contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', fileName: 'x.docx' })
    expect(mapDocument(bd).type).toBe('docx')
  })

  it('infers md from content type or extension', () => {
    expect(mapDocument(base({ contentType: 'text/markdown', fileName: 'x.md' })).type).toBe('md')
    expect(mapDocument(base({ contentType: 'text/plain', fileName: 'x.markdown' })).type).toBe('md')
  })

  it('infers ppt from content type or extension', () => {
    expect(mapDocument(base({ contentType: 'application/vnd.ms-powerpoint', fileName: 'x.bin' })).type).toBe('ppt')
    expect(mapDocument(base({ contentType: 'application/octet-stream', fileName: 'x.pptx' })).type).toBe('ppt')
  })

  it('infers epub from content type or extension', () => {
    expect(mapDocument(base({ contentType: 'application/epub+zip', fileName: 'x.bin' })).type).toBe('epub')
  })

  it('infers image from content type prefix or extension', () => {
    expect(mapDocument(base({ contentType: 'image/png', fileName: 'x.bin' })).type).toBe('image')
    expect(mapDocument(base({ contentType: 'application/octet-stream', fileName: 'x.heic' })).type).toBe('image')
  })

  it('infers podcast specifically from audio/podcast content type', () => {
    expect(mapDocument(base({ contentType: 'audio/podcast', fileName: 'ep.mp3' })).type).toBe('podcast')
  })

  it('infers generic audio from an audio/* content type or extension', () => {
    expect(mapDocument(base({ contentType: 'audio/mpeg', fileName: 'x.bin' })).type).toBe('audio')
    expect(mapDocument(base({ contentType: 'application/octet-stream', fileName: 'x.flac' })).type).toBe('audio')
  })

  it('falls back to txt for anything unrecognized', () => {
    expect(mapDocument(base({ contentType: 'application/octet-stream', fileName: 'x.bin' })).type).toBe('txt')
  })

  it('maps courseId to undefined when empty', () => {
    expect(mapDocument(base({ courseId: '' })).courseId).toBeUndefined()
  })

  it('sets both name and title to fileName', () => {
    const mapped = mapDocument(base({ fileName: 'report.pdf' }))
    expect(mapped.name).toBe('report.pdf')
    expect(mapped.title).toBe('report.pdf')
  })
})

describe('createDocumentService', () => {
  beforeEach(() => vi.clearAllMocks())

  const backendDoc = (overrides: Partial<BackendDocument> = {}): BackendDocument => ({
    documentId: 'd-1',
    courseId: 'c-1',
    fileName: 'file.pdf',
    blobUrl: 'https://blob/file.pdf',
    contentType: 'application/pdf',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  })

  describe('getAllDocuments caching', () => {
    it('caches a response and serves it on a repeat call for the same page', async () => {
      const service = createDocumentService(fakeHttp, streamSse)
      vi.mocked(fakeHttp.get).mockResolvedValue({
        data: { data: { items: [backendDoc()], totalCount: 1, page: 1, pageSize: 3, totalPages: 1 } },
      })

      await service.getAllDocuments()
      await service.getAllDocuments()

      expect(fakeHttp.get).toHaveBeenCalledTimes(1)
    })

    it('includes courseId in the URL when given', async () => {
      const service = createDocumentService(fakeHttp, streamSse)
      vi.mocked(fakeHttp.get).mockResolvedValueOnce({
        data: { data: { items: [], totalCount: 0, page: 1, pageSize: 3, totalPages: 0 } },
      })
      await service.getAllDocuments(1, 3, 'c-1')
      const url = vi.mocked(fakeHttp.get).mock.calls[0][0] as string
      expect(url).toContain('courseId=c-1')
    })

    it.each([
      ['clipUrl', async (s: ReturnType<typeof createDocumentService>) => { vi.mocked(fakeHttp.post).mockResolvedValueOnce({ data: { data: { documentId: 'd-1', courseId: 'c-1' } } }); await s.clipUrl('https://x.com', 'c-1') }],
      ['deleteDocument', async (s: ReturnType<typeof createDocumentService>) => { await s.deleteDocument('c-1', 'd-1') }],
      ['moveDocument', async (s: ReturnType<typeof createDocumentService>) => { vi.mocked(fakeHttp.patch).mockResolvedValueOnce({ data: { data: backendDoc() } }); await s.moveDocument('c-1', 'd-1', 'c-2') }],
      ['updateDocument', async (s: ReturnType<typeof createDocumentService>) => { vi.mocked(fakeHttp.patch).mockResolvedValueOnce({ data: { data: backendDoc() } }); await s.updateDocument('c-1', 'd-1', { fileName: 'new.pdf' }) }],
      ['updateSummary', async (s: ReturnType<typeof createDocumentService>) => { vi.mocked(fakeHttp.patch).mockResolvedValueOnce({ data: { data: backendDoc() } }); await s.updateSummary('c-1', 'd-1', 'sum') }],
      ['updateMindMap', async (s: ReturnType<typeof createDocumentService>) => { vi.mocked(fakeHttp.patch).mockResolvedValueOnce({ data: { data: backendDoc() } }); await s.updateMindMap('c-1', 'd-1', 'map') }],
    ])('%s invalidates the document list cache', async (_name, mutate) => {
      const service = createDocumentService(fakeHttp, streamSse)
      vi.mocked(fakeHttp.get).mockResolvedValue({
        data: { data: { items: [], totalCount: 0, page: 1, pageSize: 3, totalPages: 0 } },
      })

      await service.getAllDocuments()
      await mutate(service)
      await service.getAllDocuments()

      expect(fakeHttp.get).toHaveBeenCalledTimes(2)
    })
  })

  describe('getDocuments / getDocument', () => {
    it('getDocuments maps the course-scoped list', async () => {
      const service = createDocumentService(fakeHttp, streamSse)
      vi.mocked(fakeHttp.get).mockResolvedValueOnce({ data: { data: [backendDoc()] } })
      const docs = await service.getDocuments('c-1')
      expect(fakeHttp.get).toHaveBeenCalledWith('/api/courses/c-1/documents')
      expect(docs[0].id).toBe('d-1')
    })

    it('getDocument maps a single document', async () => {
      const service = createDocumentService(fakeHttp, streamSse)
      vi.mocked(fakeHttp.get).mockResolvedValueOnce({ data: { data: backendDoc() } })
      const doc = await service.getDocument('c-1', 'd-1')
      expect(fakeHttp.get).toHaveBeenCalledWith('/api/courses/c-1/documents/d-1')
      expect(doc.id).toBe('d-1')
    })
  })

  describe('generateSummary', () => {
    it('parses a JSON summary blob', async () => {
      const service = createDocumentService(fakeHttp, streamSse)
      vi.mocked(fakeHttp.post).mockResolvedValueOnce({
        data: { data: backendDoc({ summary: JSON.stringify({ summary: 'S', keyPoints: ['a'] }) }) },
      })
      const result = await service.generateSummary('c-1', 'd-1')
      expect(result).toEqual({ summary: 'S', keyPoints: ['a'] })
    })

    it('falls back to the raw summary string when it is not JSON', async () => {
      const service = createDocumentService(fakeHttp, streamSse)
      vi.mocked(fakeHttp.post).mockResolvedValueOnce({ data: { data: backendDoc({ summary: 'plain text summary' }) } })
      const result = await service.generateSummary('c-1', 'd-1')
      expect(result).toEqual({ summary: 'plain text summary', keyPoints: [] })
    })

    it('parses to an empty object when summary is absent (defaults to the "{}" literal)', async () => {
      const service = createDocumentService(fakeHttp, streamSse)
      vi.mocked(fakeHttp.post).mockResolvedValueOnce({ data: { data: backendDoc({ summary: undefined }) } })
      const result = await service.generateSummary('c-1', 'd-1')
      expect(result).toEqual({})
    })
  })

  it('generateMindMap defaults mindMapText to empty string', async () => {
    const service = createDocumentService(fakeHttp, streamSse)
    vi.mocked(fakeHttp.post).mockResolvedValueOnce({ data: { data: backendDoc({ mindMapText: null }) } })
    expect(await service.generateMindMap('c-1', 'd-1')).toEqual({ mindMapText: '' })
  })

  describe('quiz generation and mapping', () => {
    const backendQuiz = { quizId: 'q-1', question: 'Q', options: ['A', 'B'], correctAnswer: 'A', explanation: 'E' }

    it('generateQuiz defaults difficulty to medium in the URL', async () => {
      const service = createDocumentService(fakeHttp, streamSse)
      vi.mocked(fakeHttp.post).mockResolvedValueOnce({ data: { data: [backendQuiz] } })
      await service.generateQuiz('c-1', 'd-1')
      expect(fakeHttp.post).toHaveBeenCalledWith('/api/courses/c-1/documents/d-1/quiz/generate?difficulty=medium')
    })

    it('mapQuiz defaults missing difficulty to medium and normalizes options', async () => {
      const service = createDocumentService(fakeHttp, streamSse)
      vi.mocked(fakeHttp.get).mockResolvedValueOnce({ data: { data: [{ ...backendQuiz, options: undefined }] } })
      const quizzes = await service.getQuiz('c-1', 'd-1')
      expect(quizzes[0].difficulty).toBe('medium')
      expect(quizzes[0].options).toEqual([])
    })

    it('generateAdaptiveQuiz returns the rationale message, defaulting to empty string', async () => {
      const service = createDocumentService(fakeHttp, streamSse)
      vi.mocked(fakeHttp.post).mockResolvedValueOnce({ data: { data: [backendQuiz], message: "You're averaging 91%" } })
      const result = await service.generateAdaptiveQuiz('c-1', 'd-1')
      expect(result.rationale).toBe("You're averaging 91%")

      vi.mocked(fakeHttp.post).mockResolvedValueOnce({ data: { data: [backendQuiz] } })
      expect((await service.generateAdaptiveQuiz('c-1', 'd-1')).rationale).toBe('')
    })

    it('getQuiz appends the difficulty query param only when given', async () => {
      const service = createDocumentService(fakeHttp, streamSse)
      vi.mocked(fakeHttp.get).mockResolvedValue({ data: { data: [] } })

      await service.getQuiz('c-1', 'd-1')
      expect(fakeHttp.get).toHaveBeenCalledWith('/api/courses/c-1/documents/d-1/quiz')

      await service.getQuiz('c-1', 'd-1', 'hard')
      expect(fakeHttp.get).toHaveBeenCalledWith('/api/courses/c-1/documents/d-1/quiz?difficulty=hard')
    })
  })

  describe('flashcards', () => {
    const backendCard = { flashcardId: 'f-1', front: 'Q', back: 'A' }

    it('generateFlashcards and getFlashcards stamp the documentId onto every card', async () => {
      const service = createDocumentService(fakeHttp, streamSse)
      vi.mocked(fakeHttp.post).mockResolvedValueOnce({ data: { data: [backendCard] } })
      const generated = await service.generateFlashcards('c-1', 'd-1')
      expect(generated[0].documentId).toBe('d-1')

      vi.mocked(fakeHttp.get).mockResolvedValueOnce({ data: { data: [backendCard] } })
      const fetched = await service.getFlashcards('c-1', 'd-1')
      expect(fetched[0].documentId).toBe('d-1')
    })
  })

  it('chat returns the response content', async () => {
    const service = createDocumentService(fakeHttp, streamSse)
    vi.mocked(fakeHttp.post).mockResolvedValueOnce({ data: { data: { content: 'reply' } } })
    expect(await service.chat('c-1', 'd-1', 'hi')).toBe('reply')
  })

  describe('streaming', () => {
    it('streamChat omits attachments/conversationId when absent', async () => {
      const service = createDocumentService(fakeHttp, streamSse)
      const onChunk = vi.fn()
      await service.streamChat('c-1', 'd-1', 'hi', onChunk)
      expect(streamSse).toHaveBeenCalledWith('/api/courses/c-1/documents/d-1/chat/stream', { message: 'hi' }, onChunk, undefined)
    })

    it('streamChat includes attachments and conversationId when present', async () => {
      const service = createDocumentService(fakeHttp, streamSse)
      const onChunk = vi.fn()
      const attachments = [{ data: 'base64data', mimeType: 'image/png' }]
      await service.streamChat('c-1', 'd-1', 'hi', onChunk, undefined, attachments, 'conv-1')
      expect(streamSse).toHaveBeenCalledWith(
        '/api/courses/c-1/documents/d-1/chat/stream',
        { message: 'hi', attachments, conversationId: 'conv-1' },
        onChunk,
        undefined,
      )
    })
  })

  it('getChatHistory maps assistant role to model', async () => {
    const service = createDocumentService(fakeHttp, streamSse)
    vi.mocked(fakeHttp.get).mockResolvedValueOnce({
      data: { data: [{ messageId: 'm-1', role: 'assistant', content: 'hi', createdAt: '2026-01-01' }] },
    })
    const history = await service.getChatHistory('c-1', 'd-1')
    expect(history[0].role).toBe('model')
  })

  describe('notes', () => {
    it('createNote / updateNote / getNotes map noteId to id', async () => {
      const service = createDocumentService(fakeHttp, streamSse)
      const backendNote = { noteId: 'n-1', documentId: 'd-1', content: 'text', createdAt: '2026-01-01' }

      vi.mocked(fakeHttp.post).mockResolvedValueOnce({ data: { data: backendNote } })
      expect((await service.createNote('c-1', 'd-1', 'text')).id).toBe('n-1')

      vi.mocked(fakeHttp.put).mockResolvedValueOnce({ data: { data: backendNote } })
      expect((await service.updateNote('c-1', 'd-1', 'n-1', 'updated')).id).toBe('n-1')

      vi.mocked(fakeHttp.get).mockResolvedValueOnce({ data: { data: [backendNote] } })
      expect((await service.getNotes('c-1', 'd-1'))[0].id).toBe('n-1')
    })

    it('deleteNote deletes by id', async () => {
      const service = createDocumentService(fakeHttp, streamSse)
      await service.deleteNote('c-1', 'd-1', 'n-1')
      expect(fakeHttp.delete).toHaveBeenCalledWith('/api/courses/c-1/documents/d-1/notes/n-1')
    })
  })

  describe('quiz submissions', () => {
    it('saveQuizSubmission maps documentName from the sourceType-conditional title', async () => {
      const service = createDocumentService(fakeHttp, streamSse)
      vi.mocked(fakeHttp.post).mockResolvedValueOnce({
        data: { data: { submissionId: 's-1', documentId: 'd-1', sourceType: 'document', title: 'Report.pdf', score: 8, total: 10, submittedAt: '2026-01-01' } },
      })
      const submission = await service.saveQuizSubmission('c-1', 'd-1', { q1: 'A' }, 8, 10)
      expect(submission.documentName).toBe('Report.pdf')
      expect(submission.videoName).toBeUndefined()
    })

    it('getQuizSubmission returns null when the server has no submission', async () => {
      const service = createDocumentService(fakeHttp, streamSse)
      vi.mocked(fakeHttp.get).mockResolvedValueOnce({ data: { data: null } })
      expect(await service.getQuizSubmission('c-1', 'd-1')).toBeNull()
    })

    it('getQuizSubmission maps a present submission', async () => {
      const service = createDocumentService(fakeHttp, streamSse)
      vi.mocked(fakeHttp.get).mockResolvedValueOnce({
        data: { data: { submissionId: 's-1', documentId: 'd-1', score: 5, total: 10, submittedAt: '2026-01-01', answers: { q1: 'A' } } },
      })
      const submission = await service.getQuizSubmission('c-1', 'd-1')
      expect(submission).not.toBeNull()
      expect(submission?.answers).toEqual({ q1: 'A' })
    })
  })
})
