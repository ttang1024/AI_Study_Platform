import { apiClient } from './apiClient';
import { getShareBaseUrl } from '../utils/env';

export interface ShareableQuiz {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export interface ShareableCard {
  front: string;
  back: string;
}

export interface ShareableGlossaryTerm {
  term: string;
  definition: string;
}

export interface CreateSharePayload {
  title: string;
  summary?: string | null;
  mindMapText?: string | null;
  notesHtml?: string | null;
  quizzes?: ShareableQuiz[] | null;
  flashcards?: ShareableCard[] | null;
  glossaryTerms?: ShareableGlossaryTerm[] | null;
  expiresInDays?: number | null;
  sourceType?: 'youtube' | 'article' | 'audio' | 'podcast' | 'document' | 'chat' | null;
  sourceUrl?: string | null;
  originalArticleUrl?: string | null;
}

export interface ShareResult {
  token: string;
  shareUrl: string;
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

export async function createShare(payload: CreateSharePayload): Promise<ShareResult> {
  const res = await apiClient.post<{ data: { token: string; shareUrl: string } }>('/api/share', {
    title: payload.title,
    summary: payload.summary ?? null,
    mindMapText: payload.mindMapText ?? null,
    notesHtml: payload.notesHtml ?? null,
    quizzesJson: payload.quizzes ? JSON.stringify(payload.quizzes) : null,
    flashcardsJson: payload.flashcards ? JSON.stringify(payload.flashcards) : null,
    glossaryJson: payload.glossaryTerms ? JSON.stringify(payload.glossaryTerms) : null,
    expiresInDays: payload.expiresInDays ?? null,
    sourceType: payload.sourceType ?? null,
    sourceUrl: payload.sourceUrl ?? null,
    originalArticleUrl: payload.originalArticleUrl ?? null,
  });
  const { token } = res.data.data;
  const shareBaseUrl = getShareBaseUrl();
  return { token, shareUrl: `${shareBaseUrl}/share/${token}` };
}

export async function getShare(token: string): Promise<SharedContent> {
  const res = await apiClient.get<{ data: SharedContent }>(`/api/share/${token}`);
  return res.data.data;
}
