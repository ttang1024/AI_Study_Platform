import { apiClient } from '@/services/apiClient';

export interface ExamPlan {
  id: string;
  courseId?: string;
  courseName?: string;
  title: string;
  examDate: string;
  dailyMinutes: number;
  daysRemaining: number;
  createdAt: string;
}

export interface PlanTask {
  type: 'flashcards' | 'concept' | 'mistakes' | 'mock-exam' | 'practice' | 'review';
  title: string;
  reason: string;
  minutes: number;
  url?: string;
}

export interface PlanDay {
  date: string;
  label: string;
  minutes: number;
  tasks: PlanTask[];
}

export interface ExamSchedule {
  plan: ExamPlan;
  days: PlanDay[];
}

export interface CramSheet {
  examPlanId: string;
  title: string;
  examDate: string;
  markdown: string;
  generatedAt: string;
}

export interface MockExamQuestion {
  quizId: string;
  question: string;
  options: string[];
}

export interface MockExam {
  courseId?: string;
  questions: MockExamQuestion[];
  suggestedMinutes: number;
}

export interface MockExamResultItem {
  quizId: string;
  question: string;
  correctAnswer: string;
  userAnswer: string;
  correct: boolean;
  explanation: string;
}

export interface MockExamResult {
  score: number;
  total: number;
  items: MockExamResultItem[];
}

export const plannerService = {
  async listExamPlans(): Promise<ExamPlan[]> {
    const res = await apiClient.get<{ data: ExamPlan[] }>('/api/planner/exam-plans');
    return res.data.data ?? [];
  },

  async createExamPlan(data: { title: string; examDate: string; courseId?: string; dailyMinutes: number }): Promise<ExamPlan> {
    const res = await apiClient.post<{ data: ExamPlan }>('/api/planner/exam-plans', data);
    return res.data.data;
  },

  async deleteExamPlan(planId: string): Promise<void> {
    await apiClient.delete(`/api/planner/exam-plans/${planId}`);
  },

  async getSchedule(planId: string): Promise<ExamSchedule> {
    const res = await apiClient.get<{ data: ExamSchedule }>(`/api/planner/exam-plans/${planId}/schedule`);
    return res.data.data;
  },

  async getCramSheet(planId: string, refresh = false): Promise<CramSheet> {
    const res = await apiClient.get<{ data: CramSheet }>(`/api/planner/exam-plans/${planId}/cram-sheet${refresh ? '?refresh=true' : ''}`);
    return res.data.data;
  },

  async getMockExam(courseId?: string, count = 10): Promise<MockExam> {
    const params = new URLSearchParams({ count: String(count) });
    if (courseId) params.set('courseId', courseId);
    const res = await apiClient.get<{ data: MockExam }>(`/api/planner/mock-exam?${params}`);
    return res.data.data;
  },

  async gradeMockExam(answers: Record<string, string>, durationSeconds: number): Promise<MockExamResult> {
    const res = await apiClient.post<{ data: MockExamResult }>('/api/planner/mock-exam/grade', { answers, durationSeconds });
    return res.data.data;
  },
};
