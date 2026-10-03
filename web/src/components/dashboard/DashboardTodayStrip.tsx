import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Flame, Target, CalendarClock, Loader2, Check, Pencil, Snowflake, Plane, X } from 'lucide-react';
import { analyticsService, invalidateDashboardSummaryCache, type DashboardSummary, type StudyStreak } from '../../services/analyticsService';

const CARD_SHADOW = '0 1px 3px rgba(0,0,0,0.06), 0 6px 20px rgba(0,0,0,0.05)';
const GOAL_PRESETS = [15, 30, 45, 60, 90];

// ─── Tile shell ─────────────────────────────────────────────────────────────────
const Tile: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="bg-white rounded-2xl p-5 flex items-center gap-4" style={{ boxShadow: CARD_SHADOW }}>
    {children}
  </div>
);

const TileSkeleton: React.FC = () => (
  <Tile>
    <div className="shrink-0 w-11 h-11 rounded-xl bg-zinc-100 flex items-center justify-center">
      <Loader2 size={18} className="animate-spin text-zinc-300" />
    </div>
    <div className="flex-1 space-y-2">
      <div className="h-2.5 w-20 rounded bg-zinc-100" />
      <div className="h-5 w-16 rounded bg-zinc-100" />
    </div>
  </Tile>
);

