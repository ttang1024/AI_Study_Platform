// Service logic moved to the shared package (packages/core). This file wires the
// RN HTTP adapter into the shared factory, so existing imports keep working.
import { createStatsService } from '@core/services/statsService';
import { http } from '@/services/http';

export * from '@core/services/statsService';

export const statsService = createStatsService(http);
