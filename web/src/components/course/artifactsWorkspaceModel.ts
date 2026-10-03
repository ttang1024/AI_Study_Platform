import { Document, Flashcard, GlossaryTerm, Note } from '../../types';
import { VideoListItem } from '../../services/videoService';
import { WorkedProblem } from '../../services/workedProblemsService';
import { QuestionBankQuestion } from '../../services/questionBankService';
import { ArtifactKind } from './ArtifactSection';

export type CourseStudySelected =
  | { kind: 'doc'; data: Document }
  | { kind: 'video'; data: VideoListItem }
  | null;

export interface CourseArtifacts {
  notes: Note[];
  flashcards: Flashcard[];
  questions: QuestionBankQuestion[];
  glossary: GlossaryTerm[];
  workedProblems: WorkedProblem[];
}

/** One row per course material (document or video) for the source-scoped sections. */
export type SourceRow = {
  key: string;
  title: string;
  sourceKind: 'doc' | 'video';
  documentId?: string;
  videoId?: string;
  videoUrl?: string;
  mindMapText: string | null;
  summary: string | null | undefined;
};

export type ArtifactDetail =
  | { kind: 'summaries'; itemKey: string; type: 'summary'; title: string; content: string }
  | { kind: 'notes'; itemKey: string; type: 'note'; title: string; content: string }
  | { kind: 'flashcards'; itemKey: string; type: 'flashcard'; title: string; front: string; back: string }
  | { kind: 'questions'; itemKey: string; type: 'question'; title: string; question: QuestionBankQuestion; userAnswer?: string }
  | { kind: 'glossary'; itemKey: string; type: 'glossary'; title: string; term: GlossaryTerm }
  | { kind: 'workedProblems'; itemKey: string; type: 'problem'; title: string; problem: WorkedProblem }
  | { kind: 'mindmaps'; itemKey: string; type: 'mindmap'; title: string; sourceKind: 'doc' | 'video'; documentId?: string; videoId?: string; videoUrl?: string; initialMindMapText: string | null }
  | { kind: 'chats'; itemKey: string; type: 'chat'; title: string; sourceKind: 'doc' | 'video'; documentId?: string; videoId?: string }
  | null;

export type OpenArtifactDetail = Exclude<ArtifactDetail, null>;
export type ExternalMsg = { id: string; role: 'user' | 'model'; content: string; isError?: boolean };

export const ARTIFACT_PAGE_SIZE = 6;
export const FLASHCARD_PAGE_SIZE = 6;

export const initialSectionPages: Record<ArtifactKind, number> = {
  summaries: 1,
  notes: 1,
  flashcards: 1,
  questions: 1,
  glossary: 1,
  workedProblems: 1,
  mindmaps: 1,
  chats: 1,
};

export const sourceKeyForSelected = (selected: CourseStudySelected): string | null =>
  selected ? `${selected.kind}:${selected.data.id}` : null;

/** Resolves the display title of the material an artifact came from. */
export type SourceTitleResolver = (documentId?: string | null, videoId?: string | null, fallback?: string) => string;

export const buildSourceRows = (documents: Document[], videos: VideoListItem[]): SourceRow[] => [
  ...documents.map(doc => ({
    key: `doc:${doc.id}`,
    title: doc.name,
    sourceKind: 'doc' as const,
    documentId: doc.id,
    videoId: undefined,
    videoUrl: undefined,
    mindMapText: doc.mindMapText ?? null,
    summary: doc.summary,
  })),
  ...videos.map(video => ({
    key: `video:${video.id}`,
    title: video.title,
    sourceKind: 'video' as const,
    documentId: undefined,
    videoId: video.id,
    videoUrl: video.videoUrl,
    mindMapText: null,
    summary: video.summary,
  })),
];

// ── Detail builders (pure; the workspace binds them to its resolver/answer map) ──

export const buildNoteDetail = (note: Note, sourceTitle: SourceTitleResolver): OpenArtifactDetail => ({
  kind: 'notes', itemKey: note.id, type: 'note',
  title: sourceTitle(note.documentId, note.videoId, note.documentName ?? note.videoName ?? 'Note'),
  content: note.content,
});

export const buildFlashcardDetail = (card: Flashcard, sourceTitle: SourceTitleResolver): OpenArtifactDetail => ({
  kind: 'flashcards', itemKey: card.id, type: 'flashcard',
  title: sourceTitle(card.documentId, card.videoId, card.documentName ?? card.videoName ?? 'Flashcard'),
  front: card.front, back: card.back,
});

export const buildQuestionDetail = (
  question: QuestionBankQuestion,
  sourceTitle: SourceTitleResolver,
  userAnswerMap: Map<string, string>,
): OpenArtifactDetail => ({
  kind: 'questions', itemKey: question.quizId, type: 'question',
  title: sourceTitle(question.documentId, question.videoId, question.sourceName ?? 'Question'),
  question,
  userAnswer: userAnswerMap.get(question.quizId),
});

export const buildGlossaryDetail = (term: GlossaryTerm, sourceTitle: SourceTitleResolver): OpenArtifactDetail => ({
  kind: 'glossary', itemKey: term.id, type: 'glossary',
  title: sourceTitle(term.documentId, term.videoId, term.sourceName ?? 'Glossary'),
  term,
});

export const buildProblemDetail = (problem: WorkedProblem, sourceTitle: SourceTitleResolver): OpenArtifactDetail => ({
  kind: 'workedProblems', itemKey: problem.workedProblemId, type: 'problem',
  title: sourceTitle(problem.documentId, problem.videoId, problem.topic ?? 'Worked problem'),
  problem,
});

export const buildSummaryDetail = (row: SourceRow): OpenArtifactDetail => ({
  kind: 'summaries', itemKey: row.key, type: 'summary',
  title: row.title, content: row.summary ?? '',
});

export const buildMindmapDetail = (row: SourceRow): OpenArtifactDetail => ({
  kind: 'mindmaps', itemKey: row.key, type: 'mindmap',
  title: row.title,
  sourceKind: row.sourceKind,
  documentId: row.documentId,
  videoId: row.videoId,
  videoUrl: row.videoUrl,
  initialMindMapText: row.mindMapText,
});

export const buildChatDetail = (row: SourceRow): OpenArtifactDetail => ({
  kind: 'chats', itemKey: row.key, type: 'chat',
  title: row.title,
  sourceKind: row.sourceKind,
  documentId: row.documentId,
  videoId: row.videoId,
});
