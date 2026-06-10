import { apiClient } from './apiClient'

export interface XpBreakdown {
  source: string
  label: string
  xp: number
}

export interface UserXp {
  totalXp: number
  level: number
  xpIntoLevel: number
  xpForNextLevel: number
  levelProgress: number
  breakdown: XpBreakdown[]
}

export interface DigestDay {
  date: string
  minutes: number
}

export interface WeeklyDigest {
  from: string
  to: string
  studyMinutes: number
  activeDays: number
  dailyMinutes: DigestDay[]
  flashcardReviews: number
  quizzesTaken: number
  quizAccuracy: number
  newMaterials: number
  mistakesResolved: number
  openMistakes: number
  currentStreak: number
  weeklyXp: number
  topGapConcept?: string
  topGapReason?: string
  headline: string
}

export const gamificationService = {
  async getXp(): Promise<UserXp> {
    const res = await apiClient.get('/api/stats/xp')
    return res.data.data
  },

  async getWeeklyDigest(): Promise<WeeklyDigest> {
    const res = await apiClient.get('/api/notifications/weekly-digest')
    return res.data.data
  },

  async downloadCalendarIcs(): Promise<Blob> {
    const res = await apiClient.get('/api/calendar/ics', { responseType: 'blob' })
    return res.data
  },
}
