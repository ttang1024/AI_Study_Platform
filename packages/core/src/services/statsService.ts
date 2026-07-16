import type { HttpClient } from '../http';

export interface UserStats {
  totalDocuments: number;
  totalArticles: number;
  totalAudio: number;
  totalMaterials: number;
  totalNotes: number;
  totalFlashcards: number;
  totalGlossaryTerms: number;
  totalQuizQuestions: number;
  totalQuizSubmissions: number;
  totalVideos: number;
  courseMaterialCounts: CourseMaterialStats[];
  achievements: AchievementStats;
}

export interface CourseMaterialStats {
  courseId: string;
  documents: number;
  articles: number;
  audio: number;
  videos: number;
  total: number;
}

export interface AchievementStats {
  perfectQuizzes: number;
  averageQuizScore: number;
  flashcardsMastered: number;
}

export interface UserXp {
  totalXp: number;
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  levelProgress: number;
  breakdown: { source: string; label: string; xp: number }[];
}

export function createStatsService(http: HttpClient) {
  // Collapses the identical concurrent fetches fired on dashboard mount.
  let inflightUserStatsRequest: Promise<UserStats> | null = null;

  return {
    async getUserStats(): Promise<UserStats> {
      if (inflightUserStatsRequest) return inflightUserStatsRequest;

      inflightUserStatsRequest = http
        .get<{ data: UserStats }>('/api/stats')
        .then(response => {
          const d = response.data.data;
          return {
            totalDocuments: d.totalDocuments,
            totalArticles: d.totalArticles,
            totalAudio: d.totalAudio,
            totalMaterials: d.totalMaterials,
            totalNotes: d.totalNotes,
            totalFlashcards: d.totalFlashcards,
            totalGlossaryTerms: d.totalGlossaryTerms ?? 0,
            totalQuizQuestions: d.totalQuizQuestions ?? 0,
            totalQuizSubmissions: d.totalQuizSubmissions,
            totalVideos: d.totalVideos,
            courseMaterialCounts: d.courseMaterialCounts ?? [],
            achievements: d.achievements ?? {
              perfectQuizzes: 0,
              averageQuizScore: 0,
              flashcardsMastered: 0,
            },
          };
        })
        .finally(() => {
          inflightUserStatsRequest = null;
        });

      return inflightUserStatsRequest;
    },

    /** XP/level summary. web surfaces this via gamificationService, rn via statsService. */
    async getXp(): Promise<UserXp> {
      const response = await http.get<{ data: UserXp }>('/api/stats/xp');
      return response.data.data;
    },
  };
}

export type StatsService = ReturnType<typeof createStatsService>;
