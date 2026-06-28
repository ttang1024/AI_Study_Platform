import { describe, expect, it } from 'vitest'
import { getDocDisplayName } from '../docName'

describe('getDocDisplayName', () => {
  it('strips .md extension for web articles (with originalUrl)', () => {
    expect(getDocDisplayName({ name: 'my-article.md', type: 'md', originalUrl: 'https://example.com' })).toBe('my-article')
  })

  it('strips .txt extension for web articles (with originalUrl)', () => {
    expect(getDocDisplayName({ name: 'notes.txt', type: 'txt', originalUrl: 'https://example.com' })).toBe('notes')
  })

  it('is case-insensitive for the extension', () => {
    expect(getDocDisplayName({ name: 'file.MD', type: 'md', originalUrl: 'https://example.com' })).toBe('file')
    expect(getDocDisplayName({ name: 'file.TXT', type: 'txt', originalUrl: 'https://example.com' })).toBe('file')
  })

  it('keeps .md extension for regular uploaded documents (no originalUrl)', () => {
    expect(getDocDisplayName({ name: 'notes.md', type: 'md', originalUrl: undefined })).toBe('notes.md')
  })

  it('keeps original name unchanged for uploaded PDFs', () => {
    expect(getDocDisplayName({ name: 'lecture.pdf', type: 'pdf', originalUrl: undefined })).toBe('lecture.pdf')
  })

  it('keeps original name for articles without .md/.txt', () => {
    expect(getDocDisplayName({ name: 'My Article', type: 'md', originalUrl: 'https://example.com' })).toBe('My Article')
  })

  it('handles empty originalUrl string as falsy — returns name as-is', () => {
    expect(getDocDisplayName({ name: 'file.md', type: 'md', originalUrl: '' })).toBe('file.md')
  })
})
