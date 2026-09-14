import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createLibraryTagsService } from '../libraryTagsService'
import type { HttpClient } from '../../http'

const fakeHttp: HttpClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}

describe('createLibraryTagsService', () => {
  beforeEach(() => vi.clearAllMocks())
  const service = createLibraryTagsService(fakeHttp)

  it('getTags omits params when kind is not given', () => {
    service.getTags()
    expect(fakeHttp.get).toHaveBeenCalledWith('/api/library/tags', { params: undefined })
  })

  it('getTags passes kind as a param when given', () => {
    service.getTags('collection')
    expect(fakeHttp.get).toHaveBeenCalledWith('/api/library/tags', { params: { kind: 'collection' } })
  })

  it('createTag posts the new-tag payload', () => {
    const input = { name: 'Important', kind: 'tag' as const }
    service.createTag(input)
    expect(fakeHttp.post).toHaveBeenCalledWith('/api/library/tags', input)
  })

  it('updateTag puts to the tag-scoped endpoint', () => {
    service.updateTag('t-1', { name: 'Renamed' })
    expect(fakeHttp.put).toHaveBeenCalledWith('/api/library/tags/t-1', { name: 'Renamed' })
  })

  it('deleteTag deletes by id', () => {
    service.deleteTag('t-1')
    expect(fakeHttp.delete).toHaveBeenCalledWith('/api/library/tags/t-1')
  })

  it('assignItems posts the item refs to the tag-scoped items endpoint', () => {
    const items = [{ itemKind: 'document' as const, itemId: 'd-1' }]
    service.assignItems('t-1', items)
    expect(fakeHttp.post).toHaveBeenCalledWith('/api/library/tags/t-1/items', { items })
  })

  it('unassignItems sends item refs in the DELETE body', () => {
    const items = [{ itemKind: 'video' as const, itemId: 'v-1' }]
    service.unassignItems('t-1', items)
    expect(fakeHttp.delete).toHaveBeenCalledWith('/api/library/tags/t-1/items', { data: { items } })
  })
})
