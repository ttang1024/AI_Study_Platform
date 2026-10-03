import type { HttpClient } from '../http';
import { createRequestCache } from '../requestCache';

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
}

export interface CourseMaterialStats {
  courseId: string;
  documents: number;
  articles: number;
  audio: number;
  videos: number;
  total: number;
}

export function createStatsService(http: HttpClient) {
  // Collapses the identical concurrent fetches fired on dashboard mount.
  const statsRequests = createRequestCache<UserStats>();

  return {
    getUserStats(): Promise<UserStats> {
      const url = '/api/stats';
      return statsRequests.get(url, () =>
        http.get<{ data: UserStats }>(url).then(response => {
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
          };
        }),
      );
    },
  };
}

