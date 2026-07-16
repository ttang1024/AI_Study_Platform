import type { HttpClient } from '../http';

export interface DigestDay {
  date: string;
  minutes: number;
}

export interface WeeklyDigest {
  from: string;
  to: string;
  studyMinutes: number;
  activeDays: number;
  dailyMinutes: DigestDay[];
  flashcardReviews: number;
  quizzesTaken: number;
  quizAccuracy: number;
  newMaterials: number;
  mistakesResolved: number;
  openMistakes: number;
  currentStreak: number;
  weeklyXp: number;
  topGapConcept?: string;
  topGapReason?: string;
  headline: string;
}

// XP lives in statsService (createStatsService(http).getXp); web's
// gamificationService shim recombines the two to keep its historical surface.
export function createGamificationService(http: HttpClient) {
  return {
    async getWeeklyDigest(): Promise<WeeklyDigest> {
      const res = await http.get<{ data: WeeklyDigest }>('/api/notifications/weekly-digest');
      return res.data.data;
    },

    async downloadCalendarIcs(): Promise<Blob> {
      const res = await http.get<Blob>('/api/calendar/ics', { responseType: 'blob' });
      return res.data;
    },
  };
}

export type GamificationService = ReturnType<typeof createGamificationService>;
