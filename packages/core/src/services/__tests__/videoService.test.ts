import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createVideoService } from '../videoService'
import type { HttpClient } from '../../http'

const fakeHttp: HttpClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}

const streamSse = vi.fn()

const pagedVideos = (items: unknown[] = []) => ({ items, totalCount: items.length, page: 1, pageSize: 8, totalPages: 1 })

const videoItem = (overrides: Record<string, unknown> = {}) => ({
  id: 'v-1',
  courseId: 'c-1',
  courseName: 'Algorithms',
  courseColor: '#000',
  videoId: 'yt-1',
  videoUrl: 'https://youtube.com/watch?v=yt-1',
  title: 'Intro',
  thumbnailUrl: 'thumb.jpg',
  summary: 'Summary text',
  noteContent: 'Notes',
  flashcardsJson: '[]',
  quizJson: '[]',
  createdAt: '2026-01-01T00:00:00Z',
  ...overrides,
})

describe('videoService', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('getVideos', () => {
    it('builds query params with defaults', async () => {
      const service = createVideoService(fakeHttp, streamSse)
      vi.mocked(fakeHttp.get).mockResolvedValueOnce({ data: { data: pagedVideos() } })

      await service.getVideos()

      const url = vi.mocked(fakeHttp.get).mock.calls[0][0] as string
      expect(url).toContain('/api/videos?')
      expect(url).toContain('page=1')
      expect(url).toContain('pageSize=8')
    })

    it('caches a response and serves it on a repeat call', async () => {
      const service = createVideoService(fakeHttp, streamSse)
      vi.mocked(fakeHttp.get).mockResolvedValue({ data: { data: pagedVideos([videoItem()]) } })

      await service.getVideos()
      await service.getVideos()

      expect(fakeHttp.get).toHaveBeenCalledTimes(1)
    })

    it('re-fetches after invalidateVideoListCache', async () => {
      const service = createVideoService(fakeHttp, streamSse)
      vi.mocked(fakeHttp.get).mockResolvedValue({ data: { data: pagedVideos() } })

      await service.getVideos()
      service.invalidateVideoListCache()
      await service.getVideos()

      expect(fakeHttp.get).toHaveBeenCalledTimes(2)
    })
  })

  describe('getVideosLite', () => {
    it('nulls the heavy fields on each returned item', async () => {
      const service = createVideoService(fakeHttp, streamSse)
      vi.mocked(fakeHttp.get).mockResolvedValueOnce({ data: { data: pagedVideos([videoItem()]) } })

      const result = await service.getVideosLite()

      expect(result.items[0].summary).toBeNull()
      expect(result.items[0].noteContent).toBeNull()
      expect(result.items[0].flashcardsJson).toBeNull()
      expect(result.items[0].quizJson).toBeNull()
      expect(result.items[0].title).toBe('Intro') // non-heavy fields preserved
    })

    it('uses a cache key distinct from getVideos (both remain independently cached)', async () => {
      const service = createVideoService(fakeHttp, streamSse)
      vi.mocked(fakeHttp.get).mockResolvedValue({ data: { data: pagedVideos([videoItem()]) } })

      await service.getVideos()
      await service.getVideosLite()

      expect(fakeHttp.get).toHaveBeenCalledTimes(2)
    })
  })

  describe('mutations invalidate the video list cache', () => {
    it('createVideo invalidates the cache', async () => {
      const service = createVideoService(fakeHttp, streamSse)
      vi.mocked(fakeHttp.get).mockResolvedValue({ data: { data: pagedVideos() } })
      vi.mocked(fakeHttp.post).mockResolvedValueOnce({ data: { data: {} } })

      await service.getVideos()
      await service.createVideo({ courseId: 'c-1', videoId: 'v-1', videoUrl: 'u', title: 't', thumbnailUrl: 'th', summary: null })
      await service.getVideos()

      expect(fakeHttp.get).toHaveBeenCalledTimes(2)
    })

    it('updateVideo invalidates the cache', async () => {
      const service = createVideoService(fakeHttp, streamSse)
      vi.mocked(fakeHttp.get).mockResolvedValue({ data: { data: pagedVideos() } })
      vi.mocked(fakeHttp.patch).mockResolvedValueOnce({ data: { data: videoItem() } })

      await service.getVideos()
      await service.updateVideo('v-1', { title: 'New' })
      await service.getVideos()

      expect(fakeHttp.get).toHaveBeenCalledTimes(2)
    })

    it('deleteVideo invalidates the cache', async () => {
      const service = createVideoService(fakeHttp, streamSse)
      vi.mocked(fakeHttp.get).mockResolvedValue({ data: { data: pagedVideos() } })

      await service.getVideos()
      await service.deleteVideo('v-1')
      await service.getVideos()

      expect(fakeHttp.get).toHaveBeenCalledTimes(2)
      expect(fakeHttp.delete).toHaveBeenCalledWith('/api/videos/v-1')
    })

    it('moveVideo posts to the move endpoint and invalidates the cache', async () => {
      const service = createVideoService(fakeHttp, streamSse)
      vi.mocked(fakeHttp.get).mockResolvedValue({ data: { data: pagedVideos() } })

      await service.getVideos()
      await service.moveVideo('v-1', 'c-2')
      await service.getVideos()

      expect(fakeHttp.patch).toHaveBeenCalledWith('/api/videos/v-1/move', { targetCourseId: 'c-2' })
      expect(fakeHttp.get).toHaveBeenCalledTimes(2)
    })
  })

  describe('error-swallowing reads', () => {
    it('getVideoMetadata returns null on request failure', async () => {
      const service = createVideoService(fakeHttp, streamSse)
      vi.mocked(fakeHttp.get).mockRejectedValueOnce(new Error('not found'))
      expect(await service.getVideoMetadata('https://x.com/v')).toBeNull()
    })

    it('getVideoGlossary returns [] on request failure', async () => {
      const service = createVideoService(fakeHttp, streamSse)
      vi.mocked(fakeHttp.get).mockRejectedValueOnce(new Error('fail'))
      expect(await service.getVideoGlossary('v-1')).toEqual([])
    })

    it('getVideoGlossary maps terms on success', async () => {
      const service = createVideoService(fakeHttp, streamSse)
      vi.mocked(fakeHttp.get).mockResolvedValueOnce({ data: { data: [{ id: 't-1', term: 'X', definition: 'Y', extra: 'ignored' }] } })
      expect(await service.getVideoGlossary('v-1')).toEqual([{ id: 't-1', term: 'X', definition: 'Y' }])
    })
  })

  describe('quiz submission', () => {
    it('getQuizSubmission returns null when there is no submission', async () => {
      const service = createVideoService(fakeHttp, streamSse)
      vi.mocked(fakeHttp.get).mockResolvedValueOnce({ data: { data: null } })
      expect(await service.getQuizSubmission('v-1')).toBeNull()
    })

    it('getQuizSubmission defaults answers to {} when absent', async () => {
      const service = createVideoService(fakeHttp, streamSse)
      vi.mocked(fakeHttp.get).mockResolvedValueOnce({ data: { data: { score: 5, total: 10 } } })
      const result = await service.getQuizSubmission('v-1')
      expect(result).toEqual({ answers: {}, score: 5, total: 10 })
    })
  })

  describe('notes', () => {
    it('getVideoNote returns the first note mapped, or null when there are none', async () => {
      const service = createVideoService(fakeHttp, streamSse)
      vi.mocked(fakeHttp.get).mockResolvedValueOnce({ data: { data: [{ noteId: 'n-1', content: 'hi', createdAt: '' }] } })
      expect(await service.getVideoNote('v-1')).toEqual({ noteId: 'n-1', content: 'hi' })

      vi.mocked(fakeHttp.get).mockResolvedValueOnce({ data: { data: [] } })
      expect(await service.getVideoNote('v-1')).toBeNull()
    })

    it('createNote posts content/videoId and maps the response', async () => {
      const service = createVideoService(fakeHttp, streamSse)
      vi.mocked(fakeHttp.post).mockResolvedValueOnce({ data: { data: { noteId: 'n-1', content: 'hi' } } })
      const result = await service.createNote('hi', 'v-1')
      expect(fakeHttp.post).toHaveBeenCalledWith('/api/notes', { content: 'hi', videoId: 'v-1' })
      expect(result).toEqual({ noteId: 'n-1', content: 'hi' })
    })
  })

  describe('chat', () => {
    it('getChatHistory maps assistant role to model', async () => {
      const service = createVideoService(fakeHttp, streamSse)
      vi.mocked(fakeHttp.get).mockResolvedValueOnce({
        data: { data: [{ messageId: 'm-1', role: 'assistant', content: 'hi' }] },
      })
      const result = await service.getChatHistory('v-1')
      expect(result).toEqual([{ id: 'm-1', role: 'model', content: 'hi', attachments: undefined }])
    })

    it('listChatConversations maps and defaults messageCount/lastMessage', async () => {
      const service = createVideoService(fakeHttp, streamSse)
      vi.mocked(fakeHttp.get).mockResolvedValueOnce({
        data: { data: [{ conversationId: 'conv-1', title: 'T', createdAt: '', updatedAt: '' }] },
      })
      const result = await service.listChatConversations('v-1')
      expect(result[0].messageCount).toBe(0)
      expect(result[0].lastMessage).toBeNull()
    })

    it('sendChat always returns role: model', async () => {
      const service = createVideoService(fakeHttp, streamSse)
      vi.mocked(fakeHttp.post).mockResolvedValueOnce({ data: { data: { messageId: 'm-1', content: 'reply' } } })
      const result = await service.sendChat('v-1', 'hello')
      expect(fakeHttp.post).toHaveBeenCalledWith('/api/videos/v-1/chat', { message: 'hello' })
      expect(result).toEqual({ id: 'm-1', role: 'model', content: 'reply' })
    })
  })

  describe('streaming', () => {
    it('streamSummary calls streamSse with the videoUrl body', async () => {
      const service = createVideoService(fakeHttp, streamSse)
      const onChunk = vi.fn()
      await service.streamSummary('https://x.com/v', onChunk)
      expect(streamSse).toHaveBeenCalledWith('/api/videos/summary/stream', { videoUrl: 'https://x.com/v' }, onChunk, undefined)
    })

    it('streamChat omits attachments/conversationId when not given', async () => {
      const service = createVideoService(fakeHttp, streamSse)
      const onChunk = vi.fn()
      await service.streamChat('v-1', 'hi', onChunk)
      expect(streamSse).toHaveBeenCalledWith('/api/videos/v-1/chat/stream', { message: 'hi' }, onChunk, undefined)
    })

    it('streamChat includes attachments and conversationId when given', async () => {
      const service = createVideoService(fakeHttp, streamSse)
      const onChunk = vi.fn()
      const attachments = [{ data: 'base64data', mimeType: 'image/png' }]
      await service.streamChat('v-1', 'hi', onChunk, undefined, attachments, 'conv-1')
      expect(streamSse).toHaveBeenCalledWith(
        '/api/videos/v-1/chat/stream',
        { message: 'hi', attachments, conversationId: 'conv-1' },
        onChunk,
        undefined,
      )
    })
  })
})
