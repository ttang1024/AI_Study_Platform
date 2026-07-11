import { API_URL, SHARE_BASE_URL } from '@/constants/env';
import { apiClient } from '@/services/apiClient';

// Mobile port of web/src/services/shareContentService.ts — creates a public
// share token the web app renders at /share/{token}.

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
  cardType?: 'basic' | 'cloze' | 'chart';
}

export interface CreateSharePayload {
  title: string;
  summary?: string | null;
  mindMapText?: string | null;
  notesHtml?: string | null;
  quizzes?: ShareableQuiz[] | null;
  flashcards?: ShareableCard[] | null;
  expiresInDays?: number | null;
  sourceType?: string | null;
  sourceUrl?: string | null;
  originalArticleUrl?: string | null;
}

export interface ShareResult {
  token: string;
  shareUrl: string;
}

export async function createShare(payload: CreateSharePayload): Promise<ShareResult> {
  const res = await apiClient.post('/api/share', {
    title: payload.title,
    summary: payload.summary ?? null,
    mindMapText: payload.mindMapText ?? null,
    notesHtml: payload.notesHtml ?? null,
    quizzesJson: payload.quizzes ? JSON.stringify(payload.quizzes) : null,
    flashcardsJson: payload.flashcards ? JSON.stringify(payload.flashcards) : null,
    glossaryJson: null,
    expiresInDays: payload.expiresInDays ?? null,
    sourceType: payload.sourceType ?? null,
    sourceUrl: payload.sourceUrl ?? null,
    originalArticleUrl: payload.originalArticleUrl ?? null,
  });
  const { token } = res.data.data as { token: string };
  return { token, shareUrl: `${SHARE_BASE_URL}/share/${token}` };
}

export interface ShareableGlossaryTerm {
  term: string;
  definition: string;
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

/** Anonymous fetch of a shared page's content by token. */
export async function getShare(token: string): Promise<SharedContent> {
  const res = await apiClient.get(`/api/share/${encodeURIComponent(token)}`);
  return res.data.data as SharedContent;
}

/** Anonymous media stream URLs for a share (audio, uploaded video, article text). */
export const shareMediaUrl = (token: string, kind: 'audio' | 'video' | 'article' | 'file'): string =>
  `${API_URL}/api/share/${encodeURIComponent(token)}/${kind}`;

/**
 * Accepts a pasted share URL ("https://…/share/AbC123") or a bare token and
 * returns the token, or null when the input doesn't look like either.
 */
export function extractShareToken(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const urlMatch = trimmed.match(/\/share\/([A-Za-z0-9_-]+)/);
  if (urlMatch) return urlMatch[1];
  if (/^[A-Za-z0-9_-]{6,}$/.test(trimmed)) return trimmed;
  return null;
}

/** Cards attached to a document, in the shape the share payload wants. */
export async function fetchDocumentShareCards(courseId: string, documentId: string): Promise<ShareableCard[]> {
  const res = await apiClient.get(`/api/courses/${courseId}/documents/${documentId}/flashcards`);
  const cards = (res.data.data ?? []) as { front: string; back: string; cardType?: ShareableCard['cardType'] }[];
  return cards.map((c) => ({ front: c.front, back: c.back, cardType: c.cardType }));
}

/** Cards attached to a video, in the shape the share payload wants. */
export async function fetchVideoShareCards(videoId: string): Promise<ShareableCard[]> {
  const res = await apiClient.get(`/api/videos/${videoId}/flashcards`);
  const cards = (res.data.data ?? []) as { front: string; back: string; cardType?: ShareableCard['cardType'] }[];
  return cards.map((c) => ({ front: c.front, back: c.back, cardType: c.cardType }));
}
