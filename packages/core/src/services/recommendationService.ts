import type { HttpClient } from '../http';

export type RecommendationType = 'flashcards' | 'quiz' | 'glossary' | 'problems' | 'material' | 'course';

export interface RecommendationItem {
  id: string;
  type: RecommendationType;
  title: string;
  reason: string;
  priority: number;
  url?: string | null;
  courseId?: string | null;
  courseName?: string | null;
  count?: number | null;
}

export interface Recommendations {
  reviewQueue: RecommendationItem[];
  nextBestContent: RecommendationItem[];
  generatedAt: string;
}

export function createRecommendationService(http: HttpClient) {
  return {
    async getRecommendations(): Promise<Recommendations> {
      const res = await http.get<{ data: Recommendations }>('/api/recommendations');
      return res.data.data;
    },
  };
}

export type RecommendationService = ReturnType<typeof createRecommendationService>;
