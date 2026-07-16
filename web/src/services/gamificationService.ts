// Service logic moved to the shared package (packages/core). XP lives in the
// shared statsService, the digest/ICS calls in the shared gamificationService;
// this shim recombines them to keep web's historical surface.
import { createGamificationService } from '@core/services/gamificationService';
import { createStatsService } from '@core/services/statsService';
import { http } from './http';

export type { DigestDay, WeeklyDigest } from '@core/services/gamificationService';
export type { UserXp } from '@core/services/statsService';

export type XpBreakdown = import('@core/services/statsService').UserXp['breakdown'][number];

const core = createGamificationService(http);
const stats = createStatsService(http);

export const gamificationService = {
  getXp: stats.getXp,
  getWeeklyDigest: core.getWeeklyDigest,
  downloadCalendarIcs: core.downloadCalendarIcs,
};