// ─── Streak (with freeze bank + vacation mode) ─────────────────────────────────────
const StreakTile: React.FC<{ streak: StudyStreak; onChanged: () => void }> = ({ streak, onChanged }) => {
  const { currentStreak: current, longestStreak: longest, freezesAvailable, vacationUntil } = streak;
  const lit = current > 0;
  const [planning, setPlanning] = useState(false);
  const [untilDate, setUntilDate] = useState('');
  const [saving, setSaving] = useState(false);

  const onVacation = vacationUntil != null && new Date(vacationUntil) >= new Date(new Date().toDateString());

  const scheduleVacation = async () => {
    if (!untilDate) return;
    setSaving(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      await analyticsService.setVacation(today, untilDate);
      invalidateDashboardSummaryCache();
      setPlanning(false);
      onChanged();
    } finally {
      setSaving(false);
    }
  };

  const cancelVacation = async () => {
    setSaving(true);
    try {
      await analyticsService.cancelVacation();
      invalidateDashboardSummaryCache();
      onChanged();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Tile>
      <div
        className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center"
        style={{ background: onVacation ? 'rgba(59,130,246,0.12)' : lit ? 'rgba(249,115,22,0.12)' : 'rgba(0,0,0,0.04)' }}
      >
        {onVacation
          ? <Plane size={20} className="text-blue-500" />
          : <Flame size={20} className={lit ? 'text-orange-500' : 'text-zinc-300'} fill={lit ? 'currentColor' : 'none'} />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="text-[11px] font-semibold text-text-muted">Study streak</p>
          {freezesAvailable > 0 && (
            <span
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-sky-50 text-sky-600 text-[10px] font-bold tabular-nums"
              title={`${freezesAvailable} streak freeze${freezesAvailable === 1 ? '' : 's'} banked — auto-used if you miss a day`}
            >
              <Snowflake size={10} /> {freezesAvailable}
            </span>
          )}
          <button
            onClick={() => setPlanning(v => !v)}
            className="text-text-muted hover:text-blue-500 transition-colors"
            title="Vacation mode — pause your streak for planned time off"
          >
            <Plane size={11} />
          </button>
        </div>
        {planning ? (
          <div className="flex items-center gap-1.5 mt-1.5">
            <input
              type="date"
              value={untilDate}
              min={new Date().toISOString().slice(0, 10)}
              onChange={e => setUntilDate(e.target.value)}
              className="text-[11px] border border-zinc-200 rounded-md px-1.5 py-1 text-text-main"
            />
            <button
              onClick={scheduleVacation}
              disabled={!untilDate || saving}
              className="px-2 py-1 rounded-md bg-blue-500 text-white text-[11px] font-semibold disabled:opacity-50"
            >
              Pause
            </button>
            <button onClick={() => setPlanning(false)} className="text-text-muted hover:text-text-main">
              <X size={12} />
            </button>
          </div>
        ) : (
          <>
            <p className="text-2xl font-bold leading-none text-text-main tracking-tight mt-1 tabular-nums">
              {current} <span className="text-sm font-semibold text-text-muted">day{current === 1 ? '' : 's'}</span>
            </p>
            {onVacation ? (
              <p className="text-[11px] text-blue-500 mt-1">
                On vacation until {new Date(vacationUntil!).toLocaleDateString()} ·{' '}
                <button onClick={cancelVacation} disabled={saving} className="underline hover:text-blue-600">resume</button>
              </p>
            ) : (
              <p className="text-[11px] text-text-muted mt-1">
                {lit ? `Longest: ${longest} day${longest === 1 ? '' : 's'}` : 'Study today to start a streak'}
              </p>
            )}
          </>
        )}
      </div>
    </Tile>
  );
};

// ─── Daily goal (editable, persisted server-side) ───────────────────────────────────
const GoalTile: React.FC<{ todayMinutes: number; goalMinutes: number }> = ({ todayMinutes, goalMinutes }) => {
  const [goal, setGoal] = useState(goalMinutes);
  const [editing, setEditing] = useState(false);
  const progress = Math.min(1, goal > 0 ? todayMinutes / goal : 0);
  const met = todayMinutes >= goal;

  // Keep in sync if the summary reloads with a different stored goal.
  useEffect(() => { setGoal(goalMinutes); }, [goalMinutes]);

  const save = (minutes: number) => {
    const previous = goal;
    setGoal(minutes);            // optimistic
    setEditing(false);
    analyticsService.updateDailyGoal(minutes).catch(() => setGoal(previous));
  };

  // Progress ring geometry.
  const R = 18, C = 2 * Math.PI * R;

  return (
    <Tile>
      <div className="relative shrink-0 w-11 h-11">
        <svg viewBox="0 0 44 44" className="w-11 h-11 -rotate-90">
          <circle cx="22" cy="22" r={R} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="4" />
          <motion.circle
            cx="22" cy="22" r={R} fill="none"
            stroke={met ? '#059669' : 'var(--primary)'} strokeWidth="4" strokeLinecap="round"
            strokeDasharray={C}
            initial={{ strokeDashoffset: C }}
            animate={{ strokeDashoffset: C * (1 - progress) }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          {met
            ? <Check size={16} className="text-[#059669]" />
            : <Target size={15} className="text-[var(--primary)]" />}
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="text-[11px] font-semibold text-text-muted">Daily goal</p>
          <button
            onClick={() => setEditing(v => !v)}
            className="text-text-muted hover:text-[var(--primary)] transition-colors"
            title="Change daily goal"
          >
            <Pencil size={11} />
          </button>
        </div>
        {editing ? (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {GOAL_PRESETS.map(m => (
              <button
                key={m}
                onClick={() => save(m)}
                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-colors ${
                  m === goal ? 'bg-[var(--primary)] text-white' : 'bg-zinc-100 text-text-muted hover:bg-zinc-200'
                }`}
              >
                {m}m
              </button>
            ))}
          </div>
        ) : (
          <>
            <p className="text-2xl font-bold leading-none text-text-main tracking-tight mt-1 tabular-nums">
              {todayMinutes}<span className="text-sm font-semibold text-text-muted"> / {goal} min</span>
            </p>
            <p className="text-[11px] mt-1" style={{ color: met ? '#059669' : 'var(--text-muted)' }}>
              {met ? 'Goal reached today 🎉' : `${Math.max(0, goal - todayMinutes)} min to go`}
            </p>
          </>
        )}
      </div>
    </Tile>
  );
};

// ─── Due reviews ────────────────────────────────────────────────────────────────────
const DueTile: React.FC<{ due: number }> = ({ due }) => {
  const hasDue = due > 0;
  return (
    <Link to="/flashcards?tab=review" className="group block rounded-2xl">
      <div
        className="bg-white rounded-2xl p-5 flex items-center gap-4 transition-all duration-200 group-hover:-translate-y-px"
        style={{ boxShadow: CARD_SHADOW }}
      >
        <div
          className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center"
          style={{ background: hasDue ? 'rgba(13,148,136,0.1)' : 'rgba(0,0,0,0.04)' }}
        >
          <CalendarClock size={20} className={hasDue ? 'text-[var(--primary)]' : 'text-zinc-300'} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-text-muted">Reviews due</p>
          {hasDue ? (
            <>
              <p className="text-2xl font-bold leading-none text-text-main tracking-tight mt-1 tabular-nums">
                {due} <span className="text-sm font-semibold text-text-muted">card{due === 1 ? '' : 's'}</span>
              </p>
              <p className="text-[11px] font-semibold text-[var(--primary)] mt-1 group-hover:underline">Start review →</p>
            </>
          ) : (
            <>
              <p className="text-2xl font-bold leading-none text-text-main tracking-tight mt-1">All caught up</p>
              <p className="text-[11px] text-text-muted mt-1">No cards due right now</p>
            </>
          )}
        </div>
      </div>
    </Link>
  );
};

// ─── Strip ────────────────────────────────────────────────────────────────────────
export const DashboardTodayStrip: React.FC<{
  summary: DashboardSummary | null;
  loading: boolean;
  onRefresh?: () => void;
}> = ({ summary, loading, onRefresh }) => {
  // `summary.streak` is checked, not just `summary`: a partial payload used to throw in the tiles
  // below and blank whichever page hosts the strip, since nothing here catches a render error.
  if (loading || !summary?.streak) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <TileSkeleton />
        <TileSkeleton />
        <TileSkeleton />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <StreakTile streak={summary.streak} onChanged={() => onRefresh?.()} />
      <GoalTile todayMinutes={summary.streak.todayMinutes} goalMinutes={summary.dailyGoalMinutes} />
      <DueTile due={summary.dueFlashcards} />
    </div>
  );
};
