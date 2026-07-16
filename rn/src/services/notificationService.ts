// Service logic moved to the shared package (packages/core): the weekly digest
// is the same endpoint web exposes via gamificationService. This file wires the
// RN HTTP adapter into the shared factory, so existing imports keep working.
import { createGamificationService } from '@core/services/gamificationService';
import { http } from '@/services/http';

const core = createGamificationService(http);

export const notificationService = {
  getWeeklyDigest: core.getWeeklyDigest,
};
