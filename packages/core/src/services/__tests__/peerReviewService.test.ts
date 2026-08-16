import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPeerReviewService } from '../peerReviewService'
import type { HttpClient } from '../../http'

const fakeHttp: HttpClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}

describe('peerReviewService', () => {
  beforeEach(() => vi.clearAllMocks())
  const service = createPeerReviewService(fakeHttp)

  it('request posts classroomId/reviewerCount to the essay-scoped endpoint', () => {
    service.request('essay-1', 'class-1', 3)
    expect(fakeHttp.post).toHaveBeenCalledWith('/api/essays/essay-1/peer-review', { classroomId: 'class-1', reviewerCount: 3 })
  })

  it('getForEssay GETs the essay-scoped reviews', () => {
    service.getForEssay('essay-1')
    expect(fakeHttp.get).toHaveBeenCalledWith('/api/essays/essay-1/peer-review')
  })

  it('getMyQueue defaults includeSubmitted to false', () => {
    service.getMyQueue()
    expect(fakeHttp.get).toHaveBeenCalledWith('/api/peer-reviews', { params: { includeSubmitted: false } })
  })

  it('getMyQueue passes includeSubmitted through when true', () => {
    service.getMyQueue(true)
    expect(fakeHttp.get).toHaveBeenCalledWith('/api/peer-reviews', { params: { includeSubmitted: true } })
  })

  it('open GETs the review-scoped workspace', () => {
    service.open('review-1')
    expect(fakeHttp.get).toHaveBeenCalledWith('/api/peer-reviews/review-1')
  })

  it('submit posts scores and overallComment', () => {
    const scores = [{ criterionName: 'Clarity', points: 4, comment: null }]
    service.submit('review-1', scores, 'Good work')
    expect(fakeHttp.post).toHaveBeenCalledWith('/api/peer-reviews/review-1', { scores, overallComment: 'Good work' })
  })
})
