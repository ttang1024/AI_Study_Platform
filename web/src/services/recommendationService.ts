import { apiClient } from './apiClient';

export type RecommendationType = 'flashcards' | 'quiz' | 'glossary' | 'problems' | 'material' | 'course';

export interface RecommendationItem {
  id: string;
  type: RecommendationType;
  title: string;
  reason: string;
  priority: number;
  url: string | null;
  courseId: string | null;
  courseName: string | null;
  count: number | null;
}

export interface Recommendations {
  reviewQueue: RecommendationItem[];
  nextBestContent: RecommendationItem[];
  generatedAt: string;
}

export const recommendationService = {
  async getRecommendations(): Promise<Recommendations> {
    const response = await apiClient.get('/api/recommendations');
    return response.data.data;
  },
};
