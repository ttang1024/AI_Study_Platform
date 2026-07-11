import type { Flashcard } from '@/types';

// Backend has no "deck" concept — a deck is flashcards grouped client-side by
// source (documentId or videoId), same as web's useFlashcardSets.ts.
export interface FlashcardSet {
  key: string;
  sourceType: 'document' | 'video';
  name: string;
  count: number;
  dueCount: number;
}

const isDue = (card: Flashcard): boolean => {
  if (!card.srs) return false;
  return new Date(card.srs.due).getTime() <= Date.now();
};

export const groupFlashcardSets = (cards: Flashcard[]): FlashcardSet[] => {
  const sets = new Map<string, FlashcardSet>();
  for (const card of cards) {
    const key = card.documentId ?? card.videoId ?? 'unknown';
    const existing = sets.get(key);
    if (existing) {
      existing.count += 1;
      if (isDue(card)) existing.dueCount += 1;
      continue;
    }
    sets.set(key, {
      key,
      sourceType: card.documentId ? 'document' : 'video',
      name: card.documentName ?? card.videoName ?? 'Untitled',
      count: 1,
      dueCount: isDue(card) ? 1 : 0,
    });
  }
  return Array.from(sets.values()).sort((a, b) => a.name.localeCompare(b.name));
};

export const isCardDue = isDue;
