import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { calendarService, type DayBusySummary } from '../../services/calendarService';
import {
  plannerService, type ExamPlan, type ExamSchedule, type MockExam,
} from '../../services/plannerService';
import { gamificationService } from '../../services/gamificationService';

/** All state, effects and handlers backing PlannerPage. */
export function usePlanner() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [plans, setPlans] = useState<ExamPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<ExamSchedule | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [busyByDate, setBusyByDate] = useState<Record<string, DayBusySummary>>({});
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

  // Busy times from connected calendars (Settings → Export & Interop) so each
  // planned day shows real commitments next to the study plan.
  useEffect(() => {
    if (!schedule || schedule.days.length === 0) { setBusyByDate({}); return; }
    const first = schedule.days[0].date.slice(0, 10);
    const last = schedule.days[schedule.days.length - 1].date.slice(0, 10);
    const to = new Date(last);
    to.setDate(to.getDate() + 1);
    calendarService.getBusyTimes(first, to.toISOString().slice(0, 10))
      .then(days => {
        const map: Record<string, DayBusySummary> = {};
        for (const d of days) map[d.date.slice(0, 10)] = d;
        setBusyByDate(map);
      })
      .catch(() => setBusyByDate({}));
  }, [schedule]);

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
      const blob = await gamificationService.downloadCalendarIcs();
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
    schedule, scheduleLoading, busyByDate,
    cramPlanId, setCramPlanId,
    mockCourseId, setMockCourseId, mockCount, setMockCount,
    mockExam, setMockExam, mockError, mockLoading,
    loadPlans, addPlan, handleDelete, handleStartMock, handleDownloadIcs,
  };
}
