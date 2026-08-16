import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createConceptLinksService } from '../conceptLinksService'
import type { HttpClient } from '../../http'

const fakeHttp: HttpClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}

describe('conceptLinksService', () => {
  beforeEach(() => vi.clearAllMocks())
  const service = createConceptLinksService(fakeHttp)

  it('getKnowledgeGraph strips HTML from note-derived node titles', async () => {
    vi.mocked(fakeHttp.get).mockResolvedValueOnce({
      data: {
        data: {
          nodes: [{ id: 'n-1', type: 'note', title: '<p>My <strong>Note</strong></p>', weight: 1 }],
          edges: [],
          stats: { materials: 0, concepts: 0, notes: 1, quizzes: 0, links: 0 },
        },
      },
    })

    const graph = await service.getKnowledgeGraph()

    expect(fakeHttp.get).toHaveBeenCalledWith('/api/concept-links/knowledge-graph')
    expect(graph.nodes[0].title).toBe('My Note')
  })

  it('getKnowledgeGaps GETs the gaps endpoint and returns the payload', async () => {
    const gaps = { gaps: [], stats: { totalConcepts: 0, gaps: 0, unmastered: 0, undefined: 0, crossCourse: 0 } }
    vi.mocked(fakeHttp.get).mockResolvedValueOnce({ data: { data: gaps } })
    const result = await service.getKnowledgeGaps()
    expect(fakeHttp.get).toHaveBeenCalledWith('/api/concept-links/gaps')
    expect(result).toEqual(gaps)
  })

  it('getLearningPath GETs the learning-path endpoint and returns the payload', async () => {
    const path = { steps: [], masteredCount: 0, totalCount: 0 }
    vi.mocked(fakeHttp.get).mockResolvedValueOnce({ data: { data: path } })
    const result = await service.getLearningPath()
    expect(fakeHttp.get).toHaveBeenCalledWith('/api/concept-links/learning-path')
    expect(result).toEqual(path)
  })
})
