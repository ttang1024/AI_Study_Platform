import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createShareService, shareMediaUrl, extractShareToken } from '../shareService'
import type { HttpClient } from '../../http'

const fakeHttp: HttpClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}

describe('shareMediaUrl', () => {
  it('builds and URL-encodes the media path', () => {
    expect(shareMediaUrl('https://api.example.com', 'tok en', 'audio')).toBe(
      'https://api.example.com/api/share/tok%20en/audio',
    )
  })
})

describe('extractShareToken', () => {
  it('returns null for empty input', () => {
    expect(extractShareToken('  ')).toBeNull()
  })

  it('extracts the token from a full share URL', () => {
    expect(extractShareToken('https://app.example.com/share/AbC123')).toBe('AbC123')
  })

  it('accepts a bare token of 6+ chars', () => {
    expect(extractShareToken('AbC123')).toBe('AbC123')
  })

  it('rejects a short bare string that is not a URL', () => {
    expect(extractShareToken('abc')).toBeNull()
  })

  it('rejects input with no recognizable token', () => {
    expect(extractShareToken('not a url or token!')).toBeNull()
  })
})

describe('createShareService', () => {
  beforeEach(() => vi.clearAllMocks())
  const service = createShareService(fakeHttp)

  it('createShare JSON-stringifies collection fields and defaults absent ones to null', async () => {
    vi.mocked(fakeHttp.post).mockResolvedValueOnce({ data: { data: { token: 'tok-1' } } })

    const result = await service.createShare({
      title: 'My Deck',
      flashcards: [{ front: 'Q', back: 'A' }],
    })

    expect(fakeHttp.post).toHaveBeenCalledWith('/api/share', {
      title: 'My Deck',
      summary: null,
      mindMapText: null,
      notesHtml: null,
      quizzesJson: null,
      flashcardsJson: JSON.stringify([{ front: 'Q', back: 'A' }]),
      glossaryJson: null,
      expiresInDays: null,
      sourceType: null,
      sourceUrl: null,
      originalArticleUrl: null,
    })
    expect(result).toEqual({ token: 'tok-1' })
  })

  it('getShare GETs the token-scoped endpoint', async () => {
    vi.mocked(fakeHttp.get).mockResolvedValueOnce({ data: { data: { token: 'tok 1', title: 'T', ownerName: 'A', createdAt: '' } } })
    await service.getShare('tok 1')
    expect(fakeHttp.get).toHaveBeenCalledWith('/api/share/tok%201')
  })

  it('getDocumentShareCards maps to the shareable card shape and defaults to []', async () => {
    vi.mocked(fakeHttp.get).mockResolvedValueOnce({ data: { data: undefined } })
    expect(await service.getDocumentShareCards('c-1', 'd-1')).toEqual([])
    expect(fakeHttp.get).toHaveBeenCalledWith('/api/courses/c-1/documents/d-1/flashcards')
  })

  it('getVideoShareCards strips extra fields down to front/back/cardType', async () => {
    vi.mocked(fakeHttp.get).mockResolvedValueOnce({
      data: { data: [{ front: 'Q', back: 'A', cardType: 'cloze', extraField: 'ignored' }] },
    })
    const cards = await service.getVideoShareCards('v-1')
    expect(cards).toEqual([{ front: 'Q', back: 'A', cardType: 'cloze' }])
  })
})
