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

export const flashcardService = {
  async getAllFlashcards(page = 1, pageSize = 20): Promise<PagedFlashcards> {
    const response = await apiClient.get(`/api/flashcards?page=${page}&pageSize=${pageSize}`)
    const d = response.data.data
    return {
      items: (d.items as BackendFlashcard[]).map(mapFlashcard),
      totalCount: d.totalCount,
      page: d.page,
      pageSize: d.pageSize,
      totalPages: d.totalPages,
    }
  },

  async getCoverage(): Promise<FlashcardCoverage> {
    const response = await apiClient.get('/api/flashcards/coverage');
    const d = response.data.data;
    return {
      documentIds: d.documentIds ?? [],
      youTubeVideoIds: d.youTubeVideoIds ?? [],
    };
  },

  async getPendingMaterials(): Promise<PendingMaterial[]> {
    const response = await apiClient.get('/api/flashcards/pending-materials');
    return response.data.data ?? [];
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
