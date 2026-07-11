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

export const analyticsService = {
  async getDashboardSummary(): Promise<DashboardSummary> {
    const response = await apiClient.get('/api/analytics/dashboard-summary');
    return response.data.data as DashboardSummary;
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
