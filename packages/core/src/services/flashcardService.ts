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

/** Per-user FSRS scheduler tuning. */
export interface FsrsSettings {
  /** Recall probability the scheduler aims for (0.7–0.98). 0.9 is the FSRS default. */
  desiredRetention: number;
  maximumIntervalDays: number;
  enableFuzz: boolean;
  /** How many never-seen cards a session may introduce per day. */
  newCardsPerDay: number;
  /** Ceiling on cards offered per day, new and due together. 0 means no ceiling. */
  maxReviewsPerDay: number;
  /** True when scheduling uses weights fitted to this user's own history. */
  usingOptimizedWeights: boolean;
  weightsOptimizedAt?: string;
  reviewsAtOptimization: number;
  logLossBefore?: number;
  logLossAfter?: number;
  weights: number[];
  reviewCount: number;
  minimumReviewsToOptimize: number;
}

export interface FsrsOptimizationResult {
  /** False when the fit was no better than the current scheduler, so nothing was saved. */
  applied: boolean;
  reviewCount: number;
  logLossBefore: number;
  logLossAfter: number;
  rmseBefore: number;
  rmseAfter: number;
  /** Relative log-loss reduction, e.g. 0.06 for 6% better calibrated. */
  improvement: number;
  weights: number[];
}

/** The scheduler preferences a client may patch; the fitted weights are not among them. */
export type FsrsSettingsPatch = Partial<
  Pick<FsrsSettings, 'desiredRetention' | 'maximumIntervalDays' | 'enableFuzz' | 'newCardsPerDay' | 'maxReviewsPerDay'>
>;

export interface ReviewForecastDay {
  day: string;
  count: number;
}

export interface ReviewForecast {
  /** Cards already past their due date — late work, not part of the forward view. */
  overdue: number;
  days: ReviewForecastDay[];
  maxReviewsPerDay: number;
  newCardsPerDay: number;
}

export interface RescheduleBacklogResult {
  moved: number;
  days: number;
  /** The per-day ceiling the spread aimed for, after the user's own review limit. */
  perDay: number;
}

export interface UndoReviewResult {
  flashcardId: string;
  rating: FsrsRating;
  /** True when the undone review was the card's first, so it went back to being new. */
  cardReset: boolean;
  srs?: FlashcardSrsState;
}

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

    /** Read the user's FSRS scheduler settings (retention, max interval, fuzz, fitted weights). */
    async getFsrsSettings(): Promise<FsrsSettings> {
      const response = await http.get<{ data: FsrsSettings }>('/api/flashcards/srs/settings');
      return response.data.data;
    },

    /** Patch scheduler settings — omitted fields are left as they are. */
    async updateFsrsSettings(patch: FsrsSettingsPatch): Promise<FsrsSettings> {
      const response = await http.put<{ data: FsrsSettings }>('/api/flashcards/srs/settings', patch);
      return response.data.data;
    },

    /** Upcoming review load per day, plus the overdue backlog. */
    async getReviewForecast(days = 14): Promise<ReviewForecast> {
      const response = await http.get<{ data: ReviewForecast }>(`/api/flashcards/srs/forecast?days=${days}`);
      return response.data.data;
    },

    /** Spread overdue cards across the coming days. Moves due dates only — memory state is untouched. */
    async rescheduleBacklog(days = 7): Promise<RescheduleBacklogResult> {
      const response = await http.post<{ data: RescheduleBacklogResult }>('/api/flashcards/srs/reschedule-backlog', { days });
      return response.data.data;
    },

    /** Fit the FSRS weights to this user's review history, adopting them if better calibrated. */
    async optimizeFsrsWeights(): Promise<FsrsOptimizationResult> {
      const response = await http.post<{ data: FsrsOptimizationResult }>('/api/flashcards/srs/optimize', {});
      return response.data.data;
    },

    /** Discard fitted weights and go back to the stock FSRS-4.5 scheduler. */
    async resetFsrsWeights(): Promise<FsrsSettings> {
      const response = await http.post<{ data: FsrsSettings }>('/api/flashcards/srs/weights/reset', {});
      return response.data.data;
    },

    /** Roll back the most recent review, restoring the card's scheduling exactly. */
    async undoLastReview(flashcardId?: string): Promise<UndoReviewResult> {
      const response = await http.post<{ data: UndoReviewResult & { srs?: BackendSrs } }>('/api/flashcards/review/undo', { flashcardId });
      const d = response.data.data;
      return { ...d, srs: d.srs ? mapSrs(d.srs) : undefined };
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
