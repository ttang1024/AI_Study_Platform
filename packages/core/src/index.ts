// Barrel for @study/core. Consumers may also deep-import (e.g.
// '@core/services/practiceService') — both resolve to the same source.
export type { HttpClient, HttpRequestConfig, HttpResponse } from './http';
export type {
  Course,
  Document,
  PendingMaterial,
  DocumentType,
  Flashcard,
  FlashcardSrsState,
  FsrsRating,
  GlossaryTerm,
  Note,
  OcclusionRect,
  QuizQuestion,
  SourceCitation,
} from './types';
export * from './ai';
export * from './chat';
export * from './sse';
export * from './podcastSources';
export * from './videoSources';
export * from './documentUpload';
export * from './achievements';
export * from './utils/apiError';
export * from './utils/quizAnswers';
export * from './utils/ankiImport';
export * from './utils/cloze';
export * from './utils/markdownToPlainText';
export * from './utils/stripHtml';
export * from './utils/summary';
export * from './utils/validatePassword';
export * from './utils/xmindMarkdown';
export * from './services/authService';
export * from './services/conceptLinksService';
export * from './services/languageService';
export * from './services/shareService';
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
export * from './services/analyticsService';
export * from './services/flashcardService';
export * from './services/documentService';
export * from './services/videoService';
