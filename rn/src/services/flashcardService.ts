// Service logic moved to the shared package (packages/core). This file wires the
// RN HTTP adapter into the shared factory and keeps rn's historical method names
// (list/getSrs/review/classify) as thin wrappers, so existing call sites are
// unchanged. The card mapper now lives in core (mapBackendFlashcard).
import { createFlashcardService } from '@core/services/flashcardService';
import { http } from '@/services/http';
import type { FlashcardSrsState } from '@/types';

export * from '@core/services/flashcardService';

const coreService = createFlashcardService(http);

export const flashcardService = {
  ...coreService,

  /** rn's historical list name; defaults to one large page since rn loads the whole deck. */
  list: (page = 1, pageSize = 200) => coreService.getAllFlashcards(page, pageSize),

  async getSrs(): Promise<FlashcardSrsState[]> {
    return Array.from((await coreService.getSrsStates()).values());
  },

  review: coreService.reviewFlashcard,

  classify: coreService.classifyFlashcard,
};
