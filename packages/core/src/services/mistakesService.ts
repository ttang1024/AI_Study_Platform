import type { HttpClient } from '../http';

export interface Mistake {
  id: string;
  quizId?: string;
  documentId?: string;
  videoId?: string;
  sourceType: string;
  question: string;
  options: string[];
  correctAnswer: string;
  userAnswer: string;
  explanation: string;
  status: 'open' | 'resolved';
  timesMissed: number;
  firstMissedAt: string;
  lastMissedAt: string;
  resolvedAt?: string;
  /** The flashcard promoted from this mistake, if any. Present means it's already a card. */
  flashcardId?: string;
}

export interface Mistakes {
  items: Mistake[];
  openCount: number;
  resolvedCount: number;
}

export interface PromotedMistakes {
  created: number;
  skipped: number;
  flashcardIds: string[];
}

export interface VariantQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export function createMistakesService(http: HttpClient) {
  // Variant generation is an expensive AI call; collapse concurrent requests for the
  // same mistake (StrictMode's double effect, double clicks) into one HTTP request.
  const inflightVariantRequests = new Map<string, Promise<VariantQuestion[]>>();

  return {
    async getMistakes(status?: 'open' | 'resolved'): Promise<Mistakes> {
      const res = await http.get<{ data: Mistakes }>('/api/mistakes', { params: status ? { status } : undefined });
      return res.data.data;
    },

    async setStatus(mistakeId: string, status: 'open' | 'resolved'): Promise<Mistake> {
      const res = await http.post<{ data: Mistake }>(`/api/mistakes/${mistakeId}/status`, { status });
      return res.data.data;
    },

    async deleteMistake(mistakeId: string): Promise<void> {
      await http.delete(`/api/mistakes/${mistakeId}`);
    },

    /**
     * Promote missed questions into flashcards that are due for review immediately. Omit `mistakeIds`
     * to promote every open mistake. Mistakes that already have a card are skipped, not duplicated.
     */
    async promoteToFlashcards(mistakeIds?: string[]): Promise<PromotedMistakes> {
      const res = await http.post<{ data: PromotedMistakes }>('/api/mistakes/to-flashcards', { mistakeIds: mistakeIds ?? [] });
      return res.data.data;
    },

    async generateVariants(mistakeId: string): Promise<VariantQuestion[]> {
      const pending = inflightVariantRequests.get(mistakeId);
      if (pending) return pending;

      const request = http.post<{ data: VariantQuestion[] }>(`/api/mistakes/${mistakeId}/variants`)
        .then(res => res.data.data)
        .finally(() => inflightVariantRequests.delete(mistakeId));

      inflightVariantRequests.set(mistakeId, request);
      return request;
    },
  };
}

export type MistakesService = ReturnType<typeof createMistakesService>;
