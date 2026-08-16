import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createEssayService } from '../essayService'
import type { HttpClient } from '../../http'

const fakeHttp: HttpClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}

describe('essayService', () => {
  beforeEach(() => vi.clearAllMocks())
  const service = createEssayService(fakeHttp)

  it('getRubrics GETs /api/essays/rubrics', () => {
    service.getRubrics()
    expect(fakeHttp.get).toHaveBeenCalledWith('/api/essays/rubrics')
  })

  it('saveRubric posts the rubric payload', () => {
    const rubric = { name: 'Essay Rubric', criteria: [{ name: 'Clarity', maxPoints: 10 }] }
    service.saveRubric(rubric)
    expect(fakeHttp.post).toHaveBeenCalledWith('/api/essays/rubrics', rubric)
  })

  it('deleteRubric deletes by id', () => {
    service.deleteRubric('r-1')
    expect(fakeHttp.delete).toHaveBeenCalledWith('/api/essays/rubrics/r-1')
  })

  it('getEssays GETs /api/essays', () => {
    service.getEssays()
    expect(fakeHttp.get).toHaveBeenCalledWith('/api/essays')
  })

  it('getRevisions GETs the submission-scoped revisions', () => {
    service.getRevisions('sub-1')
    expect(fakeHttp.get).toHaveBeenCalledWith('/api/essays/sub-1/revisions')
  })

  it('saveEssay posts the essay payload', () => {
    const essay = { title: 'My Essay', text: 'body' }
    service.saveEssay(essay)
    expect(fakeHttp.post).toHaveBeenCalledWith('/api/essays', essay)
  })

  it('grade posts to the submission-scoped grade endpoint', () => {
    service.grade('sub-1')
    expect(fakeHttp.post).toHaveBeenCalledWith('/api/essays/sub-1/grade')
  })
})
