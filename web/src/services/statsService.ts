import { apiClient } from './apiClient'

export interface UserStats {
  totalDocuments: number
  totalArticles: number
  totalAudio: number
  totalMaterials: number
  totalNotes: number
  totalFlashcards: number
  totalGlossaryTerms: number
  totalQuizSubmissions: number
  totalVideos: number
  courseMaterialCounts: CourseMaterialStats[]
  achievements: AchievementStats
}

export interface CourseMaterialStats {
  courseId: string
  documents: number
  articles: number
  audio: number
  videos: number
  total: number
}

export interface AchievementStats {
  perfectQuizzes: number
  averageQuizScore: number
  flashcardsMastered: number
}

export const statsService = {
  async getUserStats(): Promise<UserStats> {
    const response = await apiClient.get('/api/stats')
    const d = response.data.data
    return {
      totalDocuments: d.totalDocuments,
      totalArticles: d.totalArticles,
      totalAudio: d.totalAudio,
      totalMaterials: d.totalMaterials,
      totalNotes: d.totalNotes,
      totalFlashcards: d.totalFlashcards,
      totalGlossaryTerms: d.totalGlossaryTerms ?? 0,
      totalQuizSubmissions: d.totalQuizSubmissions,
      totalVideos: d.totalVideos,
      courseMaterialCounts: d.courseMaterialCounts ?? [],
      achievements: d.achievements ?? { perfectQuizzes: 0, averageQuizScore: 0, flashcardsMastered: 0 },
    }
  },
}
