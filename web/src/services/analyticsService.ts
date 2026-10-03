// Service logic moved to the shared package (packages/core). This file wires the
// web HTTP adapter into the shared factory and re-exports the types, so existing
// `@/services/analyticsService` imports across web/ keep working unchanged.
import { createAnalyticsService } from '@core/services/analyticsService';
import { http } from './http';

export * from '@core/services/analyticsService';

export const analyticsService = createAnalyticsService(http);

/** Standalone export kept for existing call sites (StudyContext, dashboard widgets). */
export const invalidateDashboardSummaryCache = (): void => analyticsService.invalidateDashboardSummaryCache();
