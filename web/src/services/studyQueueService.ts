import { apiClient } from './apiClient'

export type DailyStudyQueueItemType = 'glossary' | 'quiz' | 'workedProblem' | 'flashcards'

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
}
