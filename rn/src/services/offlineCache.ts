import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Flashcard, GlossaryTerm } from '@/types';

// Mobile port of web's offlineCacheService (idb-keyval → AsyncStorage): the
// study screens cache their last successful fetch, and fall back to it when
// the network is unreachable. Read-only offline — no queued mutations.
const KEYS = {
  flashcards: 'offline.flashcards',
  glossary: 'offline.glossary',
  glossaryMastered: 'offline.glossaryMastered',
  syncedAt: 'offline.syncedAt',
} as const;

async function write(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.multiSet([
      [key, JSON.stringify(value)],
      [KEYS.syncedAt, JSON.stringify(new Date().toISOString())],
    ]);
  } catch { /* storage may be unavailable (quota); cache is best-effort */ }
}

async function read<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export const offlineCache = {
  cacheFlashcards: (cards: Flashcard[]) => write(KEYS.flashcards, cards),
  getCachedFlashcards: () => read<Flashcard[]>(KEYS.flashcards, []),

  cacheGlossary: (terms: GlossaryTerm[], masteredIds: string[]) =>
    Promise.all([write(KEYS.glossary, terms), write(KEYS.glossaryMastered, masteredIds)]).then(() => {}),
  getCachedGlossary: () => read<GlossaryTerm[]>(KEYS.glossary, []),
  getCachedGlossaryMastered: () => read<string[]>(KEYS.glossaryMastered, []),

  async getLastSync(): Promise<Date | null> {
    const iso = await read<string | null>(KEYS.syncedAt, null);
    return iso ? new Date(iso) : null;
  },
};

export const formatLastSync = (date: Date | null): string => {
  if (!date || Number.isNaN(date.getTime())) return 'never';
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};
