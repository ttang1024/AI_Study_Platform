// Service logic moved to the shared package (packages/core). This file wires the
// web HTTP adapter into the shared factory and re-exports the types, so existing
// `@/services/recommendationService` imports across web/ keep working unchanged.
import { createRecommendationService } from '@core/services/recommendationService';
import { http } from './http';

export * from '@core/services/recommendationService';

export const recommendationService = createRecommendationService(http);
