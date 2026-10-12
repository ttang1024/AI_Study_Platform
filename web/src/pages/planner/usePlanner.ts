import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { calendarService } from '../../services/calendarService';
import {
  plannerService, type ExamPlan, type ExamSchedule, type MockExam,
} from '../../services/plannerService';

/** All state, effects and handlers backing PlannerPage. */
export function usePlanner() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [plans, setPlans] = useState<ExamPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<ExamSchedule | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [cramPlanId, setCramPlanId] = useState<string | null>(null);

  const [mockCourseId, setMockCourseId] = useState('');
  const [mockCount, setMockCount] = useState(10);
  const [mockExam, setMockExam] = useState<MockExam | null>(null);
  const [mockError, setMockError] = useState('');
  const [mockLoading, setMockLoading] = useState(false);

  const loadPlans = useCallback(() => {
    plannerService.getExamPlans()
      .then((p) => {
        setPlans(p);
        setSelectedPlanId((cur) => cur ?? p[0]?.id ?? null);
      })
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadPlans(); }, [loadPlans]);

  const handleStartMock = useCallback(async (cid?: string) => {
    setMockLoading(true);
    setMockError('');
    try {
      const exam = await plannerService.getMockExam(cid !== undefined ? (cid || undefined) : (mockCourseId || undefined), mockCount);
      setMockExam(exam);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setMockError(err?.response?.data?.message ?? 'Could not assemble a mock exam.');
    } finally {
      setMockLoading(false);
    }
  }, [mockCourseId, mockCount]);

  // Deep link from the schedule: /planner?mock=<courseId|all>
  useEffect(() => {
    const mock = searchParams.get('mock');
    if (!mock) return;
    setMockCourseId(mock === 'all' ? '' : mock);
    setSearchParams({}, { replace: true });
    handleStartMock(mock === 'all' ? '' : mock);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedPlanId) { setSchedule(null); return; }
    setScheduleLoading(true);
    plannerService.getSchedule(selectedPlanId)
      .then(setSchedule)
      .catch(() => setSchedule(null))
      .finally(() => setScheduleLoading(false));
  }, [selectedPlanId]);

  const addPlan = useCallback((plan: ExamPlan) => {
    setPlans((p) => [...p, plan].sort((a, b) => a.examDate.localeCompare(b.examDate)));
    setSelectedPlanId(plan.id);
  }, []);

  const handleDelete = useCallback(async (planId: string) => {
    try {
      await plannerService.deleteExamPlan(planId);
      setPlans((p) => p.filter((x) => x.id !== planId));
      setSelectedPlanId((cur) => (cur === planId ? null : cur));
    } catch { /* plan stays listed on failure */ }
  }, []);

  const handleDownloadIcs = useCallback(async () => {
    try {
      const blob = await calendarService.downloadIcs();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'easy-study.ics';
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* download is best-effort */ }
  }, []);

  return {
    plans, loading, selectedPlanId, setSelectedPlanId,
    schedule, scheduleLoading,
    cramPlanId, setCramPlanId,
    mockCourseId, setMockCourseId, mockCount, setMockCount,
    mockExam, setMockExam, mockError, mockLoading,
    loadPlans, addPlan, handleDelete, handleStartMock, handleDownloadIcs,
  };
}
