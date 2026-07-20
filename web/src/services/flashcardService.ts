// Service logic moved to the shared package (packages/core). This file wires the
// web HTTP adapter into the shared factory and re-exports the types. Only
// createOcclusionCard stays web-local: it uploads a browser `File` via FormData.
import { createFlashcardService, mapBackendFlashcard, type BackendFlashcard } from '@core/services/flashcardService';
import { apiClient } from './apiClient';
import { http } from './http';
import { Flashcard, OcclusionRect } from '../types';

export * from '@core/services/flashcardService';

const coreService = createFlashcardService(http);

/** Standalone export kept for existing call sites (StudyContext auth reset, mutations). */
export const invalidateFlashcardListCache = (): void => coreService.invalidateFlashcardListCache();

export const flashcardService = {
  ...coreService,

  /** Create an image-occlusion card: image file + normalized mask rects. */
  async createOcclusionCard(data: {
    image: File;
    occlusions: OcclusionRect[];
    front?: string;
    back?: string;
    documentId?: string;
  }): Promise<Flashcard> {
    const form = new FormData();
    form.append('image', data.image);
    form.append('occlusions', JSON.stringify(data.occlusions));
    if (data.front) form.append('front', data.front);
    if (data.back) form.append('back', data.back);
    if (data.documentId) form.append('documentId', data.documentId);
    const response = await apiClient.post('/api/flashcards/occlusion', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    coreService.invalidateFlashcardListCache();
    return mapBackendFlashcard(response.data.data as BackendFlashcard);
  },
};
