// Service logic moved to the shared package (packages/core). This file wires the
// RN HTTP adapter into the shared factories and re-exports the types.
import { createRecommendationService } from '@core/services/recommendationService';
import { createTodayService } from '@core/services/todayService';
import { http } from '@/services/http';

export * from '@core/services/recommendationService';
export * from '@core/services/todayService';

export const recommendationService = {
  // `reviewQueue` is deliberately unused by callers — it's already folded into getTodayPlan().
  // Only `nextBestContent` (course/material suggestions) is new in getRecommendations().
  ...createRecommendationService(http),
  // Same endpoint web reaches through its own todayService; kept on this object so existing
  // `recommendationService.getTodayPlan()` call sites are unchanged.
  ...createTodayService(http),
};
