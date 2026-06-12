import { apiClient } from './apiClient';

export interface QuizAccuracyData {
  date: string;
  totalAttempts: number;
  correctAttempts: number;
  accuracyPercentage: number;
}

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

const SUMMARY_TTL_MS = 30_000;
let summaryCache: { data: DashboardSummary; ts: number } | null = null;
let summaryInflight: Promise<DashboardSummary> | null = null;

export function invalidateDashboardSummaryCache(): void {
  summaryCache = null;
}

export const analyticsService = {
  async getQuizAccuracy(from?: string, to?: string): Promise<QuizAccuracyData[]> {
    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    const response = await apiClient.get(`/api/analytics/quiz-accuracy?${params.toString()}`);
    return response.data.data;
  },

  async getTimeOnTask(from?: string, to?: string): Promise<TimeOnTask> {
    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    const response = await apiClient.get(`/api/analytics/time-on-task?${params.toString()}`);
    return response.data.data;
  },

  async getCourseMastery(): Promise<CourseMastery[]> {
    const response = await apiClient.get('/api/analytics/course-mastery');
    return response.data.data;
  },

  // Several widgets (dashboard cards, Pomodoro timer, insights strip) want the
  // summary around the same moment; a short-lived cache + in-flight dedupe
  // collapses those into one request without making the data noticeably stale.
  async getDashboardSummary(): Promise<DashboardSummary> {
    const now = Date.now();
    if (summaryCache && now - summaryCache.ts < SUMMARY_TTL_MS) return summaryCache.data;
    if (!summaryInflight) {
      summaryInflight = apiClient.get('/api/analytics/dashboard-summary')
        .then(response => {
          const data = response.data.data as DashboardSummary;
          summaryCache = { data, ts: Date.now() };
          return data;
        })
        .finally(() => { summaryInflight = null; });
    }
    return summaryInflight;
  },

  async updateDailyGoal(minutes: number): Promise<void> {
    await apiClient.put('/api/analytics/daily-goal', { minutes });
    summaryCache = null; // dailyGoalMinutes is part of the summary
  },

  async recordStudySession(heartbeat: StudySessionHeartbeat): Promise<void> {
    await apiClient.post('/api/analytics/study-session', heartbeat);
  },
};
