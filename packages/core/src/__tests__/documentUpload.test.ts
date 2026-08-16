import { describe, it, expect } from 'vitest'
import { isAcceptedDocumentFile } from '../documentUpload'

describe('isAcceptedDocumentFile', () => {
  it('accepts a known extension regardless of MIME type', () => {
    expect(isAcceptedDocumentFile('notes.pdf')).toBe(true)
    expect(isAcceptedDocumentFile('script.py', 'application/octet-stream')).toBe(true)
  })

  it('accepts a known MIME type even with an unrecognized extension', () => {
    expect(isAcceptedDocumentFile('file.unknownext', 'application/pdf')).toBe(true)
  })

  it('rejects a file with neither a known extension nor a known MIME type', () => {
    expect(isAcceptedDocumentFile('archive.zip', 'application/zip')).toBe(false)
  })

  it('is case-insensitive on the extension', () => {
    expect(isAcceptedDocumentFile('REPORT.PDF')).toBe(true)
  })

  it('handles a missing/null MIME type', () => {
    expect(isAcceptedDocumentFile('notes.md', null)).toBe(true)
    expect(isAcceptedDocumentFile('archive.zip', null)).toBe(false)
  })
})
