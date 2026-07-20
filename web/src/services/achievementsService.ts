// The achievement catalog moved to the shared package (@core/achievements) —
// it was duplicated in rn/. Web keeps this localStorage layer on top: unlocked-ness
// is derivable from live stats (every condition is monotonic), but persisting the
// unlocked set is how *newly* unlocked achievements are detected for the toast.
import { ACHIEVEMENTS, type Achievement, type AchievementProgress } from '@core/achievements';
export { ACHIEVEMENTS } from '@core/achievements';
export type { Achievement, AchievementProgress } from '@core/achievements';

const STORAGE_KEY = (userId: string) => `achievements_${userId}`;

export const achievementsService = {
  getUnlocked(userId: string): string[] {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY(userId)) || '[]'); }
    catch { return []; }
  },

  unlock(userId: string, achievementId: string): void {
    const current = achievementsService.getUnlocked(userId);
    if (!current.includes(achievementId)) {
      localStorage.setItem(STORAGE_KEY(userId), JSON.stringify([...current, achievementId]));
    }
  },

  checkAndUnlock(userId: string, stats: AchievementProgress): Achievement[] {
    const already = new Set(achievementsService.getUnlocked(userId));
    const newlyUnlocked: Achievement[] = [];
    for (const a of ACHIEVEMENTS) {
      if (!already.has(a.id) && a.condition(stats)) {
        achievementsService.unlock(userId, a.id);
        newlyUnlocked.push(a);
      }
    }
    return newlyUnlocked;
  },

  getAll(userId: string): (Achievement & { unlocked: boolean })[] {
    const unlocked = new Set(achievementsService.getUnlocked(userId));
    return ACHIEVEMENTS.map(a => ({ ...a, unlocked: unlocked.has(a.id) }));
  },
};
