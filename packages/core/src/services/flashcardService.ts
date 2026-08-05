import type { HttpClient } from '../http';
import type { Flashcard, FlashcardSrsState, FsrsRating, OcclusionRect, PendingMaterial, SourceCitation } from '../types';
import { normalizeCitation } from '../types';

interface BackendSrs {
  state: 0 | 1 | 2 | 3;
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  due: string;
  lastReview?: string;
  retrievability: number;
  isSuspended?: boolean;
}

export interface BackendFlashcard {
  flashcardId: string;
  front: string;
  back: string;
  cardType?: string;
  difficulty?: string;
  chapter?: string;
  tags?: string[];
  documentId?: string;
  videoId?: string;
  document?: string;
  video?: string;
  title?: string;
  createdAt?: string;
  srs?: BackendSrs;
  imageUrl?: string;
  occlusionsJson?: string;
  citation?: SourceCitation;
}

const parseOcclusions = (json?: string): OcclusionRect[] | undefined => {
  if (!json) return undefined;
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
};

const mapSrs = (s: BackendSrs): FlashcardSrsState => ({
  state: s.state,
  stability: s.stability,
  difficulty: s.difficulty,
  reps: s.reps,
  lapses: s.lapses,
  due: s.due,
  lastReview: s.lastReview,
  retrievability: s.retrievability,
  isSuspended: s.isSuspended ?? false,
});

export const mapBackendFlashcard = (bf: BackendFlashcard): Flashcard => ({
  id: bf.flashcardId,
  front: bf.front,
  back: bf.back,
  cardType: bf.cardType === 'cloze' ? 'cloze' : bf.cardType === 'chart' ? 'chart' : bf.cardType === 'occlusion' ? 'occlusion' : 'basic',
  difficulty: (bf.difficulty === 'easy' || bf.difficulty === 'hard') ? bf.difficulty : 'medium',
  chapter: bf.chapter ?? undefined,
  tags: bf.tags ?? [],
  // `?? undefined` (not `|| ''`): rn groups decks by `documentId ?? videoId`, so an
  // empty string on video cards would swallow the videoId fallback.
  documentId: bf.documentId ?? undefined,
  videoId: bf.videoId ?? undefined,
  documentName: bf.document ?? bf.title ?? undefined,
  videoName: bf.video ?? undefined,
  createdAt: bf.createdAt,
  srs: bf.srs ? mapSrs(bf.srs) : undefined,
  imageUrl: bf.imageUrl ?? undefined,
  occlusions: parseOcclusions(bf.occlusionsJson),
  citation: normalizeCitation(bf.citation),
});

