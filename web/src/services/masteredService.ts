// Server calls moved to the shared package (packages/core, glossaryService);
// the per-user localStorage cache layered on top is web-only and stays here.
import { createGlossaryService } from '@core/services/glossaryService';
import { http } from './http';

const core = createGlossaryService(http);

const CACHE_KEY = (userId: string) => `glossary_mastered_${userId}`;

export const masteredService = {
  /** Load mastered term IDs from the server and update the local cache. */
  async loadFromServer(userId: string): Promise<Set<string>> {
    try {
      const ids = new Set(await core.getMasteredIds());
      localStorage.setItem(CACHE_KEY(userId), JSON.stringify([...ids]));
      return ids;
    } catch {
      // Fall back to cached data
      return loadCached(userId);
    }
  },

  /** Toggle mastery on the server and return the new mastered state. */
  async toggle(userId: string, termId: string): Promise<boolean> {
    return core.toggleMastered(termId);
  },

  getCached(userId: string): Set<string> {
    return loadCached(userId);
  },

  updateCache(userId: string, ids: Set<string>): void {
    localStorage.setItem(CACHE_KEY(userId), JSON.stringify([...ids]));
  },
};

function loadCached(userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(CACHE_KEY(userId));
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch { /* ignore */ }
  return new Set();
}
