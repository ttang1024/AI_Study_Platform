import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockApiClient = {
  get: vi.fn(),
  post: vi.fn(),
}

vi.mock('../apiClient', () => ({ apiClient: mockApiClient }))

const { workedProblemsService } = await import('../workedProblemsService')

const backendProblem = (id = 'p-1') => ({
  workedProblemId: id,
  userId: 'u-1',
  documentId: 'doc-1',
  videoId: null,
  problemText: 'Solve for x',
  steps: [{ stepNumber: 1, description: 'Isolate x', formula: 'x = 5' }],
  finalAnswer: 'x = 5',
  difficulty: 'medium',
  topic: 'Algebra',
  createdAt: '2026-01-01T00:00:00Z',
})

describe('workedProblemsService', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('getProblems', () => {
    it('returns problems for a document', async () => {
      mockApiClient.get.mockResolvedValueOnce({ data: { data: [backendProblem('p-1'), backendProblem('p-2')] } })

      const problems = await workedProblemsService.getProblems('doc-1')

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/documents/doc-1/worked-problems')
      expect(problems).toHaveLength(2)
      expect(problems[0].workedProblemId).toBe('p-1')
    })

    it('returns empty array when data is null', async () => {
      mockApiClient.get.mockResolvedValueOnce({ data: { data: null } })

      const problems = await workedProblemsService.getProblems('doc-1')

      expect(problems).toEqual([])
    })
  })

  describe('generateProblems', () => {
    it('posts and returns generated problems', async () => {
      mockApiClient.post.mockResolvedValueOnce({ data: { data: [backendProblem()] } })

      const problems = await workedProblemsService.generateProblems('doc-1', 'hard', 3)

      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/api/documents/doc-1/worked-problems/generate',
        { difficulty: 'hard', count: 3 }
      )
      expect(problems).toHaveLength(1)
    })
  })

  describe('submitAttempt', () => {
    it('posts user answer and returns attempt', async () => {
      const attempt = {
        workedProblemAttemptId: 'a-1',
        workedProblemId: 'p-1',
        userAnswer: 'x = 5',
        aiEvaluation: 'Correct!',
        isCorrect: true,
        attemptedAt: '2026-01-01T00:00:00Z',
      }
      mockApiClient.post.mockResolvedValueOnce({ data: { data: attempt } })

      const result = await workedProblemsService.submitAttempt('p-1', 'x = 5')

      expect(mockApiClient.post).toHaveBeenCalledWith('/api/worked-problems/p-1/attempt', { userAnswer: 'x = 5' })
      expect(result.isCorrect).toBe(true)
      expect(result.aiEvaluation).toBe('Correct!')
    })
  })

  describe('getMastered', () => {
    it('returns a Set of mastered problem ids', async () => {
      mockApiClient.get.mockResolvedValueOnce({ data: { data: ['p-1', 'p-3'] } })

      const mastered = await workedProblemsService.getMastered()

      expect(mastered).toBeInstanceOf(Set)
      expect(mastered.has('p-1')).toBe(true)
      expect(mastered.has('p-3')).toBe(true)
      expect(mastered.has('p-2')).toBe(false)
    })

    it('returns empty set when data is null', async () => {
      mockApiClient.get.mockResolvedValueOnce({ data: { data: null } })

      const mastered = await workedProblemsService.getMastered()

      expect(mastered.size).toBe(0)
    })
  })

  describe('toggleMastered', () => {
    it('posts to mastered endpoint and returns boolean result', async () => {
      mockApiClient.post.mockResolvedValueOnce({ data: { data: true } })

      const result = await workedProblemsService.toggleMastered('p-1')

      expect(mockApiClient.post).toHaveBeenCalledWith('/api/worked-problems/mastered/p-1')
      expect(result).toBe(true)
    })
  })
})
