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

  async getDashboardSummary(): Promise<DashboardSummary> {
    const response = await apiClient.get('/api/analytics/dashboard-summary');
    return response.data.data;
  },

  async updateDailyGoal(minutes: number): Promise<void> {
    await apiClient.put('/api/analytics/daily-goal', { minutes });
  },

  async recordStudySession(heartbeat: StudySessionHeartbeat): Promise<void> {
    await apiClient.post('/api/analytics/study-session', heartbeat);
  },
};
