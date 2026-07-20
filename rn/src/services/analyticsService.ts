// Service logic moved to the shared package (packages/core). This file wires the
// RN HTTP adapter into the shared factory and re-exports the types, so existing
// `@/services/analyticsService` imports across rn/ keep working unchanged.
// (`DailyQuizAccuracy` is core's rn-compat alias of `QuizAccuracyData`; range
// params are ISO strings now — call sites pass `date.toISOString()`.)
import { createAnalyticsService } from '@core/services/analyticsService';
import { http } from '@/services/http';

export * from '@core/services/analyticsService';

export const analyticsService = createAnalyticsService(http);
