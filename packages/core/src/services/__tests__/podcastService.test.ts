import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPodcastService } from '../podcastService'
import type { HttpClient } from '../../http'

const fakeHttp: HttpClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}

const rawEpisode = (overrides: Record<string, unknown> = {}) => ({
  documentId: 'd-1',
  courseId: 'c-1',
  userId: 'u-1',
  fileName: 'ep.mp3',
  blobUrl: 'https://blob/ep.mp3',
  contentType: 'audio/mpeg',
  fileSize: 5000,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...overrides,
})

describe('podcastService', () => {
  beforeEach(() => vi.clearAllMocks())
  const service = createPodcastService(fakeHttp)

  it('create posts url/courseId and defaults nullable fields to null', async () => {
    vi.mocked(fakeHttp.post).mockResolvedValueOnce({ data: { data: rawEpisode() } })

    const episode = await service.create('https://podcast.example/ep1', 'c-1')

    expect(fakeHttp.post).toHaveBeenCalledWith('/api/podcasts', { url: 'https://podcast.example/ep1', courseId: 'c-1' })
    expect(episode.summary).toBeNull()
    expect(episode.mindMapText).toBeNull()
    expect(episode.transcript).toBeNull()
    expect(episode.originalUrl).toBeNull()
  })

  it('getFeed passes the feed url as a query param', async () => {
    vi.mocked(fakeHttp.get).mockResolvedValueOnce({ data: { data: { title: 'Feed', thumbnailUrl: '', episodes: [] } } })
    await service.getFeed('https://feed.xml')
    expect(fakeHttp.get).toHaveBeenCalledWith('/api/podcasts/feed', { params: { url: 'https://feed.xml' } })
  })

  it('createFromFeed posts feedUrl/episodeId/courseId', async () => {
    vi.mocked(fakeHttp.post).mockResolvedValueOnce({ data: { data: rawEpisode() } })
    await service.createFromFeed('https://feed.xml', 'ep-1', 'c-1')
    expect(fakeHttp.post).toHaveBeenCalledWith('/api/podcasts/from-feed', { feedUrl: 'https://feed.xml', episodeId: 'ep-1', courseId: 'c-1' })
  })

  it('getEpisode maps the fetched episode', async () => {
    vi.mocked(fakeHttp.get).mockResolvedValueOnce({ data: { data: rawEpisode({ summary: 'S' }) } })
    const episode = await service.getEpisode('d-1')
    expect(fakeHttp.get).toHaveBeenCalledWith('/api/podcasts/d-1')
    expect(episode.summary).toBe('S')
  })

  it('getAudioUrl returns the unwrapped string', async () => {
    vi.mocked(fakeHttp.get).mockResolvedValueOnce({ data: { data: 'https://signed/url' } })
    expect(await service.getAudioUrl('d-1')).toBe('https://signed/url')
    expect(fakeHttp.get).toHaveBeenCalledWith('/api/podcasts/d-1/url')
  })

  it('transcribe posts to the transcribe endpoint and maps the result', async () => {
    vi.mocked(fakeHttp.post).mockResolvedValueOnce({ data: { data: rawEpisode({ transcript: 'text' }) } })
    const episode = await service.transcribe('d-1')
    expect(fakeHttp.post).toHaveBeenCalledWith('/api/podcasts/d-1/transcribe')
    expect(episode.transcript).toBe('text')
  })
})
