/** A file selected via expo-document-picker, ready to append to a multipart FormData part. */
export interface PickedFile {
  uri: string;
  name: string;
  mimeType: string;
}

export interface Course {
  id: string;
  name: string;
  color: string;
}

export interface Document {
  id: string;
  name: string;
  type: 'pdf' | 'docx' | 'txt' | 'md' | 'audio' | 'podcast' | 'image' | 'ppt' | 'epub';
  url: string;
  uploadDate: string;
  courseId?: string;
  courseName?: string;
  courseColor?: string;
  summary?: string;
  originalUrl?: string;
  mindMapText?: string | null;
}

export interface VideoListItem {
  id: string;
  courseId: string;
  courseName: string;
  courseColor: string;
  videoId: string;
  videoUrl: string;
  sourceType?: string;
  title: string;
  thumbnailUrl: string;
  createdAt: string;
}

export interface StudyStreak {
  currentStreak: number;
  longestStreak: number;
  todaySeconds: number;
  todayMinutes: number;
}

// FSRS state: 0=New, 1=Learning, 2=Review, 3=Relearning.
export interface FlashcardSrsState {
  state: 0 | 1 | 2 | 3;
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  due: string;
  lastReview?: string;
  retrievability: number;
}

// Rating sent to the review endpoint: 1=Again, 2=Hard, 3=Good, 4=Easy.
export type FsrsRating = 1 | 2 | 3 | 4;

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
  cardType: 'basic' | 'cloze' | 'chart';
  difficulty: 'easy' | 'medium' | 'hard';
  chapter?: string;
  tags: string[];
  createdAt: string;
  srs?: FlashcardSrsState;
}

export interface Note {
  id: string;
  documentId?: string;
  videoId?: string;
  documentName?: string;
  videoName?: string;
  sourceType: 'document' | 'video';
  content: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GlossaryTerm {
  id: string;
  term: string;
  definition: string;
  documentId?: string;
  videoId?: string;
  courseId?: string;
  sourceName?: string;
  sourceKind?: 'document' | 'video' | 'article' | 'audio';
  createdAt: string;
}

export interface QuizQuestion {
  id: string;
  documentId?: string;
  videoId?: string;
  sourceType: string;
  courseId?: string;
  courseName?: string;
  courseColor?: string;
  sourceName?: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  createdAt: string;
}

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
}

export interface VariantQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export interface PendingMaterial {
  kind: string;
  id: string;
  courseId: string;
  courseName: string;
  courseColor: string;
  name: string;
  contentType?: string;
  blobUrl?: string;
  originalUrl?: string;
  videoId?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  createdAt: string;
  sourceType?: string;
}

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

export interface DashboardSummary {
  streak: StudyStreak;
  dueFlashcards: number;
  reinforcement: { quizMistakes: number; unmasteredTerms: number; hardFlashcards: number };
  dailyGoalMinutes: number;
}

export interface CourseMaterialStats {
  courseId: string;
  documents: number;
  articles: number;
  audio: number;
  videos: number;
  total: number;
}

export interface UserStats {
  totalDocuments: number;
  totalArticles: number;
  totalAudio: number;
  totalMaterials: number;
  totalNotes: number;
  totalFlashcards: number;
  totalGlossaryTerms: number;
  totalQuizQuestions: number;
  totalQuizSubmissions: number;
  totalVideos: number;
  courseMaterialCounts: CourseMaterialStats[];
  achievements: { perfectQuizzes: number; averageQuizScore: number; flashcardsMastered: number };
}

export interface UserXp {
  totalXp: number;
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  levelProgress: number;
  breakdown: { source: string; label: string; xp: number }[];
}

export interface WeeklyDigest {
  from: string;
  to: string;
  studyMinutes: number;
  activeDays: number;
  dailyMinutes: { date: string; minutes: number }[];
  flashcardReviews: number;
  quizzesTaken: number;
  quizAccuracy: number;
  newMaterials: number;
  mistakesResolved: number;
  openMistakes: number;
  currentStreak: number;
  weeklyXp: number;
  topGapConcept?: string;
  topGapReason?: string;
  headline: string;
}

