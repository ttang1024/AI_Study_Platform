import { apiClient } from './apiClient';
import { Flashcard } from '../types';
import { PendingMaterial } from './pendingMaterialService';

interface BackendFlashcard {
  flashcardId: string;
  front: string;
  back: string;
  documentId?: string;
  youTubeVideoId?: string;
  document?: string;
  video?: string;
  title?: string;
}

const mapFlashcard = (bf: BackendFlashcard): Flashcard => ({
  id: bf.flashcardId,
  front: bf.front,
  back: bf.back,
  documentId: bf.documentId || '',
  youTubeVideoId: bf.youTubeVideoId ?? undefined,
  documentName: bf.document ?? bf.title ?? undefined,
  videoName: bf.video ?? undefined,
  difficulty: 'medium',
});

export interface PagedFlashcards {
  items: Flashcard[]
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
}

export interface FlashcardCoverage {
  documentIds: string[]
  youTubeVideoIds: string[]
}

const inflightRequests = new Map<string, Promise<unknown>>();

export const flashcardService = {
  async getAllFlashcards(page = 1, pageSize = 20): Promise<PagedFlashcards> {
    const url = `/api/flashcards?page=${page}&pageSize=${pageSize}`;
    const pending = inflightRequests.get(url) as Promise<PagedFlashcards> | undefined;
    if (pending) return pending;

    const request = apiClient.get(url)
      .then(response => {
        const d = response.data.data
        return {
          items: (d.items as BackendFlashcard[]).map(mapFlashcard),
          totalCount: d.totalCount,
          page: d.page,
          pageSize: d.pageSize,
          totalPages: d.totalPages,
        }
      })
      .finally(() => inflightRequests.delete(url));

    inflightRequests.set(url, request);
    return request;
  },

  async getCoverage(): Promise<FlashcardCoverage> {
    const url = '/api/flashcards/coverage';
    const pending = inflightRequests.get(url) as Promise<FlashcardCoverage> | undefined;
    if (pending) return pending;

    const request = apiClient.get(url)
      .then(response => {
        const d = response.data.data;
        return {
          documentIds: d.documentIds ?? [],
          youTubeVideoIds: d.youTubeVideoIds ?? [],
        };
      })
      .finally(() => inflightRequests.delete(url));

    inflightRequests.set(url, request);
    return request;
  },

  async getPendingMaterials(): Promise<PendingMaterial[]> {
    const url = '/api/flashcards/pending-materials';
    const pending = inflightRequests.get(url) as Promise<PendingMaterial[]> | undefined;
    if (pending) return pending;

    const request = apiClient.get(url)
      .then(response => response.data.data ?? [])
      .finally(() => inflightRequests.delete(url));

    inflightRequests.set(url, request);
    return request;
  },

  async createFlashcard(data: { front: string; back: string; documentId?: string }): Promise<Flashcard> {
    const response = await apiClient.post('/api/flashcards', data);
    return mapFlashcard(response.data.data);
  },

  async deleteFlashcard(flashcardId: string): Promise<void> {
    await apiClient.delete(`/api/flashcards/${flashcardId}`);
  },

  async deleteFlashcardsBulk(flashcardIds: string[]): Promise<void> {
    await apiClient.delete('/api/flashcards/bulk', { data: { flashcardIds } });
  },
};
