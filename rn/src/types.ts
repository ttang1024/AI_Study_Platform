import type { SourceCitation } from '@core/types';

/** A file selected via expo-document-picker, ready to append to a multipart FormData part. */
export interface PickedFile {
  uri: string;
  name: string;
  mimeType: string;
  /** Byte size when the picker reports one — used to spot a file that's already in the library. */
  size?: number;
}

// Shared with web/ via packages/core.
export type { Course } from '@core/types';

// Shared with web/ via packages/core.
export type { Document } from '@core/types';

// Shared with web/ via packages/core.
export type { VideoListItem } from '@core/services/videoService';

export interface StudyStreak {
  currentStreak: number;
  longestStreak: number;
  todaySeconds: number;
  todayMinutes: number;
  freezesAvailable?: number;
  vacationUntil?: string | null;
}

// Shared with web/ via packages/core.
export type { FlashcardSrsState, FsrsRating } from '@core/types';

// Shared with web/ via packages/core.
export type { Flashcard } from '@core/types';

/** A flashcard reduced to just what the per-source Cards tab renders. */
export interface SimpleCard {
  id: string;
  front: string;
  back: string;
  cardType: 'basic' | 'cloze' | 'chart';
  /** Where in the source this card came from, when the supporting quote could be located. */
  citation?: SourceCitation;
}

// Shared with web/ via packages/core.
export type { SourceCitation } from '@core/types';

// Shared with web/ via packages/core.
export type { Note } from '@core/types';

// Shared with web/ via packages/core.
export type { GlossaryTerm } from '@core/types';

// Shared with web/ via packages/core.
export type { QuizQuestion } from '@core/types';

export interface QuizSubmission {
  id: string;
  documentId?: string;
  videoId?: string;
  courseId?: string;
  sourceType: string;
  answers: Record<string, string>;
  score: number;
  total: number;
  submittedAt: string;
  title?: string;
}

// Shared with web/ via packages/core.
export type { Mistake, VariantQuestion } from '@core/services/mistakesService';

// Shared with web/ via packages/core.
export type { PendingMaterial } from '@core/types';

export interface TodayPlanItem {
  id: string;
  type: 'flashcards' | 'quiz' | 'glossary' | 'problems' | 'gap' | 'course' | 'material';
  title: string;
  subtitle?: string;
  priority: number;
  estimatedMinutes: number;
  url: string;
  count?: number;
  stretch: boolean;
}

export interface TodayPlan {
  streak: StudyStreak;
  dailyGoalMinutes: number;
  todayMinutes: number;
  completionPercent: number;
  goalMet: boolean;
  plannedMinutes: number;
  dueFlashcards: number;
  items: TodayPlanItem[];
}

// Shared with web/ via packages/core.
export type { DashboardSummary, ReinforcementCounts } from '@core/services/analyticsService';

// Shared with web/ via packages/core.
export type { UserStats, UserXp } from '@core/services/statsService';

// Shared with web/ via packages/core.
export type { WeeklyDigest } from '@core/services/gamificationService';

