import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Clock, Target, GraduationCap, Loader2 } from 'lucide-react';
import {
  analyticsService,
  type QuizAccuracyData,
  type TimeOnTask,
  type CourseMastery,
} from '../../services/analyticsService';
import { bucketByWindow } from '@core/utils/analyticsBuckets';
import { useDashboardSummary } from '../../hooks/useDashboardSummary';
import { DashboardTodayStrip } from './DashboardTodayStrip';
import { TodayPlanList } from '../today/TodayPlanList';
import { NextBestContent } from './NextBestContent';
import { CARD_SHADOW, ChartCard, EmptyState, PRIMARY, StatTile } from './dashboardChrome';

const RANGES = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
];

// Round to whole minutes first so 3599s reads "1h", not "60m" (and 7170s "2h", not "1h 60m").
const formatDuration = (seconds: number): string => {
  const totalMinutes = Math.round(seconds / 60);
  if (totalMinutes === 0) return seconds > 0 ? '<1m' : '0m';
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return [h > 0 ? `${h}h` : null, m > 0 ? `${m}m` : null].filter(Boolean).join(' ');
};

// ─── Shared building blocks ─────────────────────────────────────────────────────────
// ─── Daily study-time bar chart ─────────────────────────────────────────────────────
// Continuous-window bucketing (daily for ≤31 days, weekly beyond) lives in
// @core/utils/analyticsBuckets so rn's charts bucket identically.
const StudyActivityChart: React.FC<{ daily: TimeOnTask['daily']; days: number }> = ({ daily, days }) => {
  const buckets = useMemo(
    () =>
      bucketByWindow(daily, { dateOf: d => d.date, days }).map(b => ({
        key: b.key,
        label: b.label,
        minutes: b.items.reduce((sum, d) => sum + d.totalMinutes, 0),
      })),
    [daily, days],
  );

  const max = Math.max(1, ...buckets.map(b => b.minutes));
  const labelEvery = Math.ceil(buckets.length / 7);
  const hasData = buckets.some(b => b.minutes > 0);

  if (!hasData) return <EmptyState widthCh={28}>No study time recorded in this window yet — start a study session to see your activity.</EmptyState>;

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
const accuracyTint = (pct: number): string => (pct >= 80 ? '#059669' : pct >= 50 ? '#d97706' : '#dc2626');

const AccuracyLegend: React.FC = () => (
  <div className="flex items-center gap-2.5">
    {([['≥80%', 80], ['50–79%', 50], ['<50%', 0]] as const).map(([label, pct]) => (
      <span key={label} className="flex items-center gap-1 text-[10px] text-text-muted tabular-nums">
        <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: accuracyTint(pct) }} />
        {label}
      </span>
    ))}
  </div>
);

