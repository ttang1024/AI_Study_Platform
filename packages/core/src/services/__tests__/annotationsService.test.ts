import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAnnotationsService } from '../annotationsService'
import type { HttpClient } from '../../http'

const fakeHttp: HttpClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}

describe('annotationsService', () => {
  beforeEach(() => vi.clearAllMocks())
  const service = createAnnotationsService(fakeHttp)

  it('getByDocument GETs the document-scoped endpoint', () => {
    service.getByDocument('doc-1')
    expect(fakeHttp.get).toHaveBeenCalledWith('/api/documents/doc-1/annotations')
  })

  it('create posts the annotation payload to the document-scoped endpoint', () => {
    const data = { highlightedText: 'text', color: '#fff', pageNumber: 1, rectJson: '[]' }
    service.create('doc-1', data)
    expect(fakeHttp.post).toHaveBeenCalledWith('/api/documents/doc-1/annotations', data)
  })

  it('update puts the note/color to the annotation-scoped endpoint', () => {
    service.update('ann-1', { note: 'note', color: '#000' })
    expect(fakeHttp.put).toHaveBeenCalledWith('/api/annotations/ann-1', { note: 'note', color: '#000' })
  })

  it('delete calls DELETE by annotation id', () => {
    service.delete('ann-1')
    expect(fakeHttp.delete).toHaveBeenCalledWith('/api/annotations/ann-1')
  })

  it('createFlashcard posts to the annotation-scoped flashcard endpoint', () => {
    service.createFlashcard('ann-1')
    expect(fakeHttp.post).toHaveBeenCalledWith('/api/annotations/ann-1/create-flashcard')
  })
})
