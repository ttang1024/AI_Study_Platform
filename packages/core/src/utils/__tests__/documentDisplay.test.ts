import { describe, it, expect } from 'vitest'
import { documentSourceKind, getDocDisplayName } from '../documentDisplay'

describe('documentSourceKind', () => {
  it('returns doc for null/undefined input', () => {
    expect(documentSourceKind(null)).toBe('doc')
    expect(documentSourceKind(undefined)).toBe('doc')
  })

  it('returns audio for audio and podcast types regardless of originalUrl', () => {
    expect(documentSourceKind({ type: 'audio', originalUrl: 'https://x.com/a.mp3' })).toBe('audio')
    expect(documentSourceKind({ type: 'podcast', originalUrl: undefined })).toBe('audio')
  })

  it('returns article when a non-audio doc has an originalUrl', () => {
    expect(documentSourceKind({ type: 'txt', originalUrl: 'https://example.com/post' })).toBe('article')
  })

  it('returns doc when a non-audio doc has no originalUrl', () => {
    expect(documentSourceKind({ type: 'txt', originalUrl: undefined })).toBe('doc')
  })
})

describe('getDocDisplayName', () => {
  it('strips .md/.txt suffix from clipped articles', () => {
    expect(getDocDisplayName({ name: 'My Article.md', type: 'txt', originalUrl: 'https://x.com' })).toBe('My Article')
    expect(getDocDisplayName({ name: 'notes.txt', type: 'txt', originalUrl: 'https://x.com' })).toBe('notes')
  })

  it('keeps the extension for genuinely uploaded files', () => {
    expect(getDocDisplayName({ name: 'report.pdf', type: 'pdf', originalUrl: undefined })).toBe('report.pdf')
    expect(getDocDisplayName({ name: 'notes.md', type: 'md', originalUrl: undefined })).toBe('notes.md')
  })
})
