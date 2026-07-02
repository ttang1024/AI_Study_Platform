import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Flame, Award, Target, Play, Pencil } from 'lucide-react';
import { todayService, type TodayPlan } from '../../services/todayService';
import { analyticsService } from '../../services/analyticsService';
import { CARD_SHADOW, loadDone } from './todayCommon';

// ─── Progress ring ──────────────────────────────────────────────────────────────
const ProgressRing: React.FC<{ percent: number; size?: number }> = ({ percent, size = 128 }) => {
  const stroke = 11;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(percent, 100) / 100) * c;
  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(13,148,136,0.12)" strokeWidth={stroke} />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--primary)" strokeWidth={stroke}
        strokeLinecap="round" strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
      />
    </svg>
  );
};

// ─── Small stat tile (with optional inline edit for the goal) ───────────────────
const Stat: React.FC<{
  label: string; value: string;
  onEdit?: () => void; editing?: boolean; draft?: string;
  onDraft?: (v: string) => void; onSave?: () => void;
}> = ({ label, value, onEdit, editing, draft, onDraft, onSave }) => (
  <div className="rounded-2xl bg-zinc-50 px-4 py-3">
    <div className="flex items-center justify-between">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">{label}</p>
      {onEdit && !editing && (
        <button onClick={onEdit} className="text-text-muted hover:text-[var(--primary)] transition-colors" aria-label="Edit daily goal">
          <Pencil size={11} />
        </button>
      )}
    </div>
    {editing ? (
      <input
        autoFocus type="number" value={draft}
        onChange={e => onDraft?.(e.target.value)}
        onBlur={onSave}
        onKeyDown={e => { if (e.key === 'Enter') onSave?.(); }}
        className="w-full mt-1 text-[22px] font-bold tabular-nums text-text-main bg-transparent border-b border-[var(--primary)] outline-none"
      />
    ) : (
      <p className="text-[22px] font-bold tabular-nums text-text-main mt-1">{value}</p>
    )}
  </div>
);

// ─── Hero ─────────────────────────────────────────────────────────────────────
// The daily-plan hero, formerly the head of the /today page. Now the head card
// of the dashboard.
export const TodayProgressHero: React.FC = () => {
  const [plan, setPlan] = useState<TodayPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [done] = useState<Set<string>>(loadDone);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState('');

  useEffect(() => {
    todayService.getTodayPlan()
      .then(setPlan)
      .catch(() => setPlan(null))
      .finally(() => setLoading(false));
  }, []);

  const saveGoal = async () => {
    const minutes = parseInt(goalDraft, 10);
    setEditingGoal(false);
    if (!Number.isFinite(minutes) || !plan || minutes === plan.dailyGoalMinutes) return;
    const clamped = Math.max(5, Math.min(600, minutes));
    setPlan({ ...plan, dailyGoalMinutes: clamped });
    try {
      await analyticsService.updateDailyGoal(clamped);
      setPlan(await todayService.getTodayPlan());
    } catch { /* keep optimistic value */ }
  };

  const core = useMemo(() => (plan?.items ?? []).filter(i => !i.stretch), [plan]);
  const coreRemaining = core.filter(i => !done.has(i.id)).length;
  const firstActionUrl = (core.find(i => !done.has(i.id) && i.url) ?? core.find(i => i.url))?.url ?? '/practice';

  if (loading) {
    return (
      <div className="bg-white rounded-3xl p-8 text-center text-sm text-text-muted" style={{ boxShadow: CARD_SHADOW }}>
        Building your plan…
      </div>
    );
  }

  if (!plan) return null;

  return (
    <div className="relative bg-white rounded-3xl p-6 lg:p-8 overflow-hidden" style={{ boxShadow: CARD_SHADOW }}>
      <Target size={220} strokeWidth={0.75} className="pointer-events-none absolute -right-10 -top-12 text-[var(--primary)] opacity-[0.05]" />
      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center gap-8">
        {/* Ring */}
        <div className="relative shrink-0 flex items-center justify-center self-center">
          <ProgressRing percent={plan.completionPercent} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[30px] font-bold leading-none tabular-nums text-text-main">{plan.completionPercent}%</span>
            <span className="text-[10px] font-medium text-text-muted mt-0.5">of goal</span>
          </div>
        </div>

        {/* Stats + streak */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-4">
            <Flame size={18} className={plan.streak.currentStreak > 0 ? 'text-orange-500' : 'text-zinc-300'} />
            <span className="text-[16px] font-semibold text-text-main">
              {plan.streak.currentStreak > 0 ? `${plan.streak.currentStreak}-day streak` : 'Start a streak today'}
            </span>
            {plan.streak.longestStreak > 0 && (
              <span className="text-[12px] text-text-muted">· best {plan.streak.longestStreak}</span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Studied today" value={`${plan.todayMinutes}m`} />
            <Stat label="Daily goal" value={`${plan.dailyGoalMinutes}m`} onEdit={() => { setGoalDraft(String(plan.dailyGoalMinutes)); setEditingGoal(true); }} editing={editingGoal} draft={goalDraft} onDraft={setGoalDraft} onSave={saveGoal} />
            <Stat label="Cards due" value={String(plan.dueFlashcards)} />
            <Stat label="Focus left" value={String(coreRemaining)} />
          </div>

          <p className="text-[13px] text-text-muted mt-4">
            {plan.goalMet
              ? '🎉 Daily goal reached — anything below is a bonus.'
              : coreRemaining === 0
                ? 'Plan complete. Keep going with the stretch goals in Insights.'
                : `${coreRemaining} focus task${coreRemaining === 1 ? '' : 's'} left · ~${plan.plannedMinutes}m planned`}
          </p>
        </div>

        {/* CTA */}
        <div className="shrink-0 self-stretch lg:self-center flex lg:flex-col gap-2.5">
          <Link
            to={firstActionUrl}
            className="flex-1 lg:flex-none inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] text-white px-6 py-3.5 text-[15px] font-bold hover:opacity-90 transition-opacity whitespace-nowrap"
          >
            <Play size={16} /> Start session
          </Link>
          <Link
            to="/practice?smart=1"
            className="flex-1 lg:flex-none inline-flex items-center justify-center gap-2 rounded-2xl bg-zinc-100 text-text-main px-6 py-3.5 text-[15px] font-bold hover:bg-zinc-200 transition-colors whitespace-nowrap"
          >
            <Award size={16} /> Smart session
          </Link>
        </div>
      </div>
    </div>
  );
};
