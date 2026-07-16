// Service logic moved to the shared package (packages/core). This file wires the
// RN HTTP adapter into the shared factory and re-exports the types. getTodayPlan
// stays RN-only: TodayPlan is an RN-specific type with no web counterpart.
import { createRecommendationService } from '@core/services/recommendationService';
import { apiClient } from '@/services/apiClient';
import { http } from '@/services/http';
import type { TodayPlan } from '@/types';

export * from '@core/services/recommendationService';

export const recommendationService = {
  // `reviewQueue` is deliberately unused by callers — it's already folded into getTodayPlan().
  // Only `nextBestContent` (course/material suggestions) is new in getRecommendations().
  ...createRecommendationService(http),

  async getTodayPlan(): Promise<TodayPlan> {
    const response = await apiClient.get('/api/recommendations/today');
    return response.data.data as TodayPlan;
  },
};
