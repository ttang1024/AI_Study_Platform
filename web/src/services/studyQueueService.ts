import { apiClient } from './apiClient'

export type DailyStudyQueueItemType = 'glossary' | 'quiz' | 'workedProblem' | 'flashcards'
export type WeaknessReviewItemType = 'flashcard' | 'quiz' | 'glossary' | 'tutorConcept'

export interface DailyStudyQueueItem {
  id: string
  type: DailyStudyQueueItemType
  title: string
  description: string
  sourceName?: string
  courseName?: string
  courseColor?: string
  actionUrl: string
  priority: number
  estimatedMinutes: number
  count: number
  reason: string
}

export interface DailyStudyQueue {
  generatedAt: string
  totalTasks: number
  estimatedMinutes: number
  items: DailyStudyQueueItem[]
}

export interface WeaknessReviewSource {
  name?: string | null
  courseName?: string | null
  courseColor?: string | null
  actionUrl: string
}

export interface WeaknessReviewItem {
  id: string
  type: WeaknessReviewItemType
  title: string
  prompt: string
  answer?: string | null
  reason: string
  priority: number
  estimatedMinutes: number
  source: WeaknessReviewSource
  userAnswer?: string | null
  attempts: number
}

export interface WeaknessReviewSection {
  type: string
  title: string
  description: string
  estimatedMinutes: number
  items: WeaknessReviewItem[]
}

export interface WeaknessReviewQueue {
  generatedAt: string
  totalItems: number
  estimatedMinutes: number
  sections: WeaknessReviewSection[]
}

export const studyQueueService = {
  async getDailyQueue(limit = 8): Promise<DailyStudyQueue> {
    const response = await apiClient.get('/api/study-queue/daily', { params: { limit } })
    const data = response.data.data
    return {
      generatedAt: data.generatedAt,
      totalTasks: data.totalTasks ?? 0,
      estimatedMinutes: data.estimatedMinutes ?? 0,
      items: data.items ?? [],
    }
  },

  async getWeaknessReviewQueue(limitPerSection = 8): Promise<WeaknessReviewQueue> {
    const response = await apiClient.get('/api/study-queue/weakness-review', { params: { limitPerSection } })
    const data = response.data.data
    return {
      generatedAt: data.generatedAt,
      totalItems: data.totalItems ?? 0,
      estimatedMinutes: data.estimatedMinutes ?? 0,
      sections: data.sections ?? [],
    }
  },
}
