import { apiClient } from '@/services/apiClient';
import type { TodayPlan } from '@/types';

export interface RecommendationItem {
  id: string;
  type: 'flashcards' | 'quiz' | 'glossary' | 'problems' | 'material' | 'course';
  title: string;
  reason: string;
  priority: number;
  url?: string;
  courseId?: string;
  courseName?: string;
  count?: number;
}

export interface Recommendations {
  reviewQueue: RecommendationItem[];
  nextBestContent: RecommendationItem[];
  generatedAt: string;
}

export const recommendationService = {
  async getTodayPlan(): Promise<TodayPlan> {
    const response = await apiClient.get('/api/recommendations/today');
    return response.data.data as TodayPlan;
  },

  // `reviewQueue` is deliberately unused by callers — it's already folded into getTodayPlan().
  // Only `nextBestContent` (course/material suggestions) is new here.
  async getRecommendations(): Promise<Recommendations> {
    const response = await apiClient.get('/api/recommendations');
    return response.data.data as Recommendations;
  },
};