// Same continuous-window bucketing as the study-activity chart, so quiet stretches read as gaps
// instead of compressing the time axis. Bucket accuracy is attempt-weighted (total correct over
// total attempts), which is why the raw counts are carried through rather than a percentage.
const AccuracyTrend: React.FC<{ data: QuizAccuracyData[]; days: number }> = ({ data, days }) => {
  const buckets = useMemo(
    () =>
      bucketByWindow(data, { dateOf: d => d.date, days }).map(b => ({
        key: b.key,
        label: b.label,
        total: b.items.reduce((sum, d) => sum + d.totalAttempts, 0),
        correct: b.items.reduce((sum, d) => sum + d.correctAttempts, 0),
      })),
    [data, days],
  );

  const hasData = buckets.some(b => b.total > 0);
  if (!hasData) return <EmptyState widthCh={28}>No quiz attempts in this window — take a quiz to track your accuracy over time.</EmptyState>;

  const labelEvery = Math.ceil(buckets.length / 7);

  return (
    <div>
      <div className="flex items-end gap-1 h-40">
        {buckets.map((b, i) => {
          const pct = b.total > 0 ? Math.round((b.correct / b.total) * 100) : 0;
          return (
            <div key={b.key} className="flex-1 min-w-0 h-full flex flex-col justify-end group relative">
              <motion.div
                className="w-full rounded-t-md"
                style={{ background: b.total > 0 ? accuracyTint(pct) : 'rgba(0,0,0,0.05)' }}
                initial={{ height: 0 }}
                animate={{ height: `${b.total > 0 ? Math.max(4, pct) : 2}%` }}
                transition={{ duration: 0.5, delay: i * 0.01, ease: [0.16, 1, 0.3, 1] }}
              />
              {b.total > 0 && (
                <div className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1 text-[10px] font-semibold text-white opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  {b.label} · {pct}% · {b.correct}/{b.total}
                </div>
              )}
            </div>
          );
        })}
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

// ─── Time by course ─────────────────────────────────────────────────────────────────
// Bars are each course's true share of the window's total (not relative to the largest
// course), so widths and the printed percentages agree. Courses past the top six are
// rolled into "Other" instead of silently dropped.
const MUTED_BAR = '#a1a1aa';

const TimeByCourse: React.FC<{ byCourse: TimeOnTask['byCourse'] }> = ({ byCourse }) => {
  const { rows, totalSeconds } = useMemo(() => {
    const active = [...byCourse].filter(c => c.totalSeconds > 0).sort((a, b) => b.totalSeconds - a.totalSeconds);
    const total = active.reduce((s, c) => s + c.totalSeconds, 0);
    const top = active.slice(0, 6).map(c => ({ ...c, muted: c.courseId == null }));
    const rest = active.slice(6);
    if (rest.length > 0) {
      top.push({
        courseId: null,
        courseName: `Other (${rest.length} course${rest.length === 1 ? '' : 's'})`,
        courseColor: null,
        totalSeconds: rest.reduce((s, c) => s + c.totalSeconds, 0),
        muted: true,
      });
    }
    return { rows: top, totalSeconds: total };
  }, [byCourse]);

  if (rows.length === 0) return <EmptyState widthCh={28}>No course study time logged yet in this window.</EmptyState>;

  return (
    <div className="space-y-3.5">
      {rows.map((c, i) => {
        const share = (c.totalSeconds / Math.max(1, totalSeconds)) * 100;
        const color = c.muted ? MUTED_BAR : c.courseColor || PRIMARY;
        return (
          <div key={c.courseId ?? c.courseName}>
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                <span className={`text-xs font-medium truncate ${c.muted ? 'text-text-muted' : 'text-text-main'}`}>{c.courseName}</span>
              </div>
              <span className="text-[11px] text-text-muted tabular-nums shrink-0">
                <span className="font-semibold text-text-main">{formatDuration(c.totalSeconds)}</span>
                {' · '}{Math.round(share)}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: color }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(share, 1.5)}%` }}
                transition={{ duration: 0.6, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─── Course mastery breakdown ───────────────────────────────────────────────────────
const MasteryBreakdown: React.FC<{ mastery: CourseMastery[] }> = ({ mastery }) => {
  const rows = useMemo(
    () => mastery.filter(m => m.components.length > 0).sort((a, b) => b.masteryScore - a.masteryScore),
    [mastery],
  );

  if (rows.length === 0) return <EmptyState widthCh={28}>Mastery scores appear once you've studied flashcards, quizzes, or glossary terms in a course.</EmptyState>;

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

  const { summary, loading: summaryLoading, refresh: refreshSummary } = useDashboardSummary();

  // Compute the range once per `days`. Using `new Date()` inside the effect would
  // produce millisecond-different from/to on each run, so the two effect invocations
  // React 18 StrictMode fires (mount→cleanup→mount) would hit distinct URLs and slip
  // past apiClient's in-flight GET dedupe — double-fetching time-on-task/quiz-accuracy.
  const { fromStr, toStr } = useMemo(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    return { fromStr: from.toISOString(), toStr: to.toISOString() };
  }, [days]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

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
  }, [fromStr, toStr]);

  // Attempt-weighted: total correct over total attempts. A plain mean of the daily
  // percentages would let a 1-question day count as much as a 50-question day.
  const avgAccuracy = useMemo(() => {
    const total = accuracy.reduce((s, d) => s + d.totalAttempts, 0);
    if (total === 0) return '—';
    const correct = accuracy.reduce((s, d) => s + d.correctAttempts, 0);
    return `${Math.round((correct / total) * 100)}%`;
  }, [accuracy]);

  const avgMastery = useMemo(() => {
    const scored = mastery.filter(m => m.components.length > 0);
    if (scored.length === 0) return '—';
    return `${Math.round(scored.reduce((s, m) => s + m.masteryScore, 0) / scored.length)}%`;
  }, [mastery]);

  return (
    <div className="space-y-6">
      {/* ── Today ────────────────────────────────────────────────────────── */}
      <DashboardTodayStrip summary={summary} loading={summaryLoading} onRefresh={refreshSummary} />

      {/* ── Today's plan (focus + stretch) ───────────────────────────────── */}
      <TodayPlanList />

      {/* ── Range selector ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-0.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Trends</p>
        <div className="flex items-center gap-1 bg-white rounded-xl p-1" style={{ boxShadow: CARD_SHADOW }}>
          {RANGES.map(r => (
            <button
              key={r.days}
              onClick={() => setDays(r.days)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${days === r.days ? 'bg-[var(--primary)] text-white' : 'text-text-muted hover:bg-zinc-100'
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
            <ChartCard title="Quiz accuracy" meta={<AccuracyLegend />}>
              <AccuracyTrend data={accuracy} days={days} />
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

      {/* ── Explore next: new material worth a look (review queue lives in the Today plan) ── */}
      <NextBestContent />
    </div>
  );
};
