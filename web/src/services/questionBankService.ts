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

const TAG_STORAGE_KEY = 'sp_question_bank_tags'

type TagMap = Record<string, string[]>

const readTags = (): TagMap => {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem(TAG_STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

const writeTags = (tags: TagMap) => {
  if (typeof window === 'undefined') return
  localStorage.setItem(TAG_STORAGE_KEY, JSON.stringify(tags))
}

export const questionBankTagService = {
  getAll(): TagMap {
    return readTags()
  },

  setTags(questionId: string, tags: string[]): TagMap {
    const map = readTags()
    map[questionId] = Array.from(new Set(tags.map(t => t.trim()).filter(Boolean))).slice(0, 8)
    writeTags(map)
    return map
  },

  removeQuestion(questionId: string): TagMap {
    const map = readTags()
    delete map[questionId]
    writeTags(map)
    return map
  },
}
