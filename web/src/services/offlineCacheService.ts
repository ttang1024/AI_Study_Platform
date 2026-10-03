import { get, set, createStore } from 'idb-keyval';
import type { Flashcard, GlossaryTerm, Note } from '../types';

// Dedicated IndexedDB store so offline study data is isolated from other app caches.
const store = createStore('study-offline', 'cache');

const KEYS = {
  flashcards: 'flashcards',
  glossary: 'glossary',
  notes: 'notes',
  syncedAt: 'syncedAt',
} as const;

export const isOffline = (): boolean =>
  typeof navigator !== 'undefined' && 'onLine' in navigator && !navigator.onLine;

export const offlineCacheService = {
  async cacheFlashcards(flashcards: Flashcard[]): Promise<void> {
    try {
      await set(KEYS.flashcards, flashcards, store);
      await set(KEYS.syncedAt, new Date().toISOString(), store);
    } catch { /* storage may be unavailable (private mode, quota) */ }
  },

  async getCachedFlashcards(): Promise<Flashcard[]> {
    try {
      return (await get<Flashcard[]>(KEYS.flashcards, store)) ?? [];
    } catch {
      return [];
    }
  },

  async cacheGlossary(terms: GlossaryTerm[]): Promise<void> {
    try {
      await set(KEYS.glossary, terms, store);
      await set(KEYS.syncedAt, new Date().toISOString(), store);
    } catch { /* ignore */ }
  },

  async getCachedGlossary(): Promise<GlossaryTerm[]> {
    try {
      return (await get<GlossaryTerm[]>(KEYS.glossary, store)) ?? [];
    } catch {
      return [];
    }
  },

  async cacheNotes(notes: Note[]): Promise<void> {
    try {
      await set(KEYS.notes, notes, store);
      await set(KEYS.syncedAt, new Date().toISOString(), store);
    } catch { /* ignore */ }
  },

  async getCachedNotes(): Promise<Note[]> {
    try {
      return (await get<Note[]>(KEYS.notes, store)) ?? [];
    } catch {
      return [];
    }
  },

  async getLastSync(): Promise<Date | null> {
    try {
      const iso = await get<string>(KEYS.syncedAt, store);
      return iso ? new Date(iso) : null;
    } catch {
      return null;
    }
  },
};
