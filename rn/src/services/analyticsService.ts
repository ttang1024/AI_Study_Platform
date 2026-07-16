import { apiClient } from '@/services/apiClient';
import type { DashboardSummary } from '@/types';

export interface DailyStudyDuration {
  date: string;
  totalSeconds: number;
  totalMinutes: number;
}

export interface CourseTime {
  courseId?: string;
  courseName: string;
  courseColor?: string;
  totalSeconds: number;
}

export interface TimeOnTask {
  totalSeconds: number;
  daily: DailyStudyDuration[];
  byCourse: CourseTime[];
}

export interface DailyQuizAccuracy {
  date: string;
  totalAttempts: number;
  correctAttempts: number;
  accuracyPercentage: number;
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

const toRangeParams = (from?: Date, to?: Date): string => {
  const params = new URLSearchParams();
  if (from) params.set('from', from.toISOString());
  if (to) params.set('to', to.toISOString());
  const query = params.toString();
  return query ? `?${query}` : '';
};

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

export interface AiUsage {
  from: string;
  to: string;
  totals: AiUsageTotals;
  byOperation: AiUsageGroup[];
  byModel: AiUsageGroup[];
  daily: { date: string; totalTokens: number; estimatedCostUsd: number }[];
  /** Tokens allowed per UTC day. 0 means unlimited. */
  dailyTokenLimit: number;
  tokensUsedToday: number;
}

export const analyticsService = {
  async getDashboardSummary(): Promise<DashboardSummary> {
    const response = await apiClient.get('/api/analytics/dashboard-summary');
    return response.data.data as DashboardSummary;
  },

  /**
   * This user's own AI token spend. The keys are theirs, so the cost lands on their provider bill —
   * this is the only place it is visible to them. `from`/`to` are ISO dates; omitting both gives 30 days.
   */
  async getAiUsage(from?: string, to?: string): Promise<AiUsage> {
    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    const query = params.toString();
    const response = await apiClient.get(`/api/analytics/ai-usage${query ? `?${query}` : ''}`);
    return response.data.data as AiUsage;
  },

  async updateDailyGoal(minutes: number): Promise<void> {
    await apiClient.put('/api/analytics/daily-goal', { minutes });
  },

  async getTimeOnTask(from?: Date, to?: Date): Promise<TimeOnTask> {
    const response = await apiClient.get(`/api/analytics/time-on-task${toRangeParams(from, to)}`);
    return response.data.data as TimeOnTask;
  },

  async getQuizAccuracy(from?: Date, to?: Date): Promise<DailyQuizAccuracy[]> {
    const response = await apiClient.get(`/api/analytics/quiz-accuracy${toRangeParams(from, to)}`);
    return (response.data.data as DailyQuizAccuracy[]) ?? [];
  },

  async getCourseMastery(): Promise<CourseMastery[]> {
    const response = await apiClient.get('/api/analytics/course-mastery');
    return (response.data.data as CourseMastery[]) ?? [];
  },

  async recordStudySession(heartbeat: StudySessionHeartbeat): Promise<void> {
    await apiClient.post('/api/analytics/study-session', heartbeat);
  },
};
