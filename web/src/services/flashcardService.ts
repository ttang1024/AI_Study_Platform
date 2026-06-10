import { apiClient } from './apiClient';
import { Flashcard, FlashcardSrsState } from '../types';
import { PendingMaterial } from './pendingMaterialService';

interface BackendSrs {
  state: 0 | 1 | 2 | 3;
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  due: string;
  lastReview?: string;
  retrievability: number;
}

interface BackendFlashcard {
  flashcardId: string;
  front: string;
  back: string;
  cardType?: string;
  difficulty?: string;
  chapter?: string;
  tags?: string[];
  documentId?: string;
  youTubeVideoId?: string;
  document?: string;
  video?: string;
  title?: string;
  srs?: BackendSrs;
}

const mapSrs = (s: BackendSrs): FlashcardSrsState => ({
  state: s.state,
  stability: s.stability,
  difficulty: s.difficulty,
  reps: s.reps,
  lapses: s.lapses,
  due: s.due,
  lastReview: s.lastReview,
  retrievability: s.retrievability,
});

const mapFlashcard = (bf: BackendFlashcard): Flashcard => ({
  id: bf.flashcardId,
  front: bf.front,
  back: bf.back,
  cardType: bf.cardType === 'cloze' ? 'cloze' : bf.cardType === 'chart' ? 'chart' : 'basic',
  difficulty: (bf.difficulty === 'easy' || bf.difficulty === 'hard') ? bf.difficulty : 'medium',
  chapter: bf.chapter ?? undefined,
  tags: bf.tags ?? [],
  documentId: bf.documentId || '',
  youTubeVideoId: bf.youTubeVideoId ?? undefined,
  documentName: bf.document ?? bf.title ?? undefined,
  videoName: bf.video ?? undefined,
  srs: bf.srs ? mapSrs(bf.srs) : undefined,
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
const flashcardListCache = new Map<string, { value: PagedFlashcards; expiresAt: number }>();
const FLASHCARD_LIST_CACHE_MS = 30_000;

/**
 * Drop cached flashcard-list responses. Called after any list mutation, and on
 * auth changes (so one user's deck never leaks to the next).
 */
export const invalidateFlashcardListCache = (): void => {
  flashcardListCache.clear();
};

export const flashcardService = {
  async getAllFlashcards(page = 1, pageSize = 20): Promise<PagedFlashcards> {
    const url = `/api/flashcards?page=${page}&pageSize=${pageSize}`;

    // Serve a fresh cached response — collapses the duplicate fetches the
    // deferred context load and the page's visibility-refresh would make.
    const cached = flashcardListCache.get(url);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const pending = inflightRequests.get(url) as Promise<PagedFlashcards> | undefined;
    if (pending) return pending;

    const request = apiClient.get(url)
      .then(response => {
        const d = response.data.data
        const result = {
          items: (d.items as BackendFlashcard[]).map(mapFlashcard),
          totalCount: d.totalCount,
          page: d.page,
          pageSize: d.pageSize,
          totalPages: d.totalPages,
        }
        flashcardListCache.set(url, { value: result, expiresAt: Date.now() + FLASHCARD_LIST_CACHE_MS });
        return result
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
    invalidateFlashcardListCache();
    return mapFlashcard(response.data.data);
  },

  /** Bulk-import cards parsed from an Anki TSV/CSV export. */
  async importFlashcards(rows: { front: string; back: string; cardType?: string; tags?: string[] }[]): Promise<{ importedCount: number; skippedCount: number }> {
    const response = await apiClient.post('/api/flashcards/import', { rows });
    invalidateFlashcardListCache();
    return response.data.data;
  },

  async deleteFlashcard(flashcardId: string): Promise<void> {
    await apiClient.delete(`/api/flashcards/${flashcardId}`);
    invalidateFlashcardListCache();
  },

  async deleteFlashcardsBulk(flashcardIds: string[]): Promise<void> {
    await apiClient.delete('/api/flashcards/bulk', { data: { flashcardIds } });
    invalidateFlashcardListCache();
  },

  /** Submit FSRS review. rating: 1=Again, 2=Hard, 3=Good, 4=Easy */
  async reviewFlashcard(flashcardId: string, rating: 1 | 2 | 3 | 4): Promise<{ scheduledDays: number; retrievability: number; srs: FlashcardSrsState }> {
    const response = await apiClient.post(`/api/flashcards/${flashcardId}/review`, { rating });
    const d = response.data.data;
    return {
      scheduledDays: d.scheduledDays,
      retrievability: d.retrievability,
      srs: mapSrs(d.srs),
    };
  },

  /** Update difficulty, chapter, and/or tags for a flashcard (patch — null fields are ignored) */
  async classifyFlashcard(
    flashcardId: string,
    data: { front?: string; back?: string; difficulty?: 'easy' | 'medium' | 'hard'; chapter?: string; tags?: string[] },
  ): Promise<Flashcard> {
    const response = await apiClient.patch(`/api/flashcards/${flashcardId}/classify`, data);
    invalidateFlashcardListCache();
    return mapFlashcard(response.data.data);
  },

  /** Get FSRS SRS state map (flashcardId → SrsState) for all user flashcards */
  async getSrsStates(): Promise<Map<string, FlashcardSrsState>> {
    const response = await apiClient.get('/api/flashcards/srs');
    const list: (BackendSrs & { flashcardId: string })[] = response.data.data ?? [];
    const map = new Map<string, FlashcardSrsState>();
    for (const item of list) {
      map.set(item.flashcardId, mapSrs(item));
    }
    return map;
  },
};
