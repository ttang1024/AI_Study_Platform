// Service logic moved to the shared package (packages/core). This file wires the
// web HTTP adapter into the shared factory, so existing imports keep working.
// (getXp is also exposed here for parity with rn; web's gamificationService
// remains the usual web entry point for XP.)
import { createStatsService } from '@core/services/statsService';
import { http } from './http';

export * from '@core/services/statsService';

export const statsService = createStatsService(http);
