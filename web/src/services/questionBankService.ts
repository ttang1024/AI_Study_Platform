import { apiClient } from './apiClient'

export type QuestionDifficulty = 'easy' | 'medium' | 'hard'

export interface QuestionBankQuestion {
  quizId: string
  documentId?: string
  youTubeVideoId?: string
  courseId?: string
  sourceType: 'document' | 'video'
  sourceName?: string
  courseName?: string
  courseColor?: string
  question: string
  options: string[]
  correctAnswer: string
  explanation: string
  difficulty: QuestionDifficulty
  createdAt: string
}

export interface QuestionBankFilters {
  courseId?: string
  sourceType?: 'document' | 'video'
  difficulty?: QuestionDifficulty
}

export interface UpdateQuestionBankQuestion {
  question: string
  options: string[]
  correctAnswer: string
  explanation: string
  difficulty: QuestionDifficulty
}

export const questionBankService = {
  async getQuestions(filters: QuestionBankFilters = {}): Promise<QuestionBankQuestion[]> {
    const response = await apiClient.get('/api/question-bank', { params: filters })
    return response.data.data ?? []
  },

  async updateQuestion(quizId: string, payload: UpdateQuestionBankQuestion): Promise<QuestionBankQuestion> {
    const response = await apiClient.patch(`/api/question-bank/${quizId}`, payload)
    return response.data.data
  },

  async deleteQuestion(quizId: string): Promise<void> {
    await apiClient.delete(`/api/question-bank/${quizId}`)
  },
}
