import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Clock, Target, GraduationCap, Loader2, BarChart3, Sparkles } from 'lucide-react';
import {
  analyticsService,
  type QuizAccuracyData,
  type TimeOnTask,
  type CourseMastery,
} from '../../services/analyticsService';
import { useDashboardSummary } from '../../hooks/useDashboardSummary';
import { DashboardTodayStrip } from './DashboardTodayStrip';
import { RecommendationsPanel } from './RecommendationsPanel';

const CARD_SHADOW = '0 1px 3px rgba(0,0,0,0.06), 0 6px 20px rgba(0,0,0,0.05)';
const PRIMARY = 'var(--primary)';

const RANGES = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
];

const formatDuration = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h === 0 && m === 0) return seconds > 0 ? '<1m' : '0m';
  return [h > 0 ? `${h}h` : null, m > 0 ? `${m}m` : null].filter(Boolean).join(' ');
};

// ─── Date helpers ───────────────────────────────────────────────────────────────────
const dayKey = (d: Date): string => {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const addDays = (d: Date, n: number): Date => {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
};
const shortLabel = (d: Date): string => `${d.getMonth() + 1}/${d.getDate()}`;

// ─── Shared building blocks ─────────────────────────────────────────────────────────
const StatTile: React.FC<{ icon: React.ElementType; label: string; value: string }> = ({ icon: Icon, label, value }) => (
  <div className="bg-white rounded-2xl p-5 flex items-center gap-4" style={{ boxShadow: CARD_SHADOW }}>
    <div className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'rgba(13,148,136,0.08)' }}>
      <Icon size={20} className="text-[var(--primary)]" />
    </div>
    <div className="min-w-0">
      <p className="text-[11px] font-semibold text-text-muted">{label}</p>
      <p className="text-2xl font-bold leading-none text-text-main tracking-tight mt-1">{value}</p>
    </div>
  </div>
);

const ChartCard: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({ title, children, className }) => (
  <div className={`bg-white rounded-2xl p-5 ${className ?? ''}`} style={{ boxShadow: CARD_SHADOW }}>
    <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-4">{title}</p>
    {children}
  </div>
);

const EmptyState: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex flex-col items-center justify-center py-8 text-center">
    <Sparkles size={22} className="text-zinc-300 mb-2" />
    <p className="text-xs text-text-muted max-w-[28ch] leading-relaxed">{children}</p>
  </div>
);

