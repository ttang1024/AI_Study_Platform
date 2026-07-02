import { useCallback, useEffect, useState } from 'react';
import { masteredService } from '../services/masteredService';

/** Mastered glossary-term ids with optimistic toggle and server sync. */
export const useMasteredTerms = (userId: string) => {
  const [masteredIds, setMasteredIds] = useState<Set<string>>(() => masteredService.getCached(userId));

  // Sync mastered IDs from server on mount
  useEffect(() => {
    if (userId === 'guest') return;
    masteredService.loadFromServer(userId).then(setMasteredIds).catch(() => { });
  }, [userId]);

  const toggleMastered = useCallback((id: string) => {
    // Optimistic update
    setMasteredIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      masteredService.updateCache(userId, next);
      return next;
    });
    // Sync to server
    masteredService.toggle(userId, id).catch(() => {
      // Revert on failure
      setMasteredIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        masteredService.updateCache(userId, next);
        return next;
      });
    });
  }, [userId]);

  return { masteredIds, toggleMastered };
};
