// Barrel for @study/core. Consumers may also deep-import (e.g.
// '@core/services/practiceService') — both resolve to the same source.
export type { HttpClient, HttpRequestConfig, HttpResponse } from './http';
export type {
  Course,
  Document,
  DocumentType,
  Flashcard,
  FlashcardSrsState,
  FsrsRating,
  GlossaryTerm,
  Note,
  OcclusionRect,
  QuizQuestion,
} from './types';
export * from './ai';
export * from './sse';
export * from './podcastSources';
export * from './utils/apiError';
export * from './utils/quizAnswers';
export * from './services/practiceService';
export * from './services/courseService';
export * from './services/handwritingService';
export * from './services/searchService';
export * from './services/podcastService';
export * from './services/recommendationService';
export * from './services/mistakesService';
export * from './services/workedProblemsService';
export * from './services/annotationsService';
export * from './services/questionBankService';
export * from './services/noteService';
export * from './services/statsService';
export * from './services/plannerService';
export * from './services/gamificationService';
export * from './services/studyGroupService';
export * from './services/glossaryService';
export * from './services/libraryService';