export interface PagedFlashcards {
  items: Flashcard[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface FlashcardCoverage {
  documentIds: string[];
  videoIds: string[];
}

export interface ClassifyFlashcardPatch {
  front?: string;
  back?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  chapter?: string;
  tags?: string[];
}

const FLASHCARD_LIST_CACHE_MS = 30_000;

export function createFlashcardService(http: HttpClient) {
  const inflightRequests = new Map<string, Promise<unknown>>();
  const flashcardListCache = new Map<string, { value: PagedFlashcards; expiresAt: number }>();

  /**
   * Drop cached flashcard-list responses. Called after any list mutation, and on
   * auth changes (so one user's deck never leaks to the next).
   */
  const invalidateFlashcardListCache = (): void => {
    flashcardListCache.clear();
  };

  return {
    invalidateFlashcardListCache,

    async getAllFlashcards(page = 1, pageSize = 20): Promise<PagedFlashcards> {
      const url = `/api/flashcards?page=${page}&pageSize=${pageSize}`;

      // Serve a fresh cached response — collapses the duplicate fetches the
      // deferred context load and the page's visibility-refresh would make.
      const cached = flashcardListCache.get(url);
      if (cached && cached.expiresAt > Date.now()) return cached.value;

      const pending = inflightRequests.get(url) as Promise<PagedFlashcards> | undefined;
      if (pending) return pending;

      const request = http.get<{ data: { items: BackendFlashcard[]; totalCount: number; page: number; pageSize: number; totalPages: number } }>(url)
        .then(response => {
          const d = response.data.data;
          const result = {
            items: d.items.map(mapBackendFlashcard),
            totalCount: d.totalCount,
            page: d.page,
            pageSize: d.pageSize,
            totalPages: d.totalPages,
          };
          flashcardListCache.set(url, { value: result, expiresAt: Date.now() + FLASHCARD_LIST_CACHE_MS });
          return result;
        })
        .finally(() => inflightRequests.delete(url));

      inflightRequests.set(url, request);
      return request;
    },

    async getCoverage(): Promise<FlashcardCoverage> {
      const url = '/api/flashcards/coverage';
      const pending = inflightRequests.get(url) as Promise<FlashcardCoverage> | undefined;
      if (pending) return pending;

      const request = http.get<{ data: Partial<FlashcardCoverage> }>(url)
        .then(response => {
          const d = response.data.data;
          return {
            documentIds: d.documentIds ?? [],
            videoIds: d.videoIds ?? [],
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

      const request = http.get<{ data: PendingMaterial[] | null }>(url)
        .then(response => response.data.data ?? [])
        .finally(() => inflightRequests.delete(url));

      inflightRequests.set(url, request);
      return request;
    },

    async createFlashcard(data: { front: string; back: string; documentId?: string }): Promise<Flashcard> {
      const response = await http.post<{ data: BackendFlashcard }>('/api/flashcards', data);
      invalidateFlashcardListCache();
      return mapBackendFlashcard(response.data.data);
    },

    /** Bulk-import cards parsed from an Anki TSV/CSV export. */
    async importFlashcards(rows: { front: string; back: string; cardType?: string; tags?: string[] }[]): Promise<{ importedCount: number; skippedCount: number }> {
      const response = await http.post<{ data: { importedCount: number; skippedCount: number } }>('/api/flashcards/import', { rows });
      invalidateFlashcardListCache();
      return response.data.data;
    },

    async deleteFlashcard(flashcardId: string): Promise<void> {
      await http.delete(`/api/flashcards/${flashcardId}`);
      invalidateFlashcardListCache();
    },

    async deleteFlashcardsBulk(flashcardIds: string[]): Promise<void> {
      await http.delete('/api/flashcards/bulk', { data: { flashcardIds } });
      invalidateFlashcardListCache();
    },

    /** Submit FSRS review. rating: 1=Again, 2=Hard, 3=Good, 4=Easy */
    async reviewFlashcard(flashcardId: string, rating: FsrsRating): Promise<{ scheduledDays: number; retrievability: number; srs: FlashcardSrsState }> {
      const response = await http.post<{ data: { scheduledDays: number; retrievability: number; srs: BackendSrs } }>(`/api/flashcards/${flashcardId}/review`, { rating });
      const d = response.data.data;
      return {
        scheduledDays: d.scheduledDays,
        retrievability: d.retrievability,
        srs: mapSrs(d.srs),
      };
    },

    /** Update difficulty, chapter, and/or tags for a flashcard (patch — null fields are ignored) */
    async classifyFlashcard(flashcardId: string, data: ClassifyFlashcardPatch): Promise<Flashcard> {
      const response = await http.patch<{ data: BackendFlashcard }>(`/api/flashcards/${flashcardId}/classify`, data);
      invalidateFlashcardListCache();
      return mapBackendFlashcard(response.data.data);
    },

    /** Leech cards: repeatedly forgotten (FSRS lapses ≥ threshold), worst first. */
    async getLeeches(threshold = 4): Promise<Flashcard[]> {
      const response = await http.get<{ data: BackendFlashcard[] | null }>(`/api/flashcards/leeches?threshold=${threshold}`);
      return (response.data.data ?? []).map(mapBackendFlashcard);
    },

    /** Suspend (or resume) a card — suspended cards never come up for review. */
    async setSuspended(flashcardId: string, suspended: boolean): Promise<FlashcardSrsState> {
      const response = await http.patch<{ data: BackendSrs }>(`/api/flashcards/${flashcardId}/suspend`, { suspended });
      return mapSrs(response.data.data);
    },

    /** Reset a card's FSRS scheduling so it starts over as a new card. */
    async resetSrs(flashcardId: string): Promise<void> {
      await http.post(`/api/flashcards/${flashcardId}/srs/reset`, {});
    },

    /** Get FSRS SRS state map (flashcardId → SrsState) for all user flashcards */
    async getSrsStates(): Promise<Map<string, FlashcardSrsState>> {
      const response = await http.get<{ data: (BackendSrs & { flashcardId: string })[] | null }>('/api/flashcards/srs');
      const list = response.data.data ?? [];
      const map = new Map<string, FlashcardSrsState>();
      for (const item of list) {
        map.set(item.flashcardId, mapSrs(item));
      }
      return map;
    },
  };
}
