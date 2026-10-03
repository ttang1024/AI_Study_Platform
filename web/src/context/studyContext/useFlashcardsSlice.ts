import { useCallback, useRef, useState } from 'react';
import { Document, Flashcard } from '../../types';
import { flashcardService } from '../../services/flashcardService';
import { offlineCacheService, isOffline } from '../../services/offlineCacheService';
import { fetchAllSize } from './helpers';

interface UseFlashcardsSliceArgs {
  isAuthenticated: boolean;
  isLoading: boolean;
  totalFlashcards: number;
  currentDocument: Document | null;
}

/** The full flashcard deck — lazy load-once, offline-cached, plus per-document creation. */
export function useFlashcardsSlice({ isAuthenticated, isLoading, totalFlashcards, currentDocument }: UseFlashcardsSliceArgs) {
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const statusRef = useRef<'idle' | 'loading' | 'loaded'>('idle');

  const refreshFlashcards = useCallback(async (): Promise<void> => {
    try {
      const result = await flashcardService.getAllFlashcards(1, fetchAllSize(totalFlashcards));
      setFlashcards(result.items);
      statusRef.current = 'loaded';
    } catch (error) {
      console.error('Failed to refresh flashcards:', error);
    }
  }, [totalFlashcards]);

  // Lazy load-once for the full flashcard deck — fetched the first time a page that renders it
  // mounts, instead of eagerly on login. Waits for stats so it's sized to the real deck size;
  // resets to 'idle' on error so a later mount can retry.
  const ensureFlashcards = useCallback(async (): Promise<void> => {
    if (!isAuthenticated || isLoading) return;
    if (statusRef.current !== 'idle') return;
    statusRef.current = 'loading';
    try {
      const result = await flashcardService.getAllFlashcards(1, fetchAllSize(totalFlashcards));
      if (result.items.length > 0) {
        setFlashcards(result.items);
        void offlineCacheService.cacheFlashcards(result.items);
      } else if (isOffline()) {
        // Offline with no fresh data — fall back to the last cached deck.
        setFlashcards(await offlineCacheService.getCachedFlashcards());
      } else {
        setFlashcards(result.items);
      }
      statusRef.current = 'loaded';
    } catch (error) {
      console.error('Failed to load flashcards:', error);
      statusRef.current = 'idle';
    }
  }, [isAuthenticated, isLoading, totalFlashcards]);

  const addFlashcard = async (front: string, back: string): Promise<void> => {
    if (!currentDocument) return;
    const newCard = await flashcardService.createFlashcard({
      front,
      back,
      documentId: currentDocument.id,
    });
    setFlashcards((prev) => [...prev, { ...newCard, documentId: currentDocument.id }]);
  };

  const markIdle = useCallback(() => { statusRef.current = 'idle'; }, []);

  return { flashcards, setFlashcards, refreshFlashcards, ensureFlashcards, addFlashcard, markIdle };
}