// ─── Daily study-time bar chart ─────────────────────────────────────────────────────
// Builds a continuous series across the selected window (daily for ≤31 days, weekly buckets
// beyond that) so gaps in study activity read correctly instead of collapsing together.
const StudyActivityChart: React.FC<{ daily: TimeOnTask['daily']; days: number }> = ({ daily, days }) => {
  const buckets = useMemo(() => {
    const minutesByDay = new Map(daily.map(d => [d.date.slice(0, 10), d.totalMinutes]));
    const today = new Date();
    const weekly = days > 31;

    if (weekly) {
      const weeks = Math.ceil(days / 7);
      const out: { key: string; label: string; minutes: number }[] = [];
      for (let w = weeks - 1; w >= 0; w--) {
        const end = addDays(today, -w * 7);
        let minutes = 0;
        for (let i = 0; i < 7; i++) minutes += minutesByDay.get(dayKey(addDays(end, -i))) ?? 0;
        out.push({ key: dayKey(end), label: shortLabel(addDays(end, -6)), minutes });
      }
      return out;
    }

    const out: { key: string; label: string; minutes: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = addDays(today, -i);
      out.push({ key: dayKey(d), label: shortLabel(d), minutes: minutesByDay.get(dayKey(d)) ?? 0 });
    }
    return out;
  }, [daily, days]);

  const max = Math.max(1, ...buckets.map(b => b.minutes));
  const labelEvery = Math.ceil(buckets.length / 7);
  const hasData = buckets.some(b => b.minutes > 0);

  if (!hasData) return <EmptyState>No study time recorded in this window yet — start a study session to see your activity.</EmptyState>;

  return (
    <div>
      <div className="flex items-end gap-1 h-40">
        {buckets.map((b, i) => (
          <div key={b.key} className="flex-1 min-w-0 h-full flex flex-col justify-end group relative">
            <motion.div
              className="w-full rounded-t-md"
              style={{ background: b.minutes > 0 ? PRIMARY : 'rgba(0,0,0,0.05)' }}
              initial={{ height: 0 }}
              animate={{ height: `${Math.max(b.minutes > 0 ? 4 : 2, (b.minutes / max) * 100)}%` }}
              transition={{ duration: 0.5, delay: i * 0.01, ease: [0.16, 1, 0.3, 1] }}
            />
            {/* Tooltip */}
            <div className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1 text-[10px] font-semibold text-white opacity-0 group-hover:opacity-100 transition-opacity z-10">
              {formatDuration(b.minutes * 60)}
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-1 mt-2">
        {buckets.map((b, i) => (
          <div key={b.key} className="flex-1 min-w-0 text-center">
            <span className="text-[9px] text-text-muted tabular-nums">
              {i % labelEvery === 0 ? b.label : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Quiz-accuracy trend ────────────────────────────────────────────────────────────
const AccuracyTrend: React.FC<{ data: QuizAccuracyData[] }> = ({ data }) => {
  const points = useMemo(
    () => [...data].sort((a, b) => a.date.localeCompare(b.date)),
    [data],
  );

  if (points.length === 0) return <EmptyState>No quiz attempts in this window — take a quiz to track your accuracy over time.</EmptyState>;

  const labelEvery = Math.ceil(points.length / 6);

  return (
    <div>
      <div className="flex items-end gap-1.5 h-40">
        {points.map((p, i) => {
          const pct = Math.round(p.accuracyPercentage);
          const tint = pct >= 80 ? '#059669' : pct >= 50 ? '#d97706' : '#dc2626';
          return (
            <div key={p.date} className="flex-1 min-w-0 h-full flex flex-col justify-end group relative">
              <motion.div
                className="w-full rounded-t-md"
                style={{ background: tint }}
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(4, pct)}%` }}
                transition={{ duration: 0.5, delay: i * 0.02, ease: [0.16, 1, 0.3, 1] }}
              />
              <div className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1 text-[10px] font-semibold text-white opacity-0 group-hover:opacity-100 transition-opacity z-10">
                {pct}% · {p.correctAttempts}/{p.totalAttempts}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-1.5 mt-2">
        {points.map((p, i) => (
          <div key={p.date} className="flex-1 min-w-0 text-center">
            <span className="text-[9px] text-text-muted tabular-nums">
              {i % labelEvery === 0 ? shortLabel(new Date(p.date)) : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Time by course ─────────────────────────────────────────────────────────────────
const TimeByCourse: React.FC<{ byCourse: TimeOnTask['byCourse'] }> = ({ byCourse }) => {
  const rows = useMemo(
    () => [...byCourse].filter(c => c.totalSeconds > 0).sort((a, b) => b.totalSeconds - a.totalSeconds).slice(0, 6),
    [byCourse],
  );
  const max = Math.max(1, ...rows.map(r => r.totalSeconds));

  if (rows.length === 0) return <EmptyState>No course study time logged yet in this window.</EmptyState>;

  return (
    <div className="space-y-3">
      {rows.map((c, i) => (
        <div key={c.courseId ?? c.courseName}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-text-main truncate pr-2">{c.courseName}</span>
            <span className="text-[11px] font-semibold text-text-muted tabular-nums shrink-0">{formatDuration(c.totalSeconds)}</span>
          </div>
          <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: PRIMARY }}
              initial={{ width: 0 }}
              animate={{ width: `${(c.totalSeconds / max) * 100}%` }}
              transition={{ duration: 0.6, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Course mastery breakdown ───────────────────────────────────────────────────────
const MasteryBreakdown: React.FC<{ mastery: CourseMastery[] }> = ({ mastery }) => {
  const rows = useMemo(
    () => mastery.filter(m => m.components.length > 0).sort((a, b) => b.masteryScore - a.masteryScore),
    [mastery],
  );

  if (rows.length === 0) return <EmptyState>Mastery scores appear once you've studied flashcards, quizzes, or glossary terms in a course.</EmptyState>;

  return (
    <div className="space-y-5">
      {rows.map((c, i) => (
        <div key={c.courseId}>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.courseColor || PRIMARY }} />
              <span className="text-sm font-medium text-text-main truncate">{c.courseName}</span>
            </div>
            <span className="text-sm font-bold text-text-main tabular-nums shrink-0">{Math.round(c.masteryScore)}%</span>
          </div>
          <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: c.courseColor || PRIMARY }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, c.masteryScore)}%` }}
              transition={{ duration: 0.7, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {c.components.map(comp => (
              <span
                key={comp.label}
                className="inline-flex items-center gap-1 rounded-md bg-zinc-50 px-2 py-0.5 text-[10px] font-medium text-text-muted"
                title={`${comp.sample} item${comp.sample === 1 ? '' : 's'}`}
              >
                {comp.label}
                <span className="font-bold text-text-main tabular-nums">{Math.round(comp.score)}%</span>
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Section ───────────────────────────────────────────────────────────────────────
// Full analytics view for the Insights page: a "today" strip (streak / goal / due reviews),
// range-scoped headline stats, study-time and quiz-accuracy charts, time-by-course and
// course-mastery breakdowns, and personalised recommendations. The dashboard intentionally
// stays lean and does not render this.
export const AnalyticsSection: React.FC = () => {
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [accuracy, setAccuracy] = useState<QuizAccuracyData[]>([]);
  const [timeOnTask, setTimeOnTask] = useState<TimeOnTask | null>(null);
  const [mastery, setMastery] = useState<CourseMastery[]>([]);

  const { summary, loading: summaryLoading } = useDashboardSummary();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    const fromStr = from.toISOString();
    const toStr = to.toISOString();

    Promise.all([
      analyticsService.getQuizAccuracy(fromStr, toStr),
      analyticsService.getTimeOnTask(fromStr, toStr),
      analyticsService.getCourseMastery(),
    ])
      .then(([acc, tot, mas]) => {
        if (cancelled) return;
        setAccuracy(acc);
        setTimeOnTask(tot);
        setMastery(mas);
      })
      .catch(() => { /* surfaced as em-dash placeholders / empty states */ })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [days]);

  const avgAccuracy = useMemo(() => {
    if (accuracy.length === 0) return '—';
    return `${Math.round(accuracy.reduce((s, d) => s + d.accuracyPercentage, 0) / accuracy.length)}%`;
  }, [accuracy]);

  const avgMastery = useMemo(() => {
    const scored = mastery.filter(m => m.components.length > 0);
    if (scored.length === 0) return '—';
    return `${Math.round(scored.reduce((s, m) => s + m.masteryScore, 0) / scored.length)}%`;
  }, [mastery]);

  return (
    <div className="space-y-6">
      {/* ── Today ────────────────────────────────────────────────────────── */}
      <DashboardTodayStrip summary={summary} loading={summaryLoading} />

      {/* ── Range selector ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-0.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Trends</p>
        <div className="flex items-center gap-1 bg-white rounded-xl p-1" style={{ boxShadow: CARD_SHADOW }}>
          {RANGES.map(r => (
            <button
              key={r.days}
              onClick={() => setDays(r.days)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                days === r.days ? 'bg-[var(--primary)] text-white' : 'text-text-muted hover:bg-zinc-100'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-[var(--primary)]" size={24} />
        </div>
      ) : (
        <>
          {/* Headline stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatTile icon={Clock} label="Time on task" value={formatDuration(timeOnTask?.totalSeconds ?? 0)} />
            <StatTile icon={Target} label="Avg quiz accuracy" value={avgAccuracy} />
            <StatTile icon={GraduationCap} label="Avg course mastery" value={avgMastery} />
          </div>

          {/* Study activity (full width) */}
          <ChartCard title="Study activity">
            <StudyActivityChart daily={timeOnTask?.daily ?? []} days={days} />
          </ChartCard>

          {/* Accuracy trend + time by course */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Quiz accuracy">
              <AccuracyTrend data={accuracy} />
            </ChartCard>
            <ChartCard title="Time by course">
              <TimeByCourse byCourse={timeOnTask?.byCourse ?? []} />
            </ChartCard>
          </div>

          {/* Course mastery */}
          <ChartCard title="Course mastery">
            <MasteryBreakdown mastery={mastery} />
          </ChartCard>
        </>
      )}

      {/* ── Recommendations ──────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3 px-0.5">
          <BarChart3 size={14} className="text-text-muted" />
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Recommended for you</p>
        </div>
        <RecommendationsPanel />
      </div>
    </div>
  );
};
