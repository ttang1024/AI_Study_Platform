import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createQuestionBankService, getDifficultyLabel } from '../questionBankService'
import type { HttpClient } from '../../http'

const fakeHttp: HttpClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}

describe('getDifficultyLabel', () => {
  it('maps each difficulty to its label', () => {
    expect(getDifficultyLabel('easy')).toBe('Beginner')
    expect(getDifficultyLabel('medium')).toBe('Intermediate')
    expect(getDifficultyLabel('hard')).toBe('Advanced')
  })

  it('defaults to the medium label when undefined', () => {
    expect(getDifficultyLabel(undefined)).toBe('Intermediate')
  })
})

describe('questionBankService', () => {
  beforeEach(() => vi.clearAllMocks())
  const service = createQuestionBankService(fakeHttp)

  it('getQuestions passes filters as query params and defaults to an empty array', async () => {
    vi.mocked(fakeHttp.get).mockResolvedValueOnce({ data: { data: undefined } })

    const result = await service.getQuestions({ courseId: 'c-1', difficulty: 'hard' })

    expect(fakeHttp.get).toHaveBeenCalledWith('/api/question-bank', { params: { courseId: 'c-1', difficulty: 'hard' } })
    expect(result).toEqual([])
  })

  it('updateQuestion patches the payload', async () => {
    const payload = { question: 'Q', options: ['A', 'B'], correctAnswer: 'A', explanation: 'E', difficulty: 'easy' as const }
    vi.mocked(fakeHttp.patch).mockResolvedValueOnce({ data: { data: { ...payload, quizId: 'q-1' } } })

    await service.updateQuestion('q-1', payload)

    expect(fakeHttp.patch).toHaveBeenCalledWith('/api/question-bank/q-1', payload)
  })

  it('deleteQuestion deletes by id', async () => {
    await service.deleteQuestion('q-1')
    expect(fakeHttp.delete).toHaveBeenCalledWith('/api/question-bank/q-1')
  })

  it('recordAttempt posts the selected answer', async () => {
    vi.mocked(fakeHttp.post).mockResolvedValueOnce({ data: { data: { isCorrect: true } } })
    const result = await service.recordAttempt('q-1', 'A')
    expect(fakeHttp.post).toHaveBeenCalledWith('/api/question-bank/q-1/attempt', { selectedAnswer: 'A' })
    expect(result).toEqual({ isCorrect: true })
  })
})
