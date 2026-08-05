import type { HttpClient } from '../http';

export interface QuizAccuracyData {
  date: string;
  totalAttempts: number;
  correctAttempts: number;
  accuracyPercentage: number;
}

/** rn's historical name for the same daily-accuracy row. */
export type DailyQuizAccuracy = QuizAccuracyData;

export interface DailyStudyDuration {
  date: string;
  totalSeconds: number;
  totalMinutes: number;
}

export interface CourseTime {
  courseId: string | null;
  courseName: string;
  courseColor?: string | null;
  totalSeconds: number;
}

export interface TimeOnTask {
  totalSeconds: number;
  daily: DailyStudyDuration[];
  byCourse: CourseTime[];
}

export interface CourseMasteryComponent {
  label: string;
  score: number;
  sample: number;
}

export interface CourseMastery {
  courseId: string;
  courseName: string;
  courseColor: string;
  masteryScore: number;
  components: CourseMasteryComponent[];
}

export interface StudySessionHeartbeat {
  courseId?: string | null;
  contextType: string;
  contextId?: string | null;
  durationSeconds: number;
}

export interface StudyStreak {
  currentStreak: number;
  longestStreak: number;
  todaySeconds: number;
  todayMinutes: number;
  /** Streak freezes banked (earned 1 per 7 study days, auto-spent on missed days). */
  freezesAvailable: number;
  /** Last scheduled vacation day (streak-protected), if any. */
  vacationUntil: string | null;
}

// ── Retention analytics (FSRS forgetting curve) ────────────────────────────

export interface ForgettingCurvePoint {
  days: number;
  retention: number;
}

export interface RetentionCalibrationBin {
  binStart: number;
  binEnd: number;
  predictedAvg: number;
  actualRate: number;
  reviews: number;
}

export interface DailyReviewStat {
  date: string;
  reviews: number;
  successRate: number;
}

export interface StabilityBucket {
  label: string;
  cards: number;
}

/** One day's activity for the year heatmap. Days with no activity are omitted by the server. */
export interface ActivityHeatmapDay {
  date: string;
  reviews: number;
  studyMinutes: number;
}

export interface ActivityHeatmap {
  from: string;
  to: string;
  days: ActivityHeatmapDay[];
  totalReviews: number;
  totalStudyMinutes: number;
  activeDays: number;
}

export interface RetentionAnalytics {
  totalCardsTracked: number;
  totalReviews: number;
  reviewsLast30Days: number;
  predictedRetentionNow: number;
  actualRetentionRate: number;
  averageStability: number;
  averageDifficulty: number;
  forgettingCurve: ForgettingCurvePoint[];
  calibration: RetentionCalibrationBin[];
  dailyReviews: DailyReviewStat[];
  stabilityDistribution: StabilityBucket[];
}

export interface ReinforcementCounts {
  quizMistakes: number;
  unmasteredTerms: number;
  hardFlashcards: number;
}

export interface DashboardSummary {
  streak: StudyStreak;
  dueFlashcards: number;
  reinforcement: ReinforcementCounts;
  dailyGoalMinutes: number;
}

export interface ConfidenceBin {
  level: number;
  label: string;
  answered: number;
  correct: number;
  accuracyPercent: number;
}

export interface ConfidentMistake {
  quizId: string;
  question: string;
  correctAnswer: string;
  yourAnswer: string;
}

export interface QuizCalibration {
  bins: ConfidenceBin[];
  ratedAnswers: number;
  confidentWrong: number;
  guessedRight: number;
  /** Percentage points between being certain and being right. Null when nothing was rated confident. */
  overconfidenceGap: number | null;
  confidentMistakes: ConfidentMistake[];
}

