import { apiClient } from '@/services/apiClient';
import type { Flashcard, FlashcardSrsState, FsrsRating, PendingMaterial } from '@/types';

interface BackendFlashcard {
  flashcardId: string;
  documentId?: string;
  videoId?: string;
  sourceType: string;
  front: string;
  back: string;
  createdAt: string;
  title?: string;
  document?: string;
  video?: string;
  srs?: FlashcardSrsState;
  cardType: 'basic' | 'cloze' | 'chart';
  difficulty: 'easy' | 'medium' | 'hard';
  chapter?: string;
  tags?: string[];
}

interface PaginatedFlashcards {
  items: BackendFlashcard[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PagedFlashcards {
  items: Flashcard[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const mapFlashcard = (bf: BackendFlashcard): Flashcard => ({
  id: bf.flashcardId,
  documentId: bf.documentId,
  videoId: bf.videoId,
  documentName: bf.sourceType === 'document' ? bf.document : undefined,
  videoName: bf.sourceType === 'video' ? bf.video : undefined,
  front: bf.front,
  back: bf.back,
  cardType: bf.cardType ?? 'basic',
  difficulty: bf.difficulty ?? 'medium',
  chapter: bf.chapter,
  tags: bf.tags ?? [],
  createdAt: bf.createdAt,
  srs: bf.srs,
});

export interface ClassifyFlashcardPatch {
  front?: string;
  back?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  chapter?: string;
  tags?: string[];
}

export const flashcardService = {
  async list(page = 1, pageSize = 200): Promise<PagedFlashcards> {
    const response = await apiClient.get(`/api/flashcards?page=${page}&pageSize=${pageSize}`);
    const data = response.data.data as PaginatedFlashcards;
    return {
      items: data.items.map(mapFlashcard),
      totalCount: data.totalCount,
      page: data.page,
      pageSize: data.pageSize,
      totalPages: data.totalPages,
    };
  },

  async getSrs(): Promise<FlashcardSrsState[]> {
    const response = await apiClient.get('/api/flashcards/srs');
    return response.data.data as FlashcardSrsState[];
  },

  async getCoverage(): Promise<{ documentIds: string[]; videoIds: string[] }> {
    const response = await apiClient.get('/api/flashcards/coverage');
    return response.data.data;
  },

  async getPendingMaterials(): Promise<PendingMaterial[]> {
    const response = await apiClient.get('/api/flashcards/pending-materials');
    return response.data.data as PendingMaterial[];
  },

  async review(flashcardId: string, rating: FsrsRating): Promise<{ scheduledDays: number; retrievability: number; srs: FlashcardSrsState }> {
    const response = await apiClient.post(`/api/flashcards/${flashcardId}/review`, { rating });
    return response.data.data;
  },

  async classify(flashcardId: string, patch: ClassifyFlashcardPatch): Promise<Flashcard> {
    const response = await apiClient.patch(`/api/flashcards/${flashcardId}/classify`, patch);
    return mapFlashcard(response.data.data);
  },

  async importFlashcards(
    rows: { front: string; back: string; cardType?: string; tags?: string[] }[],
  ): Promise<{ importedCount: number; skippedCount: number }> {
    const response = await apiClient.post('/api/flashcards/import', { rows });
    return response.data.data;
  },
};
