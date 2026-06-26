export type FeedbackType = 'bug' | 'feature' | 'general';
export type FeedbackStatus = 'new' | 'read' | 'in_progress' | 'resolved' | 'archived';

export interface FeedbackItem {
  id: string;
  type: FeedbackType;
  status: FeedbackStatus;
  subject: string;
  message: string;
  rating: number | null;
  submittedAt: string;
  userId: string | null;
  userEmail: string | null;
  adminNote: string | null;
  resolvedAt: string | null;
}

export interface FeedbackStats {
  total: number;
  byType: Record<FeedbackType, number>;
  byStatus: Record<FeedbackStatus, number>;
  averageRating: number | null;
  recentCount: number; // last 7 days
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface UserItem {
  userId: string;
  email: string;
  fullName: string;
  isEmailVerified: boolean;
  isAdmin: boolean;
  isActive: boolean;
  createdAt: string;
}

// ── Platform analytics ──────────────────────────────────────────────────────

export interface DailyCount {
  date: string;
  count: number;
}

export interface PlatformAnalytics {
  users: {
    total: number;
    active: number;
    inactive: number;
    admins: number;
    verified: number;
    newLast7Days: number;
    newLast30Days: number;
  };
  engagement: {
    dau: number;
    wau: number;
    mau: number;
    studyMinutesLast30Days: number;
    studySessionsLast30Days: number;
    quizSubmissionsLast30Days: number;
    totalQuizSubmissions: number;
  };
  content: {
    documents: number;
    courses: number;
    videos: number;
    quizzes: number;
    flashcards: number;
    notes: number;
    glossaryTerms: number;
  };
  signupTrend: DailyCount[];
  activeUsersTrend: DailyCount[];
  topUsers: TopUser[];
}

export interface TopUser {
  userId: string;
  fullName: string;
  email: string;
  studyMinutes: number;
  sessionCount: number;
  lastActiveAt: string | null;
}

export interface UserDetail {
  userId: string;
  email: string;
  fullName: string;
  isAdmin: boolean;
  isActive: boolean;
  isEmailVerified: boolean;
  createdAt: string;
  lastActiveAt: string | null;
  content: {
    courses: number;
    documents: number;
    videos: number;
    quizzes: number;
    flashcards: number;
    notes: number;
    glossaryTerms: number;
  };
  studyMinutesTotal: number;
  studyMinutesLast30Days: number;
  studySessionsTotal: number;
  quizSubmissions: number;
  averageQuizScorePercent: number | null;
  studyTrendMinutes: DailyCount[];
}
