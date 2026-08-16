import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPlannerService } from '../plannerService'
import type { HttpClient } from '../../http'

const fakeHttp: HttpClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}

describe('plannerService', () => {
  beforeEach(() => vi.clearAllMocks())
  const service = createPlannerService(fakeHttp)

  it('getExamPlans GETs the exam-plans list', async () => {
    vi.mocked(fakeHttp.get).mockResolvedValueOnce({ data: { data: [] } })
    await service.getExamPlans()
    expect(fakeHttp.get).toHaveBeenCalledWith('/api/planner/exam-plans')
  })

  it('createExamPlan posts the plan payload', async () => {
    const payload = { title: 'Finals', examDate: '2026-12-01', dailyMinutes: 30 }
    vi.mocked(fakeHttp.post).mockResolvedValueOnce({ data: { data: { id: 'p-1', ...payload, daysRemaining: 5, createdAt: '' } } })
    await service.createExamPlan(payload)
    expect(fakeHttp.post).toHaveBeenCalledWith('/api/planner/exam-plans', payload)
  })

  it('deleteExamPlan deletes by id', async () => {
    await service.deleteExamPlan('p-1')
    expect(fakeHttp.delete).toHaveBeenCalledWith('/api/planner/exam-plans/p-1')
  })

  it('getSchedule GETs the plan-scoped schedule endpoint', async () => {
    vi.mocked(fakeHttp.get).mockResolvedValueOnce({ data: { data: { plan: {}, days: [] } } })
    await service.getSchedule('p-1')
    expect(fakeHttp.get).toHaveBeenCalledWith('/api/planner/exam-plans/p-1/schedule')
  })

  it('getCramSheet passes refresh as a query param, defaulting to false', async () => {
    vi.mocked(fakeHttp.get).mockResolvedValue({ data: { data: { markdown: '' } } })

    await service.getCramSheet('p-1')
    expect(fakeHttp.get).toHaveBeenCalledWith('/api/planner/exam-plans/p-1/cram-sheet', { params: { refresh: false } })

    await service.getCramSheet('p-1', true)
    expect(fakeHttp.get).toHaveBeenCalledWith('/api/planner/exam-plans/p-1/cram-sheet', { params: { refresh: true } })
  })

  it('getMockExam defaults count to 10', async () => {
    vi.mocked(fakeHttp.get).mockResolvedValueOnce({ data: { data: { questions: [], suggestedMinutes: 20 } } })
    await service.getMockExam('c-1')
    expect(fakeHttp.get).toHaveBeenCalledWith('/api/planner/mock-exam', { params: { courseId: 'c-1', count: 10 } })
  })

  it('gradeMockExam posts answers and duration', async () => {
    const answers = { 'q-1': 'A' }
    vi.mocked(fakeHttp.post).mockResolvedValueOnce({ data: { data: { score: 1, total: 1, items: [] } } })
    await service.gradeMockExam(answers, 120)
    expect(fakeHttp.post).toHaveBeenCalledWith('/api/planner/mock-exam/grade', { answers, durationSeconds: 120 })
  })
})
