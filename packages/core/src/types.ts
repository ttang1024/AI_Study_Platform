// Shared domain types used by shared services and consumers. Only types that are
// genuinely identical (or a safe superset) across apps live here — several DTOs
// (Document, Flashcard, Note, QuizQuestion) have diverged in shape between web/
// and rn/ and must be reconciled per-entity before they can be single-sourced.

export interface Course {
  id: string;
  name: string;
  color: string;
  description?: string;
}

// FSRS-4.5 card state. Identical across web/ and rn/.
// state: 0=New, 1=Learning, 2=Review, 3=Relearning.
export interface FlashcardSrsState {
  state: 0 | 1 | 2 | 3;
  stability: number; // days of memory stability
  difficulty: number; // card difficulty 1–10
  reps: number;
  lapses: number;
  due: string; // ISO datetime
  lastReview?: string; // ISO datetime
  retrievability: number; // recall probability 0–1
}

/** Rating sent to the FSRS review endpoint: 1=Again, 2=Hard, 3=Good, 4=Easy. */
export type FsrsRating = 1 | 2 | 3 | 4;

export type DocumentType = 'pdf' | 'docx' | 'txt' | 'md' | 'audio' | 'podcast' | 'image' | 'ppt' | 'epub';

// Reconciled web/rn union. `title` is optional — web sets it (= fileName) but
// reads it nowhere; rn omits it. `mindMapText` is `string | null` (rn's shape;
// web already treats it with `?? null`). fileSize/fileHash/transcript are
// web-only; courseName/courseColor are rn-only.
export interface Document {
  id: string;
  name: string;
  title?: string;
  type: DocumentType;
  url: string;
  uploadDate: string;
  courseId?: string;
  courseName?: string;
  courseColor?: string;
  summary?: string;
  mindMapText?: string | null;
  transcript?: string;
  originalUrl?: string;
  fileSize?: number;
  fileHash?: string;
}

/** Normalized (0–1) mask rectangle on an image-occlusion card (web feature). */
export interface OcclusionRect {
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string | null;
}

// Reconciled web/rn union. web carries occlusion cards (cardType 'occlusion' +
// imageUrl/occlusions) and lastReviewed/nextReview; rn carries course metadata +
// createdAt. documentId is optional (video cards have none; web's readers all
// accept an optional id). rn never emits 'occlusion' (its mappers collapse to
// the narrower set), so widening cardType is safe.
export interface Flashcard {
  id: string;
  documentId?: string;
  videoId?: string;
  documentName?: string;
  videoName?: string;
  courseId?: string;
  courseName?: string;
  courseColor?: string;
  front: string;
  back: string;
  cardType: 'basic' | 'cloze' | 'chart' | 'occlusion';
  difficulty: 'easy' | 'medium' | 'hard';
  chapter?: string;
  tags: string[];
  lastReviewed?: string;
  nextReview?: string;
  createdAt?: string;
  srs?: FlashcardSrsState;
  imageUrl?: string;
  occlusions?: OcclusionRect[];
}

// Reconciled web/rn union. Canonical field is `correctAnswer` (the backend name,
// Quiz.CorrectAnswer) — web previously called it `answer`. `type` drives web's
// multiple-choice vs short-answer rendering (backend questions are MC); rn omits
// it. The remaining fields are rn's question-bank metadata (web omits them).
export interface QuizQuestion {
  id: string;
  question: string;
  options?: string[]; // undefined for web short-answer questions; always set by rn
  correctAnswer: string;
  explanation: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  type?: 'multiple-choice' | 'short-answer';
  documentId?: string;
  videoId?: string;
  sourceType?: string;
  courseId?: string;
  courseName?: string;
  courseColor?: string;
  sourceName?: string;
  createdAt?: string;
}

// Reconciled web/rn union. web only carries id/documentId/videoId/names/content/
// createdAt; rn adds sourceType/title/updatedAt. documentId is optional (video
// notes have none; web's helpers already accept an optional id).
export interface Note {
  id: string;
  documentId?: string;
  videoId?: string;
  documentName?: string;
  videoName?: string;
  content: string;
  createdAt: string;
  sourceType?: 'document' | 'video';
  title?: string;
  updatedAt?: string;
}

// Reconciled web/rn union. `createdAt` is optional: rn casts it straight from the
// backend response, web's mapper omits it, and neither app reads it.
export interface GlossaryTerm {
  id: string;
  term: string;
  definition: string;
  documentId?: string;
  videoId?: string;
  courseId?: string;
  sourceName?: string; // doc name or video title
  sourceKind?: 'document' | 'video' | 'article' | 'audio';
  createdAt?: string;
}
