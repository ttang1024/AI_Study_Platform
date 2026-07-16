import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { libraryService, type LibraryEntry, type LibraryFilterType } from '@/services/libraryService';

/**
 * Loads every library entry of a type for reactive client-side duplicate
 * detection of pasted links in the summarizer. Mirrors web, where the summarizer
 * tabs match a pasted URL against the already-loaded StudyContext collections.
 *
 * Re-fetches every time the screen regains focus: after analyzing a link the app
 * navigates away and back, but the (still-mounted) form would otherwise keep a
 * stale list that omits the just-added entry — letting the same link be analyzed
 * again with no duplicate banner.
 */
export function useLibraryEntries(type: LibraryFilterType): LibraryEntry[] {
  const [entries, setEntries] = useState<LibraryEntry[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      libraryService
        .getAllByType(type)
        .then((items) => {
          if (!cancelled) setEntries(items);
        })
        .catch(() => {
          // Duplicate detection is best-effort — a failed load just means no hint.
        });
      return () => {
        cancelled = true;
      };
    }, [type]),
  );

  return entries;
}
