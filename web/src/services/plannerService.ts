import { apiClient } from './apiClient'

export interface ExamPlan {
  id: string
  courseId?: string
  courseName?: string
  title: string
  examDate: string
  dailyMinutes: number
  daysRemaining: number
  createdAt: string
}

export interface PlanTask {
  type: string
  title: string
  reason: string
  minutes: number
  url?: string
}

export interface PlanDay {
  date: string
  label: string
  minutes: number
  tasks: PlanTask[]
}

export interface ExamSchedule {
  plan: ExamPlan
  days: PlanDay[]
}

export interface MockExamQuestion {
  quizId: string
  question: string
  options: string[]
}

export interface MockExam {
  courseId?: string
  questions: MockExamQuestion[]
  suggestedMinutes: number
}

export interface MockExamResultItem {
  quizId: string
  question: string
  correctAnswer: string
  userAnswer: string
  correct: boolean
  explanation: string
}

export interface MockExamResult {
  score: number
  total: number
  items: MockExamResultItem[]
}

export const plannerService = {
  async getExamPlans(): Promise<ExamPlan[]> {
    const res = await apiClient.get('/api/planner/exam-plans')
    return res.data.data
  },

  async createExamPlan(data: { title: string; examDate: string; courseId?: string; dailyMinutes: number }): Promise<ExamPlan> {
    const res = await apiClient.post('/api/planner/exam-plans', data)
    return res.data.data
  },

  async deleteExamPlan(planId: string): Promise<void> {
    await apiClient.delete(`/api/planner/exam-plans/${planId}`)
  },

  async getSchedule(planId: string): Promise<ExamSchedule> {
    const res = await apiClient.get(`/api/planner/exam-plans/${planId}/schedule`)
    return res.data.data
  },

  async getMockExam(courseId?: string, count = 10): Promise<MockExam> {
    const res = await apiClient.get('/api/planner/mock-exam', { params: { courseId, count } })
    return res.data.data
  },

  async gradeMockExam(answers: Record<string, string>, durationSeconds: number): Promise<MockExamResult> {
    const res = await apiClient.post('/api/planner/mock-exam/grade', { answers, durationSeconds })
    return res.data.data
  },
}
