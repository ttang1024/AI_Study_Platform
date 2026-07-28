import type { HttpClient } from '../http';
import type { VideoSourceType } from '../videoSources';

/**
 * Public share links: `/api/share` mints a token that the web app renders at
 * `/share/{token}`. rn/ can create shares and open them, so the payload shape,
 * the JSON-stringify-the-collections wire quirk, and the anonymous read were
 * duplicated verbatim. Building the user-facing share URL stays per-app — the
 * share base URL comes from each app's own env module.
 */
export interface ShareableQuiz {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  difficulty?: 'easy' | 'medium' | 'hard';
}

export interface ShareableCard {
  front: string;
  back: string;
  cardType?: 'basic' | 'cloze' | 'chart' | 'occlusion';
}

export interface ShareableGlossaryTerm {
  term: string;
  definition: string;
}

export type ShareSourceType =
  | VideoSourceType | 'article' | 'audio' | 'podcast' | 'document' | 'chat';

export interface CreateSharePayload {
  title: string;
  summary?: string | null;
  mindMapText?: string | null;
  notesHtml?: string | null;
  quizzes?: ShareableQuiz[] | null;
  flashcards?: ShareableCard[] | null;
  glossaryTerms?: ShareableGlossaryTerm[] | null;
  expiresInDays?: number | null;
  sourceType?: ShareSourceType | string | null;
  sourceUrl?: string | null;
  originalArticleUrl?: string | null;
}

export interface SharedContent {
  token: string;
  title: string;
  ownerName: string;
  summary?: string | null;
  mindMapText?: string | null;
  notesHtml?: string | null;
  quizzes?: ShareableQuiz[] | null;
  flashcards?: ShareableCard[] | null;
  glossary?: ShareableGlossaryTerm[] | null;
  createdAt: string;
  expiresAt?: string | null;
  sourceType?: string | null;
  sourceUrl?: string | null;
  originalArticleUrl?: string | null;
  fileType?: string | null;
}

/** Anonymous media stream for a share. `apiUrl` is the app's API origin. */
export type ShareMediaKind = 'audio' | 'video' | 'article' | 'file';

export const shareMediaUrl = (apiUrl: string, token: string, kind: ShareMediaKind): string =>
  `${apiUrl}/api/share/${encodeURIComponent(token)}/${kind}`;

/**
 * Accepts a pasted share URL ("https://…/share/AbC123") or a bare token and
 * returns the token, or null when the input looks like neither.
 */
export function extractShareToken(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const urlMatch = trimmed.match(/\/share\/([A-Za-z0-9_-]+)/);
  if (urlMatch) return urlMatch[1];
  if (/^[A-Za-z0-9_-]{6,}$/.test(trimmed)) return trimmed;
  return null;
}

export function createShareService(http: HttpClient) {
  return {
    /** Returns the raw token; callers prefix it with their own share base URL. */
    async createShare(payload: CreateSharePayload): Promise<{ token: string }> {
      const res = await http.post<{ data: { token: string } }>('/api/share', {
        title: payload.title,
        summary: payload.summary ?? null,
        mindMapText: payload.mindMapText ?? null,
        notesHtml: payload.notesHtml ?? null,
        // The collections travel as JSON strings — the server stores them opaquely.
        quizzesJson: payload.quizzes ? JSON.stringify(payload.quizzes) : null,
        flashcardsJson: payload.flashcards ? JSON.stringify(payload.flashcards) : null,
        glossaryJson: payload.glossaryTerms ? JSON.stringify(payload.glossaryTerms) : null,
        expiresInDays: payload.expiresInDays ?? null,
        sourceType: payload.sourceType ?? null,
        sourceUrl: payload.sourceUrl ?? null,
        originalArticleUrl: payload.originalArticleUrl ?? null,
      });
      return { token: res.data.data.token };
    },

    /** Anonymous fetch of a shared page's content by token. */
    async getShare(token: string): Promise<SharedContent> {
      const res = await http.get<{ data: SharedContent }>(`/api/share/${encodeURIComponent(token)}`);
      return res.data.data;
    },

    /** Cards attached to a document, in the shape the share payload wants. */
    async getDocumentShareCards(courseId: string, documentId: string): Promise<ShareableCard[]> {
      const res = await http.get<{ data: ShareableCard[] }>(
        `/api/courses/${courseId}/documents/${documentId}/flashcards`,
      );
      return (res.data.data ?? []).map((c) => ({ front: c.front, back: c.back, cardType: c.cardType }));
    },

    /** Cards attached to a video, in the shape the share payload wants. */
    async getVideoShareCards(videoId: string): Promise<ShareableCard[]> {
      const res = await http.get<{ data: ShareableCard[] }>(`/api/videos/${videoId}/flashcards`);
      return (res.data.data ?? []).map((c) => ({ front: c.front, back: c.back, cardType: c.cardType }));
    },
  };
}

export type ShareService = ReturnType<typeof createShareService>;
