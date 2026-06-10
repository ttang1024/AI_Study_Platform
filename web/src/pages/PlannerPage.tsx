import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  CalendarClock, Plus, Trash2, Timer, Play, CheckCircle2, XCircle,
  BrainCircuit, Target, BookX, Award, Loader2, Download,
} from 'lucide-react';
import {
  plannerService, type ExamPlan, type ExamSchedule, type MockExam, type MockExamResult,
} from '../services/plannerService';
import { gamificationService } from '../services/gamificationService';
import { useStudy } from '../context/StudyContext';
import { Select } from '../components/common/Select';
import { cn } from '../utils/cn';

const taskIcon = (type: string) => {
  switch (type) {
    case 'flashcards': return <BrainCircuit size={14} className="text-teal-500" />;
    case 'concept': return <Target size={14} className="text-amber-500" />;
    case 'mistakes': return <BookX size={14} className="text-red-400" />;
    case 'mock-exam': return <Award size={14} className="text-purple-500" />;
    default: return <Play size={14} className="text-gray-400" />;
  }
};

// ── Mock exam runner ──────────────────────────────────────────────────────────

const MockExamRunner: React.FC<{ exam: MockExam; onDone: () => void }> = ({ exam, onDone }) => {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<MockExamResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    if (result) return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, [result]);

  const limitSeconds = exam.suggestedMinutes * 60;
  const remaining = Math.max(0, limitSeconds - elapsed);
  const overTime = elapsed > limitSeconds;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const r = await plannerService.gradeMockExam(answers, Math.floor((Date.now() - startRef.current) / 1000));
      setResult(r);
    } catch { /* leave the runner open so answers aren't lost */ } finally {
      setSubmitting(false);
    }
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  if (result) {
    const pct = result.total === 0 ? 0 : Math.round((100 * result.score) / result.total);
    return (
      <div className="space-y-4">
        <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
          <p className="text-3xl font-black text-text-main">{result.score} / {result.total}</p>
          <p className={cn('text-sm font-medium mt-1', pct >= 70 ? 'text-green-600' : 'text-amber-600')}>
            {pct}% — {pct >= 90 ? 'exam-ready' : pct >= 70 ? 'almost there' : 'wrong answers were added to your mistake notebook'}
          </p>
          <button
            onClick={onDone}
            className="mt-4 text-xs font-medium border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50"
          >
            Back to planner
          </button>
        </div>
        <div className="space-y-2">
          {result.items.map((item) => (
            <div key={item.quizId} className={cn(
              'bg-white border rounded-xl p-4',
              item.correct ? 'border-green-200' : 'border-red-200',
            )}>
              <div className="flex items-start gap-2">
                {item.correct
                  ? <CheckCircle2 size={16} className="text-green-500 shrink-0 mt-0.5" />
                  : <XCircle size={16} className="text-red-400 shrink-0 mt-0.5" />}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-main">{item.question}</p>
                  {!item.correct && (
                    <p className="text-xs text-red-500 mt-1">Your answer: {item.userAnswer || '—'} · Correct: {item.correctAnswer}</p>
                  )}
                  {item.explanation && <p className="text-xs text-gray-500 mt-1">{item.explanation}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3">
        <Timer size={16} className={overTime ? 'text-red-500' : 'text-teal-600'} />
        <span className={cn('font-mono text-sm font-bold', overTime ? 'text-red-500' : 'text-text-main')}>
          {overTime ? `+${fmt(elapsed - limitSeconds)} over` : fmt(remaining)}
        </span>
        <span className="text-xs text-gray-400">
          {Object.keys(answers).length}/{exam.questions.length} answered
        </span>
        <button
          onClick={handleSubmit}
          disabled={submitting || Object.keys(answers).length === 0}
          className="ml-auto inline-flex items-center gap-1.5 bg-teal-600 text-white text-xs font-medium px-4 py-2 rounded-lg hover:bg-teal-700 disabled:opacity-50"
        >
          {submitting && <Loader2 size={12} className="animate-spin" />} Submit exam
        </button>
      </div>

      {exam.questions.map((q, i) => (
        <div key={q.quizId} className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-sm font-medium text-text-main mb-3">{i + 1}. {q.question}</p>
          <div className="space-y-2">
            {q.options.map((opt) => (
              <button
                key={opt}
                onClick={() => setAnswers((a) => ({ ...a, [q.quizId]: opt }))}
                className={cn(
                  'w-full text-left text-sm px-3 py-2 rounded-lg border transition-colors',
                  answers[q.quizId] === opt
                    ? 'border-teal-400 bg-teal-50 text-teal-800'
                    : 'border-gray-200 hover:border-teal-200 text-gray-700',
                )}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

// ── Page ──────────────────────────────────────────────────────────────────────

export const PlannerPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { courses } = useStudy();

  const [plans, setPlans] = useState<ExamPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<ExamSchedule | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [examDate, setExamDate] = useState('');
  const [courseId, setCourseId] = useState('');
  const [dailyMinutes, setDailyMinutes] = useState(30);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

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
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadPlans(); }, [loadPlans]);

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

  const handleCreate = async () => {
    if (!title.trim() || !examDate) return;
    setCreating(true);
    setCreateError('');
    try {
      const plan = await plannerService.createExamPlan({
        title: title.trim(),
        examDate,
        courseId: courseId || undefined,
        dailyMinutes,
      });
      setShowCreate(false);
      setTitle(''); setExamDate(''); setCourseId(''); setDailyMinutes(30);
      setPlans((p) => [...p, plan].sort((a, b) => a.examDate.localeCompare(b.examDate)));
      setSelectedPlanId(plan.id);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setCreateError(err?.response?.data?.message ?? 'Failed to create plan.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (planId: string) => {
    try {
      await plannerService.deleteExamPlan(planId);
      setPlans((p) => p.filter((x) => x.id !== planId));
      setSelectedPlanId((cur) => (cur === planId ? null : cur));
    } catch { /* plan stays listed on failure */ }
  };

  const handleStartMock = async (cid?: string) => {
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
  };

  const handleDownloadIcs = async () => {
    try {
      const blob = await gamificationService.downloadCalendarIcs();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'easy-study.ics';
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* download is best-effort */ }
  };

  if (mockExam) {
    return (
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-purple-50 text-purple-500 flex items-center justify-center">
            <Award size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-main">Mock Exam</h1>
            <p className="text-sm text-text-muted">{mockExam.questions.length} questions · suggested {mockExam.suggestedMinutes} min</p>
          </div>
        </div>
        <MockExamRunner exam={mockExam} onDone={() => { setMockExam(null); loadPlans(); }} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
          <CalendarClock size={20} />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-text-main">Study Planner</h1>
          <p className="text-sm text-text-muted">Set an exam date — your daily plan blends due reviews, knowledge gaps and practice.</p>
        </div>
        <button
          onClick={handleDownloadIcs}
          className="inline-flex items-center gap-1.5 text-xs font-medium border border-gray-200 px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-50"
          title="Download .ics calendar with due cards, study blocks and exam dates"
        >
          <Download size={13} /> Calendar (.ics)
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: plans + mock exam */}
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">Exam plans</h2>
              <button
                onClick={() => setShowCreate((v) => !v)}
                className="p-1.5 rounded-lg text-teal-600 hover:bg-teal-50"
                title="New exam plan"
              >
                <Plus size={16} />
              </button>
            </div>

            {showCreate && (
              <div className="px-4 py-3 border-b border-gray-100 space-y-2">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Exam name (e.g. Biology midterm)"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-200"
                />
                <input
                  type="date"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-200"
                />
                <Select value={courseId} onChange={(e) => setCourseId(e.target.value)} size="xs">
                  <option value="">All courses</option>
                  {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={10}
                    max={480}
                    value={dailyMinutes}
                    onChange={(e) => setDailyMinutes(Number(e.target.value))}
                    className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-200"
                  />
                  <span className="text-xs text-gray-500">min / day</span>
                  <button
                    onClick={handleCreate}
                    disabled={creating || !title.trim() || !examDate}
                    className="ml-auto bg-teal-600 text-white text-xs font-medium px-3 py-2 rounded-lg hover:bg-teal-700 disabled:opacity-50"
                  >
                    {creating ? 'Creating…' : 'Create'}
                  </button>
                </div>
                {createError && <p className="text-xs text-red-500">{createError}</p>}
              </div>
            )}

            <ul className="divide-y divide-gray-50">
              {loading ? (
                <li className="px-4 py-3 text-xs text-gray-400">Loading…</li>
              ) : plans.length === 0 ? (
                <li className="px-4 py-4 text-xs text-gray-400">No exam plans yet — add one to get a daily schedule.</li>
              ) : plans.map((p) => (
                <li
                  key={p.id}
                  className={cn(
                    'px-4 py-3 cursor-pointer transition-colors',
                    selectedPlanId === p.id ? 'bg-teal-50/60' : 'hover:bg-gray-50',
                  )}
                  onClick={() => setSelectedPlanId(p.id)}
                >
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-main truncate">{p.title}</p>
                      <p className="text-[11px] text-gray-400">
                        {new Date(p.examDate).toLocaleDateString()} {p.courseName ? `· ${p.courseName}` : ''}
                      </p>
                    </div>
                    <span className={cn(
                      'text-[11px] font-bold px-2 py-1 rounded-lg',
                      p.daysRemaining <= 3 ? 'bg-red-50 text-red-600' : p.daysRemaining <= 7 ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-500',
                    )}>
                      {p.daysRemaining}d
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                      className="p-1 rounded text-gray-300 hover:text-red-400"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Award size={14} className="text-purple-500" /> Timed mock exam
            </h2>
            <Select value={mockCourseId} onChange={(e) => setMockCourseId(e.target.value)} size="xs">
              <option value="">All courses</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <div className="flex items-center gap-2">
              <Select value={String(mockCount)} onChange={(e) => setMockCount(Number(e.target.value))} size="xs" className="w-28">
                {[5, 10, 15, 20, 30].map((n) => <option key={n} value={n}>{n} questions</option>)}
              </Select>
              <button
                onClick={() => handleStartMock()}
                disabled={mockLoading}
                className="ml-auto inline-flex items-center gap-1.5 bg-purple-600 text-white text-xs font-medium px-3 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {mockLoading ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />} Start
              </button>
            </div>
            {mockError && <p className="text-xs text-red-500">{mockError}</p>}
            <p className="text-[11px] text-gray-400">Sampled from your quiz bank; wrong answers feed the mistake notebook.</p>
          </div>
        </div>

        {/* Right: schedule */}
        <div className="lg:col-span-2">
          {scheduleLoading ? (
            <div className="space-y-3 animate-pulse">
              {[1, 2, 3].map((i) => <div key={i} className="h-28 bg-gray-100 rounded-xl" />)}
            </div>
          ) : !schedule ? (
            <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-sm text-gray-400">
              Select or create an exam plan to see your daily schedule.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white rounded-xl px-5 py-4 flex items-center gap-4">
                <div>
                  <p className="text-xs opacity-80">Countdown</p>
                  <p className="text-2xl font-black">{schedule.plan.daysRemaining} days</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{schedule.plan.title}</p>
                  <p className="text-xs opacity-80">{new Date(schedule.plan.examDate).toLocaleDateString()} · {schedule.plan.dailyMinutes} min/day</p>
                </div>
              </div>

              {schedule.days.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-xl p-6 text-center text-sm text-gray-400">
                  Exam day is here — good luck! 🎓
                </div>
              ) : schedule.days.map((day) => (
                <div key={day.date} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-50 bg-gray-50/60">
                    <span className="text-xs font-bold text-gray-700">{day.label}</span>
                    <span className="text-[11px] text-gray-400">{day.minutes} min</span>
                  </div>
                  <ul className="divide-y divide-gray-50">
                    {day.tasks.map((task, i) => (
                      <li
                        key={i}
                        className={cn('flex items-start gap-3 px-4 py-2.5', task.url && 'cursor-pointer hover:bg-gray-50')}
                        onClick={() => task.url && navigate(task.url)}
                      >
                        <span className="mt-0.5 shrink-0">{taskIcon(task.type)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-text-main">{task.title}</p>
                          <p className="text-[11px] text-gray-400">{task.reason}</p>
                        </div>
                        <span className="text-[11px] text-gray-400 shrink-0">{task.minutes}m</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
