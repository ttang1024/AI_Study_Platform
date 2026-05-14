import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockApiClient = {
  get: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}

vi.mock('../apiClient', () => ({ apiClient: mockApiClient }))

const { questionBankService, getDifficultyLabel, DIFFICULTY_LABELS } =
  await import('../questionBankService')

const baseQuestion = {
  quizId: 'q-1',
  documentId: 'doc-1',
  sourceType: 'document' as const,
  sourceName: 'Chapter 1',
  question: 'What is X?',
  options: ['A) One', 'B) Two', 'C) Three', 'D) Four'],
  correctAnswer: 'A',
  explanation: 'Because X equals One.',
  difficulty: 'medium' as const,
  createdAt: '2026-01-01T00:00:00Z',
}

describe('questionBankService', () => {
  beforeEach(() => vi.clearAllMocks())

  // ─── getQuestions ──────────────────────────────────────────────────────────

  describe('getQuestions', () => {
    it('fetches without filters by default', async () => {
      mockApiClient.get.mockResolvedValueOnce({ data: { data: [baseQuestion] } })

      const result = await questionBankService.getQuestions()

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/question-bank', { params: {} })
      expect(result).toHaveLength(1)
      expect(result[0].quizId).toBe('q-1')
    })

    it('passes filters as query params', async () => {
      mockApiClient.get.mockResolvedValueOnce({ data: { data: [] } })

      await questionBankService.getQuestions({ courseId: 'c-1', difficulty: 'hard', sourceType: 'video' })

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/question-bank', {
        params: { courseId: 'c-1', difficulty: 'hard', sourceType: 'video' },
      })
    })

    it('returns empty array when data is null', async () => {
      mockApiClient.get.mockResolvedValueOnce({ data: { data: null } })

      const result = await questionBankService.getQuestions()

      expect(result).toEqual([])
    })

    it('filters by courseId only', async () => {
      mockApiClient.get.mockResolvedValueOnce({ data: { data: [baseQuestion] } })

      await questionBankService.getQuestions({ courseId: 'c-99' })

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/question-bank', {
        params: { courseId: 'c-99' },
      })
    })
  })

  // ─── updateQuestion ────────────────────────────────────────────────────────

  describe('updateQuestion', () => {
    it('patches the question and returns updated data', async () => {
      const updated = { ...baseQuestion, question: 'Updated Q?' }
      mockApiClient.patch.mockResolvedValueOnce({ data: { data: updated } })

      const payload = {
        question: 'Updated Q?',
        options: baseQuestion.options,
        correctAnswer: 'B',
        explanation: 'New explanation',
        difficulty: 'hard' as const,
      }
      const result = await questionBankService.updateQuestion('q-1', payload)

      expect(mockApiClient.patch).toHaveBeenCalledWith('/api/question-bank/q-1', payload)
      expect(result.question).toBe('Updated Q?')
    })
  })

  // ─── deleteQuestion ────────────────────────────────────────────────────────

  describe('deleteQuestion', () => {
    it('calls DELETE with the quiz id', async () => {
      mockApiClient.delete.mockResolvedValueOnce({})

      await questionBankService.deleteQuestion('q-1')

      expect(mockApiClient.delete).toHaveBeenCalledWith('/api/question-bank/q-1')
    })
  })
})

// ─── getDifficultyLabel / DIFFICULTY_LABELS ────────────────────────────────

describe('getDifficultyLabel', () => {
  it('returns correct labels for known difficulties', () => {
    expect(getDifficultyLabel('easy')).toBe(DIFFICULTY_LABELS.easy)
    expect(getDifficultyLabel('medium')).toBe(DIFFICULTY_LABELS.medium)
    expect(getDifficultyLabel('hard')).toBe(DIFFICULTY_LABELS.hard)
  })

  it('falls back to medium label for undefined difficulty', () => {
    expect(getDifficultyLabel(undefined)).toBe(DIFFICULTY_LABELS.medium)
  })

  it('DIFFICULTY_LABELS has entries for all three levels', () => {
    expect(Object.keys(DIFFICULTY_LABELS)).toEqual(['easy', 'medium', 'hard'])
  })
})