export interface AiUsageTotals {
  calls: number;
  promptTokens: number;
  completionTokens: number;
  cachedPromptTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

/** Usage grouped by a key — an operation ("quiz:text") or a "provider/model". */
export interface AiUsageGroup {
  key: string;
  calls: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

export interface AiUsageDay {
  date: string;
  totalTokens: number;
  estimatedCostUsd: number;
}

export interface AiUsage {
  from: string;
  to: string;
  totals: AiUsageTotals;
  byOperation: AiUsageGroup[];
  byModel: AiUsageGroup[];
  daily: AiUsageDay[];
  /** Tokens allowed per UTC day. 0 means unlimited. */
  dailyTokenLimit: number;
  tokensUsedToday: number;
}

const SUMMARY_TTL_MS = 30_000;

const rangeQuery = (from?: string, to?: string): string => {
  const params = new URLSearchParams();
  if (from) params.append('from', from);
  if (to) params.append('to', to);
  const query = params.toString();
  return query ? `?${query}` : '';
};

export function createAnalyticsService(http: HttpClient) {
  // Several widgets (dashboard cards, Pomodoro timer, insights strip) want the
  // summary around the same moment; a short-lived cache + in-flight dedupe
  // collapses those into one request without making the data noticeably stale.
  let summaryCache: { data: DashboardSummary; ts: number } | null = null;
  let summaryInflight: Promise<DashboardSummary> | null = null;

  const service = {
    invalidateDashboardSummaryCache(): void {
      summaryCache = null;
    },

    async getQuizAccuracy(from?: string, to?: string): Promise<QuizAccuracyData[]> {
      const response = await http.get<{ data: QuizAccuracyData[] }>(`/api/analytics/quiz-accuracy${rangeQuery(from, to)}`);
      return response.data.data ?? [];
    },

    async getTimeOnTask(from?: string, to?: string): Promise<TimeOnTask> {
      const response = await http.get<{ data: TimeOnTask }>(`/api/analytics/time-on-task${rangeQuery(from, to)}`);
      return response.data.data;
    },

    async getCourseMastery(): Promise<CourseMastery[]> {
      const response = await http.get<{ data: CourseMastery[] }>('/api/analytics/course-mastery');
      return response.data.data ?? [];
    },

    async getDashboardSummary(): Promise<DashboardSummary> {
      const now = Date.now();
      if (summaryCache && now - summaryCache.ts < SUMMARY_TTL_MS) return summaryCache.data;
      if (!summaryInflight) {
        summaryInflight = http.get<{ data: DashboardSummary }>('/api/analytics/dashboard-summary')
          .then(response => {
            const data = response.data.data;
            summaryCache = { data, ts: Date.now() };
            return data;
          })
          .finally(() => { summaryInflight = null; });
      }
      return summaryInflight;
    },

    async updateDailyGoal(minutes: number): Promise<void> {
      await http.put('/api/analytics/daily-goal', { minutes });
      summaryCache = null; // dailyGoalMinutes is part of the summary
    },

    async recordStudySession(heartbeat: StudySessionHeartbeat): Promise<void> {
      await http.post('/api/analytics/study-session', heartbeat);
    },

    async getRetentionAnalytics(): Promise<RetentionAnalytics> {
      const response = await http.get<{ data: RetentionAnalytics }>('/api/analytics/retention');
      return response.data.data;
    },

    /** Per-day reviews + study minutes for the contributions-style heatmap (default: trailing year). */
    async getActivityHeatmap(days = 365): Promise<ActivityHeatmap> {
      const response = await http.get<{ data: ActivityHeatmap }>(`/api/analytics/activity-heatmap?days=${days}`);
      return response.data.data;
    },

    /**
     * How the learner's self-rated confidence compares to how right they actually were. Distinct from
     * getRetentionAnalytics' calibration, which grades the FSRS scheduler rather than the learner.
     */
    async getQuizCalibration(): Promise<QuizCalibration> {
      const response = await http.get<{ data: QuizCalibration }>('/api/analytics/calibration');
      return response.data.data;
    },

    /**
     * This user's own AI token spend. Keys are theirs, so the cost lands on their provider bill —
     * this endpoint is the only place they can see where it went. Dates are ISO (YYYY-MM-DD);
     * omitting both gives the last 30 days.
     */
    async getAiUsage(from?: string, to?: string): Promise<AiUsage> {
      const response = await http.get<{ data: AiUsage }>(`/api/analytics/ai-usage${rangeQuery(from, to)}`);
      return response.data.data;
    },

    /** Schedule streak-protected vacation days (inclusive range of ISO dates). */
    async setVacation(startDate: string, endDate: string): Promise<void> {
      await http.post('/api/analytics/vacation', { startDate, endDate });
      summaryCache = null;
    },

    async cancelVacation(): Promise<void> {
      await http.delete('/api/analytics/vacation');
      summaryCache = null;
    },
  };

  return service;
}
